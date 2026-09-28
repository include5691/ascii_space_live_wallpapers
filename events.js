import {GalaxyCollision, SpiralGalaxy} from './galaxy.js';

const SEPARATION = 12;
const PAIR_SCALE = 0.6;
const SINGLE_STAR_SCALE = 0.65;
const SINGLE_PLANET_SCALE = 0.8;
const COMET_PERIOD = 70;
const COMET_DURATION = 40;
const COMET_REACH = 26;
const COMET_CLEARANCE = 5.5;
const DEFAULT_LIGHT = [-0.5, 0.35, 0.8];
const DISK_OUTER = 17;
const BLACK_HOLE_DISK_INNER = 2.1;
const NEUTRON_DISK_INNER = 5.5;
const NEUTRON_RADIUS = 2.5;
const STAR_RADIUS = 5;
const WORMHOLE_THROAT = 2.4;
const ANGULAR_SPEED = 2 * Math.PI / 60;
const MIN_SEPARATION = 2.6;
const INSPIRAL_TIME = 75;
const FEED_TIME = 70;
const PLUNGE_TIME = 10;
const AFTERMATH_TIME = 35;
const FADE_TIME = 2.5;
const STABLE_TIME = 35;
const SWELL_TIME = 22;
const COLLAPSE_TIME = 1.5;
const REMNANT_TIME = 50;
const EXPLOSION_TIME = STABLE_TIME + SWELL_TIME + COLLAPSE_TIME;
const INSPIRAL_CHIRP = INSPIRAL_TIME / (1 - (MIN_SEPARATION / SEPARATION) ** 4);
const MAGNETAR_PERIOD = 40;
const FLARE_TIME = 28;
const COLLISION_TIME = 130;
const FALL_TIME = 4.5;
const IMPACT_TIME = 6;
const QUASAR_DISTANCE = 30;
const MOON_TILT_SCALE = 17.7;
const MAX_MOON_TILT = 1.3;
const FLARE_FADE = 6;
const RING_FADE = [4, 7.5];
const THROW_CLEARANCE = 3;
const THROW_TAIL = 2;
const COMET_RETURN = 1.5;
const GALAXY_VIEWS = {
    spiral: {distance: 30, lift: 0.85},
    collision: {distance: 64, lift: 0.3},
};

export const KINDS = {'black-hole': 0, 'neutron-star': 1, 'star': 2, 'wormhole': 3, 'planet': 4, 'earth': 5};

const MASS = {'black-hole': 1, 'neutron-star': 1, 'star': 0.5, 'wormhole': 1, 'planet': 0.4, 'earth': 0.4};
const PAIR_FOV = 1.15;
const BLACK_HOLE_SHADOW = 2.6;

const SINGLE_SCALE = {'star': SINGLE_STAR_SCALE, 'planet': SINGLE_PLANET_SCALE, 'earth': 0.9};

