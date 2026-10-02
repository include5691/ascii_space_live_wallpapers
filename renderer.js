import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GdkPixbuf from 'gi://GdkPixbuf';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {SAMPLES_PER_CELL, SpaceFrame} from './frame.js';
import {ASCII_SHADER, sceneShader} from './shader.js';

const ROUNDED_CLIP_DECLARATIONS = `
uniform vec4 bounds;
uniform float clip_radius;
uniform vec2 texture_size;

float rounded_rect_coverage(vec2 p) {
    float center_left = bounds.x + clip_radius;
    float center_right = bounds.z - clip_radius;
    float center_x;
    if (p.x < center_left)
        center_x = center_left;
    else if (p.x > center_right)
        center_x = center_right;
    else
        return 1.0;

    float center_top = bounds.y + clip_radius;
    float center_bottom = bounds.w - clip_radius;
    float center_y;
    if (p.y < center_top)
        center_y = center_top;
    else if (p.y > center_bottom)
        center_y = center_bottom;
    else
        return 1.0;

    vec2 delta = p - vec2(center_x, center_y);
    float dist_squared = dot(delta, delta);
    float outer_radius = clip_radius + 0.5;
    if (dist_squared >= outer_radius * outer_radius)
        return 0.0;
    float inner_radius = clip_radius - 0.5;
    if (dist_squared <= inner_radius * inner_radius)
        return 1.0;
    return outer_radius - sqrt(dist_squared);
}
`;

const ROUNDED_CLIP_CODE = 'cogl_color_out *= rounded_rect_coverage(cogl_tex_coord0_in.xy * texture_size);';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const templates = new Map();

function createTemplate(context, shader, entry) {
    const pipeline = Cogl.Pipeline.new(context);
    pipeline.set_layer_null_texture(0);
    const snippet = Cogl.Snippet.new(Cogl.SnippetHook.FRAGMENT, shader, null);
    snippet.set_replace(`cogl_color_out = ${entry}(cogl_tex_coord_in[0].xy);`);
    pipeline.add_snippet(snippet);
    return pipeline;
}

function createPipeline(context, key, build) {
    if (!templates.has(key))
        templates.set(key, build());
    return templates.get(key).copy();
}

function setUniforms(target, uniforms) {
    for (const [name, components, values] of uniforms) {
        if (!target.locations.has(name))
            target.locations.set(name, target.pipeline.get_uniform_location(name));
        target.pipeline.set_uniform_float(target.locations.get(name), components, values.length / components, values);
    }
}

function createScenePipeline(context, features, slots) {
    const pipeline = createPipeline(context, `scene ${slots} ${features.join(' ')}`, () => {
        const template = createTemplate(context, sceneShader(features, slots), 'renderPixel');
        template.set_layer_texture(1, loadTexture(context, 'earth.png'));
        template.set_layer_filters(1, Cogl.PipelineFilter.LINEAR, Cogl.PipelineFilter.LINEAR);
        template.set_layer_wrap_mode(1, Cogl.PipelineWrapMode.REPEAT);
        template.set_uniform_1i(template.get_uniform_location('earth_map'), 1);
        if (features.includes('PILLARS')) {
            template.set_layer_texture(3, loadTexture(context, 'pillars.png'));
            template.set_layer_filters(3, Cogl.PipelineFilter.LINEAR, Cogl.PipelineFilter.LINEAR);
            template.set_layer_wrap_mode(3, Cogl.PipelineWrapMode.CLAMP_TO_EDGE);
            template.set_uniform_1i(template.get_uniform_location('pillar_map'), 3);
        }
        return template;
    });
    return {pipeline, locations: new Map(), galaxy: features.includes('GALAXY'), galaxyTexture: null};
}

function createFramebuffer(texture) {
    const framebuffer = Cogl.Offscreen.new_with_texture(texture);
    framebuffer.allocate();
    framebuffer.orthographic(0, 0, texture.get_width(), texture.get_height(), -1, 1);
    return framebuffer;
}

const TEXTURES_DIR = GLib.build_filenamev([GLib.path_get_dirname(GLib.filename_from_uri(import.meta.url)[0]), 'textures']);

