/**
 * Validates environment variables against the schema.
 * @param {object} options
 * @param {boolean} options.exitOnError - Exit process on validation failure (default: true in production)
 * @param {boolean} options.logSensitive - Log sensitive var names without values (default: false)
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateEnv(options?: {
    exitOnError: boolean;
    logSensitive: boolean;
}): {
    valid: boolean;
    errors: string[];
    warnings: string[];
};
/**
 * Masks sensitive environment variables for safe logging.
 * @returns {object} Env vars with sensitive values replaced by '***'
 */
export function getSafeEnvDump(): object;
export namespace ENV_SCHEMA {
    let required: {
        key: string;
        description: string;
        allowed: string[];
    }[];
    let production: {
        key: string;
        description: string;
        sensitive: boolean;
    }[];
    let optional: ({
        key: string;
        description: string;
        default: string;
        validate: (v: any) => boolean;
        allowed?: undefined;
    } | {
        key: string;
        description: string;
        allowed: string[];
        default?: undefined;
        validate?: undefined;
    } | {
        key: string;
        description: string;
        validate: (v: any) => any;
        default?: undefined;
        allowed?: undefined;
    })[];
    let sensitive_patterns: RegExp[];
}
//# sourceMappingURL=env-validator.d.ts.map