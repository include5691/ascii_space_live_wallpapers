import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {SHADER} from './shader.js';

const FOV = 0.36;
const FLOW_PERIOD = 18;
const FLOW_SEEDS = 64;
const TIME_PERIOD = 256;
const MAX_FRAME_TIME = 0.25;
const MAX_YAW = Math.PI / 3;
const MAX_PITCH = Math.PI / 7;
const PITCH_LIMIT = Math.PI * 0.45;
const MIN_TEXTURE_SIZE = 16;

const UNIFORMS = [
    'u_resolution', 'u_camera', 'u_fov', 'u_flow',
    'u_time', 'u_exposure', 'u_doppler', 'u_step', 'u_octaves',
];

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

export const BlackHoleContent = GObject.registerClass({
    Implements: [Clutter.Content],
}, class BlackHoleContent extends GObject.Object {
    _init(options) {
        super._init();
        this._options = options;
        this._monitor = null;
        this._scale = 1;
        this._pipeline = null;
        this._uniforms = null;
        this._viewPipelines = new WeakMap();
        this._texture = null;
        this._framebuffer = null;
        this._dirty = true;
        this._lastFrame = 0;
        this._flow = 0;
        this._time = 0;
        this._camera = null;
    }

    setMonitor(monitor, scale) {
        this._monitor = monitor;
        this._scale = scale;
        this._releaseTexture();
    }

    setOptions(options) {
        const resized = options.renderScale !== this._options.renderScale;
        this._options = options;
        if (resized)
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
        pipelineNode.set_name('BlackHoleContent');
        node.add_child(pipelineNode);
        pipelineNode.add_rectangle(actor.get_content_box());
    }

    _viewPipeline(actor, paintContext) {
        let pipeline = this._viewPipelines.get(actor);
        if (!pipeline) {
            pipeline = Cogl.Pipeline.new(paintContext.get_framebuffer().get_context());
            pipeline.add_snippet(Cogl.Snippet.new(Cogl.SnippetHook.FRAGMENT,
                ROUNDED_CLIP_DECLARATIONS, ROUNDED_CLIP_CODE));
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
        this._pipeline ??= this._createPipeline(context);

        const scale = this._scale * this._options.renderScale;
        const width = Math.max(Math.round(this._monitor.width * scale), MIN_TEXTURE_SIZE);
        const height = Math.max(Math.round(this._monitor.height * scale), MIN_TEXTURE_SIZE);
        this._texture = Cogl.Texture2D.new_with_size(context, width, height);
        this._framebuffer = Cogl.Offscreen.new_with_texture(this._texture);
        this._framebuffer.allocate();
        this._framebuffer.orthographic(0, 0, width, height, -1, 1);
        this._pipeline.set_uniform_float(this._uniforms.u_resolution, 2, 1, [width, height]);
        this._dirty = true;
    }

    _createPipeline(context) {
        const pipeline = Cogl.Pipeline.new(context);
        pipeline.set_layer_null_texture(0);
        const snippet = Cogl.Snippet.new(Cogl.SnippetHook.FRAGMENT, SHADER, null);
        snippet.set_replace('cogl_color_out = renderPixel(cogl_tex_coord_in[0].xy);');
        pipeline.add_snippet(snippet);
        this._uniforms = Object.fromEntries(
            UNIFORMS.map(name => [name, pipeline.get_uniform_location(name)]));
        return pipeline;
    }

    _releaseTexture() {
        this._framebuffer = null;
        this._texture = null;
        this._dirty = true;
    }

    _render() {
        const now = GLib.get_monotonic_time() / GLib.USEC_PER_SEC;
        const dt = this._lastFrame ? Math.min(now - this._lastFrame, MAX_FRAME_TIME) : 0;
        this._lastFrame = now;

        const options = this._options;
        this._flow += dt * options.speed / FLOW_PERIOD;
        this._time = (this._time + dt) % TIME_PERIOD;
        this._updateCamera(dt);

        const phaseA = this._flow % 1;
        const phaseB = (this._flow + 0.5) % 1;
        const seedA = Math.floor(this._flow) % FLOW_SEEDS;
        const seedB = Math.floor(this._flow + 0.5) % FLOW_SEEDS;

        const pipeline = this._pipeline;
        const uniforms = this._uniforms;
        pipeline.set_uniform_float(uniforms.u_camera, 3, 1,
            [this._camera.yaw, this._camera.pitch, options.tilt]);
        pipeline.set_uniform_float(uniforms.u_flow, 4, 1, [phaseA, seedA, phaseB, seedB]);
        pipeline.set_uniform_1f(uniforms.u_fov, FOV / options.zoom);
        pipeline.set_uniform_1f(uniforms.u_time, this._time);
        pipeline.set_uniform_1f(uniforms.u_exposure, options.exposure);
        pipeline.set_uniform_1f(uniforms.u_doppler, options.doppler);
        pipeline.set_uniform_1f(uniforms.u_step, options.step);
        pipeline.set_uniform_1f(uniforms.u_octaves, options.octaves);

        this._framebuffer.draw_textured_rectangle(pipeline, 0, 0,
            this._texture.get_width(), this._texture.get_height(), 0, 0, 1, 1);
        this._dirty = false;
    }

    _updateCamera(dt) {
        const options = this._options;
        let [x, y] = [0, 0];
        if (options.followCursor) {
            const [pointerX, pointerY] = global.get_pointer();
            const monitor = this._monitor;
            x = clamp((pointerX - monitor.x) / monitor.width * 2 - 1, -1, 1);
            y = clamp((pointerY - monitor.y) / monitor.height * 2 - 1, -1, 1);
        }

        const yaw = x * options.sensitivity * MAX_YAW;
        const pitch = clamp(options.elevation - y * options.sensitivity * MAX_PITCH,
            -PITCH_LIMIT, PITCH_LIMIT);
        if (!this._camera) {
            this._camera = {yaw, pitch};
            return;
        }

        const response = 1 - Math.exp(-dt / options.smoothing);
        this._camera.yaw += (yaw - this._camera.yaw) * response;
        this._camera.pitch += (pitch - this._camera.pitch) * response;
    }
});
