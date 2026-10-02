import {SpaceFrame} from '../frame.js';
import {readOptions} from '../options.js';
import {WallpaperSettings} from './settings.js';
import {WebGLRenderer} from './webgl.js';

const DEFAULT_FPS = 30;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const canvas = document.getElementById('space');
const settings = new WallpaperSettings();
const frame = new SpaceFrame(readOptions(settings));
const renderer = new WebGLRenderer(canvas, frame);

let fps = DEFAULT_FPS;
let paused = false;
let ready = false;
let lastDraw = 0;
let pointer = null;

const deviceSize = () => [
    Math.round(window.innerWidth * window.devicePixelRatio),
    Math.round(window.innerHeight * window.devicePixelRatio),
];

function resize() {
    renderer.resize(...deviceSize());
}

function loop(time) {
    if (paused)
        return;
    requestAnimationFrame(loop);
    if (time - lastDraw < 1000 / fps - 2)
        return;
    lastDraw = time;
    renderer.draw(time / 1000, pointer);
}

function start() {
    if (ready && !paused)
        requestAnimationFrame(loop);
}

window.wallpaperPropertyListener = {
    applyUserProperties(properties) {
        settings.apply(properties);
        if (frame.setOptions(readOptions(settings)) && ready)
            resize();
    },
    applyGeneralProperties(properties) {
        if (properties.fps > 0)
            fps = properties.fps;
    },
    setPaused(value) {
        paused = value;
        start();
    },
};

window.addEventListener('mousemove', event => {
    pointer = [
        clamp(event.clientX / window.innerWidth * 2 - 1, -1, 1),
        clamp(event.clientY / window.innerHeight * 2 - 1, -1, 1),
    ];
});
window.addEventListener('resize', () => ready && resize());

renderer.load().then(() => {
    ready = true;
    resize();
    start();
});
