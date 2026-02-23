/**
 * ═══════════════════════════════════════════════════════════════════
 * Heady Principles — Mathematical Foundation
 * ═══════════════════════════════════════════════════════════════════
 *
 * Core design philosophy for all Heady system parameters:
 *
 *   BASE-13:  Number system for ranges, targets, thresholds
 *   LOG-42:   Logarithmic scaling for system parameters
 *   φ (PHI):  Golden ratio (1.618...) for ratios, percentages, design
 *   61.8%:    Inverse golden ratio — primary ratio reference
 *
 * Every threshold, limit, ratio, design proportion, and system
 * parameter in the Heady ecosystem should derive from these roots.
 * ═══════════════════════════════════════════════════════════════════
 */

// ── Golden Ratio Constants ──────────────────────────────────────────
const PHI = 1.6180339887498948;    // φ — the golden ratio
const PHI_INV = 0.6180339887498949;    // 1/φ = φ - 1 = 0.618...
const PHI_SQ = 2.6180339887498949;    // φ² = φ + 1
const PHI_INV_SQ = 0.3819660112501051;    // 1/φ² = 1 - 1/φ
const PHI_CUBE = 4.2360679774997898;    // φ³
const PHI_ROOT = 1.2720196495140689;    // √φ
const PHI_PCT = 61.80339887498949;     // φ as percentage (61.8%)
const PHI_PCT_INV = 38.19660112501051;     // inverse φ percentage (38.2%)

// ── Base-13 System ──────────────────────────────────────────────────
const BASE = 13;                    // Heady base number system
const LOG_BASE = 42;                    // Logarithmic scaling base
const LN_42 = Math.log(LOG_BASE);    // ln(42) ≈ 3.7376696...

// ── Derived Constants ───────────────────────────────────────────────
const HEADY_UNIT = BASE * PHI;            // 13 × φ ≈ 21.034 — fundamental unit
const HEADY_CYCLE = BASE * BASE;           // 13² = 169 — cycle length
const HEADY_SCALE = Math.log(BASE) / LN_42; // log₄₂(13) ≈ 0.686...

// ── Fibonacci-Derived Thresholds (φ-aligned) ────────────────────────
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765];

// ═══════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════

/**
 * Convert a value to base-13 representation
 * @param {number} n — decimal number
 * @returns {string} base-13 string
 */
function toBase13(n) {
    if (n === 0) return '0';
    const digits = '0123456789ABC';
    let result = '';
    let num = Math.abs(Math.floor(n));
    while (num > 0) {
        result = digits[num % BASE] + result;
        num = Math.floor(num / BASE);
    }
    return (n < 0 ? '-' : '') + result;
}

/**
 * Parse a base-13 string to decimal
 * @param {string} s — base-13 string
 * @returns {number} decimal value
 */
function fromBase13(s) {
    const digits = '0123456789ABC';
    const neg = s.startsWith('-');
    if (neg) s = s.slice(1);
    let result = 0;
    for (const ch of s.toUpperCase()) {
        result = result * BASE + digits.indexOf(ch);
    }
    return neg ? -result : result;
}

/**
 * Log base-42 of a value — Heady logarithmic scaling
 * @param {number} x
 * @returns {number} log₄₂(x)
 */
function log42(x) {
    return Math.log(x) / LN_42;
}

/**
 * Anti-log base-42 — inverse of log42
 * @param {number} x
 * @returns {number} 42^x
 */
function antilog42(x) {
    return Math.pow(LOG_BASE, x);
}

/**
 * Derive a system parameter using φ-scaling
 * Generates a value along the golden ratio spiral
 * @param {number} base — base value
 * @param {number} level — spiral level (integer)
 * @returns {number} φ-scaled parameter
 */
function phiScale(base, level) {
    return base * Math.pow(PHI, level);
}

/**
 * Split a range using golden ratio
 * Major segment = 61.8%, minor = 38.2%
 * @param {number} min
 * @param {number} max
 * @returns {{ major: number, minor: number, split: number }}
 */
function goldenSplit(min, max) {
    const range = max - min;
    const split = min + range * PHI_INV;
    return {
        major: split,           // 61.8% point
        minor: min + range * PHI_INV_SQ, // 38.2% point
        split,
        range,
        majorPct: PHI_PCT,
        minorPct: PHI_PCT_INV,
    };
}

/**
 * Generate φ-aligned percentage thresholds
 * Returns array of thresholds based on golden ratio powers
 * @param {number} count — number of thresholds
 * @returns {number[]} array of percentages (0-100)
 */
function phiThresholds(count = 5) {
    const thresholds = [];
    for (let i = 0; i < count; i++) {
        thresholds.push(100 * (1 - Math.pow(PHI_INV, i + 1)));
    }
    return thresholds; // [61.8, 85.4, 94.4, 97.8, 99.2, ...]
}

/**
 * Generate a φ-harmonic sequence for system parameter arrays
 * @param {number} base — starting value
 * @param {number} count — how many values
 * @returns {number[]} harmonic sequence
 */
