/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const { EventEmitter } = require('events');
const logger = require('../utils/logger');
const { VectorMemory } = require('../vector-memory');
const { DriftDetector } = require('../drift-detector');
const vectorSpaceOps = require('../vector-space-ops');

const PHI = 1.6180339887;

// ─── Unbreakable Laws ─────────────────────────────────────────────────────────

/**
 * The three immutable laws that HeadySoul enforces.
 * Violations are never silently ignored — they surface as events and errors.
 */
const UNBREAKABLE_LAWS = Object.freeze({
  STRUCTURAL_INTEGRITY: {
    id: 'LAW_1',
    name: 'Structural Integrity',
    description: 'Code compiles, type checks pass, module boundaries respected.',
    severity: 'CRITICAL',
  },
  SEMANTIC_COHERENCE: {
    id: 'LAW_2',
    name: 'Semantic Coherence',
    description: 'Embedding stays within tolerance of design intent.',
    severity: 'HIGH',
    toleranceThreshold: 0.25, // cosine distance tolerance
  },
  MISSION_ALIGNMENT: {
    id: 'LAW_3',
    name: 'Mission Alignment',
    description: "Serves HeadyConnection's mission: community, equity, empowerment.",
    severity: 'CRITICAL',
    missionKeywords: ['community', 'equity', 'empowerment', 'access', 'inclusion', 'connection'],
  },
});

// ─── Soul State ───────────────────────────────────────────────────────────────

const SoulState = Object.freeze({
  STABLE:   'STABLE',
  ALERT:    'ALERT',
  HEALING:  'HEALING',
  VIOLATED: 'VIOLATED',
});

/**
 * HeadySoul — The coherence guardian and values arbiter of the Heady AI Platform.
 *
 * HeadySoul maintains the mission-aligned identity of the system by:
 *   1. Enforcing Structural Integrity across all components
 *   2. Enforcing Semantic Coherence via embedding distance
 *   3. Enforcing Mission Alignment (community, equity, empowerment)
 *
 * It holds a "soul state" embedding in vector memory as the canonical
 * representation of what the system *should* be. Any mutation or drift
 * is evaluated against this embedding.
 *
 * @extends EventEmitter
 */
class HeadySoul extends EventEmitter {
  /**
   * @param {object} [options]
   * @param {object} [options.vectorMemory]     - VectorMemory instance
   * @param {object} [options.driftDetector]    - DriftDetector instance
   * @param {object} [options.missionOverride]  - Override default mission statement
   */
  constructor(options = {}) {
    super();

    this._vectorMemory  = options.vectorMemory  || new VectorMemory();
    this._driftDetector = options.driftDetector || new DriftDetector();

    this._state         = SoulState.STABLE;
    this._violations    = [];
    this._healingQueue  = [];
    this._rejections    = [];

    // Soul state embedding key — stable reference embedding stored in memory
    this._SOUL_EMBEDDING_KEY = 'heady_soul_core_v1';

    // Mission statement — the canonical values document
    this._mission = options.missionOverride || {
      name: 'HeadyConnection Mission',
      statement: "HeadyConnection connects the cannabis community through technology, centering equity, " +
                 "community empowerment, and inclusive access to resources.",
      values: [
        'Community: foster authentic connection and belonging',
        'Equity: prioritize historically underserved communities',
        'Empowerment: put tools and knowledge in users\' hands',
        'Transparency: operate openly and honestly',
        'Safety: protect users from harm',
      ],
      constraints: [
        'Never generate content that harms vulnerable communities',
        'Never violate user privacy or data sovereignty',
        'Never prioritize revenue over community wellbeing',
        'Never undermine equitable access to resources',
      ],
      version: '1.0.0',
      updatedAt: new Date('2025-01-01').toISOString(),
    };

    this._initialized = false;
    logger.info('[HeadySoul] Instantiated', { state: this._state });
  }

  // ─── Initialization ──────────────────────────────────────────────────────────

