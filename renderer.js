import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GdkPixbuf from 'gi://GdkPixbuf';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {KINDS, PLANET_NAMES, Scene} from './events.js';
import {ASCII_SHADER, sceneShader} from './shader.js';
import {skyAt} from './sky.js';

const FOV = 0.36;
const FLOW_PERIOD = 18;
const FLOW_SEEDS = 64;
const TIME_PERIOD = 256;
const MAX_FRAME_TIME = 0.25;
const MAX_YAW = Math.PI / 3;
const MAX_PITCH = Math.PI / 7;
const PITCH_LIMIT = Math.PI * 0.45;
const ZOOM_SMOOTHING = 0.12;
const CELL_WIDTH = 6;
const CELL_HEIGHT = 9;
const SAMPLES_PER_CELL = 2;
const GALAXY_GAIN = 0.014;
const GALAXY_RANGE = 4;
const BACKGROUND_FEATURES = {'milky-way': ['MILKY_WAY'], 'nebula': ['NEBULA']};
const PLACEHOLDER_BODY = {kind: 'star', position: [0, 0, 0], scale: 1, disk: [0, 0, 0]};

const SCENE_UNIFORMS = [
    'u_resolution', 'u_camera', 'u_fov', 'u_flow', 'u_time', 'u_exposure', 'u_doppler',
    'u_bodies', 'u_disks', 'u_kinds', 'u_count', 'u_gw', 'u_burst', 'u_stream', 'u_stream_center',
    'u_tidal', 'u_jets', 'u_kilonova', 'u_flash', 'u_fade', 'u_beams', 'u_background', 'u_star',
    'u_spins', 'u_light',
    'earth_map', 'u_light_color', 'u_planets', 'u_belt', 'u_orbits', 'u_distance',
    'u_live', 'u_moon_tilt', 'u_moon_keep', 'u_big_bang', 'u_big_bang_clock', 'u_birth', 'u_birth_glow', 'u_moons', 'u_moon_hosts', 'u_magnetar', 'u_quasar', 'galaxy_map',
];
const ASCII_UNIFORMS = ['scene', 'u_output', 'u_cells', 'u_origin', 'u_font', 'u_labels', 'u_label_text'];
const LETTERS = 'ACEHIJMNPRSTUVY';
const LABEL_SLOTS = 8;
const MIN_LABEL_RADIUS = 0.05;

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

