const SPIRAL_OLD_STARS = 6000;
const SPIRAL_ARM_STARS = 6500;
const SPIRAL_BULGE_STARS = 2200;
const SPIRAL_KNOTS = 70;
const SPIRAL_RADIUS = 10;
const ARM_START = 0.12;
const ARM_PITCH = 0.32;
const SPIRAL_PERIOD = 90;
const PATTERN_SPEED = 0.02;

const COLLISION_DISK_STARS = 3200;
const COLLISION_BULGE_STARS = 500;
const COLLISION_SCALE = 6;
const COLLISION_SPEED = 0.4;
const SOFTENING = 0.12;
const PERICENTER = 1.25;
const START_ANOMALY = -2.35;
const FRICTION = 0.3;
const FRICTION_REACH = 0.8;
const MAX_STEP = 0.015;
const TILTS = [[0.25, 0.3], [1.05, 2.1]];
const TAIL_GAIN = 4;
const ESCAPE_START = 6;
const ESCAPE_END = 9;

const CLUSTER_STARS = 16000;
const CLUSTER_CORE = 2.2;
const CLUSTER_LIMIT = 16;
const CLUSTER_PERIOD = 160;
const CLUSTER_TYPES = [
    {share: 0.03, color: [1, 0.6, 0.32], glow: [2, 4]},
    {share: 0.02, color: [0.65, 0.78, 1], glow: [1.2, 2]},
    {share: 0.01, color: [0.55, 0.7, 1], glow: [1.5, 2.5]},
    {share: 0.94, color: [1, 0.9, 0.74], glow: [0.15, 0.5]},
];

const OLD_COLOR = [1, 0.86, 0.66];
const YOUNG_COLOR = [0.55, 0.7, 1];
const NEBULA_COLOR = [1, 0.4, 0.55];
const BULGE_COLOR = [1, 0.8, 0.55];

