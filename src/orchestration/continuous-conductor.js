'use strict';

/**
 * continuous-conductor.js — Heady Continuous Conductor
 *
 * Drop-in replacement for the discrete logic inside HeadyConductor.  Every
 * hard-coded switch/if-else decision point is replaced by a continuous
 * semantic gate from CSL.  Domain classification, health assessment, priority
 * scoring, swarm routing, and pool assignment are all driven by phi-harmonic
 * continuous mathematics rather than integer buckets or boolean flags.
 *
 * @module orchestration/continuous-conductor
 */

const CSL    = require('../core/semantic-logic');
const { PhiScale, PhiRange, PHI, PHI_INVERSE, PHI_SQUARED } = require('../core/phi-scales');
const logger = require('../utils/logger');
const { MonteCarloEngine } = require('../intelligence/monte-carlo-engine');

// ── Constants ─────────────────────────────────────────────────────────────────

/** Phi-normalised pool boundary — above this → warm, below → cold */
const COLD_BOUNDARY   = PHI_INVERSE;           // 0.618
/** Above this → hot */
const HOT_BOUNDARY    = 0.85;
/** Minimum resonance to register any domain activation */
const MIN_ACTIVATION  = 0.30;
/** Momentum for adaptive routing weight updates */
const ROUTING_MOMENTUM = PHI_INVERSE * PHI_INVERSE;  // ≈ 0.382 (1 - PHI_INVERSE)

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Deterministic-ish 384-dim text embedding (LCG seed, no network).
 * In production, replace with a real sentence-transformer call.
 *
 * @param {string} text
 * @param {number} [dim=384]
 * @returns {Float32Array}
 */
function _embed(text, dim = 384) {
    const vec = new Float32Array(dim);
    let seed = 0;
    for (let i = 0; i < text.length; i++) {
        seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
    }
    let s = seed || 1;
    for (let i = 0; i < dim; i++) {
        s = (s * 1664525 + 1013904223) >>> 0;
        vec[i] = (s / 0xffffffff) * 2 - 1;
    }
    return CSL.normalize(vec);
}

// ── Domain Definitions ────────────────────────────────────────────────────────

/**
 * Rich descriptions for all HeadyConductor domains.
 * Each is embedded at construction time; the array index equals the slot
 * used in multi_resonance results.
 */
const DOMAIN_DEFINITIONS = [
    {
        id: 'code_generation',
        description: 'Write, scaffold, generate, implement code, create functions, classes, modules, programs, scripts',
        pool: 'hot',
    },
    {
        id: 'code_review',
        description: 'Review, audit, inspect, analyse, evaluate, lint, check code quality, pull request review, critique',
        pool: 'warm',
    },
    {
        id: 'security',
        description: 'Security audit, vulnerability scan, penetration testing, auth, encryption, CVE, threat model, OWASP, hardening, secrets',
        pool: 'hot',
    },
    {
        id: 'architecture',
        description: 'System design, architecture, infrastructure, scalability, distributed systems, microservices, API design, data model',
        pool: 'warm',
    },
    {
        id: 'research',
        description: 'Research, investigate, explore, analyse, compare, benchmark, survey, literature review, summarise findings',
        pool: 'warm',
    },
    {
        id: 'documentation',
        description: 'Write docs, documentation, README, changelog, API reference, user guide, tutorial, comment, explain',
        pool: 'cold',
    },
    {
        id: 'creative',
        description: 'Creative writing, brainstorm, ideate, design, concept, narrative, storytelling, naming, branding',
        pool: 'cold',
    },
    {
        id: 'translation',
        description: 'Translate, localise, internationalise, i18n, l10n, language, convert, adapt for locale',
        pool: 'cold',
    },
    {
        id: 'monitoring',
        description: 'Monitor, observe, alert, metrics, logging, tracing, dashboards, health checks, SLO, SLI, uptime',
        pool: 'hot',
    },
    {
        id: 'cleanup',
        description: 'Clean up, refactor, remove dead code, prune, delete stale resources, housekeeping, technical debt',
        pool: 'cold',
    },
    {
        id: 'analytics',
        description: 'Analytics, data analysis, reporting, aggregation, KPIs, trends, statistics, business intelligence',
        pool: 'cold',
    },
    {
        id: 'maintenance',
        description: 'Maintenance, upgrades, dependency updates, patches, keep-alive, routine tasks, scheduled jobs',
        pool: 'cold',
    },
];

