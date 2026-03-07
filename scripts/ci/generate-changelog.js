#!/usr/bin/env node
/**
 * scripts/ci/generate-changelog.js
 *
 * Generates a structured Markdown changelog from conventional commits
 * between two git refs. Groups changes by type (feat, fix, perf,
 * refactor, docs, chore, build, ci, test, style, revert).
 * Includes PR links and author attributions.
 *
 * Usage:
 *   node scripts/ci/generate-changelog.js \
 *     --from <ref>        Git ref for start (tag, SHA, branch)
 *     --to   <ref>        Git ref for end (default: HEAD)
 *     --output <path>     Output file path (default: CHANGELOG.md)
 *     --format <fmt>      Output format: markdown | json (default: markdown)
 *     --repo <slug>       GitHub repo slug (owner/repo) for PR links
 *
 * Conventional commits spec: https://www.conventionalcommits.org/
 *
 * φ design: Fibonacci grouping — up to fib(12)=144 commits per type
 *           before truncation with "... and N more"
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ─── φ Constants ─────────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
// fib(12)=144 — max commits shown per section before truncation
const MAX_COMMITS_PER_SECTION = 144;
// fib(8)=21 — max characters for commit subject before truncation
const MAX_SUBJECT_LENGTH = 144;

// ─── Conventional commit type definitions ────────────────────────────────────
const COMMIT_TYPES = {
  feat:     { label: '✨ Features',          order: 1, breaking: false },
  fix:      { label: '🐛 Bug Fixes',         order: 2, breaking: false },
  perf:     { label: '⚡ Performance',        order: 3, breaking: false },
  refactor: { label: '♻️ Refactoring',        order: 4, breaking: false },
  docs:     { label: '📚 Documentation',      order: 5, breaking: false },
  test:     { label: '✅ Tests',              order: 6, breaking: false },
  build:    { label: '🏗️ Build System',       order: 7, breaking: false },
  ci:       { label: '🔧 CI/CD',             order: 8, breaking: false },
  chore:    { label: '🔨 Chores',            order: 9, breaking: false },
  style:    { label: '💄 Style',             order: 10, breaking: false },
  revert:   { label: '⏪ Reverts',           order: 11, breaking: false },
  BREAKING: { label: '💥 Breaking Changes',  order: 0, breaking: true  },
};

// ─── CLI argument parsing ────────────────────────────────────────────────────
/**
 * @param {string[]} argv
 * @returns {{ from: string, to: string, output: string, format: string, repo: string }}
 */
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    args[key] = argv[i + 1];
  }
  return {
    from:   args.from   || '',
    to:     args.to     || 'HEAD',
    output: args.output || 'CHANGELOG.md',
    format: args.format || 'markdown',
    repo:   args.repo   || process.env.GITHUB_REPOSITORY || '',
  };
}

// ─── Git log parsing ──────────────────────────────────────────────────────────
/**
 * Fetch raw commit log between two refs.
 * @param {string} from - start ref (exclusive)
 * @param {string} to   - end ref (inclusive)
 * @returns {string[]} Array of raw commit lines
 */
function getCommitLog(from, to) {
  try {
    const range = from ? `${from}..${to}` : to;
    // Format: SHA|author|email|date|subject|body
    const log = execSync(
      `git log ${range} --pretty=format:"%H|%an|%ae|%aI|%s|%b" --no-merges`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return log.trim().split('\n').filter(Boolean);
  } catch (err) {
    console.error('Error fetching git log:', err.message);
    return [];
  }
}

/**
 * Parse a single commit line into a structured object.
 * @param {string} line
 * @returns {object|null}
 */
function parseCommit(line) {
  const parts = line.split('|');
  if (parts.length < 5) return null;

  const [sha, author, email, date, subject, ...bodyParts] = parts;
  const body = bodyParts.join('|').trim();

  // Parse conventional commit subject: type(scope)!: description
  const conventionalRe = /^(\w+)(\(([^)]+)\))?(!)?: (.+)$/;
  const match = subject.match(conventionalRe);

  if (!match) {
    // Non-conventional commit — classify as 'chore'
    return {
      sha: sha.trim(),
      shortSha: sha.trim().substring(0, 8),
      author: author.trim(),
      email: email.trim(),
      date: date.trim(),
      type: 'chore',
      scope: null,
      breaking: false,
      description: subject.trim().substring(0, MAX_SUBJECT_LENGTH),
      body: body,
      prNumber: extractPRNumber(subject + body),
      isConventional: false,
    };
  }

  const [, type, , scope, breaking, description] = match;
  const isBreaking = breaking === '!' ||
    body.includes('BREAKING CHANGE:') ||
    body.includes('BREAKING-CHANGE:');

  // Extract PR number from body or subject (#123 pattern)
  const prNumber = extractPRNumber(subject + '|' + body);

  return {
    sha: sha.trim(),
    shortSha: sha.trim().substring(0, 8),
    author: author.trim(),
    email: email.trim(),
    date: date.trim(),
    type: type.toLowerCase(),
    scope: scope || null,
    breaking: isBreaking,
    description: description.trim().substring(0, MAX_SUBJECT_LENGTH),
    body: body,
    prNumber,
    isConventional: true,
  };
}

/**
 * Extract PR number from commit message text.
 * @param {string} text
 * @returns {number|null}
 */
