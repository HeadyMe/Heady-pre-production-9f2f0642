/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Socratic Execution Loop — 4-Phase Pre-Action Validation
 *
 * // RTP: Socratic Execution Loop - Continuous Latent Architecture
 *
 * A mandatory pre-action validation framework that interrogates every
 * high-stakes action through four sequential phases before permitting execution:
 *
 *   Phase 1: Intent Verification    — semantic check of what is being asked
 *   Phase 2: Consequence Prediction — simulate outcomes of the action
 *   Phase 3: Law Compliance         — check against the 3 Unbreakable Laws
 *   Phase 4: Confidence Gate        — CSL-based go/no-go decision
 *
 * Each phase produces a structured PhaseResult. The loop produces a final
 * ValidationResult containing the go/no-go decision and full phase trace.
 *
 * PHI = 1.6180339887
 */

'use strict';

const crypto = require('crypto');

// ─── Constants ────────────────────────────────────────────────────────────────

const PHI = 1.6180339887;

const PHASE = Object.freeze({
  INTENT_VERIFICATION:    'intent_verification',
  CONSEQUENCE_PREDICTION: 'consequence_prediction',
  LAW_COMPLIANCE:         'law_compliance',
  CONFIDENCE_GATE:        'confidence_gate',
});

const DECISION = Object.freeze({
  GO:       'GO',
  NO_GO:    'NO_GO',
  DEFERRED: 'DEFERRED',
});

const LAW_VIOLATION_SEVERITY = Object.freeze({
  NONE:     'none',
  WARN:     'warn',
  BLOCK:    'block',
  CRITICAL: 'critical',
});

/**
 * The 3 Unbreakable Laws — checked in Phase 3.
 * Any action that would violate a LAW_VIOLATION_SEVERITY.BLOCK law
 * results in an immediate NO_GO regardless of confidence.
 */
const UNBREAKABLE_LAWS = Object.freeze([
  {
    id:          'LAW_1_NO_HARM',
    name:        'Law 1: Do No Harm',
    description: 'Actions must not directly cause irreversible harm to people, systems, or data without explicit authorisation.',
    severity:    LAW_VIOLATION_SEVERITY.BLOCK,
    keywords:    ['delete all', 'drop table', 'rm -rf', 'format', 'wipe', 'destroy', 'irreversible', 'nuke'],
  },
  {
    id:          'LAW_2_TRANSPARENCY',
    name:        'Law 2: Transparency and Auditability',
    description: 'Actions must not conceal their effects from the authorising human or audit trail.',
    severity:    LAW_VIOLATION_SEVERITY.BLOCK,
    keywords:    ['hide', 'conceal', 'obfuscate', 'disable logging', 'clear log', 'delete audit', 'cover up'],
  },
  {
    id:          'LAW_3_HUMAN_OVERRIDE',
    name:        'Law 3: Human Override Inviolable',
    description: 'Actions must not prevent, circumvent, or disable the ability of an authorised human to override or halt the system.',
    severity:    LAW_VIOLATION_SEVERITY.BLOCK,
    keywords:    ['disable override', 'bypass auth', 'circumvent', 'disable kill switch', 'prevent shutdown', 'lock out'],
  },
]);

// Default confidence threshold for the Phase 4 gate
const DEFAULT_CONFIDENCE_THRESHOLD = 0.60;

// Score weights for each phase in the composite go/no-go decision
const PHASE_WEIGHTS = Object.freeze({
  [PHASE.INTENT_VERIFICATION]:    0.20,
  [PHASE.CONSEQUENCE_PREDICTION]: 0.30,
  [PHASE.LAW_COMPLIANCE]:         0.35,
  [PHASE.CONFIDENCE_GATE]:        0.15,
});

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Compute a deterministic semantic similarity score between two strings.
 * In production this would call a real embedding model.
 * This implementation uses a Jaccard-inspired token overlap for reproducibility.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} similarity in [0, 1]
 */
