import {gaussian, randomStream} from './galaxy.js';
import {wrap} from './sky.js';

export const BIRTH = {
    supernova: 8,
    shock: [9, 10, 24, 29],
    collapse: [22, 24, 10, 18],
    envelope: [24, 72],
    protostar: [24, 44],
    jets: [26, 30, 70, 100],
    solids: [46, 60],
    clearing: [94, 118],
    ignition: [106, 120],
    theia: [96, 126],
    moon: [128, 140],
    scatter: [104, 146],
    today: [142, 156],
    end: 180,
};

export const SHOCK_SPEED = 11;
export const ENVELOPE_RADIUS = [40, 12];

const SUPERNOVA_POSITION = [-100, 30, -110];

const GAS = 7000;
const DUST = 5000;
const THEIA = 500;
const STRIDE = 13;
const CLOUD_RADIUS = ENVELOPE_RADIUS[0];
const CLOUD_SPIN = 0.01;
const STAR_SHARE = 0.22;
const DISK_INNER = 3.8;
const DISK_OUTER = 36;
const FLARE = 0.06;
const SETTLED = 0.15;
const FROST_LINE = [15, 11.4];
const GAP_OPENS = 8;
const KUIPER_WIDTH = 4.5;
const PLANET_SHARE = 0.8;
const GIANT_GAS_SHARE = 0.6;
const GIANT_GAS_REACH = 0.6;
const PULL_TIME = 3.5;
const CLEAR_TIME = 6;
const GAP = 0.18;
const SHOCK_WIDTH = 4;
const SHOCK_PUSH = 2.5;
const THEIA_SPREAD = 0.35;
const THEIA_LEAD = Math.PI / 3;
const STAR_RADIUS = 5;
const PROTOSTAR_SCALE = 0.7;
const SUN_SCALE = 0.5;
const GROWTH = [[84, 122], [86, 124], [90, 126], [64, 92], [58, 80], [66, 90], [76, 100], [80, 104]];
const ZONES = [0.6, 0.7, 1, 0.6, 2.2, 3, 1.8, 1.2];
const GIANTS = [4, 5, 6, 7];
const FATE = {star: -1, belt: 8, kuiper: 9, scattered: 10, cleared: 11, drained: 12};

const CLOUD_DUST = [0.45, 0.3, 0.25];
const CLOUD_GAS = [0.5, 0.18, 0.2];
const SHOCK_COLOR = [0.55, 0.85, 1];
const ROCK = [0.9, 0.55, 0.3];
const ICE = [0.45, 0.7, 1];
const MAGMA = [1, 0.6, 0.25];
const BELT_ROCK = [0.45, 0.4, 0.35];
const KUIPER_RED = [0.8, 0.55, 0.45];
const BLACKBODY = [[0.7, 0.12, 0.03], [1, 0.45, 0.1], [1, 0.85, 0.55], [0.9, 0.93, 1]];
const CLOUD_GLOW = 4;
const SHOCK_GLOW = 12;
const GAS_GLOW = 4;
const DUST_GLOW = 7;
const ACCRETE_GLOW = 3;
const BELT_GLOW = 0.35;
const THEIA_GLOW = 2;
const IMPACT_GLOW = 8;

const smooth = (edge0, edge1, x) => {
    const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
    return t * t * (3 - 2 * t);
};

const mix = (a, b, t) => a + (b - a) * t;

function blackbody(heat, out) {
    const x = Math.min(Math.max(heat, 0), 1) * 3;
    const i = Math.min(Math.floor(x), 2);
    for (let c = 0; c < 3; c++)
        out[c] = mix(BLACKBODY[i][c], BLACKBODY[i + 1][c], x - i);
    return out;
}

export function moonAngle(moon, t) {
    return -2 * Math.PI * (t / moon.period + moon.phase);
}

export function sunAt(t) {
    const grow = smooth(...BIRTH.protostar, t);
    const ignite = smooth(...BIRTH.ignition, t);
    return {
        scale: mix(PROTOSTAR_SCALE * grow ** 0.5, SUN_SCALE, ignite),
        heat: mix(0.25 + 0.4 * smooth(BIRTH.protostar[0], BIRTH.envelope[1], t), 1, ignite),
        ignite,
    };
}