const SYSTEM_PLANETS = [
    {orbit: 4.3, radius: 0.45, years: 0.24, start: 0.3},
    {orbit: 5.6, radius: 0.7, years: 0.62, start: 2.1},
    {orbit: 7.6, radius: 0.75, years: 1, start: 4.0},
    {orbit: 9.6, radius: 0.55, years: 1.88, start: 5.5},
    {orbit: 14.4, radius: 1.7, years: 11.9, start: 1.2},
    {orbit: 22.0, radius: 1.45, years: 29.5, start: 3.3},
    {orbit: 27.0, radius: 1.0, years: 84, start: 0.8},
    {orbit: 30.0, radius: 0.95, years: 165, start: 2.7},
];
export const PLANET_NAMES = ['MERCURY', 'VENUS', 'EARTH', 'MARS', 'JUPITER', 'SATURN', 'URANUS', 'NEPTUNE'];
const SYSTEM_YEAR = 24;
const SYSTEM_BELT = [10.6, 12.2];
const SYSTEM_DISTANCE = 55;
const SYSTEM_LIFT = 0.4;
const SYSTEM_FOV = 1.35;
const SYSTEM_MOONS = [
    {host: 2, orbit: 1.3, radius: 0.27, period: 6, phase: 0.2},
    {host: 4, orbit: 1.35, radius: 0.13, period: 11, phase: 0.1},
    {host: 4, orbit: 1.6, radius: 0.12, period: 21, phase: 0.55},
    {host: 4, orbit: 1.9, radius: 0.17, period: 39, phase: 0.8},
    {host: 4, orbit: 2.25, radius: 0.15, period: 74, phase: 0.35},
    {host: 5, orbit: 2.5, radius: 0.16, period: 52, phase: 0.65},
];
const SYSTEM_CENTERS = {
    'star': {scale: 0.5, light: [1, 0.97, 0.9]},
    'black-hole': {scale: 0.6, light: [0.8, 0.58, 0.36], disk: 5.5},
    'neutron-star': {scale: 0.6, light: [0.52, 0.62, 0.8]},
    'wormhole': {scale: 0.8, light: [0.35, 0.63, 0.63]},
};

const SCENARIOS = {
    'black-hole+black-hole': 'merger',
    'neutron-star+neutron-star': 'kilonova',
    'black-hole+neutron-star': 'disruption',
    'black-hole+star': 'devour',
    'neutron-star+star': 'devour',
};

const DURATIONS = {
    merger: INSPIRAL_TIME + AFTERMATH_TIME,
    kilonova: INSPIRAL_TIME + AFTERMATH_TIME,
    disruption: INSPIRAL_TIME + AFTERMATH_TIME,
    devour: FEED_TIME + PLUNGE_TIME + AFTERMATH_TIME,
    supernova: EXPLOSION_TIME + REMNANT_TIME,
    collision: COLLISION_TIME,
};

const smooth = (edge0, edge1, x) => {
    const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
    return t * t * (3 - 2 * t);
};

const decay = (x, time) => (x < 0 ? 0 : Math.exp(-x / time));

const random = (seed, n) => {
    const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
};

const normalize = v => {
    const length = Math.hypot(...v);
    return v.map(x => x / length);
};

const moonTilt = latitude => Math.max(-MAX_MOON_TILT, Math.min(MAX_MOON_TILT, latitude * MOON_TILT_SCALE));

const inspiralSeparation = t => SEPARATION * Math.max(1 - t / INSPIRAL_CHIRP, 0) ** 0.25;

export function iscoRatio(spin) {
    const cube = Math.cbrt;
    const isco = a => {
        const z1 = 1 + cube(1 - a * a) * (cube(1 + a) + cube(1 - a));
        const z2 = Math.sqrt(3 * a * a + z1 * z1);
        return 3 + z2 - Math.sqrt((3 - z1) * (3 + z1 + 2 * z2));
    };
    return isco(spin) / isco(0);
}

let blackHoleInner = BLACK_HOLE_DISK_INNER;

function disk(kind, outer, gain) {
    if (kind === 'black-hole')
        return [blackHoleInner, outer, gain];
    if (kind === 'neutron-star' && gain > 0) {
        const fit = smooth(NEUTRON_DISK_INNER, NEUTRON_DISK_INNER * 1.4, outer);
        return fit > 0 ? [NEUTRON_DISK_INNER, Math.max(outer, NEUTRON_DISK_INNER + 0.3), gain * fit] : [0, 0, 0];
    }
    return [0, 0, 0];
}

const mix = (a, b, t) => a + (b - a) * t;

function body(kind, position, scale, gain = kind === 'black-hole' ? 1 : 0, outer = DISK_OUTER) {
    return {kind, position, scale, disk: disk(kind, outer, gain)};
}

function radiusOf(kind, scale) {
    return (kind === 'star' ? STAR_RADIUS : NEUTRON_RADIUS) * scale;
}