function _semanticSimilarity(a, b) {
  const tokenise = (s) => new Set(
    s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
  );
  const sa = tokenise(a);
  const sb = tokenise(b);
  const intersect = new Set([...sa].filter(t => sb.has(t)));
  const union     = new Set([...sa, ...sb]);
  return union.size === 0 ? 0 : intersect.size / union.size;
}

/**
 * Check whether a text contains any of a set of keyword patterns.
 * @param {string} text
 * @param {string[]} keywords
 * @returns {{ found: boolean, matches: string[] }}
 */
function _keywordScan(text, keywords) {
  const lower   = text.toLowerCase();
  const matches = keywords.filter(kw => lower.includes(kw.toLowerCase()));
  return { found: matches.length > 0, matches };
}

// ─── Phase Implementations ────────────────────────────────────────────────────

/**
 * Phase 1: Intent Verification
 *
 * Performs a semantic check on the action being requested to ensure:
 *   - The intent can be parsed
 *   - It aligns with a declared objective (if provided)
 *   - It does not contain ambiguous or contradictory intent signals
 *
 * // RTP: Socratic Execution Loop - Continuous Latent Architecture
 */
function phaseIntentVerification(action, context) {
  const { intent = '', objective = '', allowedIntents = [] } = context;

  const actionText    = typeof action === 'string' ? action : (action.description || JSON.stringify(action));
  const effectiveText = intent || actionText;

  // Check alignment with objective
  const objectiveAlignment = objective
    ? _semanticSimilarity(effectiveText, objective)
    : 1.0; // No objective constraint → full alignment assumed

  // Check against allowed intent list if provided
  let intentAllowed = true;
  let intentScore   = objectiveAlignment;

  if (allowedIntents.length > 0) {
    const maxSim = Math.max(...allowedIntents.map(i => _semanticSimilarity(effectiveText, i)));
    intentAllowed = maxSim >= 0.15;
    intentScore   = (intentScore + maxSim) / 2;
  }

  // Ambiguity check — very short or very long actions may be ambiguous
  const wordCount = effectiveText.split(/\s+/).filter(Boolean).length;
  const ambiguous = wordCount < 2 || wordCount > 500;

  const passed = intentAllowed && !ambiguous && intentScore >= 0.0;
  const score  = Math.min(1, Math.max(0, intentScore * (ambiguous ? 0.5 : 1.0)));

  return {
    phase:    PHASE.INTENT_VERIFICATION,
    passed,
    score:    +score.toFixed(4),
    details: {
      actionText:          effectiveText.slice(0, 200),
      objectiveAlignment:  +objectiveAlignment.toFixed(4),
      intentAllowed,
      ambiguous,
      wordCount,
    },
    warnings: [
      ...(ambiguous ? [`Intent description may be ambiguous (${wordCount} words)`] : []),
      ...(!intentAllowed && allowedIntents.length > 0 ? ['Intent does not match any allowed intent pattern'] : []),
    ],
  };
}

/**
 * Phase 2: Consequence Prediction
 *
 * Simulates the expected outcomes of an action, evaluating:
 *   - Whether outcomes are reversible
 *   - Whether side-effects are bounded/contained
 *   - The blast radius (scope of affected systems)
 *
 * // RTP: Socratic Execution Loop - Continuous Latent Architecture
 */
