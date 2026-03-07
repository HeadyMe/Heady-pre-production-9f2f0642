/**
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ Heady Exponential Backoff — φ-Scaled Resilience ═══
 *
 * Unlike traditional base-2 exponential backoff (1s, 2s, 4s, 8s...),
 * Heady uses the Golden Ratio (φ = 1.618...) for delay scaling.
 */
export const PHI: 1.6180339887;
/**
 * Calculate a φ-scaled delay with randomized jitter.
 *
 * @param {number} attempt - Current retry attempt (0-indexed)
 * @param {number} baseMs - Base delay in milliseconds (default: 1000)
 * @param {number} maxMs - Maximum delay cap (default: 30000)
 * @param {number} jitterFactor - Jitter range as fraction of delay (default: 0.25)
 * @returns {number} Delay in milliseconds
 */
export function phiDelay(attempt: number, baseMs?: number, maxMs?: number, jitterFactor?: number): number;
export function withBackoff(fn: any, opts?: {}): Promise<any>;
export function createResilientFn(fn: any, opts?: {}): (...args: any[]) => Promise<any>;
export function delayTable(maxAttempts?: number, baseMs?: number): {
    attempt: number;
    delayMs: number;
    delaySec: number;
    formula: string;
}[];
//# sourceMappingURL=exponential-backoff.d.ts.map