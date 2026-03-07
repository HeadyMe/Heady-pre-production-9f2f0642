/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

/**
 * @fileoverview JWT sign and verify using Node.js built-in crypto module.
 * Replaces jsonwebtoken. Supports HS256, HS384, HS512 algorithms.
 * @module src/core/heady-jwt
 */

const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Algorithm map
// ---------------------------------------------------------------------------

/** Maps JWT alg header to Node.js crypto HMAC algorithm. */
const ALG_MAP = {
  HS256: 'sha256',
  HS384: 'sha384',
  HS512: 'sha512',
};

const DEFAULT_ALGORITHM = 'HS256';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Base64URL-encodes a Buffer or string.
 * @param {Buffer|string} data
 * @returns {string}
 */
function base64urlEncode(data) {
  const b64 = Buffer.isBuffer(data) ? data.toString('base64') : Buffer.from(data).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64URL-decodes a string to a Buffer.
 * @param {string} str
 * @returns {Buffer}
 */
function base64urlDecode(str) {
  // Restore standard base64 padding
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padding), 'base64');
}

/**
 * Parses a duration string (e.g. '24h', '7d', '30m', '3600s') to seconds.
 * Also accepts a plain number (treated as seconds).
 * @param {string|number} duration
 * @returns {number} Duration in seconds
 */
function parseDuration(duration) {
  if (typeof duration === 'number') return duration;
  const match = String(duration).match(/^(\d+(?:\.\d+)?)(s|m|h|d|w)$/i);
  if (!match) throw new Error(`Invalid duration format: "${duration}"`);
  const [, num, unit] = match;
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };
  return Math.round(parseFloat(num) * multipliers[unit.toLowerCase()]);
}

// ---------------------------------------------------------------------------
// Sign
// ---------------------------------------------------------------------------

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
function sign(payload, secret, options = {}) {
  if (!payload || typeof payload !== 'object') {
    throw new TypeError('JWT payload must be a plain object');
  }
  if (!secret) throw new TypeError('JWT secret is required');

  const {
    algorithm = DEFAULT_ALGORITHM,
    expiresIn,
    notBefore,
    issuer,
    audience,
    subject,
    jwtid,
  } = options;

  const alg = algorithm.toUpperCase();
  if (!ALG_MAP[alg]) {
    throw new Error(`Unsupported JWT algorithm: ${alg}. Supported: ${Object.keys(ALG_MAP).join(', ')}`);
  }

  const header = { alg, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);

  /** @type {Object} */
  const claims = { ...payload, iat: payload.iat || now };

  if (expiresIn !== undefined) claims.exp = now + parseDuration(expiresIn);
  if (notBefore !== undefined) claims.nbf = now + parseDuration(notBefore);
  if (issuer !== undefined) claims.iss = issuer;
  if (audience !== undefined) claims.aud = audience;
  if (subject !== undefined) claims.sub = subject;
  if (jwtid !== undefined) claims.jti = jwtid;

  const headerEncoded = base64urlEncode(JSON.stringify(header));
  const payloadEncoded = base64urlEncode(JSON.stringify(claims));
  const signingInput = `${headerEncoded}.${payloadEncoded}`;

  const sig = crypto
    .createHmac(ALG_MAP[alg], secret)
    .update(signingInput)
    .digest();

  return `${signingInput}.${base64urlEncode(sig)}`;
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

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
function verify(token, secret, options = {}) {
  if (!token || typeof token !== 'string') throw new TypeError('Token must be a string');
  if (!secret) throw new TypeError('Secret is required');

  const {
    clockTolerance = 0,
    ignoreExpiration = false,
    ignoreNotBefore = false,
    issuer,
    audience,
    subject,
  } = options;

  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT: expected 3 parts');

  const [headerEncoded, payloadEncoded, sigEncoded] = parts;

  // Decode header
  let header;
  try {
    header = JSON.parse(base64urlDecode(headerEncoded).toString('utf8'));
  } catch (_) {
    throw new Error('JWT header is not valid JSON');
  }

  const alg = (header.alg || '').toUpperCase();
  if (!ALG_MAP[alg]) {
    throw new Error(`Unsupported JWT algorithm in header: ${alg}`);
  }

  // Verify signature using timing-safe comparison
  const signingInput = `${headerEncoded}.${payloadEncoded}`;
  const expectedSig = crypto
    .createHmac(ALG_MAP[alg], secret)
    .update(signingInput)
    .digest();

  const actualSig = base64urlDecode(sigEncoded);

  if (expectedSig.length !== actualSig.length || !crypto.timingSafeEqual(expectedSig, actualSig)) {
    throw new Error('JWT signature verification failed');
  }

  // Decode payload
  let payload;
  try {
    payload = JSON.parse(base64urlDecode(payloadEncoded).toString('utf8'));
  } catch (_) {
    throw new Error('JWT payload is not valid JSON');
  }

  const now = Math.floor(Date.now() / 1000);

  // Validate exp
  if (!ignoreExpiration && payload.exp !== undefined) {
    if (now > payload.exp + clockTolerance) {
      throw new Error(`JWT expired at ${new Date(payload.exp * 1000).toISOString()}`);
    }
  }

  // Validate nbf
  if (!ignoreNotBefore && payload.nbf !== undefined) {
    if (now < payload.nbf - clockTolerance) {
      throw new Error(`JWT not valid before ${new Date(payload.nbf * 1000).toISOString()}`);
    }
  }

  // Validate issuer
  if (issuer !== undefined && payload.iss !== issuer) {
    throw new Error(`JWT issuer mismatch: expected "${issuer}", got "${payload.iss}"`);
  }

  // Validate audience
  if (audience !== undefined) {
    const audList = Array.isArray(audience) ? audience : [audience];
    const tokenAud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audList.some((a) => tokenAud.includes(a))) {
      throw new Error(`JWT audience mismatch`);
    }
  }

  // Validate subject
  if (subject !== undefined && payload.sub !== subject) {
    throw new Error(`JWT subject mismatch: expected "${subject}", got "${payload.sub}"`);
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Decode (no verification)
// ---------------------------------------------------------------------------

/**
 * Decodes a JWT without verifying the signature.
 * @param {string} token
 * @returns {{ header: Object, payload: Object, signature: string }}
 */
function decode(token) {
  if (!token || typeof token !== 'string') throw new TypeError('Token must be a string');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT');

  return {
    header: JSON.parse(base64urlDecode(parts[0]).toString('utf8')),
    payload: JSON.parse(base64urlDecode(parts[1]).toString('utf8')),
    signature: parts[2],
  };
}

// ---------------------------------------------------------------------------
// Refresh
// ---------------------------------------------------------------------------

/**
 * Verifies an existing token and issues a new one with a fresh expiry.
 * @param {string} token - Existing JWT
 * @param {string|Buffer} secret - Signing secret
 * @param {Object} [options={}] - Same as sign options
 * @returns {string} New JWT
 */
function refresh(token, secret, options = {}) {
  const payload = verify(token, secret, { ...options, ignoreExpiration: true });
  // Remove time claims so sign() recalculates them
  const { iat, exp, nbf, ...claims } = payload;
  return sign(claims, secret, options);
}

/**
 * Generates a cryptographically random JWT ID.
 * @returns {string}
 */
function generateJwtId() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = {
  sign,
  verify,
  decode,
  refresh,
  generateJwtId,
  parseDuration,
  base64urlEncode,
  base64urlDecode,
};
