/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
// RTP: Empathic Persona Engine with Biometric Sync

'use strict';

const crypto = require('crypto');

const PHI = 1.6180339887;

// ─── Emotion Dimensions ───────────────────────────────────────────────────────

// Continuous emotion space: valence × arousal × dominance (Russell + Mehrabian)
const EMOTION_DIMENSIONS = ['valence', 'arousal', 'dominance'];

// Trait dimensions for persona profile
const TRAIT_DIMENSIONS = ['warmth', 'formality', 'humor', 'assertiveness', 'empathy'];

const EMOTION_KEYWORDS = {
  positive: ['great', 'love', 'excellent', 'happy', 'fantastic', 'amazing', 'wonderful', 'joy', 'excited', 'brilliant'],
  negative: ['terrible', 'hate', 'awful', 'angry', 'frustrated', 'sad', 'disappoint', 'upset', 'fail', 'broken'],
  high_arousal: ['urgent', 'immediately', 'now', 'critical', 'emergency', 'fast', 'quick', 'rush'],
  low_arousal:  ['slow', 'calm', 'relax', 'whenever', 'no rush', 'eventually', 'easy'],
  dominant:     ['i want', 'i need', 'must', 'should', 'demand', 'require', 'insist'],
  submissive:   ['please', 'if you could', 'would you mind', 'i was wondering', 'maybe'],
};

// ─── EmotionVector ────────────────────────────────────────────────────────────

class EmotionVector {
  constructor(valence = 0, arousal = 0, dominance = 0) {
    this.valence   = Math.max(-1, Math.min(1, valence));
    this.arousal   = Math.max(-1, Math.min(1, arousal));
    this.dominance = Math.max(-1, Math.min(1, dominance));
  }

  /**
   * Blend this emotion with another using φ-weighted interpolation.
   */
  blend(other, alpha = 1 / PHI) {
    return new EmotionVector(
      this.valence   * (1 - alpha) + other.valence   * alpha,
      this.arousal   * (1 - alpha) + other.arousal   * alpha,
      this.dominance * (1 - alpha) + other.dominance * alpha,
    );
  }

  /**
   * Euclidean distance to another emotion vector.
   */
  distanceTo(other) {
    return Math.sqrt(
      Math.pow(this.valence   - other.valence,   2) +
      Math.pow(this.arousal   - other.arousal,   2) +
      Math.pow(this.dominance - other.dominance, 2)
    );
  }

  /**
   * Classify into a named emotion bucket.
   */
  classify() {
    if (this.valence > 0.3 && this.arousal > 0.3)  return 'excited';
    if (this.valence > 0.3 && this.arousal <= 0.3) return 'content';
    if (this.valence > 0.3 && this.arousal < -0.3) return 'relaxed';
    if (this.valence < -0.3 && this.arousal > 0.3) return 'angry';
    if (this.valence < -0.3 && this.arousal < 0.3) return 'sad';
    if (this.valence < -0.3 && this.arousal < -0.3) return 'depressed';
    if (this.arousal > 0.5)  return 'alert';
    if (this.arousal < -0.5) return 'drowsy';
    return 'neutral';
  }

  toJSON() {
    return { valence: this.valence, arousal: this.arousal, dominance: this.dominance, label: this.classify() };
  }
}

// ─── EmotionDetector ─────────────────────────────────────────────────────────

class EmotionDetector {
  constructor(opts = {}) {
    this._keywords   = Object.assign({}, EMOTION_KEYWORDS, opts.keywords || {});
    this._voiceModel = opts.voiceModel || null;
    this._history    = [];
    this._smoothing  = opts.smoothing || 0.3;
    this._current    = new EmotionVector();
  }