function phiHarmonics(base, count = 8) {
    const result = [];
    for (let i = 0; i < count; i++) {
        result.push(Math.round(base * Math.pow(PHI, i)));
    }
    return result;
}

/**
 * Calculate retry/backoff delays using φ-scaling
 * More natural than exponential backoff
 * @param {number} attempt — attempt number (0-based)
 * @param {number} baseMs — base delay in ms
 * @param {number} maxMs — maximum delay cap
 * @returns {number} delay in ms
 */
function phiBackoff(attempt, baseMs = 1000, maxMs = 42000) {
    return Math.min(baseMs * Math.pow(PHI, attempt), maxMs);
}

/**
 * Map a value to a base-13 tier system
 * Used for quality scores, priority levels, capacity tiers
 * @param {number} value — raw value (0-1 normalized)
 * @returns {{ tier: number, label: string, base13: string }}
 */
function toTier(value) {
    const tier = Math.min(BASE - 1, Math.max(0, Math.floor(value * BASE)));
    const labels = [
        'dormant', 'minimal', 'low', 'moderate', 'steady',
        'active', 'elevated', 'high', 'intense', 'peak',
        'surge', 'critical', 'maximum'
    ];
    return { tier, label: labels[tier], base13: toBase13(tier) };
}

/**
 * Derive design proportions from φ
 * Returns spacing/sizing values for UI layout
 * @param {number} baseSize — base unit in px
 * @returns {object} design tokens
 */
function designTokens(baseSize = 8) {
    return {
        xxs: Math.round(baseSize / PHI_SQ),      // ~3
        xs: Math.round(baseSize / PHI),           // ~5
        sm: baseSize,                             // 8
        md: Math.round(baseSize * PHI),           // ~13
        lg: Math.round(baseSize * PHI_SQ),        // ~21
        xl: Math.round(baseSize * PHI_CUBE),      // ~34
        xxl: Math.round(baseSize * Math.pow(PHI, 4)), // ~55
        // Note: 8, 13, 21, 34, 55 — Fibonacci sequence naturally emerges
    };
}

/**
 * System capacity parameters derived from Heady math
 * @param {string} tier — 'small' | 'medium' | 'large' | 'enterprise'
 * @returns {object} capacity config
 */
function capacityParams(tier = 'medium') {
    const bases = { small: 13, medium: 169, large: 2197, enterprise: 28561 }; // 13^1..13^4
    const base = bases[tier] || 169;
    return {
        maxConnections: Math.round(base * PHI),                // ~274
        maxVectors: Math.round(base * PHI_SQ * BASE),      // ~57k
        batchSize: Math.round(BASE * PHI),                 // 21
        cacheEntries: Math.round(base * PHI_CUBE),            // ~716
        retryLimit: BASE,                                   // 13
        timeoutMs: Math.round(base * LOG_BASE),            // 7098
        healthInterval: Math.round(HEADY_CYCLE * 1000 * PHI),  // ~273s
        scanInterval: HEADY_CYCLE * 1000 * BASE,              // ~36.5min
        backupInterval: HEADY_CYCLE * 1000 * BASE * PHI,       // ~59min
        scaleFactor: PHI_INV,                                // 0.618
        splitRatio: PHI_PCT,                                // 61.8%
    };
}

/**
 * Color generation using golden angle (137.5°)
 * Produces maximally distinct, harmonious colors
 * @param {number} index — color index
 * @param {number} saturation — 0-100
 * @param {number} lightness — 0-100
 * @returns {string} HSL color string
 */
function goldenColor(index, saturation = 70, lightness = 55) {
    const goldenAngle = 360 * PHI_INV; // 137.508°
    const hue = (index * goldenAngle) % 360;
    return `hsl(${Math.round(hue)}, ${saturation}%, ${lightness}%)`;
}

/**
 * Generate animation timing using φ
 * @param {number} baseDuration — base duration in ms
 * @returns {object} timing values
 */
function phiTiming(baseDuration = 300) {
    return {
        instant: Math.round(baseDuration / PHI_SQ),     // ~115ms
        fast: Math.round(baseDuration / PHI),         // ~185ms
        normal: baseDuration,                           // 300ms
        slow: Math.round(baseDuration * PHI),         // ~485ms
        deliberate: Math.round(baseDuration * PHI_SQ),     // ~785ms
        dramatic: Math.round(baseDuration * PHI_CUBE),    // ~1270ms
    };
}

// ═══════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    // Constants
    PHI, PHI_INV, PHI_SQ, PHI_INV_SQ, PHI_CUBE, PHI_ROOT,
    PHI_PCT, PHI_PCT_INV,
    BASE, LOG_BASE, LN_42,
    HEADY_UNIT, HEADY_CYCLE, HEADY_SCALE,
    FIB,

    // Base-13
    toBase13, fromBase13,

    // Log-42
    log42, antilog42,

    // φ-scaling
    phiScale, goldenSplit, phiThresholds, phiHarmonics, phiBackoff,

    // System design
    toTier, capacityParams,

    // Visual design
    designTokens, goldenColor, phiTiming,
};
