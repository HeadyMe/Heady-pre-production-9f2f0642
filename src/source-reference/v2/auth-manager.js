/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const crypto = require('crypto');
const logger = require('../../utils/logger');
const HeadyJWT = require('../../core/heady-jwt');
const HeadyKV = require('../../core/heady-kv');

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES = Object.freeze({
  ADMIN: 'admin',
  OPERATOR: 'operator',
  USER: 'user',
  GUEST: 'guest',
});

const ROLE_HIERARCHY = {
  [ROLES.ADMIN]: 4,
  [ROLES.OPERATOR]: 3,
  [ROLES.USER]: 2,
  [ROLES.GUEST]: 1,
};

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;   // 8 h
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const ACCESS_TTL_S   = 60 * 60;               // 1 h (JWT exp)
const API_KEY_PREFIX = 'hdy_';

// ─── AuthManager ─────────────────────────────────────────────────────────────

class AuthManager {
  /**
   * @param {object} opts
   * @param {string}  [opts.jwtSecret]
   * @param {object}  [opts.kv]         - HeadyKV instance
   * @param {number}  [opts.sessionTtlMs]
   */
  constructor(opts = {}) {
    this._jwt = opts.jwt || new HeadyJWT({ secret: opts.jwtSecret || process.env.JWT_SECRET || 'heady-default-secret-change-in-prod' });
    this._kv  = opts.kv  || new HeadyKV({ namespace: 'auth' });

    this.sessionTtlMs = opts.sessionTtlMs ?? SESSION_TTL_MS;

    logger.info('[AuthManager] initialized');
  }

  // ─── Token Operations ───────────────────────────────────────────────────────

  /**
   * Create a signed JWT access token and persist a session.
   * @param {object} user  - { id, email, role, ... }
   * @returns {{ accessToken, refreshToken, expiresIn, sessionId }}
   */
  async createToken(user) {
    _validateUser(user);

    const sessionId = _randomId();
    const now = Math.floor(Date.now() / 1000);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role || ROLES.USER,
      sessionId,
      iat: now,
      exp: now + ACCESS_TTL_S,
    };

    const accessToken = await this._jwt.sign(payload);
    const refreshToken = _randomId(64);