  /**
   * Detect emotion from text input.
   */
  detectFromText(text) {
    if (!text || typeof text !== 'string') return this._current;

    const lower = text.toLowerCase();
    let valence   = 0;
    let arousal   = 0;
    let dominance = 0;

    const positiveHits = this._keywords.positive.filter(k => lower.includes(k)).length;
    const negativeHits = this._keywords.negative.filter(k => lower.includes(k)).length;
    valence = (positiveHits - negativeHits) / Math.max(1, positiveHits + negativeHits) || 0;

    const highArousalHits = this._keywords.high_arousal.filter(k => lower.includes(k)).length;
    const lowArousalHits  = this._keywords.low_arousal.filter(k => lower.includes(k)).length;
    arousal = (highArousalHits - lowArousalHits) / Math.max(1, highArousalHits + lowArousalHits) || 0;

    const dominantHits   = this._keywords.dominant.filter(k => lower.includes(k)).length;
    const submissiveHits = this._keywords.submissive.filter(k => lower.includes(k)).length;
    dominance = (dominantHits - submissiveHits) / Math.max(1, dominantHits + submissiveHits) || 0;

    // Punctuation signals
    const exclaims = (text.match(/!/g) || []).length;
    const questions = (text.match(/\?/g) || []).length;
    arousal   += Math.min(0.3, exclaims * 0.1);
    dominance += Math.min(0.2, questions * 0.05);

    // ALL CAPS signals high arousal
    const capsRatio = (text.match(/[A-Z]/g) || []).length / Math.max(1, text.length);
    if (capsRatio > 0.3) arousal = Math.min(1, arousal + 0.4);

    const detected = new EmotionVector(
      Math.max(-1, Math.min(1, valence)),
      Math.max(-1, Math.min(1, arousal)),
      Math.max(-1, Math.min(1, dominance)),
    );

    // Smooth with history using α
    this._current = this._current.blend(detected, this._smoothing);
    this._history.push({ ts: Date.now(), emotion: this._current.toJSON(), source: 'text' });
    if (this._history.length > 100) this._history.shift();

    return this._current;
  }

  /**
   * Detect emotion from voice metadata (pitch, tempo, energy).
   */
  detectFromVoiceMeta(meta) {
    const { pitchHz = 150, tempoWpm = 130, energyDb = -20 } = meta;

    // Pitch > 200Hz → high arousal / positive
    // Tempo > 160wpm → high arousal
    // Energy > -15dB → high arousal
    const arousal  = Math.min(1, Math.max(-1,
      (pitchHz - 150) / 100 * 0.4 +
      (tempoWpm - 130) / 80 * 0.3 +
      (energyDb + 30) / 30 * 0.3
    ));
    const valence  = pitchHz > 200 ? 0.3 : (pitchHz < 100 ? -0.3 : 0);
    const detected = new EmotionVector(valence, arousal, 0);

    this._current = this._current.blend(detected, this._smoothing);
    this._history.push({ ts: Date.now(), emotion: this._current.toJSON(), source: 'voice' });
    return this._current;
  }

  getCurrentEmotion() { return this._current; }
  getHistory()        { return this._history.slice(); }
  reset()             { this._current = new EmotionVector(); this._history = []; return this; }
}

// ─── BiometricSync ────────────────────────────────────────────────────────────

class BiometricSync {
  /**
   * Adapts persona based on user biometric state signals.
   * Integration points: heart rate, typing speed, voice pitch.
   */
  constructor(opts = {}) {
    this._signals  = {};
    this._callbacks = [];
    this._hrZones  = opts.hrZones || {
      rest:    [40, 60],
      light:   [61, 100],
      moderate:[101, 140],
      intense: [141, 180],
      max:     [181, 220],
    };
  }

  /**
   * Update a biometric signal.
   * @param {string} type - 'heart_rate' | 'typing_speed' | 'voice_pitch'
   * @param {number} value - measured value
   */
  update(type, value) {
    this._signals[type] = { value, ts: Date.now() };
    const derived = this._deriveState();
    for (const fn of this._callbacks) fn(derived);
    return derived;
  }

  /**
   * Derive arousal/stress level from current signals.
   */
  _deriveState() {
    const state = {
      arousal:   0,
      stress:    0,
      engagement:0,
      signals:   { ...this._signals },
    };

    if (this._signals.heart_rate) {
      const hr   = this._signals.heart_rate.value;
      const zone = this._getHrZone(hr);
      state.arousal    = this._zoneToArousal(zone);
      state.stress     = zone === 'intense' || zone === 'max' ? 0.8 : (zone === 'moderate' ? 0.4 : 0.1);
      state.hrZone     = zone;
    }

    if (this._signals.typing_speed) {
      const wpm        = this._signals.typing_speed.value;
      state.engagement = Math.min(1, Math.max(0, (wpm - 20) / 80));
    }

    if (this._signals.voice_pitch) {
      const hz          = this._signals.voice_pitch.value;
      state.arousal     = Math.max(state.arousal, Math.min(1, (hz - 80) / 200));
    }

    return state;
  }

  _getHrZone(hr) {
    for (const [zone, [lo, hi]] of Object.entries(this._hrZones)) {
      if (hr >= lo && hr <= hi) return zone;
    }
    return 'unknown';
  }