function singleScenario(kind, events) {
    if (kind === 'quasar')
        return 'quasar';
    if (!events)
        return 'single';
    return {'star': 'supernova', 'neutron-star': 'magnetar'}[kind] ?? 'single';
}

export class Scene {
    constructor(objects, events, mode = 'single') {
        this._objects = objects;
        this._events = events;
        this._mode = mode;
        this._planetAngles = SYSTEM_PLANETS.map(planet => planet.start);
        this._moonTime = 0;
        this._throw = null;
        this._cometReturn = -Infinity;
        this._sky = null;
        if (mode === 'system')
            this._scenario = 'system';
        else if (mode === 'galaxy')
            this._scenario = objects[0] === 'collision' ? 'collision' : 'spiral';
        else if (objects.length === 1)
            this._scenario = singleScenario(objects[0], events);
        else
            this._scenario = events ? SCENARIOS[[...objects].sort().join('+')] ?? 'orbit' : 'orbit';
        if (this._scenario === 'spiral')
            this._galaxy = new SpiralGalaxy();
        else if (this._scenario === 'collision')
            this._galaxy = new GalaxyCollision();
        this._time = 0;
        this._angle = 0;
        this._looped = false;
        this._cycle = 0;
        this._clock = 0;
    }

    set sky(value) {
        this._sky = value;
    }

    throwFrom(start) {
        if (this._throw || this._mode === 'galaxy')
            return;
        this._throw = {start, age: 0};
    }

    set spin(value) {
        this._spin = value;
    }

    set comets(value) {
        this._comets = value;
    }

    matches(objects, events, mode = 'single') {
        return objects.join('+') === this._objects.join('+') && events === this._events && mode === this._mode;
    }

    advance(dt, realDt = dt) {
        const duration = DURATIONS[this._scenario];
        this._time += dt;
        this._clock += realDt;
        let step = dt;
        if (duration && this._time >= duration) {
            this._time %= duration;
            this._looped = true;
            this._cycle++;
            step = this._time;
            if (this._scenario === 'collision')
                this._galaxy.reset();
        }
        if (this._scenario === 'collision')
            this._galaxy.advance(step);
        else if (this._scenario === 'spiral')
            this._galaxy.update(this._time);
        if (this._throw) {
            this._throw.age += realDt;
            if (this._throw.age > FALL_TIME + IMPACT_TIME) {
                this._throw = null;
                this._cometReturn = this._clock;
            }
        }
        this._moonTime += dt;
        this._planetAngles = this._planetAngles.map((angle, index) =>
            (angle - dt * 2 * Math.PI / (SYSTEM_YEAR * Math.sqrt(SYSTEM_PLANETS[index].years))) % (2 * Math.PI));
        const speed = ANGULAR_SPEED * (SEPARATION / this._separation()) ** 1.5;
        this._angle = (this._angle - dt * speed) % (2 * Math.PI);
    }