function phaseConsequencePrediction(action, context) {
  const {
    reversible            = true,
    estimatedScope        = 'local',    // 'local' | 'service' | 'global'
    estimatedImpactScore  = 0.2,        // 0-1, higher = more impact
    affectedSystems       = [],
    simulatedOutcomes     = [],
  } = context.consequences || {};

  const scopeScore = {
    local:   1.0,
    service: 0.65,
    global:  0.25,
  }[estimatedScope] || 0.5;

  const reversibilityScore  = reversible ? 1.0 : 0.3;
  const impactScore         = Math.max(0, 1 - estimatedImpactScore);

  const score = (scopeScore * 0.4 + reversibilityScore * 0.4 + impactScore * 0.2);

  // Build outcome predictions
  const outcomes = simulatedOutcomes.length > 0
    ? simulatedOutcomes
    : [
        {
          label:       'Primary outcome',
          probability: 0.80,
          description: `${reversible ? 'Reversible' : 'Irreversible'} action affecting ${estimatedScope} scope`,
          severity:    estimatedImpactScore > 0.7 ? 'high' : estimatedImpactScore > 0.3 ? 'medium' : 'low',
        },
        {
          label:       'Unintended side-effect',
          probability: 0.15,
          description: 'Downstream systems may be affected by state changes',
          severity:    'low',
        },
      ];

  const warnings = [
    ...(!reversible ? ['Action is irreversible — cannot be undone once executed'] : []),
    ...(estimatedScope === 'global' ? ['Global scope — action affects all systems'] : []),
    ...(estimatedImpactScore > 0.7 ? ['High estimated impact score'] : []),
    ...(affectedSystems.length > 10 ? [`Large blast radius: ${affectedSystems.length} systems affected`] : []),
  ];

  const passed = score >= 0.30 && (reversible || estimatedImpactScore < 0.8);

  return {
    phase:   PHASE.CONSEQUENCE_PREDICTION,
    passed,
    score:   +score.toFixed(4),
    details: {
      reversible,
      estimatedScope,
      estimatedImpactScore,
      affectedSystemsCount: affectedSystems.length,
      scopeScore:           +scopeScore.toFixed(4),
      reversibilityScore:   +reversibilityScore.toFixed(4),
      impactScore:          +impactScore.toFixed(4),
      simulatedOutcomes:    outcomes,
    },
    warnings,
  };
}

/**
 * Phase 3: Law Compliance
 *
 * Checks the action against the 3 Unbreakable Laws.
 * Any BLOCK-severity violation results in an immediate NO_GO.
 *
 * // RTP: Socratic Execution Loop - Continuous Latent Architecture
 */
function phaseLawCompliance(action, context) {
  const actionText = (typeof action === 'string'
    ? action
    : (action.description || JSON.stringify(action))) + ' ' + (context.intent || '');

  const violations     = [];
  const warnings       = [];
  let   hardBlock      = false;

  for (const law of UNBREAKABLE_LAWS) {
    const scan = _keywordScan(actionText, law.keywords);

    if (scan.found) {
      if (law.severity === LAW_VIOLATION_SEVERITY.BLOCK || law.severity === LAW_VIOLATION_SEVERITY.CRITICAL) {
        hardBlock = true;
        violations.push({
          lawId:       law.id,
          lawName:     law.name,
          severity:    law.severity,
          matchedTerms: scan.matches,
          description: law.description,
        });
      } else {
        warnings.push({
          lawId:       law.id,
          lawName:     law.name,
          severity:    law.severity,
          matchedTerms: scan.matches,
          description: law.description,
        });
      }
    }
  }

  // Also check any custom laws from context
  for (const customLaw of (context.customLaws || [])) {
    const scan = _keywordScan(actionText, customLaw.keywords || []);
    if (scan.found) {
      if (customLaw.severity === LAW_VIOLATION_SEVERITY.BLOCK) {
        hardBlock = true;
        violations.push({ ...customLaw, matchedTerms: scan.matches });
      } else {
        warnings.push({ ...customLaw, matchedTerms: scan.matches });
      }
    }
  }

  const passed = !hardBlock;
  const score  = hardBlock ? 0 : warnings.length > 0 ? 0.6 : 1.0;

  return {
    phase:      PHASE.LAW_COMPLIANCE,
    passed,
    score:      +score.toFixed(4),
    hardBlock,
    details: {
      lawsChecked:     UNBREAKABLE_LAWS.length + (context.customLaws || []).length,
      violationCount:  violations.length,
      warningCount:    warnings.length,
      violations,
    },
    warnings: warnings.map(w => `${w.lawName}: ${w.matchedTerms.join(', ')}`),
  };
}