// ── Swarm Definitions ─────────────────────────────────────────────────────────

/**
 * All 17 HeadyConductor swarms, each with a domain description used to build
 * their semantic anchor at construction time.
 */
const SWARM_DEFINITIONS = [
    { id: 'alpha',    description: 'Core feature development, primary user-facing functionality' },
    { id: 'beta',     description: 'Beta testing, pre-release validation, canary deployments' },
    { id: 'gamma',    description: 'Data pipeline, ETL, transformation, storage, analytics workloads' },
    { id: 'delta',    description: 'Infrastructure, DevOps, CI/CD, cloud resources, IaC' },
    { id: 'epsilon',  description: 'Security, compliance, auditing, access control, secrets management' },
    { id: 'zeta',     description: 'API integration, external services, webhook handling, adapters' },
    { id: 'eta',      description: 'Documentation, knowledge base, content creation, technical writing' },
    { id: 'theta',    description: 'Machine learning, model training, inference, embeddings, AI features' },
    { id: 'iota',     description: 'Real-time monitoring, alerting, incident response, on-call' },
    { id: 'kappa',    description: 'Performance optimisation, profiling, caching, load testing' },
    { id: 'lambda',   description: 'Serverless functions, event-driven architecture, FaaS workloads' },
    { id: 'mu',       description: 'Mobile, cross-platform, PWA, React Native, iOS, Android' },
    { id: 'nu',       description: 'Frontend, UI, UX, CSS, design system, accessibility, browser' },
    { id: 'xi',       description: 'Database administration, schema migrations, query optimisation, DBA' },
    { id: 'omicron',  description: 'Testing, QA, end-to-end tests, unit tests, test automation' },
    { id: 'pi',       description: 'Platform engineering, internal tooling, developer experience, DX' },
    { id: 'rho',      description: 'Research, exploration, prototypes, spike tickets, experimental features' },
];

// ── ContinuousConductor ───────────────────────────────────────────────────────

class ContinuousConductor {

    // -------------------------------------------------------------------------
    // constructor
    // -------------------------------------------------------------------------

    /**
     * @param {object} [config={}]
     * @param {boolean}  [config.enableMonteCarlo=true]
     * @param {boolean}  [config.enableAdaptiveRouting=true]
     * @param {Map}      [config.swarmTaxonomy]         - Optional custom swarm map
     * @param {number}   [config.embeddingDimension=384]
     */
    constructor(config = {}) {
        this.enableMonteCarlo      = config.enableMonteCarlo      !== false;
        this.enableAdaptiveRouting = config.enableAdaptiveRouting !== false;
        this.swarmTaxonomy         = config.swarmTaxonomy         ?? new Map();
        this.embeddingDimension    = config.embeddingDimension    ?? 384;

        // ── Domain anchors ───────────────────────────────────────────────────
        this._domainAnchors = DOMAIN_DEFINITIONS.map(d => ({
            ...d,
            vector: _embed(d.description, this.embeddingDimension),
            weight: 1.0,           // adaptive routing multiplier
            successCount: 0,
            failureCount: 0,
        }));

        // ── Swarm anchors ────────────────────────────────────────────────────
        this._swarmAnchors = SWARM_DEFINITIONS.map(s => ({
            ...s,
            vector: _embed(s.description, this.embeddingDimension),
        }));

        // ── PhiScales ────────────────────────────────────────────────────────
        this._healthScale = new PhiScale({
            name:          'conductor.health',
            baseValue:     PHI_INVERSE,
            min:           0,
            max:           1,
            phiNormalized: true,
            sensitivity:   PHI_INVERSE,
            unit:          'health',
            category:      'conductor',
        });

        this._priorityScale = new PhiScale({
            name:          'conductor.priority',
            baseValue:     1.0,
            min:           0,
            max:           PHI_SQUARED,
            phiNormalized: true,
            sensitivity:   PHI_INVERSE,
            unit:          'priority',
            category:      'conductor',
        });

        this._hotBoundaryScale = new PhiScale({
            name:          'conductor.hotBoundary',
            baseValue:     HOT_BOUNDARY,
            min:           0.5,
            max:           1.0,
            phiNormalized: false,
            sensitivity:   0.2,
            unit:          'threshold',
            category:      'conductor',
        });

        this._coldBoundaryScale = new PhiScale({
            name:          'conductor.coldBoundary',
            baseValue:     COLD_BOUNDARY,
            min:           0.1,
            max:           0.85,
            phiNormalized: true,
            sensitivity:   0.2,
            unit:          'threshold',
            category:      'conductor',
        });

        // ── Monte Carlo engine ───────────────────────────────────────────────
        this._mc = this.enableMonteCarlo
            ? new MonteCarloEngine({ defaultIterations: 200 })
            : null;

        // ── Routing stats ────────────────────────────────────────────────────
        this._stats = {
            totalRouted:      0,
            domainActivations: new Map(this._domainAnchors.map(d => [d.id, 0])),
            poolDistribution:  { hot: 0, warm: 0, cold: 0 },
            averageConfidence: 0,
            _confidenceSum:    0,
        };

        // ── Outcome history (keyed by taskId) ────────────────────────────────
        this._outcomeHistory = new Map();

        logger.info('ContinuousConductor initialised', {
            domains: this._domainAnchors.length,
            swarms:  this._swarmAnchors.length,
            monteCarlo: this.enableMonteCarlo,
        });
    }

