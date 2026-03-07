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
export const PHI: 1.618033988749895;
export const PHI_INV: 0.6180339887498949;
export const PHI_SQ: 2.618033988749895;
export const PHI_INV_SQ: 0.3819660112501051;
export const PHI_CUBE: 4.23606797749979;
export const PHI_ROOT: 1.272019649514069;
export const PHI_PCT: 61.80339887498949;
export const PHI_PCT_INV: 38.19660112501051;
export const BASE: 13;
export const LOG_BASE: 42;
export const LN_42: number;
export const HEADY_UNIT: number;
export const HEADY_CYCLE: number;
export const HEADY_SCALE: number;
export const FIB: number[];
/**
 * Convert a value to base-13 representation
 * @param {number} n — decimal number
 * @returns {string} base-13 string
 */
export function toBase13(n: number): string;
/**
 * Parse a base-13 string to decimal
 * @param {string} s — base-13 string
 * @returns {number} decimal value
 */
export function fromBase13(s: string): number;
/**
 * Log base-42 of a value — Heady logarithmic scaling
 * @param {number} x
 * @returns {number} log₄₂(x)
 */
export function log42(x: number): number;
/**
 * Anti-log base-42 — inverse of log42
 * @param {number} x
 * @returns {number} 42^x
 */
export function antilog42(x: number): number;
/**
 * Derive a system parameter using φ-scaling
 * Generates a value along the golden ratio spiral
 * @param {number} base — base value
 * @param {number} level — spiral level (integer)
 * @returns {number} φ-scaled parameter
 */
export function phiScale(base: number, level: number): number;
/**
 * Split a range using golden ratio
 * Major segment = 61.8%, minor = 38.2%
 * @param {number} min
 * @param {number} max
 * @returns {{ major: number, minor: number, split: number }}
 */
export function goldenSplit(min: number, max: number): {
    major: number;
    minor: number;
    split: number;
};
/**
 * Generate φ-aligned percentage thresholds
 * Returns array of thresholds based on golden ratio powers
 * @param {number} count — number of thresholds
 * @returns {number[]} array of percentages (0-100)
 */
export function phiThresholds(count?: number): number[];
/**
 * Generate a φ-harmonic sequence for system parameter arrays
 * @param {number} base — starting value
 * @param {number} count — how many values
 * @returns {number[]} harmonic sequence
 */
export function phiHarmonics(base: number, count?: number): number[];
/**
 * Calculate retry/backoff delays using φ-scaling
 * More natural than exponential backoff
 * @param {number} attempt — attempt number (0-based)
 * @param {number} baseMs — base delay in ms
 * @param {number} maxMs — maximum delay cap
 * @returns {number} delay in ms
 */
export function phiBackoff(attempt: number, baseMs?: number, maxMs?: number): number;
/**
 * Map a value to a base-13 tier system
 * Used for quality scores, priority levels, capacity tiers
 * @param {number} value — raw value (0-1 normalized)
 * @returns {{ tier: number, label: string, base13: string }}
 */
export function toTier(value: number): {
    tier: number;
    label: string;
    base13: string;
};
/**
 * System capacity parameters derived from Heady math
 * @param {string} tier — 'small' | 'medium' | 'large' | 'enterprise'
 * @returns {object} capacity config
 */
export function capacityParams(tier?: string): object;
/**
 * Derive design proportions from φ
 * Returns spacing/sizing values for UI layout
 * @param {number} baseSize — base unit in px
 * @returns {object} design tokens
 */
export function designTokens(baseSize?: number): object;
/**
 * Color generation using golden angle (137.5°)
 * Produces maximally distinct, harmonious colors
 * @param {number} index — color index
 * @param {number} saturation — 0-100
 * @param {number} lightness — 0-100
 * @returns {string} HSL color string
 */
export function goldenColor(index: number, saturation?: number, lightness?: number): string;
/**
 * Generate animation timing using φ
 * @param {number} baseDuration — base duration in ms
 * @returns {object} timing values
 */
export function phiTiming(baseDuration?: number): object;
//# sourceMappingURL=heady-principles.d.ts.map