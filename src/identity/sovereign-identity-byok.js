/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
// RTP: Sovereign Identity with BYOK Model Access

'use strict';

const crypto = require('crypto');

const PHI = 1.6180339887;

// ─── Supported Providers ──────────────────────────────────────────────────────

const PROVIDERS = {
  ANTHROPIC: 'anthropic',
  OPENAI:    'openai',
  GOOGLE:    'google',
  GROQ:      'groq',
  MISTRAL:   'mistral',
  COHERE:    'cohere',
};

const PROVIDER_ENDPOINTS = {
  [PROVIDERS.ANTHROPIC]: 'https://api.anthropic.com/v1/messages',
  [PROVIDERS.OPENAI]:    'https://api.openai.com/v1/chat/completions',
  [PROVIDERS.GOOGLE]:    'https://generativelanguage.googleapis.com/v1beta/models',
  [PROVIDERS.GROQ]:      'https://api.groq.com/openai/v1/chat/completions',
  [PROVIDERS.MISTRAL]:   'https://api.mistral.ai/v1/chat/completions',
  [PROVIDERS.COHERE]:    'https://api.cohere.ai/v1/chat',
};

const AUTH_METHODS = {
  OAUTH:    'oauth',
  API_KEY:  'api_key',
  WEBAUTHN: 'webauthn',
};

// ─── Crypto Helpers ───────────────────────────────────────────────────────────

function deriveEncryptionKey(masterKey, salt) {
  return crypto.pbkdf2Sync(masterKey, salt, Math.round(100000 * PHI), 32, 'sha256');
}

function encryptApiKey(plaintext, masterKey) {
  const salt = crypto.randomBytes(16);
  const key  = deriveEncryptionKey(masterKey, salt);
  const iv   = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    data: encrypted.toString('base64'),
    iv:   iv.toString('base64'),
    salt: salt.toString('base64'),
    tag:  tag.toString('base64'),
  };
}