export function growthOf(index, t) {
    const [start, end] = GROWTH[index];
    if (GIANTS.includes(index)) {
        const core = mix(start, end, 0.5);
        return 0.3 * smooth(start, core, t) + 0.7 * smooth(core, end, t);
    }
    return smooth(start, end, t);
}

export class SolarBirth {
    constructor({planets, year, moon, belt}, seed = 29) {
        const random = randomStream(seed);
        this._planets = planets;
        this._moon = moon;
        this._belt = belt;
        this._updated = null;
        this._color = [0, 0, 0];
        this._rates = planets.map(planet => 2 * Math.PI / (year * Math.sqrt(planet.years)));
        this._logRates = planets.map((planet, index) => [Math.log(planet.orbit), Math.log(this._rates[index])]);
        this.count = 0;
        this.positions = new Float32Array((GAS + DUST + THEIA) * 3);
        this.colors = new Float32Array((GAS + DUST + THEIA) * 3);
        this.occluder = null;
        this._particles = new Float32Array((GAS + DUST) * STRIDE);
        const [first, spread, fall, fallSpread] = BIRTH.collapse;
        for (let index = 0; index < GAS + DUST; index++) {
            const o = index * STRIDE;
            const dust = index >= GAS;
            const radius = CLOUD_RADIUS * random() ** 0.7;
            const z = 2 * random() - 1;
            const around = 2 * Math.PI * random();
            const ring = Math.sqrt(1 - z * z) * radius;
            const start = [ring * Math.cos(around), z * radius * 0.85, ring * Math.sin(around)];
            const share = ring / CLOUD_RADIUS;
            const star = share < STAR_SHARE;
            const orbit = star ? 0 : mix(DISK_INNER, DISK_OUTER, ((share - STAR_SHARE) / (1 - STAR_SHARE)) ** 1.2);
            const begin = first + spread * (radius / CLOUD_RADIUS) ** 1.5;
            const duration = fall + fallSpread * radius / CLOUD_RADIUS;
            const [fate, fateTime] = star ? [FATE.star, begin + duration] : this._fate(orbit, dust, random);
            this._particles.set([
                start[1], ring, around, orbit, star ? 0 : this._rateAt(orbit),
                gaussian(random) * FLARE * orbit * (dust ? SETTLED : 1), begin, duration, fate, fateTime,
                Math.hypot(...start.map((v, i) => v - SUPERNOVA_POSITION[i])), 0.5 + random(), dust ? 1 : 0,
            ], o);
        }
        this._theia = new Float32Array(THEIA * 4);
        for (let index = 0; index < THEIA; index++) {
            const o = index * 4;
            for (let i = 0; i < 3; i++)
                this._theia[o + i] = gaussian(random) * THEIA_SPREAD;
            this._theia[o + 3] = random();
        }
        this._blast = SUPERNOVA_POSITION.map(v => -v / Math.hypot(...SUPERNOVA_POSITION));
    }

    _rateAt(radius) {
        const points = this._logRates;
        const x = Math.log(radius);
        const above = points.findIndex(([orbit]) => orbit > x);
        const i = Math.min(Math.max(above === -1 ? points.length - 1 : above, 1), points.length - 1);
        const [[x0, y0], [x1, y1]] = [points[i - 1], points[i]];
        return Math.exp(y0 + (y1 - y0) * (x - x0) / (x1 - x0));
    }

    _fate(orbit, dust, random) {
        const [belt0, belt1] = this._belt;
        const nearest = this._planets.findIndex((planet, k) => Math.abs(orbit - planet.orbit) < ZONES[k]);
        if (dust) {
            if (nearest >= 0 && random() < PLANET_SHARE) {
                const [start, end] = GROWTH[nearest];
                return [nearest, mix(start, end, random() ** 0.7)];
            }
            if (orbit > belt0 && orbit < belt1)
                return [FATE.belt, 0];
            if (orbit > DISK_OUTER - KUIPER_WIDTH)
                return [FATE.kuiper, 0];
            return [FATE.scattered, mix(...BIRTH.scatter, random())];
        }
        const giant = GIANTS.includes(nearest) && Math.abs(orbit - this._planets[nearest].orbit) < ZONES[nearest] * GIANT_GAS_REACH;
        if (giant && random() < GIANT_GAS_SHARE) {
            const [start, end] = GROWTH[nearest];
            return [nearest, mix(mix(start, end, 0.5), end, random())];
        }
        const [clear0, clear1] = BIRTH.clearing;
        if (orbit < GAP_OPENS)
            return [FATE.drained, clear0 + 2 * random()];
        return [FATE.cleared, mix(clear0 + 2, clear1 - CLEAR_TIME, (orbit - GAP_OPENS) / (DISK_OUTER - GAP_OPENS)) + 2 * random()];
    }

