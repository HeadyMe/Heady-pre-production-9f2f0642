#!/usr/bin/env node
/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

/**
 * ═══════════════════════════════════════════════════════════════
 * Heady CLI Bootstrap — Platform Track C
 * ═══════════════════════════════════════════════════════════════
 *
 * One-command CLI that authenticates, registers project intent,
 * syncs projections, and bootstraps the SDK. Fulfills Roadmap
 * Track C: SDK & Platform Packaging.
 *
 * Usage:
 *   npx heady init
 *   npx heady init --intent=trading-bot --env=production
 *   npx heady status
 *   npx heady project
 *   npx heady health
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const HEADY_CONFIG_FILE = '.heady.json';
const HEADY_API_BASE = process.env.HEADY_API_URL || 'https://heady-manager-609590223909.us-central1.run.app';

// ── CLI Argument Parser ─────────────────────────────────────────
function parseArgs(argv) {
    const args = argv.slice(2);
    const command = args[0] || 'help';
    const flags = {};

    args.slice(1).forEach(arg => {
        if (arg.startsWith('--')) {
            const [key, value] = arg.slice(2).split('=');
            flags[key] = value || true;
        }
    });

    return { command, flags };
}

// ── Commands ────────────────────────────────────────────────────

async function cmdInit(flags) {
    console.log('\n  ⚡ Heady CLI — Project Initialization\n');

    // 1. Check for existing config
    const configPath = path.resolve(process.cwd(), HEADY_CONFIG_FILE);
    if (fs.existsSync(configPath)) {
        const existing = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log(`  📦 Existing project: ${existing.projectId}`);
        console.log(`  🎯 Intent: ${existing.intent}`);
        console.log(`  ✅ Already initialized. Use 'heady status' to check health.\n`);
        return;
    }

    // 2. Generate project identity
    const projectId = `heady-${crypto.randomBytes(6).toString('hex')}`;
    const intent = flags.intent || 'general';
    const environment = flags.env || 'development';

    console.log(`  📦 Project:     ${projectId}`);
    console.log(`  🎯 Intent:      ${intent}`);
    console.log(`  🌍 Environment: ${environment}`);

    // 3. Detect project type
    const projectType = detectProjectType();
    console.log(`  🔍 Detected:    ${projectType.language} (${projectType.framework || 'vanilla'})`);

    // 4. Register with Heady API
    const registrationPayload = {
        projectId,
        intent,
        environment,
        projectType,
        cwd: process.cwd(),
        createdAt: new Date().toISOString(),
    };

    try {
        console.log('\n  📡 Registering with Heady Platform...');
        const res = await fetch(`${HEADY_API_BASE}/api/sdk/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registrationPayload),
        });

        if (res.ok) {
            const data = await res.json();
            registrationPayload.apiKey = data.apiKey;
            registrationPayload.projectionTarget = data.projectionTarget;
            console.log('  ✅ Registered successfully');
        } else {
            console.log('  ⚠️  API unavailable — offline mode');
        }
    } catch {
        console.log('  ⚠️  API unavailable — offline mode');
    }

    // 5. Write config
    const config = {
        $schema: 'https://heady.headyme.com/schemas/project.json',
        ...registrationPayload,
        sdk: {
            version: '3.0.1',
            autoSync: true,
            projectionInterval: 30000,
        },
        templates: [
            intent === 'trading-bot' ? 'trader-bee' : null,
            intent === 'web-app' ? 'ui-compiler-bee' : null,
            intent === 'ai-agent' ? 'embedder-bee' : null,
            'tester-bee',
        ].filter(Boolean),
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
    console.log(`\n  💾 Config saved: ${HEADY_CONFIG_FILE}`);

    // 6. Generate SDK quickstart
    const quickstartContent = generateQuickstart(config);
    fs.writeFileSync(path.resolve(process.cwd(), 'heady-quickstart.js'), quickstartContent);
    console.log('  📄 Generated: heady-quickstart.js');

    console.log('\n  ✅ Heady project initialized!');
    console.log('  Next: Run `npx heady status` to verify connectivity.\n');
}

async function cmdStatus() {
    console.log('\n  ⚡ Heady CLI — System Status\n');

    const configPath = path.resolve(process.cwd(), HEADY_CONFIG_FILE);
    if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log(`  📦 Project: ${config.projectId}`);
        console.log(`  🎯 Intent:  ${config.intent}`);
    }

    // Probe endpoints
    const endpoints = [
        { name: 'Cloud Run', url: `${HEADY_API_BASE}/health` },
        { name: 'LLM Router', url: `${HEADY_API_BASE}/api/llm/health` },
        { name: 'Scheduler', url: `${HEADY_API_BASE}/api/scheduler/health` },
        { name: 'Domain Router', url: `${HEADY_API_BASE}/api/domains/matrix` },
        { name: 'Edge', url: 'https://heady.headyme.com/health' },
    ];

    console.log('\n  📡 Endpoint Health:\n');

    for (const ep of endpoints) {
        try {
            const res = await fetch(ep.url, { signal: AbortSignal.timeout(5000) });
            const status = res.ok ? '✅' : '⚠️ ';
            console.log(`    ${status} ${ep.name}: ${res.status}`);
        } catch {
            console.log(`    ❌ ${ep.name}: unreachable`);
        }
    }
    console.log('');
}

async function cmdProject() {
    console.log('\n  ⚡ Heady CLI — Trigger Projection\n');

    const configPath = path.resolve(process.cwd(), HEADY_CONFIG_FILE);
    if (!fs.existsSync(configPath)) {
        console.log('  ❌ No .heady.json found. Run `npx heady init` first.\n');
        return;
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log(`  📦 Projecting: ${config.projectId}`);

    try {
        const res = await fetch(`${HEADY_API_BASE}/api/projections/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: config.projectId, timestamp: new Date().toISOString() }),
        });

        if (res.ok) {
            const data = await res.json();
            console.log('  ✅ Projection synced:', JSON.stringify(data, null, 2));
        } else {
            console.log(`  ⚠️  Projection API returned ${res.status}`);
        }
    } catch {
        console.log('  ⚠️  API unavailable — projection deferred');
    }
    console.log('');
}

async function cmdHealth() {
    console.log('\n  ⚡ Heady CLI — Full Health Check\n');

    try {
        const res = await fetch(`${HEADY_API_BASE}/health`, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
            const data = await res.json();
            console.log(JSON.stringify(data, null, 2));
        } else {
            console.log(`  ⚠️  Health endpoint returned ${res.status}`);
        }
    } catch {
        console.log('  ❌ Heady Manager unreachable');
    }
    console.log('');
}

function cmdHelp() {
    console.log(`
  ⚡ Heady CLI — v3.0.1

  Usage: npx heady <command> [options]

  Commands:
    init      Initialize a new Heady project
    status    Check system health and connectivity
    project   Trigger a projection sync
    health    Full health dump from Heady Manager
    help      Show this help message

  Options:
    --intent=<type>   Project intent (general, trading-bot, web-app, ai-agent)
    --env=<env>       Environment (development, staging, production)

  Examples:
    npx heady init --intent=trading-bot --env=production
    npx heady status
    npx heady project
`);
}

// ── Helpers ─────────────────────────────────────────────────────

function detectProjectType() {
    const cwd = process.cwd();
    const files = fs.readdirSync(cwd);

    if (files.includes('package.json')) {
        const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps.react) return { language: 'javascript', framework: 'react' };
        if (deps.vue) return { language: 'javascript', framework: 'vue' };
        if (deps.next) return { language: 'javascript', framework: 'next' };
        if (deps.express) return { language: 'javascript', framework: 'express' };
        return { language: 'javascript', framework: 'node' };
    }
    if (files.includes('requirements.txt') || files.includes('pyproject.toml')) {
        return { language: 'python', framework: null };
    }
    if (files.includes('go.mod')) return { language: 'go', framework: null };
    if (files.includes('Cargo.toml')) return { language: 'rust', framework: null };
    return { language: 'unknown', framework: null };
}

function generateQuickstart(config) {
    return `// Heady SDK Quickstart — Auto-generated for ${config.projectId}
// Intent: ${config.intent} | Environment: ${config.environment}

const HEADY_API = '${HEADY_API_BASE}';

async function headyQuery(prompt) {
    const res = await fetch(HEADY_API + '/api/llm/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskType: 'general', prompt }),
    });
    return res.json();
}

async function headyHealth() {
    const res = await fetch(HEADY_API + '/health');
    return res.json();
}

module.exports = { headyQuery, headyHealth };
`;
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
    const { command, flags } = parseArgs(process.argv);

    switch (command) {
        case 'init': return cmdInit(flags);
        case 'status': return cmdStatus();
        case 'project': return cmdProject();
        case 'health': return cmdHealth();
        case 'help':
        default: return cmdHelp();
    }
}

main().catch(err => {
    console.error('  ❌ Error:', err.message);
    process.exit(1);
});
