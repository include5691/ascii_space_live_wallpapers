import {BACKGROUNDS, CENTERS, GALAXIES, MODES, OBJECTS, SINGLE_OBJECTS} from '../choices.js';

const combo = (setting, text, choices, value, condition) => ({setting, text, type: 'combo', value, choices, condition});
const slider = (setting, text, min, max, value, condition) => ({setting, text, type: 'slider', min, max, value, condition});
const toggle = (setting, text, value, condition) => ({setting, text, type: 'bool', value, condition});

export const PROPERTIES = {
    mode: combo('mode', 'Mode', MODES, 'single'),
    singleobject: combo('first-object', 'Object', SINGLE_OBJECTS, 'black-hole', "mode.value == 'single'"),
    pairobject: combo('first-object', 'First object', OBJECTS, 'black-hole', "mode.value == 'pair'"),
    secondobject: combo('second-object', 'Second object', OBJECTS, 'black-hole', "mode.value == 'pair'"),
    galaxy: combo('galaxy', 'Object', GALAXIES, 'spiral', "mode.value == 'galaxy'"),
    center: combo('center', 'Center', CENTERS, 'star', "mode.value == 'galaxy' && galaxy.value == 'system'"),
    orbitspeed: slider('orbit-speed', 'Speed, %', 0, 400, 100),
    spin: slider('spin', 'Black hole spin, %', 0, 99, 60),
    labels: toggle('labels', 'Planet names', false,
        "mode.value == 'galaxy' && (galaxy.value == 'system' || galaxy.value == 'birth')"),
    realtime: toggle('real-time', 'Real time', false),
    events: toggle('events', 'Cosmic events', true),
    followcursor: toggle('follow-cursor', 'Follow cursor', true),
    cursorsensitivity: slider('cursor-sensitivity', 'Cursor sensitivity, %', 0, 200, 50, 'followcursor.value'),
    cursorsmoothing: slider('cursor-smoothing', 'Cursor smoothness, %', 0, 100, 40, 'followcursor.value'),
    background: combo('background', 'Background', BACKGROUNDS, 'milky-way', "mode.value != 'galaxy'"),
    charsize: slider('char-size', 'Character size', 1, 8, 3),
    rotationspeed: slider('rotation-speed', 'Disk rotation speed, %', 0, 400, 100),
    elevation: slider('elevation', 'Camera height, °', -30, 60, 8),
    tilt: slider('tilt', 'Tilt, °', -45, 45, 9),
    zoom: slider('zoom', 'Zoom, %', 25, 400, 100),
    brightness: slider('brightness', 'Brightness, %', 25, 400, 100),
    doppler: slider('doppler', 'Doppler effect, %', 0, 100, 40),
};

export class WallpaperSettings {
    constructor() {
        this._values = Object.fromEntries(Object.entries(PROPERTIES).map(([key, {value}]) => [key, value]));
    }

    apply(properties) {
        for (const [key, {value}] of Object.entries(properties)) {
            if (key in PROPERTIES)
                this._values[key] = value;
        }
    }

    _value(setting) {
        if (setting === 'first-object')
            return this._values[this._values.mode === 'pair' ? 'pairobject' : 'singleobject'];
        const key = Object.keys(PROPERTIES).find(name => PROPERTIES[name].setting === setting);
        return key ? this._values[key] : null;
    }

    get_string(setting) {
        return String(this._value(setting));
    }

    get_uint(setting) {
        return Math.max(Math.round(Number(this._value(setting))), 0);
    }

    get_int(setting) {
        return Math.round(Number(this._value(setting)));
    }

    get_boolean(setting) {
        return this._value(setting) === true;
    }
}