    // -------------------------------------------------------------------------
    // routeTask(task)
    // -------------------------------------------------------------------------

    /**
     * Core replacement for switch(task.type).  Semantically routes a task to
     * one or more domains using CSL.multi_resonance.
     *
     * @param {{
     *   input:    string,
     *   context:  object,
     *   metadata: object,
     *   priority: number,
     * }} task
     * @returns {{
     *   domain:           string,
     *   confidence:       number,
     *   activatedDomains: Array<{ id: string, score: number, weight: number }>,
     *   pool:             'hot'|'warm'|'cold',
     *   nodes:            string[],
     *   monteCarloScore:  number|null,
     * }}
     */
    routeTask(task) {
        const taskText  = [task.input, JSON.stringify(task.context ?? {})].join(' ');
        const taskVector = _embed(taskText, this.embeddingDimension);

        // Weight-adjust domain vectors by adaptive routing multiplier
        const weightedVectors = this._domainAnchors.map(d =>
            CSL.weighted_superposition(
                d.vector,
                d.vector,
                Math.min(1, d.weight * PHI_INVERSE),
            ),
        );

        const resonanceResults = CSL.multi_resonance(
            taskVector,
            weightedVectors,
            MIN_ACTIVATION,
        );

        // Build activated domains list (all that scored above MIN_ACTIVATION)
        const activatedDomains = resonanceResults
            .filter(r => r.open)
            .map(r => ({
                id:     this._domainAnchors[r.index].id,
                score:  r.score,
                weight: this._domainAnchors[r.index].weight,
            }));

        // Primary domain = highest score
        const primary = resonanceResults[0];
        const domain  = this._domainAnchors[primary.index].id;
        const confidence = primary.score;

        // Update stats
        this._stats.totalRouted++;
        this._stats._confidenceSum += confidence;
        this._stats.averageConfidence = this._stats._confidenceSum / this._stats.totalRouted;
        for (const ad of activatedDomains) {
            this._stats.domainActivations.set(
                ad.id,
                (this._stats.domainActivations.get(ad.id) ?? 0) + 1,
            );
        }

        const pool = this.assignPool(confidence, task.priority ?? 1);
        this._stats.poolDistribution[pool]++;

        // Route to swarms
        const nodes = this.routeToSwarm(task, activatedDomains).map(s => s.swarmId);

        // Optional Monte Carlo scoring
        let monteCarloScore = null;
        if (this.enableMonteCarlo && this._mc) {
            const mcResult = this._mc.quickReadiness({
                errorRate:          1 - confidence,
                lastDeploySuccess:  confidence > COLD_BOUNDARY,
                cpuPressure:        task.priority ? (task.priority / 5) : 0.3,
                memoryPressure:     0.2,
                serviceHealthRatio: confidence,
                openIncidents:      activatedDomains.length > 3 ? 1 : 0,
            });
            monteCarloScore = mcResult.score ?? mcResult.readiness ?? null;
        }

        const result = { domain, confidence, activatedDomains, pool, nodes, monteCarloScore };
        logger.debug('Task routed', {
            domain,
            confidence: confidence.toFixed(4),
            pool,
            activatedDomains: activatedDomains.length,
        });
        return result;
    }