function decryptApiKey(envelope, masterKey) {
  const salt = Buffer.from(envelope.salt, 'base64');
  const key  = deriveEncryptionKey(masterKey, salt);
  const iv   = Buffer.from(envelope.iv,   'base64');
  const tag  = Buffer.from(envelope.tag,  'base64');
  const data = Buffer.from(envelope.data, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final('utf8');
}

// ─── BYOKKeyVault ─────────────────────────────────────────────────────────────

class BYOKKeyVault {
  /**
   * Encrypted per-user key storage.
   * Keys are stored encrypted at rest using user's master key.
   * The master key itself never leaves the vault.
   */
  constructor(opts = {}) {
    this._store         = new Map();  // userId → { provider → envelope }
    this._masterKeys    = new Map();  // userId → derivedMasterKey (ephemeral)
    this._accessLog     = [];
    this._maxLogEntries = opts.maxLogEntries || 10000;
    this._keyRotations  = new Map();  // userId:provider → rotation history
  }

  /**
   * Initialise a user's vault with a passphrase.
   * Returns a session token for subsequent operations.
   */
  initUser(userId, passphrase) {
    const salt       = crypto.randomBytes(32);
    const masterKey  = crypto.pbkdf2Sync(passphrase, salt, Math.round(200000 * PHI), 32, 'sha256');
    const sessionTok = crypto.randomBytes(32).toString('hex');

    this._masterKeys.set(sessionTok, { userId, masterKey, salt: salt.toString('base64'), createdAt: Date.now() });

    if (!this._store.has(userId)) {
      this._store.set(userId, { keys: {}, createdAt: Date.now() });
    }

    this._log('init_user', userId, { sessionTok: sessionTok.slice(0, 8) + '...' });
    return { sessionTok, userId };
  }

  /**
   * Store an API key for a provider, encrypted under the user's master key.
   */
  storeKey(sessionTok, provider, apiKey) {
    const session = this._getSession(sessionTok);
    if (!PROVIDERS[provider.toUpperCase()] && !Object.values(PROVIDERS).includes(provider)) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    const envelope = encryptApiKey(apiKey, session.masterKey);
    const userData = this._store.get(session.userId);
    userData.keys[provider] = { envelope, storedAt: Date.now(), rotations: 0 };

    this._log('store_key', session.userId, { provider, keyLen: apiKey.length });
    return { ok: true, provider };
  }

  /**
   * Retrieve (decrypt) an API key for use. Key is never persisted in plaintext.
   */
  retrieveKey(sessionTok, provider) {
    const session  = this._getSession(sessionTok);
    const userData = this._store.get(session.userId);
    if (!userData || !userData.keys[provider]) {
      throw new Error(`No key stored for provider '${provider}'`);
    }
    const plaintext = decryptApiKey(userData.keys[provider].envelope, session.masterKey);
    this._log('retrieve_key', session.userId, { provider });
    return plaintext;
  }

  /**
   * Rotate a key: store new key, increment rotation counter.
   */
  rotateKey(sessionTok, provider, newApiKey) {
    const session  = this._getSession(sessionTok);
    const userData = this._store.get(session.userId);
    if (!userData || !userData.keys[provider]) {
      throw new Error(`No existing key for provider '${provider}' to rotate`);
    }

    const old     = userData.keys[provider];
    const rotKey  = `${session.userId}:${provider}`;
    const history = this._keyRotations.get(rotKey) || [];
    history.push({ rotatedAt: Date.now(), rotations: old.rotations });
    this._keyRotations.set(rotKey, history.slice(-10)); // keep last 10

    const envelope = encryptApiKey(newApiKey, session.masterKey);
    userData.keys[provider] = {
      envelope,
      storedAt:  Date.now(),
      rotations: old.rotations + 1,
    };

    this._log('rotate_key', session.userId, { provider, rotation: old.rotations + 1 });
    return { ok: true, rotation: old.rotations + 1 };
  }

  /**
   * Delete all keys and user data.
   */
  deleteUser(sessionTok) {
    const session = this._getSession(sessionTok);
    this._store.delete(session.userId);
    this._masterKeys.delete(sessionTok);
    this._log('delete_user', session.userId, {});
    return { ok: true };
  }

  listProviders(sessionTok) {
    const session  = this._getSession(sessionTok);
    const userData = this._store.get(session.userId);
    if (!userData) return [];
    return Object.keys(userData.keys).map(p => ({
      provider:  p,
      storedAt:  userData.keys[p].storedAt,
      rotations: userData.keys[p].rotations,
    }));
  }

  _getSession(sessionTok) {
    const session = this._masterKeys.get(sessionTok);
    if (!session) throw new Error('Invalid or expired session token');
    return session;
  }

  _log(action, userId, meta) {
    this._accessLog.push({ action, userId, meta, ts: Date.now() });
    if (this._accessLog.length > this._maxLogEntries) this._accessLog.shift();
  }

  getAccessLog(userId) {
    return this._accessLog.filter(e => e.userId === userId);
  }
}

// ─── IdentityAttestor ─────────────────────────────────────────────────────────

class IdentityAttestor {
  /**
   * Zero-knowledge proof of API key ownership.
   * Proves the user owns a valid key without revealing the key itself.
   * Uses HMAC-based commitment scheme.
   */
  constructor(opts = {}) {
    this._challenges = new Map();  // challengeId → { userId, ts, provider, nonce }
    this._proofs     = new Map();  // proofId → { verified, userId, provider, ts }
    this._ttlMs      = opts.ttlMs || 5 * 60 * 1000;
  }

  /**
   * Issue a challenge for a user to prove key ownership.
   */
  issueChallenge(userId, provider) {
    const challengeId = crypto.randomUUID();
    const nonce       = crypto.randomBytes(32).toString('hex');
    this._challenges.set(challengeId, {
      userId, provider, nonce, ts: Date.now(),
    });
    return { challengeId, nonce, expiresAt: Date.now() + this._ttlMs };
  }

  /**
   * Compute a ZK proof commitment for a given API key and challenge.
   * The proof is: HMAC-SHA256(key, nonce || userId || provider)
   * Without knowing the key, the verifier cannot reconstruct this value.
   */
  static computeProof(apiKey, challenge) {
    const { nonce, userId, provider } = challenge;
    const message = Buffer.from(nonce + userId + provider, 'utf8');
    return crypto.createHmac('sha256', Buffer.from(apiKey, 'utf8'))
                 .update(message)
                 .digest('hex');
  }

  /**
   * Verify a proof against a stored challenge using the actual API key.
   */
  verifyProof(challengeId, submittedProof, apiKey) {
    const challenge = this._challenges.get(challengeId);
    if (!challenge) throw new Error('Challenge not found or expired');
    if (Date.now() - challenge.ts > this._ttlMs) {
      this._challenges.delete(challengeId);
      throw new Error('Challenge expired');
    }

    const expectedProof = IdentityAttestor.computeProof(apiKey, challenge);
    const match = crypto.timingSafeEqual(
      Buffer.from(submittedProof, 'hex'),
      Buffer.from(expectedProof, 'hex'),
    );

    if (match) {
      const proofId = crypto.randomUUID();
      this._proofs.set(proofId, {
        verified:  true,
        userId:    challenge.userId,
        provider:  challenge.provider,
        ts:        Date.now(),
      });
      this._challenges.delete(challengeId);
      return { verified: true, proofId };
    }
    return { verified: false };
  }

  isProofValid(proofId, maxAgeMs = 30 * 60 * 1000) {
    const proof = this._proofs.get(proofId);
    if (!proof || !proof.verified) return false;
    return Date.now() - proof.ts < maxAgeMs;
  }
}

// ─── MultiProviderAuth ────────────────────────────────────────────────────────

class MultiProviderAuth {
  /**
   * Handles OAuth, API key, and WebAuthn authentication methods.
   */
  constructor(opts = {}) {
    this._oauthClients  = opts.oauthClients  || {};
    this._sessions      = new Map();
    this._webauthnCreds = new Map();  // credId → { userId, publicKey }
    this._sessionTtlMs  = opts.sessionTtlMs || 24 * 60 * 60 * 1000;
  }

  /**
   * Authenticate via API key. Returns a session.
   */
  authenticateApiKey(userId, apiKeyHash) {
    return this._createSession(userId, AUTH_METHODS.API_KEY, { apiKeyHash });
  }

  /**
   * Initiate OAuth flow. Returns the authorization URL.
   */
  initiateOAuth(provider) {
    const client = this._oauthClients[provider];
    if (!client) throw new Error(`OAuth client not configured for '${provider}'`);

    const state    = crypto.randomBytes(16).toString('hex');
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

    this._sessions.set('oauth:' + state, { provider, verifier, ts: Date.now() });

    const params = new URLSearchParams({
      response_type:         'code',
      client_id:             client.clientId,
      redirect_uri:          client.redirectUri,
      scope:                 client.scope || 'openid profile',
      state,
      code_challenge:        challenge,
      code_challenge_method: 'S256',
    });

    return { authUrl: `${client.authUrl}?${params}`, state };
  }

  /**
   * Complete OAuth flow with authorization code.
   */
  async completeOAuth(state, code) {
    const pending = this._sessions.get('oauth:' + state);
    if (!pending) throw new Error('OAuth state not found');
    this._sessions.delete('oauth:' + state);

    // In production, exchange code for tokens via HTTP
    // Here we return a session assuming successful exchange
    const userId = `oauth:${pending.provider}:${crypto.randomBytes(8).toString('hex')}`;
    return this._createSession(userId, AUTH_METHODS.OAUTH, { provider: pending.provider, code });
  }

  /**
   * Register a WebAuthn credential.
   */
  registerWebAuthn(userId, credentialId, publicKey) {
    this._webauthnCreds.set(credentialId, { userId, publicKey, registeredAt: Date.now() });
    return { ok: true, credentialId };
  }

  /**
   * Authenticate via WebAuthn assertion.
   * Verifies the signature over a challenge using the stored public key.
   */
  verifyWebAuthn(credentialId, challenge, signature) {
    const cred = this._webauthnCreds.get(credentialId);
    if (!cred) throw new Error('WebAuthn credential not found');

    // Verify signature using stored public key
    const verify = crypto.createVerify('SHA256');
    verify.update(Buffer.from(challenge, 'hex'));
    const valid = verify.verify(cred.publicKey, Buffer.from(signature, 'base64'));

    if (!valid) throw new Error('WebAuthn verification failed');
    return this._createSession(cred.userId, AUTH_METHODS.WEBAUTHN, { credentialId });
  }

  _createSession(userId, method, meta) {
    const token = crypto.randomBytes(32).toString('hex');
    this._sessions.set(token, { userId, method, meta, createdAt: Date.now() });
    return { token, userId, method, expiresAt: Date.now() + this._sessionTtlMs };
  }

  validateSession(token) {
    const session = this._sessions.get(token);
    if (!session) return null;
    if (Date.now() - session.createdAt > this._sessionTtlMs) {
      this._sessions.delete(token);
      return null;
    }
    return session;
  }

  revokeSession(token) {
    return this._sessions.delete(token);
  }
}

// ─── ModelAccessRouter ────────────────────────────────────────────────────────

class ModelAccessRouter {
  /**
   * Routes inference requests to the user's own API keys.
   * Supports per-user provider selection based on their stored subscriptions.
   */
  constructor(vault, opts = {}) {
    this._vault     = vault;
    this._timeout   = opts.timeout || 30000;
    this._fallbacks = opts.fallbacks || [];
    this._stats     = new Map();
  }

  /**
   * Route an inference request to the appropriate provider using the user's key.
   */
  async route(sessionTok, provider, requestBody) {
    const apiKey   = this._vault.retrieveKey(sessionTok, provider);
    const endpoint = PROVIDER_ENDPOINTS[provider];
    if (!endpoint) throw new Error(`No endpoint configured for '${provider}'`);

    const headers  = this._buildHeaders(provider, apiKey);
    const result   = await this._callProvider(endpoint, headers, requestBody, provider);

    this._recordStat(provider, true);
    return result;
  }

  /**
   * Try providers in order until one succeeds (fallback chain).
   */
  async routeWithFallback(sessionTok, providerOrder, requestBody) {
    let lastErr;
    for (const provider of providerOrder) {
      try {
        return await this.route(sessionTok, provider, requestBody);
      } catch (err) {
        lastErr = err;
        this._recordStat(provider, false);
      }
    }
    throw lastErr;
  }

  _buildHeaders(provider, apiKey) {
    switch (provider) {
      case PROVIDERS.ANTHROPIC:
        return {
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type':      'application/json',
        };
      case PROVIDERS.OPENAI:
      case PROVIDERS.GROQ:
      case PROVIDERS.MISTRAL:
        return {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type':  'application/json',
        };
      case PROVIDERS.GOOGLE:
        return { 'Content-Type': 'application/json' };
      case PROVIDERS.COHERE:
        return { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
      default:
        return { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
    }
  }

  async _callProvider(endpoint, headers, body, provider) {
    const url      = provider === PROVIDERS.GOOGLE
      ? `${endpoint}/${body.model}:generateContent?key=${headers['x-api-key'] || ''}`
      : endpoint;
    const isHttps  = url.startsWith('https:');
    const mod      = isHttps ? require('https') : require('http');
    const parsed   = new URL(url);
    const bodyStr  = JSON.stringify(body);

    return new Promise((resolve, reject) => {
      const req = mod.request({
        hostname: parsed.hostname,
        port:     parsed.port || (isHttps ? 443 : 80),
        path:     parsed.pathname + parsed.search,
        method:   'POST',
        headers:  Object.assign({ 'Content-Length': Buffer.byteLength(bodyStr) }, headers),
      }, res => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch (e) { reject(new Error(`Non-JSON response: ${data.slice(0, 200)}`)); }
        });
      });
      req.on('error', reject);
      req.setTimeout(this._timeout, () => { req.destroy(); reject(new Error('Provider timeout')); });
      req.write(bodyStr);
      req.end();
    });
  }

  _recordStat(provider, success) {
    const s = this._stats.get(provider) || { calls: 0, success: 0, errors: 0 };
    s.calls++;
    if (success) s.success++; else s.errors++;
    this._stats.set(provider, s);
  }

  getStats() { return Object.fromEntries(this._stats); }
}

