#!/usr/bin/env node
/**
 * scripts/ci/semantic-version.js
 *
 * Calculate the next semantic version (semver) based on conventional commits
 * between two git refs. Handles major/minor/patch/prerelease bumps.
 *
 * Bump rules (conventional commits):
 *   BREAKING CHANGE or type!:    → major
 *   feat:                        → minor
 *   fix: / perf: / refactor:     → patch
 *   docs: / chore: / ci: / build:→ no version bump (returns current)
 *   No conventional commits       → patch
 *
 * Usage:
 *   node scripts/ci/semantic-version.js \
 *     --from <ref>       Git ref or tag for base version (e.g. v1.2.3)
 *     --to   <ref>       Git ref for HEAD (default: HEAD)
 *     [--pre <id>]       Pre-release identifier (e.g. "rc", "alpha")
 *     [--dry-run]        Print version without writing
 *
 * Outputs: The next version string (e.g. v1.3.0) to stdout
 *
 * φ design: version numbers are never derived from φ —
 *           semantic versioning is specification-driven.
 *           φ is used for retry/timeout elsewhere in this pipeline.
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ─── Semver parsing ───────────────────────────────────────────────────────────
/**
 * Parse a semver string into components.
 * Accepts: v1.2.3, 1.2.3, v1.2.3-rc.1, etc.
 * @param {string} tag
 * @returns {{ major: number, minor: number, patch: number, pre: string|null }}
 */
function parseSemver(tag) {
  // Strip leading 'v'
  const clean = tag.replace(/^v/, '');
  const match = clean.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);

  if (!match) {
    // Can't parse — return 0.0.0
    console.error(`Warning: Could not parse semver from "${tag}", using 0.0.0`);
    return { major: 0, minor: 0, patch: 0, pre: null };
  }

  return {
    major: parseInt(match[1]),
    minor: parseInt(match[2]),
    patch: parseInt(match[3]),
    pre:   match[4] || null,
  };
}

/**
 * Format semver object back to string.
 * @param {{ major, minor, patch, pre }} v
 * @returns {string}
 */
function formatSemver(v) {
  const base = `v${v.major}.${v.minor}.${v.patch}`;
  return v.pre ? `${base}-${v.pre}` : base;
}

// ─── Bump type determination ──────────────────────────────────────────────────
/**
 * Determine the version bump type from a list of conventional commits.
 * @param {string[]} commitMessages
 * @returns {'major'|'minor'|'patch'|'none'}
 */
function determineBump(commitMessages) {
  let bump = 'none';

  for (const msg of commitMessages) {
    // Breaking change: explicit BREAKING CHANGE in body, or ! after type
    if (
      msg.includes('BREAKING CHANGE') ||
      msg.includes('BREAKING-CHANGE') ||
      /^\w+(\([^)]+\))?!:/.test(msg)
    ) {
      return 'major';  // Immediately return — can't get higher than major
    }

    // Feature: minor bump
    if (/^feat(\([^)]+\))?:/.test(msg)) {
      bump = 'minor';
    }

    // Bug fix / perf / refactor: patch (unless already minor)
    if (
      /^(fix|perf|refactor)(\([^)]+\))?:/.test(msg) &&
      bump === 'none'
    ) {
      bump = 'patch';
    }

    // docs/chore/ci/build/test/style — no version bump
    // (already handled by 'none' default)
  }

  // If no recognized conventional commits, default to patch
  if (bump === 'none' && commitMessages.length > 0) {
    // Check if there are ANY non-conventional commits
    const hasNonConventional = commitMessages.some(
      m => !/^\w+(\([^)]+\))?[!:]/.test(m)
    );
    if (hasNonConventional) bump = 'patch';
  }

  return bump;
}

/**
 * Apply a bump to a semver object.
 * @param {{ major, minor, patch, pre }} current
 * @param {'major'|'minor'|'patch'|'none'} bumpType
 * @param {string|null} preId - pre-release identifier
 * @returns {{ major, minor, patch, pre }}
 */
function applyBump(current, bumpType, preId) {
  const next = { ...current, pre: null };

  switch (bumpType) {
    case 'major':
      next.major++;
      next.minor = 0;
      next.patch = 0;
      break;
    case 'minor':
      next.minor++;
      next.patch = 0;
      break;
    case 'patch':
      next.patch++;
      break;
    case 'none':
      // No bump — might still add pre-release
      break;
  }

  if (preId) {
    // Add pre-release identifier with build number
    // Format: v1.2.3-rc.1
    const buildNum = Date.now().toString().slice(-6);  // last 6 digits of timestamp
    next.pre = `${preId}.${buildNum}`;
  }

  return next;
}

