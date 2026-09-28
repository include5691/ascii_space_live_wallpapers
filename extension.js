import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';

import {Extension, InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Background from 'resource:///org/gnome/shell/ui/background.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {SpaceContent} from './renderer.js';

const MIN_SMOOTHING = 0.03;
const MAX_SMOOTHING = 1.5;
const ZOOM_PER_SCROLL = 0.1;
const ZOOM_SAVE_DELAY = 400;

const radians = degrees => degrees * Math.PI / 180;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function readOptions(settings) {
    return {
        charSize: settings.get_uint('char-size'),
        system: settings.get_string('mode') === 'system',
        labels: settings.get_boolean('labels'),
        objects: {
            pair: [settings.get_string('first-object'), settings.get_string('second-object')],
            system: [settings.get_string('center')],
        }[settings.get_string('mode')] ?? [settings.get_string('first-object')],
        orbitSpeed: settings.get_uint('orbit-speed') / 100,
        events: settings.get_boolean('events'),
        background: settings.get_string('background'),
        spin: settings.get_uint('spin') / 100,
        comets: settings.get_boolean('comets'),
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
        if (child instanceof Background.SystemBackground)
            continue;
        if (child instanceof Meta.BackgroundActor)
            yield child;
        else
            yield* findBackgroundActors(child);
    }
}

function isDesktopAt(x, y) {
    let actor = global.stage.get_actor_at_pos(Clutter.PickMode.REACTIVE, x, y);
    for (; actor; actor = actor.get_parent()) {
        if (actor instanceof Meta.BackgroundActor)
            return true;
        if (actor instanceof Meta.WindowActor)
            return actor.get_meta_window().get_window_type() === Meta.WindowType.DESKTOP;
    }
    return false;
}

function canZoom() {
    return !Main.overview.visible && !Main.sessionMode.isLocked && Main.modalCount === 0;
}

function hasZoomModifiers(event) {
    const modifiers = global.display.compositor_modifiers | Clutter.ModifierType.CONTROL_MASK;
    return (event.get_state() & modifiers) === modifiers;
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

export default class SpaceWallpaperExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._options = readOptions(this._settings);
        this._contents = [];
        this._views = new Set();
        const zoomRange = this._settings.settings_schema.get_key('zoom').get_range();
        const [, [minZoom, maxZoom]] = zoomRange.recursiveUnpack();
        this._zoomRange = [minZoom / 100, maxZoom / 100];

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
        Main.sessionMode.connectObject('updated', () => this._syncLock(), this);
        global.stage.connectObject(
            'captured-event::scroll', (stage, event) => this._onScroll(event),
            'captured-event::touchpad', (stage, event) => this._onPinch(event),
            this);
        this._settings.connectObject('changed', (settings, key) => this._onSettingChanged(key), this);
        this._syncLock();
    }

    disable() {
        // unlock-dialog keeps the extension enabled so the lock screen shows a still black hole
        this._stopTimer();
        this._cancelZoomSave();
        global.stage.disconnectObject(this);
        this._settings.disconnectObject(this);
        Main.layoutManager.disconnectObject(this);
        Main.sessionMode.disconnectObject(this);
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
            this._contents[index] = new SpaceContent(this._options);
            this._contents[index].setMonitor(monitor, global.display.get_monitor_scale(index));
            this._contents[index].setLocked(Main.sessionMode.isLocked);
        }
        return this._contents[index];
    }

    _decorate(backgroundActor) {
        const content = this._contentFor(backgroundActor.monitor);
        if (!content)
            return;

        const view = new Clutter.Actor({name: 'space-wallpaper', content});
        view.add_constraint(new Clutter.BindConstraint({
            source: backgroundActor,
            coordinate: Clutter.BindCoordinate.SIZE,
        }));

        const container = backgroundActor.get_parent();
        const blur = container.get_effect('blur');
        if (blur)
            blur.enabled = false;

        view.connect('destroy', () => {
            this._views?.delete(view);
            if (blur && !this._hasViewIn(container))
                blur.enabled = true;
        });
        backgroundActor.add_child(view);
        this._views.add(view);
    }

    _hasViewIn(container) {
        return [...this._views ?? []].some(view => view.get_parent()?.get_parent() === container);
    }

    _syncLock() {
        const locked = Main.sessionMode.isLocked;
        this._contents.forEach(content => content.setLocked(locked));
        if (locked)
            this._stopTimer();
        else if (!this._timerId)
            this._startTimer();
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
            this._syncLock();
            return;
        }

        if (key === 'zoom')
            this._cancelZoomSave();
        const {zoom} = this._options;
        this._options = readOptions(this._settings);
        if (this._zoomSaveId || Math.round(zoom * 100) === Math.round(this._options.zoom * 100))
            this._options.zoom = zoom;
        this._contents.forEach(content => content.setOptions(this._options));
    }

    _onScroll(event) {
        if (!canZoom())
            return Clutter.EVENT_PROPAGATE;

        const result = hasZoomModifiers(event) ? Clutter.EVENT_STOP : Clutter.EVENT_PROPAGATE;
        if (result === Clutter.EVENT_PROPAGATE && !isDesktopAt(...event.get_coords()))
            return Clutter.EVENT_PROPAGATE;
        if (event.get_scroll_direction() !== Clutter.ScrollDirection.SMOOTH)
            return result;

        const [, dy] = event.get_scroll_delta();
        this._setZoom(this._options.zoom * Math.exp(-dy * ZOOM_PER_SCROLL));
        return result;
    }

    _onPinch(event) {
        if (event.type() !== Clutter.EventType.TOUCHPAD_PINCH ||
            event.get_touchpad_gesture_finger_count() !== 2)
            return Clutter.EVENT_PROPAGATE;

        switch (event.get_gesture_phase()) {
        case Clutter.TouchpadGesturePhase.BEGIN:
            this._pinchStartZoom = canZoom() && isDesktopAt(...event.get_coords()) ? this._options.zoom : 0;
            break;
        case Clutter.TouchpadGesturePhase.UPDATE:
            if (this._pinchStartZoom)
                this._setZoom(this._pinchStartZoom * event.get_gesture_pinch_scale());
            break;
        default:
            this._pinchStartZoom = 0;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _setZoom(value) {
        const zoom = clamp(value, ...this._zoomRange);
        this._options = {...this._options, zoom};
        this._contents.forEach(content => content.setOptions(this._options));

        this._cancelZoomSave();
        this._zoomSaveId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ZOOM_SAVE_DELAY, () => {
            this._zoomSaveId = 0;
            this._settings.set_uint('zoom', Math.round(zoom * 100));
            return GLib.SOURCE_REMOVE;
        });
    }

    _cancelZoomSave() {
        if (this._zoomSaveId)
            GLib.Source.remove(this._zoomSaveId);
        this._zoomSaveId = 0;
    }

    _startTimer() {
        this._timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT,
            Math.round(1000 / this._settings.get_uint('fps')), () => {
                this._tick();
                return GLib.SOURCE_CONTINUE;
            });
    }

    _stopTimer() {
        if (this._timerId)
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