export function randomStream(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function gaussian(random) {
    return Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
}

function exponentialRadius(random, scale, limit) {
    let radius;
    do
        radius = -scale * Math.log(1 - random()) * (1 + random()) / 2;
    while (radius > limit);
    return radius;
}

function setColor(colors, index, color, brightness) {
    colors[index * 3] = color[0] * brightness;
    colors[index * 3 + 1] = color[1] * brightness;
    colors[index * 3 + 2] = color[2] * brightness;
}

export class SpiralGalaxy {
    constructor(seed = 7) {
        const random = randomStream(seed);
        this.count = SPIRAL_OLD_STARS + SPIRAL_ARM_STARS + SPIRAL_BULGE_STARS;
        this.positions = new Float32Array(this.count * 3);
        this.colors = new Float32Array(this.count * 3);
        const knots = Array.from({length: SPIRAL_KNOTS}, () => ({
            arm: random() < 0.5 ? 0 : 1,
            radius: ARM_START + 0.2 + 0.75 * random(),
        }));
        this._stars = [];
        for (let k = 0; k < SPIRAL_OLD_STARS; k++) {
            const radius = 0.05 + exponentialRadius(random, 0.3, 1.1);
            this._stars.push({kind: 'old', radius, phase: 2 * Math.PI * random(),
                height: gaussian(random) * 0.03 * (1 + radius), glow: 0.4 + 0.5 * random()});
        }
        for (let k = 0; k < SPIRAL_ARM_STARS; k++) {
            const knot = random() < 0.1 ? knots[Math.floor(random() * SPIRAL_KNOTS)] : null;
            const radius = knot ? knot.radius + gaussian(random) * 0.015 : ARM_START + 0.95 * random() ** 0.8;
            this._stars.push({kind: knot ? 'knot' : 'arm', radius, arm: knot ? knot.arm : random() < 0.5 ? 0 : 1,
                spread: gaussian(random) * (knot ? 0.012 : 0.045) * (0.6 + radius),
                height: gaussian(random) * 0.012, glow: 0.6 + 0.8 * random()});
        }
        for (let k = 0; k < SPIRAL_BULGE_STARS; k++) {
            this._stars.push({kind: 'bulge', radius: exponentialRadius(random, 0.08, 0.4) + 0.01,
                tilt: Math.acos(2 * random() - 1), node: 2 * Math.PI * random(),
                phase: 2 * Math.PI * random(), glow: 0.5 + random()});
        }
        this._stars.forEach((star, index) => {
            star.rate = 1 / Math.max(star.radius, star.kind === 'bulge' ? 0.15 : 0.18);
            if (star.kind === 'bulge') {
                star.reach = star.radius * SPIRAL_RADIUS;
                star.lift = Math.sin(star.tilt) * 0.7;
                star.cosTilt = Math.cos(star.tilt);
                star.cosNode = Math.cos(star.node);
                star.sinNode = Math.sin(star.node);
                setColor(this.colors, index, BULGE_COLOR, star.glow * 1.4);
            } else if (star.kind === 'old') {
                star.reach = star.radius * SPIRAL_RADIUS;
                star.lift = star.height * SPIRAL_RADIUS;
                setColor(this.colors, index, OLD_COLOR, star.glow);
            } else {
                star.reach = (star.radius + star.spread) * SPIRAL_RADIUS;
                star.lift = star.height * SPIRAL_RADIUS;
                star.angle = star.arm * Math.PI - Math.log(star.radius / ARM_START) / Math.tan(ARM_PITCH);
                setColor(this.colors, index, star.kind === 'knot' ? NEBULA_COLOR : YOUNG_COLOR,
                    star.glow * (star.kind === 'knot' ? 1.6 : 1));
            }
        });
    }

    update(time) {
        const positions = this.positions;
        const spin = 2 * Math.PI * time / SPIRAL_PERIOD;
        const pattern = PATTERN_SPEED * time;
        this._stars.forEach((star, index) => {
            const o = index * 3;
            if (star.kind === 'arm' || star.kind === 'knot') {
                const angle = star.angle + pattern;
                positions[o] = star.reach * Math.cos(angle);
                positions[o + 1] = star.lift;
                positions[o + 2] = star.reach * Math.sin(angle);
                return;
            }
            const angle = star.phase + spin * star.rate;
            const x = star.reach * Math.cos(angle);
            const around = star.reach * Math.sin(angle);
            if (star.kind === 'old') {
                positions[o] = x;
                positions[o + 1] = star.lift;
                positions[o + 2] = around;
                return;
            }
            positions[o] = x * star.cosNode - around * star.cosTilt * star.sinNode;
            positions[o + 1] = around * star.lift;
            positions[o + 2] = x * star.sinNode + around * star.cosTilt * star.cosNode;
        });
    }
}

export class StarCluster {
    constructor(seed = 23) {
        const random = randomStream(seed);
        this.count = CLUSTER_STARS;
        this.positions = new Float32Array(this.count * 3);
        this.colors = new Float32Array(this.count * 3);
        this._orbits = new Float32Array(this.count * 8);
        for (let index = 0; index < this.count; index++) {
            let radius;
            do
                radius = CLUSTER_CORE / Math.sqrt(Math.max(random(), 1e-6) ** (-2 / 3) - 1);
            while (radius > CLUSTER_LIMIT);
            const axis = unitVector(random);
            const helper = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
            const first = normalized(crossed(axis, helper));
            const second = crossed(axis, first);
            const o = index * 8;
            for (let i = 0; i < 3; i++) {
                this._orbits[o + i] = first[i] * radius;
                this._orbits[o + 3 + i] = second[i] * radius;
            }
            this._orbits[o + 6] = 2 * Math.PI * random();
            this._orbits[o + 7] = 2 * Math.PI / CLUSTER_PERIOD / (1 + (radius / CLUSTER_CORE) ** 2) ** 0.75;
            let pick = random();
            const type = CLUSTER_TYPES.find(candidate => (pick -= candidate.share) < 0) ?? CLUSTER_TYPES.at(-1);
            setColor(this.colors, index, type.color, type.glow[0] + (type.glow[1] - type.glow[0]) * random());
        }
    }

    update(time) {
        const {positions} = this;
        const orbits = this._orbits;
        for (let index = 0; index < this.count; index++) {
            const o = index * 8;
            const angle = orbits[o + 6] + orbits[o + 7] * time;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            positions[index * 3] = orbits[o] * cos + orbits[o + 3] * sin;
            positions[index * 3 + 1] = orbits[o + 1] * cos + orbits[o + 4] * sin;
            positions[index * 3 + 2] = orbits[o + 2] * cos + orbits[o + 5] * sin;
        }
    }
}

function unitVector(random) {
    const z = 2 * random() - 1;
    const angle = 2 * Math.PI * random();
    const ring = Math.sqrt(1 - z * z);
    return [ring * Math.cos(angle), z, ring * Math.sin(angle)];
}

function crossed(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalized(v) {
    const size = Math.hypot(...v);
    return v.map(x => x / size);
}

function tiltedBasis([inclination, node]) {
    const cosI = Math.cos(inclination);
    const sinI = Math.sin(inclination);
    const cosN = Math.cos(node);
    const sinN = Math.sin(node);
    return [[cosN, 0, sinN], [-sinN * cosI, sinI, cosN * cosI], [-sinN * sinI, -cosI, cosN * sinI]];
}

export class GalaxyCollision {
    constructor(seed = 11) {
        this._seed = seed;
        this.count = 2 * (COLLISION_DISK_STARS + COLLISION_BULGE_STARS);
        this.positions = new Float32Array(this.count * 3);
        this.colors = new Float32Array(this.count * 3);
        this.reset();
    }

    reset() {
        const random = randomStream(this._seed);
        const semi = PERICENTER * 2;
        const radius = semi / (1 + Math.cos(START_ANOMALY));
        const speed = Math.sqrt(2 / semi);
        const relative = [radius * Math.cos(START_ANOMALY), 0, radius * Math.sin(START_ANOMALY)];
        const velocity = [-speed * Math.sin(START_ANOMALY), 0, speed * (1 + Math.cos(START_ANOMALY))];
        this._cores = [
            {position: relative.map(v => v / 2), velocity: velocity.map(v => v / 2)},
            {position: relative.map(v => -v / 2), velocity: velocity.map(v => -v / 2)},
        ];
        this._time = 0;
        const perGalaxy = COLLISION_DISK_STARS + COLLISION_BULGE_STARS;
        this._stars = new Float32Array(this.count * 6);
        this._traits = [];
        this._cores.forEach((core, galaxy) => {
            const basis = tiltedBasis(TILTS[galaxy]);
            for (let k = 0; k < perGalaxy; k++) {
                const bulge = k >= COLLISION_DISK_STARS;
                const r = bulge ? exponentialRadius(random, 0.08, 0.35) + 0.03 : 0.18 + 0.9 * Math.sqrt(random());
                const angle = 2 * Math.PI * random();
                const local = [r * Math.cos(angle), bulge ? gaussian(random) * 0.08 : gaussian(random) * 0.015, r * Math.sin(angle)];
                const circular = Math.sqrt(r * r / (r * r + SOFTENING * SOFTENING) ** 1.5);
                const localVelocity = [-circular * Math.sin(angle), 0, circular * Math.cos(angle)];
                const world = [0, 1, 2].map(i => local[0] * basis[0][i] + local[1] * basis[1][i] + local[2] * basis[2][i]);
                const move = [0, 1, 2].map(i => localVelocity[0] * basis[0][i] + localVelocity[2] * basis[2][i]);
                const index = galaxy * perGalaxy + k;
                for (let i = 0; i < 3; i++) {
                    this._stars[index * 6 + i] = core.position[i] + world[i];
                    this._stars[index * 6 + 3 + i] = core.velocity[i] + move[i];
                }
                this._traits.push({
                    bulge,
                    galaxy,
                    young: !bulge && random() < 0.3,
                    nebula: !bulge && random() < 0.05,
                    glow: 0.5 + random(),
                });
            }
        });
        this._paint();
    }

    advance(dt) {
        let remaining = dt * COLLISION_SPEED;
        while (remaining > 1e-6) {
            const step = Math.min(remaining, MAX_STEP);
            this._step(step);
            remaining -= step;
        }
        this._paint();
    }

    _pull(x, y, z, out) {
        out[0] = out[1] = out[2] = 0;
        for (const core of this._cores) {
            const dx = core.position[0] - x;
            const dy = core.position[1] - y;
            const dz = core.position[2] - z;
            const r2 = dx * dx + dy * dy + dz * dz + SOFTENING * SOFTENING;
            const inverse = 1 / (r2 * Math.sqrt(r2));
            out[0] += dx * inverse;
            out[1] += dy * inverse;
            out[2] += dz * inverse;
        }
    }

    _step(dt) {
        const [a, b] = this._cores;
        const separation = a.position.map((v, i) => b.position[i] - v);
        const r2 = separation.reduce((sum, v) => sum + v * v, 0) + SOFTENING * SOFTENING;
        const distance = Math.sqrt(r2);
        const drag = FRICTION * Math.exp(-distance / FRICTION_REACH);
        const relativeVelocity = a.velocity.map((v, i) => b.velocity[i] - v);
        for (let i = 0; i < 3; i++) {
            const pull = separation[i] / (r2 * distance);
            const brake = drag * relativeVelocity[i] / 2;
            a.velocity[i] += (pull + brake) * dt;
            b.velocity[i] += (-pull - brake) * dt;
        }
        this._cores.forEach(core => {
            for (let i = 0; i < 3; i++)
                core.position[i] += core.velocity[i] * dt;
        });

        const stars = this._stars;
        const force = [0, 0, 0];
        for (let index = 0; index < this.count; index++) {
            const o = index * 6;
            this._pull(stars[o], stars[o + 1], stars[o + 2], force);
            stars[o + 3] += force[0] * dt;
            stars[o + 4] += force[1] * dt;
            stars[o + 5] += force[2] * dt;
            stars[o] += stars[o + 3] * dt;
            stars[o + 1] += stars[o + 4] * dt;
            stars[o + 2] += stars[o + 5] * dt;
        }
        this._time += dt;
    }

    _paint() {
        const burst = Math.min(Math.max((this._time - 9) / 4, 0), 1);
        const [a, b] = this._cores.map(core => core.position);
        this._traits.forEach((trait, index) => {
            const o = index * 6;
            const x = this._stars[o];
            const y = this._stars[o + 1];
            const z = this._stars[o + 2];
            for (let i = 0; i < 3; i++)
                this.positions[index * 3 + i] = this._stars[o + i] * COLLISION_SCALE;
            const reach = Math.min(Math.hypot(x - a[0], y - a[1], z - a[2]), Math.hypot(x - b[0], y - b[1], z - b[2]));
            const escape = 1 - Math.min(Math.max((reach - ESCAPE_START) / (ESCAPE_END - ESCAPE_START), 0), 1);
            const tail = (1 + TAIL_GAIN * Math.min(Math.max((reach - 1.2) / 2, 0), 1)) * escape;
            if (trait.bulge)
                setColor(this.colors, index, BULGE_COLOR, trait.glow * 1.3 * escape);
            else if (trait.nebula)
                setColor(this.colors, index, NEBULA_COLOR, trait.glow * (0.3 + 2 * burst) * tail);
            else if (trait.young)
                setColor(this.colors, index, YOUNG_COLOR, trait.glow * (0.9 + 0.6 * burst) * tail);
            else
                setColor(this.colors, index, trait.galaxy ? OLD_COLOR : [0.9, 0.9, 1], trait.glow * 0.8 * tail);
        });
    }
}