// ─── Git log fetching ─────────────────────────────────────────────────────────
/**
 * Get commit messages between two refs.
 * @param {string} from
 * @param {string} to
 * @returns {string[]}
 */
function getCommitMessages(from, to) {
  try {
    const range = from ? `${from}..${to}` : to;
    const output = execSync(
      `git log ${range} --pretty=format:"%s" --no-merges`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return output.trim().split('\n').filter(Boolean);
  } catch (err) {
    console.error('Git log error:', err.message);
    return [];
  }
}

/**
 * Resolve the most recent semver tag on a branch.
 * @param {string} ref
 * @returns {string} tag name or 'v0.0.0'
 */
function resolveLatestTag(ref) {
  try {
    // Try describe first (most recent tag reachable from ref)
    const tag = execSync(
      `git describe --tags --abbrev=0 ${ref} 2>/dev/null`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();

    if (tag && /^v?\d+\.\d+\.\d+/.test(tag)) {
      return tag;
    }
  } catch {}

  try {
    // Fallback: list all tags sorted by version, pick latest
    const tags = execSync(
      'git tag --list "v*" --sort=-version:refname 2>/dev/null | head -1',
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    if (tags) return tags;
  } catch {}

  return 'v0.0.0';
}

// ─── package.json sync ────────────────────────────────────────────────────────
/**
 * Read current version from root package.json.
 * @returns {string}
 */
function readPackageVersion() {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  if (!fs.existsSync(pkgPath)) return 'v0.0.0';
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version ? `v${pkg.version.replace(/^v/, '')}` : 'v0.0.0';
  } catch {
    return 'v0.0.0';
  }
}

// ─── CLI args ─────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    args[key] = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')
      ? argv[i + 1]
      : true;
  }

  // Handle boolean flags
  if (argv.includes('--dry-run')) args['dry-run'] = true;

  return {
    from:    args.from || '',
    to:      args.to   || 'HEAD',
    pre:     args.pre  || null,
    dryRun:  !!args['dry-run'],
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv);

  // ── Determine base version ─────────────────────────────────
  let baseRef = args.from;
  if (!baseRef || baseRef === 'HEAD') {
    // Auto-detect from latest git tag
    baseRef = resolveLatestTag('HEAD');
    console.error(`Auto-detected base version: ${baseRef}`);
  }

  // Ensure baseRef is a valid semver
  // If it's a SHA, try to find the tag for it
  if (!/^v?\d+\.\d+\.\d+/.test(baseRef)) {
    const tagAtRef = resolveLatestTag(baseRef);
    console.error(`Resolved ${baseRef.substring(0, 8)} → ${tagAtRef}`);
    baseRef = tagAtRef;
  }

  const currentVersion = parseSemver(baseRef);
  console.error(`Current version: ${formatSemver(currentVersion)}`);

  // ── Get commits ────────────────────────────────────────────
  const commits = getCommitMessages(baseRef, args.to);
  console.error(`Commits analyzed: ${commits.length}`);

  if (commits.length === 0) {
    // No commits — return current version unchanged
    const result = formatSemver(currentVersion);
    console.error(`No commits found — returning current: ${result}`);
    process.stdout.write(result);
    return;
  }

  // ── Determine bump ─────────────────────────────────────────
  const bumpType = determineBump(commits);
  console.error(`Bump type: ${bumpType}`);

  // ── Calculate next version ─────────────────────────────────
  const nextVersion = applyBump(currentVersion, bumpType, args.pre);
  const result = formatSemver(nextVersion);

  console.error(`Next version: ${result}`);

  // Log bump reasoning
  if (bumpType === 'major') {
    const breakingCommits = commits.filter(m =>
      m.includes('BREAKING CHANGE') || /^\w+(\([^)]+\))?!:/.test(m)
    );
    console.error(`  Breaking changes (${breakingCommits.length}):`);
    breakingCommits.slice(0, 3).forEach(m => console.error(`    - ${m.substring(0, 80)}`));
  } else if (bumpType === 'minor') {
    const feats = commits.filter(m => /^feat(\([^)]+\))?:/.test(m));
    console.error(`  New features (${feats.length}):`);
    feats.slice(0, 3).forEach(m => console.error(`    - ${m.substring(0, 80)}`));
  } else if (bumpType === 'patch') {
    const fixes = commits.filter(m => /^(fix|perf|refactor)(\([^)]+\))?:/.test(m));
    console.error(`  Fixes/patches (${fixes.length})`);
  }

  // ── Output ─────────────────────────────────────────────────
  // Write ONLY the version string to stdout (for shell capture)
  process.stdout.write(result);

  if (args.dryRun) {
    console.error('\n(dry-run: no files written)');
  }
}

main();
