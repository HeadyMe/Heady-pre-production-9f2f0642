/**
 * Parses a .env file string into a key-value map.
 * Supports:
 *   - KEY=value
 *   - KEY="quoted value"
 *   - KEY='single quoted'
 *   - # comments (full line and inline)
 *   - Multi-line values with escaped newlines: KEY="line1\nline2"
 *   - Export prefix: export KEY=value
 *   - Blank lines are ignored
 *
 * @param {string} content - Raw .env file content
 * @returns {Record<string, string>}
 */
export function parse(content: string): Record<string, string>;
/**
 * Loads environment variables from a .env file into process.env.
 * Variables already present in process.env are NOT overwritten (by default).
 *
 * @param {Object} [options={}]
 * @param {string} [options.path] - Path to .env file (default: .env in cwd)
 * @param {boolean} [options.override=false] - If true, overwrite existing env vars
 * @param {boolean} [options.silent=false] - If true, suppress file-not-found warnings
 * @param {string} [options.encoding='utf8'] - File encoding
 * @returns {{ parsed: Record<string, string>, path: string, error?: Error }}
 */
export function loadEnv(options?: {
    path?: string | undefined;
    override?: boolean | undefined;
    silent?: boolean | undefined;
    encoding?: string | undefined;
}): {
    parsed: Record<string, string>;
    path: string;
    error?: Error;
};
/**
 * Loads multiple .env files in order. Later files take precedence
 * (only if override is enabled).
 *
 * @param {string[]} paths - Array of .env file paths
 * @param {Object} [options={}]
 * @returns {Record<string, string>} Combined parsed map
 */
export function loadEnvFiles(paths: string[], options?: Object): Record<string, string>;
/**
 * Returns the value of an environment variable, or throws if missing.
 * @param {string} key
 * @returns {string}
 * @throws {Error} If the variable is not set
 */
export function requireEnv(key: string): string;
/**
 * Returns the value of an environment variable, or the default.
 * @param {string} key
 * @param {string} [defaultValue='']
 * @returns {string}
 */
export function getEnv(key: string, defaultValue?: string): string;
/**
 * Returns true if we're running in production.
 * @returns {boolean}
 */
export function isProduction(): boolean;
/**
 * Returns true if we're running in a test environment.
 * @returns {boolean}
 */
export function isTest(): boolean;
/**
 * Returns true if we're running in development.
 * @returns {boolean}
 */
export function isDevelopment(): boolean;
//# sourceMappingURL=heady-env.d.ts.map