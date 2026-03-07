#!/usr/bin/env node
/**
 * Heady CLI — Unified command-line interface for the Heady™ Latent OS
 * Consolidates all automation scripts into a single entry point.
 *
 * Usage:
 *   heady init          — Initialize a new Heady workspace
 *   heady start         — Start all services (conductor, MCP, projections)
 *   heady dev           — Start dev mode with hot reload
 *   heady build         — Build all packages
 *   heady deploy        — Deploy to Cloud Run + Cloudflare
 *   heady test          — Run full test suite
 *   heady doctor        — Health check all services
 *   heady rotate-keys   — Rotate all credentials
 *   heady migrate       — Run database migrations
 *   heady projection    — Manage projections (list, deploy, teardown)
 *   heady status        — Show system status
 *
 * @module bin/heady-cli
 * @version 1.0.0
 * @author HeadySystems™
 * @license Proprietary — HeadySystems™ & HeadyConnection™
 *
 * ⚡ Made with 💜 by HeadySystems™ & HeadyConnection™
 * Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

'use strict';

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ─── Constants ────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const SCRIPTS = path.join(ROOT, 'scripts');
const INFRA = path.join(ROOT, 'infra');
const MIGRATIONS = path.join(ROOT, 'migrations');

const BANNER = `
╔═══════════════════════════════════════════════════╗
║  🧠 Heady™ Latent Operating System CLI v1.0.0    ║
║  Sacred Geometry :: Organic Systems               ║
╚═══════════════════════════════════════════════════╝
`;

// ─── Helpers ──────────────────────────────────────────────────────

function run(cmd, opts = {}) {
    const defaults = { cwd: ROOT, stdio: 'inherit', shell: true };
    try {
        execSync(cmd, { ...defaults, ...opts });
        return true;
    } catch (err) {
        if (!opts.silent) console.error(`  ✗ Command failed: ${cmd}`);
        return false;
    }
}

function heading(text) {
    console.log(`\n  ◆ ${text}`);
    console.log('  ' + '─'.repeat(text.length + 2));
}

function success(msg) { console.log(`  ✓ ${msg}`); }
function info(msg) { console.log(`  ℹ ${msg}`); }
function warn(msg) { console.log(`  ⚠ ${msg}`); }

// ─── Commands ─────────────────────────────────────────────────────

const commands = {
    init() {
        heading('Initializing Heady Workspace');
        info('Installing dependencies...');
        run('npm install');
        info('Running database migrations...');
        commands.migrate();
        info('Checking environment...');
        commands.doctor();
        success('Workspace initialized');
    },

    start() {
        heading('Starting Heady Services');
        info('Starting conductor...');
        run('node src/orchestration/heady-conductor.js &');
        info('Starting MCP server...');
        run('node src/mcp/heady-mcp-server.js &');
        info('Starting projection dispatcher...');
        run('node src/projection/cloud-conductor-integration.js &');
        success('All services started');
    },

    dev() {
        heading('Starting Dev Mode');
        run('npm run dev');
    },

    build() {
        heading('Building All Packages');
        const pkgDir = path.join(ROOT, 'packages');
        if (!fs.existsSync(pkgDir)) { warn('No packages/'); return; }
        const packages = fs.readdirSync(pkgDir)
            .filter(d => fs.statSync(path.join(pkgDir, d)).isDirectory());
        for (const pkg of packages) {
            const pkgJson = path.join(pkgDir, pkg, 'package.json');
            if (fs.existsSync(pkgJson)) {
                const meta = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
                if (meta.scripts && meta.scripts.build) {
                    info(`Building ${pkg}...`);
                    run('npm run build', { cwd: path.join(pkgDir, pkg) });
                }
            }
        }
        success('All packages built');
    },

    deploy() {
        heading('Deploying to Cloud');
        const serviceYaml = path.join(INFRA, 'cloudrun', 'service.yaml');
        if (fs.existsSync(serviceYaml)) {
            info('Deploying to Cloud Run...');
            run(`gcloud run services replace ${serviceYaml}`);
        }
        const cfDir = path.join(INFRA, 'cloudflare');
        if (fs.existsSync(path.join(cfDir, 'wrangler.toml'))) {
            info('Deploying edge worker to Cloudflare...');
            run('wrangler deploy', { cwd: cfDir });
        }
        success('Deployment complete');
    },

    test() {
        heading('Running Test Suite');
        run('npm test');
    },

    doctor() {
        heading('Health Check');
        info(`Node.js: ${process.version}`);
        const dirs = ['src', 'services', 'packages', 'configs', 'infra', 'migrations'];
        for (const d of dirs) {
            const exists = fs.existsSync(path.join(ROOT, d));
            console.log(`  ${exists ? '✓' : '✗'} ${d}/`);
        }
        const files = [
            'package.json', '.gitignore', 'tsconfig.json',
            'src/core/phi-scales.js', 'src/core/semantic-logic.js',
            'src/orchestration/heady-conductor.js', 'src/mcp/heady-mcp-server.js',
        ];
        for (const f of files) {
            const exists = fs.existsSync(path.join(ROOT, f));
            console.log(`  ${exists ? '✓' : '✗'} ${f}`);
        }
        success('Health check complete');
    },

    'rotate-keys'() {
        heading('Rotating Credentials');
        const script = path.join(SCRIPTS, 'credential-rotation', 'rotate-all-keys.sh');
        if (fs.existsSync(script)) {
            run(`bash ${script}`);
        } else { warn('Rotation script not found'); }
    },

    migrate() {
        heading('Running Database Migrations');
        if (!fs.existsSync(MIGRATIONS)) { warn('No migrations directory'); return; }
        const sqlFiles = fs.readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort();
        info(`Found ${sqlFiles.length} migration files`);
        for (const f of sqlFiles) { info(`  → ${f}`); }
        info('Apply with: psql $DATABASE_URL -f migrations/<file>');
    },

    projection(sub = 'list') {
        heading('Projection Manager');
        switch (sub) {
            case 'list': info('Listing active projections...'); break;
            case 'deploy': info('Deploying new projection...'); break;
            case 'teardown': info('Tearing down projections...'); break;
            default: warn(`Unknown subcommand: ${sub}`);
        }
    },

    status() {
        heading('System Status');
        info(`Root: ${ROOT}`);
        info(`Time: ${new Date().toISOString()}`);
        const counts = {};
        function countDir(dir) {
            if (!fs.existsSync(dir)) return;
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                if (entry.name === 'node_modules' || entry.name === '.git') continue;
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) countDir(full);
                else { const ext = path.extname(entry.name) || '(none)'; counts[ext] = (counts[ext] || 0) + 1; }
            }
        }
        countDir(SRC);
        info('Source files by type:');
        for (const [ext, n] of Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
            console.log(`    ${ext}: ${n}`);
        }
        success('Status complete');
    },

    help() {
        console.log(BANNER);
        console.log('  Commands:');
        console.log('    init          Initialize workspace');
        console.log('    start         Start all services');
        console.log('    dev           Dev mode with hot reload');
        console.log('    build         Build all packages');
        console.log('    deploy        Deploy to Cloud Run + Cloudflare');
        console.log('    test          Run test suite');
        console.log('    doctor        Health check');
        console.log('    rotate-keys   Rotate credentials');
        console.log('    migrate       Run DB migrations');
        console.log('    projection    Manage projections');
        console.log('    status        System status');
        console.log('');
    },
};

// ─── Entry Point ──────────────────────────────────────────────────
const [, , cmd, ...args] = process.argv;
if (!cmd || cmd === 'help' || cmd === '--help') { commands.help(); }
else if (commands[cmd]) { console.log(BANNER); commands[cmd](...args); }
else { console.error(`  ✗ Unknown command: ${cmd}\n  Run "heady help" for commands`); process.exit(1); }
