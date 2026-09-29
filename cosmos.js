import {SpiralGalaxy, gaussian, randomStream} from './galaxy.js';

export const BIG_BANG = {
    glow: [0, 3],
    bang: 6,
    plasma: [6, 7, 34, 38],
    cooling: [7, 36],
    light: [34, 38, 44, 52],
    firstStars: [60, 85],
    web: [72, 118],
    expansion: [55, 140],
    galaxy: [138, 160],
    today: [150, 165],
    end: 180,
};

const WEB_STARS = 9000;
const WEB_NODES = 18;
const WEB_SIZE = 30;
const NODE_SHARE = 0.25;
const NODE_SPREAD = 1.5;
const FILAMENT_SPREAD = 0.45;
const LINKS = 2;
const YOUNG = [0.6, 0.75, 1];
const MATURE = [1, 0.9, 0.75];
const IGNITION = 3;
const STAR_GLOW = 3;
const DARK_GAS = 1.5;
const GAS = [0.8, 0.45, 0.35];

const smooth = (edge0, edge1, x) => {
    const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
    return t * t * (3 - 2 * t);
};

export class BigBang {
    constructor(seed = 13) {
        const random = randomStream(seed);
        this._spiral = new SpiralGalaxy();
        this.count = 0;
        this.positions = new Float32Array((WEB_STARS + this._spiral.count) * 3);
        this.colors = new Float32Array((WEB_STARS + this._spiral.count) * 3);
        const nodes = Array.from({length: WEB_NODES}, () => [0, 1, 2].map(() => (2 * random() - 1) * WEB_SIZE));
        const links = nodes.flatMap((node, index) => nodes
            .map((other, j) => ({j, distance: Math.hypot(...node.map((v, i) => v - other[i]))}))
            .filter(({j}) => j !== index)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, LINKS)
            .map(({j}) => [node, nodes[j]]));
        this._stars = new Float32Array(WEB_STARS * 8);
        for (let index = 0; index < WEB_STARS; index++) {
            const o = index * 8;
            for (let i = 0; i < 3; i++)
                this._stars[o + i] = (2 * random() - 1) * WEB_SIZE * 1.2;
            let target;
            if (random() < NODE_SHARE) {
                const node = nodes[Math.floor(random() * WEB_NODES)];
                target = node.map(v => v + gaussian(random) * NODE_SPREAD);
            } else {
                const [a, b] = links[Math.floor(random() * links.length)];
                const u = random();
                target = a.map((v, i) => v + (b[i] - v) * u + gaussian(random) * FILAMENT_SPREAD);
            }
            this._stars.set(target, o + 3);
            const [first, last] = BIG_BANG.firstStars;
            this._stars[o + 6] = first + (last - first) * Math.sqrt(random());
            this._stars[o + 7] = STAR_GLOW * (0.4 + 0.8 * random());
        }
    }

    update(time) {
        const gather = smooth(...BIG_BANG.web, time);
        const scale = 0.7 + 0.3 * smooth(...BIG_BANG.expansion, time);
        const fade = 1 - smooth(BIG_BANG.galaxy[0], BIG_BANG.galaxy[0] + 12, time);
        const age = smooth(90, 125, time);
        const gas = DARK_GAS * smooth(BIG_BANG.light[2], BIG_BANG.light[3] + 4, time);
        this.count = 0;
        if (!gas)
            return;
        for (let index = 0; index < WEB_STARS; index++) {
            const o = index * 8;
            const since = time - this._stars[o + 6];
            const light = (1 + IGNITION * Math.exp(-since / 0.8)) * this._stars[o + 7] * fade;
            for (let i = 0; i < 3; i++) {
                this.positions[index * 3 + i] = (this._stars[o + i] + (this._stars[o + 3 + i] - this._stars[o + i]) * gather) * scale;
                this.colors[index * 3 + i] = since < 0 ? GAS[i] * gas : (YOUNG[i] + (MATURE[i] - YOUNG[i]) * age) * light;
            }
        }
        this.count = WEB_STARS;
        if (time < BIG_BANG.galaxy[0])
            return;
        const form = smooth(...BIG_BANG.galaxy, time);
        const spiral = this._spiral;
        spiral.update(time);
        const spread = 1 + 2.5 * (1 - form);
        const turn = (1 - form) * 1.5;
        for (let index = 0; index < spiral.count; index++) {
            const o = (WEB_STARS + index) * 3;
            const x = spiral.positions[index * 3] * spread;
            const z = spiral.positions[index * 3 + 2] * spread;
            this.positions[o] = x * Math.cos(turn) - z * Math.sin(turn);
            this.positions[o + 1] = spiral.positions[index * 3 + 1] * spread;
            this.positions[o + 2] = x * Math.sin(turn) + z * Math.cos(turn);
            for (let i = 0; i < 3; i++)
                this.colors[o + i] = spiral.colors[index * 3 + i] * form;
        }
        this.count = WEB_STARS + spiral.count;
    }
}
