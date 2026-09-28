# Space Wallpaper

A live ASCII-art space wallpaper for GNOME, rendered on the GPU: black holes, neutron stars, stars and wormholes.

Light rays bend around the black hole, so the far side of the disk shows up above and below it. The scene is drawn as colored ASCII characters. The disk spins, stars twinkle, and the camera turns toward your cursor. The lock screen shows the same black hole as a still image.

![Space Wallpaper](assets/preview.png)

![Lock screen](assets/lock.png)

## Features

- Real-time ray tracing of light around a black hole, in a GLSL shader.
- Drawn as ASCII characters in the scene's own colors, from ` .:-+=*%#@`.
- Six object types:
  - a spinning black hole with an accretion disk. Spin drags space around it, which squashes the shadow into a D shape, and pulls the disk's inner edge closer, following the Kerr ISCO;
  - a lone neutron star (pulsar) with rotating hot spots and sweeping beams, and no disk, like most real pulsars;
  - a Sun-like star with limb darkening, granulation, sunspots and a corona;
  - a wormhole: its mouth bends light like a black hole, and through its throat you see another universe with a spinning spiral galaxy;
  - a ringed planet: a banded gas giant with a storm, lit by a sun, with rings that it shadows and that shadow it, and three moons on tilted orbits. Next to a star, it is lit by that star;
  - Earth: real continents from a world map, oceans with sun glint, drifting clouds, polar ice, a blue atmosphere, city lights on the night side, the Moon with dark maria, the ISS and a Starlink train.
- A solar system mode: eight planets with their own looks, faint orbit lines, an asteroid belt and Saturn's rings. The center is any object you pick: the Sun, a black hole, a neutron star or a wormhole. The center lights and bends everything. Planet names can be shown in the same pixel font.
- A Milky Way sky: a glowing band with dust lanes, a bright core, denser stars and colored nebulae, bent by every object. Or plain stars.
- A single star lives out one of two real fates, taking turns:
  - planetary nebula: it swells into a red giant, then puffs off a glowing ring nebula, teal inside and red outside, around a tiny blue-white dwarf;
  - supernova: it swells, collapses, explodes in a flash, and leaves a newborn pulsar inside an expanding filament nebula.
- Comets with blue ion tails and curved dust tails sweep through now and then, and meteors streak across the sky.
- Pair mode shows two objects orbiting each other, with light bent by every black hole and neutron star. Pick any combination.
- Pairs play out a cosmic event, then fade and start again:

  | Pair | Event |
  | --- | --- |
  | Two black holes | They spiral in, sending gravitational waves across a glowing spacetime sheet, then merge in a flash with a shockwave ring. The new black hole rings down and grows a disk. |
  | Black hole or neutron star and a star | A stream of gas pours from the star into the compact object. The star stretches, then is torn apart and swallowed. A black hole then fires jets; a neutron star's pulsar beams blaze brighter. |
  | Two neutron stars | They spiral in and merge: a gamma-ray-burst jet, a shockwave, and a kilonova cloud of fresh heavy elements that cools from blue to red around the new black hole. |
  | Black hole and neutron star | They spiral in, the neutron star is torn apart and swallowed, and the black hole fires jets. |
  | Two stars, or any pair with a wormhole or a planet | A calm orbit. |

  Speed sets how fast orbits and events play. A black hole event takes about 2 minutes at 100 %. Turn off Cosmic events for calm scenes only.
- Moving the cursor turns the camera. The camera eases after it.
- Zoom in and out on the desktop by pinching with two fingers on a touchpad.
- Super+Ctrl+scroll zooms from anywhere, with the mouse wheel or two fingers on a touchpad. Plain scrolling on an empty desktop also zooms, but not while a desktop icons extension covers the wallpaper.
- The zoom is saved.
- Rendered once per frame and shared by the desktop, the overview and the workspace switcher.
- Pauses while a maximized or fullscreen window covers the monitor.
- Works with several monitors, each with its own view.
- The lock screen shows a still, unblurred view.