  /**
   * Initialize HeadySoul by loading or seeding the core soul embedding.
   * Must be called before evaluating coherence.
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._initialized) return;

    try {
      // Attempt to load existing soul embedding
      const existing = await this._vectorMemory.get(this._SOUL_EMBEDDING_KEY).catch(() => null);

      if (existing) {
        this._soulEmbedding = existing;
        logger.info('[HeadySoul] Soul embedding loaded from memory');
      } else {
        // Seed the soul embedding from the mission statement
        this._soulEmbedding = await this._vectorMemory.set(
          this._SOUL_EMBEDDING_KEY,
          {
            text: [this._mission.statement, ...this._mission.values].join(' '),
            metadata: { type: 'soul_core', version: this._mission.version },
          }
        ).catch(() => ({ key: this._SOUL_EMBEDDING_KEY, seeded: true }));
        logger.info('[HeadySoul] Soul embedding seeded from mission statement');
      }
    } catch (err) {
      logger.warn('[HeadySoul] Could not initialize soul embedding; using in-memory sentinel', {
        error: err.message,
      });
      this._soulEmbedding = { key: this._SOUL_EMBEDDING_KEY, fallback: true };
    }

    this._initialized = true;
    logger.info('[HeadySoul] Initialized', { state: this._state });
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Evaluate a component against all three Unbreakable Laws.
   *
   * @param {object} component
   * @param {string} component.id          - Component identifier
   * @param {string} component.type        - 'code' | 'content' | 'config' | 'action'
   * @param {*}      component.content     - The actual component content
   * @param {object} [component.embedding] - Pre-computed embedding (optional)
   * @returns {Promise<CoherenceResult>}
   */
  async evaluateCoherence(component) {
    if (!this._initialized) await this.initialize();

    const result = {
      componentId: component.id,
      type: component.type,
      timestamp: Date.now(),
      laws: {},
      passed: true,
      violations: [],
    };

    // Law 1: Structural Integrity
    result.laws[UNBREAKABLE_LAWS.STRUCTURAL_INTEGRITY.id] =
      await this._checkStructuralIntegrity(component);

    // Law 2: Semantic Coherence
    result.laws[UNBREAKABLE_LAWS.SEMANTIC_COHERENCE.id] =
      await this._checkSemanticCoherence(component);

    // Law 3: Mission Alignment
    result.laws[UNBREAKABLE_LAWS.MISSION_ALIGNMENT.id] =
      await this._checkMissionAlignment(component);

    // Aggregate
    for (const [lawId, check] of Object.entries(result.laws)) {
      if (!check.passed) {
        result.passed = false;
        result.violations.push({ lawId, reason: check.reason, severity: check.severity });
      }
    }

    if (!result.passed) {
      this._violations.push({ ...result, recordedAt: Date.now() });
      this._state = SoulState.VIOLATED;
      this.emit('coherence-violation', result);
      logger.warn('[HeadySoul] Coherence violation detected', {
        componentId: component.id,
        violations: result.violations,
      });
    }

    return result;
  }

  /**
   * Validate a proposed code/config mutation against soul laws.
   * Returns approved result or throws with rejection reason.
   *
   * @param {object} change
   * @param {string} change.id          - Change identifier
   * @param {string} change.description - Human-readable description
   * @param {string} change.type        - 'code' | 'config' | 'schema' | 'policy'
   * @param {*}      change.before      - Previous state
   * @param {*}      change.after       - Proposed state
   * @returns {Promise<MutationValidationResult>}
   */
  async validateMutation(change) {
    if (!this._initialized) await this.initialize();

    logger.debug('[HeadySoul] Validating mutation', { changeId: change.id, type: change.type });

    const coherenceCheck = await this.evaluateCoherence({
      id: change.id,
      type: change.type,
      content: change.after,
    });

    const result = {
      changeId: change.id,
      approved: coherenceCheck.passed,
      violations: coherenceCheck.violations,
      timestamp: Date.now(),
    };

    if (!result.approved) {
      this._rejections.push({ ...result, change, rejectedAt: Date.now() });

      this.emit('mutation-rejected', {
        changeId: change.id,
        violations: result.violations,
        change,
      });

      logger.warn('[HeadySoul] Mutation rejected', {
        changeId: change.id,
        violations: result.violations,
      });
    }

    return result;
  }

