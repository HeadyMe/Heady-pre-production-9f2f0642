/**
 * Get a secret from environment, never returning it to LLM context.
 * @param {string} key - Environment variable name
 * @returns {string|null} The secret value, or null if not found
 */
export function getSecret(key: string): string | null;
/**
 * Run a command with 1Password secrets injection.
 * Secrets are injected into the child process environment only.
 * @param {string} command - The command to run
 * @param {string} envFile - Path to .env file with op:// references
 * @returns {string} Command output with secrets scrubbed
 */
export function runWithSecrets(command: string, envFile: string): string;
/**
 * Scrub secrets from a string, replacing with [REDACTED].
 */
export function scrubSecrets(text: any): any;
/**
 * Inject secrets into a config object, replacing ${VAR} references.
 * Returns a new object — original is NOT modified.
 */
export function injectSecrets(config: any): any;
/**
 * Validate that required secrets are present in environment.
 */
export function validateSecrets(requiredKeys: any): {
    valid: boolean;
    found: any[];
    missing: any[];
    total: any;
};
/**
 * Get secrets rotation status based on the secrets manifest.
 */
export function checkRotationStatus(manifest: any): {
    name: any;
    ageDays: number;
    maxDays: any;
    status: string;
    rotationUrl: any;
}[];
/**
 * Get the audit trail of secret accesses.
 */
export function getAuditTrail(limit?: number): any[];
/**
 * List of patterns that should NEVER appear in LLM context or logs.
 */
export const SCRUB_PATTERNS: RegExp[];
//# sourceMappingURL=secrets-manager.d.ts.map