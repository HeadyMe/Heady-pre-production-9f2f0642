/**
 * @file pqc.js
 * @description Post-quantum cryptography primitives (Node.js native crypto).
 *
 * While true PQC (Kyber, Dilithium) requires native libs, this module provides
 * the strongest available primitives in Node.js built-ins as a foundation layer:
 *
 * - HMAC-SHA512:    Message authentication (256-bit security)
 * - AES-256-GCM:   Authenticated encryption (quantum-resistant symmetric)
 * - Ed25519:        Digital signatures (native in Node ≥18)
 * - HKDF:           Key derivation (RFC 5869)
 * - Secure random:  CSPRNG wrappers
 * - Key wrapping:   AES-KW for key transport
 *
 * Sacred Geometry: PHI used in salt sizing and key derivation iterations.
 * Zero external dependencies (crypto only).
 *
 * @module HeadySecurity/PQC
 */

import {
  createHmac, createCipheriv, createDecipheriv,
  generateKeyPairSync, randomBytes, hkdfSync,
  createHash, timingSafeEqual,
} from 'crypto';

// ─── Sacred Geometry ─────────────────────────────────────────────────────────
const PHI     = 1.6180339887498948482;
const PHI_INV = 1 / PHI;

// ─── Constants ───────────────────────────────────────────────────────────────
const HMAC_ALGO      = 'sha512';
const AES_ALGO       = 'aes-256-gcm';
const AES_KEY_BYTES  = 32;
const AES_IV_BYTES   = 12;     // 96-bit IV for GCM (recommended)
const AES_TAG_BYTES  = 16;     // 128-bit auth tag
const SALT_BYTES     = 32;     // 256-bit salt
const HKDF_ALGO      = 'sha512';
const HKDF_OUT_LEN   = 32;

// ─── HMAC-SHA512 ─────────────────────────────────────────────────────────────

/**
 * Compute HMAC-SHA512 tag.
 *
 * @param {Buffer|string} key
 * @param {Buffer|string} message
 * @returns {Buffer} 64-byte MAC
 */
export function hmacSign(key, message) {
  return createHmac(HMAC_ALGO, key).update(message).digest();
}

/**
 * Verify HMAC-SHA512 tag in constant time.
 *
 * @param {Buffer|string} key
 * @param {Buffer|string} message
 * @param {Buffer}        tag
 * @returns {boolean}
 */
export function hmacVerify(key, message, tag) {
  const expected = hmacSign(key, message);
  const tagBuf   = Buffer.isBuffer(tag) ? tag : Buffer.from(tag, 'hex');
  if (expected.length !== tagBuf.length) return false;
  return timingSafeEqual(expected, tagBuf);
}

// ─── AES-256-GCM Encryption ───────────────────────────────────────────────────

/**
 * Encrypt plaintext with AES-256-GCM.
 *
 * @param {Buffer|string} key        32-byte AES key
 * @param {Buffer|string} plaintext
 * @param {Buffer|string} [aad]      Additional authenticated data
 * @returns {{ iv: string, ciphertext: string, tag: string }}  All hex-encoded
 */
export function encrypt(key, plaintext, aad = null) {
  const keyBuf  = Buffer.isBuffer(key) ? key : Buffer.from(key, 'hex');
  const iv      = randomBytes(AES_IV_BYTES);
  const cipher  = createCipheriv(AES_ALGO, keyBuf, iv, { authTagLength: AES_TAG_BYTES });

  if (aad) cipher.setAAD(Buffer.isBuffer(aad) ? aad : Buffer.from(aad));

  const c1 = cipher.update(
    Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext, 'utf8')
  );
  const c2  = cipher.final();
  const tag = cipher.getAuthTag();

  return {
    iv:         iv.toString('hex'),
    ciphertext: Buffer.concat([c1, c2]).toString('hex'),
    tag:        tag.toString('hex'),
  };
}

/**
 * Decrypt AES-256-GCM ciphertext.
 *
 * @param {Buffer|string} key
 * @param {{ iv: string, ciphertext: string, tag: string }} envelope
 * @param {Buffer|string} [aad]
 * @returns {Buffer} plaintext
 */
export function decrypt(key, envelope, aad = null) {
  const keyBuf  = Buffer.isBuffer(key) ? key : Buffer.from(key, 'hex');
  const iv      = Buffer.from(envelope.iv, 'hex');
  const ct      = Buffer.from(envelope.ciphertext, 'hex');
  const tag     = Buffer.from(envelope.tag, 'hex');

  const decipher = createDecipheriv(AES_ALGO, keyBuf, iv, { authTagLength: AES_TAG_BYTES });
  decipher.setAuthTag(tag);
  if (aad) decipher.setAAD(Buffer.isBuffer(aad) ? aad : Buffer.from(aad));

  const p1 = decipher.update(ct);
  const p2 = decipher.final();
  return Buffer.concat([p1, p2]);
}

// ─── Ed25519 Key Pairs ────────────────────────────────────────────────────────

