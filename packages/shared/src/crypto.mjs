import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

export function randomId() {
  return crypto.randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password, stored) {
  const [salt, expected] = String(stored || '').split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

export function signToken(payload, secret, expiresIn = '7d') {
  return jwt.sign(payload, secret, { expiresIn });
}

export function verifyToken(token, secret) {
  return jwt.verify(token, secret);
}

export function createApiKey() {
  const raw = crypto.randomBytes(24).toString('base64url');
  return `heady_${raw}`;
}

export function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function apiKeyPrefix(key) {
  return key.slice(0, 18);
}
