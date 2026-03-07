#!/usr/bin/env node
/**
 * scripts/ci/deployment-audit.js
 *
 * Log deployment details to the existing Heady SHA-256 audit chain.
 * Each deployment creates a new audit entry that is cryptographically
 * linked to the previous entry via SHA-256 hash chaining.
 *
 * Audit chain format (matches Heady's existing security/audit architecture):
 * {
 *   "id": "<SHA-256 of entry>",
 *   "previous": "<SHA-256 of previous entry>",
 *   "timestamp": "<ISO 8601>",
 *   "type": "deployment" | "rollback" | "canary",
 *   "payload": {
 *     "version":     "<semver>",
 *     "commit":      "<full SHA>",
 *     "environment": "production" | "staging" | "pre-production",
 *     "deployer":    "<github actor>",
 *     "revision":    "<Cloud Run revision name>",
 *     "duration":    <seconds>,
 *     "imageUri":    "<GAR image URI>",
 *     "note":        "<optional note>"
 *   }
 * }
 *
 * Usage:
 *   node scripts/ci/deployment-audit.js \
 *     --version    <semver>    Version deployed
 *     --commit     <sha>       Git commit SHA
 *     --environment <env>      production | staging | pre-production
 *     --deployer   <actor>     GitHub actor
 *     --revision   <name>      Cloud Run revision name
 *     [--duration  <secs>]     Deployment duration in seconds
 *     [--image-uri <uri>]      Docker image URI
 *     [--note      <text>]     Optional note
 *     [--type      <type>]     deployment | rollback | canary (default: deployment)
 *     [--audit-file <path>]    Path to audit log file (default: .audit/deployments.jsonl)
 *
 * φ design:
 *   File: JSONL (one JSON per line) for streaming reads
 *   Chain: SHA-256 per entry using content + previous hash
 *   Retention: fib(12)=144 entries max before rotation
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const os     = require('os');

// ─── φ Constants ─────────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];
// fib(12)=144 entries before log rotation
const MAX_ENTRIES = FIB[12]; // 144
// Genesis hash (first entry has no previous)
const GENESIS_HASH = '0'.repeat(64);

// ─── CLI args ─────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    args[key] = argv[i + 1];
  }
  return {
    version:     args.version     || process.env.HEADY_VERSION     || 'unknown',
    commit:      args.commit      || process.env.GITHUB_SHA         || 'unknown',
    environment: args.environment || process.env.DEPLOY_ENV         || 'production',
    deployer:    args.deployer    || process.env.GITHUB_ACTOR        || 'ci',
    revision:    args.revision    || '',
    duration:    parseInt(args.duration || '0'),
    imageUri:    args.imageUri    || process.env.IMAGE_URI           || '',
    note:        args.note        || '',
    type:        args.type        || 'deployment',
    auditFile:   args.auditFile   || '.audit/deployments.jsonl',
  };
}

// ─── SHA-256 helpers ──────────────────────────────────────────────────────────
/**
 * Compute SHA-256 hash of a string or object.
 * @param {string|object} data
 * @returns {string} hex digest
 */
function sha256(data) {
  const str = typeof data === 'object' ? JSON.stringify(data) : String(data);
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

/**
 * Compute the entry hash: SHA-256 of (previous_hash + canonical_payload).
 * This creates the chain: each entry's ID depends on all prior entries.
 * @param {string} previousHash
 * @param {object} payload
 * @returns {string}
 */
function computeEntryHash(previousHash, payload) {
  const canonical = JSON.stringify({
    previous: previousHash,
    ...payload,
  }, Object.keys({ previous: null, ...payload }).sort());
  return sha256(canonical);
}

// ─── Audit log management ─────────────────────────────────────────────────────
/**
 * Read all existing audit entries from JSONL file.
 * @param {string} filePath
 * @returns {object[]}
 */
function readAuditLog(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf8').trim();
  if (!content) return [];

  return content.split('\n')
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line); }
      catch { return null; }
    })
    .filter(Boolean);
}

/**
 * Get the hash of the most recent entry (for chain continuation).
 * @param {object[]} entries
 * @returns {string}
 */
function getLastHash(entries) {
  if (entries.length === 0) return GENESIS_HASH;
  return entries[entries.length - 1].id || GENESIS_HASH;
}

/**
 * Rotate audit log if it exceeds MAX_ENTRIES.
 * Archives current log to .audit/deployments-TIMESTAMP.jsonl
 * @param {string} filePath
 * @param {object[]} entries
 */
function rotateIfNeeded(filePath, entries) {
  if (entries.length < MAX_ENTRIES) return entries;

  // Archive current log
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const archivePath = filePath.replace('.jsonl', `-archive-${ts}.jsonl`);
  fs.copyFileSync(filePath, archivePath);
  console.log(`Audit log rotated: ${archivePath} (${entries.length} entries archived)`);

  // Keep last fib(8)=21 entries in active log for chain continuity
  return entries.slice(-FIB[8]); // 21
}

/**
 * Verify the integrity of the audit chain.
 * @param {object[]} entries
 * @returns {{ valid: boolean, firstInvalidIndex: number|null }}
 */
