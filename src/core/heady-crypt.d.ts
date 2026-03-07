/**
 * Hashes a plaintext password using PBKDF2 with a random salt.
 *
 * @param {string} password - The plaintext password
 * @param {number} [rounds=12] - Cost factor (4-31). Higher = slower/more secure.
 * @returns {Promise<string>} Hash string in Heady format
 */
export function hash(password: string, rounds?: number): Promise<string>;
/**
 * Synchronous version of hash().
 * @param {string} password
 * @param {number} [rounds=12]
 * @returns {string}
 */
export function hashSync(password: string, rounds?: number): string;
/**
 * Verifies a plaintext password against a stored Heady hash.
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @param {string} password - Plaintext to verify
 * @param {string} storedHash - Hash produced by hash()
 * @returns {Promise<boolean>}
 */
export function compare(password: string, storedHash: string): Promise<boolean>;
/**
 * Synchronous version of compare().
 * @param {string} password
 * @param {string} storedHash
 * @returns {boolean}
 */
export function compareSync(password: string, storedHash: string): boolean;
/**
 * Generates a cryptographically random token (hex-encoded).
 * @param {number} [bytes=32] - Number of random bytes
 * @returns {string} Hex-encoded token
 */
export function generateToken(bytes?: number): string;
/**
 * Generates a cryptographically random API key in Heady format.
 * Format: hk_<32 bytes hex>
 * @returns {string}
 */
export function generateApiKey(): string;
/**
 * Returns the number of rounds stored in a hash (useful for re-hashing).
 * @param {string} storedHash
 * @returns {number}
 */
export function getRounds(storedHash: string): number;
/**
 * Checks whether a hash needs to be re-hashed (rounds are too low).
 * @param {string} storedHash
 * @param {number} [targetRounds=12]
 * @returns {boolean}
 */
export function needsRehash(storedHash: string, targetRounds?: number): boolean;
/**
 * Creates a constant-time string comparison (prevents timing attacks).
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function timingSafeEqual(a: string, b: string): boolean;
//# sourceMappingURL=heady-crypt.d.ts.map