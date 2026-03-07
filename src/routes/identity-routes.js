/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
'use strict';

const {
  PROVIDERS,
  SovereignIdentityManager,
  IdentityAttestor,
} = require('../identity/sovereign-identity-byok');

function respond(res, status, body) {
  if (res && typeof res.status === 'function') return res.status(status).json(body);
  if (res && typeof res.writeHead === 'function') {
    const data = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) });
    res.end(data);
  }
  return body;
}

function createIdentityRoutes(opts = {}) {
  const mgr    = opts.manager || new SovereignIdentityManager(opts.managerOpts || {});
  const routes = [];

  /**
   * POST /identity/register
   * Register a new sovereign identity.
   * Body: { userId: string, passphrase: string }
   */
  routes.push({
    method: 'POST',
    path:   '/identity/register',
    handler: async (req, res) => {
      const { userId, passphrase } = req.body || {};
      if (!userId || !passphrase) return respond(res, 400, { error: 'Missing userId or passphrase' });
      try {
        const result = mgr.registerUser(userId, passphrase);
        // Return session token - do NOT return passphrase
        return respond(res, 201, { ok: true, sessionTok: result.sessionTok, userId: result.userId });
      } catch (err) {
        return respond(res, 500, { error: err.message });
      }
    },
  });

  /**
   * POST /identity/key/store
   * Store an API key for a provider.
   * Body: { sessionTok: string, provider: string, apiKey: string }
   */
  routes.push({
    method: 'POST',
    path:   '/identity/key/store',
    handler: async (req, res) => {
      const { sessionTok, provider, apiKey } = req.body || {};
      if (!sessionTok || !provider || !apiKey) {
        return respond(res, 400, { error: 'Missing sessionTok, provider, or apiKey' });
      }
      try {
        const result = mgr.storeKey(sessionTok, provider, apiKey);
        return respond(res, 201, { ok: true, provider: result.provider });
      } catch (err) {
        const status = err.message.includes('Invalid') ? 401 : 400;
        return respond(res, status, { error: err.message });
      }
    },
  });

  /**
   * POST /identity/key/rotate
   * Rotate a provider API key.
   * Body: { sessionTok: string, provider: string, newApiKey: string }
   */
  routes.push({
    method: 'POST',
    path:   '/identity/key/rotate',
    handler: async (req, res) => {
      const { sessionTok, provider, newApiKey } = req.body || {};
      if (!sessionTok || !provider || !newApiKey) {
        return respond(res, 400, { error: 'Missing sessionTok, provider, or newApiKey' });
      }
      try {
        const result = mgr.rotateKey(sessionTok, provider, newApiKey);
        return respond(res, 200, { ok: true, rotation: result.rotation });
      } catch (err) {
        const status = err.message.includes('Invalid') ? 401 : 400;
        return respond(res, status, { error: err.message });
      }
    },
  });

  /**
   * GET /identity/keys
   * List providers for which the user has stored keys.
   * Headers: { x-session-token: string }
   */
  routes.push({
    method: 'GET',
    path:   '/identity/keys',
    handler: async (req, res) => {
      const sessionTok = (req.headers || {})['x-session-token'] || (req.query || {}).sessionTok;
      if (!sessionTok) return respond(res, 401, { error: 'Missing session token' });
      try {
        const providers = mgr.getKeyVault().listProviders(sessionTok);
        return respond(res, 200, { ok: true, providers });
      } catch (err) {
        return respond(res, 401, { error: err.message });
      }
    },
  });

  /**
   * POST /identity/challenge
   * Issue a ZK challenge for key ownership proof.
   * Body: { userId: string, provider: string }
   */
  routes.push({
    method: 'POST',
    path:   '/identity/challenge',
    handler: async (req, res) => {
      const { userId, provider } = req.body || {};
      if (!userId || !provider) return respond(res, 400, { error: 'Missing userId or provider' });
      const challenge = mgr.challengeKeyOwnership(userId, provider);
      return respond(res, 200, { ok: true, ...challenge });
    },
  });

  /**
   * POST /identity/verify
   * Verify ZK proof of key ownership.
   * Body: { challengeId: string, proof: string, apiKey: string }
   */
  routes.push({
    method: 'POST',
    path:   '/identity/verify',
    handler: async (req, res) => {
      const { challengeId, proof, apiKey } = req.body || {};
      if (!challengeId || !proof || !apiKey) {
        return respond(res, 400, { error: 'Missing challengeId, proof, or apiKey' });
      }
      try {
        const result = mgr.verifyKeyOwnership(challengeId, proof, apiKey);
        return respond(res, 200, { ok: true, ...result });
      } catch (err) {
        return respond(res, 400, { error: err.message });
      }
    },
  });

  /**
   * GET /identity/profile/:userId
   * Get user profile (no sensitive data).
   */
  routes.push({
    method: 'GET',
    path:   '/identity/profile/:userId',
    handler: async (req, res) => {
      const { userId } = req.params || {};
      if (!userId) return respond(res, 400, { error: 'Missing userId' });
      const profile = mgr.getUserProfile(userId);
      if (!profile) return respond(res, 404, { error: 'User not found' });
      return respond(res, 200, { ok: true, profile });
    },
  });

  /**
   * GET /identity/providers
   * List supported model providers.
   */
  routes.push({
    method: 'GET',
    path:   '/identity/providers',
    handler: async (req, res) => {
      return respond(res, 200, { ok: true, providers: Object.values(PROVIDERS) });
    },
  });

  /**
   * POST /identity/auth/api-key
   * Authenticate with an API key hash.
   * Body: { userId: string, apiKeyHash: string }
   */
  routes.push({
    method: 'POST',
    path:   '/identity/auth/api-key',
    handler: async (req, res) => {
      const { userId, apiKeyHash } = req.body || {};
      if (!userId || !apiKeyHash) return respond(res, 400, { error: 'Missing userId or apiKeyHash' });
      const session = mgr.getAuth().authenticateApiKey(userId, apiKeyHash);
      return respond(res, 200, { ok: true, ...session });
    },
  });

  /**
   * DELETE /identity/session
   * Revoke a session.
   * Body: { token: string }
   */
  routes.push({
    method: 'DELETE',
    path:   '/identity/session',
    handler: async (req, res) => {
      const { token } = req.body || {};
      if (!token) return respond(res, 400, { error: 'Missing token' });
      mgr.getAuth().revokeSession(token);
      return respond(res, 200, { ok: true });
    },
  });

  return routes;
}

function attachIdentityRoutes(app, opts = {}) {
  const routes = createIdentityRoutes(opts);
  for (const route of routes) {
    const method = route.method.toLowerCase();
    if (app[method]) app[method](route.path, route.handler);
  }
  return app;
}

module.exports = { createIdentityRoutes, attachIdentityRoutes };