## Requirements

GNOME Shell 50.

## Install

```sh
git clone https://github.com/include5691/gnome_space_live_wallpaper_extension.git
cd gnome_space_live_wallpaper_extension
make install
```

Log out and back in, because Wayland cannot reload GNOME Shell in place. Then enable it:

```sh
gnome-extensions enable space-wallpaper@include5691.github.io
```

**Update:** `git pull && make install`, then log out and back in.

**Uninstall:**

```sh
gnome-extensions disable space-wallpaper@include5691.github.io
make uninstall
```

## Settings

```sh
gnome-extensions prefs space-wallpaper@include5691.github.io
```

| Setting | Default | Range |
| --- | --- | --- |
| Mode | single | single, pair, solar system |
| Black hole spin | 60 % | 0 – 99 |
| Comets and meteors | on | |
| First object (center of a solar system) | black hole | black hole, neutron star, star, wormhole, ringed planet, Earth |
| Second object (pair) | black hole | black hole, neutron star, star, wormhole, ringed planet, Earth |
| Planet names (solar system) | on | |
| Speed | 100 % | 0 – 400, orbits and cosmic events |
| Cosmic events | on | |
| Frame rate | 30 fps | 5 – 60 |
| Pause behind windows | on | |
| Follow cursor | on | |
| Sensitivity | 50 % | 0 – 200 |
| Smoothness | 40 % | 0 – 100 |
| Background | Milky Way | Milky Way, stars |
| Character size | 3 | 1 – 8 |
| Disk rotation speed | 100 % | 0 – 400 |
| Camera height | 8° | -30 – 60 |
| Tilt | 9° | -45 – 45 |
| Zoom | 100 % | 25 – 400 |
| Brightness | 100 % | 25 – 400 |
| Doppler effect | 40 % | 0 – 100 |

## Performance

GPU time per frame on an Intel Arc B390 with a 3120×2080 screen and the default character size:

| Scene | Time |
| --- | --- |
| One object | 0.6 – 1.8 ms |
| A pair, including events | 0.8 – 2.0 ms |
| Solar system | 1.1 – 1.4 ms |

At 30 fps that is 2 – 6 % of the GPU. The Milky Way adds about 0.3 ms.

## How it works

1. Each `Meta.BackgroundActor` gets a child actor that covers it.
2. The child shows a `Clutter.Content` shared by every background on the same monitor.
3. A timer marks the content dirty. On the next paint it renders two offscreen passes once.
4. The scene pass traces 2×2 light rays per character cell. Each ray is stepped through the bending of space around every black hole and neutron star, and the pass finds where it crosses a disk. The disks are colored with noise, heat and Doppler shift. A neutron star has a glowing surface and two pulsar beams along its tilted, spinning magnetic axis. A star's own light bending is too small to see, so rays pass it straight until they hit its surface.
5. The ASCII pass picks a character for each cell by brightness and draws it from a 5×7 bitmap font, in the cell's color.
6. Each background draws the result, with the rounded corners the overview uses.
7. While the screen is locked, the timer stops and the camera resets to the default view. The lock screen blur is turned off.

## Development

| File | Purpose |
| --- | --- |
| `extension.js` | Hooks into backgrounds, timer, settings, window cover check, lock screen |
| `renderer.js` | Offscreen passes, camera and cursor easing |
| `events.js` | Object layout, orbits, lighting, comets, pair events and the star life cycles |
| `shader.js` | Scene and ASCII GLSL shaders |
| `earthmap.js` | 256×128 land mask of the Earth |
| `prefs.js` | Preferences window |
| `schemas/` | GSettings schema |

Build a zip for extensions.gnome.org with `make pack`.

Watch the logs:

```sh
journalctl -f -o cat /usr/bin/gnome-shell
```

## Credits

The Earth's coastlines come from [Natural Earth](https://www.naturalearthdata.com/) 1:110m land, which is in the public domain.

## License

[GPL-2.0-or-later](LICENSE)
