export const SCENE_SHADER = `
uniform vec2 u_resolution;
uniform vec3 u_camera;
uniform float u_fov;
uniform vec4 u_flow;
uniform float u_time;
uniform float u_exposure;
uniform float u_doppler;
uniform vec4 u_bodies[2];
uniform vec4 u_disks[2];
uniform float u_kinds[2];
uniform float u_count;
uniform vec4 u_gw;
uniform vec4 u_burst;
uniform vec4 u_stream;
uniform vec4 u_stream_center;
uniform vec4 u_tidal;
uniform vec4 u_jets;
uniform vec4 u_kilonova;
uniform float u_flash;
uniform float u_fade;
uniform float u_beams;
uniform float u_background;
uniform vec4 u_star;
uniform float u_spins[2];
uniform vec4 u_light;
uniform vec4 u_comet;
uniform vec4 u_comet_ion;
uniform vec4 u_comet_dust;
uniform float u_meteors;
uniform sampler2D earth_map;
uniform vec3 u_light_color;
uniform vec4 u_planets[8];
uniform float u_system;
uniform vec4 u_belt;
uniform float u_distance;
uniform vec4 u_live;
uniform float u_moon_tilt;
uniform vec4 u_moons[6];
uniform float u_moon_hosts[6];
uniform vec4 u_magnetar;
uniform float u_quasar;
uniform float u_dyson;
uniform float u_crab;
uniform sampler2D galaxy_map;
uniform float u_galaxy;

const float PI = 3.14159265;
const float SPIN = 2.6;
const float HEAT_RADIUS = 3.0;
const float NEUTRON_RADIUS = 2.5;
const float NEUTRON_TILT = 0.6;
const float NEUTRON_TURNS = 96.0;
const float STAR_RADIUS = 5.0;
const float STAR_TURNS = 2.0;
const float WORMHOLE_THROAT = 2.4;
const float FRAME_DRAG = 4.0;
const float PLANET_RADIUS = 3.2;
const float PLANET_TURNS = 8.0;
const float RING_INNER = 1.35;
const float RING_OUTER = 2.3;
const vec3 PLANET_AXIS = vec3(-0.14, 0.92, 0.37);
const float EARTH_RADIUS = 3.0;
const float EARTH_TURNS = 4.0;
const float ORBIT_LINE_GAIN = 0.3;
const float ORBIT_LINE_WIDTH = 0.4;
const vec3 EARTH_AXIS = vec3(0.26, 0.94, 0.2);
const vec3 SATURN_AXIS = vec3(0.12, 0.95, 0.28);
const vec3 AURORA_COLOR = vec3(0.25, 1.0, 0.5);
const vec3 MAGNETIC_POLE = vec3(0.048, 0.987, 0.154);
const float AURORA_LATITUDE = 1.16;
const vec3 NEBULA_CENTER = vec3(-0.45, -0.2, -1.0);
const float QUASAR_JET_REACH = 90.0;
const float DYSON_PANELS = 72.0;
const float DYSON_BAND = 0.35;
const float CRAB_RADIUS = 13.0;
const float CRAB_STEP = 0.4;
const vec3 CRAB_SQUASH = vec3(1.0, 0.8, 0.72);
const vec3 CRAB_AXIS = vec3(0.0, 1.0, 0.0);
const float GALAXY_RANGE = 4.0;
const float COMET_STEP = 0.35;
const float COMET_CORE = 0.03;
const float METEOR_WIDTH = 0.00002;
const float MIN_COMET_STEP = 0.02;
const float LINGER_RADIUS = 2.4;
const float BEAM_LENGTH = 14.0;
const float BEAM_INTENSITY = 0.35;
const float GW_REACH = 45.0;
const float GW_BEND = 0.004;
const float BURST_BEND = 0.05;
const float ESCAPE_RADIUS = 120.0;
const float CRITICAL_IMPACT = 2.598;
const float TIME_PERIOD = 256.0;
const int MAX_STEPS = 300;
const float STEP_SCALE = 0.07;
const float OCTAVES = 5.0;

float square(float x) {
    return x * x;
}

float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
}

vec3 hash33(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.xxy + p.yxx) * p.zyx);
}

float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), u.x),
            mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
        mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), u.x),
            mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), u.x), u.y),
        u.z);
}

vec3 noise3v(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(mix(hash33(i), hash33(i + vec3(1.0, 0.0, 0.0)), u.x),
            mix(hash33(i + vec3(0.0, 1.0, 0.0)), hash33(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
        mix(mix(hash33(i + vec3(0.0, 0.0, 1.0)), hash33(i + vec3(1.0, 0.0, 1.0)), u.x),
            mix(hash33(i + vec3(0.0, 1.0, 1.0)), hash33(i + vec3(1.0, 1.0, 1.0)), u.x), u.y),
        u.z);
}

float fbm(vec3 p, float octaves) {
    float sum = 0.0;
    float amplitude = 0.5;
    float norm = 0.0;
    for (int i = 0; i < 6; i++) {
        if (float(i) >= octaves)
            break;
        sum += amplitude * noise3(p);
        norm += amplitude;
        p = p * 2.07 + vec3(1.7, 9.2, 4.1);
        amplitude *= 0.5;
    }
    return sum / norm;
}

vec2 diskPattern(float r, float phi, float seed) {
    vec3 offset = seed * vec3(17.13, 31.71, 11.37);
    vec2 around = vec2(cos(phi), sin(phi));
    float lr = log(r);
    vec3 shape = noise3v(vec3(around * 3.5, lr * 7.0) + offset + 5.0);
    float streaks = fbm(vec3(around * 2.4, (lr + (shape.x - 0.5) * 0.09) * 26.0) + offset, OCTAVES);
    return vec2(streaks * (0.45 + 1.1 * shape.y), shape.z);
}

vec2 diskDensity(float r, float phi) {
    float twist = SPIN * pow(HEAT_RADIUS / r, 1.5);
    vec2 a = diskPattern(r, phi + twist * u_flow.x, u_flow.y);
    vec2 b = diskPattern(r, phi + twist * u_flow.z, u_flow.w);
    float wa = 1.0 - abs(2.0 * u_flow.x - 1.0);
    float wb = 1.0 - wa;
    float density = (wa * (a.x - 0.5) + wb * (b.x - 0.5)) / sqrt(wa * wa + wb * wb) + 0.5;
    return vec2(clamp(density, 0.0, 1.0), wa * a.y + wb * b.y);
}

vec3 diskColor(float t) {
    vec3 cool = vec3(0.25, 0.055, 0.018);
    vec3 warm = vec3(1.0, 0.36, 0.10);
    vec3 hot = vec3(1.0, 0.90, 0.80);
    return t < 0.5 ? mix(cool, warm, t * 2.0) : mix(warm, hot, t * 2.0 - 1.0);
}

vec4 diskSample(vec3 p, vec3 dir, vec4 extent) {
    float inner = extent.x;
    float outer = extent.y;
    float r = length(p.xz);
    if (r < inner || r > outer)
        return vec4(0.0);

    float phi = atan(p.z, p.x);
    vec2 pattern = diskDensity(r, phi);
    float n = pattern.x;
    float edge = smoothstep(inner, inner + 0.4, r) * (1.0 - smoothstep(outer * 0.35, outer, r));
    float density = clamp(n * edge * 2.2 - 0.5, 0.0, 1.0);

    float beta = min(sqrt(0.5 / max(r - 1.0, 0.05)), 0.9);
    float gamma = inversesqrt(1.0 - beta * beta);
    vec3 velocity = vec3(p.z, 0.0, -p.x) / r;
    float doppler = 1.0 / (gamma * (1.0 - beta * dot(velocity, -dir)));
    float shift = doppler * sqrt(max(1.0 - 1.0 / r, 0.05));

    float heat = pow(HEAT_RADIUS / r, 0.7);
    vec3 color = diskColor(clamp(heat * mix(1.0, shift, u_doppler * 0.6) + 0.3 * u_quasar, 0.0, 1.0));
    color = mix(color, vec3(0.75, 0.85, 1.0) * length(color), 0.7 * u_quasar);
    float intensity = 7.0 * pow(HEAT_RADIUS / r, 2.5) * pow(shift, 4.0 * u_doppler);
    float dust = mix(1.0, 0.25, smoothstep(0.45, 0.75, pattern.y)) * mix(0.4, 1.0, smoothstep(0.2, 0.8, n));

    float alpha = 1.0 - exp(-density * (1.2 + 0.5 / max(abs(dir.y), 0.04)));
    float haze = smoothstep(inner * 1.1, inner * 2.0, r) * (1.0 - smoothstep(outer * 0.3, outer, r))
        * pow(inner / r, 1.6) * 0.025 / max(abs(dir.y), 0.1);
    float gain = extent.z;
    vec3 hazeColor = mix(vec3(1.0, 0.55, 0.28), vec3(0.6, 0.7, 1.0), u_quasar);
    return vec4((color * intensity * dust * alpha + hazeColor * haze) * gain, alpha * min(gain, 1.0));
}

vec2 cubeFace(vec3 d, out float face) {
    vec3 a = abs(d);
    if (a.x >= a.y && a.x >= a.z) {
        face = d.x > 0.0 ? 0.0 : 1.0;
        return d.yz / a.x;
    }
    if (a.y >= a.z) {
        face = d.y > 0.0 ? 2.0 : 3.0;
        return d.xz / a.y;
    }
    face = d.z > 0.0 ? 4.0 : 5.0;
    return d.xy / a.z;
}

vec3 starfield(vec2 uv, float face, vec2 du, vec2 dv, float density, float seed) {
    vec3 color = vec3(0.0);
    float det = du.x * dv.y - dv.x * du.y;
    if (abs(det) < 1e-14)
        return color;
    for (int layer = 0; layer < 3; layer++) {
        float scale = 70.0 * pow(2.0, float(layer));
        float threshold = 1.0 - 0.04 * density / pow(2.0, float(layer));
        vec2 id = floor(uv * scale);
        vec3 h = hash33(vec3(id, face * 7.0 + float(layer) * 131.0 + seed));
        if (h.z < threshold)
            continue;
        vec2 d = uv - (id + 0.5 + (h.xy - 0.5) * 0.7) / scale;
        vec2 screen = vec2(d.x * dv.y - dv.x * d.y, du.x * d.y - d.x * du.y) / det;
        float dist = length(screen) / 0.7;
        float brightness = pow((h.z - threshold) / (1.0 - threshold), 2.0) * 2.5 / pow(2.5, float(layer));
        float twinkle = 0.75 + 0.25 * sin(2.0 * PI * (u_time / TIME_PERIOD * (48.0 + floor(h.x * 96.0)) + h.y));
        vec3 tint = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.85, 0.7), h.y);
        color += tint * brightness * twinkle * exp(-dist * dist);
    }
    return color;
}

vec3 nebula(vec3 d) {
    float n = fbm(d * 2.6 + 3.0, 3.0);
    float wisps = smoothstep(0.45, 0.8, n);
    return mix(vec3(0.004, 0.005, 0.008), vec3(0.009, 0.009, 0.010), wisps) * (0.6 + 0.8 * n);
}

float gwPhase(vec3 p) {
    return 2.0 * (atan(p.z, p.x) - u_gw.y) + u_gw.z * length(p.xz);
}

float gwReach(vec3 p) {
    float r = length(p.xz);
    return exp(-p.y * p.y / pow(0.5 + 0.2 * r, 2.0)) * smoothstep(u_gw.w * 0.4, u_gw.w * 0.9, r)
        * (1.0 - smoothstep(GW_REACH * 0.6, GW_REACH, r)) / (1.0 + 0.12 * r);
}

vec4 milkyWay(vec3 d) {
    vec3 pole = normalize(vec3(0.45, 0.9, 0.08));
    vec3 center = normalize(vec3(-0.35, 0.0, -1.0) - pole * dot(vec3(-0.35, 0.0, -1.0), pole));
    float latitude = dot(d, pole);
    float longitude = atan(dot(d, cross(pole, center)), dot(d, center));
    float bulge = exp(-longitude * longitude * 1.2);
    float band = exp(-latitude * latitude / (0.008 + 0.02 * bulge));
    float clouds = fbm(d * 7.0 + 1.0, 4.0);
    float dust = smoothstep(0.42, 0.7, fbm(d * 11.0 + 7.0, 3.0)) * exp(-latitude * latitude / 0.003);
    vec3 glow = mix(vec3(0.55, 0.6, 0.8), vec3(1.0, 0.82, 0.55), bulge) * band * (0.35 + clouds) * (1.0 - 0.85 * dust) * 0.055;

    float cloud = smoothstep(0.6, 0.8, fbm(d * 2.4 + 11.0, 4.0)) * (0.25 + band);
    float hue = noise3(d * 1.7 + 3.0);
    vec3 tint = hue < 0.5
        ? mix(vec3(0.95, 0.22, 0.45), vec3(0.3, 0.8, 0.75), smoothstep(0.3, 0.5, hue))
        : mix(vec3(0.3, 0.8, 0.75), vec3(0.35, 0.45, 1.0), smoothstep(0.5, 0.7, hue));
    glow += tint * cloud * 0.05;
    return vec4(glow, band);
}

vec4 emissionNebula(vec3 d) {
    vec3 center = normalize(NEBULA_CENTER);
    float facing = dot(d, center);
    vec3 base = nebula(d);
    if (facing < 0.82)
        return vec4(base, 0.0);
    vec3 q = (d - center * facing) / facing;
    float r2 = dot(q, q);
    float shape = exp(-r2 / 0.07);
    vec3 p = d * 5.0;
    float gas = fbm(p + 2.0, 5.0);
    float wisps = fbm(p * 2.3 + gas * 1.5, 4.0);
    float body = smoothstep(0.4, 0.8, 0.55 * gas + 0.55 * wisps + 0.25 * shape);
    float dust = smoothstep(0.52, 0.72, fbm(p * 3.1 + 9.0, 4.0));
    float core = exp(-r2 / 0.01);
    vec3 glow = vec3(0.95, 0.25, 0.42) * body * shape * 0.7 + vec3(0.25, 0.8, 0.8) * core * wisps * 0.7;
    glow *= 1.0 - 0.7 * dust * smoothstep(0.1, 0.5, shape);
    glow += vec3(1.0, 0.92, 0.96) * exp(-r2 / 0.0006) * 0.5;
    return vec4(base + glow, shape * 1.5);
}

vec3 otherSky(vec3 d, vec2 du, vec2 dv) {
    vec3 galaxy = normalize(vec3(0.3, 0.15, 1.0));
    float turn = 2.0 * PI * u_time / TIME_PERIOD;
    d = d * cos(turn) + cross(galaxy, d) * sin(turn) + galaxy * dot(galaxy, d) * (1.0 - cos(turn));

    float haze = fbm(d * 3.0 + 20.0, 4.0);
    vec3 color = mix(vec3(0.05, 0.02, 0.12), vec3(0.08, 0.35, 0.4), smoothstep(0.35, 0.75, haze)) * haze * 0.6;

    float facing = dot(d, galaxy);
    if (facing > 0.0) {
        vec3 side = normalize(cross(galaxy, vec3(0.0, 1.0, 0.0)));
        vec3 top = cross(side, galaxy);
        vec2 q = vec2(dot(d, side), dot(d, top) * 1.8) / facing * 0.12;
        float r = length(q);
        float arms = pow(max(cos(2.0 * atan(q.y, q.x) - 7.0 * log(r + 0.02)), 0.0), 3.0);
        color += vec3(1.0, 0.9, 0.75) * exp(-r * r / 0.002) * 1.5;
        color += mix(vec3(0.5, 0.65, 1.0), vec3(1.0, 0.55, 0.7), smoothstep(0.1, 0.35, r))
            * arms * exp(-r / 0.2) * (0.4 + fbm(d * 30.0, 3.0)) * 0.45;
    }

    float face;
    vec2 sky = cubeFace(d, face);
    return color + starfield(sky, face, du, dv, 2.5, 57.0);
}

vec3 accel(vec3 p, vec3 v) {
    vec3 a = vec3(0.0);
    if (u_gw.x > 0.0) {
        vec2 radial = normalize(p.xz + vec2(1e-4));
        a.xz += radial * sin(gwPhase(p)) * u_gw.x * GW_BEND * gwReach(p) * 8.0;
    }
    if (u_burst.z > 0.0) {
        float r = length(p);
        float shell = (r - u_burst.x) / u_burst.y;
        a += p / max(r, 1e-3) * u_burst.z * BURST_BEND * exp(-shell * shell);
    }
    for (int i = 0; i < 2; i++) {
        if (float(i) >= u_count)
            break;
        if (abs(u_kinds[i] - 2.0) < 0.5 || u_kinds[i] > 3.5)
            continue;
        vec3 d = p - u_bodies[i].xyz;
        vec3 c = cross(d, v);
        float r2 = dot(d, d);
        float r = sqrt(r2);
        a -= 1.5 * u_bodies[i].w * dot(c, c) * d / (r2 * r2 * r);
        if (u_kinds[i] < 0.5 && u_spins[i] > 0.0) {
            vec3 n = d / r;
            vec3 spin = vec3(0.0, 0.25 * u_spins[i] * u_bodies[i].w * u_bodies[i].w, 0.0);
            a -= FRAME_DRAG * cross(v, (3.0 * dot(spin, n) * n - spin) / (r2 * r));
        }
    }
    return a;
}

float spinAngle(float index) {
    return 2.0 * PI * (u_time / TIME_PERIOD * NEUTRON_TURNS + index * 0.37);
}

vec3 magneticAxis(float index) {
    float spin = spinAngle(index);
    return vec3(sin(NEUTRON_TILT) * cos(spin), cos(NEUTRON_TILT), sin(NEUTRON_TILT) * sin(spin));
}

vec3 neutronSurface(vec3 n, vec3 view, float index) {
    float spin = spinAngle(index);
    vec3 local = vec3(n.x * cos(spin) + n.z * sin(spin), n.y, n.z * cos(spin) - n.x * sin(spin));
    float grain = fbm(local * 6.0 + index * 11.0, 3.0);
    float spot = pow(abs(dot(n, magneticAxis(index))), 10.0);
    float limb = mix(0.35, 1.0, clamp(dot(n, -view), 0.0, 1.0));
    float cracks = 1.0 - smoothstep(0.0, 0.06, abs(noise3(local * 5.0 + 3.0) - 0.5));
    return vec3(0.62, 0.78, 1.0) * (0.45 + 0.6 * grain + 3.5 * spot) * limb
        + vec3(0.9, 0.75, 1.0) * cracks * u_magnetar.y * 4.0;
}

vec3 fieldLoops(vec3 d, vec3 axis) {
    float r = length(d);
    if (r < NEUTRON_RADIUS || r > NEUTRON_RADIUS * 5.0)
        return vec3(0.0);
    float c = dot(d, axis) / r;
    float s2 = 1.0 - c * c;
    float glow = 0.0;
    for (int k = 0; k < 3; k++) {
        float gap = (r - NEUTRON_RADIUS * (1.7 + 0.9 * float(k)) * s2) / (0.05 * r);
        glow += exp(-gap * gap);
    }
    vec3 side = normalize(vec3(-axis.z, 0.0, axis.x));
    float phi = atan(dot(d, cross(axis, side)), dot(d, side));
    float lines = pow(0.5 + 0.5 * cos(phi * 6.0), 12.0);
    return vec3(0.75, 0.55, 1.0) * glow * lines * u_magnetar.x * 0.06;
}

vec3 starSurface(vec3 n, vec3 view, float index) {
    float spin = 2.0 * PI * (u_time / TIME_PERIOD * STAR_TURNS + index * 0.21);
    vec3 local = vec3(n.x * cos(spin) + n.z * sin(spin), n.y, n.z * cos(spin) - n.x * sin(spin));
    float mu = clamp(dot(n, -view), 0.0, 1.0);
    float edge = 1.0 - mu;
    float limb = 1.0 - 0.5 * edge - 0.25 * edge * edge;
    float granules = noise3(local * mix(4.0, 10.0, clamp(u_star.x, 0.0, 1.0)) + index * 5.0);
    float latitude = abs(local.y);
    float band = smoothstep(0.05, 0.2, latitude) * (1.0 - smoothstep(0.45, 0.6, latitude));
    float spots = smoothstep(0.66, 0.72, fbm(local * 6.0 + index * 9.0 + 2.0, 3.0)) * band;
    vec3 color = mix(vec3(1.0, 0.55, 0.25), vec3(1.0, 0.92, 0.75), mu);
    vec3 giant = mix(vec3(0.7, 0.12, 0.04), vec3(1.0, 0.35, 0.12), mu);
    float heat = clamp(u_star.x, 0.0, 1.0);
    vec3 surface = mix(mix(giant, color, heat), vec3(0.75, 0.85, 1.0), clamp(u_star.x - 1.0, 0.0, 1.0));
    return surface * (1.4 + 0.5 * granules) * limb * (1.0 - 0.8 * spots * heat) * max(u_star.x, 0.6);
}

vec3 spacetimeSheet(vec3 hit, vec3 dir) {
    float r = length(hit.xz);
    float view = 0.3 / max(abs(dir.y), 0.25);
    vec3 glow = vec3(0.0);
    if (u_gw.x > 0.0) {
        float crest = pow(max(cos(gwPhase(hit)), 0.0), 8.0);
        float reach = smoothstep(u_gw.w * 0.6, u_gw.w * 1.2, r) * (1.0 - smoothstep(GW_REACH * 0.6, GW_REACH, r));
        glow += vec3(0.5, 0.65, 1.0) * crest * u_gw.x * reach / (1.0 + 0.1 * r);
    }
    if (u_burst.z > 0.0) {
        float ring = (r - u_burst.x) / u_burst.y;
        glow += vec3(0.8, 0.85, 1.0) * u_burst.z * exp(-ring * ring) * 2.5;
    }
    return glow * view;
}

vec3 eventGlow(vec3 p) {
    vec3 glow = vec3(0.0);

    if (u_stream.x > 0.0) {
        vec2 q = p.xz - u_stream_center.xy;
        float r = length(q);
        if (r > u_stream_center.z && r < u_stream.w * 1.1) {
            float turn = mod(u_stream_center.w - atan(q.y, q.x), 2.0 * PI);
            for (int k = 0; k < 3; k++) {
                float spiral = u_stream.w * exp(-u_stream.y * (turn + 2.0 * PI * float(k)));
                if (spiral < u_stream_center.z)
                    break;
                float width = u_stream.z * (0.12 + 0.07 * spiral);
                float dr = (r - spiral) / width;
                float dy = p.y / width;
                float heat = sqrt(u_stream.w / spiral);
                glow += mix(vec3(1.0, 0.6, 0.3), vec3(1.0, 0.92, 0.8), clamp(heat - 1.0, 0.0, 1.0))
                    * heat * u_stream.x * exp(-dr * dr - dy * dy) * 0.35;
            }
        }
    }

    if (u_jets.w > 0.0) {
        vec3 q = p - u_jets.xyz;
        float along = abs(q.y);
        float width = mix(0.15 + 0.05 * along, 0.3 + 0.035 * along, u_quasar);
        float perp = length(q.xz) / width;
        float reach = mix(28.0, QUASAR_JET_REACH, u_quasar);
        float knots = mix(1.0, 0.5 + 1.5 * pow(0.5 + 0.5 * sin(along * 0.45 - 2.0 * PI * u_time / TIME_PERIOD * 24.0), 6.0), u_quasar);
        glow += vec3(0.6, 0.8, 1.0) * u_jets.w * exp(-perp * perp) * exp(-along / reach)
            * smoothstep(0.3, 1.5, along) * knots * mix(1.0, 0.35 / width, u_quasar) * 0.8;
    }

    if (u_kilonova.y > 0.0) {
        float r = length(p);
        bool remnant = u_kilonova.w > 0.5 && u_kilonova.w < 1.5;
        bool planetary = u_kilonova.w > 1.5;
        float width = remnant ? 0.1 * u_kilonova.x + 0.25 : 0.3 * u_kilonova.x + 0.3;
        float shell = (r - u_kilonova.x) / width;
        if (planetary) {
            vec3 axis = normalize(vec3(0.2, 0.35, 1.0));
            float equator = exp(-square(dot(p, axis) / max(r, 1e-3)) / 0.12);
            float wall = exp(-square((r - u_kilonova.x) / (0.15 * u_kilonova.x)));
            float knots = 0.6 + 0.8 * fbm(p * 1.4 + 9.0, 3.0);
            vec3 rim = vec3(1.0, 0.28, 0.35) * wall * (0.08 + 1.2 * equator) * knots;
            vec3 core = vec3(0.2, 0.85, 0.8) * exp(-square(r / (0.7 * u_kilonova.x))) * 0.35;
            glow += u_kilonova.y * (rim + core) * 0.12;
        } else if (abs(shell) < 2.5) {
            if (remnant) {
                float filaments = 3.0 * smoothstep(0.45, 0.65, fbm(p * 1.6 + 7.0, 4.0));
                vec3 gas = mix(vec3(1.0, 0.4, 0.25), vec3(0.3, 0.85, 0.75), smoothstep(0.35, 0.65, noise3(p * 0.9)));
                vec3 tint = mix(vec3(0.85, 0.9, 1.0), gas, u_kilonova.z);
                glow += tint * u_kilonova.y * exp(-shell * shell) * filaments * 0.1;
            } else {
                float clumps = 2.5 * pow(fbm(p * 1.2 + 3.0, 3.0), 2.0);
                vec3 tint = mix(vec3(0.45, 0.6, 1.0), vec3(1.0, 0.35, 0.15), u_kilonova.z);
                glow += tint * u_kilonova.y * exp(-shell * shell) * clumps * 0.12;
            }
        }
    }

    return glow;
}

vec3 lightFrom(vec3 p) {
    return u_light.w > 0.5 ? normalize(u_light.xyz - p) : u_light.xyz;
}

vec3 dysonNormal(float ring) {
    float incline = 0.25 + 0.42 * ring;
    float node = 1.1 * ring + 1.5;
    return vec3(sin(incline) * cos(node), cos(incline), sin(incline) * sin(node));
}

vec4 dysonHit(vec3 from, vec3 to, vec3 center, float scale) {
    vec3 dir = normalize(to - from);
    float best = 2.0;
    vec4 hit = vec4(0.0);
    for (int k = 0; k < 6; k++) {
        float ring = float(k);
        vec3 normal = dysonNormal(ring);
        float before = dot(from - center, normal);
        float after = dot(to - center, normal);
        if (before * after >= 0.0)
            continue;
        float t = before / (before - after);
        if (t >= best)
            continue;
        vec3 point = mix(from, to, t) - center;
        float radius = STAR_RADIUS * scale * (1.6 + 0.22 * ring);
        float r = length(point);
        if (abs(r - radius) > DYSON_BAND)
            continue;
        vec3 side = normalize(cross(normal, abs(normal.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
        float angle = atan(dot(point, cross(normal, side)), dot(point, side));
        float slot = fract(angle / (2.0 * PI) + u_time / TIME_PERIOD * (8.0 - ring)) * DYSON_PANELS;
        if (abs(fract(slot) - 0.5) > 0.34 || hash13(vec3(floor(slot), ring, 5.0)) < 0.12)
            continue;
        best = t;
        float facing = dot(dir, point / r);
        vec3 panel = facing > 0.0
            ? vec3(1.0, 0.85, 0.6) * (0.25 + 1.4 * pow(facing, 3.0))
            : vec3(0.35, 0.08, 0.03) * 0.15;
        hit = vec4(panel, 0.92);
    }
    return hit;
}

vec3 crabGlow(vec3 p) {
    float r = length(p / CRAB_SQUASH);
    if (r > CRAB_RADIUS * 1.3)
        return vec3(0.0);
    float ragged = r * (1.0 + 0.35 * (fbm(normalize(p) * 2.0 + 5.0, 3.0) - 0.5));
    float edge = 1.0 - smoothstep(CRAB_RADIUS * 0.75, CRAB_RADIUS, ragged);
    if (edge <= 0.0)
        return vec3(0.0);
    float synchrotron = exp(-r / (0.25 * CRAB_RADIUS)) * (0.5 + 0.5 * fbm(p * 0.35 + 4.0, 3.0));
    float ridge = pow(1.0 - abs(2.0 * fbm(p * 0.9 + 11.0, 3.0) - 1.0), 12.0);
    float shell = smoothstep(0.3, 0.75, ragged / CRAB_RADIUS);
    vec3 filament = mix(vec3(1.0, 0.25, 0.15), vec3(1.0, 0.8, 0.3), smoothstep(0.35, 0.65, noise3(p * 0.3 + 2.0)));
    vec3 axis = normalize(CRAB_AXIS);
    float height = dot(p, axis);
    float across = length(p - axis * height);
    float torus = exp(-square((across - 4.0) / 0.5) - square(height / 0.35));
    float ripple = pow(1.0 - abs(2.0 * fract(across * 0.4 - u_time / TIME_PERIOD * 32.0) - 1.0), 8.0);
    float wisps = exp(-square(height / 0.4)) * smoothstep(3.0, 4.5, across) * (1.0 - smoothstep(6.0, 9.0, across)) * ripple;
    float jet = exp(-square(across / (0.25 + 0.06 * abs(height)))) * smoothstep(2.0, 3.0, abs(height))
        * (1.0 - smoothstep(6.0, 11.0, abs(height)));
    return (vec3(0.4, 0.55, 1.0) * synchrotron * 0.25 + filament * ridge * shell * 0.09
        + vec3(0.7, 0.8, 1.0) * (torus * 0.4 + wisps * 0.75 + jet * 0.25)) * edge;
}

vec3 quasarHost(vec3 p) {
    float r = length(p * vec3(1.0, 2.2, 1.0));
    return vec3(1.0, 0.85, 0.65) * exp(-r / 9.0) * 0.004;
}

float ringDensity(float r) {
    float span = (r - RING_INNER) / (RING_OUTER - RING_INNER);
    if (span < 0.0 || span > 1.0)
        return 0.0;
    float ringlets = 0.55 + 0.45 * sin(span * 90.0 + 3.0 * noise3(vec3(span * 25.0, 1.0, 2.0)));
    float cassini = 1.0 - 0.95 * exp(-square((span - 0.62) / 0.03));
    float edges = smoothstep(0.0, 0.05, span) * (1.0 - smoothstep(0.9, 1.0, span));
    return ringlets * cassini * edges * mix(0.5, 1.0, span);
}

vec3 bodyFrame(vec3 n, vec3 axis, float spin) {
    vec3 side = normalize(cross(axis, vec3(0.0, 0.0, 1.0)));
    vec3 front = cross(side, axis);
    return vec3(dot(n, side) * cos(spin) + dot(n, front) * sin(spin), dot(n, axis),
        dot(n, front) * cos(spin) - dot(n, side) * sin(spin));
}

float sphereEntry(vec3 from, vec3 dir, float span, vec3 center, float radius) {
    vec3 offset = center - from;
    float closest = dot(offset, dir);
    float h2 = radius * radius - (dot(offset, offset) - closest * closest);
    if (h2 <= 0.0)
        return -1.0;
    float h = sqrt(h2);
    if (closest + h < 0.0)
        return -1.0;
    float t = max(closest - h, 0.0);
    return t <= span ? t : -1.0;
}

vec3 bandedAlbedo(vec3 local, vec3 light, vec3 dark, float storm, float seed) {
    float latitude = local.y;
    float swirl = fbm(local * vec3(2.0, 9.0, 2.0) + seed * 4.0, 4.0);
    float band = sin((latitude * 7.0 + (swirl - 0.5) * 0.9) * PI);
    vec3 color = mix(dark, light, band * 0.5 + 0.5);
    color = mix(color, dark * 0.65, smoothstep(0.55, 0.8, swirl) * 0.5);
    vec2 spot = vec2(atan(local.z, local.x) - 1.0, latitude + 0.35);
    return mix(color, vec3(0.85, 0.35, 0.22), storm * exp(-dot(spot * vec2(2.5, 9.0), spot * vec2(2.5, 9.0))));
}

float ringShadow(vec3 p, vec3 center, vec3 axis, float radius) {
    vec3 light = lightFrom(p);
    float along = dot(light, axis);
    if (abs(along) < 1e-3)
        return 1.0;
    float t = -dot(p - center, axis) / along;
    return t > 0.0 ? 1.0 - 0.75 * ringDensity(length(p + light * t - center) / radius) : 1.0;
}

vec3 planetSurface(vec3 n, vec3 p, vec3 view, vec3 center, float scale, float index) {
    vec3 axis = normalize(PLANET_AXIS);
    vec3 local = bodyFrame(n, axis, 2.0 * PI * (u_time / TIME_PERIOD * PLANET_TURNS + index * 0.3));
    vec3 color = bandedAlbedo(local, vec3(0.96, 0.88, 0.7), vec3(0.78, 0.58, 0.38), 1.0, index);
    float diffuse = max(dot(n, lightFrom(p)), 0.0) * ringShadow(p, center, axis, PLANET_RADIUS * scale);
    float rim = pow(1.0 - clamp(dot(n, -view), 0.0, 1.0), 3.0);
    return u_light_color * (color * (0.03 + 1.6 * diffuse) + vec3(0.35, 0.5, 0.8) * rim * diffuse * 0.4);
}

vec3 earthAxis(vec3 light) {
    vec3 axis = normalize(EARTH_AXIS);
    if (u_live.x < 0.5)
        return axis;
    vec3 across = axis - light * dot(axis, light);
    float size = length(across);
    return size < 1e-3 ? axis : across / size * cos(u_live.w) + light * sin(u_live.w);
}

float earthSpin(vec3 axis, vec3 light, float index) {
    if (u_live.x < 0.5)
        return -2.0 * PI * (u_time / TIME_PERIOD * EARTH_TURNS + index * 0.3);
    vec3 facing = bodyFrame(light, axis, 0.0);
    return u_live.y - atan(-facing.z, facing.x);
}

float aurora(vec3 local, float seed) {
    float longitude = atan(-local.z, local.x);
    float latitude = asin(clamp(dot(local, MAGNETIC_POLE), -1.0, 1.0));
    float drift = 2.0 * PI * u_time / TIME_PERIOD;
    float wave = 0.05 * sin(longitude * 5.0 + 14.0 * drift) + 0.02 * sin(longitude * 13.0 - 30.0 * drift);
    float oval = exp(-square((abs(latitude) - AURORA_LATITUDE - wave) / 0.06));
    float around = longitude + 9.0 * drift;
    float curtains = 0.3 + 0.9 * noise3(vec3(cos(around) * 4.0, sin(around) * 4.0, latitude * 6.0 + seed));
    return oval * curtains;
}

float eclipseBy(vec3 p, vec3 blocker, float radius) {
    vec3 light = lightFrom(p);
    vec3 toBlocker = blocker - p;
    float along = dot(toBlocker, light);
    if (along <= 0.0 || (u_light.w > 0.5 && along > length(u_light.xyz - p)))
        return 1.0;
    return mix(0.06, 1.0, smoothstep(radius * 0.6, radius * 1.3, length(toBlocker - light * along)));
}

vec3 earthSurface(vec3 n, vec3 p, vec3 view, float index, float shade, vec3 center) {
    vec3 light = lightFrom(p);
    vec3 sun = lightFrom(center);
    vec3 axis = earthAxis(sun);
    float spin = earthSpin(axis, sun, index);
    vec3 local = bodyFrame(n, axis, spin);
    float latitude = asin(clamp(local.y, -1.0, 1.0));
    float longitude = atan(-local.z, local.x);
    float land = texture2D(earth_map, vec2(longitude / (2.0 * PI) + 0.5, 0.5 - latitude / PI)).r;
    float coast = smoothstep(0.35, 0.65, land);
    float polar = abs(latitude);
    float grain = noise3(local * 14.0 + 3.0);
    vec3 ground = mix(vec3(0.22, 0.45, 0.14), vec3(0.55, 0.55, 0.28), grain);
    float dry = smoothstep(0.25, 0.4, polar) * (1.0 - smoothstep(0.5, 0.65, polar));
    ground = mix(ground, vec3(0.78, 0.64, 0.42), dry * smoothstep(0.35, 0.6, grain + 0.15));
    ground = mix(ground, vec3(0.45, 0.43, 0.38), smoothstep(0.9, 1.1, polar));
    vec3 ocean = mix(vec3(0.01, 0.04, 0.16), vec3(0.04, 0.16, 0.3), smoothstep(0.1, 0.45, land));
    float ice = max(smoothstep(1.12, 1.22, polar), smoothstep(1.0, 1.1, polar) * coast);
    vec3 albedo = mix(mix(ocean, ground, coast), vec3(0.92, 0.95, 1.0), ice);

    vec3 sky = bodyFrame(n, axis, (u_live.x > 0.5 ? spin : spin * 0.75) + 2.0 * PI * u_time / TIME_PERIOD);
    float clouds = smoothstep(0.6, 0.8, fbm(sky * vec3(3.0, 6.0, 3.0) + 7.0 + index, 4.0));
    albedo = mix(albedo, vec3(0.95), clouds * 0.7);

    float mu = dot(n, light);
    float glint = pow(max(dot(n, normalize(light - view)), 0.0), 60.0) * (1.0 - coast) * (1.0 - clouds) * (1.0 - ice);
    float night = 1.0 - smoothstep(-0.15, 0.05, mu * shade);
    float cities = coast * (1.0 - ice) * (1.0 - clouds) * pow(noise3(local * 45.0), 4.0) * 6.0;
    float rim = pow(1.0 - clamp(dot(n, -view), 0.0, 1.0), 3.0);
    float lights = aurora(local, index) * (1.0 - smoothstep(-0.2, 0.15, mu));
    return u_light_color * shade * (albedo * (0.02 + 1.5 * max(mu, 0.0)) + vec3(1.0, 0.95, 0.85) * glint * 1.5
        + vec3(0.35, 0.6, 1.0) * rim * smoothstep(-0.2, 0.4, mu) * 0.8)
        + vec3(1.0, 0.72, 0.35) * cities * night * 0.35 + AURORA_COLOR * lights * 1.6;
}

float sunlit(vec3 point, vec3 center, float radius) {
    vec3 light = lightFrom(point);
    vec3 toCenter = center - point;
    float along = dot(toCenter, light);
    return along > 0.0 && length(toCenter - light * along) < radius ? 0.0 : 1.0;
}

vec3 cratered(vec3 n, vec3 p, vec3 base, float seed) {
    float craters = 0.7 + 0.3 * noise3(n * 6.0 + seed * 3.0);
    return u_light_color * base * craters * (0.02 + 1.4 * max(dot(n, lightFrom(p)), 0.0));
}

vec3 earthMoonCenter(vec3 center, float scale) {
    float reach = EARTH_RADIUS * scale * (u_count > 1.5 ? 2.2 : 3.4);
    float angle = -2.0 * PI * (u_time / TIME_PERIOD * 3.0 + 0.2);
    if (u_live.x < 0.5)
        return center + vec3(cos(angle), 0.09 * sin(angle), sin(angle)) * reach;
    vec3 light = lightFrom(center);
    angle = atan(light.z, light.x) - 2.0 * PI * u_live.z;
    return center + vec3(cos(angle) * cos(u_moon_tilt), sin(u_moon_tilt), sin(angle) * cos(u_moon_tilt)) * reach;
}

vec4 earthMoonHit(vec3 from, vec3 to, vec3 center, float scale) {
    vec3 segment = to - from;
    float span = length(segment);
    vec3 dir = segment / span;
    float radius = EARTH_RADIUS * scale;
    vec3 moon = earthMoonCenter(center, scale);
    float t = sphereEntry(from, dir, span, moon, radius * 0.27);
    if (t < 0.0)
        return vec4(0.0);
    vec3 hit = from + dir * t;
    vec3 n = normalize(hit - moon);
    float maria = smoothstep(0.5, 0.68, fbm(n * 2.2 + 3.0, 3.0));
    vec3 base = mix(vec3(0.78, 0.76, 0.72), vec3(0.42, 0.41, 0.4), maria);
    return vec4(cratered(n, hit, base, 5.0) * sunlit(moon, center, radius), 1.0);
}

vec3 satelliteGlow(vec3 p, vec3 center, float scale) {
    float radius = EARTH_RADIUS * scale;
    vec3 q = p - center;
    if (dot(q, q) > pow(radius * 1.3, 2.0))
        return vec3(0.0);
    vec3 glow = vec3(0.0);
    float width = 0.04 * radius;
    float iss = 2.0 * PI * u_time / TIME_PERIOD * 16.0;
    vec3 station = center + (vec3(1.0, 0.0, 0.0) * cos(iss) + vec3(0.0, 0.78, 0.62) * sin(iss)) * radius * 1.07;
    float d = length(p - station) / width;
    glow += vec3(1.0, 0.95, 0.85) * exp(-d * d) * 2.5 * sunlit(station, center, radius);
    for (int k = 0; k < 10; k++) {
        float angle = 2.0 * PI * (u_time / TIME_PERIOD * 14.0 + 0.4) - 0.06 * float(k);
        vec3 craft = center + (vec3(1.0, 0.0, 0.0) * sin(angle) + vec3(0.0, 0.8, 0.6) * cos(angle)) * radius * 1.1;
        float e = length(p - craft) / (width * 0.7);
        glow += vec3(0.85, 0.9, 1.0) * exp(-e * e) * 1.2 * sunlit(craft, center, radius);
    }
    return glow * u_light_color;
}

float moonShade(vec3 p) {
    float shade = 1.0;
    for (int k = 0; k < 6; k++)
        if (u_moons[k].w > 0.0)
            shade = min(shade, eclipseBy(p, u_moons[k].xyz, u_moons[k].w));
    return shade;
}

vec4 planetAt(float index) {
    vec4 planet = vec4(0.0);
    for (int k = 0; k < 8; k++)
        if (abs(float(k) - index) < 0.5)
            planet = u_planets[k];
    return planet;
}

vec3 systemMoonSurface(float k, vec3 n, vec3 p, vec3 center) {
    float host = 0.0;
    for (int j = 0; j < 6; j++)
        if (abs(float(j) - k) < 0.5)
            host = u_moon_hosts[j];
    vec4 planet = planetAt(host);
    vec3 base = abs(host - 2.0) < 0.5 ? vec3(0.72, 0.7, 0.66) : mix(vec3(0.85, 0.75, 0.5), vec3(0.6, 0.62, 0.66), fract(k * 0.37));
    return cratered(n, p, base, k) * eclipseBy(center, planet.xyz, planet.w);
}

vec3 systemPlanetSurface(float k, vec3 n, vec3 p, vec3 view, vec3 center, float radius) {
    if (abs(k - 2.0) < 0.5)
        return earthSurface(n, p, view, 7.0, moonShade(p), center);
    vec3 axis = abs(k - 5.0) < 0.5 ? normalize(SATURN_AXIS) : vec3(0.0, 1.0, 0.0);
    vec3 local = bodyFrame(n, axis, 2.0 * PI * u_time / TIME_PERIOD * (12.0 - k));
    vec3 albedo;
    if (k < 0.5)
        albedo = vec3(0.55, 0.52, 0.5) * (0.7 + 0.3 * noise3(local * 6.0));
    else if (k < 1.5)
        albedo = mix(vec3(0.95, 0.85, 0.6), vec3(0.85, 0.7, 0.45), fbm(local * vec3(2.0, 5.0, 2.0), 3.0));
    else if (k < 3.5)
        albedo = mix(mix(vec3(0.8, 0.35, 0.15), vec3(0.45, 0.2, 0.1), smoothstep(0.5, 0.7, fbm(local * 3.0, 3.0))),
            vec3(0.95), smoothstep(0.85, 0.95, abs(local.y)));
    else if (k < 4.5)
        albedo = bandedAlbedo(local, vec3(0.93, 0.85, 0.72), vec3(0.7, 0.5, 0.35), 1.0, 11.0);
    else if (k < 5.5)
        albedo = bandedAlbedo(local, vec3(0.95, 0.88, 0.68), vec3(0.8, 0.7, 0.5), 0.0, 13.0);
    else if (k < 6.5)
        albedo = vec3(0.55, 0.85, 0.9) * (0.9 + 0.1 * local.y);
    else
        albedo = mix(vec3(0.2, 0.33, 0.9), vec3(0.35, 0.5, 1.0), 0.5 + 0.5 * sin(local.y * 12.0));
    float diffuse = max(dot(n, lightFrom(p)), 0.0) * moonShade(p);
    if (abs(k - 5.0) < 0.5)
        diffuse *= ringShadow(p, center, axis, radius);
    return u_light_color * albedo * (0.02 + 1.5 * diffuse);
}

bool planetAhead(vec3 from, vec3 to) {
    vec3 segment = to - from;
    float span = length(segment);
    for (int k = 0; k < 8; k++)
        if (sphereEntry(from, segment / span, span, u_planets[k].xyz, u_planets[k].w) >= 0.0)
            return true;
    for (int k = 0; k < 6; k++)
        if (u_moons[k].w > 0.0 && sphereEntry(from, segment / span, span, u_moons[k].xyz, u_moons[k].w) >= 0.0)
            return true;
    return false;
}

vec3 systemPlane(vec3 hit, vec3 dir) {
    float r = length(hit.xz);
    float view = 0.25 / max(abs(dir.y), 0.2);
    float lines = 0.0;
    for (int k = 0; k < 8; k++)
        lines += exp(-square((r - length(u_planets[k].xz)) / ORBIT_LINE_WIDTH));
    vec3 glow = vec3(0.4, 0.45, 0.6) * lines * ORBIT_LINE_GAIN * view;
    if (r > u_belt.x && r < u_belt.y) {
        float turns = fract(atan(hit.z, hit.x) / (2.0 * PI) + 2.0 * u_time / TIME_PERIOD);
        vec3 h = hash33(vec3(floor(turns * 377.0), floor(r * 6.0), 9.0));
        glow += vec3(0.8, 0.75, 0.65) * step(0.8, h.x) * (0.4 + h.y) * 0.5 * u_belt.z;
    }
    return glow;
}

vec4 ringSample(vec3 hit, vec3 center, float planetRadius, vec3 axis, vec3 view) {
    float r = length(hit - center) / planetRadius;
    float density = ringDensity(r);
    if (density <= 0.0)
        return vec4(0.0);
    vec3 light = lightFrom(hit);
    vec3 toCenter = center - hit;
    float along = dot(toCenter, light);
    float gap = length(toCenter - light * along);
    float shade = along > 0.0 && gap < planetRadius ? 0.08 : 1.0;
    float sunlitFace = dot(axis, light) * dot(axis, -view) >= 0.0 ? 1.0 : 0.3;
    float lit = (0.2 + 0.9 * abs(dot(axis, light))) * shade * sunlitFace;
    float alpha = density * 0.75;
    return vec4(u_light_color * vec3(0.88, 0.8, 0.66) * lit * alpha * 1.3, alpha);
}

float inPlanetShadow(vec3 point, vec3 center, float scale) {
    vec3 light = lightFrom(point);
    vec3 toCenter = center - point;
    float along = dot(toCenter, light);
    return along > 0.0 && length(toCenter - light * along) < PLANET_RADIUS * scale ? 1.0 : 0.0;
}

vec4 moonHit(vec3 from, vec3 to, vec3 center, float scale, float index) {
    vec3 axis = normalize(PLANET_AXIS);
    vec3 side = normalize(cross(axis, vec3(0.0, 0.0, 1.0)));
    vec3 front = cross(side, axis);
    vec3 segment = to - from;
    float span = length(segment);
    vec3 dir = segment / span;
    float reach = u_count > 1.5 ? 0.5 : 0.8;
    float base = u_count > 1.5 ? 1.9 : 2.7;
    float entry = 1e6;
    vec4 hit = vec4(0.0);
    for (int k = 0; k < 3; k++) {
        float fk = float(k);
        float orbit = PLANET_RADIUS * scale * (base + reach * fk);
        float speed = 7.0 - 3.0 * fk + 0.5 * fk * (fk - 1.0);
        float phase = 0.15 + 0.37 * fk - 0.015 * fk * (fk - 1.0) + index * 0.5;
        float angle = 2.0 * PI * (u_time / TIME_PERIOD * speed + phase);
        float inclination = (fk - 1.0) * 0.55 + 0.2;
        vec3 tilted = front * cos(inclination) + axis * sin(inclination);
        vec3 moon = center + (side * cos(angle) + tilted * sin(angle)) * orbit;
        float radius = PLANET_RADIUS * scale * (0.16 + 0.05 * fk);

        vec3 offset = moon - from;
        float closest = dot(offset, dir);
        float h2 = radius * radius - (dot(offset, offset) - closest * closest);
        if (h2 <= 0.0)
            continue;
        float t = max(closest - sqrt(h2), 0.0);
        if (t > span || t >= entry || closest + sqrt(h2) < 0.0)
            continue;
        entry = t;
        vec3 n = normalize(from + dir * t - moon);
        float craters = 0.7 + 0.3 * noise3(n * 6.0 + fk * 3.0);
        float diffuse = max(dot(n, lightFrom(moon)), 0.0) * (1.0 - 0.95 * inPlanetShadow(moon, center, scale));
        hit = vec4(u_light_color * vec3(0.75, 0.72, 0.68) * craters * (0.02 + 1.4 * diffuse), 1.0);
    }
    return hit;
}

float segmentDistance(vec3 q, vec3 axis, float reach) {
    return length(q - axis * clamp(dot(q, axis), 0.0, reach));
}

float cometDistance(vec3 p) {
    vec3 q = p - u_comet.xyz;
    return min(segmentDistance(q, u_comet_ion.xyz, u_comet_ion.w), segmentDistance(q, u_comet_dust.xyz, u_comet_dust.w));
}

vec3 cometGlow(vec3 p, float footprint) {
    vec3 q = p - u_comet.xyz;
    float ion = dot(q, u_comet_ion.xyz);
    float dust = dot(q, u_comet_dust.xyz);
    float dist2 = dot(q, q);
    float core = max(COMET_CORE, square(footprint));
    if (dist2 > max(1.0, 9.0 * core) && ion < 0.0 && dust < 0.0)
        return vec3(0.0);
    if (dist2 > square(max(u_comet_ion.w, u_comet_dust.w) + 1.0))
        return vec3(0.0);

    vec3 glow = vec3(0.75, 0.88, 1.0) * (exp(-dist2 / core) * 1.5 * sqrt(COMET_CORE / core) + exp(-dist2 / 0.25) * 0.08);
    if (ion > 0.0) {
        float width = max(0.1 + 0.03 * ion, footprint);
        float perp = length(q - ion * u_comet_ion.xyz) / width;
        if (perp < 3.0)
            glow += vec3(0.45, 0.65, 1.0) * exp(-perp * perp) * exp(-ion / u_comet_ion.w * 2.5) * 0.7
                * (1.0 - smoothstep(0.6 * u_comet_ion.w, u_comet_ion.w + 1.0, ion));
    }
    if (dust > 0.0) {
        float width = max(0.12 + 0.08 * dust, footprint);
        float perp = length(q - dust * u_comet_dust.xyz) / width;
        if (perp < 3.0)
            glow += vec3(1.0, 0.88, 0.65) * exp(-perp * perp) * exp(-dust / u_comet_dust.w * 2.0) * 0.35
                * (1.0 - smoothstep(0.6 * u_comet_dust.w, u_comet_dust.w + 1.0, dust));
    }
    return glow * u_comet.w;
}

vec3 meteor(vec3 d, float pitch) {
    float cycle = floor(u_time / 8.0);
    float age = u_time - cycle * 8.0;
    vec3 h = hash33(vec3(cycle, 17.0, 3.0));
    if (h.z < 0.4 || age > 0.8)
        return vec3(0.0);
    vec3 start = normalize(vec3(h.x * 1.4 - 0.7, h.y * 0.9 - 0.3, -1.0));
    vec3 motion = normalize(cross(start, normalize(vec3(h.y - 0.5, 1.0, h.x - 0.5))));
    vec3 head = normalize(start + motion * age * 0.6);
    vec3 tail = normalize(head - motion * 0.12);
    vec3 axis = head - tail;
    float t = clamp(dot(d - tail, axis) / dot(axis, axis), 0.0, 1.0);
    float dist = length(d - (tail + axis * t));
    float width2 = max(METEOR_WIDTH, square(pitch));
    return vec3(1.0, 0.95, 0.85) * exp(-dist * dist / width2) * sqrt(METEOR_WIDTH / width2) * t * (1.0 - age / 0.8) * 1.2;
}

vec3 pulsarBeam(vec3 d, vec3 axis) {
    float along = dot(d, axis);
    float span = abs(along);
    if (span < NEUTRON_RADIUS)
        return vec3(0.0);
    float width = 0.12 + 0.06 * span;
    float perp = length(d - along * axis);
    return vec3(0.55, 0.75, 1.0) * BEAM_INTENSITY * u_beams
        * exp(-perp * perp / (width * width)) * exp(-span / BEAM_LENGTH * 2.5);
}

vec4 renderPixel(vec2 st) {
    vec2 uv = (st - 0.5) * 2.0 * vec2(u_resolution.x / u_resolution.y, -1.0);

    float yaw = u_camera.x;
    float pitch = u_camera.y;
    float roll = u_camera.z;
    vec3 origin = u_distance * vec3(cos(pitch) * sin(yaw), sin(pitch), cos(pitch) * cos(yaw));
    vec3 forward = normalize(-origin);
    vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, forward);
    vec3 rolledRight = cos(roll) * right + sin(roll) * up;
    vec3 rolledUp = cos(roll) * up - sin(roll) * right;
    vec3 dir = normalize(forward + (uv.x * rolledRight + uv.y * rolledUp) * u_fov);
    float rayPitch = length(fwidth(dir));

    vec3 axes[2];
    float closest[2];
    float impact[2];
    float nearTransmittance[2];
    vec3 nearPoint[2];
    float linger[2];
    for (int i = 0; i < 2; i++) {
        axes[i] = magneticAxis(float(i));
        closest[i] = 1e6;
        impact[i] = 1e6;
        nearTransmittance[i] = 1.0;
        nearPoint[i] = vec3(0.0, 1.0, 0.0);
        linger[i] = 0.0;
    }

    vec3 pos = origin;
    vec3 vel = dir;
    vec3 a = accel(pos, vel);
    vec3 color = vec3(0.0);
    float transmittance = 1.0;
    float nearOrigin = 1e6;
    bool captured = false;
    float capturedBy = -1.0;
    bool centerInFront = false;
    bool through = false;
    vec3 portal = vec3(0.0);
    bool events = u_stream.x > 0.0 || u_jets.w > 0.0 || u_kilonova.y > 0.0;
    bool comet = u_comet.w > 0.0;
    bool sheet = u_gw.x > 0.0 || u_burst.z > 0.0;

    for (int n = 0; n < MAX_STEPS; n++) {
        float nearest = 1e6;
        for (int i = 0; i < 2; i++) {
            if (float(i) >= u_count)
                break;
            nearest = min(nearest, length(pos - u_bodies[i].xyz));
        }
        float dt = max(STEP_SCALE * nearest * max(1.0, length(pos) / 25.0), 0.02);
        if (comet)
            dt = min(dt, max(MIN_COMET_STEP, COMET_STEP * cometDistance(pos)));
        if (u_crab > 0.5 && dot(pos, pos) < square(CRAB_RADIUS * 1.2))
            dt = min(dt, CRAB_STEP);

        for (int i = 0; i < 2; i++) {
            if (float(i) >= u_count)
                break;
            vec3 d = (pos - u_bodies[i].xyz) / u_bodies[i].w;
            if (u_kinds[i] < 0.5 && dot(d, d) < LINGER_RADIUS * LINGER_RADIUS)
                linger[i] += dt / u_bodies[i].w;
            if (u_kinds[i] > 4.5)
                color += transmittance * satelliteGlow(pos, u_bodies[i].xyz, u_bodies[i].w) * dt;
            if (abs(u_kinds[i] - 1.0) < 0.5 && dot(d, d) < BEAM_LENGTH * BEAM_LENGTH)
                color += transmittance * pulsarBeam(d, axes[i]) * dt / u_bodies[i].w;
            if (abs(u_kinds[i] - 1.0) < 0.5 && u_magnetar.x > 0.0)
                color += transmittance * fieldLoops(d, axes[i]) * dt / u_bodies[i].w;
        }
        if (u_quasar > 0.5)
            color += transmittance * quasarHost(pos) * dt;
        if (u_crab > 0.5)
            color += transmittance * crabGlow(pos) * dt;
        if (events)
            color += transmittance * eventGlow(pos) * dt;
        if (comet)
            color += transmittance * cometGlow(pos, rayPitch * length(pos - origin)) * dt;

        vec3 halfVel = vel + a * (0.5 * dt);
        vec3 next = pos + halfVel * dt;
        vec3 nextA = accel(next, halfVel);
        vel = halfVel + nextA * (0.5 * dt);
        a = nextA;

        if (u_dyson > 0.5) {
            vec4 panel = dysonHit(pos, next, u_bodies[0].xyz, u_bodies[0].w);
            color += transmittance * panel.rgb * panel.a;
            transmittance *= 1.0 - panel.a;
        }

        if (pos.y * next.y < 0.0) {
            vec3 hit = mix(pos, next, pos.y / (pos.y - next.y));
            vec3 hitDir = normalize(vel);
            for (int i = 0; i < 2; i++) {
                if (float(i) >= u_count)
                    break;
                vec4 disk = diskSample((hit - u_bodies[i].xyz) / u_bodies[i].w, hitDir, u_disks[i]);
                color += transmittance * disk.rgb;
                transmittance *= 1.0 - disk.a;
            }
            if (sheet)
                color += transmittance * spacetimeSheet(hit, hitDir);
            if (u_system > 0.5 && !planetAhead(pos, hit))
                color += transmittance * systemPlane(hit, hitDir);
        }

        for (int i = 0; i < 2; i++) {
            if (float(i) >= u_count)
                break;
            if (u_kinds[i] > 4.5) {
                vec4 earthMoon = earthMoonHit(pos, next, u_bodies[i].xyz, u_bodies[i].w);
                if (earthMoon.a > 0.0 && !captured) {
                    color += transmittance * earthMoon.rgb;
                    captured = true;
                    capturedBy = float(i);
                }
                continue;
            }
            if (u_kinds[i] < 3.5)
                continue;
            vec3 center = u_bodies[i].xyz;
            vec3 axis = normalize(PLANET_AXIS);
            float before = dot(pos - center, axis);
            float after = dot(next - center, axis);
            if (before * after < 0.0) {
                vec4 ring = ringSample(mix(pos, next, before / (before - after)), center,
                    PLANET_RADIUS * u_bodies[i].w, axis, normalize(vel));
                color += transmittance * ring.rgb;
                transmittance *= 1.0 - ring.a;
            }
            vec4 moon = moonHit(pos, next, center, u_bodies[i].w, float(i));
            if (moon.a > 0.0 && !captured) {
                color += transmittance * moon.rgb;
                captured = true;
                capturedBy = float(i);
            }
        }

        if (u_system > 0.5 && !captured && (min(abs(pos.y), abs(next.y)) < 3.5 || pos.y * next.y < 0.0)) {
            vec3 segment = next - pos;
            float span = length(segment);
            vec3 sdir = segment / span;
            vec3 saturn = u_planets[5].xyz;
            vec3 ringAxis = normalize(SATURN_AXIS);
            float before = dot(pos - saturn, ringAxis);
            float after = dot(next - saturn, ringAxis);
            if (before * after < 0.0) {
                vec4 ring = ringSample(mix(pos, next, before / (before - after)), saturn, u_planets[5].w, ringAxis, sdir);
                color += transmittance * ring.rgb;
                transmittance *= 1.0 - ring.a;
            }
            float best = 1e6;
            float hitPlanet = -1.0;
            for (int k = 0; k < 8; k++) {
                float t = sphereEntry(pos, sdir, span, u_planets[k].xyz, u_planets[k].w);
                if (t >= 0.0 && t < best) {
                    best = t;
                    hitPlanet = float(k);
                }
            }
            float hitMoon = -1.0;
            for (int k = 0; k < 6; k++) {
                if (u_moons[k].w <= 0.0)
                    continue;
                float t = sphereEntry(pos, sdir, span, u_moons[k].xyz, u_moons[k].w);
                if (t >= 0.0 && t < best) {
                    best = t;
                    hitMoon = float(k);
                }
            }
            if (hitMoon >= 0.0) {
                for (int k = 0; k < 6; k++) {
                    if (abs(float(k) - hitMoon) > 0.5)
                        continue;
                    vec3 hitPoint = pos + sdir * best;
                    color += transmittance * systemMoonSurface(hitMoon, normalize(hitPoint - u_moons[k].xyz), hitPoint, u_moons[k].xyz);
                }
                captured = true;
                capturedBy = 20.0 + hitMoon;
                centerInFront = dot(pos - u_bodies[0].xyz, sdir) > 0.0;
            } else if (hitPlanet >= 0.0) {
                for (int k = 0; k < 8; k++) {
                    if (abs(float(k) - hitPlanet) > 0.5)
                        continue;
                    vec3 hitPoint = pos + sdir * best;
                    vec3 n = normalize(hitPoint - u_planets[k].xyz);
                    color += transmittance * systemPlanetSurface(hitPlanet, n, hitPoint, sdir, u_planets[k].xyz, u_planets[k].w);
                }
                captured = true;
                capturedBy = 10.0 + hitPlanet;
                centerInFront = dot(pos - u_bodies[0].xyz, sdir) > 0.0;
            }
        }

        pos = next;
        nearOrigin = min(nearOrigin, length(pos));
        for (int i = 0; i < 2; i++) {
            if (float(i) >= u_count)
                break;
            vec3 d = pos - u_bodies[i].xyz;
            if (abs(float(i) - u_tidal.w) < 0.5) {
                vec3 axis = vec3(u_tidal.y, 0.0, u_tidal.z);
                d += axis * dot(d, axis) * (1.0 / u_tidal.x - 1.0);
            }
            float r = length(d);
            if (r < closest[i]) {
                closest[i] = r;
                nearPoint[i] = d;
                impact[i] = length(cross(d, vel));
                nearTransmittance[i] = transmittance;
            }
            if (u_kinds[i] < 0.5 && r < u_bodies[i].w * 0.5 * (1.0 + sqrt(1.0 - u_spins[i] * u_spins[i]))) {
                captured = true;
                capturedBy = float(i);
            } else if (abs(u_kinds[i] - 1.0) < 0.5 && r < NEUTRON_RADIUS * u_bodies[i].w) {
                color += transmittance * neutronSurface(d / r, normalize(vel), float(i));
                captured = true;
                capturedBy = float(i);
            } else if (abs(u_kinds[i] - 2.0) < 0.5 && r < STAR_RADIUS * u_bodies[i].w) {
                color += transmittance * starSurface(d / r, normalize(vel), float(i));
                captured = true;
                capturedBy = float(i);
            } else if (u_kinds[i] > 4.5 && r < EARTH_RADIUS * u_bodies[i].w) {
                float shade = eclipseBy(pos, earthMoonCenter(u_bodies[i].xyz, u_bodies[i].w), EARTH_RADIUS * u_bodies[i].w * 0.27);
                color += transmittance * earthSurface(d / r, pos, normalize(vel), float(i), shade, u_bodies[i].xyz);
                captured = true;
                capturedBy = float(i);
            } else if (abs(u_kinds[i] - 4.0) < 0.5 && r < PLANET_RADIUS * u_bodies[i].w) {
                color += transmittance * planetSurface(d / r, pos, normalize(vel), u_bodies[i].xyz, u_bodies[i].w, float(i));
                captured = true;
                capturedBy = float(i);
            } else if (abs(u_kinds[i] - 3.0) < 0.5 && r < WORMHOLE_THROAT * u_bodies[i].w) {
                portal = reflect(normalize(vel), d / r);
                through = true;
                captured = true;
                capturedBy = float(i);
            }
        }

        if (captured || transmittance < 0.01)
            break;
        if (dot(pos, pos) > ESCAPE_RADIUS * ESCAPE_RADIUS && dot(pos, vel) > 0.0)
            break;
    }

    float face;
    vec3 escape = normalize(vel);
    vec2 sky = cubeFace(escape, face);
    vec2 du = dFdx(sky);
    vec2 dv = dFdy(sky);
    if (through) {
        color += transmittance * otherSky(portal, du, dv);
    } else if (!captured) {
        vec4 galaxy = u_background > 1.5 ? emissionNebula(escape) : u_background > 0.5 ? milkyWay(escape) : vec4(nebula(escape), 0.0);
        color += transmittance * (galaxy.rgb + starfield(sky, face, du, dv, 1.0 + 4.0 * galaxy.a, 0.0));
        if (u_meteors > 0.5)
            color += transmittance * meteor(escape, rayPitch);
    }

    for (int i = 0; i < 2; i++) {
        if (float(i) >= u_count)
            break;
        float scale = u_bodies[i].w;
        if (captured && abs(capturedBy - float(i)) > 0.5 && !(capturedBy > 9.5 && centerInFront))
            continue;
        if (u_kinds[i] < 0.5) {
            float offset = impact[i] / scale - CRITICAL_IMPACT;
            float ring = offset > 0.0 ? exp(-offset * 40.0) + exp(-offset * 8.0) * 0.08 : exp(offset * 120.0);
            ring = mix(ring, smoothstep(3.0, 5.5, linger[i]), smoothstep(0.0, 0.15, u_spins[i]));
            color += nearTransmittance[i] * vec3(1.0, 0.84, 0.66) * ring * 1.4;
        } else if (abs(u_kinds[i] - 1.0) < 0.5 && closest[i] > NEUTRON_RADIUS * scale) {
            float halo = exp(-(closest[i] / (NEUTRON_RADIUS * scale) - 1.0) * 6.0);
            color += nearTransmittance[i] * vec3(0.55, 0.72, 1.0) * halo * 0.3;
        } else if (u_kinds[i] > 4.5 && closest[i] > EARTH_RADIUS * scale) {
            vec3 limb = normalize(nearPoint[i]);
            float air = exp(-(closest[i] / (EARTH_RADIUS * scale) - 1.0) * 30.0)
                * smoothstep(-0.25, 0.35, dot(limb, lightFrom(u_bodies[i].xyz + nearPoint[i])));
            color += nearTransmittance[i] * u_light_color * vec3(0.35, 0.6, 1.0) * air * 0.35;
            vec3 sun = lightFrom(u_bodies[i].xyz);
            vec3 axis = earthAxis(sun);
            float height = closest[i] / (EARTH_RADIUS * scale) - 1.0;
            float curtain = aurora(bodyFrame(limb, axis, earthSpin(axis, sun, float(i))), float(i)) * exp(-height * 25.0)
                * (1.0 - smoothstep(-0.2, 0.2, dot(limb, lightFrom(u_bodies[i].xyz + nearPoint[i]))));
            color += nearTransmittance[i] * AURORA_COLOR * curtain * 0.9;
        } else if (abs(u_kinds[i] - 3.0) < 0.5 && closest[i] > WORMHOLE_THROAT * scale) {
            float rim = exp(-(closest[i] / (WORMHOLE_THROAT * scale) - 1.0) * 12.0);
            color += nearTransmittance[i] * vec3(0.6, 0.75, 1.0) * rim * 0.8;
        } else if (abs(u_kinds[i] - 2.0) < 0.5 && closest[i] > STAR_RADIUS * scale) {
            float corona = exp(-(closest[i] / (STAR_RADIUS * scale) - 1.0) * 7.0);
            color += nearTransmittance[i] * vec3(1.0, 0.75, 0.45) * corona * 0.5;
        }
    }

    if (u_galaxy > 0.5) {
        vec3 stars = texture2D(galaxy_map, st).rgb;
        color += stars * stars * GALAXY_RANGE;
    }
    color += u_flash * exp(-nearOrigin / 2.0) * vec3(1.0, 0.95, 0.9) * 1.5;
    color *= u_fade;
    color = vec3(1.0) - exp(-color * u_exposure);
    color = pow(color, vec3(1.0 / 2.2));
    color += (hash13(vec3(st * u_resolution, 7.0)) - 0.5) / 255.0;
    return vec4(color, 1.0);
}
`;