function uniformsOf(pipeline, names) {
    return Object.fromEntries(names.map(name => [name, pipeline.get_uniform_location(name)]));
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
    return {pipeline, uniforms: uniformsOf(pipeline, SCENE_UNIFORMS), galaxy: features.includes('GALAXY'), galaxyTexture: null};
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

const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const scaled = (a, s) => a.map(v => v * s);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => scaled(a, 1 / Math.hypot(...a));

function cameraBasis({yaw, pitch, roll, distance}) {
    const origin = [distance * Math.cos(pitch) * Math.sin(yaw), distance * Math.sin(pitch),
        distance * Math.cos(pitch) * Math.cos(yaw)];
    const forward = unit(scaled(origin, -1));
    const right = unit(cross(forward, [0, 1, 0]));
    const up = cross(right, forward);
    const rolledRight = sub(scaled(right, Math.cos(roll)), scaled(up, -Math.sin(roll)));
    const rolledUp = sub(scaled(up, Math.cos(roll)), scaled(right, Math.sin(roll)));
    return {origin, forward, rolledRight, rolledUp};
}

function projector({fov, aspect, ...camera}) {
    const {origin, forward, rolledRight, rolledUp} = cameraBasis(camera);
    return point => {
        const relative = sub(point, origin);
        const depth = dot(relative, forward);
        if (depth <= 0)
            return null;
        return {
            x: dot(relative, rolledRight) / (depth * fov) / (2 * aspect) + 0.5,
            y: 0.5 - dot(relative, rolledUp) / (depth * fov) / 2,
            size: 1 / (depth * fov),
            depth,
        };
    };
}

function lensed(spot, center, mass, fov, aspect) {
    const offset = [(spot.x - center.x) * 2 * aspect * fov, (center.y - spot.y) * 2 * fov];
    const source = Math.hypot(...offset);
    const einstein = 2 * mass * (spot.depth - center.depth) / (spot.depth * center.depth);
    const image = (source + Math.sqrt(source * source + 4 * einstein)) / 2;
    const [dx, dy] = source > 0 ? offset.map(v => v / source * image / fov) : [0, image / fov];
    return {...spot, x: center.x + dx / (2 * aspect), y: center.y - dy / 2};
}

function splatParticles({count, positions, colors, occluder}, camera, {columns, rows, aspect}, light) {
    const {origin, forward, rolledRight, rolledUp} = cameraBasis(camera);
    const {fov} = camera;
    const toScreen = point => {
        const relative = sub(point, origin);
        const depth = dot(relative, forward);
        return {depth, x: dot(relative, rolledRight) / (depth * fov), y: dot(relative, rolledUp) / (depth * fov)};
    };
    const shadow = occluder ? toScreen(occluder.center) : null;
    const shadowRadius = shadow ? occluder.radius / (shadow.depth * fov) : 0;
    for (let index = 0; index < count; index++) {
        const o = index * 3;
        const rx = positions[o] - origin[0];
        const ry = positions[o + 1] - origin[1];
        const rz = positions[o + 2] - origin[2];
        const depth = rx * forward[0] + ry * forward[1] + rz * forward[2];
        if (depth <= 0)
            continue;
        const scale = 1 / (depth * fov);
        const sx = (rx * rolledRight[0] + ry * rolledRight[1] + rz * rolledRight[2]) * scale;
        const sy = (rx * rolledUp[0] + ry * rolledUp[1] + rz * rolledUp[2]) * scale;
        if (shadow && depth > shadow.depth && (sx - shadow.x) ** 2 + (sy - shadow.y) ** 2 < shadowRadius ** 2)
            continue;
        const x = (sx / (2 * aspect) + 0.5) * columns - 0.5;
        const y = (0.5 - sy / 2) * rows - 0.5;
        if (x < -1 || y < -1 || x >= columns || y >= rows)
            continue;
        const cells = rows / (2 * fov * Math.max(depth, camera.distance / 2));
        const weight = GALAXY_GAIN * cells * cells;
        const column = Math.floor(x);
        const row = Math.floor(y);
        const fx = x - column;
        const fy = y - row;
        addLight(light, columns, rows, column, row, colors, o, weight * (1 - fx) * (1 - fy));
        addLight(light, columns, rows, column + 1, row, colors, o, weight * fx * (1 - fy));
        addLight(light, columns, rows, column, row + 1, colors, o, weight * (1 - fx) * fy);
        addLight(light, columns, rows, column + 1, row + 1, colors, o, weight * fx * fy);
    }
}

function addLight(light, columns, rows, column, row, colors, o, share) {
    if (column < 0 || row < 0 || column >= columns || row >= rows)
        return;
    const cell = (row * columns + column) * 3;
    light[cell] += colors[o] * share;
    light[cell + 1] += colors[o + 1] * share;
    light[cell + 2] += colors[o + 2] * share;
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
        this._options = options;
        this._monitor = null;
        this._scale = 1;
        this._locked = false;
        this._scenePipelines = new Map();
        this._asciiPipeline = null;
        this._viewPipelines = new WeakMap();
        this._sceneFramebuffer = null;
        this._texture = null;
        this._framebuffer = null;
        this._dirty = true;
        this._lastFrame = 0;
        this._flow = 0;
        this._time = 0;
        this._camera = null;
        this._zoom = 0;
        this._scene = new Scene(options.objects, options.events, options.mode);
        this._view = null;
    }

    setMonitor(monitor, scale) {
        this._monitor = monitor;
        this._scale = scale;
        this._releaseTexture();
    }

    setLocked(locked) {
        this._locked = locked;
        if (locked)
            this._camera = null;
        this.advance();
    }

    setOptions(options) {
        const resized = options.charSize !== this._options.charSize;
        this._options = options;
        if (!this._scene.matches(options.objects, options.events, options.mode))
            this._scene = new Scene(options.objects, options.events, options.mode);
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
            this._asciiPipeline = {pipeline, uniforms: uniformsOf(pipeline, ASCII_UNIFORMS)};
        }

        const width = Math.round(this._monitor.width * this._scale);
        const height = Math.round(this._monitor.height * this._scale);
        const font = this._options.charSize;
        const cellWidth = CELL_WIDTH * font;
        const cellHeight = CELL_HEIGHT * font;
        const columns = Math.ceil(width / cellWidth);
        const rows = Math.ceil(height / cellHeight);

        const sceneTexture = Cogl.Texture2D.new_with_size(context,
            columns * SAMPLES_PER_CELL, rows * SAMPLES_PER_CELL);
        this._sceneFramebuffer = createFramebuffer(sceneTexture);
        this._texture = Cogl.Texture2D.new_with_size(context, width, height);
        this._framebuffer = createFramebuffer(this._texture);
        this._galaxyTexture = Cogl.Texture2D.new_with_size(context, columns, rows);
        this._galaxyLight = new Float32Array(columns * rows * 3);
        this._galaxyPixels = new Uint8Array(columns * rows * 4);

        this._grid = {
            columns, rows, cellWidth, cellHeight, aspect: (columns * cellWidth) / (rows * cellHeight),
            originX: Math.floor((columns * cellWidth - width) / 2), originY: Math.floor((rows * cellHeight - height) / 2),
        };

        const ascii = this._asciiPipeline;
        ascii.pipeline.set_layer_texture(0, sceneTexture);
        ascii.pipeline.set_layer_filters(0, Cogl.PipelineFilter.LINEAR, Cogl.PipelineFilter.LINEAR);
        ascii.pipeline.set_layer_wrap_mode(0, Cogl.PipelineWrapMode.CLAMP_TO_EDGE);
        ascii.pipeline.set_uniform_1i(ascii.uniforms.scene, 0);
        ascii.pipeline.set_uniform_float(ascii.uniforms.u_output, 2, 1, [width, height]);
        ascii.pipeline.set_uniform_float(ascii.uniforms.u_cells, 2, 1, [columns, rows]);
        ascii.pipeline.set_uniform_float(ascii.uniforms.u_origin, 2, 1, [this._grid.originX, this._grid.originY]);
        ascii.pipeline.set_uniform_1f(ascii.uniforms.u_font, font);
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
        const dt = this._lastFrame ? Math.min(now - this._lastFrame, MAX_FRAME_TIME) : 0;
        this._lastFrame = now;

        const options = this._options;
        this._flow += dt * options.speed / FLOW_PERIOD;
        this._time = (this._time + dt) % TIME_PERIOD;
        this._scene.advance(dt * options.orbitSpeed);
        this._scene.shaderTime = this._time;
        this._scene.spin = options.spin;
        this._scene.sky = options.realTime ? skyAt(Date.now()) : null;
        const scene = this._scene.state(this._locked || options.orbitSpeed === 0);
        this._updateCamera(dt, scene.lift);
        this._zoom = this._zoom
            ? this._zoom + (options.zoom - this._zoom) * (1 - Math.exp(-dt / ZOOM_SMOOTHING))
            : options.zoom;

        const phaseA = this._flow % 1;
        const phaseB = (this._flow + 0.5) % 1;
        const seedA = Math.floor(this._flow) % FLOW_SEEDS;
        const seedB = Math.floor(this._flow + 0.5) % FLOW_SEEDS;

        const {pitch} = this._camera;
        const fov = FOV * scene.fov / this._zoom;

        const target = this._scenePipelineFor(options);
        const {pipeline, uniforms} = target;
        const {columns, rows, cellWidth, cellHeight} = this._grid;
        pipeline.set_uniform_float(uniforms.u_resolution, 2, 1, [columns * cellWidth, rows * cellHeight]);
        pipeline.set_uniform_float(uniforms.u_camera, 3, 1, [this._camera.yaw, pitch, options.tilt]);
        pipeline.set_uniform_float(uniforms.u_flow, 4, 1, [phaseA, seedA, phaseB, seedB]);
        pipeline.set_uniform_1f(uniforms.u_time, this._time);
        pipeline.set_uniform_1f(uniforms.u_exposure, options.exposure);
        pipeline.set_uniform_1f(uniforms.u_doppler, options.doppler);

        pipeline.set_uniform_1f(uniforms.u_fov, fov);
        pipeline.set_uniform_1f(uniforms.u_distance, scene.distance);
        pipeline.set_uniform_float(uniforms.u_light_color, 3, 1, scene.lightColor);
        pipeline.set_uniform_float(uniforms.u_planets, 4, 8, scene.planets);
        pipeline.set_uniform_float(uniforms.u_belt, 4, 1, scene.belt);
        pipeline.set_uniform_float(uniforms.u_orbits, 2, 8, scene.orbits);
        const padded = [0, 1].map(index => scene.bodies[index] ?? scene.bodies[0] ?? PLACEHOLDER_BODY);
        pipeline.set_uniform_float(uniforms.u_bodies, 4, 2, padded.flatMap(body => [...body.position, body.scale]));
        pipeline.set_uniform_float(uniforms.u_disks, 4, 2, padded.flatMap(body => [...body.disk, 0]));
        pipeline.set_uniform_float(uniforms.u_kinds, 1, 2, padded.map(body => KINDS[body.kind]));
        pipeline.set_uniform_1f(uniforms.u_count, scene.bodies.length);
        pipeline.set_uniform_float(uniforms.u_spins, 1, 2, padded.map(body => (body.kind === 'black-hole' ? options.spin : 0)));
        for (const [name, value] of [
            ['u_gw', scene.gw], ['u_burst', scene.burst], ['u_stream', scene.stream],
            ['u_stream_center', scene.streamCenter], ['u_tidal', scene.tidal], ['u_jets', scene.jets],
            ['u_kilonova', scene.kilonova], ['u_star', scene.star], ['u_light', scene.light],
            ['u_live', scene.live], ['u_magnetar', scene.magnetar],
            ['u_big_bang', scene.bigBang], ['u_big_bang_clock', scene.bigBangClock],
            ['u_birth', scene.birth], ['u_birth_glow', scene.birthGlow],
        ])
            pipeline.set_uniform_float(uniforms[name], 4, 1, value);
        pipeline.set_uniform_1f(uniforms.u_flash, scene.flash);
        pipeline.set_uniform_1f(uniforms.u_fade, scene.fade);
        pipeline.set_uniform_1f(uniforms.u_beams, scene.beams);
        pipeline.set_uniform_float(uniforms.u_moons, 4, 6, scene.moons);
        pipeline.set_uniform_float(uniforms.u_moon_hosts, 1, 6, scene.moonHosts);
        pipeline.set_uniform_1f(uniforms.u_quasar, scene.quasar);
        pipeline.set_uniform_1f(uniforms.u_moon_tilt, scene.moonTilt);
        pipeline.set_uniform_1f(uniforms.u_moon_keep, scene.moonKeep);

        const camera = {yaw: this._camera.yaw, pitch, roll: options.tilt, distance: scene.distance, fov};
        this._view = {...camera, aspect: this._grid.aspect};
        this._updateLabels(scene, camera);
        this._updateGalaxy(target, scene.particles, this._view);

        drawFullscreen(this._sceneFramebuffer, pipeline);
        drawFullscreen(this._framebuffer, this._asciiPipeline.pipeline);
        this._dirty = false;
    }

    _scenePipelineFor(options) {
        const background = this._scene.backdrop ?? BACKGROUND_FEATURES[options.background] ?? [];
        const features = [...this._scene.features, ...background];
        const key = `${this._scene.slots} ${features.sort().join(' ')}`;
        let target = this._scenePipelines.get(key);
        if (!target) {
            target = createScenePipeline(this._context, features, this._scene.slots);
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
            target.pipeline.set_uniform_1i(target.uniforms.galaxy_map, 2);
            target.galaxyTexture = this._galaxyTexture;
        }
        const light = this._galaxyLight;
        const pixels = this._galaxyPixels;
        light.fill(0);
        splatParticles(particles, camera, this._grid, light);
        for (let cell = 0, count = light.length / 3; cell < count; cell++) {
            pixels[cell * 4] = 255 * Math.sqrt(Math.min(light[cell * 3] / GALAXY_RANGE, 1));
            pixels[cell * 4 + 1] = 255 * Math.sqrt(Math.min(light[cell * 3 + 1] / GALAXY_RANGE, 1));
            pixels[cell * 4 + 2] = 255 * Math.sqrt(Math.min(light[cell * 3 + 2] / GALAXY_RANGE, 1));
            pixels[cell * 4 + 3] = 255;
        }
        const {columns, rows} = this._grid;
        this._galaxyTexture.set_region(0, 0, 0, 0, columns, rows, columns, rows,
            Cogl.PixelFormat.RGBA_8888, columns * 4, pixels);
        this._galaxyBlank = particles.count ? null : this._galaxyTexture;
    }

    _updateLabels(scene, camera) {
        const labels = new Array(LABEL_SLOTS * 4).fill(0);
        const text = new Array(LABEL_SLOTS * 8).fill(0);
        if (scene.system && this._options.labels && !this._locked) {
            const {columns, rows, aspect} = this._grid;
            const project = projector({...camera, aspect});
            const center = project([0, 0, 0]);
            const placed = [];
            const spots = PLANET_NAMES.map((name, index) => {
                const planet = scene.planets.slice(index * 4, index * 4 + 4);
                const spot = project(planet.slice(0, 3));
                const lensing = spot && center && scene.centerMass && spot.depth > center.depth;
                return {name, index, radius: planet[3],
                    spot: lensing ? lensed(spot, center, scene.centerMass, camera.fov, aspect) : spot};
            }).filter(({spot, radius}) => spot && radius > MIN_LABEL_RADIUS).sort((a, b) => a.spot.depth - b.spot.depth);

            for (const {name, index, radius, spot} of spots) {
                if (center && !scene.centerMass && spot.depth > center.depth) {
                    const gap = Math.hypot((spot.x - center.x) * 2 * aspect, (spot.y - center.y) * 2);
                    if (gap < scene.centerRadius * center.size - radius * spot.size)
                        continue;
                }
                const reachColumns = radius * spot.size * columns / (2 * aspect);
                let column = Math.floor(spot.x * columns + reachColumns) + 1;
                if (column + name.length > columns - 1)
                    column = Math.floor(spot.x * columns - reachColumns) - 1 - name.length;
                if (column + name.length > columns - 1)
                    continue;
                const baseRow = Math.floor(spot.y * rows - Math.max(radius * spot.size * rows / 2, 1));
                const row = [baseRow, baseRow - 1, baseRow + 1].find(candidate =>
                    candidate >= 1 && candidate < rows - 1 && !placed.some(other =>
                        other.row === candidate && column < other.end + 1 && column + name.length > other.start - 1));
                if (row === undefined || column < 1)
                    continue;
                placed.push({row, start: column, end: column + name.length});
                labels.splice(index * 4, 4, column, row, name.length, 0.9 * scene.fade * scene.system);
                [...name].forEach((letter, slot) => {
                    text[index * 8 + slot] = LETTERS.indexOf(letter) + 1;
                });
            }
        }
        const {pipeline, uniforms} = this._asciiPipeline;
        pipeline.set_uniform_float(uniforms.u_labels, 4, LABEL_SLOTS, labels);
        pipeline.set_uniform_float(uniforms.u_label_text, 4, LABEL_SLOTS * 2, text);
    }

    _updateCamera(dt, lift) {
        const options = this._options;
        let [x, y] = [0, 0];
        if (options.followCursor && !this._locked) {
            const [pointerX, pointerY] = global.get_pointer();
            const monitor = this._monitor;
            x = clamp((pointerX - monitor.x) / monitor.width * 2 - 1, -1, 1);
            y = clamp((pointerY - monitor.y) / monitor.height * 2 - 1, -1, 1);
        }

        const yaw = x * options.sensitivity * MAX_YAW;
        const pitch = clamp(options.elevation + lift - y * options.sensitivity * MAX_PITCH,
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
