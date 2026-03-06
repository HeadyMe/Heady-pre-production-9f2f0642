/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

/**
 * ═══════════════════════════════════════════════════════════════
 * SDK Registration Endpoint — Roadmap Track A
 * ═══════════════════════════════════════════════════════════════
 *
 * Handles project registration from the Heady CLI and SDK
 * clients. Issues API keys, assigns projection targets,
 * and registers project intent for template generation.
 *
 * Fulfills:
 *   Track A – Developer Onboarding Plane:
 *     - One-click install / init strategy
 *     - Runtime projection target assignment
 *     - Template-driven generation from user intent
 */

const crypto = require('crypto');

// ── Registered Projects ─────────────────────────────────────────
const _registeredProjects = new Map();

// Intent → recommended templates
const INTENT_TEMPLATES = {
    'general': ['tester-bee', 'embedder-bee'],
    'trading-bot': ['trader-backtest-bee', 'tester-bee', 'embedder-bee'],
    'web-app': ['ui-compiler-bee', 'tester-bee', 'governance-gatekeeper'],
    'ai-agent': ['embedder-bee', 'tester-bee', 'pruner-bee'],
    'music': ['ableton-sysex-bee', 'embedder-bee', 'tester-bee'],
    'data-pipeline': ['embedder-bee', 'pruner-bee', 'tester-bee'],
};

// Auth provider preset (Track A: 25+ auth providers)
const SUPPORTED_AUTH_PROVIDERS = [
    'google', 'github', 'gitlab', 'bitbucket', 'azure-ad',
    'okta', 'auth0', 'cognito', 'firebase', 'supabase',
    'clerk', 'keycloak', 'onelogin', 'ping-identity', 'duo',
    'jumpcloud', 'cyberark', 'sailpoint', 'workspace-one',
    'ldap', 'saml', 'oidc', 'api-key', 'jwt', 'mTLS', 'oauth2',
];

/**
 * Register a new project.
 */
function registerProject(payload) {
    const projectId = payload.projectId;
    if (!projectId) throw new Error('projectId required');

    const apiKey = `hdy_${crypto.randomBytes(24).toString('hex')}`;
    const intent = payload.intent || 'general';

    const registration = {
        projectId,
        apiKey,
        intent,
        environment: payload.environment || 'development',
        projectType: payload.projectType || { language: 'unknown' },
        templates: INTENT_TEMPLATES[intent] || INTENT_TEMPLATES['general'],
        projectionTarget: {
            primary: 'cloud-run',
            endpoint: 'https://heady-manager-609590223909.us-central1.run.app',
            stalenessBudgetMs: 60000,
        },
        permissions: {
            read: true,
            write: false,
            admin: false,
            authProviders: ['api-key'],
        },
        quota: {
            dailyLlmCallsLimit: 1000,
            monthlyStorageMb: 500,
            maxConcurrentBees: 5,
        },
        registeredAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
    };

    _registeredProjects.set(projectId, registration);
    return registration;
}

/**
 * Validate an API key and return the project.
 */
function validateApiKey(apiKey) {
    for (const [, project] of _registeredProjects) {
        if (project.apiKey === apiKey) {
            project.lastSeen = new Date().toISOString();
            return project;
        }
    }
    return null;
}

/**
 * Get the onboarding blueprint consumed by SDK and UIs.
 */
function getOnboardingBlueprint() {
    return {
        version: '3.0.1',
        authProviders: SUPPORTED_AUTH_PROVIDERS,
        intentTypes: Object.keys(INTENT_TEMPLATES),
        templates: INTENT_TEMPLATES,
        projectionTargets: ['cloud-run', 'cloudflare-edge', 'huggingface-spaces'],
        sdkLanguages: ['javascript', 'python', 'go', 'rust'],
        onboardingSteps: [
            { step: 1, action: 'authenticate', description: 'Sign in with any supported auth provider' },
            { step: 2, action: 'register_intent', description: 'Declare project intent (e.g., web-app, ai-agent)' },
            { step: 3, action: 'assign_templates', description: 'System assigns optimal bee templates' },
            { step: 4, action: 'sync_projection', description: 'Initial projection sync to assigned target' },
            { step: 5, action: 'generate_sdk', description: 'Auto-generate SDK quickstart for project language' },
        ],
    };
}

/**
 * Express API routes for SDK registration.
 */
function sdkRoutes(app) {
    // Register a new project
    app.post('/api/sdk/register', (req, res) => {
        try {
            const registration = registerProject(req.body);
            res.status(201).json({
                ok: true,
                apiKey: registration.apiKey,
                projectionTarget: registration.projectionTarget,
                templates: registration.templates,
            });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // Get onboarding blueprint
    app.get('/api/sdk/blueprint', (req, res) => {
        res.json(getOnboardingBlueprint());
    });

    // List registered projects
    app.get('/api/sdk/projects', (req, res) => {
        const projects = [];
        for (const [, p] of _registeredProjects) {
            projects.push({
                projectId: p.projectId,
                intent: p.intent,
                environment: p.environment,
                registeredAt: p.registeredAt,
                lastSeen: p.lastSeen,
            });
        }
        res.json({ count: projects.length, projects });
    });

    // Validate API key
    app.post('/api/sdk/validate', (req, res) => {
        const { apiKey } = req.body;
        const project = validateApiKey(apiKey);
        if (!project) return res.status(401).json({ valid: false });
        res.json({ valid: true, projectId: project.projectId, intent: project.intent });
    });

    // Get supported auth providers
    app.get('/api/sdk/auth-providers', (req, res) => {
        res.json({ count: SUPPORTED_AUTH_PROVIDERS.length, providers: SUPPORTED_AUTH_PROVIDERS });
    });

    // Get intent templates
    app.get('/api/sdk/templates', (req, res) => {
        res.json(INTENT_TEMPLATES);
    });
}

module.exports = {
    registerProject,
    validateApiKey,
    getOnboardingBlueprint,
    sdkRoutes,
    INTENT_TEMPLATES,
    SUPPORTED_AUTH_PROVIDERS,
};
