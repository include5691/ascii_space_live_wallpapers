import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const MODES = [
    ['single', 'Single'],
    ['pair', 'Pair'],
    ['system', 'Solar system'],
];

const OBJECTS = [
    ['black-hole', 'Black hole'],
    ['neutron-star', 'Neutron star'],
    ['star', 'Star'],
    ['wormhole', 'Wormhole'],
    ['planet', 'Ringed planet'],
    ['earth', 'Earth'],
];

const CENTERS = [
    ['star', 'Sun'],
    ['black-hole', 'Black hole'],
    ['neutron-star', 'Neutron star'],
    ['wormhole', 'Wormhole'],
];

const EVENT_PAIRS = new Set([
    'black-hole+black-hole',
    'neutron-star+neutron-star',
    'black-hole+neutron-star',
    'black-hole+star',
    'neutron-star+star',
]);

function selectedObjects(settings) {
    const first = settings.get_string('first-object');
    return {
        pair: [first, settings.get_string('second-object')],
        system: [settings.get_string('center')],
    }[settings.get_string('mode')] ?? [first];
}

function isSystem(settings) {
    return settings.get_string('mode') === 'system';
}

function hasEvents(objects, system = false) {
    if (system)
        return false;
    return objects.length === 1 ? objects[0] === 'star' : EVENT_PAIRS.has([...objects].sort().join('+'));
}

function isNeutronStarPair(objects) {
    return objects.length === 2 && objects.every(kind => kind === 'neutron-star');
}

function hasBlackHole(objects, events) {
    return objects.includes('black-hole') || (events && isNeutronStarPair(objects));
}

function hasDisk(objects, events) {
    return hasBlackHole(objects, events) ||
        (events && objects.includes('neutron-star') && objects.includes('star'));
}

const BACKGROUNDS = [
    ['milky-way', 'Milky Way'],
    ['stars', 'Stars'],
];

function connectSetting(settings, key, widget, callback) {
    const id = settings.connect(`changed::${key}`, callback);
    widget.connect('destroy', () => settings.disconnect(id));
}

function spinRow(settings, key, title, subtitle = '') {
    const [, [min, max]] = settings.settings_schema.get_key(key).get_range().recursiveUnpack();
    const row = Adw.SpinRow.new_with_range(min, max, 1);
    row.set({title, subtitle});
    settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
    return row;
}

function switchRow(settings, key, title, subtitle = '') {
    const row = new Adw.SwitchRow({title, subtitle});
    settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
    return row;
}

function comboRow(settings, key, title, options) {
    const row = new Adw.ComboRow({
        title,
        model: Gtk.StringList.new(options.map(([, label]) => label)),
    });
    const sync = () => {
        row.selected = Math.max(options.findIndex(([value]) => value === settings.get_string(key)), 0);
    };
    sync();
    connectSetting(settings, key, row, sync);
    row.connect('notify::selected', () => settings.set_string(key, options[row.selected][0]));
    return row;
}

function resetButton(settings, keys) {
    const button = new Gtk.Button({
        icon_name: 'edit-undo-symbolic',
        tooltip_text: 'Reset',
        valign: Gtk.Align.CENTER,
        css_classes: ['flat'],
    });
    button.connect('clicked', () => keys.forEach(key => settings.reset(key)));
    return button;
}

export default class SpaceWallpaperPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window._settings = settings;

        const objects = new Adw.PreferencesGroup({title: 'Objects'});
        const secondObject = comboRow(settings, 'second-object', 'Second object', OBJECTS);
        const orbitSpeed = spinRow(settings, 'orbit-speed', 'Speed', 'Orbits and cosmic events, in percent');
        objects.add(comboRow(settings, 'mode', 'Mode', MODES));
        const firstObject = comboRow(settings, 'first-object', 'First object', OBJECTS);
        const center = comboRow(settings, 'center', 'Center', CENTERS);
        const labels = switchRow(settings, 'labels', 'Planet names');
        objects.add(firstObject);
        objects.add(center);
        objects.add(secondObject);
        objects.add(orbitSpeed);
        const spin = spinRow(settings, 'spin', 'Black hole spin', 'Percent of the maximum; drags space and squashes the shadow');
        const events = switchRow(settings, 'events', 'Cosmic events', 'Mergers, devoured stars and supernovae');
        objects.add(spin);
        objects.add(labels);
        objects.add(switchRow(settings, 'comets', 'Comets and meteors'));
        objects.add(events);

        const performance = new Adw.PreferencesGroup({title: 'Performance'});
        performance.add(spinRow(settings, 'fps', 'Frame rate', 'Frames per second'));
        performance.add(switchRow(settings, 'pause-when-covered', 'Pause behind windows',
            'Stop rendering while a maximized or fullscreen window covers the screen'));

        const cursor = new Adw.PreferencesGroup({title: 'Cursor'});
        const sensitivity = spinRow(settings, 'cursor-sensitivity', 'Sensitivity', 'Percent');
        const smoothing = spinRow(settings, 'cursor-smoothing', 'Smoothness', 'Percent');
        cursor.add(switchRow(settings, 'follow-cursor', 'Follow cursor'));
        cursor.add(sensitivity);
        cursor.add(smoothing);

        const syncCursorRows = () => {
            const follow = settings.get_boolean('follow-cursor');
            [sensitivity, smoothing].forEach(row => row.set_sensitive(follow));
        };
        syncCursorRows();
        connectSetting(settings, 'follow-cursor', sensitivity, syncCursorRows);

        const sceneKeys = ['background', 'char-size', 'rotation-speed', 'elevation', 'tilt', 'zoom', 'brightness', 'doppler'];
        const scene = new Adw.PreferencesGroup({
            title: 'Scene',
            header_suffix: resetButton(settings, sceneKeys),
        });
        scene.add(comboRow(settings, 'background', 'Background', BACKGROUNDS));
        scene.add(spinRow(settings, 'char-size', 'Character size', 'Screen pixels per font dot'));
        const rotation = spinRow(settings, 'rotation-speed', 'Disk rotation speed', 'Percent');
        scene.add(rotation);
        scene.add(spinRow(settings, 'elevation', 'Camera height', 'Degrees above the orbital plane'));
        scene.add(spinRow(settings, 'tilt', 'Tilt', 'Degrees'));
        scene.add(spinRow(settings, 'zoom', 'Zoom', 'Percent'));
        scene.add(spinRow(settings, 'brightness', 'Brightness', 'Percent'));
        const doppler = spinRow(settings, 'doppler', 'Doppler effect', 'Brighter approaching side of the disk, in percent');
        scene.add(doppler);

        const syncObjectRows = () => {
            const selected = selectedObjects(settings);
            const pair = selected.length === 2;
            const system = isSystem(settings);
            const eventsOn = settings.get_boolean('events') && !system;
            firstObject.set_visible(!system);
            center.set_visible(system);
            secondObject.set_sensitive(pair);
            labels.set_sensitive(system);
            orbitSpeed.set_sensitive(pair || system || (eventsOn && hasEvents(selected)));
            spin.set_sensitive(hasBlackHole(selected, eventsOn));
            events.set_sensitive(hasEvents(selected, system));
            const disk = hasDisk(selected, eventsOn);
            [rotation, doppler].forEach(row => row.set_sensitive(disk));
        };
        syncObjectRows();
        ['mode', 'first-object', 'second-object', 'center', 'events'].forEach(key => connectSetting(settings, key, spin, syncObjectRows));

        const page = new Adw.PreferencesPage();
        [objects, performance, cursor, scene].forEach(group => page.add(group));
        window.add(page);
    }
}
