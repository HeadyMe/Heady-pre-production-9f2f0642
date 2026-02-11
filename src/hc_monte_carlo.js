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
// ║  FILE: src/hc_monte_carlo.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  HC MONTE CARLO - Probabilistic Simulation Engine                ║
 * ║  Sacred Geometry Architecture v3.0.0                             ║
 * ║                                                                   ║
 * ║  Core simulation capabilities:                                    ║
 * ║    • Pipeline reliability estimation                              ║
 * ║    • Deployment risk scoring                                      ║
 * ║    • Readiness confidence intervals                               ║
 * ║    • Node performance prediction                                  ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

const crypto = require("crypto");

// ─── Random Utilities ───────────────────────────────────────────────
function secureRandom() {
  return crypto.randomInt(0, 2 ** 32) / 2 ** 32;
}

function normalRandom(mean = 0, stddev = 1) {
  // Box-Muller transform
  const u1 = secureRandom();
  const u2 = secureRandom();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + stddev * z;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// ─── Distribution Samplers ──────────────────────────────────────────
const Distributions = {
  uniform(min, max) {
    return min + secureRandom() * (max - min);
  },

  normal(mean, stddev) {
    return normalRandom(mean, stddev);
  },

  exponential(lambda) {
    return -Math.log(1 - secureRandom()) / lambda;
  },

  bernoulli(p) {
    return secureRandom() < p ? 1 : 0;
  },

  beta(alpha, beta) {
    // Approximation via Jöhnk's algorithm for small alpha/beta
    if (alpha <= 1 && beta <= 1) {
      let u, v, x, y;
      do {
        u = Math.pow(secureRandom(), 1 / alpha);
        v = Math.pow(secureRandom(), 1 / beta);
        x = u + v;
      } while (x > 1 || x === 0);
      return u / x;
    }
    // For larger values, use gamma ratio
    const ga = Distributions._gamma(alpha);
    const gb = Distributions._gamma(beta);
    return ga / (ga + gb);
  },

  _gamma(shape) {
    // Marsaglia & Tsang's method
    if (shape < 1) {
      return Distributions._gamma(shape + 1) * Math.pow(secureRandom(), 1 / shape);
    }
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    let x, v;
    do {
      do {
        x = normalRandom();
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = secureRandom();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    } while (true);
  },
};

// ─── Statistics Helpers ─────────────────────────────────────────────
function computeStats(samples) {
  const n = samples.length;
  if (n === 0) return { mean: 0, median: 0, stddev: 0, p5: 0, p25: 0, p75: 0, p95: 0, min: 0, max: 0, n: 0 };

  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const variance = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;

  return {
    mean,
    median: sorted[Math.floor(n / 2)],
    stddev: Math.sqrt(variance),
    p5: sorted[Math.floor(n * 0.05)],
    p25: sorted[Math.floor(n * 0.25)],
    p75: sorted[Math.floor(n * 0.75)],
    p95: sorted[Math.floor(n * 0.95)],
    min: sorted[0],
    max: sorted[n - 1],
    n,
  };
}

function confidenceInterval(samples, confidence = 0.95) {
  const stats = computeStats(samples);
  const z = confidence === 0.99 ? 2.576 : confidence === 0.95 ? 1.96 : 1.645;
  const marginOfError = z * (stats.stddev / Math.sqrt(stats.n));
  return {
    mean: stats.mean,
    lower: stats.mean - marginOfError,
    upper: stats.mean + marginOfError,
    confidence,
    marginOfError,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// SIMULATION 1: PIPELINE RELIABILITY
// Estimates probability of a full pipeline run succeeding based on
// historical stage failure rates and latency distributions.
// ═══════════════════════════════════════════════════════════════════════

function simulatePipelineReliability(stageProfiles, iterations = 10000) {
  /**
   * stageProfiles: Array of {
   *   id: string,
   *   failureRate: number (0-1),         // historical failure probability
   *   latencyMeanMs: number,             // mean execution time
   *   latencyStddevMs: number,           // stddev of execution time
   *   timeoutMs: number,                 // stage timeout
   *   retries: number (default 0),       // retry count on failure
   *   dependsOn: string[] (optional),    // stage dependencies
   * }
   */

  const results = [];
  let successCount = 0;

  for (let i = 0; i < iterations; i++) {
    let totalLatency = 0;
    let pipelineSuccess = true;
    const stageResults = {};

    for (const stage of stageProfiles) {
      // Check if dependency failed
      if (stage.dependsOn) {
        const depFailed = stage.dependsOn.some((dep) => stageResults[dep] === false);
        if (depFailed) {
          stageResults[stage.id] = false;
          pipelineSuccess = false;
          continue;
        }
      }

      // Simulate stage execution with retries
      let stageSuccess = false;
      let stageLatency = 0;
      const maxAttempts = 1 + (stage.retries || 0);

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const latency = Math.max(0, normalRandom(stage.latencyMeanMs, stage.latencyStddevMs));
        stageLatency += latency;

        if (latency > stage.timeoutMs) {
          // Timeout
          continue;
        }

        if (secureRandom() > stage.failureRate) {
          stageSuccess = true;
          break;
        }
      }

      stageResults[stage.id] = stageSuccess;
      totalLatency += stageLatency;

      if (!stageSuccess) {
        pipelineSuccess = false;
      }
    }

    if (pipelineSuccess) successCount++;
    results.push({ success: pipelineSuccess, totalLatencyMs: totalLatency });
  }

  const successRate = successCount / iterations;
  const latencies = results.map((r) => r.totalLatencyMs);
  const successLatencies = results.filter((r) => r.success).map((r) => r.totalLatencyMs);

  return {
    type: "pipeline_reliability",
    iterations,
    successRate,
    successCount,
    failureCount: iterations - successCount,
    confidence: confidenceInterval(results.map((r) => (r.success ? 1 : 0))),
    latency: {
      all: computeStats(latencies),
      successful: computeStats(successLatencies),
    },
    stageProfiles: stageProfiles.map((s) => s.id),
    timestamp: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// SIMULATION 2: DEPLOYMENT RISK
// Scores deployment risk by simulating deployment scenarios against
// historical data patterns.
// ═══════════════════════════════════════════════════════════════════════

function simulateDeploymentRisk(deploymentProfile, iterations = 5000) {
  /**
   * deploymentProfile: {
   *   buildFailureRate: number (0-1),
   *   testFailureRate: number (0-1),
   *   rollbackRate: number (0-1),         // historical rollback frequency
   *   downtime: { meanMs, stddevMs },     // expected downtime distribution
   *   serviceCount: number,               // number of services being deployed
   *   hasCanaryDeploy: boolean,
   *   hasDatabaseMigration: boolean,
   *   changeComplexity: "low" | "medium" | "high",
   * }
   */

  const complexityMultiplier = { low: 0.8, medium: 1.0, high: 1.5 };
  const multiplier = complexityMultiplier[deploymentProfile.changeComplexity] || 1.0;

  const riskScores = [];
  let fullSuccessCount = 0;

  for (let i = 0; i < iterations; i++) {
    let riskScore = 0;

    // Build phase
    const buildFails = Distributions.bernoulli(deploymentProfile.buildFailureRate * multiplier);
    if (buildFails) {
      riskScore += 30;
    }

    // Test phase
    const testFails = Distributions.bernoulli(deploymentProfile.testFailureRate * multiplier);
    if (testFails) {
      riskScore += 20;
    }

    // Service deployment (each service can independently fail)
    let serviceFailures = 0;
    for (let s = 0; s < deploymentProfile.serviceCount; s++) {
      const serviceFails = Distributions.bernoulli(0.02 * multiplier); // 2% base per service
      if (serviceFails) serviceFailures++;
    }
    riskScore += serviceFailures * 15;

    // Canary deployment reduces risk
    if (deploymentProfile.hasCanaryDeploy) {
      riskScore *= 0.6;
    }

    // Database migration increases risk
    if (deploymentProfile.hasDatabaseMigration) {
      riskScore += Distributions.uniform(5, 25) * multiplier;
    }

    // Rollback scenario
    const needsRollback = Distributions.bernoulli(deploymentProfile.rollbackRate * multiplier);
    if (needsRollback) {
      riskScore += 25;
    }

    // Downtime estimation
    const downtime = Math.max(0, normalRandom(deploymentProfile.downtime.meanMs, deploymentProfile.downtime.stddevMs));
    riskScore += (downtime / 60000) * 2; // 2 points per minute of downtime

    riskScore = clamp(riskScore, 0, 100);
    riskScores.push(riskScore);

    if (riskScore < 10) fullSuccessCount++;
  }

  const stats = computeStats(riskScores);
  const ci = confidenceInterval(riskScores);

  return {
    type: "deployment_risk",
    iterations,
    riskScore: {
      mean: stats.mean,
      median: stats.median,
      p95: stats.p95,
      grade: stats.mean < 15 ? "LOW" : stats.mean < 40 ? "MEDIUM" : stats.mean < 70 ? "HIGH" : "CRITICAL",
    },
    confidence: ci,
    stats,
    cleanDeployRate: fullSuccessCount / iterations,
    profile: {
      complexity: deploymentProfile.changeComplexity,
      services: deploymentProfile.serviceCount,
      canary: deploymentProfile.hasCanaryDeploy,
      dbMigration: deploymentProfile.hasDatabaseMigration,
    },
    timestamp: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// SIMULATION 3: READINESS CONFIDENCE
// Produces confidence intervals for production readiness based on
// multi-dimensional system health signals.
// ═══════════════════════════════════════════════════════════════════════

function simulateReadinessConfidence(healthSignals, iterations = 8000) {
  /**
   * healthSignals: {
   *   nodeAvailability: number (0-1),    // fraction of nodes reporting healthy
   *   apiLatencyMs: { mean, stddev },    // API response time distribution
   *   errorRate: number (0-1),           // current error rate
   *   memoryUsage: number (0-1),         // fraction of memory used
   *   cpuUsage: number (0-1),            // fraction of CPU used
   *   uptime: number,                    // seconds of uptime
   *   testPassRate: number (0-1),        // test suite pass rate
   *   coveragePercent: number (0-100),   // code coverage
   * }
   */

  const readinessScores = [];

  for (let i = 0; i < iterations; i++) {
    let score = 0;
    const maxScore = 100;

    // Node availability (weight: 25)
    const nodeScore = Distributions.beta(
      healthSignals.nodeAvailability * 10 + 1,
      (1 - healthSignals.nodeAvailability) * 10 + 1
    );
    score += nodeScore * 25;

    // API latency (weight: 20) — lower is better
    const latency = Math.max(0, normalRandom(healthSignals.apiLatencyMs.mean, healthSignals.apiLatencyMs.stddev));
    const latencyScore = clamp(1 - latency / 5000, 0, 1); // 5s = 0 score
    score += latencyScore * 20;

    // Error rate (weight: 20) — lower is better
    const errorSample = Distributions.beta(
      healthSignals.errorRate * 20 + 1,
      (1 - healthSignals.errorRate) * 20 + 1
    );
    score += (1 - errorSample) * 20;

    // Resource usage (weight: 15) — moderate is ideal, penalize only high usage
    const memSample = Distributions.beta(
      healthSignals.memoryUsage * 5 + 1,
      (1 - healthSignals.memoryUsage) * 5 + 1
    );
    const cpuSample = Distributions.beta(
      healthSignals.cpuUsage * 5 + 1,
      (1 - healthSignals.cpuUsage) * 5 + 1
    );
    const peakResource = Math.max(memSample, cpuSample);
    const resourceScore = peakResource < 0.8 ? 1.0 : clamp(1 - (peakResource - 0.8) * 5, 0, 1);
    score += clamp(resourceScore, 0, 1) * 15;

    // Stability bonus (weight: 10) — uptime factor
    const uptimeMinutes = healthSignals.uptime / 60;
    const stabilityScore = clamp(uptimeMinutes / 10, 0, 1); // Max at 10 min
    score += stabilityScore * 10;

    // Test quality (weight: 10)
    const testScore = Distributions.beta(
      healthSignals.testPassRate * 15 + 1,
      (1 - healthSignals.testPassRate) * 15 + 1
    );
    const coverageNorm = clamp(healthSignals.coveragePercent / 100, 0, 1);
    score += ((testScore + coverageNorm) / 2) * 10;

    readinessScores.push(clamp(score, 0, maxScore));
  }

  const stats = computeStats(readinessScores);
  const ci = confidenceInterval(readinessScores);

  return {
    type: "readiness_confidence",
    iterations,
    readiness: {
      score: stats.mean,
      grade: stats.mean >= 85 ? "PRODUCTION_READY" : stats.mean >= 70 ? "STAGING_READY" : stats.mean >= 50 ? "DEVELOPMENT" : "NOT_READY",
      confidence: ci,
    },
    breakdown: {
      p5: stats.p5,
      p25: stats.p25,
      median: stats.median,
      p75: stats.p75,
      p95: stats.p95,
    },
    stats,
    timestamp: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// SIMULATION 4: NODE PERFORMANCE PREDICTION
// Simulates load patterns across AI nodes to predict bottlenecks
// and optimal routing strategies.
// ═══════════════════════════════════════════════════════════════════════

function simulateNodePerformance(nodeProfiles, loadProfile, iterations = 5000) {
  /**
   * nodeProfiles: Array of {
   *   id: string,
   *   capacity: number,                   // max concurrent tasks
   *   processingTimeMeanMs: number,
   *   processingTimeStddevMs: number,
   *   failureRate: number (0-1),
   * }
   *
   * loadProfile: {
   *   tasksPerSecond: number,             // incoming task rate
   *   durationSeconds: number,            // simulation duration
   *   burstFactor: number (1-5),          // burst multiplier
   *   burstProbability: number (0-1),     // chance of burst per second
   * }
   */

  const nodeStats = {};
  for (const node of nodeProfiles) {
    nodeStats[node.id] = { processed: 0, failed: 0, dropped: 0, totalLatencyMs: 0, peakQueue: 0, latencies: [] };
  }

  for (let iter = 0; iter < iterations; iter++) {
    // Reset per-iteration queues
    const queues = {};
    for (const node of nodeProfiles) {
      queues[node.id] = 0;
    }

    for (let sec = 0; sec < loadProfile.durationSeconds; sec++) {
      // Determine incoming load for this second
      const isBurst = Distributions.bernoulli(loadProfile.burstProbability);
      const multiplier = isBurst ? loadProfile.burstFactor : 1;
      const tasksThisSecond = Math.round(loadProfile.tasksPerSecond * multiplier);

      // Route tasks round-robin with capacity awareness
      for (let t = 0; t < tasksThisSecond; t++) {
        // Find node with lowest queue
        let bestNode = null;
        let bestQueue = Infinity;
        for (const node of nodeProfiles) {
          if (queues[node.id] < bestQueue) {
            bestQueue = queues[node.id];
            bestNode = node;
          }
        }

        if (queues[bestNode.id] >= bestNode.capacity) {
          nodeStats[bestNode.id].dropped++;
          continue;
        }

        queues[bestNode.id]++;

        // Process
        const latency = Math.max(0, normalRandom(bestNode.processingTimeMeanMs, bestNode.processingTimeStddevMs));
        const fails = Distributions.bernoulli(bestNode.failureRate);

        if (fails) {
          nodeStats[bestNode.id].failed++;
        } else {
          nodeStats[bestNode.id].processed++;
          nodeStats[bestNode.id].totalLatencyMs += latency;
          nodeStats[bestNode.id].latencies.push(latency);
        }

        // Track peak queue
        if (queues[bestNode.id] > nodeStats[bestNode.id].peakQueue) {
          nodeStats[bestNode.id].peakQueue = queues[bestNode.id];
        }
      }

      // Drain queues (simplified: each node processes up to capacity per second)
      for (const node of nodeProfiles) {
        queues[node.id] = Math.max(0, queues[node.id] - node.capacity);
      }
    }
  }

  // Compile results
  const nodeResults = nodeProfiles.map((node) => {
    const s = nodeStats[node.id];
    const total = s.processed + s.failed + s.dropped;
    return {
      id: node.id,
      processed: s.processed,
      failed: s.failed,
      dropped: s.dropped,
      total,
      successRate: total > 0 ? s.processed / total : 0,
      dropRate: total > 0 ? s.dropped / total : 0,
      avgLatencyMs: s.processed > 0 ? s.totalLatencyMs / s.processed : 0,
      latencyStats: computeStats(s.latencies),
      peakQueue: s.peakQueue,
      utilizationEstimate: clamp(s.processed / (node.capacity * loadProfile.durationSeconds * iterations), 0, 1),
      bottleneck: s.dropped > total * 0.1,
    };
  });

  const bottlenecks = nodeResults.filter((n) => n.bottleneck).map((n) => n.id);

  return {
    type: "node_performance",
    iterations,
    load: loadProfile,
    nodes: nodeResults,
    bottlenecks,
    hasBottlenecks: bottlenecks.length > 0,
    recommendation: bottlenecks.length > 0
      ? `Scale up nodes: ${bottlenecks.join(", ")}. Drop rate exceeds 10%.`
      : "No bottlenecks detected. Current capacity is sufficient.",
    timestamp: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// COMPOSITE: FULL SYSTEM SIMULATION
// Runs all four simulations and produces a unified risk/readiness report.
// ═══════════════════════════════════════════════════════════════════════

function simulateFullSystem(config) {
  const pipeline = config.pipeline ? simulatePipelineReliability(config.pipeline.stages, config.iterations || 10000) : null;
  const deployment = config.deployment ? simulateDeploymentRisk(config.deployment, config.iterations || 5000) : null;
  const readiness = config.readiness ? simulateReadinessConfidence(config.readiness, config.iterations || 8000) : null;
  const nodes = config.nodes ? simulateNodePerformance(config.nodes.profiles, config.nodes.load, config.iterations || 5000) : null;

  // Composite score
  const scores = [];
  if (pipeline) scores.push(pipeline.successRate * 100);
  if (deployment) scores.push(100 - deployment.riskScore.mean);
  if (readiness) scores.push(readiness.readiness.score);
  if (nodes && !nodes.hasBottlenecks) scores.push(100);
  else if (nodes) scores.push(50);

  const compositeScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  return {
    type: "full_system_simulation",
    compositeScore,
    grade: compositeScore >= 85 ? "EXCELLENT" : compositeScore >= 70 ? "GOOD" : compositeScore >= 50 ? "FAIR" : "POOR",
    pipeline: pipeline ? { successRate: pipeline.successRate, confidence: pipeline.confidence } : null,
    deployment: deployment ? { riskGrade: deployment.riskScore.grade, meanRisk: deployment.riskScore.mean } : null,
    readiness: readiness ? { score: readiness.readiness.score, grade: readiness.readiness.grade } : null,
    nodes: nodes ? { bottlenecks: nodes.bottlenecks, hasBottlenecks: nodes.hasBottlenecks } : null,
    timestamp: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// FAST SIMULATIONS (low-iteration for real-time global embedding)
// Always-on Monte Carlo: every decision gets probabilistic confidence.
// ═══════════════════════════════════════════════════════════════════════

const FAST_ITERATIONS = 500;

function fastPipelineSim(stageProfiles) {
  return simulatePipelineReliability(stageProfiles, FAST_ITERATIONS);
}

function fastDeploymentSim(profile) {
  return simulateDeploymentRisk(profile, FAST_ITERATIONS);
}

function fastReadinessSim(signals) {
  return simulateReadinessConfidence(signals, FAST_ITERATIONS);
}

function fastNodeSim(profiles, load) {
  return simulateNodePerformance(profiles, load, FAST_ITERATIONS);
}

// ═══════════════════════════════════════════════════════════════════════
// MONTE CARLO GLOBAL — Always-On Probabilistic Intelligence Layer
// Attaches to every subsystem, enriches every decision with confidence
// intervals, risk scores, and probabilistic forecasts.
// ═══════════════════════════════════════════════════════════════════════

class MonteCarloGlobal {
  constructor() {
    this.enabled = true;
    this.lastResults = {
      pipeline: null,
      deployment: null,
      readiness: null,
      nodes: null,
      full: null,
    };
    this.history = [];
    this.eventLog = [];
    this.autoRunInterval = null;
    this.backgroundCycleMs = 120000; // auto-refresh every 2 min (aligned with Pattern Engine)
    this._systemRefs = {};
  }

  /**
   * Bind live system references so MC can pull real-time data.
   * Call once at boot with { pipeline, brain, health, readiness, registry }.
   */
  bind(refs) {
    this._systemRefs = refs;
  }

  /**
   * Start background auto-refresh cycle.
   * Runs a full fast-sim every backgroundCycleMs and caches results.
   */
  startAutoRun() {
    if (this.autoRunInterval) return;
    this.autoRunInterval = setInterval(() => {
      try { this.runFullCycle("auto"); } catch (_) { /* non-fatal */ }
    }, this.backgroundCycleMs);
    // Immediate first run
    try { this.runFullCycle("boot"); } catch (_) {}
  }

  stopAutoRun() {
    if (this.autoRunInterval) {
      clearInterval(this.autoRunInterval);
      this.autoRunInterval = null;
    }
  }

  /**
   * Run a full fast Monte Carlo cycle across all dimensions.
   * Returns composite results and caches them for API enrichment.
   */
  runFullCycle(trigger = "manual") {
    const ts = new Date().toISOString();
    const results = {};

    // Pipeline reliability
    try {
      const stages = this._getPipelineStages();
      if (stages && stages.length > 0) {
        results.pipeline = fastPipelineSim(stages);
      }
    } catch (_) {}

    // Deployment risk
    try {
      results.deployment = fastDeploymentSim(this._getDeploymentProfile());
    } catch (_) {}

    // Readiness confidence
    try {
      results.readiness = fastReadinessSim(this._getHealthSignals());
    } catch (_) {}

    // Node performance
    try {
      const { profiles, load } = this._getNodeProfiles();
      if (profiles.length > 0) {
        results.nodes = fastNodeSim(profiles, load);
      }
    } catch (_) {}

    // Composite score
    const scores = [];
    if (results.pipeline) scores.push(results.pipeline.successRate * 100);
    if (results.deployment) scores.push(100 - results.deployment.riskScore.mean);
    if (results.readiness) scores.push(results.readiness.readiness.score);
    if (results.nodes && !results.nodes.hasBottlenecks) scores.push(100);
    else if (results.nodes) scores.push(50);

    const compositeScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    const cycle = {
      trigger,
      timestamp: ts,
      compositeScore,
      grade: compositeScore >= 85 ? "EXCELLENT" : compositeScore >= 70 ? "GOOD" : compositeScore >= 50 ? "FAIR" : "POOR",
      pipeline: results.pipeline ? { successRate: results.pipeline.successRate, confidence: results.pipeline.confidence } : null,
      deployment: results.deployment ? { riskGrade: results.deployment.riskScore.grade, meanRisk: results.deployment.riskScore.mean } : null,
      readiness: results.readiness ? { score: results.readiness.readiness.score, grade: results.readiness.readiness.grade, confidence: results.readiness.readiness.confidence } : null,
      nodes: results.nodes ? { bottlenecks: results.nodes.bottlenecks, hasBottlenecks: results.nodes.hasBottlenecks } : null,
    };

    // Cache
    this.lastResults = { ...results, _cycle: cycle };
    this.history.push(cycle);
    if (this.history.length > 100) this.history = this.history.slice(-100);

    this._logEvent("full_cycle", trigger, cycle);
    return cycle;
  }

  /**
   * Enrich any object with Monte Carlo confidence data.
   * Call this to add MC metadata to any API response or decision.
   */
  enrich(obj = {}) {
    const cycle = this.lastResults._cycle || this.runFullCycle("enrich");
    return {
      ...obj,
      monteCarlo: {
        compositeScore: cycle.compositeScore,
        grade: cycle.grade,
        pipeline: cycle.pipeline,
        deployment: cycle.deployment,
        readiness: cycle.readiness,
        nodes: cycle.nodes,
        timestamp: cycle.timestamp,
        trigger: cycle.trigger,
      },
    };
  }

  /**
   * Quick readiness confidence for a single decision point.
   * Returns { score, grade, confidence } in <10ms.
   */
  quickReadiness() {
    if (this.lastResults.readiness) {
      return this.lastResults.readiness.readiness;
    }
    const signals = this._getHealthSignals();
    const result = fastReadinessSim(signals);
    this.lastResults.readiness = result;
    return result.readiness;
  }

  /**
   * Quick pipeline risk for a single decision point.
   */
  quickPipelineRisk() {
    if (this.lastResults.pipeline) {
      return {
        successRate: this.lastResults.pipeline.successRate,
        confidence: this.lastResults.pipeline.confidence,
      };
    }
    const stages = this._getPipelineStages();
    if (!stages || stages.length === 0) return { successRate: 1.0, confidence: null };
    const result = fastPipelineSim(stages);
    this.lastResults.pipeline = result;
    return { successRate: result.successRate, confidence: result.confidence };
  }

  /**
   * Quick deployment risk for a single decision point.
   */
  quickDeploymentRisk() {
    if (this.lastResults.deployment) {
      return this.lastResults.deployment.riskScore;
    }
    const result = fastDeploymentSim(this._getDeploymentProfile());
    this.lastResults.deployment = result;
    return result.riskScore;
  }

  /**
   * Event hook: call on pipeline stage completion for live MC update.
   */
  onStageEnd(stageId, status, metrics) {
    this._logEvent("stage_end", stageId, { status, metrics });
    // Re-run pipeline sim with updated failure rates
    try {
      const stages = this._getPipelineStages();
      if (stages && stages.length > 0) {
        this.lastResults.pipeline = fastPipelineSim(stages);
      }
    } catch (_) {}
  }

  /**
   * Event hook: call on checkpoint for MC-augmented checkpoint data.
   */
  onCheckpoint(stageId, checkpointData) {
    this._logEvent("checkpoint", stageId, checkpointData);
    // Run readiness sim to attach confidence to checkpoint
    try {
      const signals = this._getHealthSignals();
      this.lastResults.readiness = fastReadinessSim(signals);
    } catch (_) {}
    return this.enrich(checkpointData || {});
  }

  /**
   * Event hook: call on pipeline run start.
   */
  onPipelineStart(runId) {
    this._logEvent("pipeline_start", runId, {});
    return this.runFullCycle("pipeline_start");
  }

  /**
   * Event hook: call on pipeline run end.
   */
  onPipelineEnd(runId, status, metrics) {
    this._logEvent("pipeline_end", runId, { status, metrics });
    return this.runFullCycle("pipeline_end");
  }

  /**
   * Event hook: call after health check completes.
   */
  onHealthCheck(snapshot) {
    this._logEvent("health_check", "system", snapshot);
    try {
      const signals = this._getHealthSignals();
      this.lastResults.readiness = fastReadinessSim(signals);
    } catch (_) {}
  }

  /**
   * Event hook: call when brain auto-tunes.
   */
  onBrainTune(tuneData) {
    this._logEvent("brain_tune", "brain", tuneData);
    // Refresh deployment risk based on new error rates
    try {
      this.lastResults.deployment = fastDeploymentSim(this._getDeploymentProfile());
    } catch (_) {}
  }

  /**
   * Get current global MC status for API exposure.
   */
  getStatus() {
    const cycle = this.lastResults._cycle || null;
    return {
      enabled: this.enabled,
      autoRunning: !!this.autoRunInterval,
      backgroundCycleMs: this.backgroundCycleMs,
      lastCycle: cycle,
      historyLength: this.history.length,
      eventLogLength: this.eventLog.length,
    };
  }

  /**
   * Get recent history of MC cycles.
   */
  getHistory(limit = 20) {
    return this.history.slice(-limit);
  }

  /**
   * Get recent event log.
   */
  getEventLog(limit = 50) {
    return this.eventLog.slice(-limit);
  }

  // ─── Internal helpers ──────────────────────────────────────────────

  _getPipelineStages() {
    try {
      if (this._systemRefs.pipeline) {
        const dag = this._systemRefs.pipeline.getStageDag();
        return dag.map((s) => ({
          id: s.id,
          failureRate: 0.01,
          latencyMeanMs: s.timeout ? s.timeout / 2 : 5000,
          latencyStddevMs: s.timeout ? s.timeout / 6 : 1500,
          timeoutMs: s.timeout || 30000,
          retries: 1,
          dependsOn: s.dependsOn || [],
        }));
      }
    } catch (_) {}
    return [];
  }

  _getDeploymentProfile() {
    return {
      buildFailureRate: 0.02,
      testFailureRate: 0.03,
      rollbackRate: 0.01,
      downtime: { meanMs: 10000, stddevMs: 5000 },
      serviceCount: 1,
      hasCanaryDeploy: true,
      hasDatabaseMigration: false,
      changeComplexity: "low",
    };
  }

  _getHealthSignals() {
    const memInfo = process.memoryUsage();
    const cpus = require("os").cpus();
    const cpuIdle = cpus.reduce((sum, c) => sum + c.times.idle, 0) / cpus.length;
    const cpuTotal = cpus.reduce((sum, c) => sum + c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq, 0) / cpus.length;
    const base = {
      nodeAvailability: 1.0,
      apiLatencyMs: { mean: 50, stddev: 20 },
      errorRate: 0.001,
      memoryUsage: memInfo.heapUsed / memInfo.heapTotal,
      cpuUsage: cpuTotal > 0 ? 1 - (cpuIdle / cpuTotal) : 0.1,
      uptime: process.uptime(),
      testPassRate: 1.0,
      coveragePercent: 95,
    };
    // Enrich from live health runner if available
    try {
      if (this._systemRefs.health) {
        const snap = this._systemRefs.health.getSnapshot();
        if (snap && snap.results) {
          const total = Object.keys(snap.results).length;
          const healthy = Object.values(snap.results).filter((r) => r.status === "ok").length;
          if (total > 0) base.nodeAvailability = healthy / total;
        }
      }
    } catch (_) {}
    return base;
  }

  _getNodeProfiles() {
    const profiles = [];
    const load = { tasksPerSecond: 5, durationSeconds: 30, burstFactor: 3, burstProbability: 0.1 };
    try {
      if (this._systemRefs.registry) {
        const reg = this._systemRefs.registry();
        for (const [id] of Object.entries(reg.nodes || {})) {
          profiles.push({
            id,
            capacity: 10,
            processingTimeMeanMs: 500,
            processingTimeStddevMs: 200,
            failureRate: 0.02,
          });
        }
      }
    } catch (_) {}
    return { profiles, load };
  }

  _logEvent(type, source, data) {
    this.eventLog.push({
      type,
      source,
      timestamp: new Date().toISOString(),
      summary: typeof data === "object" ? (data.compositeScore !== undefined ? `score=${data.compositeScore.toFixed(1)}` : JSON.stringify(data).slice(0, 120)) : String(data),
    });
    if (this.eventLog.length > 500) this.eventLog = this.eventLog.slice(-500);
  }

  /**
   * Prioritize improvement tasks based on:
   * - Pattern severity
   * - Self-critique findings
   * - Historical success rates
   */
  prioritizeImprovements(improvements) {
    if (!improvements || improvements.length === 0) return [];
    
    // Score each improvement
    const scored = improvements.map(imp => {
      let score = 0;
      
      // Base priority
      score += (4 - imp.priority) * 25; // Higher priority = higher score
      
      // Pattern severity boost
      if (imp.type.includes('pattern') && imp.details?.severity) {
        score += imp.details.severity === 'critical' ? 50 : 
                 imp.details.severity === 'high' ? 30 : 10;
      }
      
      // Critique confidence boost
      if (imp.type === 'self_critique' && imp.details?.confidence) {
        score += imp.details.confidence * 20;
      }
      
      // Historical success rate (if available)
      if (this.lastResults.pipeline?.successRate) {
        score *= this.lastResults.pipeline.successRate;
      }
      
      return { ...imp, score };
    });
    
    // Sort by score
    return scored.sort((a, b) => b.score - a.score);
  }

  /**
   * API: Get recommended improvement plan
   */
  getImprovementPlan(improvements) {
    const prioritized = this.prioritizeImprovements(improvements);
    const budget = 3; // Max improvements to recommend
    
    return {
      recommendations: prioritized.slice(0, budget),
      confidence: this.quickReadiness(),
      timestamp: new Date().toISOString(),
    };
  }
}

// Singleton global MC instance
const mcGlobal = new MonteCarloGlobal();

// ═══════════════════════════════════════════════════════════════════════
// MONTE CARLO TASK PLAN SCHEDULER
// Generates candidate execution plans for any task, estimates latency
// via historical data + probes, selects the fastest acceptable plan
// using UCB1, and feeds back actual results as new samples.
// ═══════════════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { EventEmitter } = require("events");

const MC_CONFIG_PATH = path.join(__dirname, "..", "configs", "monte-carlo-scheduler.yaml");
const MC_SAMPLES_PATH = path.join(__dirname, "..", ".heady_cache", "mc_samples.json");

function loadMCConfig() {
  try {
    if (fs.existsSync(MC_CONFIG_PATH)) {
      return yaml.load(fs.readFileSync(MC_CONFIG_PATH, "utf8"));
    }
  } catch (_) {}
  return null;
}

function loadSamples() {
  try {
    if (fs.existsSync(MC_SAMPLES_PATH)) {
      return JSON.parse(fs.readFileSync(MC_SAMPLES_PATH, "utf8"));
    }
  } catch (_) {}
  return {};
}

function saveSamples(data) {
  try {
    const dir = path.dirname(MC_SAMPLES_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MC_SAMPLES_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (_) {}
}

// ─── PLAN STRATEGIES ─────────────────────────────────────────────────

const BUILTIN_STRATEGIES = [
  { id: "fast_serial",       parallelism: 1,     validationLevel: "none",     modelPreference: "smallest",  baseQuality: 80 },
  { id: "fast_parallel",     parallelism: "max", validationLevel: "none",     modelPreference: "smallest",  baseQuality: 80 },
  { id: "balanced",          parallelism: "auto", validationLevel: "standard", modelPreference: "default",  baseQuality: 90 },
  { id: "thorough",          parallelism: 1,     validationLevel: "full",     modelPreference: "largest",   baseQuality: 98 },
  { id: "cached_fast",       parallelism: "auto", validationLevel: "none",    modelPreference: "cached",    baseQuality: 85 },
  { id: "probe_then_commit", parallelism: "auto", validationLevel: "probe",   modelPreference: "adaptive",  baseQuality: 88 },
];

// Speed priority mode: when active, quality threshold drops and speed weight rises
const SPEED_PRIORITY = {
  OFF:    { minQuality: 50, speedWeight: 0.6, qualityWeight: 0.4, label: "normal" },
  ON:     { minQuality: 40, speedWeight: 0.8, qualityWeight: 0.2, label: "speed_priority" },
  MAX:    { minQuality: 30, speedWeight: 0.9, qualityWeight: 0.1, label: "max_speed" },
};

// ─── UCB1 SELECTION ──────────────────────────────────────────────────

function ucb1Score(strategyStats, totalTrials, explorationConstant) {
  if (strategyStats.trials === 0) return Infinity; // unexplored = max priority
  const avgReward = strategyStats.totalReward / strategyStats.trials;
  const exploration = explorationConstant * Math.sqrt(Math.log(totalTrials) / strategyStats.trials);
  return avgReward + exploration;
}

// ─── MC TASK PLAN SCHEDULER CLASS ────────────────────────────────────

class MCTaskPlanScheduler extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = loadMCConfig() || {};
    this.samples = loadSamples(); // { [taskType]: { [strategyId]: { trials, totalReward, totalLatencyMs, successes, failures, latencies[] } } }
    this.explorationConstant = (this.config.selection || {}).explorationConstant || 1.4;
    this.minQualityScore = (this.config.selection || {}).minQualityScore || 50;
    this.speedMode = SPEED_PRIORITY.OFF;
    this.minSamplesForLock = (this.config.selection || {}).minSamplesForLock || 10;
    this.maxSamplesPerType = (this.config.feedback || {}).maxSamplesPerType || 500;
    this.sampleDecayFactor = (this.config.feedback || {}).sampleDecayFactor || 0.95;
    this.driftThresholdFactor = (this.config.feedback || {}).driftThresholdFactor || 1.5;
    this.latencyTargets = (this.config.latencyTargets || {});
    this.defaultLatencyMs = (this.config.costEstimation || {}).defaultLatencyMs || {};
    this.warmPoolAgents = (this.config.costEstimation || {}).warmPoolAgents || [];
    this.coldStartPenaltyMs = (this.config.costEstimation || {}).coldStartPenaltyMs || 1500;
    this.parallelismOverheadMs = (this.config.costEstimation || {}).parallelismOverheadMs || {};
    this.historicalWeight = (this.config.costEstimation || {}).historicalWeight || 0.7;
    this.strategies = BUILTIN_STRATEGIES;
    this.planHistory = [];
    this.driftAlerts = [];
    this._executionCounter = 0;
    this._reEvaluateEvery = (this.config.feedback || {}).reEvaluateEvery || 10;
  }

  // ─── Generate candidate plans for a task ───────────────────────────

  // ─── Set speed priority mode ─────────────────────────────────────

  setSpeedMode(mode) {
    if (mode === "max" || mode === "MAX") this.speedMode = SPEED_PRIORITY.MAX;
    else if (mode === "on" || mode === "ON" || mode === true) this.speedMode = SPEED_PRIORITY.ON;
    else this.speedMode = SPEED_PRIORITY.OFF;
    this.emit("speed_mode:changed", { mode: this.speedMode.label });
    return this.speedMode;
  }

  getSpeedMode() { return this.speedMode; }

  generatePlans(taskType, taskMeta = {}, availableResources) {
    const numCandidates = taskMeta.complex
      ? (this.config.planGeneration || {}).candidatesForComplex || 12
      : (this.config.planGeneration || {}).candidatesPerTask || 6;

    const plans = [];
    // Always include ALL strategies — don't randomly exclude fast ones
    const ordered = [...this.strategies].sort(() => secureRandom() - 0.5);
    const toInclude = ordered.slice(0, Math.min(numCandidates, ordered.length));

    for (const strategy of toInclude) {
      const estimatedLatencyMs = this._estimateLatency(taskType, strategy, taskMeta);
      const qualityEstimate = this._estimateQuality(taskType, strategy);

      plans.push({
        planId: `plan_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
        taskType,
        strategy: strategy.id,
        parallelism: strategy.parallelism,
        validationLevel: strategy.validationLevel,
        modelPreference: strategy.modelPreference,
        estimatedLatencyMs,
        qualityEstimate,
        ucb1Score: this._getUCB1ForStrategy(taskType, strategy.id),
        fromCache: strategy.modelPreference === "cached",
        speedMode: this.speedMode.label,
        requiredResources: strategy.requiredResources || [],
      });
    }

    // Filter plans based on resource availability
    plans = plans.filter(plan => 
      plan.requiredResources.every(res => 
        availableResources[res.type] >= res.amount
      )
    );

    // Sort plans by estimated duration
    plans.sort((a, b) => a.estimatedLatencyMs - b.estimatedLatencyMs);

    return plans.slice(0, 5); // Return top 5 plans
  }

  // ─── Select the best plan ──────────────────────────────────────────

  selectPlan(plans, constraints = {}) {
    // Speed priority lowers quality threshold and favors faster plans
    const speedPriority = constraints.speedPriority || this.speedMode;
    const minQuality = constraints.minQualityScore || speedPriority.minQuality || this.minQualityScore;
    const enforceSafety = constraints.critical || false;

    // Filter: must meet quality constraints (lowered in speed modes)
    let eligible = plans.filter(p => p.qualityEstimate >= minQuality);

    // Safety: critical tasks cannot skip validation
    if (enforceSafety) {
      eligible = eligible.filter(p => p.validationLevel !== "none");
    }

    if (eligible.length === 0) {
      // Never fail — include all plans, just warn
      eligible = plans;
      this.emit("plan:quality_override", { reason: "all_plans_below_threshold", minQuality, planCount: plans.length });
    }

    // In speed modes: re-sort eligible by estimated latency (fastest first)
    if (speedPriority !== SPEED_PRIORITY.OFF) {
      eligible.sort((a, b) => a.estimatedLatencyMs - b.estimatedLatencyMs);
    }

    const selected = eligible[0];
    this.emit("plan:selected", {
      planId: selected.planId,
      strategy: selected.strategy,
      estimatedLatencyMs: selected.estimatedLatencyMs,
      qualityEstimate: selected.qualityEstimate,
      speedMode: speedPriority.label || "normal",
    });
    return selected;
  }

  // ─── Record execution result (feedback loop) ──────────────────────

  recordResult(taskType, strategyId, actualLatencyMs, success, qualityScore = 100) {
    if (!this.samples[taskType]) {
      this.samples[taskType] = {};
    }
    if (!this.samples[taskType][strategyId]) {
      this.samples[taskType][strategyId] = {
        trials: 0, totalReward: 0, totalLatencyMs: 0,
        successes: 0, failures: 0, latencies: [],
      };
    }

    const stats = this.samples[taskType][strategyId];

    // Reward: blends speed and quality, weighted by current speed mode
    const target = this._getLatencyTarget(taskType);
    // Speed reward: 1.0 at target, scales down. Bonus for beating target.
    const speedRatio = target > 0 ? actualLatencyMs / target : 1;
    const speedReward = clamp(2 - speedRatio, 0, 1); // 1.0 at target, >1.0 if faster, 0 at 2x target
    const qualityReward = qualityScore / 100;
    const sw = this.speedMode.speedWeight;
    const qw = this.speedMode.qualityWeight;
    const reward = (speedReward * sw) + (qualityReward * qw);

    stats.trials++;
    stats.totalReward += reward;
    stats.totalLatencyMs += actualLatencyMs;
    if (success) stats.successes++; else stats.failures++;
    stats.latencies.push(actualLatencyMs);

    // Ring buffer: cap latencies
    if (stats.latencies.length > this.maxSamplesPerType) {
      stats.latencies = stats.latencies.slice(-this.maxSamplesPerType);
    }

    // Apply decay to old reward (exponential moving average effect)
    if (stats.trials > 1) {
      stats.totalReward = stats.totalReward * this.sampleDecayFactor + reward * (1 - this.sampleDecayFactor) * stats.trials;
    }

    this._executionCounter++;
    this.planHistory.push({
      taskType, strategyId, actualLatencyMs, success, qualityScore, reward,
      ts: new Date().toISOString(),
    });
    if (this.planHistory.length > 1000) this.planHistory = this.planHistory.slice(-500);

    // Periodic re-evaluation and drift detection
    if (this._executionCounter % this._reEvaluateEvery === 0) {
      this._checkDrift(taskType);
    }

    // Persist
    saveSamples(this.samples);

    this.emit("result:recorded", { taskType, strategyId, actualLatencyMs, reward });
    return { reward, speedReward, qualityReward };
  }

  // ─── Full plan-select-execute cycle (convenience) ──────────────────

  planAndSelect(taskType, taskMeta = {}, constraints = {}, availableResources) {
    const plans = this.generatePlans(taskType, taskMeta, availableResources);
    const selected = this.selectPlan(plans, constraints);
    return { plans, selected };
  }

  // ─── Get metrics for a task type ──────────────────────────────────

  getMetrics(taskType) {
    const typeSamples = this.samples[taskType];
    if (!typeSamples) return { taskType, strategies: [], bestStrategy: null };

    const strategies = Object.entries(typeSamples).map(([id, stats]) => {
      const latencyStats = stats.latencies.length > 0 ? computeStats(stats.latencies) : null;
      const target = this._getLatencyTarget(taskType);
      const speedScore = latencyStats && target > 0
        ? Math.round(100 * clamp(1 - (latencyStats.median / target - 1), 0, 1))
        : null;

      return {
        strategyId: id,
        trials: stats.trials,
        avgReward: stats.trials > 0 ? stats.totalReward / stats.trials : 0,
        avgLatencyMs: stats.trials > 0 ? Math.round(stats.totalLatencyMs / stats.trials) : 0,
        successRate: stats.trials > 0 ? stats.successes / stats.trials : 0,
        speedScore,
        latency: latencyStats ? {
          median: Math.round(latencyStats.median),
          p90: Math.round(latencyStats.p95),
          min: Math.round(latencyStats.min),
          max: Math.round(latencyStats.max),
        } : null,
        converged: this._isConverged(stats),
      };
    });

    strategies.sort((a, b) => b.avgReward - a.avgReward);
    return {
      taskType,
      strategies,
      bestStrategy: strategies[0] || null,
      target: this._getLatencyTarget(taskType),
    };
  }

  // ─── Get all metrics across all task types ─────────────────────────

  getAllMetrics() {
    const types = Object.keys(this.samples);
    const metrics = {};
    for (const t of types) {
      metrics[t] = this.getMetrics(t);
    }

    // Global speed score
    const allScores = [];
    for (const m of Object.values(metrics)) {
      if (m.bestStrategy && m.bestStrategy.speedScore != null) {
        allScores.push(m.bestStrategy.speedScore);
      }
    }
    const globalSpeedScore = allScores.length > 0
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : null;

    return {
      taskTypes: types.length,
      metrics,
      globalSpeedScore,
      driftAlerts: this.driftAlerts.slice(-20),
      totalExecutions: this._executionCounter,
      ts: new Date().toISOString(),
    };
  }

  // ─── Get recent plan history ───────────────────────────────────────

  getHistory(limit = 50) {
    return this.planHistory.slice(-limit);
  }

  // ─── Internal: estimate latency for a strategy ─────────────────────

  _estimateLatency(taskType, strategy, taskMeta = {}) {
    const defaultMs = this.defaultLatencyMs[taskType] || 2000;

    // Historical estimate
    const typeSamples = this.samples[taskType];
    const stratStats = typeSamples ? typeSamples[strategy.id] : null;
    const historicalMs = stratStats && stratStats.trials > 0
      ? stratStats.totalLatencyMs / stratStats.trials
      : null;

    // Base estimate from defaults
    let baseMs = defaultMs;

    // Strategy adjustments
    if (strategy.modelPreference === "smallest") baseMs *= 0.5;
    else if (strategy.modelPreference === "largest") baseMs *= 2.0;
    else if (strategy.modelPreference === "cached") baseMs *= 0.1;

    // Parallelism overhead
    const pLevel = strategy.parallelism === "max" ? 8 : strategy.parallelism === "auto" ? 4 : strategy.parallelism;
    const overheadMs = this.parallelismOverheadMs[pLevel] || this.parallelismOverheadMs["max"] || 400;
    if (pLevel > 1 && taskMeta.subTasks) {
      baseMs = (baseMs / pLevel) + overheadMs;
    }

    // Cold start penalty
    const isWarm = this.warmPoolAgents.includes(taskType);
    if (!isWarm) baseMs += this.coldStartPenaltyMs * 0.3;

    // Blend historical and estimated
    if (historicalMs != null) {
      return Math.round(historicalMs * this.historicalWeight + baseMs * (1 - this.historicalWeight));
    }
    return Math.round(baseMs);
  }

  _estimateQuality(taskType, strategy) {
    // Start with the strategy's base quality (not validation-level alone)
    let quality = strategy.baseQuality || 80;

    // Adapt using historical success rate for this strategy+taskType
    const typeSamples = this.samples[taskType];
    const stratStats = typeSamples ? typeSamples[strategy.id] : null;
    if (stratStats && stratStats.trials >= 3) {
      const historicalQuality = stratStats.successes / stratStats.trials * 100;
      // Blend: 60% historical, 40% base estimate
      quality = Math.round(historicalQuality * 0.6 + quality * 0.4);
    }

    // Validation level bonus/penalty on top
    switch (strategy.validationLevel) {
      case "full":     quality = Math.min(100, quality + 5); break;
      case "standard": break; // no adjustment
      case "probe":    quality = Math.max(50, quality - 3); break;
      case "none":     quality = Math.max(50, quality - 5); break;
    }

    return clamp(quality, 0, 100);
  }

  _getLatencyTarget(taskType) {
    if (this.latencyTargets[`${taskType}_ms`]) return this.latencyTargets[`${taskType}_ms`];
    return this.latencyTargets.batch_task_ms || 15000;
  }

  _getUCB1ForStrategy(taskType, strategyId) {
    const typeSamples = this.samples[taskType];
    if (!typeSamples) return Infinity;
    const stratStats = typeSamples[strategyId];
    if (!stratStats || stratStats.trials === 0) return Infinity;

    const totalTrials = Object.values(typeSamples).reduce((sum, s) => sum + s.trials, 0);
    return ucb1Score(stratStats, totalTrials, this.explorationConstant);
  }

  _isConverged(stats) {
    if (stats.latencies.length < 20) return false;
    const recent = stats.latencies.slice(-20);
    const s = computeStats(recent);
    if (s.mean === 0) return false;
    const cv = s.stddev / s.mean; // coefficient of variation
    return cv < 0.05;
  }

  _checkDrift(taskType) {
    const target = this._getLatencyTarget(taskType);
    if (!target) return;

    const typeSamples = this.samples[taskType];
    if (!typeSamples) return;

    for (const [stratId, stats] of Object.entries(typeSamples)) {
      if (stats.latencies.length < 5) continue;
      const recent = stats.latencies.slice(-10);
      const median = computeStats(recent).median;
      if (median > target * this.driftThresholdFactor) {
        const alert = {
          taskType, strategyId: stratId,
          medianMs: Math.round(median), targetMs: target,
          factor: +(median / target).toFixed(2),
          ts: new Date().toISOString(),
          action: "re_optimize",
        };
        this.driftAlerts.push(alert);
        if (this.driftAlerts.length > 100) this.driftAlerts = this.driftAlerts.slice(-100);
        this.emit("drift:detected", alert);
      }
    }
  }
}

// Singleton
const mcPlanScheduler = new MCTaskPlanScheduler();

// ═══════════════════════════════════════════════════════════════════════
// EXPRESS ROUTES — Monte Carlo API
// ═══════════════════════════════════════════════════════════════════════

function registerMonteCarloRoutes(app, planScheduler, globalMC) {
  // Plan & select for a task
  app.post("/api/monte-carlo/plan", (req, res) => {
    try {
      const { taskType, taskMeta, constraints, availableResources } = req.body;
      if (!taskType) return res.status(400).json({ error: "taskType required" });
      const result = planScheduler.planAndSelect(taskType, taskMeta || {}, constraints || {}, availableResources || {});
      res.json({ ok: true, ...result, ts: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Record execution result
  app.post("/api/monte-carlo/result", (req, res) => {
    try {
      const { taskType, strategyId, actualLatencyMs, success, qualityScore } = req.body;
      if (!taskType || !strategyId || actualLatencyMs == null) {
        return res.status(400).json({ error: "taskType, strategyId, actualLatencyMs required" });
      }
      const reward = planScheduler.recordResult(taskType, strategyId, actualLatencyMs, success !== false, qualityScore);
      res.json({ ok: true, ...reward, ts: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get metrics for a task type or all
  app.get("/api/monte-carlo/metrics", (req, res) => {
    const { taskType } = req.query;
    if (taskType) {
      res.json({ ok: true, ...planScheduler.getMetrics(taskType) });
    } else {
      res.json({ ok: true, ...planScheduler.getAllMetrics() });
    }
  });

  // Get plan history
  app.get("/api/monte-carlo/history", (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 50;
    res.json({ ok: true, history: planScheduler.getHistory(limit) });
  });

  // Get drift alerts
  app.get("/api/monte-carlo/drift", (req, res) => {
    res.json({ ok: true, alerts: planScheduler.driftAlerts.slice(-50), ts: new Date().toISOString() });
  });

  // Get/set speed mode
  app.get("/api/monte-carlo/speed-mode", (_req, res) => {
    res.json({ ok: true, speedMode: planScheduler.getSpeedMode(), ts: new Date().toISOString() });
  });

  app.post("/api/monte-carlo/speed-mode", (req, res) => {
    const { mode } = req.body; // "off", "on", "max"
    if (!mode) return res.status(400).json({ error: "mode required (off, on, max)" });
    const result = planScheduler.setSpeedMode(mode);
    res.json({ ok: true, speedMode: result, ts: new Date().toISOString() });
  });

  // Global MC status
  app.get("/api/monte-carlo/status", (_req, res) => {
    res.json({
      ok: true,
      planScheduler: {
        totalExecutions: planScheduler._executionCounter,
        taskTypes: Object.keys(planScheduler.samples).length,
        driftAlerts: planScheduler.driftAlerts.length,
        strategies: planScheduler.strategies.map(s => s.id),
        speedMode: planScheduler.getSpeedMode(),
      },
      global: globalMC.getStatus(),
      ts: new Date().toISOString(),
    });
  });

  // Trigger a full MC simulation cycle
  app.post("/api/monte-carlo/simulate", (_req, res) => {
    try {
      const cycle = globalMC.runFullCycle("api_trigger");
      res.json({ ok: true, ...cycle });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Global MC history
  app.get("/api/monte-carlo/simulation-history", (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 20;
    res.json({ ok: true, history: globalMC.getHistory(limit) });
  });
}

// ─── Exports ────────────────────────────────────────────────────────
module.exports = {
  Distributions,
  computeStats,
  confidenceInterval,
  simulatePipelineReliability,
  simulateDeploymentRisk,
  simulateReadinessConfidence,
  simulateNodePerformance,
  simulateFullSystem,
  fastPipelineSim,
  fastDeploymentSim,
  fastReadinessSim,
  fastNodeSim,
  MonteCarloGlobal,
  mcGlobal,
  MCTaskPlanScheduler,
  mcPlanScheduler,
  registerMonteCarloRoutes,
  ucb1Score,
  SPEED_PRIORITY,
};