    state(still = false) {
        blackHoleInner = Math.max(BLACK_HOLE_DISK_INNER * iscoRatio(this._spin ?? 0), 1.3);
        const state = {
            bodies: [],
            gw: [0, 0, 0, 0],
            burst: [0, 1, 0, 0],
            stream: [0, 0, 1, 0],
            streamCenter: [0, 0, 0, 0],
            tidal: [1, 1, 0, -1],
            jets: [0, 0, 0, 0],
            kilonova: [0, 0, 0, 0],
            flash: 0,
            fade: 1,
            beams: 1,
            fov: this._objects.length === 2 ? PAIR_FOV : 1,
            star: [1, 0, 0, 0],
            light: [...DEFAULT_LIGHT, 0],
            comet: [0, 0, 0, 0],
            cometIon: [1, 0, 0, 1],
            cometDust: [1, 0, 0, 1],
            meteors: this._comets ? 1 : 0,
            lightColor: [1, 1, 1],
            planets: new Array(32).fill(0),
            system: 0,
            belt: [0, 0, 0, 0],
            distance: 22,
            lift: 0,
            centerRadius: 0,
            centerMass: 0,
            moons: new Array(24).fill(0),
            moonHosts: new Array(6).fill(-1),
            live: this._sky ? [1, this._sky.subsolarLongitude, this._sky.moonPhase, this._sky.declination] : [0, 0, 0, 0],
            moonTilt: this._sky ? moonTilt(this._sky.moonLatitude) : 0,
            magnetar: [0, 0, 0, 0],
            quasar: 0,
            particles: null,
        };
        switch (this._scenario) {
        case 'single':
            this._single(state);
            break;
        case 'system':
            this._solarSystem(state);
            break;
        case 'devour':
            this._devour(state);
            break;
        case 'magnetar':
            this._magnetar(state);
            break;
        case 'quasar':
            this._quasar(state);
            break;
        case 'spiral':
        case 'collision':
            this._galaxyView(state);
            break;
        case 'supernova':
            if (this._cycle % 2 === 0)
                this._planetaryNebula(state);
            else
                this._supernova(state);
            break;
        case 'orbit':
            state.bodies = this._pair(SEPARATION, this._objects.map(kind => (kind === 'black-hole' ? 1 : 0)));
            break;
        default:
            this._inspiral(state);
        }

        const star = state.bodies.find(candidate => candidate.kind === 'star');
        if (star && this._scenario !== 'supernova' && this._scenario !== 'system')
            state.light = [...star.position, 1];
        this._comet(state);

        const duration = DURATIONS[this._scenario];
        if (still) {
            state.flash = 0;
        } else if (duration) {
            const fadeIn = this._looped ? smooth(0, FADE_TIME, this._time) : 1;
            state.fade = fadeIn * (1 - smooth(duration - FADE_TIME, duration, this._time));
        }
        this._thrown(state);
        return state;
    }

    _separation() {
        const t = this._time;
        switch (this._scenario) {
        case 'merger':
        case 'kilonova':
        case 'disruption':
            return t < INSPIRAL_TIME ? inspiralSeparation(t) : MIN_SEPARATION;
        case 'devour':
            return SEPARATION - 3 * smooth(0, FEED_TIME, t) - 5.5 * smooth(FEED_TIME, FEED_TIME + PLUNGE_TIME, t);
        default:
            return SEPARATION;
        }
    }

    _victimAngle(victim) {
        return this._angle + (victim === 1 ? Math.PI : 0);
    }

    _pair(separation, gains, sizes = [1, 1]) {
        const [first, second] = this._objects;
        const total = MASS[first] + MASS[second];
        const direction = [Math.cos(this._angle), 0, Math.sin(this._angle)];
        const outer = Math.min(DISK_OUTER, 0.42 * separation / PAIR_SCALE);
        return [
            body(first, direction.map(v => v * separation * MASS[second] / total), PAIR_SCALE * sizes[0], gains[0], outer),
            body(second, direction.map(v => -v * separation * MASS[first] / total), PAIR_SCALE * sizes[1], gains[1], outer),
        ];
    }

    _galaxyView(state) {
        const view = GALAXY_VIEWS[this._scenario];
        state.particles = this._galaxy;
        state.distance = view.distance;
        state.lift = view.lift;
        state.meteors = 0;
    }

    _quasar(state) {
        state.bodies = [body('black-hole', [0, 0, 0], 1, 2.2)];
        state.jets = [0, 0, 0, 2.5];
        state.quasar = 1;
        state.distance = QUASAR_DISTANCE;
    }