function verifyChain(entries) {
  if (entries.length === 0) return { valid: true, firstInvalidIndex: null };

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const expectedPrevious = i === 0 ? GENESIS_HASH : entries[i - 1].id;

    // Recompute entry hash
    const recomputed = computeEntryHash(expectedPrevious, entry.payload);

    if (entry.id !== recomputed) {
      return { valid: false, firstInvalidIndex: i };
    }
    if (entry.previous !== expectedPrevious) {
      return { valid: false, firstInvalidIndex: i };
    }
  }

  return { valid: true, firstInvalidIndex: null };
}

// ─── System info ──────────────────────────────────────────────────────────────
/**
 * Gather runner/environment metadata.
 * @returns {object}
 */
function getSystemInfo() {
  return {
    runner:   process.env.RUNNER_NAME   || os.hostname(),
    os:       process.env.RUNNER_OS     || os.platform(),
    arch:     process.env.RUNNER_ARCH   || os.arch(),
    workflow: process.env.GITHUB_WORKFLOW || 'unknown',
    runId:    process.env.GITHUB_RUN_ID  || 'unknown',
    runNumber: parseInt(process.env.GITHUB_RUN_NUMBER || '0'),
    repo:     process.env.GITHUB_REPOSITORY || 'HeadyMe/Heady-pre-production-9f2f0642',
    ref:      process.env.GITHUB_REF    || 'refs/heads/main',
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv);

  console.log('=== Heady Deployment Audit ===');
  console.log(`φ = ${PHI}`);
  console.log(`Type:        ${args.type}`);
  console.log(`Version:     ${args.version}`);
  console.log(`Environment: ${args.environment}`);
  console.log(`Deployer:    ${args.deployer}`);
  console.log(`Revision:    ${args.revision}`);
  console.log('');

  // ── Ensure audit directory exists ─────────────────────────
  const auditDir = path.dirname(args.auditFile);
  if (auditDir && !fs.existsSync(auditDir)) {
    fs.mkdirSync(auditDir, { recursive: true });
  }

  // ── Read existing log ──────────────────────────────────────
  let entries = readAuditLog(args.auditFile);
  console.log(`Existing entries: ${entries.length}`);

  // ── Verify chain integrity ─────────────────────────────────
  const { valid, firstInvalidIndex } = verifyChain(entries);
  if (!valid) {
    console.error(`::error::Audit chain integrity violation at index ${firstInvalidIndex}!`);
    console.error('Audit chain may have been tampered with.');
    // Continue but log the warning
  } else {
    console.log('Audit chain integrity: ✅ verified');
  }

  // ── Rotate if needed ───────────────────────────────────────
  entries = rotateIfNeeded(args.auditFile, entries);

  // ── Build new entry ────────────────────────────────────────
  const previousHash = getLastHash(entries);
  const sysInfo = getSystemInfo();

  const payload = {
    version:     args.version,
    commit:      args.commit,
    commitShort: args.commit.substring(0, 8),
    environment: args.environment,
    deployer:    args.deployer,
    revision:    args.revision,
    durationSec: args.duration,
    imageUri:    args.imageUri,
    note:        args.note || null,
    type:        args.type,
    // System metadata
    system:      sysInfo,
    // φ-aligned timestamp precision
    timestamp:   new Date().toISOString(),
    // Content hash of payload for quick integrity check
    payloadHash: sha256({
      version: args.version,
      commit:  args.commit,
      environment: args.environment,
      timestamp: new Date().toISOString().substring(0, 19), // minute precision
    }),
  };

  const entryId = computeEntryHash(previousHash, payload);

  const entry = {
    id:        entryId,
    previous:  previousHash,
    sequence:  entries.length + 1,
    timestamp: payload.timestamp,
    type:      args.type,
    payload,
    // Chain verification convenience fields
    chainDepth: entries.length,
    genesisDistance: entries.length,
  };

  // ── Verify new entry before writing ───────────────────────
  const recheck = computeEntryHash(previousHash, payload);
  if (recheck !== entryId) {
    console.error('::error::Entry hash computation error! Entry not written.');
    process.exit(1);
  }

  // ── Append to log ──────────────────────────────────────────
  const jsonLine = JSON.stringify(entry);

  if (entries.length === 0) {
    // Fresh log
    fs.writeFileSync(args.auditFile, jsonLine + '\n', 'utf8');
  } else {
    // Append
    fs.appendFileSync(args.auditFile, jsonLine + '\n', 'utf8');
  }

  console.log(`✅ Audit entry written`);
  console.log(`   ID:       ${entryId}`);
  console.log(`   Previous: ${previousHash.substring(0, 16)}...`);
  console.log(`   Sequence: #${entry.sequence}`);
  console.log(`   File:     ${args.auditFile}`);

  // ── Emit GitHub step summary ───────────────────────────────
  if (process.env.GITHUB_STEP_SUMMARY) {
    const summary = [
      '## Deployment Audit Entry',
      '',
      `| Field | Value |`,
      `|-------|-------|`,
      `| **Type** | \`${args.type}\` |`,
      `| **Version** | \`${args.version}\` |`,
      `| **Commit** | \`${args.commit.substring(0, 8)}\` |`,
      `| **Environment** | \`${args.environment}\` |`,
      `| **Deployer** | ${args.deployer} |`,
      `| **Revision** | \`${args.revision}\` |`,
      `| **Duration** | ${args.duration}s |`,
      `| **Entry ID** | \`${entryId.substring(0, 16)}...\` |`,
      `| **Chain Depth** | ${entry.sequence} |`,
      `| **Timestamp** | \`${payload.timestamp}\` |`,
    ].join('\n');

    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
  }
}

main();
