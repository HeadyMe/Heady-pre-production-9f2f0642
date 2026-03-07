/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
'use strict';

const {
  PersonaEngine,
  PersonaProfile,
  EmotionVector,
  EmotionDetector,
  BiometricSync,
  ResponseModulator,
  TRAIT_DIMENSIONS,
} = require('../persona/empathic-persona-engine');

const PHI = 1.6180339887;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function respond(res, status, body) {
  if (res && typeof res.status === 'function') return res.status(status).json(body);
  if (res && typeof res.writeHead === 'function') {
    const data = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) });
    res.end(data);
  }
  return body;
}

function serializeProfile(p) {
  return p ? p.toJSON() : null;
}

// ─── Route Factory ────────────────────────────────────────────────────────────

function createPersonaRoutes(opts = {}) {
  const engine = opts.engine || new PersonaEngine(opts.engineOpts || {});
  const routes = [];

  /**
   * POST /persona/profiles
   * Register a new persona profile.
   * Body: { id?: string, name?: string, traits?: object, baseEmotion?: object }
   */
  routes.push({
    method: 'POST',
    path:   '/persona/profiles',
    handler: async (req, res) => {
      const { id, name, traits, baseEmotion } = req.body || {};
      const profile = new PersonaProfile({ id, name, traits, baseEmotion });
      engine.registerProfile(profile);
      return respond(res, 201, {
        ok:      true,
        profile: serializeProfile(profile),
        phi:     PHI,
      });
    },
  });

  /**
   * GET /persona/profiles
   * List all registered persona profiles.
   */
  routes.push({
    method: 'GET',
    path:   '/persona/profiles',
    handler: async (req, res) => {
      const profiles = engine.listProfiles();
      return respond(res, 200, { ok: true, profiles, count: profiles.length });
    },
  });

  /**
   * PUT /persona/profiles/:id/activate
   * Activate a specific persona profile.
   */
  routes.push({
    method: 'PUT',
    path:   '/persona/profiles/:id/activate',
    handler: async (req, res) => {
      const { id } = req.params || {};
      if (!id) return respond(res, 400, { error: 'Missing profile id' });
      try {
        engine.activateProfile(id);
        const profile = engine.getActiveProfile();
        return respond(res, 200, { ok: true, activeProfile: serializeProfile(profile) });
      } catch (err) {
        return respond(res, 404, { error: err.message });
      }
    },
  });

  /**
   * GET /persona/profiles/active
   * Get the currently active persona profile.
   */
  routes.push({
    method: 'GET',
    path:   '/persona/profiles/active',
    handler: async (req, res) => {
      const profile = engine.getActiveProfile();
      if (!profile) return respond(res, 404, { error: 'No active profile' });
      return respond(res, 200, { ok: true, profile: serializeProfile(profile) });
    },
  });

  /**
   * POST /persona/process
   * Process text input through the persona engine.
   * Returns emotion detection results + modulated response parameters.
   * Body: { text: string, voiceMeta?: object }
   */
  routes.push({
    method: 'POST',
    path:   '/persona/process',
    handler: async (req, res) => {
      const { text, voiceMeta } = req.body || {};
      if (!text) return respond(res, 400, { error: 'Missing text field' });
      try {
        const result = engine.process(text, voiceMeta || null);
        return respond(res, 200, { ok: true, result, phi: PHI });
      } catch (err) {
        return respond(res, 422, { error: err.message });
      }
    },
  });

  /**
   * POST /persona/biometric
   * Push a biometric update to the engine.
   * Body: { type: string, value: number }
   *   type: 'heart_rate' | 'hrv' | 'skin_conductance' | 'facial_valence' | 'facial_arousal' | 'voice_pitch'
   */
  routes.push({
    method: 'POST',
    path:   '/persona/biometric',
    handler: async (req, res) => {
      const { type, value } = req.body || {};
      if (!type || value === undefined) return respond(res, 400, { error: 'Missing type or value' });
      try {
        engine.updateBiometric(type, Number(value));
        const state = engine.getBiometricSync().getState();
        return respond(res, 200, { ok: true, biometricState: state });
      } catch (err) {
        return respond(res, 422, { error: err.message });
      }
    },
  });

  /**
   * POST /persona/emotion/detect
   * Detect emotion from text without processing through persona engine.
   * Body: { text: string }
   */
  routes.push({
    method: 'POST',
    path:   '/persona/emotion/detect',
    handler: async (req, res) => {
      const { text } = req.body || {};
      if (!text) return respond(res, 400, { error: 'Missing text field' });
      const detector = engine.getDetector();
      const emotion  = detector.detectFromText(text);
      return respond(res, 200, { ok: true, emotion: emotion.toJSON() });
    },
  });

  /**
   * POST /persona/emotion/voice
   * Detect emotion from voice metadata.
   * Body: { pitch?: number, energy?: number, tempo?: number, jitter?: number }
   */
  routes.push({
    method: 'POST',
    path:   '/persona/emotion/voice',
    handler: async (req, res) => {
      const meta = req.body || {};
      const detector = engine.getDetector();
      const emotion  = detector.detectFromVoiceMeta(meta);
      return respond(res, 200, { ok: true, emotion: emotion.toJSON() });
    },
  });

  /**
   * POST /persona/modulate
   * Modulate a response given an emotion vector and active persona.
   * Body: { emotion: { valence, arousal, dominance }, profileId?: string }
   */
  routes.push({
    method: 'POST',
    path:   '/persona/modulate',
    handler: async (req, res) => {
      const { emotion: emotionData = {}, profileId } = req.body || {};
      const emotion = new EmotionVector(
        emotionData.valence   || 0,
        emotionData.arousal   || 0,
        emotionData.dominance || 0,
      );

      let profile = engine.getActiveProfile();
      if (profileId) {
        const profiles = engine.listProfiles();
        const found    = profiles.find(p => p.id === profileId);
        if (!found) return respond(res, 404, { error: `Profile '${profileId}' not found` });
        profile = new PersonaProfile(found);
      }
      if (!profile) return respond(res, 422, { error: 'No active profile; activate one first or pass profileId' });

      const modulator = engine.getModulator();
      const directive = modulator.modulate(emotion, profile);
      return respond(res, 200, { ok: true, directive, emotion: emotion.toJSON(), phi: PHI });
    },
  });

  /**
   * GET /persona/traits
   * Return the list of supported trait dimensions.
   */
  routes.push({
    method: 'GET',
    path:   '/persona/traits',
    handler: async (req, res) => {
      return respond(res, 200, { ok: true, traits: TRAIT_DIMENSIONS, phi: PHI });
    },
  });

  /**
   * POST /persona/profiles/compare
   * Compute similarity between two persona profiles.
   * Body: { profileA: {name, traits, baseEmotion}, profileB: {name, traits, baseEmotion} }
   */
  routes.push({
    method: 'POST',
    path:   '/persona/profiles/compare',
    handler: async (req, res) => {
      const { profileA, profileB } = req.body || {};
      if (!profileA || !profileB) return respond(res, 400, { error: 'Missing profileA or profileB' });
      const a   = new PersonaProfile(profileA);
      const b   = new PersonaProfile(profileB);
      const sim = a.similarityTo(b);
      return respond(res, 200, { ok: true, similarity: sim, phi: PHI });
    },
  });

  return routes;
}

function attachPersonaRoutes(app, opts = {}) {
  const routes = createPersonaRoutes(opts);
  for (const route of routes) {
    const method = route.method.toLowerCase();
    if (app[method]) app[method](route.path, route.handler);
  }
  return app;
}

module.exports = { createPersonaRoutes, attachPersonaRoutes };