function loadTexture(context, name) {
    const pixbuf = GdkPixbuf.Pixbuf.new_from_file(GLib.build_filenamev([TEXTURES_DIR, name]));
    const format = pixbuf.get_has_alpha() ? Cogl.PixelFormat.RGBA_8888_PRE : Cogl.PixelFormat.RGB_888;
    return Cogl.Texture2D.new_from_data(context, pixbuf.get_width(), pixbuf.get_height(), format,
        pixbuf.get_rowstride(), pixbuf.get_pixels());
}

let viewTemplate = null;

export function releaseTemplates() {
    templates.clear();
    viewTemplate = null;
}

function createViewTemplate(context) {
    const pipeline = Cogl.Pipeline.new(context);
    pipeline.add_snippet(Cogl.Snippet.new(Cogl.SnippetHook.FRAGMENT, ROUNDED_CLIP_DECLARATIONS, ROUNDED_CLIP_CODE));
    return pipeline;
}

function drawFullscreen(framebuffer, pipeline) {
    framebuffer.draw_textured_rectangle(pipeline, 0, 0,
        framebuffer.get_width(), framebuffer.get_height(), 0, 0, 1, 1);
}

export const SpaceContent = GObject.registerClass({
    Implements: [Clutter.Content],
}, class SpaceContent extends GObject.Object {
    _init(options) {
        super._init();
        this._frame = new SpaceFrame(options);
        this._monitor = null;
        this._scale = 1;
        this._scenePipelines = new Map();
        this._asciiPipeline = null;
        this._viewPipelines = new WeakMap();
        this._sceneFramebuffer = null;
        this._texture = null;
        this._framebuffer = null;
        this._dirty = true;
    }

    setMonitor(monitor, scale) {
        this._monitor = monitor;
        this._scale = scale;
        this._releaseTexture();
    }

    setLocked(locked) {
        this._frame.setLocked(locked);
        this.advance();
    }

    setOptions(options) {
        if (this._frame.setOptions(options))
            this._releaseTexture();
        this.advance();
    }

    advance() {
        this._dirty = true;
        this.invalidate();
    }

    vfunc_get_preferred_size() {
        if (!this._monitor)
            return [false, 0, 0];
        return [true, this._monitor.width, this._monitor.height];
    }

    vfunc_paint_content(actor, node, paintContext) {
        if (!this._monitor)
            return;

        if (!this._framebuffer)
            this._allocate(paintContext.get_framebuffer().get_context());
        if (this._dirty)
            this._render();

        const pipelineNode = new Clutter.PipelineNode(this._viewPipeline(actor, paintContext));
        pipelineNode.set_name('SpaceContent');
        node.add_child(pipelineNode);
        pipelineNode.add_rectangle(actor.get_content_box());
    }

    _viewPipeline(actor, paintContext) {
        let pipeline = this._viewPipelines.get(actor);
        if (!pipeline) {
            viewTemplate ??= createViewTemplate(paintContext.get_framebuffer().get_context());
            pipeline = viewTemplate.copy();
            this._viewPipelines.set(actor, pipeline);
        }

        const opacity = actor.get_paint_opacity();
        pipeline.set_color(new Cogl.Color({red: opacity, green: opacity, blue: opacity, alpha: opacity}));
        pipeline.set_layer_texture(0, this._texture);
        const [paintWidth] = actor.get_transformed_size();
        const minified = paintWidth * actor.get_resource_scale() < this._texture.get_width();
        pipeline.set_layer_filters(0,
            minified ? Cogl.PipelineFilter.LINEAR_MIPMAP_LINEAR : Cogl.PipelineFilter.LINEAR,
            Cogl.PipelineFilter.LINEAR);

        const {x, y, width, height, index} = this._monitor;
        const scale = this._scale;
        const radius = actor.get_parent()?.content?.rounded_clip_radius ?? 0;
        const bounds = radius > 0
            ? Main.layoutManager.getWorkAreaForMonitor(index)
            : {x, y, width, height};
        const x1 = (bounds.x - x) * scale;
        const y1 = (bounds.y - y) * scale;
        pipeline.set_uniform_float(pipeline.get_uniform_location('bounds'), 4, 1,
            [x1, y1, x1 + bounds.width * scale, y1 + bounds.height * scale]);
        pipeline.set_uniform_1f(pipeline.get_uniform_location('clip_radius'), radius * scale);
        pipeline.set_uniform_float(pipeline.get_uniform_location('texture_size'), 2, 1,
            [width * scale, height * scale]);
        return pipeline;
    }

    _allocate(context) {
        this._context = context;
        if (!this._asciiPipeline) {
            const pipeline = createPipeline(context, 'ascii', () => createTemplate(context, ASCII_SHADER, 'asciiPixel'));
            this._asciiPipeline = {pipeline, locations: new Map()};
        }

        const width = Math.round(this._monitor.width * this._scale);
        const height = Math.round(this._monitor.height * this._scale);
        const {columns, rows} = this._frame.layout(width, height);

        const sceneTexture = Cogl.Texture2D.new_with_size(context,
            columns * SAMPLES_PER_CELL, rows * SAMPLES_PER_CELL);
        this._sceneFramebuffer = createFramebuffer(sceneTexture);
        this._texture = Cogl.Texture2D.new_with_size(context, width, height);
        this._framebuffer = createFramebuffer(this._texture);
        this._galaxyTexture = Cogl.Texture2D.new_with_size(context, columns, rows);

        const {pipeline} = this._asciiPipeline;
        pipeline.set_layer_texture(0, sceneTexture);
        pipeline.set_layer_filters(0, Cogl.PipelineFilter.LINEAR, Cogl.PipelineFilter.LINEAR);
        pipeline.set_layer_wrap_mode(0, Cogl.PipelineWrapMode.CLAMP_TO_EDGE);
        pipeline.set_uniform_1i(pipeline.get_uniform_location('scene'), 0);
        this._dirty = true;
    }

    _releaseTexture() {
        this._sceneFramebuffer = null;
        this._framebuffer = null;
        this._texture = null;
        this._galaxyTexture = null;
        this._dirty = true;
    }

    _render() {
        const now = GLib.get_monotonic_time() / GLib.USEC_PER_SEC;
        const {sceneUniforms, asciiUniforms, particles, camera} = this._frame.step(now, this._pointer());
        const target = this._scenePipelineFor();
        setUniforms(target, sceneUniforms);
        setUniforms(this._asciiPipeline, asciiUniforms);
        this._updateGalaxy(target, particles, camera);

        drawFullscreen(this._sceneFramebuffer, target.pipeline);
        drawFullscreen(this._framebuffer, this._asciiPipeline.pipeline);
        this._dirty = false;
    }

    _pointer() {
        const [pointerX, pointerY] = global.get_pointer();
        const monitor = this._monitor;
        return [
            clamp((pointerX - monitor.x) / monitor.width * 2 - 1, -1, 1),
            clamp((pointerY - monitor.y) / monitor.height * 2 - 1, -1, 1),
        ];
    }

    _scenePipelineFor() {
        const {key, features, slots} = this._frame.shaderVariant();
        let target = this._scenePipelines.get(key);
        if (!target) {
            target = createScenePipeline(this._context, features, slots);
            this._scenePipelines.set(key, target);
        }
        return target;
    }

    _updateGalaxy(target, particles, camera) {
        if (!particles || !target.galaxy)
            return;
        if (!particles.count && this._galaxyBlank === this._galaxyTexture && target.galaxyTexture === this._galaxyTexture)
            return;
        if (target.galaxyTexture !== this._galaxyTexture) {
            target.pipeline.set_layer_texture(2, this._galaxyTexture);
            target.pipeline.set_layer_filters(2, Cogl.PipelineFilter.LINEAR, Cogl.PipelineFilter.LINEAR);
            target.pipeline.set_layer_wrap_mode(2, Cogl.PipelineWrapMode.CLAMP_TO_EDGE);
            target.pipeline.set_uniform_1i(target.pipeline.get_uniform_location('galaxy_map'), 2);
            target.galaxyTexture = this._galaxyTexture;
        }
        const {columns, rows} = this._frame.grid;
        this._galaxyTexture.set_region(0, 0, 0, 0, columns, rows, columns, rows,
            Cogl.PixelFormat.RGBA_8888, columns * 4, this._frame.galaxyPixels(particles, camera));
        this._galaxyBlank = particles.count ? null : this._galaxyTexture;
    }
});
