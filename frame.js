import {KINDS, PLANET_NAMES, Scene} from './events.js';
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
const GALAXY_GAIN = 0.014;
const GALAXY_RANGE = 4;
const BACKGROUND_FEATURES = {'milky-way': ['MILKY_WAY'], 'nebula': ['NEBULA']};
const PLACEHOLDER_BODY = {kind: 'star', position: [0, 0, 0], scale: 1, disk: [0, 0, 0]};
const LETTERS = 'ACEHIJMNPRSTUVY';
const LABEL_SLOTS = 8;
const MIN_LABEL_RADIUS = 0.05;

export const SAMPLES_PER_CELL = 2;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
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

export class SpaceFrame {
    constructor(options) {
        this.options = options;
        this.locked = false;
        this.grid = null;
        this._lastFrame = 0;
        this._flow = 0;
        this._time = 0;
        this._camera = null;
        this._zoom = 0;
        this._scene = new Scene(options.objects, options.events, options.mode);
    }

    setOptions(options) {
        const resized = options.charSize !== this.options.charSize;
        this.options = options;
        if (!this._scene.matches(options.objects, options.events, options.mode))
            this._scene = new Scene(options.objects, options.events, options.mode);
        return resized;
    }

    setLocked(locked) {
        this.locked = locked;
        if (locked)
            this._camera = null;
    }

    layout(width, height) {
        const font = this.options.charSize;
        const cellWidth = CELL_WIDTH * font;
        const cellHeight = CELL_HEIGHT * font;
        const columns = Math.ceil(width / cellWidth);
        const rows = Math.ceil(height / cellHeight);
        this.grid = {
            width, height, font, columns, rows, cellWidth, cellHeight,
            aspect: (columns * cellWidth) / (rows * cellHeight),
            originX: Math.floor((columns * cellWidth - width) / 2),
            originY: Math.floor((rows * cellHeight - height) / 2),
        };
        this._galaxyLight = new Float32Array(columns * rows * 3);
        this._galaxyPixels = new Uint8Array(columns * rows * 4);
        return this.grid;
    }

    shaderVariant() {
        const background = this._scene.backdrop ?? BACKGROUND_FEATURES[this.options.background] ?? [];
        const features = [...this._scene.features, ...background].sort();
        const slots = this._scene.slots;
        return {key: `${slots} ${features.join(' ')}`, features, slots};
    }

