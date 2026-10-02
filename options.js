import {selectedScene} from './events.js';

const MIN_SMOOTHING = 0.03;
const MAX_SMOOTHING = 1.5;

const radians = degrees => degrees * Math.PI / 180;

export function readOptions(settings) {
    return {
        ...selectedScene(settings),
        charSize: settings.get_uint('char-size'),
        labels: settings.get_boolean('labels'),
        realTime: settings.get_boolean('real-time'),
        orbitSpeed: settings.get_uint('orbit-speed') / 100,
        events: settings.get_boolean('events'),
        background: settings.get_string('background'),
        spin: settings.get_uint('spin') / 100,
        pauseWhenCovered: settings.get_boolean('pause-when-covered'),
        followCursor: settings.get_boolean('follow-cursor'),
        sensitivity: settings.get_uint('cursor-sensitivity') / 100,
        smoothing: MIN_SMOOTHING + (MAX_SMOOTHING - MIN_SMOOTHING) * settings.get_uint('cursor-smoothing') / 100,
        speed: settings.get_uint('rotation-speed') / 100,
        elevation: radians(settings.get_int('elevation')),
        tilt: radians(settings.get_int('tilt')),
        zoom: settings.get_uint('zoom') / 100,
        exposure: settings.get_uint('brightness') / 100,
        doppler: settings.get_uint('doppler') / 100,
    };
}