    _magnetar(state) {
        const phase = this._time % MAGNETAR_PERIOD;
        const since = phase - FLARE_TIME;
        const quake = 0.25 * decay(since, 1.2);
        const t = this._time;
        state.bodies = [body('neutron-star', [quake * Math.sin(47 * t), 0.5 * quake * Math.sin(61 * t), quake * Math.cos(53 * t)], 1)];
        const tail = 1 - smooth(MAGNETAR_PERIOD - FLARE_FADE, MAGNETAR_PERIOD, phase);
        state.magnetar = [0.25 + (0.5 * smooth(8, FLARE_TIME, phase) + 2 * decay(since, 7)) * tail, decay(since, 2.5) * tail, 0, 0];
        state.beams = 1 + 3 * decay(since, 5) * tail;
        state.flash = 2.5 * decay(since, 0.5);
        if (since >= 0)
            state.burst = [1 + 14 * since, 1 + 0.8 * since, 0.8 * decay(since, 3) * (1 - smooth(...RING_FADE, since)), 0];
    }

    _single(state) {
        const [kind] = this._objects;
        state.bodies = [body(kind, [0, 0, 0], SINGLE_SCALE[kind] ?? 1)];
    }

    _solarSystem(state) {
        const [kind] = this._objects;
        const center = SYSTEM_CENTERS[kind];
        state.bodies = [body(kind, [0, 0, 0], center.scale, kind === 'black-hole' ? 1 : 0, center.disk ?? DISK_OUTER)];
        state.light = [0, 0, 0, 1];
        state.lightColor = center.light;
        state.planets = SYSTEM_PLANETS.flatMap((planet, index) => {
            const angle = this._planetAngles[index];
            return [Math.cos(angle) * planet.orbit, 0, Math.sin(angle) * planet.orbit, planet.radius];
        });
        if (this._sky) {
            state.planets = SYSTEM_PLANETS.flatMap((planet, index) => {
                const angle = -this._sky.planetLongitudes[index];
                return [Math.cos(angle) * planet.orbit, 0, Math.sin(angle) * planet.orbit, planet.radius];
            });
        }
        SYSTEM_MOONS.forEach((moon, index) => {
            const host = state.planets.slice(moon.host * 4, moon.host * 4 + 4);
            const reach = moon.orbit * host[3];
            const live = this._sky && moon.host === 2;
            const angle = live
                ? Math.atan2(-host[2], -host[0]) - 2 * Math.PI * this._sky.moonPhase
                : -2 * Math.PI * (this._moonTime / moon.period + moon.phase);
            const lift = live ? Math.sin(moonTilt(this._sky.moonLatitude)) : 0.03 * Math.sin(angle);
            const level = Math.sqrt(1 - lift * lift);
            state.moons.splice(index * 4, 4, host[0] + Math.cos(angle) * reach * level, lift * reach,
                host[2] + Math.sin(angle) * reach * level, moon.radius * host[3]);
            state.moonHosts[index] = moon.host;
        });
        state.system = 1;
        state.belt = [...SYSTEM_BELT, 1, 0];
        state.centerRadius = {'star': STAR_RADIUS, 'black-hole': BLACK_HOLE_SHADOW,
            'neutron-star': NEUTRON_RADIUS, 'wormhole': WORMHOLE_THROAT}[kind] * center.scale;
        state.centerMass = kind === 'star' ? 0 : center.scale;
        state.distance = SYSTEM_DISTANCE;
        state.lift = SYSTEM_LIFT;
        state.fov = SYSTEM_FOV;
    }

    _comet(state) {
        if (!this._comets || this._mode === 'galaxy' || this._throw)
            return;
        const cycle = Math.floor(this._clock / COMET_PERIOD);
        const progress = (this._clock - cycle * COMET_PERIOD) / COMET_DURATION;
        if (progress > 1)
            return;

        const side = random(cycle, 1) < 0.5 ? -1 : 1;
        const lift = (random(cycle, 2) < 0.5 ? -1 : 1) * (COMET_CLEARANCE + 3 * random(cycle, 3));
        const depth = -2 - 8 * random(cycle, 4);
        const start = [side * COMET_REACH, lift, depth];
        const end = [-side * COMET_REACH, lift * (0.7 + 0.3 * random(cycle, 5)), depth + (random(cycle, 6) - 0.5) * 6];
        const position = start.map((v, i) => mix(v, end[i], progress));
        const heading = normalize(end.map((v, i) => v - start[i]));
        const ion = state.light[3] > 0.5
            ? normalize(position.map((v, i) => v - state.light[i]))
            : normalize(state.light.slice(0, 3).map(v => -v));
        const dust = normalize(ion.map((v, i) => 0.7 * v - 0.5 * heading[i]));
        state.comet = [...position, smooth(0, 0.1, progress) * (1 - smooth(0.9, 1, progress))
            * smooth(0, COMET_RETURN, this._clock - this._cometReturn)];
        state.cometIon = [...ion, 12];
        state.cometDust = [...dust, 8];
    }

