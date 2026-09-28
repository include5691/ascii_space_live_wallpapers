# Black Hole Wallpaper

A live ASCII-art black hole wallpaper for GNOME, rendered on the GPU.

Light rays bend around the black hole, so the far side of the disk shows up above and below it. The scene is drawn as colored ASCII characters. The disk spins, stars twinkle, and the camera turns toward your cursor. The lock screen shows the same black hole as a still image.

![Black Hole Wallpaper](assets/preview.png)

![Lock screen](assets/lock.png)

## Features

- Real-time ray tracing of light around a black hole, in a GLSL shader.
- Drawn as ASCII characters in the scene's own colors, from ` .:-+=*%#@`.
- Moving the cursor turns the camera. The camera eases after it.
- Rendered once per frame and shared by the desktop, the overview and the workspace switcher.
- Pauses while a maximized or fullscreen window covers the monitor.
- Works with several monitors, each with its own view.
- The lock screen shows a still, unblurred view.

## Requirements

GNOME Shell 50.

## Install

```sh
git clone https://github.com/include5691/gnome_black_hole_live_wallpaper_extension.git
cd gnome_black_hole_live_wallpaper_extension
make install
```

Log out and back in, because Wayland cannot reload GNOME Shell in place. Then enable it:

```sh
gnome-extensions enable black-hole-wallpaper@include5691.github.io
```

**Update:** `git pull && make install`, then log out and back in.

**Uninstall:**

```sh
gnome-extensions disable black-hole-wallpaper@include5691.github.io
make uninstall
```

## Settings

```sh
gnome-extensions prefs black-hole-wallpaper@include5691.github.io
```

| Setting | Default | Range |
| --- | --- | --- |
| Frame rate | 30 fps | 5 – 60 |
| Pause behind windows | on | |
| Follow cursor | on | |
| Sensitivity | 50 % | 0 – 100 |
| Smoothness | 40 % | 0 – 100 |
| Character size | 3 | 1 – 8 |
| Rotation speed | 100 % | 0 – 400 |
| Camera height | 8° | -30 – 60 |
| Tilt | 9° | -45 – 45 |
| Zoom | 100 % | 50 – 200 |
| Brightness | 100 % | 25 – 400 |
| Doppler effect | 40 % | 0 – 100 |

## Performance

GPU time per frame on an Intel Arc B390 with a 3120×2080 screen and the default character size: 0.5 ms. At 30 fps that is about 1.5 % of the GPU.

## How it works

1. Each `Meta.BackgroundActor` gets a child actor that covers it.
2. The child shows a `Clutter.Content` shared by every background on the same monitor.
3. A timer marks the content dirty. On the next paint it renders two offscreen passes once.
4. The scene pass traces 2×2 light rays per character cell. Each ray is stepped through the bending of space, and the pass finds where it crosses the disk. The disk is colored with noise, heat and Doppler shift.
5. The ASCII pass picks a character for each cell by brightness and draws it from a 5×7 bitmap font, in the cell's color.
6. Each background draws the result, with the rounded corners the overview uses.
7. While the screen is locked, the timer stops and the camera resets to the default view. The lock screen blur is turned off.

## Development

| File | Purpose |
| --- | --- |
| `extension.js` | Hooks into backgrounds, timer, settings, window cover check, lock screen |
| `renderer.js` | Offscreen passes, camera and cursor easing |
| `shader.js` | Scene and ASCII GLSL shaders |
| `prefs.js` | Preferences window |
| `schemas/` | GSettings schema |

Build a zip for extensions.gnome.org with `make pack`.

Watch the logs:

```sh
journalctl -f -o cat /usr/bin/gnome-shell
```

## License

[GPL-2.0-or-later](LICENSE)