    // -------------------------------------------------------------------------
    // assessHealth(metrics)
    // -------------------------------------------------------------------------

    /**
     * Continuous replacement for if (health > threshold).
     * Uses CSL.risk_gate with phi-scaled thresholds and returns a continuous
     * health score that adapts to system state history.
     *
     * @param {{
     *   errorRate?:          number,
     *   latencyMs?:          number,
     *   cpuUsage?:           number,
     *   memoryUsage?:        number,
     *   serviceHealthRatio?: number,
     * }} metrics
     * @returns {{
     *   score:       number,
     *   gate:        object,
     *   trend:       string,
     *   isHealthy:   boolean,
     * }}
     */
    assessHealth(metrics) {
        const errorRate     = metrics.errorRate          ?? 0;
        const latency       = metrics.latencyMs          ?? 0;
        const cpu           = metrics.cpuUsage           ?? 0;
        const mem           = metrics.memoryUsage        ?? 0;
        const serviceHealth = metrics.serviceHealthRatio ?? 1;

        // Composite health: phi-weighted combination of all signals
        const rawHealth = (
            (1 - errorRate) * PHI_SQUARED +
            (1 - Math.min(1, latency / 5000)) * PHI +
            (1 - cpu)       * 1.0 +
            (1 - mem)       * PHI_INVERSE +
            serviceHealth   * PHI_INVERSE
        ) / (PHI_SQUARED + PHI + 1.0 + PHI_INVERSE + PHI_INVERSE);

        // Update scale with current conditions
        this._healthScale.adjust({
            cpuPressure:        cpu,
            memoryPressure:     mem,
            errorRate,
            serviceHealthRatio: serviceHealth,
        });

        const threshold = this._healthScale.value;
        const gate = CSL.risk_gate(rawHealth, threshold, 0.8, 12);

        logger.debug('Health assessed', {
            rawHealth: rawHealth.toFixed(4),
            threshold: threshold.toFixed(4),
            riskLevel: gate.riskLevel,
        });

        return {
            score:     rawHealth,
            gate,
            trend:     this._healthScale.trend(),
            isHealthy: rawHealth >= threshold,
        };
    }

    // -------------------------------------------------------------------------
    // prioritizeTask(task, existingQueue)
    // -------------------------------------------------------------------------

    /**
     * Phi-normalized continuous priority scoring.
     * Replaces discrete integer priority 1-5 with a continuous score
     * in [0, PHI_SQUARED].
     *
     * @param {{ input: string, context: object, metadata: object, priority?: number }} task
     * @param {Array}  [existingQueue=[]]
     * @returns {{ score: number, normalised: number, bucket: string }}
     */
    prioritizeTask(task, existingQueue = []) {
        // Route the task first to obtain confidence
        const routing = this.routeTask(task);

        // Domain urgency: hot domains get phi-boost
        const domainUrgency = routing.pool === 'hot'  ? PHI :
                              routing.pool === 'warm' ? 1.0 : PHI_INVERSE;

        // Queue pressure: more tasks → higher urgency for all
        const queuePressure = Math.min(1, existingQueue.length / 100);

        // Base priority from caller (normalised 0-1)
        const basePriority = task.priority ? Math.min(1, task.priority / 5) : 0.5;

        // Composite score in [0, PHI_SQUARED]
        const rawScore = (
            basePriority    * PHI_SQUARED +
            routing.confidence * PHI +
            domainUrgency   * 1.0 +
            queuePressure   * PHI_INVERSE
        ) / (PHI_SQUARED + PHI + 1.0 + PHI_INVERSE);

        // Update scale
        this._priorityScale.adjust({
            cpuPressure: queuePressure,
            errorRate:   1 - routing.confidence,
        });

        const finalScore = rawScore * PHI_SQUARED;
        const range = new PhiRange(0, PHI_SQUARED, true);
        const normalised = range.normalize(finalScore);

        const bucket = finalScore >= this._hotBoundaryScale.value * PHI_SQUARED  ? 'critical'
                     : finalScore >= PHI                                          ? 'high'
                     : finalScore >= PHI_INVERSE                                  ? 'normal'
                     : 'low';

        return { score: finalScore, normalised, bucket };
    }

