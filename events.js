import {BIRTH, ENVELOPE_RADIUS, SHOCK_SPEED, SolarBirth, growthOf, moonAngle, sunAt} from './birth.js';
import {BIG_BANG, BigBang} from './cosmos.js';
import {DebrisField} from './debris.js';
import {GalaxyCollision, Pillars, SpiralGalaxy, StarCluster, crossed, normalized} from './galaxy.js';

const SEPARATION = 12;
const PAIR_SCALE = 0.6;
const SINGLE_STAR_SCALE = 0.65;
const SINGLE_PLANET_SCALE = 0.8;
const DEFAULT_LIGHT = [-0.5, 0.35, 0.8];
const DISK_OUTER = 17;
const BLACK_HOLE_DISK_INNER = 2.1;
const NEUTRON_DISK_INNER = 5.5;
const NEUTRON_RADIUS = 2.5;
const STAR_RADIUS = 5;
const EARTH_RADIUS = 3;
const PLANET_RADIUS = 3.2;
const PLANET_AXIS = [-0.14, 0.92, 0.37];
const PLANET_RING = [1.35, 2.3];
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
const QUASAR_DISTANCE = 30;
const MOON_TILT_SCALE = 17.7;
const MAX_MOON_TILT = 1.3;
const FLARE_FADE = 6;
const RING_FADE = [4, 7.5];
const GALAXY_VIEWS = {
    spiral: {distance: 30, lift: 0.85},
    collision: {distance: 64, lift: 0.3},
    cluster: {distance: 40, lift: 0.2},
    pillars: {distance: 48, lift: -0.12},
};
const DYSON_DISTANCE = 30;
const CRAB_DISTANCE = 36;
const CRAB_SCALE = 0.7;
const CRAB_BEAMS = 1.5;
const CRAB_LIFT = 0.5;
const GALAXY_SCENARIOS = {collision: GalaxyCollision, cluster: StarCluster, pillars: Pillars, bigbang: BigBang, birth: SolarBirth};
const BIG_BANG_VIEW = {far: 70, near: 30, low: 0.3, high: 0.85};
const BANG_FLASH = 3;
const BIRTH_VIEW = {far: 120, near: 55, low: 0.15, high: 0.4};
const SUPERNOVA_FLASH = 3;
const JET_LENGTH = [10, 45];
const KIND_FEATURES = {
    'black-hole': ['BLACK_HOLE', 'DISK'], 'neutron-star': ['NEUTRON'], 'star': ['STAR'],
    'wormhole': ['WORMHOLE'], 'planet': ['PLANET'], 'earth': ['EARTH'],
};
const SCENARIO_FEATURES = {
    quasar: ['BLACK_HOLE', 'DISK', 'EVENTS', 'QUASAR'],
    dyson: ['STAR', 'DYSON'],
    crab: ['NEUTRON', 'CRAB'],
    magnetar: ['NEUTRON', 'MAGNETAR', 'SHEET'],
    supernova: ['STAR', 'NEUTRON', 'EVENTS'],
    merger: ['BLACK_HOLE', 'DISK', 'SHEET'],
    kilonova: ['BLACK_HOLE', 'DISK', 'SHEET', 'EVENTS'],
    disruption: ['BLACK_HOLE', 'DISK', 'SHEET', 'EVENTS'],
    devour: ['DISK', 'EVENTS', 'GALAXY'],
    'system': ['SYSTEM'],
    'system-devour': ['SYSTEM', 'GALAXY'],
    'system-escape': ['SYSTEM'],
    'system-wind': ['SYSTEM', 'WIND'],
    spiral: ['GALAXY'],
    collision: ['GALAXY'],
    cluster: ['GALAXY'],
    pillars: ['GALAXY', 'PILLARS'],
    bigbang: ['GALAXY', 'BIGBANG'],
    birth: ['GALAXY', 'STAR', 'SYSTEM', 'BIRTH'],
};
export const PAIR_STAND_INS = {'quasar': 'black-hole', 'dyson': 'star', 'crab': 'neutron-star'};

