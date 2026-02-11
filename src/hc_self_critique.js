// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: src/hc_self_critique.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * ═══════════════════════════════════════════════════════════════════════
 * HEADY SYSTEMS — Self-Critique & Continuous Optimization Engine
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Implements the iterative improvement loop:
 *   answer → critique → refine → learn
 *
 * Monitors system behavior, identifies weaknesses, proposes improvements,
 * and tracks whether improvements actually help.
 *
 * Integrates with:
 *   - Monte Carlo Plan Scheduler (speed optimization)
 *   - Pattern Engine (pattern evolution)
 *   - Connection channels (quality monitoring)
 */

"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const EventEmitter = require("events");

// ─── CONFIG LOADING ────────────────────────────────────────────────

const CONFIG_PATH = path.join(__dirname, "..", "configs", "system-self-awareness.yaml");
const CONN_CONFIG_PATH = path.join(__dirname, "..", "configs", "connection-integrity.yaml");
const PRICING_CONFIG_PATH = path.join(__dirname, "..", "configs", "extension-pricing.yaml");
const CRITIQUE_STORE_PATH = path.join(__dirname, "..", ".heady_cache", "critique_store.json");

function loadYamlConfig(filePath) {
  try {
    return yaml.load(fs.readFileSync(filePath, "utf8")) || {};
  } catch (_) {
    return {};
  }
}

function loadCritiqueStore() {
  try {
    return JSON.parse(fs.readFileSync(CRITIQUE_STORE_PATH, "utf8"));
  } catch (_) {
    return { critiques: [], improvements: [], diagnostics: [], connectionHealth: {} };
  }
}

