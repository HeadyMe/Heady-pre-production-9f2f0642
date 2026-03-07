/**
 * ∞ Config & Globals — Phase 1 Bootstrap
 * Extracted from heady-manager.js lines 1-145
 * Environment, event bus, MIDI bus, edge cache, secrets management
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const logger = require('../utils/logger');
const redisPool = require('../utils/redis-pool');
const fs = require('fs');
const path = require('path');
const yaml = require('../core/heady-yaml');

require('../core/heady-env').loadEnv();

const express = require('../core/heady-server');

// Event bus
const { EventEmitter } = require('events');
const eventBus = new EventEmitter();
global.eventBus = eventBus;

const { midiBus } = require('../engines/midi-event-bus');
global.midiBus = midiBus;

// Remote resources config
let remoteConfig = { services: {} };
try { remoteConfig = yaml.load(fs.readFileSync(path.join(__dirname, '../../configs/remote-resources.yaml'), 'utf8')) || remoteConfig; }
catch { /* remote-resources.yaml not found — using defaults */ }

if (remoteConfig.critical_only) {
    logger.logNodeActivity("CONDUCTOR", 'Running in local-first mode (non-critical remote calls disabled)');
}

// Imagination Engine (early load for route registration)
let imaginationRoutes = null;
try {
    imaginationRoutes = require('../routes/imagination-routes');
    logger.logNodeActivity("CONDUCTOR", "  ∞ Imagination Engine: ROUTES LOADED");
} catch (err) {
    logger.logNodeActivity("CONDUCTOR", `  ⚠ Imagination routes not loaded: ${err.message}`);
}

// Secrets & Cloudflare Management
let secretsManager = null;
let cfManager = null;
try {
    const { secretsManager: sm } = require('../hc_secrets_manager');
    const { CloudflareManager } = require('../hc_cloudflare');
    secretsManager = sm;
    cfManager = new CloudflareManager(secretsManager);

    const manifestSecrets = [
        { id: "render_api_key", name: "Render API Key", envVar: "RENDER_API_KEY", tags: ["render", "api-key"], dependents: ["render-deploy"] },
        { id: "heady_api_key", name: "Heady API Key", envVar: "HEADY_API_KEY", tags: ["heady", "auth"], dependents: ["api-gateway"] },
        { id: "admin_token", name: "Admin Token", envVar: "ADMIN_TOKEN", tags: ["heady", "admin"], dependents: ["admin-panel"] },
        { id: "database_url", name: "PostgreSQL Connection", envVar: "DATABASE_URL", tags: ["database"], dependents: ["persistence"] },
        { id: "hf_token", name: "Hugging Face Token", envVar: "HF_TOKEN", tags: ["huggingface", "ai"], dependents: ["pythia-node"] },
        { id: "notion_token", name: "Notion Integration Token", envVar: "NOTION_TOKEN", tags: ["notion"], dependents: ["notion-sync"] },
        { id: "github_token", name: "GitHub PAT", envVar: "GITHUB_TOKEN", tags: ["github", "vcs"], dependents: ["heady-sync"] },
        { id: "stripe_secret_key", name: "Stripe Secret Key", envVar: "STRIPE_SECRET_KEY", tags: ["stripe", "payments"], dependents: ["billing"] },
        { id: "stripe_webhook_secret", name: "Stripe Webhook Secret", envVar: "STRIPE_WEBHOOK_SECRET", tags: ["stripe", "webhook"], dependents: ["billing-webhooks"] },
        { id: "github_app_id", name: "GitHub App ID", envVar: "GITHUB_APP_ID", tags: ["github", "vm"], dependents: ["vm-token"] },
        { id: "github_app_private_key", name: "GitHub App Private Key", envVar: "GITHUB_APP_PRIVATE_KEY", tags: ["github", "vm"], dependents: ["vm-token"] },
        { id: "github_app_installation_id", name: "GitHub App Installation ID", envVar: "GITHUB_APP_INSTALLATION_ID", tags: ["github", "vm"], dependents: ["vm-token"] },
    ];
    for (const s of manifestSecrets) {
        secretsManager.register({ ...s, source: "env" });
    }
    secretsManager.restoreState();
    logger.logNodeActivity("CONDUCTOR", `  ∞ Secrets Manager: LOADED (${secretsManager.getAll().length} secrets tracked)`);
    logger.logNodeActivity("CONDUCTOR", `  ∞ Cloudflare Manager: LOADED (token ${cfManager.isTokenValid() ? "valid" : "needs refresh"})`);
} catch (err) {
    logger.logNodeActivity("CONDUCTOR", `  ⚠ Secrets/Cloudflare not loaded: ${err.message}`);
}

const app = express();
app.set('trust proxy', 1);

module.exports = { app, logger, eventBus, redisPool, remoteConfig, secretsManager, cfManager, imaginationRoutes, midiBus };