    _thrown(state) {
        if (!this._throw)
            return;
        const {age} = this._throw;
        const [first] = state.bodies;
        const target = first?.position ?? [0, 0, 0];
        const clearance = THROW_CLEARANCE * (first ? radiusOf(first.kind, first.scale) : 1);
        const away = this._throw.start.map((v, i) => v - target[i]);
        const reach = Math.hypot(...away);
        const direction = reach > 1e-6 ? away.map(v => v / reach) : [0, 1, 0];
        const start = target.map((v, i) => v + direction[i] * Math.max(reach, clearance));
        if (age < FALL_TIME) {
            const fall = (age / FALL_TIME) ** 2;
            const position = start.map((v, i) => mix(v, target[i], fall));
            const heading = direction.map(v => -v);
            const ion = state.light[3] > 0.5
                ? normalize(position.map((v, i) => v - state.light[i] + 1e-3))
                : normalize(state.light.slice(0, 3).map(v => -v));
            state.comet = [...position, smooth(0, 0.3, age)];
            state.cometIon = [...ion, 8];
            state.cometDust = [...normalize(ion.map((v, i) => 0.6 * v - 0.6 * heading[i] + 1e-3)), 5];
            return;
        }
        if (!first || first.kind === 'wormhole')
            return;
        const since = age - FALL_TIME;
        const tail = 1 - smooth(IMPACT_TIME - THROW_TAIL, IMPACT_TIME, since);
        if (Math.hypot(...target) < 1) {
            state.flash = Math.max(state.flash, 1.2 * decay(since, 0.6));
            if (state.burst[2] === 0)
                state.burst = [radiusOf(first.kind, first.scale) + 10 * since, 1 + 0.6 * since, 0.4 * decay(since, 2) * tail, 0];
        }
        if (first.kind === 'black-hole')
            first.disk[2] *= 1 + 1.5 * decay(since, 2.5) * tail;
        else if (first.kind === 'neutron-star')
            state.beams += 2 * decay(since, 3) * tail;
    }

    _planetaryNebula(state) {
        const t = this._time;
        const shed = STABLE_TIME + SWELL_TIME;
        if (t < shed) {
            this._supernova(state);
            return;
        }

        const since = t - shed;
        const shrink = smooth(0, 10, since);
        state.bodies = [body('star', [0, 0, 0], SINGLE_STAR_SCALE * mix(1.7, 0.1, shrink))];
        state.star = [2 * shrink, 0, 0, 0];
        state.kilonova = [1.2 + 5 * (1 - decay(since, 14)), smooth(0, 6, since) * (0.5 + 0.5 * decay(since, 60)), smooth(0, 30, since), 2];
    }