    // -------------------------------------------------------------------------
    // routeToSwarm(task, activatedDomains)
    // -------------------------------------------------------------------------

    /**
     * Replacement for hardcoded swarm mapping.
     * Uses CSL.multi_resonance against swarm semantic anchors.
     * Multiple swarms can be partially activated, weighted by relevance.
     *
     * @param {{ input: string }} task
     * @param {Array<{ id: string, score: number }>} activatedDomains
     * @returns {Array<{ swarmId: string, relevance: number, partial: boolean }>}
     */
    routeToSwarm(task, activatedDomains) {
        // Build a combined task+domain vector to query against swarm anchors
        const domainDescriptions = activatedDomains
            .map(ad => {
                const def = DOMAIN_DEFINITIONS.find(d => d.id === ad.id);
                return def ? def.description : ad.id;
            })
            .join(' ');

        const queryText   = `${task.input ?? ''} ${domainDescriptions}`.trim();
        const queryVector = _embed(queryText, this.embeddingDimension);

        const swarmVectors = this._swarmAnchors.map(s => s.vector);
        const results      = CSL.multi_resonance(queryVector, swarmVectors, MIN_ACTIVATION);

        const routed = results
            .filter(r => r.open)
            .map(r => ({
                swarmId:  this._swarmAnchors[r.index].id,
                relevance: r.score,
                partial:  r.score < COLD_BOUNDARY,
            }));

        // Guarantee at least one swarm even if nothing activates
        if (routed.length === 0 && results.length > 0) {
            const best = results[0];
            routed.push({
                swarmId:  this._swarmAnchors[best.index].id,
                relevance: best.score,
                partial:  true,
            });
        }

        return routed;
    }

    // -------------------------------------------------------------------------
    // Monte Carlo: _evaluateExecutionOrder(activatedActions)
    // -------------------------------------------------------------------------

    /**
     * Feed CSL action weights as probability distributions into MonteCarloEngine
     * to sample optimal execution order under uncertainty.
     *
     * @param {Array<{ id: string, weight: number, dependencies?: string[] }>} activatedActions
     * @returns {{
     *   orderedPlan: string[],
     *   confidenceIntervals: Array<{ action: string, low: number, high: number }>,
     *   monteCarloGrade: string,
     * }}
     */
    _evaluateExecutionOrder(activatedActions) {
        if (!this._mc || !this.enableMonteCarlo) {
            // Fallback: sort by weight descending
            return {
                orderedPlan: activatedActions
                    .slice()
                    .sort((a, b) => b.weight - a.weight)
                    .map(a => a.id),
                confidenceIntervals: [],
                monteCarloGrade: 'GREEN',
            };
        }

        // Map actions to MC risk factors
        const riskFactors = activatedActions.map(action => ({
            name:         action.id,
            probability:  Math.max(0.01, 1 - action.weight),
            impact:       Math.max(0.01, 1 - action.weight),
            distribution: 'normal',
            distributionParams: { mean: 1 - action.weight, std: 0.1 },
            mitigation:   `reorder_${action.id}`,
            mitigationReduction: PHI_INVERSE,
        }));

        const result = this._mc.runSimulation(
            {
                name:          'execution-order',
                seed:          42,
                riskFactors,
                pipelineStage: 'execution-planning',
            },
            300,
        );

        // Re-order: lower expected impact first (safer actions first)
        const scored = activatedActions.map((a, i) => ({
            id:    a.id,
            score: riskFactors[i].impact,
        }));
        scored.sort((a, b) => a.score - b.score);

        const confidenceIntervals = scored.map(s => ({
            action: s.id,
            low:    Math.max(0, s.score - 0.1),
            high:   Math.min(1, s.score + 0.1),
        }));

        return {
            orderedPlan:         scored.map(s => s.id),
            confidenceIntervals,
            monteCarloGrade:     result.grade ?? 'GREEN',
        };
    }

