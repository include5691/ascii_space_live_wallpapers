import {gaussian, randomStream} from './galaxy.js';

const MAX_DEBRIS = 6000;
const STEP = 0.02;
const ESCAPE_RADIUS = 80;
const SOFTENING = 0.05;
const DISK_REACH = 4;
const SETTLE_RATE = 1.5;
const INFLOW_RATE = 0.12;
const HEAT_REACH = 6;
const HOT_COLOR = [1, 0.55, 0.2];
const HOT_GLOW = 1.2;
const FEED_SMOOTHING = 1.5;

export class DebrisField {
    constructor(seed = 5) {
        this._random = randomStream(seed);
        this.count = 0;
        this.positions = new Float32Array(MAX_DEBRIS * 3);
        this.colors = new Float32Array(MAX_DEBRIS * 3);
        this.occluder = null;
        this.feeding = 0;
        this._motion = new Float32Array(MAX_DEBRIS * 6);
        this._traits = new Float32Array(MAX_DEBRIS * 5);
        this._capture = 1;
    }

    burst({offset, velocity, radius, axis, stretch, palette, glow, gravity, count}) {
        const random = this._random;
        for (let k = 0; k < count && this.count < MAX_DEBRIS; k++) {
            let u;
            do
                u = [0, 1, 2].map(() => 2 * random() - 1);
            while (u[0] ** 2 + u[1] ** 2 + u[2] ** 2 > 1);
            const along = u[0] * axis[0] + u[1] * axis[1] + u[2] * axis[2];
            const index = this.count++;
            for (let i = 0; i < 3; i++) {
                const across = u[i] - axis[i] * along;
                this._motion[index * 6 + i] = offset[i] + (across + axis[i] * along * stretch) * radius;
                this._motion[index * 6 + 3 + i] = velocity[i] + gaussian(random) * 0.04;
            }
            const color = palette[Math.floor(random() * palette.length)];
            this._traits.set([...color, glow * (0.6 + 0.8 * random()), gravity], index * 5);
        }
    }

    set capture(radius) {
        this._capture = radius;
    }

    advance(dt) {
        let swallowed = 0;
        for (let left = dt; left > 1e-6; left -= STEP) {
            const step = Math.min(left, STEP);
            for (let index = 0; index < this.count; index++) {
                const o = index * 6;
                const m = this._motion;
                const r2 = m[o] ** 2 + m[o + 1] ** 2 + m[o + 2] ** 2;
                const r = Math.sqrt(r2);
                if (r < this._capture || r > ESCAPE_RADIUS) {
                    swallowed += r < this._capture ? 1 : 0;
                    this._remove(index--);
                    continue;
                }
                const pull = this._traits[index * 5 + 4] / ((r2 + SOFTENING) * r);
                for (let i = 0; i < 3; i++)
                    m[o + 3 + i] -= m[o + i] * pull * step;
                if (r < DISK_REACH) {
                    const radial = (m[o] * m[o + 3] + m[o + 1] * m[o + 4] + m[o + 2] * m[o + 5]) / r;
                    const settle = 1 - Math.exp(-SETTLE_RATE * step);
                    const inflow = Math.exp(-INFLOW_RATE * step);
                    for (let i = 0; i < 3; i++)
                        m[o + 3 + i] = (m[o + 3 + i] - m[o + i] / r * radial * settle) * inflow;
                    m[o + 4] *= 1 - settle;
                    m[o + 1] *= 1 - settle;
                }
                for (let i = 0; i < 3; i++)
                    m[o + i] += m[o + 3 + i] * step;
            }
        }
        const rate = dt > 0 ? swallowed / dt : 0;
        this.feeding += (rate - this.feeding) * (1 - Math.exp(-dt / FEED_SMOOTHING));
    }

    place(center) {
        for (let index = 0; index < this.count; index++) {
            const o = index * 6;
            const t = index * 5;
            const r = Math.hypot(this._motion[o], this._motion[o + 1], this._motion[o + 2]);
            const heat = Math.min(Math.max((HEAT_REACH - r) / (HEAT_REACH - this._capture), 0), 1) ** 2;
            for (let i = 0; i < 3; i++) {
                this.positions[index * 3 + i] = center[i] + this._motion[o + i];
                this.colors[index * 3 + i] = this._traits[t + i] * this._traits[t + 3] * (1 - heat) + HOT_COLOR[i] * HOT_GLOW * heat;
            }
        }
    }

    _remove(index) {
        const last = --this.count;
        if (index === last)
            return;
        this._motion.copyWithin(index * 6, last * 6, last * 6 + 6);
        this._traits.copyWithin(index * 5, last * 5, last * 5 + 5);
    }
}