function extractPRNumber(text) {
  // Match (#123) or (closes #123) or "Merge PR #123"
  const match = text.match(/#(\d+)/);
  return match ? parseInt(match[1]) : null;
}

// ─── Changelog generation ─────────────────────────────────────────────────────
/**
 * Group commits by type.
 * @param {object[]} commits
 * @returns {Map<string, object[]>}
 */
function groupByType(commits) {
  const groups = new Map();

  for (const commit of commits) {
    const key = commit.breaking ? 'BREAKING' : (commit.type || 'chore');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(commit);
  }

  // Sort groups by defined order
  const sortedMap = new Map(
    [...groups.entries()].sort((a, b) => {
      const orderA = (COMMIT_TYPES[a[0]] || { order: 99 }).order;
      const orderB = (COMMIT_TYPES[b[0]] || { order: 99 }).order;
      return orderA - orderB;
    })
  );

  return sortedMap;
}

/**
 * Format a single commit entry as a markdown list item.
 * @param {object} commit
 * @param {string} repo - GitHub repo slug (owner/repo)
 * @returns {string}
 */
function formatCommitEntry(commit, repo) {
  const scopePrefix = commit.scope ? `**${commit.scope}**: ` : '';
  const desc = commit.description;

  // Link SHA to GitHub commit
  const shaLink = repo
    ? `[\`${commit.shortSha}\`](https://github.com/${repo}/commit/${commit.sha})`
    : `\`${commit.shortSha}\``;

  // Link PR number if present
  let prLink = '';
  if (commit.prNumber && repo) {
    prLink = ` ([#${commit.prNumber}](https://github.com/${repo}/pull/${commit.prNumber}))`;
  }

  // Author attribution
  const authorAttr = ` — @${commit.author.replace(/\s+/g, '')}`;

  return `- ${scopePrefix}${desc} (${shaLink}${prLink}${authorAttr})`;
}

/**
 * Generate markdown changelog string.
 * @param {Map<string, object[]>} groups
 * @param {object} opts
 * @returns {string}
 */
function generateMarkdown(groups, opts) {
  const { from, to, repo } = opts;
  const now = new Date().toISOString().split('T')[0];
  const lines = [];

  // Header
  lines.push(`## Changelog — ${now}`);
  if (from) {
    const fromLink = repo
      ? `[\`${from.substring(0, 8)}\`](https://github.com/${repo}/compare/${from}...${to})`
      : `\`${from.substring(0, 8)}\``;
    lines.push(`> Changes from ${fromLink} to \`${to.substring(0, 8)}\``);
  }
  lines.push('');

  if (groups.size === 0) {
    lines.push('_No changes found in this range._');
    return lines.join('\n');
  }

  // Statistics line
  let totalCommits = 0;
  for (const commits of groups.values()) totalCommits += commits.length;
  lines.push(`**${totalCommits} commits** across ${groups.size} categories`);
  lines.push('');

  // Per-type sections
  for (const [type, commits] of groups) {
    const typeDef = COMMIT_TYPES[type] || { label: `${type}`, order: 99 };
    lines.push(`### ${typeDef.label}`);
    lines.push('');

    // Show up to MAX_COMMITS_PER_SECTION, then summarize remainder
    const visible = commits.slice(0, MAX_COMMITS_PER_SECTION);
    const hidden = commits.length - visible.length;

    for (const commit of visible) {
      lines.push(formatCommitEntry(commit, repo));
    }

    if (hidden > 0) {
      lines.push(`- _...and ${hidden} more ${type} commit(s)_`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate JSON changelog object.
 * @param {Map<string, object[]>} groups
 * @param {object} opts
 * @returns {string} JSON string
 */
function generateJSON(groups, opts) {
  const result = {
    generatedAt: new Date().toISOString(),
    from: opts.from,
    to: opts.to,
    phi: PHI,
    sections: {},
    stats: { total: 0, byType: {} },
  };

  for (const [type, commits] of groups) {
    const typeDef = COMMIT_TYPES[type] || { label: type, order: 99 };
    result.sections[type] = {
      label: typeDef.label,
      order: typeDef.order,
      commits: commits.map(c => ({
        sha: c.shortSha,
        fullSha: c.sha,
        author: c.author,
        date: c.date,
        scope: c.scope,
        description: c.description,
        breaking: c.breaking,
        prNumber: c.prNumber,
      })),
    };
    result.stats.byType[type] = commits.length;
    result.stats.total += commits.length;
  }

  return JSON.stringify(result, null, 2);
}

// ─── Main ────────────────────────────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv);

  if (!args.from) {
    console.error('Error: --from <ref> is required');
    process.exit(1);
  }

  console.log(`Generating changelog: ${args.from} → ${args.to}`);

  // Fetch commits
  const rawLines = getCommitLog(args.from, args.to);
  console.log(`Found ${rawLines.length} commits`);

  // Parse commits
  const commits = rawLines
    .map(parseCommit)
    .filter(Boolean);

  // Group by type
  const groups = groupByType(commits);

  // Summarize groups
  for (const [type, list] of groups) {
    const typeDef = COMMIT_TYPES[type] || { label: type };
    console.log(`  ${typeDef.label}: ${list.length} commits`);
  }

  // Generate output
  let output;
  if (args.format === 'json') {
    output = generateJSON(groups, args);
  } else {
    output = generateMarkdown(groups, args);
  }

  // Write output
  const outputDir = path.dirname(args.output);
  if (outputDir && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(args.output, output, 'utf8');
  console.log(`Changelog written to: ${args.output}`);

  // Also print to stdout for CI capture
  console.log('\n--- CHANGELOG ---');
  console.log(output.substring(0, 2000));
  if (output.length > 2000) {
    console.log(`... (${output.length - 2000} more chars)`);
  }
}

main();