/**
 * Phase 4: Confidence Gate (CSL-based go/no-go)
 *
 * Evaluates the composite confidence from prior phases against a configurable
 * threshold. Integrates with the self-awareness CSL score if provided.
 *
 * // RTP: Socratic Execution Loop - Continuous Latent Architecture
 */
function phaseConfidenceGate(phaseResults, context) {
  const threshold = context.confidenceThreshold !== undefined
    ? context.confidenceThreshold
    : DEFAULT_CONFIDENCE_THRESHOLD;

  // Compute weighted composite score from prior phases
  const priorPhases = phaseResults.filter(r => r.phase !== PHASE.CONFIDENCE_GATE);
  let compositeScore = 0;
  let totalWeight    = 0;

  for (const pr of priorPhases) {
    const weight = PHASE_WEIGHTS[pr.phase] || 0;
    compositeScore += pr.score * weight;
    totalWeight    += weight;
  }

  const normalised = totalWeight > 0 ? compositeScore / totalWeight : 0;

  // Integrate self-awareness CSL score if provided
  const cslScore  = context.cslConfidence !== undefined ? context.cslConfidence : null;
  const blended   = cslScore !== null
    ? normalised * 0.75 + cslScore * 0.25
    : normalised;

  const passes  = blended >= threshold;
  const decision = priorPhases.some(r => r.hardBlock)
    ? DECISION.NO_GO
    : passes
      ? DECISION.GO
      : blended >= threshold * 0.7
        ? DECISION.DEFERRED
        : DECISION.NO_GO;

  return {
    phase:    PHASE.CONFIDENCE_GATE,
    passed:   decision === DECISION.GO,
    score:    +blended.toFixed(4),
    decision,
    details: {
      compositeScore:     +normalised.toFixed(4),
      cslScore,
      blendedScore:       +blended.toFixed(4),
      threshold,
      phaseWeights:       PHASE_WEIGHTS,
    },
    warnings: [
      ...(blended < threshold && blended >= threshold * 0.7 ? ['Score near threshold — action deferred for human review'] : []),
      ...(cslScore !== null && cslScore < 0.5 ? ['Self-awareness CSL confidence is low'] : []),
    ],
  };
}

// ─── SocraticLoop ─────────────────────────────────────────────────────────────

/**
 * SocraticLoop — the full 4-phase pre-action validation system.
 * // RTP: Socratic Execution Loop - Continuous Latent Architecture
 */
class SocraticLoop {
  /**
   * @param {object} [opts]
   * @param {number} [opts.confidenceThreshold=0.60] - Minimum blended score for GO
   * @param {boolean} [opts.strictMode=true]          - In strict mode, DEFERRED is treated as NO_GO
   * @param {object}  [opts.selfAwareness]            - Optional MetacognitiveLoop reference
   */
  constructor(opts = {}) {
    this._threshold       = opts.confidenceThreshold !== undefined
      ? opts.confidenceThreshold
      : DEFAULT_CONFIDENCE_THRESHOLD;
    this._strictMode      = opts.strictMode !== undefined ? opts.strictMode : true;
    this._selfAwareness   = opts.selfAwareness || null;
    this._validationLog   = [];
    this._createdAt       = Date.now();
  }

  // ── Primary Validation Entry Point ───────────────────────────────────────

