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

const float PI = 3.14159265;
const float DISTANCE = 22.0;
const float SPIN = 2.6;
const float HEAT_RADIUS = 3.0;
const float NEUTRON_RADIUS = 2.5;
const float NEUTRON_TILT = 0.6;
const float NEUTRON_TURNS = 96.0;
const float STAR_RADIUS = 5.0;
const float STAR_TURNS = 2.0;
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

    float beta = sqrt(0.5 / (r - 1.0));
    float gamma = inversesqrt(1.0 - beta * beta);
    vec3 velocity = vec3(p.z, 0.0, -p.x) / r;
    float doppler = 1.0 / (gamma * (1.0 - beta * dot(velocity, -dir)));
    float shift = doppler * sqrt(1.0 - 1.0 / r);

    float heat = pow(HEAT_RADIUS / r, 0.7);
    vec3 color = diskColor(clamp(heat * mix(1.0, shift, u_doppler * 0.6), 0.0, 1.0));
    float intensity = 7.0 * pow(HEAT_RADIUS / r, 2.5) * pow(shift, 4.0 * u_doppler);
    float dust = mix(1.0, 0.25, smoothstep(0.45, 0.75, pattern.y)) * mix(0.4, 1.0, smoothstep(0.2, 0.8, n));

    float alpha = 1.0 - exp(-density * (1.2 + 0.5 / max(abs(dir.y), 0.04)));
    float haze = smoothstep(inner * 1.1, inner * 2.0, r) * (1.0 - smoothstep(outer * 0.3, outer, r))
        * pow(inner / r, 1.6) * 0.025 / max(abs(dir.y), 0.1);
    float gain = extent.z;
    return vec4((color * intensity * dust * alpha + vec3(1.0, 0.55, 0.28) * haze) * gain, alpha * min(gain, 1.0));
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