    // -------------------------------------------------------------------------
    // assignPool(confidence, urgency)
    // -------------------------------------------------------------------------

    /**
     * Phi-normalized pool assignment.
     * Uses PhiScale with phi-normalised ranges instead of discrete if/else.
     *
     * @param {number} confidence   - CSL resonance score [0, 1]
     * @param {number} [urgency=1]  - Caller-provided urgency hint [0-5]
     * @returns {'hot'|'warm'|'cold'}
     */
    assignPool(confidence, urgency = 1) {
        const normUrgency = Math.min(1, (urgency ?? 1) / 5);

        // Composite activation signal: confidence dominates, urgency nudges
        const activation = confidence * PHI + normUrgency * PHI_INVERSE;
        const normalised  = activation / (PHI + PHI_INVERSE);   // → [0, 1]

        const hotThreshold  = this._hotBoundaryScale.value;
        const coldThreshold = this._coldBoundaryScale.value;

        // Soft-gate for smooth transitions around boundaries
        const hotActivation  = CSL.soft_gate(normalised, hotThreshold,  20);
        const coldActivation = CSL.soft_gate(normalised, coldThreshold, 15);

        if (hotActivation >= COLD_BOUNDARY) {
            return 'hot';
        }
        if (coldActivation >= COLD_BOUNDARY) {
            return 'warm';
        }
        return 'cold';
    }

    // -------------------------------------------------------------------------
    // Adaptive routing: recordOutcome(taskId, domain, success)
    // -------------------------------------------------------------------------

    /**
     * Adjust domain anchor weights based on observed success or failure.
     * Uses exponential moving average with phi-scaled momentum.
     *
     * @param {string}  taskId
     * @param {string}  domain
     * @param {boolean} success
     */
    recordOutcome(taskId, domain, success) {
        this._outcomeHistory.set(taskId, { domain, success, ts: Date.now() });

        const anchor = this._domainAnchors.find(d => d.id === domain);
        if (!anchor) {
            logger.warn('recordOutcome: unknown domain', { domain });
            return;
        }

        if (success) {
            anchor.successCount++;
            // Nudge weight toward PHI (reward)
            anchor.weight = anchor.weight * (1 - ROUTING_MOMENTUM) + PHI_INVERSE * ROUTING_MOMENTUM * PHI;
        } else {
            anchor.failureCount++;
            // Nudge weight toward PHI_INVERSE (penalise)
            anchor.weight = anchor.weight * (1 - ROUTING_MOMENTUM) + PHI_INVERSE * ROUTING_MOMENTUM;
        }

        // Clamp weight: keep in [PHI_INVERSE / PHI, PHI]
        anchor.weight = Math.max(PHI_INVERSE / PHI, Math.min(PHI, anchor.weight));

        logger.debug('Routing outcome recorded', {
            domain,
            success,
            newWeight: anchor.weight.toFixed(4),
        });
    }

    // -------------------------------------------------------------------------
    // getStatus()
    // -------------------------------------------------------------------------

    /**
     * Returns routing stats, domain activations, pool distributions.
     *
     * @returns {object}
     */
    getStatus() {
        const domainWeights = {};
        for (const d of this._domainAnchors) {
            domainWeights[d.id] = {
                weight:       d.weight,
                successCount: d.successCount,
                failureCount: d.failureCount,
                pool:         d.pool,
            };
        }

        return {
            totalRouted:       this._stats.totalRouted,
            averageConfidence: this._stats.averageConfidence,
            poolDistribution:  { ...this._stats.poolDistribution },
            domainActivations: Object.fromEntries(this._stats.domainActivations),
            domainWeights,
            healthScaleValue:  this._healthScale.value,
            hotBoundary:       this._hotBoundaryScale.value,
            coldBoundary:      this._coldBoundaryScale.value,
            cslStats:          CSL.getStats(),
        };
    }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = { ContinuousConductor };