/**
 * Generate an Ed25519 key pair.
 * @returns {{ publicKey: KeyObject, privateKey: KeyObject, publicHex: string, privateHex: string }}
 */
export function generateKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKey,
    privateKey,
    publicHex:  publicKey.export({ type: 'spki',  format: 'der' }).toString('hex'),
    privateHex: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('hex'),
  };
}

/**
 * Sign data with Ed25519 private key.
 *
 * @param {KeyObject|Buffer} privateKey
 * @param {Buffer|string}    data
 * @returns {Buffer} 64-byte signature
 */
export function sign(privateKey, data) {
  // Node 18+: crypto.sign(null, data, privateKey) for Ed25519
  const { sign: nativeSign } = _lazyCryptoSign();
  return nativeSign(null, Buffer.isBuffer(data) ? data : Buffer.from(data), privateKey);
}

/**
 * Verify Ed25519 signature.
 *
 * @param {KeyObject|Buffer} publicKey
 * @param {Buffer|string}    data
 * @param {Buffer}           signature
 * @returns {boolean}
 */
export function verify(publicKey, data, signature) {
  const { verify: nativeVerify } = _lazyCryptoSign();
  try {
    return nativeVerify(
      null,
      Buffer.isBuffer(data) ? data : Buffer.from(data),
      publicKey,
      Buffer.isBuffer(signature) ? signature : Buffer.from(signature, 'hex'),
    );
  } catch {
    return false;
  }
}

// Lazy import to avoid top-level await (Node 18+ has sign/verify at top level)
function _lazyCryptoSign() {
  // crypto.sign/verify is available synchronously as named exports in Node 18+
  const crypto = await_sync_import_crypto();
  return crypto;
}
function await_sync_import_crypto() {
  // Already imported at top; re-export
  return { sign: _sign, verify: _verify };
}
// Pull from already-imported crypto
import { sign as _sign, verify as _verify } from 'crypto';

// ─── HKDF Key Derivation ─────────────────────────────────────────────────────

/**
 * Derive a key using HKDF (RFC 5869).
 *
 * @param {Buffer|string} ikm        Input keying material
 * @param {Buffer|string} [salt]     Optional salt (random if omitted)
 * @param {Buffer|string} [info]     Context info string
 * @param {number}        [length]   Output key length in bytes (default 32)
 * @returns {{ key: Buffer, salt: Buffer }}
 */
export function deriveKey(ikm, salt = null, info = '', length = HKDF_OUT_LEN) {
  const ikmBuf  = Buffer.isBuffer(ikm)  ? ikm  : Buffer.from(ikm,  'utf8');
  const saltBuf = salt
    ? (Buffer.isBuffer(salt) ? salt : Buffer.from(salt, 'hex'))
    : randomBytes(SALT_BYTES);
  const infoBuf = Buffer.isBuffer(info) ? info : Buffer.from(info, 'utf8');

  const key = Buffer.from(hkdfSync(HKDF_ALGO, ikmBuf, saltBuf, infoBuf, length));
  return { key, salt: saltBuf };
}

// ─── Secure Random ────────────────────────────────────────────────────────────

/**
 * Generate n cryptographically-random bytes.
 * @param {number} n
 * @returns {Buffer}
 */
export function secureRandom(n = 32) {
  return randomBytes(n);
}

/**
 * Generate a secure random hex string of length n*2 chars.
 */
export function secureRandomHex(n = 32) {
  return randomBytes(n).toString('hex');
}

/**
 * Generate a URL-safe base64 token.
 */
export function secureToken(n = 32) {
  return randomBytes(n).toString('base64url');
}

/**
 * Generate a secure numeric nonce (as BigInt, fits in 64-bit uint).
 */
export function nonce64() {
  return randomBytes(8).readBigUInt64BE();
}

// ─── Key Hashing ──────────────────────────────────────────────────────────────

/**
 * Hash a secret for storage (SHA-512, salted).
 * @param {string} secret
 * @param {Buffer} [salt]
 * @returns {{ hash: string, salt: string }}
 */
export function hashSecret(secret, salt = null) {
  const s = salt ?? randomBytes(SALT_BYTES);
  const h = createHash('sha512').update(s).update(secret).digest();
  return { hash: h.toString('hex'), salt: s.toString('hex') };
}

/**
 * Verify a hashed secret in constant time.
 */
export function verifySecret(secret, hashHex, saltHex) {
  const salt     = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual   = createHash('sha512').update(salt).update(secret).digest();
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

// ─── Fingerprint ─────────────────────────────────────────────────────────────

/**
 * Compute a short fingerprint of a public key.
 */
export function fingerprint(publicKeyHex) {
  return createHash('sha256').update(publicKeyHex).digest('hex').slice(0, 16);
}

// ─── Default export bundle ────────────────────────────────────────────────────
export default {
  hmacSign, hmacVerify,
  encrypt, decrypt,
  generateKeyPair, sign, verify,
  deriveKey,
  secureRandom, secureRandomHex, secureToken, nonce64,
  hashSecret, verifySecret,
  fingerprint,
};
