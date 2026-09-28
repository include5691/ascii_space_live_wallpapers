import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const MODES = [
    ['single', 'Single'],
    ['pair', 'Pair'],
];

const OBJECTS = [
    ['black-hole', 'Black hole'],
    ['neutron-star', 'Neutron star'],
    ['star', 'Star'],
    ['wormhole', 'Wormhole'],
];

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
        const orbitSpeed = spinRow(settings, 'orbit-speed', 'Orbit speed', 'Percent');
        objects.add(comboRow(settings, 'mode', 'Mode', MODES));
        objects.add(comboRow(settings, 'first-object', 'First object', OBJECTS));
        objects.add(secondObject);
        objects.add(orbitSpeed);
        objects.add(switchRow(settings, 'events', 'Cosmic events',
            'Mergers, devoured stars and supernovae'));

        const syncPairRows = () => {
            const pair = settings.get_string('mode') === 'pair';
            [secondObject, orbitSpeed].forEach(row => row.set_sensitive(pair));
        };
        syncPairRows();
        connectSetting(settings, 'mode', secondObject, syncPairRows);

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
        scene.add(spinRow(settings, 'rotation-speed', 'Rotation speed', 'Percent'));
        scene.add(spinRow(settings, 'elevation', 'Camera height', 'Degrees above the disk'));
        scene.add(spinRow(settings, 'tilt', 'Tilt', 'Degrees'));
        scene.add(spinRow(settings, 'zoom', 'Zoom', 'Percent'));
        scene.add(spinRow(settings, 'brightness', 'Brightness', 'Percent'));
        scene.add(spinRow(settings, 'doppler', 'Doppler effect', 'Brighter approaching side, in percent'));

        const page = new Adw.PreferencesPage();
        [objects, performance, cursor, scene].forEach(group => page.add(group));
        window.add(page);
    }
}