    _supernova(state) {
        const t = this._time;
        const swell = smooth(STABLE_TIME, STABLE_TIME + SWELL_TIME, t);
        if (t < EXPLOSION_TIME - COLLAPSE_TIME) {
            const settle = 1 - smooth(STABLE_TIME + SWELL_TIME - 3, STABLE_TIME + SWELL_TIME, t);
            const pulse = 1 + 0.04 * swell * settle * Math.sin(2 * Math.PI * (t - STABLE_TIME) / 2.5);
            state.bodies = [body('star', [0, 0, 0], SINGLE_STAR_SCALE * (1 + 0.7 * swell) * pulse)];
            state.star = [1 - swell, 0, 0, 0];
            return;
        }

        if (t < EXPLOSION_TIME) {
            const collapse = smooth(EXPLOSION_TIME - COLLAPSE_TIME, EXPLOSION_TIME, t);
            state.bodies = [body('star', [0, 0, 0], SINGLE_STAR_SCALE * mix(1.7, 0.12, collapse))];
            state.star = [collapse * 1.5, 0, 0, 0];
            return;
        }

        const since = t - EXPLOSION_TIME;
        state.bodies = [body('neutron-star', [0, 0, 0], 0.7)];
        state.beams = 1 + 2 * decay(since, 20);
        state.flash = 3 * decay(since, 1.2);
        state.kilonova = [1 + 6 * (1 - decay(since, 9)), smooth(0, 0.5, since) * (0.2 + 0.8 * decay(since, 20)), smooth(0, 20, since), 1];
    }

    _feed(state, bodies, victim, eater, strength, tightness, width) {
        const center = bodies[eater].position;
        const target = bodies[victim].position;
        const dx = target[0] - center[0];
        const dz = target[2] - center[2];
        const distance = Math.hypot(dx, dz);
        const eaterBody = bodies[eater];
        const eaterScale = eaterBody.scale;
        const inner = eaterBody.kind === 'black-hole'
            ? eaterBody.disk[0] * eaterScale
            : mix(NEUTRON_RADIUS * 1.2, NEUTRON_DISK_INNER, Math.min(eaterBody.disk[2], 1)) * eaterScale;
        const clearance = eaterBody.kind === 'black-hole'
            ? Math.max(eaterBody.disk[0], BLACK_HOLE_SHADOW) * eaterScale
            : Math.max(inner, NEUTRON_RADIUS * 1.2 * eaterScale);
        const radius = radiusOf(bodies[victim].kind, bodies[victim].scale);
        const reach = distance - clearance;
        const stretch = radius > 0 && radius * state.tidal[0] > reach ? Math.max(1, reach / radius) : state.tidal[0];
        const start = Math.max(distance - radius * stretch, inner * 1.5);
        state.stream = [strength, tightness, width, start];
        state.streamCenter = [center[0], center[2], inner, Math.atan2(dz, dx)];
        state.tidal = [stretch, -dx / distance, -dz / distance, victim];
    }

    _inspiral(state) {
        const t = this._time;
        const scenario = this._scenario;
        const victim = this._objects.indexOf('neutron-star');
        const eater = 1 - victim;

        if (t < INSPIRAL_TIME) {
            const separation = inspiralSeparation(t);
            const ratio = SEPARATION / separation;
            const sizes = [1, 1];
            if (scenario === 'disruption') {
                state.tidal[0] = 1 + 3 * smooth(INSPIRAL_TIME - 6, INSPIRAL_TIME, t);
                sizes[victim] = 1 - smooth(INSPIRAL_TIME - 3, INSPIRAL_TIME, t);
            }
            state.bodies = this._pair(separation, this._objects.map(kind => (kind === 'black-hole' ? 1 : 0)), sizes);
            state.gw = [Math.min(0.6 * ratio ** 1.5, 2), this._angle, 0.8 * ratio ** 0.75, separation];
            if (scenario === 'disruption') {
                const strength = 1.5 * smooth(INSPIRAL_TIME - 6, INSPIRAL_TIME - 4, t);
                this._feed(state, state.bodies, victim, eater, strength, 0.3, 1.5);
            }
            return;
        }

        const since = t - INSPIRAL_TIME;
        const chirp = 0.8 * (SEPARATION / MIN_SEPARATION) ** 0.75;
        state.gw = [2 * decay(since, 2.5), this._angle, chirp, MIN_SEPARATION];
        state.burst = [1 + 12 * since, 1 + since, decay(since, 6), 0];
        state.flash = 2 * decay(since, 0.8);

        if (scenario === 'disruption') {
            const [last] = this._pair(MIN_SEPARATION, [1, 1]).filter((_, index) => index === eater);
            const position = last.position.map(v => v * decay(since, 6));
            const outer = mix(last.disk[1], DISK_OUTER, smooth(0, 12, since));
            const gain = 1 + 2 * smooth(0, 1.5, since) * decay(since, 8);
            state.bodies = [body('black-hole', position, mix(PAIR_SCALE, 0.75, smooth(0, 5, since)), gain, outer)];
            state.jets = [...position, 3 * smooth(0, 0.5, since) * decay(since, 4)];
            state.stream = [1.5 * decay(since, 3), 0.3, 1.5, MIN_SEPARATION];
            state.streamCenter = [position[0], position[2], blackHoleInner * PAIR_SCALE, this._victimAngle(victim)];
            return;
        }

        const remnant = scenario === 'merger' ? 0.95 : 0.8;
        const gain = scenario === 'merger' ? smooth(3, 25, since) : 0.6 * smooth(8, 30, since);
        state.bodies = [body('black-hole', [0, 0, 0], remnant, gain)];
        if (scenario === 'kilonova') {
            state.kilonova = [1 + 3 * (1 - decay(since, 8)), smooth(0, 1, since) * decay(since, 18), smooth(2, 25, since), 0];
            state.jets = [0, 0, 0, 4 * decay(since, 2)];
        }
    }

