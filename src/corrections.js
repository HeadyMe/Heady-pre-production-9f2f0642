'use strict';

/**
 * HeadyCorrections — Correction and feedback system.
 * Tracks user corrections, model output quality feedback, and uses
 * corrections to improve future routing and prompt strategies.
 */

const EventEmitter = require('events');
const crypto = require('crypto');

const CORRECTION_TYPES = {
  FACTUAL: 'factual',          // Content was factually wrong
  FORMATTING: 'formatting',    // Output format was wrong
  TONE: 'tone',                // Tone/style was inappropriate
  COMPLETENESS: 'completeness', // Response was incomplete
  RELEVANCE: 'relevance',      // Off-topic or irrelevant
  CODE_BUG: 'code_bug',        // Generated code has bugs
  HALLUCINATION: 'hallucination', // Model made something up
  OTHER: 'other',
};

const FEEDBACK_POLARITY = {
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  NEUTRAL: 'neutral',
};

let _initialized = false;

class HeadyCorrections extends EventEmitter {
  constructor(opts = {}) {
    super();
    this._corrections = new Map();    // correctionId → Correction
    this._feedback = [];
    this._stats = { total: 0, byType: {}, byProvider: {}, positiveFeedback: 0, negativeFeedback: 0 };
    this._maxCorrections = opts.maxCorrections || 10000;
    this._vectorMemory = opts.vectorMemory || null;
    this._autoLearn = opts.autoLearn !== false;
    this._learningLog = [];           // What was learned
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  init() {
    if (_initialized) return;
    _initialized = true;
    this.emit('initialized');
    // Future: load correction history from DB
  }

  // ─── Corrections ──────────────────────────────────────────────────────────

  /**
   * Submit a correction for a model output.
   */
  submitCorrection(opts = {}) {
    const id = 'corr_' + crypto.randomBytes(8).toString('hex');
    const correction = {
      id,
      originalPrompt: opts.originalPrompt || '',
      originalOutput: opts.originalOutput || '',
      correctedOutput: opts.correctedOutput || '',
      correctionType: opts.correctionType || CORRECTION_TYPES.OTHER,
      provider: opts.provider || 'unknown',
      model: opts.model || 'unknown',
      taskType: opts.taskType || 'default',
      userId: opts.userId || null,
      sessionId: opts.sessionId || null,
      severity: opts.severity || 'medium', // low | medium | high | critical
      notes: opts.notes || '',
      submittedAt: new Date().toISOString(),
      applied: false,
      appliedAt: null,
    };

    this._corrections.set(id, correction);
    if (this._corrections.size > this._maxCorrections) {
      const firstKey = this._corrections.keys().next().value;
      this._corrections.delete(firstKey);
    }

    this._stats.total++;
    this._stats.byType[correction.correctionType] = (this._stats.byType[correction.correctionType] || 0) + 1;
    this._stats.byProvider[correction.provider] = (this._stats.byProvider[correction.provider] || 0) + 1;

    this.emit('correction-submitted', correction);

    if (this._autoLearn) {
      this._learn(correction);
    }

    return id;
  }

  /**
   * Submit thumbs up/down feedback.
   */
  submitFeedback(opts = {}) {
    const entry = {
      id: 'fb_' + crypto.randomBytes(6).toString('hex'),
      polarity: opts.polarity || FEEDBACK_POLARITY.NEUTRAL,
      provider: opts.provider || 'unknown',
      taskType: opts.taskType || 'default',
      prompt: (opts.prompt || '').slice(0, 200),
      userId: opts.userId || null,
      rating: opts.rating || null,  // 1-5 optional
      comment: opts.comment || '',
      ts: new Date().toISOString(),
    };

    this._feedback.push(entry);
    if (this._feedback.length > this._maxCorrections) this._feedback.shift();

    if (entry.polarity === FEEDBACK_POLARITY.POSITIVE) this._stats.positiveFeedback++;
    if (entry.polarity === FEEDBACK_POLARITY.NEGATIVE) this._stats.negativeFeedback++;

    this.emit('feedback-submitted', entry);
    return entry.id;
  }

  // ─── Learning ──────────────────────────────────────────────────────────────

  async _learn(correction) {
    const insight = {
      ts: new Date().toISOString(),
      type: correction.correctionType,
      provider: correction.provider,
      taskType: correction.taskType,
      severity: correction.severity,
    };

    this._learningLog.push(insight);
    if (this._learningLog.length > 1000) this._learningLog.shift();

    // If many corrections for a provider on a task type, consider re-routing
    const key = `${correction.provider}:${correction.taskType}`;
    const recentCorrections = Array.from(this._corrections.values())
      .filter(c => c.provider === correction.provider && c.taskType === correction.taskType)
      .filter(c => Date.now() - new Date(c.submittedAt).getTime() < 24 * 60 * 60 * 1000);

    if (recentCorrections.length >= 5) {
      this.emit('learning-signal', {
        action: 'consider_re_routing',
        provider: correction.provider,
        taskType: correction.taskType,
        correctionCount: recentCorrections.length,
      });
    }

    // Store correction in vector memory for future reference
    if (this._vectorMemory && typeof this._vectorMemory.store === 'function') {
      const text = `Correction [${correction.correctionType}]: "${correction.originalOutput.slice(0, 200)}" → "${correction.correctedOutput.slice(0, 200)}"`;
      this._vectorMemory.store(correction.id, null, text, {
        type: 'correction',
        correctionType: correction.correctionType,
        provider: correction.provider,
        taskType: correction.taskType,
      }).catch(() => {});
    }
  }

  // ─── Querying ──────────────────────────────────────────────────────────────

  getCorrections(opts = {}) {
    let corrections = Array.from(this._corrections.values());
    if (opts.type) corrections = corrections.filter(c => c.correctionType === opts.type);
    if (opts.provider) corrections = corrections.filter(c => c.provider === opts.provider);
    if (opts.taskType) corrections = corrections.filter(c => c.taskType === opts.taskType);
    const limit = opts.limit || 100;
    return corrections.slice(-limit).reverse();
  }

  getCorrection(id) {
    return this._corrections.get(id) || null;
  }

  getFeedback(opts = {}) {
    let fb = this._feedback;
    if (opts.polarity) fb = fb.filter(f => f.polarity === opts.polarity);
    if (opts.provider) fb = fb.filter(f => f.provider === opts.provider);
    return fb.slice(-(opts.limit || 100)).reverse();
  }

  getStats() {
    const total = this._stats.total;
    const pos = this._stats.positiveFeedback;
    const neg = this._stats.negativeFeedback;
    return {
      ...this._stats,
      satisfactionRate: (pos + neg) > 0 ? (pos / (pos + neg) * 100).toFixed(1) + '%' : 'N/A',
      totalFeedback: pos + neg,
    };
  }

  getInsights() {
    const corrections = Array.from(this._corrections.values());
    const last7d = corrections.filter(c => Date.now() - new Date(c.submittedAt).getTime() < 7 * 24 * 60 * 60 * 1000);

    const byProvider = {};
    for (const c of last7d) {
      byProvider[c.provider] = (byProvider[c.provider] || 0) + 1;
    }

    const worstProvider = Object.entries(byProvider).sort((a, b) => b[1] - a[1])[0];
    const insights = [];

    if (worstProvider && worstProvider[1] >= 3) {
      insights.push({ type: 'provider_quality', message: `${worstProvider[0]} has ${worstProvider[1]} corrections in last 7 days`, severity: 'warn' });
    }

    const hallucinations = last7d.filter(c => c.correctionType === CORRECTION_TYPES.HALLUCINATION).length;
    if (hallucinations >= 3) {
      insights.push({ type: 'hallucination_trend', message: `${hallucinations} hallucinations in last 7 days`, severity: 'critical' });
    }

    return insights;
  }

  // ─── Express routes ────────────────────────────────────────────────────────

  registerRoutes(app) {
    /** POST /api/corrections — submit a correction */
    app.post('/api/corrections', (req, res) => {
      try {
        const id = this.submitCorrection(req.body || {});
        res.status(201).json({ ok: true, id });
      } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
      }
    });

    /** GET /api/corrections */
    app.get('/api/corrections', (req, res) => {
      const { type, provider, taskType, limit } = req.query;
      res.json({ ok: true, corrections: this.getCorrections({ type, provider, taskType, limit: parseInt(limit) || 100 }) });
    });

    /** GET /api/corrections/:id */
    app.get('/api/corrections/:id', (req, res) => {
      const c = this.getCorrection(req.params.id);
      if (!c) return res.status(404).json({ ok: false, error: 'Correction not found' });
      res.json({ ok: true, correction: c });
    });

    /** POST /api/corrections/feedback — thumbs up/down */
    app.post('/api/corrections/feedback', (req, res) => {
      try {
        const id = this.submitFeedback(req.body || {});
        res.status(201).json({ ok: true, id });
      } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
      }
    });

    /** GET /api/corrections/feedback */
    app.get('/api/corrections/feedback', (req, res) => {
      const { polarity, provider, limit } = req.query;
      res.json({ ok: true, feedback: this.getFeedback({ polarity, provider, limit: parseInt(limit) || 100 }) });
    });

    /** GET /api/corrections/stats */
    app.get('/api/corrections/stats', (req, res) => {
      res.json({ ok: true, stats: this.getStats() });
    });

    /** GET /api/corrections/insights */
    app.get('/api/corrections/insights', (req, res) => {
      res.json({ ok: true, insights: this.getInsights() });
    });

    return app;
  }
}

let _instance = null;

function init() {
  const instance = getInstance();
  instance.init();
  return instance;
}

function getInstance(opts) {
  if (!_instance) _instance = new HeadyCorrections(opts);
  return _instance;
}

module.exports = { HeadyCorrections, getInstance, init, CORRECTION_TYPES, FEEDBACK_POLARITY };