  _zoneToArousal(zone) {
    const map = { rest: -0.5, light: 0, moderate: 0.4, intense: 0.8, max: 1.0, unknown: 0 };
    return map[zone] || 0;
  }

  onChange(fn) { this._callbacks.push(fn); return this; }
  getSignals()  { return { ...this._signals }; }
  getState()    { return this._deriveState(); }
}

// ─── PersonaProfile ───────────────────────────────────────────────────────────

class PersonaProfile {
  /**
   * Configurable persona traits stored as an embedding vector.
   */
  constructor(opts = {}) {
    this.id          = opts.id   || crypto.randomUUID();
    this.name        = opts.name || 'Default';
    // Trait vector: all in [0, 1]
    this.warmth      = this._clamp(opts.warmth      ?? 0.7);
    this.formality   = this._clamp(opts.formality   ?? 0.5);
    this.humor       = this._clamp(opts.humor       ?? 0.4);
    this.assertiveness = this._clamp(opts.assertiveness ?? 0.5);
    this.empathy     = this._clamp(opts.empathy     ?? 0.8);
    this._baseTraits = this.toVector();
  }

  _clamp(v) { return Math.max(0, Math.min(1, Number(v) || 0)); }

  /**
   * Return traits as a Float32-friendly numeric array.
   */
  toVector() {
    return [this.warmth, this.formality, this.humor, this.assertiveness, this.empathy];
  }

  /**
   * Adjust traits based on detected emotion and biometric state.
   */
  adaptToEmotion(emotion, biometricState = null) {
    const base = this._baseTraits;

    // High arousal → reduce formality, increase assertiveness
    const arousal  = (emotion.arousal || 0);
    const valence  = (emotion.valence || 0);
    const stress   = biometricState ? biometricState.stress : 0;

    // φ-weighted adaptation
    const alphaE = 0.2;
    const alphaB = 0.1;

    this.warmth        = this._clamp(base[0] + valence * alphaE - stress * alphaB);
    this.formality     = this._clamp(base[1] - Math.abs(arousal) * alphaE * 0.5);
    this.humor         = this._clamp(base[2] + valence * alphaE * 0.5);
    this.assertiveness = this._clamp(base[3] + arousal * alphaE * 0.3);
    this.empathy       = this._clamp(base[4] + (-valence) * alphaE * 0.5);

    return this.toVector();
  }

  /**
   * Compute cosine similarity to another profile.
   */
  similarityTo(other) {
    const a = this.toVector();
    const b = other.toVector();
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
  }

  reset() {
    [this.warmth, this.formality, this.humor, this.assertiveness, this.empathy] = this._baseTraits;
    return this;
  }

  toJSON() {
    return { id: this.id, name: this.name, warmth: this.warmth, formality: this.formality,
             humor: this.humor, assertiveness: this.assertiveness, empathy: this.empathy };
  }
}

// ─── ResponseModulator ────────────────────────────────────────────────────────

class ResponseModulator {
  /**
   * Adjust LLM parameters based on detected emotion and persona state.
   */
  constructor(opts = {}) {
    this._defaults = {
      temperature: opts.defaultTemperature ?? 0.7,
      top_p:       opts.defaultTopP        ?? 0.9,
      max_tokens:  opts.defaultMaxTokens   ?? 1024,
    };
  }

  /**
   * Compute adjusted LLM parameters from emotion and persona.
   */
  modulate(emotion, persona) {
    const e = emotion instanceof EmotionVector ? emotion : new EmotionVector(emotion.valence, emotion.arousal, emotion.dominance);
    const params = { ...this._defaults };

    // Temperature: high arousal/negative valence → slightly lower temp (more focused)
    // Positive + low arousal → slightly higher temp (more creative)
    const tempDelta  = (e.valence * 0.15) - (Math.abs(e.arousal) * 0.1);
    params.temperature = Math.max(0.1, Math.min(1.5, params.temperature + tempDelta));

    // top_p: high stress → lower top_p (more conservative)
    const topPDelta  = (e.valence * 0.05) - (e.arousal * 0.1);
    params.top_p     = Math.max(0.5, Math.min(1.0, params.top_p + topPDelta));

    // Formality affects system prompt prefix
    if (persona) {
      params.systemPrompt = this._buildSystemPrompt(persona, e);
    }

    // Max tokens: if user seems rushed (high arousal + negative), shorter
    if (e.arousal > 0.5 && e.valence < -0.2) {
      params.max_tokens = Math.min(params.max_tokens, 512);
    }

    return params;
  }

