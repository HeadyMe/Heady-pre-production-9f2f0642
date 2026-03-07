#!/usr/bin/env node
// credential-audit.js — Heady Systems Credential Audit Tool
// Scans for hardcoded secrets, checks key ages, reports compliance status.
// Usage: node credential-audit.js [--output <file>] [--fix] [--verbose]
// Version: 1.0.0

'use strict';

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, relative, extname, basename } from 'node:path';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// ─── Configuration ────────────────────────────────────────────────────────────

const REPO_ROOT = resolve(process.env.REPO_ROOT || process.cwd());
const AUDIT_OUTPUT = process.argv.includes('--output')
  ? process.argv[process.argv.indexOf('--output') + 1]
  : join(REPO_ROOT, 'credential-rotation/audit/credential-audit-report.json');
const VERBOSE = process.argv.includes('--verbose');
const FIX_MODE = process.argv.includes('--fix');

// Rotation policies (days)
const ROTATION_POLICY = {
  'openai':       90,
  'anthropic':    90,
  'google':       90,
  'groq':         90,
  'huggingface':  90,
  'cloudflare':   90,
  'github_pat':   30,
  'github_app':   30,
  'database':     60,
  'redis':        60,
  'tls_cert':     365,
  'mcp_session':  1,
  'jwt_secret':   90,
  'webhook':      180,
};

// Patterns to detect hardcoded secrets
const SECRET_PATTERNS = [
  { name: 'OpenAI API Key',        pattern: /\bsk-[A-Za-z0-9]{20,60}\b/g,                       service: 'openai' },
  { name: 'OpenAI Project Key',    pattern: /\bsk-proj-[A-Za-z0-9_-]{20,100}\b/g,               service: 'openai' },
  { name: 'Anthropic API Key',     pattern: /\bsk-ant-api[0-9]{2}-[A-Za-z0-9_-]{90,110}\b/g,   service: 'anthropic' },
  { name: 'Google API Key',        pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,                       service: 'google' },
  { name: 'Groq API Key',          pattern: /\bgsk_[A-Za-z0-9]{52}\b/g,                         service: 'groq' },
  { name: 'HuggingFace Token',     pattern: /\bhf_[A-Za-z0-9]{34}\b/g,                          service: 'huggingface' },
  { name: 'GitHub PAT Classic',    pattern: /\bghp_[A-Za-z0-9]{36}\b/g,                         service: 'github_pat' },
  { name: 'GitHub PAT Fine',       pattern: /\bgithub_pat_[A-Za-z0-9_]{82}\b/g,                 service: 'github_pat' },
  { name: 'GitHub App Token',      pattern: /\bghs_[A-Za-z0-9]{36}\b/g,                         service: 'github_app' },
  { name: 'Cloudflare API Token',  pattern: /\b[A-Za-z0-9_-]{37}(?:_[A-Za-z0-9_-]{10,20})?\b/g, service: 'cloudflare', requiresContext: /cloudflare/i },
  { name: 'AWS Access Key',        pattern: /\b(AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}\b/g,           service: 'aws' },
  { name: 'Slack Webhook',         pattern: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/[A-Z0-9]+\/[A-Za-z0-9]+/g, service: 'webhook' },
  { name: 'Stripe Secret Key',     pattern: /\bsk_(live|test)_[A-Za-z0-9]{24,100}\b/g,          service: 'stripe' },
  { name: 'JWT Secret (long)',     pattern: /(?:jwt[_-]?secret|JWT_SECRET)\s*[=:]\s*["']?([A-Za-z0-9+/=]{32,})/gi, service: 'jwt_secret', groupIndex: 1 },
  { name: 'Generic High-Entropy', pattern: /(?:api[_-]?key|secret|password|token|passwd)\s*[=:]\s*["']([A-Za-z0-9+/=_-]{32,})["']/gi, service: 'generic', groupIndex: 1 },
  // Heady-specific prefixes
  { name: 'Heady Internal Key',    pattern: /\bheady_[a-z0-9_]{8,}_[A-Za-z0-9]{16,}\b/g,       service: 'heady_internal' },
];

// Files/directories to skip
const SKIP_PATHS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'coverage',
  'credential-rotation/audit', 'credential-rotation/backups',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
]);

// Extensions to scan
const SCAN_EXTENSIONS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
  '.json', '.yaml', '.yml', '.toml', '.ini', '.conf',
  '.env', '.env.example', '.env.sample', '.env.template',
  '.sh', '.bash', '.zsh', '.fish',
  '.py', '.rb', '.go', '.rs',
  '.md', '.txt', '.html',
  '.dockerfile', '',  // Dockerfile (no ext)
]);

