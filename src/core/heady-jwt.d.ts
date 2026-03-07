export type VerifyOptions = {
    /**
     * - Allowed algorithm(s)
     */
    algorithms?: string | undefined;
    /**
     * - Expected iss claim
     */
    issuer?: string | undefined;
    /**
     * - Expected aud claim
     */
    audience?: string | string[] | undefined;
    /**
     * - Expected sub claim
     */
    subject?: string | undefined;
    /**
     * - Clock skew tolerance in seconds
     */
    clockTolerance?: number | undefined;
    /**
     * - Skip exp check
     */
    ignoreExpiration?: boolean | undefined;
    /**
     * - Skip nbf check
     */
    ignoreNotBefore?: boolean | undefined;
};
/**
 * Signs a payload and returns a JWT string.
 *
 * @param {Object} payload - Claims to embed in the token
 * @param {string|Buffer} secret - Signing secret
 * @param {Object} [options={}]
 * @param {string} [options.algorithm='HS256'] - HS256 | HS384 | HS512
 * @param {string|number} [options.expiresIn] - e.g. '24h', '7d', 3600
 * @param {string|number} [options.notBefore] - e.g. '5m' or seconds
 * @param {string} [options.issuer] - JWT iss claim
 * @param {string} [options.audience] - JWT aud claim
 * @param {string} [options.subject] - JWT sub claim
 * @param {string} [options.jwtid] - JWT jti claim (unique ID)
 * @returns {string} Signed JWT
 */
export function sign(payload: Object, secret: string | Buffer, options?: {
    algorithm?: string | undefined;
    expiresIn?: string | number | undefined;
    notBefore?: string | number | undefined;
    issuer?: string | undefined;
    audience?: string | undefined;
    subject?: string | undefined;
    jwtid?: string | undefined;
}): string;
/**
 * @typedef {Object} VerifyOptions
 * @property {string} [algorithms] - Allowed algorithm(s)
 * @property {string} [issuer] - Expected iss claim
 * @property {string|string[]} [audience] - Expected aud claim
 * @property {string} [subject] - Expected sub claim
 * @property {number} [clockTolerance=0] - Clock skew tolerance in seconds
 * @property {boolean} [ignoreExpiration=false] - Skip exp check
 * @property {boolean} [ignoreNotBefore=false] - Skip nbf check
 */
/**
 * Verifies a JWT token and returns its decoded payload.
 *
 * @param {string} token - The JWT string
 * @param {string|Buffer} secret - Signing secret
 * @param {VerifyOptions} [options={}]
 * @returns {Object} Decoded and verified payload
 * @throws {Error} On invalid signature, expiry, or claim mismatch
 */
export function verify(token: string, secret: string | Buffer, options?: VerifyOptions): Object;
/**
 * Decodes a JWT without verifying the signature.
 * @param {string} token
 * @returns {{ header: Object, payload: Object, signature: string }}
 */
export function decode(token: string): {
    header: Object;
    payload: Object;
    signature: string;
};
/**
 * Verifies an existing token and issues a new one with a fresh expiry.
 * @param {string} token - Existing JWT
 * @param {string|Buffer} secret - Signing secret
 * @param {Object} [options={}] - Same as sign options
 * @returns {string} New JWT
 */
export function refresh(token: string, secret: string | Buffer, options?: Object): string;
/**
 * Generates a cryptographically random JWT ID.
 * @returns {string}
 */
export function generateJwtId(): string;
/**
 * Parses a duration string (e.g. '24h', '7d', '30m', '3600s') to seconds.
 * Also accepts a plain number (treated as seconds).
 * @param {string|number} duration
 * @returns {number} Duration in seconds
 */
export function parseDuration(duration: string | number): number;
/**
 * Base64URL-encodes a Buffer or string.
 * @param {Buffer|string} data
 * @returns {string}
 */
export function base64urlEncode(data: Buffer | string): string;
/**
 * Base64URL-decodes a string to a Buffer.
 * @param {string} str
 * @returns {Buffer}
 */
export function base64urlDecode(str: string): Buffer;
//# sourceMappingURL=heady-jwt.d.ts.map