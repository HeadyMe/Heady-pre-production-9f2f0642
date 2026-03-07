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
export function toBase13(n: any): string;
export function fromBase13(s: any): number;
export function log42(x: any): number;
export function antilog42(x: any): number;
export function phiScale(base: any, level: any): number;
export function goldenSplit(min: any, max: any): {
    major: any;
    minor: any;
    split: any;
    range: number;
    majorPct: number;
    minorPct: number;
};
export function phiThresholds(count?: number): number[];
export function phiHarmonics(base: any, count?: number): number[];
export function phiBackoff(attempt: any, baseMs?: number, maxMs?: number): number;
export function toTier(value: any): {
    tier: number;
    label: string;
    base13: string;
};
export function capacityParams(tier?: string): {
    maxConnections: number;
    maxVectors: number;
    cacheEntries: number;
    retryLimit: number;
    timeoutMs: number;
    healthInterval: number;
    scanInterval: number;
    backupInterval: number;
    scaleFactor: number;
    splitRatio: number;
};
export function designTokens(baseSize?: number): {
    xxs: number;
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
};
export function goldenColor(index: any, saturation?: number, lightness?: number): string;
export function phiTiming(baseDuration?: number): {
    instant: number;
    fast: number;
    normal: number;
    slow: number;
    deliberate: number;
    dramatic: number;
};
//# sourceMappingURL=principles.d.ts.map