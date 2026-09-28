const J2000 = Date.UTC(2000, 0, 1, 12);
const DAY = 86400000;
const OBLIQUITY = 23.439;
const SYNODIC_ELONGATION = [297.8501921, 12.19074912];
const MOON_LATITUDE = [5.128, 93.272, 13.22935];
const ORBITS = [
    [252.25084, 4.09233445, 0.2056, 77.456],
    [181.97973, 1.60213034, 0.0068, 131.603],
    [100.46435, 0.98560910, 0.0167, 102.937],
    [355.45332, 0.52403304, 0.0934, 336.056],
    [34.40438, 0.08308676, 0.0484, 14.728],
    [49.94432, 0.03346063, 0.0539, 92.599],
    [313.23218, 0.01173129, 0.0473, 170.954],
    [304.88003, 0.00598106, 0.0086, 44.965],
];

const radians = degrees => degrees * Math.PI / 180;
const wrap = angle => angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI));

export function skyAt(milliseconds) {
    const days = (milliseconds - J2000) / DAY;
    const anomaly = radians(357.528 + 0.9856003 * days);
    const longitude = radians(280.460 + 0.9856474 * days + 1.915 * Math.sin(anomaly) + 0.020 * Math.sin(2 * anomaly));
    const obliquity = radians(OBLIQUITY);
    const ascension = Math.atan2(Math.cos(obliquity) * Math.sin(longitude), Math.cos(longitude));
    const siderealTime = radians(280.46061837 + 360.98564736629 * days);
    const [elongation, rate] = SYNODIC_ELONGATION;
    const phase = ((elongation + rate * days) / 360) % 1;
    const [tilt, node, nodeRate] = MOON_LATITUDE;
    return {
        subsolarLongitude: wrap(ascension - siderealTime),
        declination: Math.asin(Math.sin(obliquity) * Math.sin(longitude)),
        moonPhase: phase < 0 ? phase + 1 : phase,
        moonLatitude: radians(tilt) * Math.sin(radians(node + nodeRate * days)),
        planetLongitudes: ORBITS.map(([start, speed, eccentricity, perihelion]) => {
            const mean = radians(start + speed * days);
            const anomaly = mean - radians(perihelion);
            return wrap(mean + 2 * eccentricity * Math.sin(anomaly) + 1.25 * eccentricity ** 2 * Math.sin(2 * anomaly));
        }),
    };
}