// Allowlisted false positives (hash of matched value)
const ALLOWLISTED_HASHES = new Set(
  (process.env.AUDIT_ALLOWLIST || '').split(',').filter(Boolean)
);

// ─── Key rotation module integration ─────────────────────────────────────────

let keyRotationModule = null;
try {
  const krPath = join(REPO_ROOT, 'src/lib/key-rotation.js');
  if (existsSync(krPath)) {
    // Dynamic import for ESM compat — use readFileSync to get metadata
    keyRotationModule = { path: krPath, loaded: true };
  }
} catch {
  // key-rotation.js not available
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function maskSecret(value) {
  if (!value || value.length <= 8) return '****';
  return value.slice(0, 4) + '...' + value.slice(-4);
}

function entropy(str) {
  if (!str) return 0;
  const freq = {};
  for (const c of str) freq[c] = (freq[c] || 0) + 1;
  let h = 0;
  for (const count of Object.values(freq)) {
    const p = count / str.length;
    h -= p * Math.log2(p);
  }
  return h;
}

function log(level, ...args) {
  if (level === 'DEBUG' && !VERBOSE) return;
  const ts = new Date().toISOString();
  console.error(`[${ts}] [${level}]`, ...args);
}

// ─── File discovery ───────────────────────────────────────────────────────────

function* walkDir(dir, base = dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = relative(base, fullPath);

    // Skip based on path components
    const parts = relPath.split('/');
    if (parts.some(p => SKIP_PATHS.has(p))) continue;
    if (entry.name.startsWith('.') && entry.name !== '.env' && !entry.name.startsWith('.env.')) continue;

    if (entry.isDirectory()) {
      yield* walkDir(fullPath, base);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      const nameOnly = basename(entry.name).toLowerCase();

      if (SCAN_EXTENSIONS.has(ext) || nameOnly === 'dockerfile' || entry.name.startsWith('.env')) {
        yield fullPath;
      }
    }
  }
}

// ─── Secret scanning ──────────────────────────────────────────────────────────

function scanFile(filePath) {
  const findings = [];
  let content;

  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return findings;
  }

  // Skip files that are clearly templates/examples
  const relPath = relative(REPO_ROOT, filePath);
  const isTemplate = /example|sample|template|\.tpl|\.sample/i.test(relPath);

  const lines = content.split('\n');

  for (const secretPattern of SECRET_PATTERNS) {
    const { name, pattern, service, requiresContext, groupIndex } = secretPattern;

    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(content)) !== null) {
      const matchedValue = groupIndex ? match[groupIndex] : match[0];
      if (!matchedValue) continue;

      // Entropy check for generic patterns
      if (service === 'generic' && entropy(matchedValue) < 3.5) continue;

      // Context check (e.g., Cloudflare token must have "cloudflare" nearby)
      if (requiresContext) {
        const contextStart = Math.max(0, match.index - 200);
        const contextEnd = Math.min(content.length, match.index + 200);
        const contextWindow = content.slice(contextStart, contextEnd);
        if (!requiresContext.test(contextWindow)) continue;
      }

      // Check allowlist
      const valueHash = sha256(matchedValue);
      if (ALLOWLISTED_HASHES.has(valueHash)) continue;

      // Find line number
      const lineNum = content.slice(0, match.index).split('\n').length;
      const lineContent = lines[lineNum - 1] || '';

      // Skip if it's clearly a placeholder
      if (/YOUR_|<[A-Z_]+>|\$\{[A-Z_]+\}|example|placeholder|dummy|fake|test_key/i.test(matchedValue)) continue;

      findings.push({
        type: 'hardcoded_secret',
        severity: isTemplate ? 'LOW' : 'CRITICAL',
        name,
        service,
        file: relPath,
        line: lineNum,
        column: match.index - content.lastIndexOf('\n', match.index - 1),
        masked_value: maskSecret(matchedValue),
        entropy: entropy(matchedValue).toFixed(2),
        is_template: isTemplate,
        hash: valueHash,
      });

      log('WARN', `Found ${name} in ${relPath}:${lineNum} [${maskSecret(matchedValue)}]`);
    }

    pattern.lastIndex = 0;
  }

  return findings;
}

// ─── .env file analysis ───────────────────────────────────────────────────────

function analyzeEnvFile(filePath) {
  const results = [];
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return results;
  }

  const relPath = relative(REPO_ROOT, filePath);

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;

    const varName = trimmed.slice(0, eqIdx).trim();
    const varValue = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');

    if (!varValue || varValue.startsWith('$') || varValue.includes('{{')) continue;

    // Identify service from env var name
    const service = inferServiceFromVarName(varName);
    if (!service) continue;

    results.push({
      file: relPath,
      variable: varName,
      service,
      masked_value: maskSecret(varValue),
      is_empty: varValue.length === 0,
      entropy: entropy(varValue).toFixed(2),
    });
  }

  return results;
}

