const SEPARATION = 12;
const PAIR_SCALE = 0.6;
const SINGLE_STAR_SCALE = 0.65;
const DISK_OUTER = 17;
const BLACK_HOLE_DISK_INNER = 2.1;
const NEUTRON_DISK_INNER = 5.5;
const NEUTRON_RADIUS = 2.5;
const STAR_RADIUS = 5;
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

export const KINDS = {'black-hole': 0, 'neutron-star': 1, 'star': 2, 'wormhole': 3};

const MASS = {'black-hole': 1, 'neutron-star': 1, 'star': 0.5, 'wormhole': 1};

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
};

const smooth = (edge0, edge1, x) => {
    const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
    return t * t * (3 - 2 * t);
};

const decay = (x, time) => (x < 0 ? 0 : Math.exp(-x / time));

const inspiralSeparation = t => SEPARATION * Math.max(1 - t / INSPIRAL_CHIRP, 0) ** 0.25;

function disk(kind, outer, gain) {
    if (kind === 'black-hole')
        return [BLACK_HOLE_DISK_INNER, outer, gain];
    if (kind === 'neutron-star' && gain > 0)
        return [NEUTRON_DISK_INNER, Math.max(outer, NEUTRON_DISK_INNER * 1.5), gain];
    return [0, 0, 0];
}

const mix = (a, b, t) => a + (b - a) * t;

function body(kind, position, scale, gain = kind === 'black-hole' ? 1 : 0, outer = DISK_OUTER) {
    return {kind, position, scale, disk: disk(kind, outer, gain)};
}

function radiusOf(kind, scale) {
    return (kind === 'star' ? STAR_RADIUS : NEUTRON_RADIUS) * scale;
}

export class Scene {
    constructor(objects, events) {
        this._objects = objects;
        this._events = events;
        if (objects.length === 1)
            this._scenario = events && objects[0] === 'star' ? 'supernova' : 'single';
        else
            this._scenario = events ? SCENARIOS[[...objects].sort().join('+')] ?? 'orbit' : 'orbit';
        this._time = 0;
        this._angle = 0;
        this._looped = false;
    }

    matches(objects, events) {
        return objects.join('+') === this._objects.join('+') && events === this._events;
    }

    advance(dt) {
        const duration = DURATIONS[this._scenario];
        this._time += dt;
        if (duration && this._time >= duration) {
            this._time %= duration;
            this._looped = true;
        }
        const speed = ANGULAR_SPEED * (SEPARATION / this._separation()) ** 1.5;
        this._angle = (this._angle - dt * speed) % (2 * Math.PI);
    }

    state(still = false) {
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
            star: [1, 0, 0, 0],
        };
        switch (this._scenario) {
        case 'single':
            this._single(state);
            break;
        case 'devour':
            this._devour(state);
            break;
        case 'supernova':
            this._supernova(state);
            break;
        case 'orbit':
            state.bodies = this._pair(SEPARATION, [0, 0]);
            break;
        default:
            this._inspiral(state);
        }

        const duration = DURATIONS[this._scenario];
        if (still) {
            state.flash = 0;
        } else if (duration) {
            const fadeIn = this._looped ? smooth(0, FADE_TIME, this._time) : 1;
            state.fade = fadeIn * (1 - smooth(duration - FADE_TIME, duration, this._time));
        }
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

    _single(state) {
        const [kind] = this._objects;
        state.bodies = [body(kind, [0, 0, 0], kind === 'star' ? SINGLE_STAR_SCALE : 1)];
    }

    _supernova(state) {
        const t = this._time;
        const swell = smooth(STABLE_TIME, STABLE_TIME + SWELL_TIME, t);
        if (t < EXPLOSION_TIME - COLLAPSE_TIME) {
            const pulse = 1 + 0.04 * swell * Math.sin(2 * Math.PI * (t - STABLE_TIME) / 2.5);
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
        const eaterDisk = bodies[eater].disk;
        const inner = (eaterDisk[2] > 0 ? eaterDisk[0] : NEUTRON_RADIUS * 1.2) * bodies[eater].scale;
        const stretch = state.tidal[0];
        const start = Math.max(distance - radiusOf(bodies[victim].kind, bodies[victim].scale) * stretch, inner * 1.5);
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
            state.streamCenter = [position[0], position[2], BLACK_HOLE_DISK_INNER * PAIR_SCALE, this._victimAngle(victim)];
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
        const inner = (eaterKind === 'black-hole' ? BLACK_HOLE_DISK_INNER : NEUTRON_DISK_INNER) * PAIR_SCALE;
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