    planetAngle(index, t) {
        return this._planets[index].start - this._rates[index] * t;
    }

    update(t) {
        if (t === this._updated)
            return;
        this._updated = t;
        const sun = sunAt(t);
        this.occluder = sun.scale > 0 ? {center: [0, 0, 0], radius: STAR_RADIUS * sun.scale} : null;
        const shockRadius = SHOCK_SPEED * (t - BIRTH.supernova);
        const shocking = t > BIRTH.supernova && t < BIRTH.shock[3];
        const condense = smooth(...BIRTH.solids, t);
        const today = smooth(...BIRTH.today, t);
        const frost = mix(...FROST_LINE, smooth(BIRTH.solids[0], BIRTH.clearing[0], t));
        const color = this._color;
        const growth = GIANTS.map(k => growthOf(k, t));
        const planetAngles = this._planets.map((_, k) => this.planetAngle(k, t));
        const {positions, colors} = this;
        const p = this._particles;
        let count = 0;
        for (let index = 0; index < GAS + DUST; index++) {
            const o = index * STRIDE;
            const fate = p[o + 8];
            const fateTime = p[o + 9];
            const planet = fate >= 0 && fate < 8;
            if ((planet || fate === FATE.star) && t >= fateTime)
                continue;
            const dust = p[o + 12] > 0;
            const start = p[o + 6];
            const fall = p[o + 7];
            const collapse = smooth(start, start + fall, t);
            const u = Math.min(Math.max((t - start) / fall, 0), 1);
            const spun = t < start ? 0 : u < 1 ? fall * (u ** 3 - u ** 4 / 2) : fall / 2 + t - start - fall;
            const orbit = p[o + 3];
            let angle = p[o + 2] - CLOUD_SPIN * t - p[o + 4] * spun;
            let radius = mix(p[o + 1], orbit, collapse);
            let height = mix(p[o], p[o + 5] * (dust ? mix(1 / SETTLED, 1, condense) : 1), collapse);
            let fade = 1;
            let heat = 0;
            let tint = null;
            if (planet) {
                const pull = smooth(fateTime - PULL_TIME, fateTime, t);
                angle += wrap(planetAngles[fate] - angle) * pull;
                radius = mix(radius, this._planets[fate].orbit, pull);
                height *= 1 - pull;
                heat = ACCRETE_GLOW * smooth(fateTime - 1.2, fateTime, t);
            } else if (fate === FATE.cleared) {
                const blow = smooth(fateTime, fateTime + CLEAR_TIME, t);
                radius *= 1 + 0.8 * blow;
                height *= 1 + 3 * blow;
                fade = 1 - blow;
            } else if (fate === FATE.drained) {
                const drain = smooth(fateTime, fateTime + CLEAR_TIME, t);
                radius *= 1 - 0.9 * drain;
                height *= 1 - drain;
                fade = 1 - drain;
            } else if (fate === FATE.scattered) {
                const fling = smooth(fateTime - 3, fateTime + 3, t);
                radius *= 1 + 1.5 * fling;
                height *= 1 + 4 * fling;
                fade = 1 - fling;
            } else if (fate === FATE.belt) {
                fade = mix(1, BELT_GLOW, today);
                tint = BELT_ROCK;
            } else if (fate === FATE.kuiper) {
                fade = mix(1, BELT_GLOW * 0.5, today);
                tint = KUIPER_RED;
            }
            if (fade <= 0)
                continue;
            if (!planet) {
                for (let g = 0; g < GIANTS.length; g++) {
                    const giantOrbit = this._planets[GIANTS[g]].orbit;
                    const gap = GAP * giantOrbit * growth[g];
                    const offset = radius - giantOrbit;
                    if (gap > 0 && Math.abs(offset) < gap)
                        radius = giantOrbit + Math.sign(offset || 1) * gap;
                }
            }
            const q = count * 3;
            const squeeze = smooth(p[o + 10] - SHOCK_WIDTH, p[o + 10], shockRadius) * (1 - collapse) * SHOCK_PUSH;
            positions[q] = radius * Math.cos(angle) + this._blast[0] * squeeze;
            positions[q + 1] = height + this._blast[1] * squeeze;
            positions[q + 2] = radius * Math.sin(angle) + this._blast[2] * squeeze;
            const front = shocking ? Math.exp(-(((p[o + 10] - shockRadius) / SHOCK_WIDTH) ** 2)) * SHOCK_GLOW : 0;
            const disk = Math.min(1, Math.sqrt(DISK_INNER / Math.max(radius, DISK_INNER)));
            const glow = p[o + 11] * fade;
            if (dust) {
                blackbody(0.1 + 0.4 * disk, color);
                const solid = radius < frost ? ROCK : ICE;
                for (let i = 0; i < 3; i++) {
                    const settled = mix(color[i] * disk, solid[i] * (0.5 + 0.5 * disk), condense);
                    const aged = tint ? mix(settled, tint[i], today) : settled;
                    color[i] = mix(CLOUD_DUST[i] * CLOUD_GLOW, aged * DUST_GLOW, collapse);
                }
            } else {
                blackbody(disk * (0.35 + 0.65 * sun.heat), color);
                for (let i = 0; i < 3; i++)
                    color[i] = mix(CLOUD_GAS[i] * CLOUD_GLOW, color[i] * disk * GAS_GLOW, collapse);
            }
            for (let i = 0; i < 3; i++)
                colors[q + i] = (color[i] + SHOCK_COLOR[i] * front + MAGMA[i] * heat) * glow;
            count++;
        }
        count = this._updateTheia(t, count);
        this.count = count;
    }

