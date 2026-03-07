/**
 * ─── Patent Bee ────────────────────────────────────────────────
 * Swarm worker for IP compliance monitoring.
 *
 * On every swarm cycle, this bee:
 *   1. Reports patent coverage stats
 *   2. Verifies patent vectors exist in memory
 *   3. Checks for code changes that may affect patented systems
 *   4. Emits telemetry for IP health
 *
 * Domain: patents
 * ────────────────────────────────────────────────────────────────
 */
export const domain: "patents";
export const description: "IP compliance monitoring \u2014 tracks patent concept coverage and vector memory presence";
export const priority: 0.7;
export function getWork(ctx?: {}): ((() => Promise<{
    bee: string;
    action: string;
    total: any;
    active: any;
    embedded: any;
    coveragePercent: any;
    embeddedPercent: any;
    error?: undefined;
} | {
    bee: string;
    action: string;
    error: any;
    total?: undefined;
    active?: undefined;
    embedded?: undefined;
    coveragePercent?: undefined;
    embeddedPercent?: undefined;
}>) | (() => Promise<{
    bee: string;
    action: string;
    skipped: boolean;
    reason: string;
    embedded?: undefined;
    missing?: undefined;
    missingPatents?: undefined;
    error?: undefined;
} | {
    bee: string;
    action: string;
    embedded: any;
    missing: any;
    missingPatents: any;
    skipped?: undefined;
    reason?: undefined;
    error?: undefined;
} | {
    bee: string;
    action: string;
    error: any;
    skipped?: undefined;
    reason?: undefined;
    embedded?: undefined;
    missing?: undefined;
    missingPatents?: undefined;
}>) | (() => Promise<{
    bee: string;
    action: string;
    totalDomains: number;
    gaps: {
        domain: string;
        total: any;
        archived: any;
    }[];
    gapCount: number;
    error?: undefined;
} | {
    bee: string;
    action: string;
    error: any;
    totalDomains?: undefined;
    gaps?: undefined;
    gapCount?: undefined;
}>))[];
//# sourceMappingURL=patent-bee.d.ts.map