/* © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL. */
'use strict';

const logger = require('../utils/logger').child('vector-memory-projection-bee');
const CSL    = require('../core/semantic-logic');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PHI = 1.6180339887;

/** Cosine similarity threshold for clustering vectors (PHI-scaled). */
const CLUSTER_SIMILARITY_THRESHOLD = 1 - (1 / PHI); // ≈ 0.382

/** Drift threshold — z-score above which a namespace is considered drifted. */
const DRIFT_THRESHOLD = PHI;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve VectorMemory from global context or require it lazily so the bee
 * remains decoupled from a hard import path.
 */
function getVectorMemory() {
  if (global.vectorMemory) return global.vectorMemory;
  try {
    // Attempt project-relative resolution
    return require('../core/vector-memory');
  } catch {
    logger.warn('VectorMemory not available — returning null stub');
    return null;
  }
}

/**
 * Compute cosine similarity between two 384-D float arrays.
 * Returns value in [-1, 1].
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Compute centroid of a set of 384-D vectors.
 */
function computeCentroid(vectors) {
  if (!vectors.length) return null;
  const dim  = vectors[0].length;
  const sums = new Float64Array(dim);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) sums[i] += v[i];
  }
  return Array.from(sums).map(s => s / vectors.length);
}

// ---------------------------------------------------------------------------
// Worker factories
// ---------------------------------------------------------------------------

/**
 * Worker: snapshot-vectors
 * Snapshots overall VectorMemory stats — namespace counts, total vectors,
 * embedding dimension, memory footprint.
 */
function makeSnapshotVectorsWorker(vm) {
  return async function snapshotVectors() {
    const tag = 'snapshot-vectors';
    logger.debug(`[${tag}] starting`);

    let stats;
    try {
      stats = await vm.stats();
    } catch (err) {
      logger.error(`[${tag}] vm.stats() failed`, { err: err.message });
      stats = { error: err.message };
    }

    const result = {
      worker:      tag,
      capturedAt:  Date.now(),
      namespaceCount: stats.namespaceCount ?? 0,
      totalVectors:   stats.totalVectors   ?? 0,
      embeddingDim:   stats.embeddingDim   ?? 384,
      heapBytes:      stats.heapBytes      ?? 0,
      namespaces:     stats.namespaces     ?? {},
      raw:            stats,
    };

    // Compute health score via CSL weighted_superposition
    const healthScore = CSL.weighted_superposition([
      { value: stats.totalVectors > 0 ? 1 : 0, weight: 0.4 },
      { value: stats.error ? 0 : 1,             weight: 0.6 },
    ]);

    result.healthScore = healthScore;

    logger.info(`[${tag}] completed`, {
      namespaceCount: result.namespaceCount,
      totalVectors:   result.totalVectors,
      healthScore,
    });

    if (global.eventBus) {
      global.eventBus.emit('projection:vector-memory', { worker: tag, data: result });
    }

    return result;
  };
}

/**
 * Worker: detect-drift
 * Runs centroid drift detection across all namespaces.
 * Compares current centroid with stored baseline; flags if z-score > PHI.
 */
function makeDetectDriftWorker(vm) {
  // In-process baseline storage (keyed by namespace)
  const baselines = new Map();

  return async function detectDrift() {
    const tag = 'detect-drift';
    logger.debug(`[${tag}] starting`);

    let stats;
    try {
      stats = await vm.stats();
    } catch (err) {
      logger.error(`[${tag}] vm.stats() failed`, { err: err.message });
      return { worker: tag, error: err.message, driftReport: {} };
    }

    const namespaces = Object.keys(stats.namespaces || {});
    const driftReport = {};

    for (const ns of namespaces) {
      try {
        // Retrieve a representative sample of vectors for this namespace
        const results = await vm.search({ namespace: ns, topK: 50, includeVectors: true });
        const vectors = (results || []).map(r => r.vector).filter(Boolean);

        if (!vectors.length) {
          driftReport[ns] = { status: 'empty', drift: 0 };
          continue;
        }

        const centroid = computeCentroid(vectors);
        const baseline = baselines.get(ns);

        if (!baseline) {
          baselines.set(ns, centroid);
          driftReport[ns] = { status: 'baseline-set', drift: 0 };
          continue;
        }

        const similarity = cosineSimilarity(centroid, baseline);
        const driftScore = 1 - similarity; // 0 = identical, 1 = orthogonal

        // Use CSL soft_gate to decide whether drift is significant
        const isDrifted = CSL.soft_gate(driftScore, DRIFT_THRESHOLD / PHI) > 0.5;

        if (isDrifted) {
          logger.warn(`[${tag}] drift detected`, { namespace: ns, driftScore });
          // Update baseline to new centroid after flagging
          baselines.set(ns, centroid);
        }

        driftReport[ns] = {
          status:    isDrifted ? 'drifted' : 'stable',
          drift:     driftScore,
          similarity,
          vectorCount: vectors.length,
        };
      } catch (err) {
        logger.error(`[${tag}] namespace drift check failed`, { ns, err: err.message });
        driftReport[ns] = { status: 'error', error: err.message };
      }
    }

    const result = {
      worker:       tag,
      capturedAt:   Date.now(),
      driftReport,
      driftedCount: Object.values(driftReport).filter(r => r.status === 'drifted').length,
    };

    logger.info(`[${tag}] completed`, {
      namespacesChecked: namespaces.length,
      driftedCount:      result.driftedCount,
    });

    if (global.eventBus) {
      global.eventBus.emit('projection:vector-memory', { worker: tag, data: result });
    }

    return result;
  };
}