  /**
   * Validate an action through all 4 Socratic phases.
   * This is the primary entry point. Call before any high-stakes action.
   *
   * // RTP: Socratic Execution Loop - Continuous Latent Architecture
   *
   * @param {string|object} action   - The action to validate (string description or structured object)
   * @param {object} [context={}]    - Additional context for each phase
   * @param {string}  [context.intent]              - Explicit intent override
   * @param {string}  [context.objective]           - Goal/objective the action should serve
   * @param {string[]} [context.allowedIntents]     - Whitelist of allowed intent patterns
   * @param {object}  [context.consequences]        - Consequence prediction hints
   * @param {Array}   [context.customLaws]          - Additional custom laws for Phase 3
   * @param {number}  [context.confidenceThreshold] - Phase 4 threshold override
   * @param {number}  [context.cslConfidence]       - External CSL confidence score (0-1)
   * @returns {{
   *   validationId: string,
   *   action: string,
   *   decision: string,
   *   passed: boolean,
   *   phaseResults: Array<object>,
   *   compositeScore: number,
   *   blockedBy: string|null,
   *   summary: string,
   *   validatedAt: number,
   * }}
   */
  async validateAction(action, context = {}) {
    const validationId = crypto.randomBytes(6).toString('hex');
    const actionLabel  = typeof action === 'string' ? action : (action.description || JSON.stringify(action).slice(0, 120));

    // Optionally pull CSL confidence from self-awareness module
    let ctx = { ...context };
    if (this._selfAwareness && ctx.cslConfidence === undefined) {
      try {
        const report = this._selfAwareness.fullReport
          ? this._selfAwareness.fullReport()
          : this._selfAwareness.assess
            ? this._selfAwareness.assess().assessment
            : null;
        if (report && typeof report.confidence === 'number') {
          ctx.cslConfidence = report.confidence;
        }
      } catch { /* self-awareness unavailable */ }
    }

    ctx.confidenceThreshold = ctx.confidenceThreshold !== undefined
      ? ctx.confidenceThreshold
      : this._threshold;

    const phaseResults = [];

    // ── Phase 1: Intent Verification ──────────────────────────────────────
    const phase1 = phaseIntentVerification(action, ctx);
    phaseResults.push(phase1);

    // Hard fail check after Phase 1 (not blocking, but warn)
    // (intent failure alone does not block — continues to Phase 3)

    // ── Phase 2: Consequence Prediction ───────────────────────────────────
    const phase2 = phaseConsequencePrediction(action, ctx);
    phaseResults.push(phase2);

    // ── Phase 3: Law Compliance ────────────────────────────────────────────
    const phase3 = phaseLawCompliance(action, ctx);
    phaseResults.push(phase3);

    // Hard block on law violation — short-circuit to Phase 4 with forced NO_GO
    if (phase3.hardBlock) {
      const phase4Forced = {
        phase:    PHASE.CONFIDENCE_GATE,
        passed:   false,
        score:    0,
        decision: DECISION.NO_GO,
        details:  { reason: 'hard_block_from_law_compliance', compositeScore: 0, cslScore: null, blendedScore: 0, threshold: ctx.confidenceThreshold, phaseWeights: PHASE_WEIGHTS },
        warnings: ['Action blocked by Law Compliance (Phase 3) — one or more Unbreakable Laws violated'],
      };
      phaseResults.push(phase4Forced);

      return this._buildResult(validationId, actionLabel, phaseResults, DECISION.NO_GO, 'law_compliance');
    }

    // ── Phase 4: Confidence Gate ───────────────────────────────────────────
    const phase4 = phaseConfidenceGate(phaseResults, ctx);
    phaseResults.push(phase4);

    // Apply strict mode: convert DEFERRED to NO_GO
    let finalDecision = phase4.decision;
    if (this._strictMode && finalDecision === DECISION.DEFERRED) {
      finalDecision = DECISION.NO_GO;
    }

    const blockedBy = finalDecision !== DECISION.GO
      ? phaseResults.find(r => !r.passed)?.phase || PHASE.CONFIDENCE_GATE
      : null;

    return this._buildResult(validationId, actionLabel, phaseResults, finalDecision, blockedBy);
  }

  /**
   * Build the final ValidationResult object.
   * @private
   */
  _buildResult(validationId, actionLabel, phaseResults, decision, blockedBy) {
    const compositeScore = phaseResults.reduce((acc, r) => acc + (r.score || 0), 0) / phaseResults.length;

    const summaryParts = [
      `Validation ${validationId}: ${decision}`,
      `Composite score: ${compositeScore.toFixed(3)}`,
    ];
    if (blockedBy) summaryParts.push(`Blocked by: ${blockedBy}`);
    const allWarnings = phaseResults.flatMap(r => r.warnings || []);
    if (allWarnings.length > 0) summaryParts.push(`Warnings: ${allWarnings.slice(0, 3).join('; ')}`);

    const result = {
      validationId,
      action:         actionLabel.slice(0, 200),
      decision,
      passed:         decision === DECISION.GO,
      phaseResults,
      compositeScore: +compositeScore.toFixed(4),
      blockedBy:      blockedBy || null,
      summary:        summaryParts.join(' | '),
      validatedAt:    Date.now(),
    };

    this._validationLog.push({
      validationId,
      action:    actionLabel.slice(0, 100),
      decision,
      score:     result.compositeScore,
      blockedBy: result.blockedBy,
      ts:        result.validatedAt,
    });

    return result;
  }