    step(now, pointer) {
        const dt = this._lastFrame ? Math.min(now - this._lastFrame, MAX_FRAME_TIME) : 0;
        this._lastFrame = now;

        const options = this.options;
        this._flow += dt * options.speed / FLOW_PERIOD;
        this._time = (this._time + dt) % TIME_PERIOD;
        this._scene.advance(dt * options.orbitSpeed);
        this._scene.shaderTime = this._time;
        this._scene.spin = options.spin;
        this._scene.sky = options.realTime ? skyAt(Date.now()) : null;
        const scene = this._scene.state(this.locked || options.orbitSpeed === 0);
        this._updateCamera(dt, scene.lift, pointer);
        this._zoom = this._zoom
            ? this._zoom + (options.zoom - this._zoom) * (1 - Math.exp(-dt / ZOOM_SMOOTHING))
            : options.zoom;

        const phaseA = this._flow % 1;
        const phaseB = (this._flow + 0.5) % 1;
        const seedA = Math.floor(this._flow) % FLOW_SEEDS;
        const seedB = Math.floor(this._flow + 0.5) % FLOW_SEEDS;

        const {yaw, pitch} = this._camera;
        const fov = FOV * scene.fov / this._zoom;
        const {columns, rows, cellWidth, cellHeight} = this.grid;
        const padded = [0, 1].map(index => scene.bodies[index] ?? scene.bodies[0] ?? PLACEHOLDER_BODY);
        const sceneUniforms = [
            ['u_resolution', 2, [columns * cellWidth, rows * cellHeight]],
            ['u_camera', 3, [yaw, pitch, options.tilt]],
            ['u_flow', 4, [phaseA, seedA, phaseB, seedB]],
            ['u_time', 1, [this._time]],
            ['u_exposure', 1, [options.exposure]],
            ['u_doppler', 1, [options.doppler]],
            ['u_fov', 1, [fov]],
            ['u_distance', 1, [scene.distance]],
            ['u_light_color', 3, scene.lightColor],
            ['u_planets', 4, scene.planets],
            ['u_belt', 4, scene.belt],
            ['u_orbits', 2, scene.orbits],
            ['u_bodies', 4, padded.flatMap(body => [...body.position, body.scale])],
            ['u_disks', 4, padded.flatMap(body => [...body.disk, 0])],
            ['u_kinds', 1, padded.map(body => KINDS[body.kind])],
            ['u_count', 1, [scene.bodies.length]],
            ['u_spins', 1, padded.map(body => (body.kind === 'black-hole' ? options.spin : 0))],
            ...[
                ['u_gw', scene.gw], ['u_burst', scene.burst], ['u_stream', scene.stream],
                ['u_stream_center', scene.streamCenter], ['u_tidal', scene.tidal], ['u_jets', scene.jets],
                ['u_kilonova', scene.kilonova], ['u_star', scene.star], ['u_light', scene.light],
                ['u_live', scene.live], ['u_magnetar', scene.magnetar],
                ['u_big_bang', scene.bigBang], ['u_big_bang_clock', scene.bigBangClock],
                ['u_birth', scene.birth], ['u_birth_glow', scene.birthGlow],
            ].map(([name, value]) => [name, 4, value]),
            ['u_flash', 1, [scene.flash]],
            ['u_fade', 1, [scene.fade]],
            ['u_beams', 1, [scene.beams]],
            ['u_moons', 4, scene.moons],
            ['u_moon_hosts', 1, scene.moonHosts],
            ['u_quasar', 1, [scene.quasar]],
            ['u_moon_tilt', 1, [scene.moonTilt]],
            ['u_moon_keep', 1, [scene.moonKeep]],
        ];

        const camera = {yaw, pitch, roll: options.tilt, distance: scene.distance, fov};
        const {width, height, font, originX, originY} = this.grid;
        const asciiUniforms = [
            ['u_output', 2, [width, height]],
            ['u_cells', 2, [columns, rows]],
            ['u_origin', 2, [originX, originY]],
            ['u_font', 1, [font]],
            ...this._labels(scene, camera),
        ];
        return {sceneUniforms, asciiUniforms, particles: scene.particles, camera};
    }

    galaxyPixels(particles, camera) {
        const light = this._galaxyLight;
        const pixels = this._galaxyPixels;
        light.fill(0);
        splatParticles(particles, {...camera, aspect: this.grid.aspect}, this.grid, light);
        for (let cell = 0, count = light.length / 3; cell < count; cell++) {
            pixels[cell * 4] = 255 * Math.sqrt(Math.min(light[cell * 3] / GALAXY_RANGE, 1));
            pixels[cell * 4 + 1] = 255 * Math.sqrt(Math.min(light[cell * 3 + 1] / GALAXY_RANGE, 1));
            pixels[cell * 4 + 2] = 255 * Math.sqrt(Math.min(light[cell * 3 + 2] / GALAXY_RANGE, 1));
            pixels[cell * 4 + 3] = 255;
        }
        return pixels;
    }

    _labels(scene, camera) {
        const labels = new Array(LABEL_SLOTS * 4).fill(0);
        const text = new Array(LABEL_SLOTS * 8).fill(0);
        if (scene.system && this.options.labels && !this.locked) {
            const {columns, rows, aspect} = this.grid;
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
        return [['u_labels', 4, labels], ['u_label_text', 4, text]];
    }

    _updateCamera(dt, lift, pointer) {
        const options = this.options;
        const [x, y] = options.followCursor && !this.locked && pointer ? pointer : [0, 0];

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
}