function saveCritiqueStore(data) {
  try {
    const dir = path.dirname(CRITIQUE_STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CRITIQUE_STORE_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════════════
// SELF-CRITIQUE ENGINE
// ═══════════════════════════════════════════════════════════════════════

class SelfCritiqueEngine extends EventEmitter {
  constructor() {
    super();
    this.config = loadYamlConfig(CONFIG_PATH);
    this.connConfig = loadYamlConfig(CONN_CONFIG_PATH);
    this.pricingConfig = loadYamlConfig(PRICING_CONFIG_PATH);
    this.store = loadCritiqueStore();
    this.turnCounter = 0;
    this.metaInterval = (this.config.selfDiagnosis || {}).metaAnalysis?.intervalTurns || 5;
  }

  // ─── Record a critique of system behavior ─────────────────────────

  recordCritique(context) {
    const critique = {
      id: `critique_${Date.now()}`,
      ts: new Date().toISOString(),
      context: context.context || "general",
      weaknesses: context.weaknesses || [],
      blindSpots: context.blindSpots || [],
      confidenceRatings: context.confidenceRatings || {},
      suggestedImprovements: context.suggestedImprovements || [],
      severity: context.severity || "medium",
    };

    this.store.critiques.push(critique);
    if (this.store.critiques.length > 200) {
      this.store.critiques = this.store.critiques.slice(-200);
    }
    saveCritiqueStore(this.store);
    this.emit("critique:recorded", critique);
    return critique;
  }

  // ─── Record an improvement attempt ────────────────────────────────

  recordImprovement(improvement) {
    const record = {
      id: `improvement_${Date.now()}`,
      ts: new Date().toISOString(),
      critiqueId: improvement.critiqueId || null,
      description: improvement.description,
      type: improvement.type || "micro_upgrade", // micro_upgrade, config_change, code_fix, routing_change
      before: improvement.before || null,
      after: improvement.after || null,
      measuredImpact: improvement.measuredImpact || null,
      status: improvement.status || "proposed", // proposed, applied, measured, reverted
    };

    this.store.improvements.push(record);
    if (this.store.improvements.length > 200) {
      this.store.improvements = this.store.improvements.slice(-200);
    }
    saveCritiqueStore(this.store);
    this.emit("improvement:recorded", record);
    return record;
  }

  // ─── Run organizational bottleneck diagnostic ─────────────────────

  runBottleneckDiagnostic(context = {}) {
    const categories = (this.config.bottleneckDiagnostics || {}).categories || [];
    const diagnostic = {
      id: `diag_${Date.now()}`,
      ts: new Date().toISOString(),
      scope: context.scope || "system",
      findings: [],
      recommendations: [],
    };

    // Auto-detect from available data
    if (context.latencyData) {
      const slowItems = Object.entries(context.latencyData)
        .filter(([_, ms]) => ms > 5000)
        .sort(([_, a], [__, b]) => b - a);

      for (const [item, ms] of slowItems) {
        diagnostic.findings.push({
          category: "Hidden bottlenecks",
          item,
          latencyMs: ms,
          severity: ms > 15000 ? "critical" : ms > 8000 ? "high" : "medium",
        });
      }
    }
    // Integrate with pattern engine for context
    if (improvement.patternId && this.patternEngine) {
      record.patternContext = {
        id: improvement.patternId,
        state: this.patternEngine.getPatternState?.(improvement.patternId),
        metrics: this.patternEngine.getPatternMetrics?.(improvement.patternId),
        evolution: this.patternEngine.getPatternEvolution?.(improvement.patternId),
        relatedPatterns: this.patternEngine.getRelatedPatterns?.(improvement.patternId),
        stagnationRisk: this.patternEngine.getPatternsByState?.('stagnant')?.some(p => p.id === improvement.patternId),
        degradationRisk: this.patternEngine.getPatternsByState?.('degrading')?.some(p => p.id === improvement.patternId),
        historicalPerformance: this.patternEngine.getPatternHistory?.(improvement.patternId),
        confidenceScore: this.patternEngine.getPatternConfidence?.(improvement.patternId)
      };
    }

    // Link to recent critiques for correlation
    if (!record.critiqueId && this.store.critiques.length > 0) {
      const recentCritiques = this.store.critiques.slice(-10);
      const relatedCritique = recentCritiques.find(c => 
        c.context === improvement.context || 
        c.weaknesses?.some(w => improvement.description?.toLowerCase().includes(w.toLowerCase())) ||
        c.suggestedImprovements?.some(s => s.toLowerCase().includes(improvement.type?.toLowerCase())) ||
        c.blindSpots?.some(b => improvement.description?.toLowerCase().includes(b.toLowerCase()))
      );
      if (relatedCritique) {
        record.critiqueId = relatedCritique.id;
        record.autoLinked = true;
        record.critiqueConfidence = relatedCritique.confidenceRatings?.overall || 0.5;
        record.critiqueSeverity = relatedCritique.severity;
        record.critiqueTimestamp = relatedCritique.ts;
        record.critiqueWeaknesses = relatedCritique.weaknesses;
      }
    }

    // Track improvement priority based on severity and bottleneck diagnostics
    if (improvement.severity || improvement.priority) {
      record.priority = improvement.priority || (
        improvement.severity === 'critical' ? 1 :
        improvement.severity === 'high' ? 2 : 3
      );
      
      // Boost priority if related to recent diagnostic findings
      if (this.store.diagnostics.length > 0) {
        const recentDiag = this.store.diagnostics.slice(-3);
        const criticalFinding = recentDiag.flatMap(d => d.findings || []).find(f => 
          (f.severity === 'critical' || f.severity === 'high') && 
          (improvement.description?.includes(f.item) || improvement.context === f.category)
        );
        if (criticalFinding) {
          record.priority = Math.min(1, record.priority);
          record.diagnosticBoosted = true;
          record.diagnosticCategory = criticalFinding.category;
          record.diagnosticSeverity = criticalFinding.severity;
          record.diagnosticLatency = criticalFinding.latencyMs;
          record.diagnosticErrorRate = criticalFinding.errorRate;
        }
      }
    }

    // Add Monte Carlo confidence if available
    if (improvement.mcConfidence || improvement.successProbability || improvement.score) {
      record.confidence = {
        mcScore: improvement.mcConfidence || improvement.score,
        successProb: improvement.successProbability,
        sampleSize: improvement.mcSamples,
        historicalSuccessRate: this._getHistoricalSuccessRate(improvement.type),
        pipelineSuccessRate: this.mcPlanScheduler?.lastResults?.pipeline?.successRate,
        variance: improvement.mcVariance,
        confidenceInterval: improvement.mcConfidenceInterval
      };
    }

    // Track resource cost with pricing integration
    if (improvement.cost || improvement.budgetUsd) {
      const channelPricing = improvement.channel && this.pricingConfig?.channels?.[improvement.channel];
      record.resourceCost = {
        budgetUsd: improvement.budgetUsd || improvement.cost,
        timeMs: improvement.timeMs,
        channel: improvement.channel,
        estimatedTokens: improvement.estimatedTokens,
        channelRate: channelPricing?.ratePerToken,
        projectedCost: channelPricing && improvement.estimatedTokens ? 
          (channelPricing.ratePerToken * improvement.estimatedTokens) : null,
        costEfficiency: channelPricing?.costEfficiency,
        budgetRemaining: this.pricingConfig?.globalBudget?.remaining,
        costPerImpact: improvement.measuredImpact ? (improvement.budgetUsd / improvement.measuredImpact) : null
      };
    }

    // Track connection health impact
    if (improvement.affectedChannels && this.store.connectionHealth) {
      record.connectionImpact = improvement.affectedChannels.map(ch => ({
        channel: ch,
        currentHealth: this.store.connectionHealth[ch]?.healthy,
        lastCheck: this.store.connectionHealth[ch]?.lastCheck,
        errorRate: this.store.connectionHealth[ch]?.errorRate,
        latency: this.store.connectionHealth[ch]?.avgLatency,
        consecutiveFailures: this.store.connectionHealth[ch]?.consecutiveFailures,
        lastError: this.store.connectionHealth[ch]?.lastError
      }));
      
      // Calculate overall connection health score
      const healthScores = record.connectionImpact.map(c => c.currentHealth ? 1 : 0);
      record.overallConnectionHealth = healthScores.length > 0 ? 
        healthScores.reduce((a, b) => a + b, 0) / healthScores.length : 1;
    }

    // Add improvement scheduler metadata
    if (improvement.scheduledBy || improvement.schedulerPriority) {
      record.schedulerMetadata = {
        scheduledBy: improvement.scheduledBy || 'ImprovementScheduler',
        schedulerPriority: improvement.schedulerPriority,
        queuePosition: improvement.queuePosition,
        lane: improvement.lane || 'improvement',
        cycleId: improvement.cycleId,
        batchId: improvement.batchId,
        scheduledAt: improvement.scheduledAt || new Date().toISOString(),
        executionDelay: improvement.executionDelay
      };
    }

    // Track improvement type classification
    record.classification = {
      type: improvement.type || 'micro_upgrade',
      category: improvement.category || this._classifyImprovement(improvement),
      isPatternBased: !!improvement.patternId,
      isCritiqueBased: !!record.critiqueId,
      isDiagnosticBased: !!record.diagnosticBoosted,
      isPipelineDriven: !!improvement.lane,
      isAutomated: improvement.automated !== false,
      requiresValidation: improvement.requiresValidation || record.priority === 1
    };

    // Add meta-analysis correlation
    if (this.turnCounter > 0 && this.turnCounter % this.metaInterval === 0) {
      const recentMeta = this._getRecentMetaAnalysis();
      if (recentMeta) {
        record.metaCorrelation = {
          topWeakness: recentMeta.topWeaknesses?.[0]?.weakness,
          improvementEffectiveness: recentMeta.improvementEffectiveness,
          systemTrend: recentMeta.recommendations?.length > 3 ? 'degrading' : 'stable',
          recentCritiqueCount: recentMeta.recentCritiqueCount,
          unhealthyChannels: recentMeta.recommendations?.find(r => r.area === 'connections')?.count || 0
        };
      }
    }

    // Add pipeline execution context if available
    if (this.pipeline && improvement.lane) {
      record.pipelineContext = {
        lane: improvement.lane,
        pipelineState: this.pipeline.getState?.(),
        queueDepth: this.pipeline.getQueueDepth?.(improvement.lane),
        recentSuccessRate: this.pipeline.getSuccessRate?.(improvement.lane),
        averageExecutionTime: this.pipeline.getAverageExecutionTime?.(improvement.lane)
      };
    }

    // Track temporal context for trend analysis
    record.temporalContext = {
      timestamp: record.ts,
      dayOfWeek: new Date(record.ts).getDay(),
      hourOfDay: new Date(record.ts).getHours(),
      turnNumber: this.turnCounter,
      recentImprovementCount: this.store.improvements.slice(-10).length,
      recentCritiqueCount: this.store.critiques.slice(-10).length,
      timeSinceLastImprovement: this.store.improvements.length > 0 ? 
        Date.now() - new Date(this.store.improvements[this.store.improvements.length - 1].ts).getTime() : null
    };

    // Add rollback capability tracking
    record.rollback = {
      canRollback: !!improvement.before,
      rollbackData: improvement.before,
      rollbackPlan: improvement.rollbackPlan,
      autoRollbackThreshold: improvement.autoRollbackThreshold || 0.3,
      rollbackConditions: improvement.rollbackConditions || []
    };
metaAnalysisId: recentMeta.turn,
metaTimestamp: recentMeta.ts,
confidenceScore: this._calculateMetaConfidence(improvement, recentMeta),
alignmentScore: this._calculateAlignmentWithMeta(improvement, recentMeta),
recommendationMatch: recentMeta.recommendations?.some(r => 
  r.action?.toLowerCase().includes(improvement.type?.toLowerCase()) ||
  improvement.description?.toLowerCase().includes(r.area?.toLowerCase())
),
criticalityScore: this._assessImprovementCriticality(improvement, recentMeta),
impactRadius: this._estimateImpactRadius(improvement, recentMeta),
riskLevel: this._calculateRiskLevel(improvement, recentMeta),
priorityWeight: this._calculatePriorityWeight(improvement, recentMeta),
dependencyChain: this._identifyDependencies(improvement),
conflictingPatterns: this._detectConflictingPatterns(improvement),
synergisticImprovements: this._findSynergisticImprovements(improvement),
historicalCorrelation: this._findHistoricalCorrelations(improvement),
patternEvolutionStage: this._determinePatternStage(improvement),
monteCarloValidation: this.mcPlanScheduler ? {
  estimatedSuccessRate: this._estimateSuccessRate(improvement.type),
  optimalStrategy: this._getOptimalStrategy(improvement.type),
  estimatedLatency: this._estimateLatency(improvement.type, improvement.strategy),
  qualityEstimate: this._estimateQuality(improvement.type, improvement.strategy),
  ucb1Score: this.mcPlanScheduler._getUCB1ForStrategy?.(improvement.type, improvement.strategy?.id),
  convergenceStatus: this._checkConvergenceStatus(improvement.type),
  driftDetected: this.mcPlanScheduler.driftAlerts?.some(d => d.taskType === improvement.type),
  speedMode: this.mcPlanScheduler.speedMode?.label,
  planCount: this.mcPlanScheduler.generatePlans?.(improvement.type, improvement.meta, {}).length,
  resourceFiltering: improvement.requiredResources?.length > 0,
  parallelismScore: improvement.strategy?.parallelism || 1
} : null,
connectionHealthCorrelation: this._correlateWithConnectionHealth(improvement),
costBenefitRatio: record.resourceCost?.budgetUsd && improvement.measuredImpact ? 
  improvement.measuredImpact / record.resourceCost.budgetUsd : null,
expectedROI: this._calculateExpectedROI(improvement, recentMeta),
degradationRisk: recentMeta.topWeaknesses?.some(w => 
  improvement.description?.toLowerCase().includes(w.weakness?.toLowerCase())
) ? 'high' : 'low',
systemStateAlignment: this._assessSystemStateAlignment(improvement, recentMeta),
pipelineReadiness: this._assessPipelineReadiness(improvement),
validationRequirements: this._determineValidationRequirements(improvement, recentMeta),
rollbackComplexity: this._assessRollbackComplexity(improvement),
weaknessTargeting: recentMeta.topWeaknesses?.filter(w => 
  improvement.description?.toLowerCase().includes(w.weakness?.toLowerCase())
).map(w => ({ weakness: w.weakness, occurrences: w.count })),
improvementEffectivenessHistory: recentMeta.improvementEffectiveness,
connectionHealthSnapshot: Object.entries(recentMeta.connectionHealth || {}).map(([id, health]) => ({
  channelId: id,
  healthy: health.healthy,
  errorRate: health.errorRate,
  consecutiveFailures: health.consecutiveFailures
})),
diagnosticAlignment: this.store.diagnostics.slice(-3).some(d => 
  d.findings?.some(f => improvement.description?.includes(f.item))
),

    if (context.errorRates) {
      const highError = Object.entries(context.errorRates)
        .filter(([_, rate]) => rate > 0.05);

      for (const [item, rate] of highError) {
        diagnostic.findings.push({
          category: "Reliability patterns",
          item,
          errorRate: rate,
          severity: rate > 0.2 ? "critical" : "high",
        });
      }
    }

    if (context.utilizationData) {
      const overloaded = Object.entries(context.utilizationData)
        .filter(([_, util]) => util > 0.9);
      const underused = Object.entries(context.utilizationData)
        .filter(([_, util]) => util < 0.2);

      for (const [item, util] of overloaded) {
        diagnostic.findings.push({
          category: "Under/over-utilization",
          item,
          utilization: util,
          type: "overloaded",
          severity: "high",
        });
      }
      for (const [item, util] of underused) {
        diagnostic.findings.push({
          category: "Under/over-utilization",
          item,
          utilization: util,
          type: "underused",
          severity: "medium",
        });
      }
    }

    // Generate recommendations per finding
    for (const finding of diagnostic.findings) {
      if (finding.category === "Hidden bottlenecks") {
        diagnostic.recommendations.push({
          finding: finding.item,
          action: "Run Monte Carlo re-optimization to find faster path",
          experiment: `Test parallel execution for ${finding.item}`,
          timeframe: "4 weeks",
        });
      }
      if (finding.category === "Reliability patterns") {
        diagnostic.recommendations.push({
          finding: finding.item,
          action: "Add circuit breaker and retry with backoff",
          experiment: `A/B test retry strategies for ${finding.item}`,
          timeframe: "2 weeks",
        });
      }
    }

    this.store.diagnostics.push(diagnostic);
    if (this.store.diagnostics.length > 50) {
      this.store.diagnostics = this.store.diagnostics.slice(-50);
    }
    saveCritiqueStore(this.store);
    this.emit("diagnostic:complete", diagnostic);
    return diagnostic;
  }

  // ─── Connection health check ──────────────────────────────────────

  checkConnectionHealth(channelId, metrics = {}) {
    const channels = (this.connConfig.channels || {});
    const channel = channels[channelId];
    if (!channel) return { ok: false, error: `Unknown channel: ${channelId}` };

    const qualityTargets = {};
    const qualityChecks = (this.connConfig.qualityChecks || {}).metrics || [];
    for (const metric of qualityChecks) {
      if (metric.targets && metric.targets[channelId]) {
        qualityTargets[metric.name] = metric.targets[channelId];
      }
    }

    const issues = [];
    if (metrics.latencyMs && qualityTargets.response_latency_ms) {
      if (metrics.latencyMs > qualityTargets.response_latency_ms) {
        issues.push({
          metric: "latency",
          actual: metrics.latencyMs,
          target: qualityTargets.response_latency_ms,
          severity: metrics.latencyMs > qualityTargets.response_latency_ms * 2 ? "critical" : "warning",
        });
      }
    }
    if (metrics.errorRate != null) {
      const maxError = (this.connConfig.qualityChecks || {}).metrics?.find(m => m.name === "error_rate_percent");
      if (maxError && metrics.errorRate > (maxError.maxAcceptable || 1.0)) {
        issues.push({
          metric: "error_rate",
          actual: metrics.errorRate,
          target: maxError.maxAcceptable,
          severity: "critical",
        });
      }
    }

    const result = {
      channelId,
      channelName: channel.name,
      ts: new Date().toISOString(),
      healthy: issues.length === 0,
      issues,
      targets: qualityTargets,
      actual: metrics,
    };

    this.store.connectionHealth[channelId] = result;
    saveCritiqueStore(this.store);

    if (!result.healthy) {
      this.emit("connection:unhealthy", result);
    }
    return result;
  }

  // ─── Get pricing info ─────────────────────────────────────────────

  getPricingTiers() {
    return (this.pricingConfig.tiers || {});
  }

  getFairAccessPrograms() {
    return (this.pricingConfig.fairAccess || {}).programs || {};
  }

  getPricingMetrics() {
    return (this.pricingConfig.optimization || {}).metricsToTrack || [];
  }

  // ─── Get system self-knowledge ────────────────────────────────────

  getSelfKnowledge() {
    return {
      architecture: (this.config.selfKnowledge || {}).architecture || {},
      strengths: (this.config.selfKnowledge || {}).strengths || [],
      weaknesses: (this.config.selfKnowledge || {}).weaknesses || [],
      constraints: (this.config.selfKnowledge || {}).constraints || [],
      nonOptimizationStance: (this.config.nonOptimization || {}).defaultStance || "unknown",
    };
  }

  // ─── Meta-analysis (periodic self-review) ─────────────────────────

  runMetaAnalysis() {
    this.turnCounter++;
    if (this.turnCounter % this.metaInterval !== 0) return null;

    const recentCritiques = this.store.critiques.slice(-10);
    const recentImprovements = this.store.improvements.slice(-10);

    const analysis = {
      turn: this.turnCounter,
      ts: new Date().toISOString(),
      recentCritiqueCount: recentCritiques.length,
      recentImprovementCount: recentImprovements.length,
      topWeaknesses: this._aggregateWeaknesses(recentCritiques),
      improvementEffectiveness: this._measureImprovementEffectiveness(recentImprovements),
      connectionHealth: this.store.connectionHealth,
      recommendations: [],
    };

    // Generate recommendations
    if (analysis.topWeaknesses.length > 0) {
      analysis.recommendations.push({
        area: "weaknesses",
        action: `Address top weakness: ${analysis.topWeaknesses[0].weakness}`,
        occurrences: analysis.topWeaknesses[0].count,
      });
    }

    const unhealthyChannels = Object.entries(this.store.connectionHealth)
      .filter(([_, h]) => !h.healthy);
    if (unhealthyChannels.length > 0) {
      analysis.recommendations.push({
        area: "connections",
        action: `Fix unhealthy channels: ${unhealthyChannels.map(([id]) => id).join(", ")}`,
        count: unhealthyChannels.length,
      });
    }

    this.emit("meta:analysis", analysis);
    return analysis;
  }

  _aggregateWeaknesses(critiques) {
    const counts = {};
    for (const c of critiques) {
      for (const w of (c.weaknesses || [])) {
        counts[w] = (counts[w] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([weakness, count]) => ({ weakness, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  _measureImprovementEffectiveness(improvements) {
    const applied = improvements.filter(i => i.status === "applied" || i.status === "measured");
    const measured = improvements.filter(i => i.status === "measured");
    const positive = measured.filter(i => i.measuredImpact && i.measuredImpact > 0);
    return {
      totalProposed: improvements.length,
      totalApplied: applied.length,
      totalMeasured: measured.length,
      totalPositive: positive.length,
      effectivenessRate: measured.length > 0 ? positive.length / measured.length : null,
    };
  }

  // ─── Get full status ──────────────────────────────────────────────

  getStatus() {
    return {
      turnCounter: this.turnCounter,
      totalCritiques: this.store.critiques.length,
      totalImprovements: this.store.improvements.length,
      totalDiagnostics: this.store.diagnostics.length,
      connectionChannels: Object.keys((this.connConfig.channels || {})),
      pricingTiers: Object.keys((this.pricingConfig.tiers || {})),
      selfKnowledge: this.getSelfKnowledge(),
    };
  }

  getRecentCritiques(limit = 10) {
    return this.store.critiques.slice(-limit);
  }

  getRecentImprovements(limit = 10) {
    return this.store.improvements.slice(-limit);
  }

  getRecentDiagnostics(limit = 5) {
    return this.store.diagnostics.slice(-limit);
  }
}

// Singleton
const selfCritique = new SelfCritiqueEngine();

// ═══════════════════════════════════════════════════════════════════════
// EXPRESS ROUTES
// ═══════════════════════════════════════════════════════════════════════

function registerSelfCritiqueRoutes(app, engine) {
  // Status
  app.get("/api/self/status", (_req, res) => {
    res.json({ ok: true, ...engine.getStatus(), ts: new Date().toISOString() });
  });

  // Self-knowledge
  app.get("/api/self/knowledge", (_req, res) => {
    res.json({ ok: true, ...engine.getSelfKnowledge(), ts: new Date().toISOString() });
  });

  // Record critique
  app.post("/api/self/critique", (req, res) => {
    try {
      const critique = engine.recordCritique(req.body);
      res.json({ ok: true, critique });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Recent critiques
  app.get("/api/self/critiques", (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 10;
    res.json({ ok: true, critiques: engine.getRecentCritiques(limit) });
  });

  // Record improvement
  app.post("/api/self/improvement", (req, res) => {
    try {
      const improvement = engine.recordImprovement(req.body);
      res.json({ ok: true, improvement });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Recent improvements
  app.get("/api/self/improvements", (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 10;
    res.json({ ok: true, improvements: engine.getRecentImprovements(limit) });
  });

  // Run bottleneck diagnostic
  app.post("/api/self/diagnose", (req, res) => {
    try {
      const diagnostic = engine.runBottleneckDiagnostic(req.body);
      res.json({ ok: true, diagnostic });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Recent diagnostics
  app.get("/api/self/diagnostics", (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 5;
    res.json({ ok: true, diagnostics: engine.getRecentDiagnostics(limit) });
  });

  // Connection health check
  app.post("/api/self/connection-health", (req, res) => {
    const { channelId, metrics } = req.body;
    if (!channelId) return res.status(400).json({ error: "channelId required" });
    const result = engine.checkConnectionHealth(channelId, metrics || {});
    res.json({ ok: true, ...result });
  });

  // All connection health
  app.get("/api/self/connections", (_req, res) => {
    res.json({ ok: true, channels: engine.store.connectionHealth, ts: new Date().toISOString() });
  });

  // Pricing tiers
  app.get("/api/pricing/tiers", (_req, res) => {
    res.json({ ok: true, tiers: engine.getPricingTiers(), ts: new Date().toISOString() });
  });

  // Fair access programs
  app.get("/api/pricing/fair-access", (_req, res) => {
    res.json({ ok: true, programs: engine.getFairAccessPrograms(), ts: new Date().toISOString() });
  });

  // Pricing metrics to track
  app.get("/api/pricing/metrics", (_req, res) => {
    res.json({ ok: true, metrics: engine.getPricingMetrics(), ts: new Date().toISOString() });
  });

  // Run meta-analysis
  app.post("/api/self/meta-analysis", (_req, res) => {
    const analysis = engine.runMetaAnalysis();
    res.json({ ok: true, analysis, ts: new Date().toISOString() });
  });
}

// ─── Exports ────────────────────────────────────────────────────────
module.exports = {
  SelfCritiqueEngine,
  selfCritique,
  registerSelfCritiqueRoutes,
};
