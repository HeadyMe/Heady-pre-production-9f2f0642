/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

/**
 * @fileoverview Bcrypt-compatible password hashing using Node.js built-in
 * crypto module. Replaces the bcrypt/bcryptjs packages.
 *
 * Algorithm: PBKDF2 with SHA-512, salt stretching, and a format compatible
 * with the Heady platform (not wire-compatible with bcrypt — use for new
 * credential stores only).
 *
 * Hash format: $heady$v1$<rounds>$<salt_b64>$<hash_b64>
 *
 * @module src/core/heady-crypt
 */

const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HASH_PREFIX = '$heady$v1$';
const SALT_BYTES = 16;
const HASH_BYTES = 64;
const DIGEST = 'sha512';
const DEFAULT_ROUNDS = 12;

/** Maps bcrypt-style cost factor to PBKDF2 iterations (2^rounds). */
function _roundsToIterations(rounds) {
  return Math.pow(2, Math.max(4, Math.min(31, rounds)));
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Hashes a plaintext password using PBKDF2 with a random salt.
 *
 * @param {string} password - The plaintext password
 * @param {number} [rounds=12] - Cost factor (4-31). Higher = slower/more secure.
 * @returns {Promise<string>} Hash string in Heady format
 */
function hash(password, rounds = DEFAULT_ROUNDS) {
  return new Promise((resolve, reject) => {
    if (!password || typeof password !== 'string') {
      return reject(new TypeError('Password must be a non-empty string'));
    }
    if (typeof rounds !== 'number' || rounds < 4 || rounds > 31) {
      return reject(new RangeError('Rounds must be between 4 and 31'));
    }

    const iterations = _roundsToIterations(rounds);
    const salt = crypto.randomBytes(SALT_BYTES);

    crypto.pbkdf2(password, salt, iterations, HASH_BYTES, DIGEST, (err, derivedKey) => {
      if (err) return reject(err);
      const saltB64 = salt.toString('base64url');
      const hashB64 = derivedKey.toString('base64url');
      resolve(`${HASH_PREFIX}${rounds}$${saltB64}$${hashB64}`);
    });
  });
}

/**
 * Synchronous version of hash().
 * @param {string} password
 * @param {number} [rounds=12]
 * @returns {string}
 */
function hashSync(password, rounds = DEFAULT_ROUNDS) {
  if (!password || typeof password !== 'string') {
    throw new TypeError('Password must be a non-empty string');
  }
  if (typeof rounds !== 'number' || rounds < 4 || rounds > 31) {
    throw new RangeError('Rounds must be between 4 and 31');
  }

  const iterations = _roundsToIterations(rounds);
  const salt = crypto.randomBytes(SALT_BYTES);
  const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, HASH_BYTES, DIGEST);
  const saltB64 = salt.toString('base64url');
  const hashB64 = derivedKey.toString('base64url');
  return `${HASH_PREFIX}${rounds}$${saltB64}$${hashB64}`;
}

/**
 * Parses a Heady hash string into its components.
 * @param {string} hashStr
 * @returns {{ rounds: number, salt: Buffer, hash: Buffer }}
 * @throws {Error} If the hash format is unrecognised
 */
function _parseHash(hashStr) {
  if (!hashStr || !hashStr.startsWith(HASH_PREFIX)) {
    throw new Error('Invalid Heady hash format');
  }
  const rest = hashStr.slice(HASH_PREFIX.length);
  const parts = rest.split('$');
  if (parts.length !== 3) {
    throw new Error('Invalid Heady hash format: wrong number of parts');
  }
  const rounds = parseInt(parts[0], 10);
  const salt = Buffer.from(parts[1], 'base64url');
  const storedHash = Buffer.from(parts[2], 'base64url');
  return { rounds, salt, hash: storedHash };
}

/**
 * Verifies a plaintext password against a stored Heady hash.
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @param {string} password - Plaintext to verify
 * @param {string} storedHash - Hash produced by hash()
 * @returns {Promise<boolean>}
 */
function compare(password, storedHash) {
  return new Promise((resolve, reject) => {
    if (!password || typeof password !== 'string') {
      return reject(new TypeError('Password must be a non-empty string'));
    }
    if (!storedHash || typeof storedHash !== 'string') {
      return reject(new TypeError('Stored hash must be a non-empty string'));
    }

    let parsed;
    try {
      parsed = _parseHash(storedHash);
    } catch (err) {
      return reject(err);
    }

    const { rounds, salt, hash: storedHashBuf } = parsed;
    const iterations = _roundsToIterations(rounds);

    crypto.pbkdf2(password, salt, iterations, HASH_BYTES, DIGEST, (err, derivedKey) => {
      if (err) return reject(err);
      try {
        // Ensure same lengths for timingSafeEqual
        if (derivedKey.length !== storedHashBuf.length) {
          return resolve(false);
        }
        resolve(crypto.timingSafeEqual(derivedKey, storedHashBuf));
      } catch (cmpErr) {
        resolve(false);
      }
    });
  });
}

/**
 * Synchronous version of compare().
 * @param {string} password
 * @param {string} storedHash
 * @returns {boolean}
 */
function compareSync(password, storedHash) {
  if (!password || typeof password !== 'string') throw new TypeError('Password must be a non-empty string');
  if (!storedHash || typeof storedHash !== 'string') throw new TypeError('Hash must be a non-empty string');

  const { rounds, salt, hash: storedHashBuf } = _parseHash(storedHash);
  const iterations = _roundsToIterations(rounds);
  const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, HASH_BYTES, DIGEST);
  if (derivedKey.length !== storedHashBuf.length) return false;
  return crypto.timingSafeEqual(derivedKey, storedHashBuf);
}

// ---------------------------------------------------------------------------
// Additional utilities
// ---------------------------------------------------------------------------

/**
 * Generates a cryptographically random token (hex-encoded).
 * @param {number} [bytes=32] - Number of random bytes
 * @returns {string} Hex-encoded token
 */
function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generates a cryptographically random API key in Heady format.
 * Format: hk_<32 bytes hex>
 * @returns {string}
 */
function generateApiKey() {
  return `hk_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Returns the number of rounds stored in a hash (useful for re-hashing).
 * @param {string} storedHash
 * @returns {number}
 */
function getRounds(storedHash) {
  return _parseHash(storedHash).rounds;
}

/**
 * Checks whether a hash needs to be re-hashed (rounds are too low).
 * @param {string} storedHash
 * @param {number} [targetRounds=12]
 * @returns {boolean}
 */
function needsRehash(storedHash, targetRounds = DEFAULT_ROUNDS) {
  const { rounds } = _parseHash(storedHash);
  return rounds < targetRounds;
}

/**
 * Creates a constant-time string comparison (prevents timing attacks).
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still perform comparison to avoid timing leak on length difference
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  hash,
  hashSync,
  compare,
  compareSync,
  generateToken,
  generateApiKey,
  getRounds,
  needsRehash,
  timingSafeEqual,
};
