export const SHADER = `
uniform vec2 u_resolution;
uniform vec3 u_camera;
uniform float u_fov;
uniform vec4 u_flow;
uniform float u_time;
uniform float u_exposure;
uniform float u_doppler;
uniform float u_step;
uniform float u_octaves;

const float PI = 3.14159265;
const float DISTANCE = 22.0;
const float SPIN = 2.6;
const float DISK_INNER = 2.1;
const float HEAT_RADIUS = 3.0;
const float DISK_OUTER = 17.0;
const float ESCAPE_RADIUS = 120.0;
const float CRITICAL_IMPACT = 2.598;
const float TIME_PERIOD = 256.0;
const int MAX_STEPS = 300;

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
    float streaks = fbm(vec3(around * 2.4, (lr + (shape.x - 0.5) * 0.09) * 26.0) + offset, u_octaves);
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

vec4 diskSample(vec3 p, vec3 dir) {
    float r = length(p.xz);
    if (r < DISK_INNER || r > DISK_OUTER)
        return vec4(0.0);

    float phi = atan(p.z, p.x);
    vec2 pattern = diskDensity(r, phi);
    float n = pattern.x;
    float edge = smoothstep(DISK_INNER, DISK_INNER + 0.4, r) * (1.0 - smoothstep(DISK_OUTER * 0.35, DISK_OUTER, r));
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
    float haze = smoothstep(DISK_INNER * 1.1, DISK_INNER * 2.0, r) * (1.0 - smoothstep(DISK_OUTER * 0.3, DISK_OUTER, r))
        * pow(DISK_INNER / r, 1.6) * 0.025 / max(abs(dir.y), 0.1);
    return vec4(color * intensity * dust * alpha + vec3(1.0, 0.55, 0.28) * haze, alpha);
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

vec3 accel(vec3 p, float h2) {
    float r2 = dot(p, p);
    return -1.5 * h2 * p / (r2 * r2 * sqrt(r2));
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

    vec3 pos = origin;
    vec3 vel = dir;
    vec3 c = cross(pos, vel);
    float h2 = dot(c, c);
    vec3 a = accel(pos, h2);

    vec3 color = vec3(0.0);
    float transmittance = 1.0;
    float ringTransmittance = 1.0;
    float closest = 1e6;
    bool captured = false;

    for (int i = 0; i < MAX_STEPS; i++) {
        float r = length(pos);
        float dt = max(u_step * r * max(1.0, r / 25.0), 0.03);

        vec3 halfVel = vel + a * (0.5 * dt);
        vec3 next = pos + halfVel * dt;
        vec3 nextA = accel(next, h2);
        vel = halfVel + nextA * (0.5 * dt);
        a = nextA;

        if (pos.y * next.y < 0.0) {
            vec3 hit = mix(pos, next, pos.y / (pos.y - next.y));
            vec4 disk = diskSample(hit, normalize(vel));
            color += transmittance * disk.rgb;
            transmittance *= 1.0 - disk.a;
        }

        pos = next;
        float r2 = dot(pos, pos);
        if (r2 < closest) {
            closest = r2;
            ringTransmittance = transmittance;
        }

        if (r2 < 1.0) {
            captured = true;
            break;
        }
        if (transmittance < 0.01)
            break;
        if (r2 > ESCAPE_RADIUS * ESCAPE_RADIUS && dot(pos, vel) > 0.0)
            break;
    }

    float face;
    vec3 escape = normalize(vel);
    vec2 sky = cubeFace(escape, face);
    vec2 du = dFdx(sky);
    vec2 dv = dFdy(sky);
    if (!captured)
        color += transmittance * (nebula(escape) + starfield(sky, face, du, dv));

    float offset = sqrt(h2) - CRITICAL_IMPACT;
    float ring = offset > 0.0 ? exp(-offset * 40.0) + exp(-offset * 8.0) * 0.08 : exp(offset * 120.0);
    color += ringTransmittance * vec3(1.0, 0.84, 0.66) * ring * 1.4;

    color = vec3(1.0) - exp(-color * u_exposure);
    color = pow(color, vec3(1.0 / 2.2));
    color += (hash13(vec3(st * u_resolution, 7.0)) - 0.5) / 255.0;
    return vec4(color, 1.0);
}
`;