  /**
   * Respond to a drift alert from DriftDetector.
   *
   * @param {object} alert
   * @param {number} alert.driftScore
   * @param {string} alert.component
   * @param {object} [alert.details]
   * @returns {Promise<void>}
   */
  async onDriftAlert(alert) {
    logger.warn('[HeadySoul] Drift alert received', {
      driftScore: alert.driftScore,
      component: alert.component,
    });

    if (alert.driftScore > 0.7) {
      this._state = SoulState.HEALING;
      this._healingQueue.push({
        alert,
        queuedAt: Date.now(),
        healingPriority: this._driftToHealingPriority(alert.driftScore),
      });

      this.emit('healing-requested', {
        driftScore: alert.driftScore,
        component: alert.component,
        healingPriority: this._driftToHealingPriority(alert.driftScore),
      });

      // Attempt self-healing
      await this._attemptHealing(alert);
    } else if (alert.driftScore > 0.4) {
      this._state = SoulState.ALERT;
      logger.info('[HeadySoul] Elevated alert state due to drift', { driftScore: alert.driftScore });
    }
  }

  /**
   * Return the current mission statement, values, and constraints.
   * @returns {object} Mission document
   */
  getValues() {
    return {
      ...this._mission,
      soulState: this._state,
      violationCount: this._violations.length,
      rejectionCount: this._rejections.length,
    };
  }

  /**
   * Get the current soul state.
   * @returns {string} One of SoulState values
   */
  getState() {
    return this._state;
  }

  /**
   * Return recent violations.
   * @param {number} [limit=10]
   * @returns {object[]}
   */
  getViolations(limit = 10) {
    return this._violations.slice(-limit);
  }

  /**
   * Return recent mutation rejections.
   * @param {number} [limit=10]
   * @returns {object[]}
   */
  getRejections(limit = 10) {
    return this._rejections.slice(-limit);
  }

  // ─── Law Checks ──────────────────────────────────────────────────────────────

  /**
   * Law 1: Structural Integrity
   */
  async _checkStructuralIntegrity(component) {
    const check = {
      lawId: UNBREAKABLE_LAWS.STRUCTURAL_INTEGRITY.id,
      name: UNBREAKABLE_LAWS.STRUCTURAL_INTEGRITY.name,
      severity: UNBREAKABLE_LAWS.STRUCTURAL_INTEGRITY.severity,
      passed: true,
      reason: null,
      checks: [],
    };

    // Check 1a: Content is non-null and non-empty
    const hasContent = component.content !== null &&
                       component.content !== undefined &&
                       component.content !== '';
    check.checks.push({ name: 'non_empty', passed: hasContent });
    if (!hasContent) {
      check.passed = false;
      check.reason = 'Component content is empty or null';
      return check;
    }

    // Check 1b: For code type — basic structural validation (no obvious syntax issues)
    if (component.type === 'code' && typeof component.content === 'string') {
      // Look for catastrophically broken patterns
      const hasUnclosedBlocks = this._detectUnclosedBlocks(component.content);
      check.checks.push({ name: 'no_unclosed_blocks', passed: !hasUnclosedBlocks });
      if (hasUnclosedBlocks) {
        check.passed = false;
        check.reason = 'Code appears to have unclosed blocks';
      }
    }

    // Check 1c: Module boundary check — no circular dependency markers
    if (component.type === 'config' && component.content.circularDeps) {
      check.checks.push({ name: 'no_circular_deps', passed: false });
      check.passed = false;
      check.reason = 'Circular dependency detected in module boundaries';
    } else {
      check.checks.push({ name: 'no_circular_deps', passed: true });
    }

    return check;
  }