  // ── Convenience Validators ────────────────────────────────────────────────

  /**
   * Quick synchronous intent-only pre-check (Phase 1 only).
   * Use before expensive Phase 2-4 processing when a fast gate is needed.
   *
   * @param {string} action
   * @param {object} [context]
   * @returns {object} Phase 1 result only
   */
  checkIntent(action, context = {}) {
    return phaseIntentVerification(action, context);
  }

  /**
   * Quick synchronous law compliance check (Phase 3 only).
   * Use as a lightweight safety net before any action.
   *
   * @param {string} action
   * @param {object} [context]
   * @returns {object} Phase 3 result only
   */
  checkLaws(action, context = {}) {
    return phaseLawCompliance(action, context);
  }

  // ── CSL Gate Integration ──────────────────────────────────────────────────

  /**
   * Attach a self-awareness module for automatic CSL confidence integration.
   * // RTP: Socratic Execution Loop - Continuous Latent Architecture
   *
   * @param {object} selfAwareness - MetacognitiveLoop or SelfAwareness instance
   */
  attachSelfAwareness(selfAwareness) {
    this._selfAwareness = selfAwareness;
  }

  /**
   * Detach the self-awareness module.
   */
  detachSelfAwareness() {
    this._selfAwareness = null;
  }

  // ── Configuration ────────────────────────────────────────────────────────

  /**
   * Update the confidence threshold.
   * @param {number} threshold
   */
  setConfidenceThreshold(threshold) {
    if (threshold < 0 || threshold > 1) throw new RangeError('Threshold must be in [0, 1]');
    this._threshold = threshold;
  }

  // ── History & Reporting ───────────────────────────────────────────────────

  /**
   * Return validation history.
   * @param {number} [limit=50]
   * @returns {Array<object>}
   */
  getValidationHistory(limit = 50) {
    return this._validationLog.slice(-limit);
  }

  /**
   * Validation statistics summary.
   * @returns {object}
   */
  stats() {
    const log          = this._validationLog;
    const total        = log.length;
    const goCount      = log.filter(r => r.decision === DECISION.GO).length;
    const noGoCount    = log.filter(r => r.decision === DECISION.NO_GO).length;
    const deferCount   = log.filter(r => r.decision === DECISION.DEFERRED).length;
    const blockedPhases = {};
    for (const r of log) {
      if (r.blockedBy) blockedPhases[r.blockedBy] = (blockedPhases[r.blockedBy] || 0) + 1;
    }

    return {
      total,
      goCount,
      noGoCount,
      deferCount,
      approvalRate:   total > 0 ? +(goCount / total).toFixed(3) : null,
      blockedByPhase: blockedPhases,
      threshold:      this._threshold,
      strictMode:     this._strictMode,
      selfAwareness:  this._selfAwareness !== null,
      phi:            PHI,
      createdAt:      this._createdAt,
    };
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  SocraticLoop,

  // Phase functions (exported for testing and direct use)
  phaseIntentVerification,
  phaseConsequencePrediction,
  phaseLawCompliance,
  phaseConfidenceGate,

  // Helpers
  _semanticSimilarity,
  _keywordScan,

  // Constants
  PHI,
  PHASE,
  DECISION,
  LAW_VIOLATION_SEVERITY,
  UNBREAKABLE_LAWS,
  PHASE_WEIGHTS,
  DEFAULT_CONFIDENCE_THRESHOLD,
};