    // Persist session in KV
    const session = {
      userId: user.id,
      email: user.email,
      role: user.role || ROLES.USER,
      refreshToken: _hashSecret(refreshToken),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.sessionTtlMs).toISOString(),
      meta: user.meta || {},
    };
    await this._kv.set(`session:${sessionId}`, session, { ttlMs: this.sessionTtlMs });

    // Also index refresh token → session
    await this._kv.set(`refresh:${_hashSecret(refreshToken)}`, sessionId, { ttlMs: REFRESH_TTL_MS });

    logger.info('[AuthManager] token created', { userId: user.id, role: session.role, sessionId });

    return { accessToken, refreshToken, expiresIn: ACCESS_TTL_S, sessionId };
  }

  /**
   * Verify an access token.
   * @param {string} token
   * @returns {{ valid, payload, error }}
   */
  async verifyToken(token) {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Token is required' };
    }

    // Strip Bearer prefix if present
    const raw = token.startsWith('Bearer ') ? token.slice(7) : token;

    let payload;
    try {
      payload = await this._jwt.verify(raw);
    } catch (err) {
      logger.debug('[AuthManager] token verification failed', { err: err.message });
      return { valid: false, error: err.message };
    }

    // Check session is still alive
    if (payload.sessionId) {
      const session = await this._kv.get(`session:${payload.sessionId}`);
      if (!session) {
        return { valid: false, error: 'Session expired or revoked' };
      }
    }

    return { valid: true, payload };
  }

  /**
   * Refresh an access token using a refresh token.
   * @param {string} refreshToken
   * @returns {{ accessToken, refreshToken, expiresIn, sessionId }}
   */
  async refreshToken(refreshToken) {
    if (!refreshToken) throw new Error('Refresh token required');

    const hash = _hashSecret(refreshToken);
    const sessionId = await this._kv.get(`refresh:${hash}`);

    if (!sessionId) {
      throw new Error('Invalid or expired refresh token');
    }

    const session = await this._kv.get(`session:${sessionId}`);
    if (!session) {
      throw new Error('Session not found');
    }

    // Validate stored hash matches
    if (session.refreshToken !== hash) {
      throw new Error('Refresh token mismatch');
    }

    // Rotate: invalidate old refresh token, create new tokens
    await this._kv.del(`refresh:${hash}`);
    await this._kv.del(`session:${sessionId}`);

    return this.createToken({
      id: session.userId,
      email: session.email,
      role: session.role,
      meta: session.meta,
    });
  }

  /**
   * Revoke a session immediately.
   * @param {string} sessionId
   */
  async revokeSession(sessionId) {
    const session = await this._kv.get(`session:${sessionId}`);
    if (session) {
      await this._kv.del(`refresh:${session.refreshToken}`);
      await this._kv.del(`session:${sessionId}`);
      logger.info('[AuthManager] session revoked', { sessionId });
      return true;
    }
    return false;
  }

  // ─── API Key Management ─────────────────────────────────────────────────────

  /**
   * Generate a new API key for a user.
   * @param {string} userId
   * @param {object} opts  - { role, description, ttlMs }
   * @returns {{ apiKey, keyId }}
   */
  async createApiKey(userId, opts = {}) {
    const rawKey = API_KEY_PREFIX + _randomId(40);
    const keyId  = _randomId(16);
    const hash   = _hashSecret(rawKey);

    const record = {
      userId,
      keyId,
      hash,
      role: opts.role || ROLES.USER,
      description: opts.description || '',
      createdAt: new Date().toISOString(),
      expiresAt: opts.ttlMs ? new Date(Date.now() + opts.ttlMs).toISOString() : null,
      lastUsed: null,
    };

    await this._kv.set(`apikey:${keyId}`, record, opts.ttlMs ? { ttlMs: opts.ttlMs } : undefined);
    // index hash → keyId for O(1) lookup
    await this._kv.set(`apikeyhash:${hash}`, keyId, opts.ttlMs ? { ttlMs: opts.ttlMs } : undefined);

    logger.info('[AuthManager] API key created', { userId, keyId, role: record.role });
    return { apiKey: rawKey, keyId };
  }

  /**
   * Validate an API key.
   * @param {string} apiKey
   * @returns {{ valid, record }}
   */
  async validateApiKey(apiKey) {
    if (!apiKey || !apiKey.startsWith(API_KEY_PREFIX)) {
      return { valid: false, error: 'Invalid API key format' };
    }

    const hash  = _hashSecret(apiKey);
    const keyId = await this._kv.get(`apikeyhash:${hash}`);
    if (!keyId) return { valid: false, error: 'API key not found' };

    const record = await this._kv.get(`apikey:${keyId}`);
    if (!record) return { valid: false, error: 'API key record missing' };

    if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
      return { valid: false, error: 'API key expired' };
    }

    // Update last used
    record.lastUsed = new Date().toISOString();
    await this._kv.set(`apikey:${keyId}`, record);

    return { valid: true, record };
  }

  /**
   * Revoke an API key.
   * @param {string} keyId
   */
  async revokeApiKey(keyId) {
    const record = await this._kv.get(`apikey:${keyId}`);
    if (record) {
      await this._kv.del(`apikeyhash:${record.hash}`);
      await this._kv.del(`apikey:${keyId}`);
      logger.info('[AuthManager] API key revoked', { keyId });
      return true;
    }
    return false;
  }

  // ─── Role-Based Access Control ──────────────────────────────────────────────

  /**
   * Check if a role meets a required minimum role.
   * @param {string} userRole
   * @param {string} requiredRole
   * @returns {boolean}
   */
  hasRole(userRole, requiredRole) {
    return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || Infinity);
  }

  /**
   * Express-compatible middleware factory.
   * @param {string} requiredRole
   */
  requireRole(requiredRole) {
    return async (req, res, next) => {
      try {
        const token = req.headers.authorization;
        const { valid, payload, error } = await this.verifyToken(token);
        if (!valid) return res.status(401).json({ error });
        if (!this.hasRole(payload.role, requiredRole)) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        req.user = payload;
        next();
      } catch (err) {
        next(err);
      }
    };
  }

  // ─── OAuth2 Stubs (OIDC future integration) ─────────────────────────────────

  /**
   * Begin OAuth2 authorization code flow.
   * @param {object} opts - { provider, redirectUri, scope, state }
   * @returns {{ authUrl, state }}
   */
  async beginOAuth2Flow(opts = {}) {
    const state = opts.state || _randomId(32);
    const provider = opts.provider || 'generic';

    // Persist state for CSRF validation
    await this._kv.set(`oauth2state:${state}`, {
      provider,
      redirectUri: opts.redirectUri,
      createdAt: new Date().toISOString(),
    }, { ttlMs: 10 * 60 * 1000 }); // 10 min

    // In production, build real provider-specific URLs
    const authUrl = `https://auth.example.com/oauth2/authorize?` +
      `client_id=heady&response_type=code&scope=${encodeURIComponent(opts.scope || 'openid profile email')}` +
      `&redirect_uri=${encodeURIComponent(opts.redirectUri || '')}` +
      `&state=${state}`;

    logger.info('[AuthManager] OAuth2 flow begun', { provider, state });
    return { authUrl, state };
  }

  /**
   * Exchange OAuth2 authorization code for tokens.
   * @param {object} opts - { code, state, redirectUri }
   * @returns {{ accessToken, refreshToken, expiresIn, sessionId }}
   */
  async handleOAuth2Callback(opts = {}) {
    const { code, state } = opts;
    if (!code || !state) throw new Error('code and state are required');

    const storedState = await this._kv.get(`oauth2state:${state}`);
    if (!storedState) throw new Error('Invalid or expired OAuth2 state');
    await this._kv.del(`oauth2state:${state}`);

    // TODO: exchange code with provider token endpoint
    // Stub: create a user session from code (replace with real OIDC exchange)
    const stubUser = {
      id: `oauth2:${_hashSecret(code).slice(0, 16)}`,
      email: `oauth2-user@${storedState.provider}.example`,
      role: ROLES.USER,
      meta: { provider: storedState.provider, oauthCode: '[redacted]' },
    };

    logger.info('[AuthManager] OAuth2 callback handled (stub)', { provider: storedState.provider });
    return this.createToken(stubUser);
  }

  // ─── Session Query ───────────────────────────────────────────────────────────

  /**
   * Get session details.
   * @param {string} sessionId
   */
  async getSession(sessionId) {
    const session = await this._kv.get(`session:${sessionId}`);
    if (!session) return null;
    const { refreshToken: _rt, ...safe } = session; // never expose hash externally
    return safe;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _validateUser(user) {
  if (!user || typeof user !== 'object') throw new Error('user must be an object');
  if (!user.id) throw new Error('user.id is required');
  if (!user.email) throw new Error('user.email is required');
  if (user.role && !ROLE_HIERARCHY[user.role]) {
    throw new Error(`Invalid role: ${user.role}. Must be one of ${Object.values(ROLES).join(', ')}`);
  }
}

function _randomId(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function _hashSecret(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { AuthManager, ROLES, ROLE_HIERARCHY };