export function selectedScene(settings) {
    const mode = settings.get_string('mode');
    const first = settings.get_string('first-object');
    const galaxy = settings.get_string('galaxy');
    if (mode === 'galaxy' && galaxy === 'system')
        return {mode: 'system', objects: [settings.get_string('center')]};
    return {
        mode,
        objects: {
            pair: [PAIR_STAND_INS[first] ?? first, settings.get_string('second-object')],
            galaxy: [galaxy],
        }[mode] ?? [first],
    };
}

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
const SYSTEM_FATES = {'black-hole': 'system-devour', 'wormhole': 'system-escape', 'neutron-star': 'system-wind'};
const DEVOUR_START = 4;
const DEVOUR_GAP = 12;
const DEVOUR_FALL = 7;
const BREAK_TIME = 0.6;
const DISRUPT_TIME = 76;
const PAIR_GRAVITY = (2 * Math.PI / 60) ** 2 * 12 ** 3;
const PAIR_DEBRIS = 3000;
const PLANET_DEBRIS = 700;
const PLANET_STRETCH = 1.8;
const MOON_DEBRIS = 200;
const PLANET_MOON_DEBRIS = 80;
const MOON_COLORS = [[0.62, 0.6, 0.58], [0.45, 0.44, 0.42]];
const MOON_GLOW = 0.25;
const EARTH_MOON_REACH = {pair: 2.2, single: 3.4};
const EARTH_MOON_TURNS = 3;
const SHADER_PERIOD = 256;
const DEBRIS_FEED_GAIN = 0.01;
const MAX_DEBRIS_FEED = 2.5;
const VICTIM_DEBRIS = {
    'star': {palette: [[1, 0.85, 0.6], [1, 0.7, 0.4], [1, 0.95, 0.8]], glow: 0.4},
    'earth': {palette: [[0.25, 0.4, 0.9], [0.45, 0.42, 0.28], [0.3, 0.5, 0.25], [0.9, 0.92, 0.95]], glow: 0.2},
    'planet': {palette: [[0.96, 0.88, 0.7], [0.78, 0.58, 0.38], [0.85, 0.35, 0.22]], glow: 0.3},
};
const RING_DEBRIS = 1500;
const RING_COLORS = [[0.88, 0.8, 0.66], [0.75, 0.68, 0.55], [0.95, 0.93, 0.88]];
const RING_GLOW = 0.35;
const RING_SPIN = 0.3;
const PLANET_MOONS = [{orbit: 1.9, radius: 0.16}, {orbit: 2.4, radius: 0.21}, {orbit: 2.9, radius: 0.26}];
const PLANET_DEBRIS_COLORS = [
    [[0.55, 0.52, 0.5]], [[0.95, 0.85, 0.6]], [[0.25, 0.4, 0.9], [0.45, 0.42, 0.28], [0.9, 0.92, 0.95]], [[0.8, 0.35, 0.15]],
    [[0.93, 0.85, 0.72], [0.7, 0.5, 0.35]], [[0.95, 0.88, 0.68]], [[0.55, 0.85, 0.9]], [[0.25, 0.4, 0.95]],
];
const DEVOUR_AFTERMATH = 15;
const TIDAL_REACH = 3.8;
const MAX_SPIN_UP = 40;
const ESCAPE_TIME = 60;
const ESCAPE_GRAVITY = 0.25;
const ESCAPE_STEP = 0.05;
const SYSTEM_DEVOUR_TIME = DEVOUR_START + DEVOUR_GAP * 7 + DEVOUR_FALL + 7 + BREAK_TIME + DEVOUR_AFTERMATH;
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
    'black-hole+earth': 'devour',
    'black-hole+planet': 'devour',
    'neutron-star+star': 'devour',
};

const DURATIONS = {
    merger: INSPIRAL_TIME + AFTERMATH_TIME,
    kilonova: INSPIRAL_TIME + AFTERMATH_TIME,
    disruption: INSPIRAL_TIME + AFTERMATH_TIME,
    devour: FEED_TIME + PLUNGE_TIME + AFTERMATH_TIME,
    supernova: EXPLOSION_TIME + REMNANT_TIME,
    collision: COLLISION_TIME,
    bigbang: BIG_BANG.end,
    birth: BIRTH.end,
    'system-devour': SYSTEM_DEVOUR_TIME,
    'system-escape': ESCAPE_TIME,
};

