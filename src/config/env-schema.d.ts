/**
 * Validate environment variables at boot time.
 * @param {object} options
 * @param {boolean} options.strict - If true, fail on missing required vars too
 * @param {boolean} options.silent - If true, don't log warnings
 * @returns {{ valid: boolean, missing: object, warnings: string[] }}
 */
export function validateEnvironment(options?: {
    strict: boolean;
    silent: boolean;
}): {
    valid: boolean;
    missing: object;
    warnings: string[];
};
export namespace ENV_SCHEMA {
    let critical: {
        name: string;
        description: string;
    }[];
    let required: {
        name: string;
        description: string;
    }[];
    let optional: {
        name: string;
        description: string;
    }[];
}
//# sourceMappingURL=env-schema.d.ts.map