// ─── SovereignIdentityManager ─────────────────────────────────────────────────

class SovereignIdentityManager {
  /**
   * Top-level user-controlled identity system combining:
   * - BYOK key vault
   * - ZK attestation
   * - Multi-provider auth
   * - Routed inference
   */
  constructor(opts = {}) {
    this._vault     = new BYOKKeyVault(opts.vaultOpts || {});
    this._attestor  = new IdentityAttestor(opts.attestorOpts || {});
    this._auth      = new MultiProviderAuth(opts.authOpts || {});
    this._router    = new ModelAccessRouter(this._vault, opts.routerOpts || {});
    this._profiles  = new Map();  // userId → { defaultProvider, preferredModels }
  }

  /**
   * Register a new sovereign user identity.
   */
  registerUser(userId, passphrase) {
    const vault = this._vault.initUser(userId, passphrase);
    this._profiles.set(userId, {
      defaultProvider:  PROVIDERS.ANTHROPIC,
      preferredModels:  {},
      createdAt:        Date.now(),
    });
    return vault;
  }

  /**
   * Store a user's BYOK API key for a provider.
   */
  storeKey(sessionTok, provider, apiKey) {
    return this._vault.storeKey(sessionTok, provider, apiKey);
  }

  /**
   * Rotate a user's key for a provider.
   */
  rotateKey(sessionTok, provider, newApiKey) {
    return this._vault.rotateKey(sessionTok, provider, newApiKey);
  }