const smooth = (edge0, edge1, x) => {
    const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
    return t * t * (3 - 2 * t);
};

const decay = (x, time) => (x < 0 ? 0 : Math.exp(-x / time));

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

const RADII = {'star': STAR_RADIUS, 'earth': EARTH_RADIUS, 'planet': PLANET_RADIUS};

function radiusOf(kind, scale) {
    return (RADII[kind] ?? NEUTRON_RADIUS) * scale;
}

function devourStage(index, orbit, t) {
    const start = DEVOUR_START + DEVOUR_GAP * index;
    const tear = start + DEVOUR_FALL + index;
    const fall = Math.min(Math.max((t - start) / (tear - start), 0), 1) ** 2;
    return {
        start,
        tear,
        reach: t < tear ? mix(orbit, TIDAL_REACH, fall)
            : Math.max(TIDAL_REACH - 2 * (orbit - TIDAL_REACH) / (tear - start) * (t - tear), 0),
        size: 1 - smooth(tear, tear + BREAK_TIME, t),
    };
}

function singleScenario(kind, events) {
    if (kind === 'quasar' || kind === 'dyson' || kind === 'crab')
        return kind;
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
        this._sky = null;
        this._shaderTime = 0;
        if (mode === 'system')
            this._scenario = events ? SYSTEM_FATES[objects[0]] ?? 'system' : 'system';
        else if (mode === 'galaxy')
            this._scenario = GALAXY_SCENARIOS[objects[0]] ? objects[0] : 'spiral';
        else if (objects.length === 1)
            this._scenario = singleScenario(objects[0], events);
        else
            this._scenario = events ? SCENARIOS[[...objects].sort().join('+')] ?? 'orbit' : 'orbit';
        if (this._scenario === 'birth')
            this._galaxy = new SolarBirth({planets: SYSTEM_PLANETS, year: SYSTEM_YEAR, moon: SYSTEM_MOONS[0], belt: SYSTEM_BELT});
        else if (this._mode === 'galaxy')
            this._galaxy = new (GALAXY_SCENARIOS[this._scenario] ?? SpiralGalaxy)();
        this._time = 0;
        this._angle = 0;
        this._looped = false;
        this._cycle = 0;
    }

    get features() {
        const kinds = this._objects.flatMap(kind => KIND_FEATURES[kind] ?? []);
        return [...new Set([...SCENARIO_FEATURES[this._scenario] ?? [], ...kinds])];
    }

    get slots() {
        return this._objects.length;
    }

    set shaderTime(value) {
        this._shaderTime = value;
    }

    set sky(value) {
        this._sky = value;
    }


    set spin(value) {
        this._spin = value;
    }

    matches(objects, events, mode = 'single') {
        return objects.join('+') === this._objects.join('+') && events === this._events && mode === this._mode;
    }

    advance(dt) {
        const duration = DURATIONS[this._scenario];
        this._time += dt;
        let step = dt;
        const wrapped = duration && this._time >= duration;
        if (wrapped) {
            this._time %= duration;
            this._looped = true;
            this._cycle++;
            step = this._time;
            if (this._scenario === 'collision')
                this._galaxy.reset();
        }
        if (this._scenario === 'collision')
            this._galaxy.advance(step);
        else if (this._galaxy)
            this._galaxy.update(this._time);
        this._moonTime += dt;
        if (wrapped) {
            this._planetAngles = SYSTEM_PLANETS.map(planet => planet.start);
            this._escape = null;
            this._debris = null;
            this._torn = new Set();
            this._eaterAtTear = null;
        }
        this._debris?.advance(step);
        if (this._scenario === 'system-escape' && this._escape)
            this._advanceEscape(step);
        this._planetAngles = this._planetAngles.map((angle, index) => {
            const {orbit, years} = SYSTEM_PLANETS[index];
            const reach = this._scenario === 'system-devour' ? devourStage(index, orbit, this._time).reach : orbit;
            const spinUp = Math.min((orbit / reach) ** 1.5, MAX_SPIN_UP);
            return (angle - dt * spinUp * 2 * Math.PI / (SYSTEM_YEAR * Math.sqrt(years))) % (2 * Math.PI);
        });
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
            moonKeep: 1,
            jets: [0, 0, 0, 0],
            kilonova: [0, 0, 0, 0],
            flash: 0,
            fade: 1,
            beams: 1,
            fov: this._objects.length === 2 ? PAIR_FOV : 1,
            star: [1, 0, 0, 0],
            light: [...DEFAULT_LIGHT, 0],
            lightColor: [1, 1, 1],
            planets: new Array(32).fill(0),
            system: 0,
            belt: [0, 0, 0, 0],
            distance: 22,
            lift: 0,
            centerRadius: 0,
            centerMass: 0,
            orbits: new Array(16).fill(0),
            moons: new Array(24).fill(0),
            moonHosts: new Array(6).fill(-1),
            live: this._sky ? [1, this._sky.subsolarLongitude, this._sky.moonPhase, this._sky.declination] : [0, 0, 0, 0],
            moonTilt: this._sky ? moonTilt(this._sky.moonLatitude) : 0,
            magnetar: [0, 0, 0, 0],
            quasar: 0,
            particles: null,
            bigBang: [0, 0, 0, 0],
            bigBangClock: [0, 0, 0, 0],
            birth: [0, 0, 0, 0],
            birthGlow: [0, 0, 0, 0],
        };
        switch (this._scenario) {
        case 'single':
            this._single(state);
            break;
        case 'system':
        case 'system-devour':
        case 'system-escape':
        case 'system-wind':
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
        case 'dyson':
            this._dyson(state);
            break;
        case 'crab':
            this._crab(state);
            break;
        case 'spiral':
        case 'collision':
        case 'cluster':
        case 'pillars':
        case 'bigbang':
        case 'birth':
            this._galaxyView(state, still);
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
        if (star && this._scenario !== 'supernova' && this._mode !== 'system')
            state.light = [...star.position, 1];

        const duration = DURATIONS[this._scenario];
        if (still) {
            state.flash = 0;
            state.bigBangClock[2] = 0;
            state.birthGlow[0] = 0;
        } else if (duration) {
            const fadeIn = this._looped ? smooth(0, FADE_TIME, this._time) : 1;
            state.fade = fadeIn * (1 - smooth(duration - FADE_TIME, duration, this._time));
        }
        return state;
    }

    _separation(t = this._time) {
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

    _galaxyView(state, still) {
        state.particles = this._galaxy;
        const timeline = {bigbang: BIG_BANG, birth: BIRTH}[this._scenario];
        if (timeline) {
            const t = still ? timeline.end - FADE_TIME : this._time;
            if (still)
                this._galaxy.update(t);
            if (this._scenario === 'birth')
                this._birth(state, t);
            else
                this._bigBang(state, t);
            return;
        }
        const view = GALAXY_VIEWS[this._scenario];
        state.distance = view.distance;
        state.lift = view.lift;
    }

    _bigBang(state, t) {
        const [plasmaIn, plasmaFull, plasmaOut, plasmaGone] = BIG_BANG.plasma;
        const [lightIn, lightFull, lightOut, lightGone] = BIG_BANG.light;
        state.bigBang = [
            smooth(...BIG_BANG.glow, t) * (1 - smooth(BIG_BANG.bang, BIG_BANG.bang + 0.5, t)),
            smooth(plasmaIn, plasmaFull, t) * (1 - smooth(plasmaOut, plasmaGone, t)),
            smooth(lightIn, lightFull, t) * (1 - smooth(lightOut, lightGone, t)),
            smooth(...BIG_BANG.today, t),
        ];
        state.bigBangClock = [t, 1 - smooth(...BIG_BANG.cooling, t), BANG_FLASH * decay(t - BIG_BANG.bang, 0.8), 0];
        const settle = smooth(...BIG_BANG.galaxy, t);
        state.distance = mix(BIG_BANG_VIEW.far, BIG_BANG_VIEW.near, settle);
        state.lift = mix(BIG_BANG_VIEW.low, BIG_BANG_VIEW.high, settle);
    }

    _birth(state, t) {
        const sun = sunAt(t);
        const birth = this._galaxy;
        const today = smooth(...BIRTH.today, t);
        const [jetsIn, jetsFull, jetsOut, jetsGone] = BIRTH.jets;
        const [shockIn, shockFull, shockOut, shockGone] = BIRTH.shock;
        const [envelopeIn, envelopeGone] = BIRTH.envelope;
        const envelope = 1 - smooth(envelopeIn, envelopeGone, t);
        if (sun.scale > 0)
            state.bodies = [body('star', [0, 0, 0], sun.scale)];
        state.star = [sun.heat, 1 - sun.ignite, 0, 0];
        state.light = [0, 0, 0, 1];
        state.lightColor = [mix(0.9, 1, sun.ignite), mix(0.5, 0.97, sun.ignite), mix(0.3, 0.9, sun.ignite)];
        state.planets = SYSTEM_PLANETS.flatMap((planet, index) => {
            const angle = birth.planetAngle(index, t);
            return [Math.cos(angle) * planet.orbit, 0, Math.sin(angle) * planet.orbit, planet.radius * growthOf(index, t) ** (1 / 3)];
        });
        state.orbits = SYSTEM_PLANETS.flatMap(planet => [planet.orbit, today]);
        state.belt = [...SYSTEM_BELT, today, 0];
        SYSTEM_MOONS.forEach((moon, index) => {
            const host = state.planets.slice(moon.host * 4, moon.host * 4 + 4);
            const angle = moonAngle(moon, t);
            const reach = moon.orbit * SYSTEM_PLANETS[moon.host].radius;
            const size = index === 0 ? smooth(...BIRTH.moon, t) ** (1 / 3) : host[3] / SYSTEM_PLANETS[moon.host].radius;
            state.moons.splice(index * 4, 4, host[0] + Math.cos(angle) * reach, 0.03 * Math.sin(angle) * reach,
                host[2] + Math.sin(angle) * reach, size * moon.radius * SYSTEM_PLANETS[moon.host].radius);
            state.moonHosts[index] = moon.host;
        });
        state.system = today;
        state.centerRadius = STAR_RADIUS * sun.scale;
        state.birth = [
            envelope,
            mix(...ENVELOPE_RADIUS, smooth(BIRTH.collapse[0], envelopeGone, t)),
            SHOCK_SPEED * Math.max(t - BIRTH.supernova, 0),
            smooth(shockIn, shockFull, t) * (1 - smooth(shockOut, shockGone, t)),
        ];
        state.birthGlow = [
            SUPERNOVA_FLASH * decay(t - BIRTH.supernova, 1.5),
            smooth(jetsIn, jetsFull, t) * (1 - smooth(jetsOut, jetsGone, t)) * (0.35 + 0.65 * envelope),
            mix(...JET_LENGTH, smooth(jetsIn, jetsOut, t)),
            t,
        ];
        const settle = smooth(BIRTH.collapse[0], BIRTH.solids[1], t);
        state.distance = mix(BIRTH_VIEW.far, BIRTH_VIEW.near, settle);
        state.lift = mix(BIRTH_VIEW.low, BIRTH_VIEW.high, settle);
        state.fov = SYSTEM_FOV;
    }

    _dyson(state) {
        state.bodies = [body('star', [0, 0, 0], SINGLE_STAR_SCALE)];
        state.distance = DYSON_DISTANCE;
    }

    _crab(state) {
        state.bodies = [body('neutron-star', [0, 0, 0], CRAB_SCALE)];
        state.beams = CRAB_BEAMS;
        state.distance = CRAB_DISTANCE;
        state.lift = CRAB_LIFT;
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
        state.orbits = SYSTEM_PLANETS.flatMap(planet => [planet.orbit, 1]);
        state.system = 1;
        state.belt = [...SYSTEM_BELT, 1, 0];
        if (this._scenario === 'system-devour')
            this._devourPlanets(state);
        else if (this._scenario === 'system-escape')
            this._escapePlanets(state);
        SYSTEM_MOONS.forEach((moon, index) => {
            const host = state.planets.slice(moon.host * 4, moon.host * 4 + 4);
            const hostRadius = SYSTEM_PLANETS[moon.host].radius;
            const torn = this._torn?.has(moon.host);
            const reach = moon.orbit * (torn ? hostRadius : host[3]);
            const live = this._sky && moon.host === 2;
            const angle = live
                ? Math.atan2(-host[2], -host[0]) - 2 * Math.PI * this._sky.moonPhase
                : -2 * Math.PI * (this._moonTime / moon.period + moon.phase);
            const lift = live ? Math.sin(moonTilt(this._sky.moonLatitude)) : 0.03 * Math.sin(angle);
            const level = Math.sqrt(1 - lift * lift);
            state.moons.splice(index * 4, 4, host[0] + Math.cos(angle) * reach * level, lift * reach,
                host[2] + Math.sin(angle) * reach * level, torn ? 0 : moon.radius * host[3]);
            state.moonHosts[index] = moon.host;
            const fresh = this._freshlyTorn?.get(moon.host);
            if (fresh) {
                this._debris.burst({
                    ...fresh,
                    offset: state.moons.slice(index * 4, index * 4 + 3),
                    radius: moon.radius * hostRadius,
                    axis: fresh.axis,
                    stretch: 1,
                    palette: MOON_COLORS,
                    glow: MOON_GLOW,
                    count: PLANET_MOON_DEBRIS,
                });
            }
        });
        this._freshlyTorn?.clear();
        state.centerRadius = {'star': STAR_RADIUS, 'black-hole': BLACK_HOLE_SHADOW,
            'neutron-star': NEUTRON_RADIUS, 'wormhole': WORMHOLE_THROAT}[kind] * center.scale;
        state.centerMass = kind === 'star' ? 0 : center.scale;
        state.distance = SYSTEM_DISTANCE;
        state.lift = SYSTEM_LIFT;
        state.fov = SYSTEM_FOV;
    }

    _debrisField(eater) {
        this._debris ??= new DebrisField();
        this._torn ??= new Set();
        this._debris.capture = eater.kind === 'black-hole' ? eater.disk[0] * eater.scale : NEUTRON_RADIUS * 1.2 * eater.scale;
        this._debris.occluder = {
            center: eater.position,
            radius: (eater.kind === 'black-hole' ? BLACK_HOLE_SHADOW : NEUTRON_RADIUS) * eater.scale,
        };
        return this._debris;
    }

    _showDebris(state, debris, eater) {
        debris.place(eater.position);
        state.particles = debris;
        const boost = Math.min(DEBRIS_FEED_GAIN * debris.feeding, MAX_DEBRIS_FEED);
        eater.disk[2] *= 1 + boost;
        if (eater.kind === 'neutron-star')
            state.beams += boost;
    }

    _devourPlanets(state) {
        const t = this._time;
        const [hole] = state.bodies;
        const debris = this._debrisField(hole);
        SYSTEM_PLANETS.forEach((planet, index) => {
            const stage = devourStage(index, planet.orbit, t);
            const angle = this._planetAngles[index] + (this._sky ? -this._sky.planetLongitudes[index] - planet.start : 0);
            const direction = [Math.cos(angle), 0, Math.sin(angle)];
            state.planets.splice(index * 4, 4, direction[0] * stage.reach, 0, direction[2] * stage.reach,
                planet.radius * stage.size);
            state.orbits[index * 2 + 1] = 1 - smooth(stage.start, stage.start + 2, t);
            if (t >= stage.tear && !this._torn.has(index)) {
                this._torn.add(index);
                const spin = Math.min((planet.orbit / stage.reach) ** 1.5, MAX_SPIN_UP) *
                    2 * Math.PI / (SYSTEM_YEAR * Math.sqrt(planet.years));
                const inward = 2 * (planet.orbit - TIDAL_REACH) / (stage.tear - stage.start);
                const speed = stage.reach * spin;
                const motion = {
                    velocity: [direction[2] * speed - direction[0] * inward, 0, -direction[0] * speed - direction[2] * inward],
                    axis: direction,
                    gravity: speed * speed * stage.reach,
                };
                debris.burst({
                    ...motion,
                    offset: direction.map(v => v * stage.reach),
                    radius: planet.radius,
                    stretch: PLANET_STRETCH,
                    palette: PLANET_DEBRIS_COLORS[index],
                    glow: 0.3,
                    count: PLANET_DEBRIS,
                });
                this._freshlyTorn ??= new Map();
                this._freshlyTorn.set(index, motion);
            }
            state.flash = Math.max(state.flash, 0.4 * decay(t - stage.tear, 0.6));
        });
        this._showDebris(state, debris, hole);
    }

    _advanceEscape(dt) {
        for (let left = dt; left > 1e-6; left -= ESCAPE_STEP) {
            const step = Math.min(left, ESCAPE_STEP);
            for (const planet of this._escape) {
                const [x, z] = planet.position;
                const pull = planet.gravity / Math.hypot(x, z) ** 3;
                planet.velocity[0] -= x * pull * step;
                planet.velocity[1] -= z * pull * step;
                planet.position[0] += planet.velocity[0] * step;
                planet.position[1] += planet.velocity[1] * step;
            }
        }
    }

    _escapePlanets(state) {
        this._escape ??= SYSTEM_PLANETS.map((planet, index) => {
            const angle = Math.atan2(state.planets[index * 4 + 2], state.planets[index * 4]);
            const speed = 2 * Math.PI / (SYSTEM_YEAR * Math.sqrt(planet.years));
            return {
                position: [Math.cos(angle) * planet.orbit, Math.sin(angle) * planet.orbit],
                velocity: [Math.sin(angle) * planet.orbit * speed, -Math.cos(angle) * planet.orbit * speed],
                gravity: ESCAPE_GRAVITY * speed * speed * planet.orbit ** 3,
            };
        });
        const fade = 1 - smooth(0, 6, this._time);
        this._escape.forEach((planet, index) => {
            state.planets[index * 4] = planet.position[0];
            state.planets[index * 4 + 2] = planet.position[1];
            state.orbits[index * 2 + 1] = fade;
        });
        state.belt[2] = 1 - smooth(0, 20, this._time);
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
        const victim = this._objects.findIndex(kind => kind in VICTIM_DEBRIS);
        const eater = 1 - victim;
        const eaterKind = this._objects[eater];
        const victimKind = this._objects[victim];
        const separation = this._separation();
        const broken = t - DISRUPT_TIME;

        if (t < end) {
            const sizes = [1, 1];
            sizes[victim] = 1 - 0.15 * smooth(0, FEED_TIME, t);
            const gains = [1, 1];
            gains[eater] = eaterKind === 'black-hole'
                ? 0.6 + 0.6 * smooth(5, FEED_TIME, t) + smooth(FEED_TIME, end, t)
                : smooth(5, 25, t) + smooth(FEED_TIME, end, t);
            state.bodies = this._pair(separation, gains, sizes);
            state.tidal[0] = 1 + 0.35 * smooth(0, FEED_TIME, t) + 1.8 * smooth(FEED_TIME + 1, DISRUPT_TIME, t);
            const gas = victimKind === 'star' ? 1 : 0;
            const strength = gas * (smooth(2, 10, t) + 2 * smooth(FEED_TIME, DISRUPT_TIME - 1, t)) * (1 - smooth(-1, 0, broken));
            this._feed(state, state.bodies, victim, eater, strength,
                0.35 - 0.17 * smooth(FEED_TIME, end, t), 1 + 1.5 * smooth(FEED_TIME, end, t));
            const debris = this._debrisField(state.bodies[eater]);
            if (broken >= 0 && !this._torn.has(victim))
                this._tearApart(state, debris, victim, eater, victimKind);
            if (broken >= 0) {
                state.bodies[victim].scale *= 1 - smooth(0, BREAK_TIME, broken);
                state.bodies[eater].position = this._eaterAtTear.map(v => v * decay(broken, 6));
                state.moonKeep = 0;
            }
            state.flash = 1.2 * decay(broken, 0.8);
            this._showDebris(state, debris, state.bodies[eater]);
            return;
        }

        const position = (this._eaterAtTear ?? [0, 0, 0]).map(v => v * decay(broken, 6));
        const since = t - end;
        const before = eaterKind === 'black-hole' ? 2.2 : 2;
        const gain = mix(before, 1.2, smooth(0, 20, since));
        const outer = mix(Math.min(DISK_OUTER, 0.42 * separation / PAIR_SCALE), DISK_OUTER, smooth(0, 12, since));
        const hole = body(eaterKind, position, PAIR_SCALE, gain, outer);
        state.bodies = [hole];
        state.moonKeep = 0;
        if (eaterKind === 'black-hole')
            state.jets = [...position, 2.5 * smooth(0, 1.5, since) * (0.4 + 0.6 * decay(since, 20))];
        else
            state.beams = 1 + 2.5 * smooth(0, 2, since) * decay(since, 15);
        this._showDebris(state, this._debrisField(hole), hole);
    }

    _tearApart(state, debris, victim, eater, victimKind) {
        this._torn.add(victim);
        const t = this._time;
        const offset = state.bodies[victim].position.map((v, i) => v - state.bodies[eater].position[i]);
        const separation = Math.hypot(...offset);
        const axis = offset.map(v => v / separation);
        const spin = ANGULAR_SPEED * (SEPARATION / separation) ** 1.5;
        const closing = (this._separation(t + 0.01) - this._separation(t)) / 0.01;
        const velocity = [axis[2] * spin * separation + axis[0] * closing, 0, -axis[0] * spin * separation + axis[2] * closing];
        const {palette, glow} = VICTIM_DEBRIS[victimKind];
        const radius = radiusOf(victimKind, state.bodies[victim].scale);
        this._eaterAtTear = [...state.bodies[eater].position];
        debris.burst({offset, velocity, radius, axis, stretch: state.tidal[0], palette, glow, gravity: PAIR_GRAVITY, count: PAIR_DEBRIS});
        if (victimKind === 'planet')
            this._tearRing(debris, {offset, velocity, radius, axis, stretch: state.tidal[0]}, victim);
        if (victimKind !== 'earth')
            return;
        const angle = this._sky
            ? Math.atan2(state.light[2], state.light[0]) - 2 * Math.PI * this._sky.moonPhase
            : -2 * Math.PI * (this._shaderTime / SHADER_PERIOD * EARTH_MOON_TURNS + 0.2);
        const tilt = this._sky ? state.moonTilt : Math.atan(0.09 * Math.sin(angle));
        const reach = EARTH_RADIUS * state.bodies[victim].scale * EARTH_MOON_REACH.pair;
        const moon = [Math.cos(angle) * Math.cos(tilt), Math.sin(tilt), Math.sin(angle) * Math.cos(tilt)];
        debris.burst({
            offset: offset.map((v, i) => v + moon[i] * reach),
            velocity,
            radius: radius * 0.27,
            axis,
            stretch: 1,
            palette: MOON_COLORS,
            glow: MOON_GLOW,
            gravity: PAIR_GRAVITY,
            count: MOON_DEBRIS,
        });
    }

    _tearRing(debris, {offset, velocity, radius, axis, stretch}, victim) {
        const normal = normalized(PLANET_AXIS);
        debris.ring({
            offset, velocity, normal, axis, stretch,
            inner: PLANET_RING[0] * radius,
            outer: PLANET_RING[1] * radius,
            spin: RING_SPIN,
            palette: RING_COLORS,
            glow: RING_GLOW,
            gravity: PAIR_GRAVITY,
            count: RING_DEBRIS,
        });
        const side = normalized(crossed(normal, [0, 0, 1]));
        const front = crossed(side, normal);
        PLANET_MOONS.forEach((moon, k) => {
            const speed = 7 - 3 * k + 0.5 * k * (k - 1);
            const phase = 0.15 + 0.37 * k - 0.015 * k * (k - 1) + victim * 0.5;
            const angle = 2 * Math.PI * (this._shaderTime / SHADER_PERIOD * speed + phase);
            const inclination = (k - 1) * 0.55 + 0.2;
            const tilted = front.map((v, i) => v * Math.cos(inclination) + normal[i] * Math.sin(inclination));
            const reach = moon.orbit * radius;
            const place = side.map((v, i) => (v * Math.cos(angle) + tilted[i] * Math.sin(angle)) * reach);
            const turn = 2 * Math.PI * speed / SHADER_PERIOD * reach;
            debris.burst({
                offset: offset.map((v, i) => v + place[i]),
                velocity: velocity.map((v, i) => v + (tilted[i] * Math.cos(angle) - side[i] * Math.sin(angle)) * turn),
                radius: moon.radius * radius,
                axis,
                stretch: 1,
                palette: MOON_COLORS,
                glow: MOON_GLOW,
                gravity: PAIR_GRAVITY,
                count: PLANET_MOON_DEBRIS,
            });
        });
    }
}
