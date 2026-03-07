"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CSL_BANDS = exports.PSI = exports.PHI = void 0;
exports.fib = fib;
exports.clamp01 = clamp01;
exports.labelForCslScore = labelForCslScore;
exports.phiWeights = phiWeights;
exports.phiBlend = phiBlend;
exports.phiBackoffMs = phiBackoffMs;
exports.dotProduct = dotProduct;
exports.magnitude = magnitude;
exports.cosineSimilarity = cosineSimilarity;
exports.normalizeVector = normalizeVector;
exports.meanVector = meanVector;
exports.spatialDistance = spatialDistance;
exports.attenuationFromDistance = attenuationFromDistance;
exports.hashToUnitInterval = hashToUnitInterval;
exports.hashToVector3 = hashToVector3;
const node_crypto_1 = require("node:crypto");
exports.PHI = 1.618033988749895;
exports.PSI = 1 / exports.PHI;
exports.CSL_BANDS = {
    DORMANT_MAX: 0.236068,
    LOW_MAX: 0.381966,
    MODERATE_MAX: 0.618034,
    HIGH_MAX: 0.854102,
    CRITICAL_MAX: 1,
};
function fib(n) {
    if (n <= 0)
        return 0;
    if (n <= 2)
        return 1;
    let a = 1;
    let b = 1;
    for (let i = 3; i <= n; i += 1) {
        const next = a + b;
        a = b;
        b = next;
    }
    return b;
}
function clamp01(value) {
    if (Number.isNaN(value) || !Number.isFinite(value))
        return 0;
    return Math.max(0, Math.min(1, value));
}
function labelForCslScore(score) {
    const normalized = clamp01(score);
    if (normalized <= exports.CSL_BANDS.DORMANT_MAX)
        return 'DORMANT';
    if (normalized <= exports.CSL_BANDS.LOW_MAX)
        return 'LOW';
    if (normalized <= exports.CSL_BANDS.MODERATE_MAX)
        return 'MODERATE';
    if (normalized <= exports.CSL_BANDS.HIGH_MAX)
        return 'HIGH';
    return 'CRITICAL';
}
function phiWeights(count) {
    if (count <= 0)
        return [];
    const raw = Array.from({ length: count }, (_, index) => Math.pow(exports.PHI, count - index - 1));
    const total = raw.reduce((sum, value) => sum + value, 0);
    return raw.map((value) => value / total);
}
function phiBlend(values) {
    if (values.length === 0)
        return 0;
    const weights = phiWeights(values.length);
    return clamp01(values.reduce((sum, value, index) => sum + clamp01(value) * weights[index], 0));
}
function phiBackoffMs(attempt, baseMs = 1000, maxMs = fib(15) * 100) {
    const delay = baseMs * Math.pow(exports.PHI, Math.max(0, attempt));
    return Math.round(Math.min(delay, maxMs));
}
function dotProduct(a, b) {
    return a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
}
function magnitude(vector) {
    return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}
function cosineSimilarity(a, b) {
    const magA = magnitude(a);
    const magB = magnitude(b);
    if (magA === 0 || magB === 0)
        return 0;
    const cosine = dotProduct(a, b) / (magA * magB);
    return Math.max(-1, Math.min(1, cosine));
}
function normalizeVector(vector) {
    const mag = magnitude(vector);
    if (mag === 0)
        return vector.map(() => 0);
    return vector.map((value) => value / mag);
}
function meanVector(vectors) {
    if (vectors.length === 0)
        return [];
    const dimension = vectors[0].length;
    const totals = Array.from({ length: dimension }, () => 0);
    for (const vector of vectors) {
        for (let i = 0; i < dimension; i += 1) {
            totals[i] += vector[i] ?? 0;
        }
    }
    return totals.map((value) => value / vectors.length);
}
function spatialDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
function attenuationFromDistance(distance) {
    return 1 / (1 + distance * distance);
}
function hashToUnitInterval(seed) {
    const digest = (0, node_crypto_1.createHash)('sha256').update(seed).digest('hex').slice(0, 12);
    const integer = Number.parseInt(digest, 16);
    return integer / 0xffffffffffff;
}
function hashToVector3(seed, scale = fib(8)) {
    const x = (hashToUnitInterval(`${seed}:x`) * 2 - 1) * scale;
    const y = (hashToUnitInterval(`${seed}:y`) * 2 - 1) * scale;
    const z = (hashToUnitInterval(`${seed}:z`) * 2 - 1) * scale;
    return { x, y, z };
}
//# sourceMappingURL=index.js.map