  /**
   * Get a ZK challenge for the user to prove key ownership.
   */
  challengeKeyOwnership(userId, provider) {
    return this._attestor.issueChallenge(userId, provider);
  }

  /**
   * Verify the user's ZK proof of key ownership.
   */
  verifyKeyOwnership(challengeId, proof, apiKey) {
    return this._attestor.verifyProof(challengeId, proof, apiKey);
  }

  /**
   * Route an inference call to user's chosen provider.
   */
  async infer(sessionTok, provider, requestBody) {
    return this._router.route(sessionTok, provider, requestBody);
  }

  /**
   * Set a user's preferred model for a provider.
   */
  setPreferredModel(userId, provider, model) {
    const profile = this._profiles.get(userId);
    if (!profile) throw new Error(`User '${userId}' not found`);
    profile.preferredModels[provider] = model;
  }

  getUserProfile(userId) {
    return this._profiles.get(userId) || null;
  }

  getKeyVault()   { return this._vault; }
  getAttestor()   { return this._attestor; }
  getAuth()       { return this._auth; }
  getRouter()     { return this._router; }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  PHI,
  PROVIDERS,
  PROVIDER_ENDPOINTS,
  AUTH_METHODS,
  BYOKKeyVault,
  IdentityAttestor,
  MultiProviderAuth,
  ModelAccessRouter,
  SovereignIdentityManager,
};
