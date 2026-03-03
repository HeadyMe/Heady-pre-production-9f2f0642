/**
 * Sacred Geometry Principles — Core Mathematical Foundation
 *
 * Extracted from src/heady-principles.js for SDK distribution.
 * ALL system parameters derive from: φ (PHI), Base-13, Log-42.
 *
 * © 2026 Heady Systems LLC. All rights reserved.
 */

'use strict';

// ── Golden Ratio Constants ──
const PHI = 1.6180339887498948;
const PHI_INV = 0.6180339887498949;
const PHI_SQ = 2.6180339887498949;
const PHI_INV_SQ = 0.3819660112501051;
const PHI_CUBE = 4.2360679774997898;
const PHI_ROOT = 1.2720196495140689;
const PHI_PCT = 61.80339887498949;
const PHI_PCT_INV = 38.19660112501051;

// ── Base-13 System ──
const BASE = 13;
const LOG_BASE = 42;
const LN_42 = Math.log(LOG_BASE);

// ── Derived Constants ──
const HEADY_UNIT = BASE * PHI;
const HEADY_CYCLE = BASE * BASE;
const HEADY_SCALE = Math.log(BASE) / LN_42;

// ── Fibonacci Sequence ──
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765];

// ── Utility Functions ──

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

function log42(x) { return Math.log(x) / LN_42; }
function antilog42(x) { return Math.pow(LOG_BASE, x); }

function phiScale(base, level) {
    return base * Math.pow(PHI, level);
}

function goldenSplit(min, max) {
    const range = max - min;
    const split = min + range * PHI_INV;
    return {
        major: split,
        minor: min + range * PHI_INV_SQ,
        split,
        range,
        majorPct: PHI_PCT,
        minorPct: PHI_PCT_INV,
    };
}

function phiThresholds(count = 5) {
    const thresholds = [];
    for (let i = 0; i < count; i++) {
        thresholds.push(100 * (1 - Math.pow(PHI_INV, i + 1)));
    }
    return thresholds;
}

function phiHarmonics(base, count = 8) {
    const result = [];
    for (let i = 0; i < count; i++) {
        result.push(Math.round(base * Math.pow(PHI, i)));
    }
    return result;
}

function phiBackoff(attempt, baseMs = 1000, maxMs = 42000) {
    return Math.min(baseMs * Math.pow(PHI, attempt), maxMs);
}

function toTier(value) {
    const tier = Math.min(BASE - 1, Math.max(0, Math.floor(value * BASE)));
    const labels = [
        'dormant', 'minimal', 'low', 'moderate', 'steady',
        'active', 'elevated', 'high', 'intense', 'peak',
        'surge', 'critical', 'maximum'
    ];
    return { tier, label: labels[tier], base13: toBase13(tier) };
}

function capacityParams(tier = 'medium') {
    const bases = { small: 13, medium: 169, large: 2197, enterprise: 28561 };
    const base = bases[tier] || 169;
    return {
        maxConnections: Math.round(base * PHI),
        maxVectors: Math.round(base * PHI_SQ * BASE),
        cacheEntries: Math.round(base * PHI_CUBE),
        retryLimit: BASE,
        timeoutMs: Math.round(base * LOG_BASE),
        healthInterval: Math.round(HEADY_CYCLE * 1000 * PHI),
        scanInterval: HEADY_CYCLE * 1000 * BASE,
        backupInterval: HEADY_CYCLE * 1000 * BASE * PHI,
        scaleFactor: PHI_INV,
        splitRatio: PHI_PCT,
    };
}

function designTokens(baseSize = 8) {
    return {
        xxs: Math.round(baseSize / PHI_SQ),
        xs: Math.round(baseSize / PHI),
        sm: baseSize,
        md: Math.round(baseSize * PHI),
        lg: Math.round(baseSize * PHI_SQ),
        xl: Math.round(baseSize * PHI_CUBE),
        xxl: Math.round(baseSize * Math.pow(PHI, 4)),
    };
}

function goldenColor(index, saturation = 70, lightness = 55) {
    const goldenAngle = 360 * PHI_INV;
    const hue = (index * goldenAngle) % 360;
    return `hsl(${Math.round(hue)}, ${saturation}%, ${lightness}%)`;
}

function phiTiming(baseDuration = 300) {
    return {
        instant: Math.round(baseDuration / PHI_SQ),
        fast: Math.round(baseDuration / PHI),
        normal: baseDuration,
        slow: Math.round(baseDuration * PHI),
        deliberate: Math.round(baseDuration * PHI_SQ),
        dramatic: Math.round(baseDuration * PHI_CUBE),
    };
}

module.exports = {
    PHI, PHI_INV, PHI_SQ, PHI_INV_SQ, PHI_CUBE, PHI_ROOT,
    PHI_PCT, PHI_PCT_INV,
    BASE, LOG_BASE, LN_42,
    HEADY_UNIT, HEADY_CYCLE, HEADY_SCALE,
    FIB,
    toBase13, fromBase13,
    log42, antilog42,
    phiScale, goldenSplit, phiThresholds, phiHarmonics, phiBackoff,
    toTier, capacityParams,
    designTokens, goldenColor, phiTiming,
};