    _updateTheia(t, count) {
        const [appear, impact] = BIRTH.theia;
        const [merge, formed] = BIRTH.moon;
        if (t < appear || t >= formed)
            return count;
        const earth = this._planets[2];
        const earthAngle = this.planetAngle(2, t);
        const lead = THEIA_LEAD * (1 - smooth(appear, impact, t) ** 2);
        const center = [Math.cos(earthAngle - lead) * earth.orbit, 0, Math.sin(earthAngle - lead) * earth.orbit];
        const since = t - impact;
        const around = moonAngle(this._moon, t);
        const reach = this._moon.orbit * earth.radius;
        const moon = [Math.cos(around) * reach, 0, Math.sin(around) * reach];
        const spread = smooth(impact, impact + 2, t);
        const gather = smooth(merge, formed, t);
        const fadeIn = smooth(appear, appear + 4, t);
        for (let index = 0; index < THEIA; index++) {
            const o = index * 4;
            const q = count * 3;
            const share = this._theia[o + 3];
            const ringRadius = earth.radius * (1.2 + 1.8 * share);
            const ringAngle = 2 * Math.PI * share * 7 - since * 2.5 / (ringRadius / earth.radius) ** 1.5;
            for (let i = 0; i < 3; i++) {
                const ring = i === 1 ? this._theia[o + 1] * 0.2 : (i === 0 ? Math.cos(ringAngle) : Math.sin(ringAngle)) * ringRadius;
                const clump = center[i] + this._theia[o + i];
                const debris = mix(clump, center[i] + ring, spread);
                this.positions[q + i] = mix(debris, center[i] + moon[i] + this._theia[o + i] * 0.2, gather);
            }
            const flash = since >= 0 ? IMPACT_GLOW * Math.exp(-since / 1.5) : 0;
            const glow = (THEIA_GLOW + flash) * fadeIn * (1 - gather) * (0.5 + share);
            const color = since >= 0 ? blackbody(0.5 + 0.5 * Math.exp(-since / 3), this._color) : ROCK;
            for (let i = 0; i < 3; i++)
                this.colors[q + i] = color[i] * glow;
            count++;
        }
        return count;
    }
}