export const ASCII_SHADER = `
uniform sampler2D scene;
uniform vec2 u_output;
uniform vec2 u_cells;
uniform vec2 u_origin;
uniform float u_font;

const vec2 CELL = vec2(6.0, 9.0);
const float LEVELS = 10.0;
const float BLACK_POINT = 0.12;

uniform vec4 u_labels[8];
uniform vec4 u_label_text[16];

vec2 letterBits(float code) {
    if (code < 1.5)
        return vec2(1033774.0, 17969.0);
    if (code < 2.5)
        return vec2(34350.0, 14881.0);
    if (code < 3.5)
        return vec2(492607.0, 31777.0);
    if (code < 4.5)
        return vec2(1033777.0, 17969.0);
    if (code < 5.5)
        return vec2(135310.0, 14468.0);
    if (code < 6.5)
        return vec2(270620.0, 6440.0);
    if (code < 7.5)
        return vec2(710513.0, 17969.0);
    if (code < 8.5)
        return vec2(841329.0, 17969.0);
    if (code < 9.5)
        return vec2(509487.0, 1057.0);
    if (code < 10.5)
        return vec2(509487.0, 17701.0);
    if (code < 11.5)
        return vec2(459838.0, 15888.0);
    if (code < 12.5)
        return vec2(135327.0, 4228.0);
    if (code < 13.5)
        return vec2(575025.0, 14897.0);
    if (code < 14.5)
        return vec2(575025.0, 4433.0);
    return vec2(141873.0, 4228.0);
}

float labelCode(float label, float slot) {
    float code = 0.0;
    for (int j = 0; j < 16; j++) {
        if (abs(float(j) - (label * 2.0 + floor(slot / 4.0))) > 0.5)
            continue;
        vec4 codes = u_label_text[j];
        float lane = mod(slot, 4.0);
        code = lane < 0.5 ? codes.x : lane < 1.5 ? codes.y : lane < 2.5 ? codes.z : codes.w;
    }
    return code;
}

vec2 glyphBits(float level) {
    if (level < 0.5)
        return vec2(0.0, 0.0);
    if (level < 1.5)
        return vec2(0.0, 4096.0);
    if (level < 2.5)
        return vec2(4096.0, 128.0);
    if (level < 3.5)
        return vec2(458752.0, 0.0);
    if (level < 4.5)
        return vec2(1020032.0, 132.0);
    if (level < 5.5)
        return vec2(31744.0, 31.0);
    if (level < 6.5)
        return vec2(480384.0, 149.0);
    if (level < 7.5)
        return vec2(139875.0, 25378.0);
    if (level < 8.5)
        return vec2(359754.0, 10591.0);
    return vec2(718382.0, 30781.0);
}

float bitmapPixel(vec2 bits, vec2 p) {
    if (p.x < 0.0 || p.x > 4.0 || p.y < 0.0 || p.y > 6.0)
        return 0.0;
    float top = step(p.y, 3.0);
    float value = mix(bits.y, bits.x, top);
    float index = (p.y - 4.0 * (1.0 - top)) * 5.0 + p.x;
    return mod(floor(value / exp2(index)), 2.0);
}

vec4 asciiPixel(vec2 st) {
    vec2 p = st * u_output + u_origin;
    vec2 cellSize = CELL * u_font;
    vec2 cell = floor(p / cellSize);
    vec2 local = floor((p - cell * cellSize) / u_font) - vec2(0.0, 1.0);
    for (int i = 0; i < 8; i++) {
        vec4 label = u_labels[i];
        if (label.w > 0.0 && abs(cell.y - label.y) < 0.5 && cell.x >= label.x && cell.x < label.x + label.z) {
            float code = labelCode(float(i), cell.x - label.x);
            if (code > 0.5)
                return vec4(vec3(0.75, 0.82, 0.95) * label.w * bitmapPixel(letterBits(code), local), 1.0);
        }
    }
    vec3 color = texture2D(scene, (cell + 0.5) / u_cells).rgb;
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float value = pow(clamp((luma - BLACK_POINT) / (1.0 - BLACK_POINT), 0.0, 1.0), 0.85);
    float level = floor(min(value, 0.999) * LEVELS);
    vec3 tint = color / max(max(color.r, color.g), max(color.b, 0.02));
    return vec4(tint * mix(0.55, 1.0, value) * bitmapPixel(glyphBits(level), local), 1.0);
}
`;
