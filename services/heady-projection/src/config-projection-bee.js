/* © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL. */
'use strict';

const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');
const logger  = require('../utils/logger').child('config-projection-bee');
const CSL     = require('../core/semantic-logic');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PHI = 1.6180339887;

/** Default location for YAML configuration files. */
const CONFIGS_DIR = path.resolve(__dirname, '../../../configs');

/** In-process snapshot of the last-known config hashes (keyed by file path). */
const _lastKnownHashes = new Map();
const _lastKnownContents = new Map();

// ---------------------------------------------------------------------------
// Schema validation helpers
// ---------------------------------------------------------------------------

/**
 * Minimal structural schema check for a parsed config object.
 * Uses CSL ternary_gate to produce a tri-valued (true/null/false) verdict.
 */
function validateConfigSchema(configObj, filePath) {
  if (!configObj || typeof configObj !== 'object') {
    return CSL.ternary_gate(false, 'not-an-object');
  }

  // Each config must have at minimum a `version` field
  const hasVersion = ('version' in configObj);
  const score = CSL.weighted_superposition([
    { value: hasVersion ? 1 : 0, weight: 0.6 },
    { value: Object.keys(configObj).length > 0 ? 1 : 0, weight: 0.4 },
  ]);

  return {
    file:     filePath,
    score,
    valid:    score > 0.5,
    hasVersion,
    keyCount: Object.keys(configObj).length,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively enumerate all YAML/JSON files under a directory.
 */
function enumerateConfigFiles(dir) {
  const files = [];
  try {
    if (!fs.existsSync(dir)) return files;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...enumerateConfigFiles(full));
      } else if (/\.(ya?ml|json)$/i.test(entry.name)) {
        files.push(full);
      }
    }
  } catch (err) {
    logger.warn('enumerateConfigFiles error', { dir, err: err.message });
  }
  return files;
}

/**
 * Read a file and return its SHA-256 hash (hex).
 */
function hashFile(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch (err) {
    logger.warn('hashFile error', { filePath, err: err.message });
    return null;
  }
}

/**
 * Attempt to parse a YAML or JSON file.
 * Returns parsed object or null on failure.
 */
function parseConfigFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (/\.json$/i.test(filePath)) {
      return JSON.parse(content);
    }
    // Try to use js-yaml if available; fall back to JSON.parse as a safety net
    try {
      const yaml = require('js-yaml');
      return yaml.load(content);
    } catch {
      // js-yaml not installed — parse as JSON as last resort
      return JSON.parse(content);
    }
  } catch (err) {
    logger.warn('parseConfigFile error', { filePath, err: err.message });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Worker factories
// ---------------------------------------------------------------------------

/**
 * Worker: hash-configs
 * SHA-256 hashes all YAML/JSON configs in the configs/ directory.
 * Detects additions, removals, and content changes.
 */
function makeHashConfigsWorker() {
  return async function hashConfigs() {
    const tag = 'hash-configs';
    logger.debug(`[${tag}] starting`);

    const files   = enumerateConfigFiles(CONFIGS_DIR);
    const hashes  = {};
    const changes = [];

    for (const filePath of files) {
      const hash    = hashFile(filePath);
      const relPath = path.relative(CONFIGS_DIR, filePath);
      hashes[relPath] = hash;

      const previous = _lastKnownHashes.get(relPath);
      if (previous === undefined) {
        changes.push({ file: relPath, op: 'added', hash });
      } else if (previous !== hash) {
        changes.push({ file: relPath, op: 'modified', prevHash: previous, hash });
      }

      _lastKnownHashes.set(relPath, hash);
    }

    // Detect removed files
    for (const [relPath] of _lastKnownHashes) {
      const full = path.join(CONFIGS_DIR, relPath);
      if (!fs.existsSync(full)) {
        changes.push({ file: relPath, op: 'removed' });
        _lastKnownHashes.delete(relPath);
        _lastKnownContents.delete(relPath);
      }
    }

    const result = {
      worker:     tag,
      capturedAt: Date.now(),
      fileCount:  files.length,
      hashes,
      changes,
      hasChanges: changes.length > 0,
    };

    logger.info(`[${tag}] completed`, {
      fileCount:  result.fileCount,
      changeCount: changes.length,
    });

    if (changes.length > 0 && global.eventBus) {
      global.eventBus.emit('config:changed', { source: tag, changes });
    }

    if (global.eventBus) {
      global.eventBus.emit('projection:config', { worker: tag, data: result });
    }

    return result;
  };
}

/**
 * Worker: diff-configs
 * Deep-compares current parsed config contents vs the last-known snapshot.
 * Emits granular diffs at the key level.
 */
function makeDiffConfigsWorker() {
  return async function diffConfigs() {
    const tag = 'diff-configs';
    logger.debug(`[${tag}] starting`);

    const files = enumerateConfigFiles(CONFIGS_DIR);
    const diffs = {};

    for (const filePath of files) {
      const relPath = path.relative(CONFIGS_DIR, filePath);
      const current = parseConfigFile(filePath);
      const previous = _lastKnownContents.get(relPath);

      if (!previous) {
        _lastKnownContents.set(relPath, current);
        diffs[relPath] = { op: 'baseline-set', keyCount: current ? Object.keys(current).length : 0 };
        continue;
      }

      // Compute key-level diff
      const currentKeys  = new Set(Object.keys(current  || {}));
      const previousKeys = new Set(Object.keys(previous || {}));
      const added        = [...currentKeys].filter(k => !previousKeys.has(k));
      const removed      = [...previousKeys].filter(k => !currentKeys.has(k));
      const modified     = [...currentKeys].filter(k => {
        if (!previousKeys.has(k)) return false;
        return JSON.stringify(current[k]) !== JSON.stringify(previous[k]);
      });

      if (added.length || removed.length || modified.length) {
        diffs[relPath] = { op: 'diff', added, removed, modified };
        _lastKnownContents.set(relPath, current);
      } else {
        diffs[relPath] = { op: 'unchanged' };
      }
    }

    const changedFiles = Object.entries(diffs).filter(([, d]) => d.op === 'diff').map(([f]) => f);

    const result = {
      worker:      tag,
      capturedAt:  Date.now(),
      fileCount:   files.length,
      diffs,
      changedFiles,
      hasChanges:  changedFiles.length > 0,
    };

    logger.info(`[${tag}] completed`, { changedFiles: changedFiles.length });

    if (global.eventBus) {
      global.eventBus.emit('projection:config', { worker: tag, data: result });
    }

    return result;
  };
}

/**
 * Worker: validate-configs
 * Parses every config file and validates structural schema integrity.
 * Uses CSL soft_gate scoring to produce a per-file validity score.
 */
function makeValidateConfigsWorker() {
  return async function validateConfigs() {
    const tag = 'validate-configs';
    logger.debug(`[${tag}] starting`);

    const files       = enumerateConfigFiles(CONFIGS_DIR);
    const validations = {};
    let   invalidCount = 0;

    for (const filePath of files) {
      const relPath   = path.relative(CONFIGS_DIR, filePath);
      const parsed    = parseConfigFile(filePath);
      const verdict   = validateConfigSchema(parsed, relPath);

      validations[relPath] = verdict;

      if (!verdict.valid) {
        invalidCount++;
        logger.warn(`[${tag}] invalid config`, { file: relPath, score: verdict.score });
      }
    }

    // Compute an overall system config health score
    const scores = Object.values(validations).map(v => v.score ?? (v.valid ? 1 : 0));
    const overallScore = scores.length
      ? CSL.weighted_superposition(scores.map(s => ({ value: s, weight: 1 / scores.length })))
      : 1;

    const result = {
      worker:       tag,
      capturedAt:   Date.now(),
      fileCount:    files.length,
      invalidCount,
      overallScore,
      validations,
    };

    logger.info(`[${tag}] completed`, {
      fileCount:    result.fileCount,
      invalidCount,
      overallScore: overallScore.toFixed(4),
    });

    if (global.eventBus) {
      global.eventBus.emit('projection:config', { worker: tag, data: result });
    }

    return result;
  };
}

// ---------------------------------------------------------------------------
// Bee export
// ---------------------------------------------------------------------------
const domain      = 'config-projection';
const description = 'Projects all configuration state: SHA-256 drift detection, key-level diffs, and schema validation.';
const priority    = 0.9;

function getWork() {
  return [
    makeHashConfigsWorker(),
    makeDiffConfigsWorker(),
    makeValidateConfigsWorker(),
  ];
}

module.exports = { domain, description, priority, getWork };