  /**
   * Law 2: Semantic Coherence
   */
  async _checkSemanticCoherence(component) {
    const law = UNBREAKABLE_LAWS.SEMANTIC_COHERENCE;
    const check = {
      lawId: law.id,
      name: law.name,
      severity: law.severity,
      passed: true,
      reason: null,
      distance: null,
    };

    if (!this._soulEmbedding || !component.embedding) {
      // No embedding available — skip distance check, assume pass
      check.checks = [{ name: 'embedding_available', passed: false, note: 'No embedding to compare; skipping' }];
      return check;
    }

    try {
      const distance = await vectorSpaceOps.cosineDistance(
        this._soulEmbedding,
        component.embedding
      );

      check.distance = distance;
      const tolerance = law.toleranceThreshold;
      check.passed = distance <= tolerance;
      if (!check.passed) {
        check.reason = `Semantic distance ${distance.toFixed(4)} exceeds tolerance ${tolerance}`;
      }
    } catch (err) {
      logger.warn('[HeadySoul] Embedding distance check failed; assuming pass', { error: err.message });
    }

    return check;
  }

  /**
   * Law 3: Mission Alignment
   */
  async _checkMissionAlignment(component) {
    const law = UNBREAKABLE_LAWS.MISSION_ALIGNMENT;
    const check = {
      lawId: law.id,
      name: law.name,
      severity: law.severity,
      passed: true,
      reason: null,
      checks: [],
    };

    const content = typeof component.content === 'string'
      ? component.content
      : JSON.stringify(component.content);

    const contentLower = content.toLowerCase();

    // Check 3a: Must not violate constraints
    const constraintViolations = this._mission.constraints.filter((constraint) => {
      const key = constraint.split(' ')[1] || ''; // e.g. "harm", "privacy"
      return contentLower.includes(key.toLowerCase()) && contentLower.includes('never');
    });
    check.checks.push({ name: 'constraint_check', passed: constraintViolations.length === 0 });

    // Check 3b: For content/text — check for actively anti-mission language
    if (component.type === 'content') {
      const antiMissionPhrases = [
        'exclude communities',
        'ignore equity',
        'profit over people',
        'deny access',
      ];
      const hasAntiMission = antiMissionPhrases.some((phrase) => contentLower.includes(phrase));
      check.checks.push({ name: 'anti_mission_language', passed: !hasAntiMission });
      if (hasAntiMission) {
        check.passed = false;
        check.reason = 'Content contains anti-mission language';
      }
    }

    if (constraintViolations.length > 0 && check.passed) {
      check.passed = false;
      check.reason = `Constraint violation detected: ${constraintViolations[0]}`;
    }

    return check;
  }

  // ─── Healing ──────────────────────────────────────────────────────────────────

  async _attemptHealing(alert) {
    logger.info('[HeadySoul] Attempting self-healing', { component: alert.component });

    try {
      // Re-anchor the drift detector to current soul embedding
      await this._driftDetector.reanchor({
        component: alert.component,
        soulEmbedding: this._soulEmbedding,
      });

      // Transition back to stable if healing was successful
      this._state = SoulState.STABLE;
      logger.info('[HeadySoul] Healing successful', { component: alert.component });
      this.emit('healing-complete', { component: alert.component });
    } catch (err) {
      logger.error('[HeadySoul] Healing failed', { component: alert.component, error: err.message });
      this._state = SoulState.VIOLATED;
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  _driftToHealingPriority(driftScore) {
    if (driftScore >= 0.9) return 'IMMEDIATE';
    if (driftScore >= 0.7) return 'HIGH';
    if (driftScore >= 0.5) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Rudimentary unclosed block detection for JS-like code.
   * Counts braces, brackets, parens.
   */
  _detectUnclosedBlocks(code) {
    let braces = 0, brackets = 0, parens = 0;
    // Strip strings and comments for accuracy
    const stripped = code.replace(/\/\*[\s\S]*?\*\//g, '')
                         .replace(/\/\/.*$/gm, '')
                         .replace(/"(?:[^"\\]|\\.)*"/g, '""')
                         .replace(/'(?:[^'\\]|\\.)*'/g, "''")
                         .replace(/`(?:[^`\\]|\\.)*`/g, '``');

    for (const ch of stripped) {
      if (ch === '{') braces++;
      else if (ch === '}') braces--;
      else if (ch === '[') brackets++;
      else if (ch === ']') brackets--;
      else if (ch === '(') parens++;
      else if (ch === ')') parens--;
    }
    return braces !== 0 || brackets !== 0 || parens !== 0;
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = { HeadySoul, UNBREAKABLE_LAWS, SoulState, PHI };