/**
 * Worker: cluster-analysis
 * Groups vectors by cosine similarity into semantic clusters using
 * a greedy centroid-based approach.
 */
function makeClusterAnalysisWorker(vm) {
  return async function clusterAnalysis() {
    const tag = 'cluster-analysis';
    logger.debug(`[${tag}] starting`);

    let stats;
    try {
      stats = await vm.stats();
    } catch (err) {
      logger.error(`[${tag}] vm.stats() failed`, { err: err.message });
      return { worker: tag, error: err.message, clusters: {} };
    }

    const namespaces = Object.keys(stats.namespaces || {});
    const clusterMap = {};

    for (const ns of namespaces) {
      try {
        const results = await vm.search({ namespace: ns, topK: 100, includeVectors: true });
        const items   = (results || []).filter(r => r.vector);

        if (!items.length) { clusterMap[ns] = []; continue; }

        // Greedy clustering: each item joins the first cluster whose centroid
        // is within CLUSTER_SIMILARITY_THRESHOLD, else starts a new cluster.
        const clusters = []; // [{ centroid, members: [id] }]

        for (const item of items) {
          let assigned = false;
          for (const cluster of clusters) {
            const sim = cosineSimilarity(item.vector, cluster.centroid);
            if (sim >= CLUSTER_SIMILARITY_THRESHOLD) {
              cluster.members.push(item.id);
              // Update centroid incrementally
              cluster.centroid = computeCentroid([cluster.centroid, item.vector]);
              assigned = true;
              break;
            }
          }
          if (!assigned) {
            clusters.push({ centroid: item.vector.slice(), members: [item.id] });
          }
        }

        // Strip raw centroid vectors from output to keep payload lean
        clusterMap[ns] = clusters.map((c, i) => ({
          clusterId:   `${ns}:${i}`,
          memberCount: c.members.length,
          members:     c.members,
        }));
      } catch (err) {
        logger.error(`[${tag}] cluster analysis failed`, { ns, err: err.message });
        clusterMap[ns] = [{ error: err.message }];
      }
    }

    const totalClusters = Object.values(clusterMap).reduce((s, arr) => s + arr.length, 0);

    const result = {
      worker:        tag,
      capturedAt:    Date.now(),
      clusters:      clusterMap,
      totalClusters,
      threshold:     CLUSTER_SIMILARITY_THRESHOLD,
    };

    logger.info(`[${tag}] completed`, {
      namespacesProcessed: namespaces.length,
      totalClusters,
    });

    if (global.eventBus) {
      global.eventBus.emit('projection:vector-memory', { worker: tag, data: result });
    }

    return result;
  };
}

// ---------------------------------------------------------------------------
// Bee export
// ---------------------------------------------------------------------------
const domain      = 'vector-memory-projection';
const description = 'Projects the current state of the 384D vector memory space: snapshots, drift detection, and semantic cluster analysis.';
const priority    = 0.95;

function getWork() {
  const vm = getVectorMemory();

  if (!vm) {
    logger.error('VectorMemory unavailable — returning no-op workers');
    const noop = (name) => async () => ({ worker: name, error: 'VectorMemory unavailable', capturedAt: Date.now() });
    return [noop('snapshot-vectors'), noop('detect-drift'), noop('cluster-analysis')];
  }

  return [
    makeSnapshotVectorsWorker(vm),
    makeDetectDriftWorker(vm),
    makeClusterAnalysisWorker(vm),
  ];
}

module.exports = { domain, description, priority, getWork };