    _devour(state) {
        const t = this._time;
        const end = FEED_TIME + PLUNGE_TIME;
        const victim = this._objects.indexOf('star');
        const eater = 1 - victim;
        const eaterKind = this._objects[eater];
        const separation = this._separation();

        if (t < end) {
            const sizes = [1, 1];
            sizes[victim] = 1 - 0.15 * smooth(0, FEED_TIME, t) - 0.85 * smooth(FEED_TIME + 4, end, t);
            const gains = [1, 1];
            gains[eater] = eaterKind === 'black-hole'
                ? 0.6 + 0.6 * smooth(5, FEED_TIME, t) + smooth(FEED_TIME, end, t)
                : smooth(5, 25, t) + smooth(FEED_TIME, end, t);
            state.bodies = this._pair(separation, gains, sizes);
            state.tidal[0] = 1 + 0.35 * smooth(0, FEED_TIME, t) + 3 * smooth(FEED_TIME + 2, end, t);
            const strength = smooth(2, 10, t) + 2 * smooth(FEED_TIME, end - 2, t);
            this._feed(state, state.bodies, victim, eater, strength,
                0.35 - 0.17 * smooth(FEED_TIME, end, t), 1 + 1.5 * smooth(FEED_TIME, end, t));
            return;
        }

        const since = t - end;
        const [last] = this._pair(separation, [1, 1]).filter((_, index) => index === eater);
        const position = last.position.map(v => v * decay(since, 6));
        const before = eaterKind === 'black-hole' ? 2.2 : 2;
        const gain = mix(before, 1.2, smooth(0, 20, since)) + 1.5 * smooth(0, 1, since) * decay(since, 8);
        const outer = mix(Math.min(DISK_OUTER, 0.42 * separation / PAIR_SCALE), DISK_OUTER, smooth(0, 12, since));
        const inner = (eaterKind === 'black-hole' ? blackHoleInner : NEUTRON_DISK_INNER) * PAIR_SCALE;
        state.bodies = [body(eaterKind, position, PAIR_SCALE, gain, outer)];
        state.stream = [3 * decay(since, 3), 0.18, 2.5, Math.max(separation, inner * 1.5)];
        state.streamCenter = [position[0], position[2], inner, this._victimAngle(victim)];
        state.flash = 1.8 * decay(since, 0.8);
        if (eaterKind === 'black-hole')
            state.jets = [...position, 2.5 * smooth(0, 1.5, since) * (0.4 + 0.6 * decay(since, 20))];
        else
            state.beams = 1 + 2.5 * smooth(0, 2, since) * decay(since, 15);
    }
}
