import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';

import {Extension, InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Background from 'resource:///org/gnome/shell/ui/background.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {BlackHoleContent} from './renderer.js';

const QUALITY = {
    low: {step: 0.14, octaves: 3},
    medium: {step: 0.1, octaves: 4},
    high: {step: 0.07, octaves: 5},
};

const MIN_SMOOTHING = 0.03;
const MAX_SMOOTHING = 1.5;

const radians = degrees => degrees * Math.PI / 180;

function readOptions(settings) {
    return {
        ...QUALITY[settings.get_string('quality')],
        renderScale: settings.get_uint('render-scale') / 100,
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

function* findBackgroundActors(actor) {
    for (const child of actor) {
        if (child instanceof Meta.BackgroundActor)
            yield child;
        else
            yield* findBackgroundActors(child);
    }
}

function isMonitorCovered(index) {
    if (Main.overview.visible)
        return false;
    if (global.display.get_monitor_in_fullscreen(index))
        return true;

    return global.workspace_manager.get_active_workspace().list_windows().some(window =>
        window.get_monitor() === index &&
        window.get_window_type() === Meta.WindowType.NORMAL &&
        window.showing_on_its_workspace() &&
        window.is_maximized());
}

export default class BlackHoleWallpaperExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._options = readOptions(this._settings);
        this._contents = [];
        this._views = new Set();

        const extension = this;
        this._injectionManager = new InjectionManager();
        this._injectionManager.overrideMethod(Background.BackgroundManager.prototype,
            '_createBackgroundActor', original => function (...args) {
                const backgroundActor = original.apply(this, args);
                extension._decorate(backgroundActor);
                return backgroundActor;
            });
        for (const backgroundActor of findBackgroundActors(global.stage))
            this._decorate(backgroundActor);

        Main.layoutManager.connectObject('monitors-changed', () => this._syncMonitors(), this);
        this._settings.connectObject('changed', (settings, key) => this._onSettingChanged(key), this);
        this._startTimer();
    }

    disable() {
        this._stopTimer();
        this._settings.disconnectObject(this);
        Main.layoutManager.disconnectObject(this);
        this._injectionManager.clear();
        this._injectionManager = null;
        this._views.forEach(view => view.destroy());
        this._views = null;
        this._contents = null;
        this._settings = null;
        this._options = null;
    }

    _contentFor(index) {
        const monitor = Main.layoutManager.monitors[index];
        if (!monitor)
            return null;

        if (!this._contents[index]) {
            this._contents[index] = new BlackHoleContent(this._options);
            this._contents[index].setMonitor(monitor, global.display.get_monitor_scale(index));
        }
        return this._contents[index];
    }

    _decorate(backgroundActor) {
        const content = this._contentFor(backgroundActor.monitor);
        if (!content)
            return;

        const view = new Clutter.Actor({name: 'black-hole-wallpaper', content});
        view.add_constraint(new Clutter.BindConstraint({
            source: backgroundActor,
            coordinate: Clutter.BindCoordinate.SIZE,
        }));
        view.connect('destroy', () => this._views?.delete(view));
        backgroundActor.add_child(view);
        this._views.add(view);
    }

    _syncMonitors() {
        const {monitors} = Main.layoutManager;
        this._contents.length = Math.min(this._contents.length, monitors.length);
        this._contents.forEach((content, index) => {
            content.setMonitor(monitors[index], global.display.get_monitor_scale(index));
        });
    }

    _onSettingChanged(key) {
        if (key === 'fps') {
            this._stopTimer();
            this._startTimer();
            return;
        }

        this._options = readOptions(this._settings);
        this._contents.forEach(content => content.setOptions(this._options));
    }

    _startTimer() {
        this._timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT,
            Math.round(1000 / this._settings.get_uint('fps')), () => {
                this._tick();
                return GLib.SOURCE_CONTINUE;
            });
    }

    _stopTimer() {
        GLib.Source.remove(this._timerId);
        this._timerId = 0;
    }

    _tick() {
        this._contents.forEach((content, index) => {
            if (!this._options.pauseWhenCovered || !isMonitorCovered(index))
                content.advance();
        });
    }
}