  _buildSystemPrompt(persona, emotion) {
    const parts = [];

    if (persona.formality > 0.7)      parts.push('Respond in a formal, professional tone.');
    else if (persona.formality < 0.3) parts.push('Respond in a casual, conversational tone.');
    else                               parts.push('Respond in a friendly, clear tone.');

    if (persona.warmth > 0.7)         parts.push('Be warm and encouraging.');
    if (persona.humor > 0.6)          parts.push('Feel free to use light humor when appropriate.');
    if (persona.empathy > 0.7)        parts.push('Show genuine empathy and understanding.');
    if (persona.assertiveness > 0.7)  parts.push('Be direct and decisive in your responses.');

    const emotionLabel = emotion.classify();
    if (emotionLabel === 'angry' || emotionLabel === 'frustrated') {
      parts.push('The user may be frustrated. Respond with patience and clarity.');
    } else if (emotionLabel === 'excited') {
      parts.push('The user is energized. Match their enthusiasm.');
    } else if (emotionLabel === 'sad' || emotionLabel === 'depressed') {
      parts.push('The user may need support. Be gentle and constructive.');
    }

    return parts.join(' ');
  }
}

// ─── PersonaEngine ────────────────────────────────────────────────────────────

class PersonaEngine {
  /**
   * Top-level empathic persona manager.
   * Orchestrates EmotionDetector, BiometricSync, PersonaProfile, ResponseModulator.
   */
  constructor(opts = {}) {
    this._profiles   = new Map();
    this._active     = null;
    this._detector   = new EmotionDetector(opts.detectorOpts   || {});
    this._biometric  = new BiometricSync(opts.biometricOpts    || {});
    this._modulator  = new ResponseModulator(opts.modulatorOpts || {});
    this._history    = [];
    this._maxHistory = opts.maxHistory || 500;

    // Wire up biometric → emotion feedback
    this._biometricState = null;
    this._biometric.onChange(state => {
      this._biometricState = state;
      // Inject arousal from biometrics into emotion detector
      if (state.arousal !== 0) {
        this._detector._current = this._detector._current.blend(
          new EmotionVector(0, state.arousal, 0), 0.15
        );
      }
    });

    // Create default profile
    const defaultProfile = new PersonaProfile(opts.defaultProfile || { name: 'Heady' });
    this.registerProfile(defaultProfile);
    this._active = defaultProfile.id;
  }

  registerProfile(profile) {
    this._profiles.set(profile.id, profile);
    return this;
  }

  activateProfile(profileId) {
    if (!this._profiles.has(profileId)) throw new Error(`Profile '${profileId}' not found`);
    this._active = profileId;
    return this;
  }

  getActiveProfile() {
    return this._profiles.get(this._active) || null;
  }

  /**
   * Process a user input: detect emotion, update persona, return modulated LLM params.
   */
  process(input, voiceMeta = null) {
    const emotion = this._detector.detectFromText(
      typeof input === 'string' ? input : (input.text || '')
    );

    if (voiceMeta) this._detector.detectFromVoiceMeta(voiceMeta);

    const profile = this.getActiveProfile();
    if (profile) profile.adaptToEmotion(emotion.toJSON(), this._biometricState);

    const params = this._modulator.modulate(emotion, profile);

    const record = {
      ts:        Date.now(),
      emotion:   emotion.toJSON(),
      persona:   profile ? profile.toJSON() : null,
      params,
    };
    this._history.push(record);
    if (this._history.length > this._maxHistory) this._history.shift();

    return params;
  }

  /**
   * Update a biometric signal.
   */
  updateBiometric(type, value) {
    return this._biometric.update(type, value);
  }

  getEmotionHistory()  { return this._detector.getHistory(); }
  getProcessHistory()  { return this._history.slice(); }
  getDetector()        { return this._detector; }
  getBiometricSync()   { return this._biometric; }
  getModulator()       { return this._modulator; }
  listProfiles()       { return Array.from(this._profiles.values()).map(p => p.toJSON()); }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  PHI,
  EMOTION_DIMENSIONS,
  TRAIT_DIMENSIONS,
  EMOTION_KEYWORDS,
  EmotionVector,
  EmotionDetector,
  BiometricSync,
  PersonaProfile,
  ResponseModulator,
  PersonaEngine,
};