function inferServiceFromVarName(varName) {
  const name = varName.toUpperCase();
  if (name.includes('OPENAI'))      return 'openai';
  if (name.includes('ANTHROPIC'))   return 'anthropic';
  if (name.includes('GOOGLE') || name.includes('GEMINI')) return 'google';
  if (name.includes('GROQ'))        return 'groq';
  if (name.includes('HUGGING'))     return 'huggingface';
  if (name.includes('CLOUDFLARE'))  return 'cloudflare';
  if (name.includes('GITHUB'))      return 'github_pat';
  if (name.includes('DATABASE') || name.includes('POSTGRES') || name.includes('NEON') || name.includes('PG_')) return 'database';
  if (name.includes('REDIS'))       return 'redis';
  if (name.includes('JWT'))         return 'jwt_secret';
  if (name.includes('SLACK'))       return 'webhook';
  if (name.includes('MCP') && name.includes('TOKEN')) return 'mcp_session';
  if (name.includes('HEADY') && (name.includes('KEY') || name.includes('TOKEN') || name.includes('SECRET'))) return 'heady_internal';
  return null;
}

// ─── Key age analysis ─────────────────────────────────────────────────────────

function getKeyAgesFrom1Password() {
  const ages = {};
  try {
    const output = execSync('op item list --vault heady-production --format json 2>/dev/null', {
      timeout: 10000,
      encoding: 'utf8',
    });
    const items = JSON.parse(output);

    for (const item of items) {
      const updatedAt = new Date(item.updated_at || item.created_at);
      const ageMs = Date.now() - updatedAt.getTime();
      const ageDays = Math.floor(ageMs / 86400000);

      const service = inferServiceFromItemTitle(item.title);
      if (service) {
        ages[item.title] = {
          service,
          age_days: ageDays,
          last_rotated: updatedAt.toISOString(),
          policy_days: ROTATION_POLICY[service] || 90,
          compliant: ageDays <= (ROTATION_POLICY[service] || 90),
          days_overdue: Math.max(0, ageDays - (ROTATION_POLICY[service] || 90)),
        };
      }
    }
  } catch {
    log('WARN', '1Password not available or vault not accessible');
  }
  return ages;
}

function inferServiceFromItemTitle(title) {
  const t = title.toLowerCase();
  if (t.includes('openai'))      return 'openai';
  if (t.includes('anthropic'))   return 'anthropic';
  if (t.includes('google'))      return 'google';
  if (t.includes('groq'))        return 'groq';
  if (t.includes('hugging'))     return 'huggingface';
  if (t.includes('cloudflare'))  return 'cloudflare';
  if (t.includes('github'))      return 'github_pat';
  if (t.includes('postgres') || t.includes('neon') || t.includes('database')) return 'database';
  if (t.includes('redis'))       return 'redis';
  if (t.includes('jwt'))         return 'jwt_secret';
  if (t.includes('slack') && t.includes('webhook')) return 'webhook';
  return null;
}

// ─── SOC2 compliance report ───────────────────────────────────────────────────

function generateComplianceReport(findings, envVars, keyAges) {
  const now = new Date().toISOString();

  // Count severity
  const criticalFindings = findings.filter(f => f.severity === 'CRITICAL');
  const highFindings = findings.filter(f => f.severity === 'HIGH');

  // Key compliance
  const nonCompliantKeys = Object.entries(keyAges)
    .filter(([, info]) => !info.compliant)
    .map(([title, info]) => ({ title, ...info }));

  const compliantKeys = Object.entries(keyAges)
    .filter(([, info]) => info.compliant)
    .map(([title, info]) => ({ title, ...info }));

  // Overall compliance status
  const isCompliant = criticalFindings.length === 0
    && nonCompliantKeys.length === 0;

  const report = {
    generated_at: now,
    rotation_id: `audit-${Date.now()}`,
    compliance_status: isCompliant ? 'COMPLIANT' : 'NON_COMPLIANT',
    summary: {
      hardcoded_secrets_found: findings.length,
      critical_severity: criticalFindings.length,
      high_severity: highFindings.length,
      env_vars_tracked: envVars.length,
      keys_in_1password: Object.keys(keyAges).length,
      keys_compliant: compliantKeys.length,
      keys_overdue: nonCompliantKeys.length,
    },
    hardcoded_secrets: findings,
    env_vars: envVars,
    key_ages: keyAges,
    non_compliant_keys: nonCompliantKeys,
    rotation_policy: ROTATION_POLICY,
    soc2_evidence: {
      control: 'CC6.1',
      description: 'Logical and Physical Access Controls — Credential Rotation',
      assessment_date: now,
      assessor: 'heady-systems automated audit',
      findings_count: findings.length,
      policy_violations: nonCompliantKeys.length,
      attestation: isCompliant
        ? 'All credentials comply with rotation policy and no hardcoded secrets detected.'
        : `Non-compliance detected: ${criticalFindings.length} hardcoded secrets, ${nonCompliantKeys.length} overdue rotations.`,
    },
    recommendations: generateRecommendations(findings, nonCompliantKeys),
  };

  return report;
}

