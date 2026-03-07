export class ModelArmor {
    constructor(opts?: {});
    _stats: {
        scanned: number;
        blocked: number;
        redacted: number;
        clean: number;
    };
    _blockedLog: any[];
    _enabled: boolean;
    _strictMode: any;
    _maxBlockedLogSize: any;
    /**
     * Scan text for prompt injection attacks.
     * @returns {{ safe: boolean, threats: Array, sanitized: string }}
     */
    scanForInjection(text: any): {
        safe: boolean;
        threats: any[];
        sanitized: string;
    };
    /**
     * Redact PII from text.
     * @returns {{ redacted: string, findings: Array }}
     */
    redactPII(text: any): {
        redacted: string;
        findings: any[];
    };
    /**
     * Full armor scan: injection + PII + content policy.
     */
    fullScan(text: any): {
        safe: boolean;
        text: string;
        originalLength: any;
        processedLength: number;
        injectionThreats: any[];
        piiFindings: any[];
        blocked: boolean;
        ts: string;
    };
    /**
     * Sanitize detected injection attempts.
     */
    _sanitizeInjection(text: any): any;
    _logBlocked(result: any): void;
    getStats(): {
        blockedLogSize: number;
        scanned: number;
        blocked: number;
        redacted: number;
        clean: number;
    };
    getBlockedLog(): any[];
}
export function createModelArmorMiddleware(opts?: {}): {
    (req: any, res: any, next: any): any;
    armor: ModelArmor;
};
export function registerModelArmorRoutes(app: any, armor: any): void;
export const PII_PATTERNS: {
    name: string;
    regex: RegExp;
    replacement: string;
}[];
export const INJECTION_PATTERNS: {
    name: string;
    regex: RegExp;
}[];
//# sourceMappingURL=model-armor.d.ts.map