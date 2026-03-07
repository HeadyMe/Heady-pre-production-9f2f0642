export function corsConfig(): (req: any, res: any, next: any) => void;
/**
 * Heady CORS Configuration — Production-grade origin control
 * Whitelists known Heady domains and rejects unknown origins.
 */
export const ALLOWED_ORIGINS: string[];
export const ALLOWED_PATTERNS: RegExp[];
//# sourceMappingURL=cors-config.d.ts.map