function generateRecommendations(findings, nonCompliantKeys) {
  const recs = [];

  if (findings.filter(f => f.severity === 'CRITICAL').length > 0) {
    recs.push({
      priority: 'CRITICAL',
      action: 'Immediately rotate all detected hardcoded credentials and remove from source code',
      count: findings.filter(f => f.severity === 'CRITICAL').length,
    });
  }

  for (const key of nonCompliantKeys) {
    recs.push({
      priority: 'HIGH',
      action: `Rotate overdue credential: ${key.title} (${key.days_overdue} days overdue)`,
      service: key.service,
    });
  }

  if (recs.length === 0) {
    recs.push({
      priority: 'INFO',
      action: 'All credentials are compliant. Continue scheduled rotation.',
    });
  }

  return recs;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('INFO', `Starting credential audit for ${REPO_ROOT}`);
  log('INFO', `key-rotation.js module: ${keyRotationModule ? 'found at ' + keyRotationModule.path : 'not found'}`);

  const allFindings = [];
  const allEnvVars = [];
  let filesScanned = 0;

  // Scan all files for hardcoded secrets
  log('INFO', 'Scanning source files for hardcoded secrets...');
  for (const filePath of walkDir(REPO_ROOT)) {
    const ext = extname(filePath).toLowerCase();
    const fname = basename(filePath);

    // .env files: analyze as env vars, also scan for secrets
    if (fname.startsWith('.env') || fname === '.env') {
      const envVars = analyzeEnvFile(filePath);
      allEnvVars.push(...envVars);
    }

    const findings = scanFile(filePath);
    allFindings.push(...findings);
    filesScanned++;

    if (filesScanned % 100 === 0) {
      log('DEBUG', `Scanned ${filesScanned} files...`);
    }
  }

  log('INFO', `Scanned ${filesScanned} files. Found ${allFindings.length} potential secrets.`);

  // Get key ages from 1Password
  log('INFO', 'Checking key ages in 1Password...');
  const keyAges = getKeyAgesFrom1Password();
  log('INFO', `Found ${Object.keys(keyAges).length} keys in 1Password vault`);

  // Generate report
  const report = generateComplianceReport(allFindings, allEnvVars, keyAges);

  // Write report
  const { mkdirSync } = await import('node:fs');
  mkdirSync(dirname(AUDIT_OUTPUT), { recursive: true });
  writeFileSync(AUDIT_OUTPUT, JSON.stringify(report, null, 2));

  // Print summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Heady Credential Audit Report');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Status:           ${report.compliance_status}`);
  console.log(`  Files Scanned:    ${filesScanned}`);
  console.log(`  Secrets Found:    ${report.summary.hardcoded_secrets_found}`);
  console.log(`    - Critical:     ${report.summary.critical_severity}`);
  console.log(`    - High:         ${report.summary.high_severity}`);
  console.log(`  Keys in 1P:       ${report.summary.keys_in_1password}`);
  console.log(`    - Compliant:    ${report.summary.keys_compliant}`);
  console.log(`    - Overdue:      ${report.summary.keys_overdue}`);
  console.log(`  Report:           ${AUDIT_OUTPUT}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (report.summary.hardcoded_secrets_found > 0) {
    console.log('HARDCODED SECRETS DETECTED:');
    for (const f of allFindings) {
      console.log(`  [${f.severity}] ${f.name} in ${f.file}:${f.line} [${f.masked_value}]`);
    }
    console.log('');
  }

  if (report.non_compliant_keys.length > 0) {
    console.log('OVERDUE ROTATIONS:');
    for (const k of report.non_compliant_keys) {
      console.log(`  [HIGH] ${k.title}: ${k.days_overdue} days overdue (policy: ${k.policy_days}d)`);
    }
    console.log('');
  }

  // Exit code for CI integration
  const criticalCount = report.summary.critical_severity;
  if (criticalCount > 0) {
    log('ERROR', `Audit failed: ${criticalCount} critical findings`);
    process.exit(1);
  }

  log('INFO', 'Audit complete');
}

// ─── ESM-compatible dirname ───────────────────────────────────────────────────
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

main().catch(err => {
  console.error('[FATAL]', err.message);
  process.exit(2);
});