vec3 starfield(vec2 uv, float face, vec2 du, vec2 dv) {
    vec3 color = vec3(0.0);
    float det = du.x * dv.y - dv.x * du.y;
    if (abs(det) < 1e-14)
        return color;
    for (int layer = 0; layer < 3; layer++) {
        float scale = 70.0 * pow(2.0, float(layer));
        float threshold = 1.0 - 0.04 / pow(2.0, float(layer));
        vec2 id = floor(uv * scale);
        vec3 h = hash33(vec3(id, face * 7.0 + float(layer) * 131.0));
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
        if (u_kinds[i] > 1.5)
            continue;
        vec3 d = p - u_bodies[i].xyz;
        vec3 c = cross(d, v);
        float r2 = dot(d, d);
        a -= 1.5 * u_bodies[i].w * dot(c, c) * d / (r2 * r2 * sqrt(r2));
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
    return vec3(0.62, 0.78, 1.0) * (0.45 + 0.6 * grain + 3.5 * spot) * limb;
}

vec3 starSurface(vec3 n, vec3 view, float index) {
    float spin = 2.0 * PI * (u_time / TIME_PERIOD * STAR_TURNS + index * 0.21);
    vec3 local = vec3(n.x * cos(spin) + n.z * sin(spin), n.y, n.z * cos(spin) - n.x * sin(spin));
    float mu = clamp(dot(n, -view), 0.0, 1.0);
    float edge = 1.0 - mu;
    float limb = 1.0 - 0.5 * edge - 0.25 * edge * edge;
    float granules = noise3(local * 10.0 + index * 5.0);
    float latitude = abs(local.y);
    float band = smoothstep(0.05, 0.2, latitude) * (1.0 - smoothstep(0.45, 0.6, latitude));
    float spots = smoothstep(0.66, 0.72, fbm(local * 6.0 + index * 9.0 + 2.0, 3.0)) * band;
    vec3 color = mix(vec3(1.0, 0.55, 0.25), vec3(1.0, 0.92, 0.75), mu);
    return color * (1.4 + 0.35 * granules) * limb * (1.0 - 0.8 * spots);
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
        float width = 0.15 + 0.05 * along;
        float perp = length(q.xz) / width;
        glow += vec3(0.6, 0.8, 1.0) * u_jets.w * exp(-perp * perp) * exp(-along / 28.0)
            * smoothstep(0.3, 1.5, along) * 0.8;
    }

    if (u_kilonova.y > 0.0) {
        float r = length(p);
        float width = 0.3 * u_kilonova.x + 0.3;
        float shell = (r - u_kilonova.x) / width;
        if (abs(shell) < 2.5) {
            float clumps = 2.5 * pow(fbm(p * 1.2 + 3.0, 3.0), 2.0);
            vec3 tint = mix(vec3(0.45, 0.6, 1.0), vec3(1.0, 0.35, 0.15), u_kilonova.z);
            glow += tint * u_kilonova.y * exp(-shell * shell) * clumps * 0.12;
        }
    }

    return glow;
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
    vec3 origin = DISTANCE * vec3(cos(pitch) * sin(yaw), sin(pitch), cos(pitch) * cos(yaw));
    vec3 forward = normalize(-origin);
    vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, forward);
    vec3 rolledRight = cos(roll) * right + sin(roll) * up;
    vec3 rolledUp = cos(roll) * up - sin(roll) * right;
    vec3 dir = normalize(forward + (uv.x * rolledRight + uv.y * rolledUp) * u_fov);

    vec3 axes[2];
    float closest[2];
    float impact[2];
    float nearTransmittance[2];
    for (int i = 0; i < 2; i++) {
        axes[i] = magneticAxis(float(i));
        closest[i] = 1e6;
        impact[i] = 1e6;
        nearTransmittance[i] = 1.0;
    }

    vec3 pos = origin;
    vec3 vel = dir;
    vec3 a = accel(pos, vel);
    vec3 color = vec3(0.0);
    float transmittance = 1.0;
    float nearOrigin = 1e6;
    bool captured = false;
    bool events = u_stream.x > 0.0 || u_jets.w > 0.0 || u_kilonova.y > 0.0;
    bool sheet = u_gw.x > 0.0 || u_burst.z > 0.0;

    for (int n = 0; n < MAX_STEPS; n++) {
        float nearest = 1e6;
        for (int i = 0; i < 2; i++) {
            if (float(i) >= u_count)
                break;
            nearest = min(nearest, length(pos - u_bodies[i].xyz));
        }
        float dt = max(STEP_SCALE * nearest * max(1.0, length(pos) / 25.0), 0.02);

        for (int i = 0; i < 2; i++) {
            if (float(i) >= u_count)
                break;
            vec3 d = (pos - u_bodies[i].xyz) / u_bodies[i].w;
            if (abs(u_kinds[i] - 1.0) < 0.5 && dot(d, d) < BEAM_LENGTH * BEAM_LENGTH)
                color += transmittance * pulsarBeam(d, axes[i]) * dt / u_bodies[i].w;
        }
        if (events)
            color += transmittance * eventGlow(pos) * dt;

        vec3 halfVel = vel + a * (0.5 * dt);
        vec3 next = pos + halfVel * dt;
        vec3 nextA = accel(next, halfVel);
        vel = halfVel + nextA * (0.5 * dt);
        a = nextA;

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
                impact[i] = length(cross(d, vel));
                nearTransmittance[i] = transmittance;
            }
            if (u_kinds[i] < 0.5 && r < u_bodies[i].w) {
                captured = true;
            } else if (abs(u_kinds[i] - 1.0) < 0.5 && r < NEUTRON_RADIUS * u_bodies[i].w) {
                color += transmittance * neutronSurface(d / r, normalize(vel), float(i));
                captured = true;
            } else if (u_kinds[i] > 1.5 && r < STAR_RADIUS * u_bodies[i].w) {
                color += transmittance * starSurface(d / r, normalize(vel), float(i));
                captured = true;
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
    if (!captured)
        color += transmittance * (nebula(escape) + starfield(sky, face, du, dv));

    for (int i = 0; i < 2; i++) {
        if (float(i) >= u_count)
            break;
        float scale = u_bodies[i].w;
        if (u_kinds[i] < 0.5) {
            float offset = impact[i] / scale - CRITICAL_IMPACT;
            float ring = offset > 0.0 ? exp(-offset * 40.0) + exp(-offset * 8.0) * 0.08 : exp(offset * 120.0);
            color += nearTransmittance[i] * vec3(1.0, 0.84, 0.66) * ring * 1.4;
        } else if (u_kinds[i] < 1.5 && closest[i] > NEUTRON_RADIUS * scale) {
            float halo = exp(-(closest[i] / (NEUTRON_RADIUS * scale) - 1.0) * 6.0);
            color += nearTransmittance[i] * vec3(0.55, 0.72, 1.0) * halo * 0.3;
        } else if (u_kinds[i] > 1.5 && closest[i] > STAR_RADIUS * scale) {
            float corona = exp(-(closest[i] / (STAR_RADIUS * scale) - 1.0) * 7.0);
            color += nearTransmittance[i] * vec3(1.0, 0.75, 0.45) * corona * 0.5;
        }
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

float glyphPixel(float level, vec2 p) {
    if (p.x < 0.0 || p.x > 4.0 || p.y < 0.0 || p.y > 6.0)
        return 0.0;
    vec2 bits = glyphBits(level);
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
    vec3 color = texture2D(scene, (cell + 0.5) / u_cells).rgb;
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float value = pow(clamp((luma - BLACK_POINT) / (1.0 - BLACK_POINT), 0.0, 1.0), 0.85);
    float level = floor(min(value, 0.999) * LEVELS);
    vec3 tint = color / max(max(color.r, color.g), max(color.b, 0.02));
    return vec4(tint * mix(0.55, 1.0, value) * glyphPixel(level, local), 1.0);
}
`;
