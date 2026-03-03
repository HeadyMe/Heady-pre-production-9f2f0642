/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Onboarding Orchestrator — 5-Stage Stateful Flow
 *
 * Stage 1 (auth):         Choose provider → authenticate
 * Stage 2 (permissions):  Grant device/filesystem/swarm/memory permissions
 * Stage 3 (email):        Provision {username}@headyme.com via Google Workspace
 * Stage 4 (email-config): Setup email client, forwarding, or skip
 * Stage 5 (buddy-setup):  Buddy-guided custom UI/context/workflow setup
 *
 * Endpoints:
 *   GET    /api/onboarding/state          — Current stage + completion status
 *   POST   /api/onboarding/advance        — Advance to next stage
 *   GET    /api/onboarding/email-clients   — Recommended secure email clients
 *   GET    /api/onboarding/health         — Service health
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

// ─── Stage Definitions ──────────────────────────────────────────────
const STAGES = [
    { id: 'auth', step: 1, label: 'Sign In', icon: '🔐', required: true },
    { id: 'permissions', step: 2, label: 'Grant Permissions', icon: '🛡️', required: true },
    { id: 'email', step: 3, label: 'Email Setup', icon: '📧', required: true },
    { id: 'email-config', step: 4, label: 'Email Configuration', icon: '⚙️', required: false },
    { id: 'buddy-setup', step: 5, label: 'Buddy Guided Setup', icon: '🤖', required: true },
];

// ─── Secure Email Client Recommendations ─────────────────────────────
const SECURE_EMAIL_CLIENTS = [
    {
        id: 'thunderbird',
        name: 'Mozilla Thunderbird',
        platform: ['linux', 'windows', 'macos'],
        protocol: 'IMAP/SMTP',
        icon: '🦅',
        features: ['end-to-end encryption', 'calendar', 'contacts', 'GPG support'],
        downloadUrl: 'https://www.thunderbird.net/',
        imapConfig: { server: 'imap.gmail.com', port: 993, security: 'SSL/TLS' },
        smtpConfig: { server: 'smtp.gmail.com', port: 587, security: 'STARTTLS' },
    },
    {
        id: 'k9-mail',
        name: 'K-9 Mail',
        platform: ['android'],
        protocol: 'IMAP/SMTP',
        icon: '🐕',
        features: ['open source', 'GPG via OpenKeychain', 'multiple accounts'],
        downloadUrl: 'https://k9mail.app/',
        imapConfig: { server: 'imap.gmail.com', port: 993, security: 'SSL/TLS' },
        smtpConfig: { server: 'smtp.gmail.com', port: 587, security: 'STARTTLS' },
    },
    {
        id: 'fairemail',
        name: 'FairEmail',
        platform: ['android'],
        protocol: 'IMAP/SMTP',
        icon: '✉️',
        features: ['privacy-focused', 'no tracking', 'low battery usage', 'S/MIME + GPG'],
        downloadUrl: 'https://email.faircode.eu/',
        imapConfig: { server: 'imap.gmail.com', port: 993, security: 'SSL/TLS' },
        smtpConfig: { server: 'smtp.gmail.com', port: 587, security: 'STARTTLS' },
    },
    {
        id: 'apple-mail',
        name: 'Apple Mail',
        platform: ['macos', 'ios'],
        protocol: 'IMAP/SMTP',
        icon: '📬',
        features: ['built-in', 'focus modes', 'tracking protection'],
        downloadUrl: 'built-in',
        imapConfig: { server: 'imap.gmail.com', port: 993, security: 'SSL/TLS' },
        smtpConfig: { server: 'smtp.gmail.com', port: 587, security: 'STARTTLS' },
    },
    {
        id: 'gmail-web',
        name: 'Gmail Web Interface',
        platform: ['web', 'android', 'ios'],
        protocol: 'Web',
        icon: '🌐',
        features: ['no setup required', 'instant access', 'Google Workspace integration'],
        downloadUrl: 'https://mail.google.com/',
        note: 'Access your @headyme.com email directly through Gmail — already linked to Google Workspace.',
    },
];

// ─── Email Forwarding Modes ─────────────────────────────────────────
const EMAIL_FORWARDING_MODES = [
    { id: 'secure-client', label: 'Setup Secure Email Client', description: 'Configure a privacy-focused email client on your devices', icon: '🔒' },
    { id: 'forward-custom', label: 'Forward to Another Email', description: 'Forward all @headyme.com mail to any email address you choose', icon: '📤', requiresInput: 'forwardTo' },
    { id: 'forward-to-auth', label: 'Forward to Auth Provider Email', description: 'Forward all @headyme.com mail to the email from your sign-in provider', icon: '🔄' },
    { id: 'skip', label: 'Configure Later', description: 'Skip email configuration — you can set it up anytime from settings', icon: '⏭️' },
];

// ─── In-memory onboarding state (production: DB/KV) ─────────────────
const onboardingStates = new Map();

// ─── Username Derivation ────────────────────────────────────────────
function deriveUsername(authProfile) {
    const { displayName, email, provider } = authProfile;

    if (displayName) {
        const clean = displayName.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '').replace(/\.{2,}/g, '.').replace(/^\.+|\.+$/g, '');
        if (clean.length >= 2) return clean;
    }

    if (email) {
        const prefix = email.split('@')[0].toLowerCase().replace(/[^a-z0-9.]/g, '').replace(/\.{2,}/g, '.').replace(/^\.+|\.+$/g, '');
        if (prefix.length >= 2) return prefix;
    }

    return `${provider || 'user'}.${crypto.randomBytes(3).toString('hex')}`;
}

// ─── Onboarding Orchestrator ────────────────────────────────────────
class OnboardingOrchestrator {
    constructor(opts = {}) {
        this.domain = opts.domain || 'headyme.com';
        this.googleWorkspaceEnabled = opts.googleWorkspaceEnabled !== false;
        this.startedAt = new Date().toISOString();
    }

    getOnboardingState(userId) {
        if (!onboardingStates.has(userId)) {
            onboardingStates.set(userId, {
                userId,
                currentStage: 'auth',
                completed: false,
                stages: {
                    auth: { done: false, data: null },
                    permissions: { done: false, data: null },
                    email: { done: false, data: null },
                    'email-config': { done: false, data: null },
                    'buddy-setup': { done: false, data: null },
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        }
        return onboardingStates.get(userId);
    }

    advanceStage(userId, stageData) {
        const state = this.getOnboardingState(userId);
        const { stage } = stageData;

        const stageIndex = STAGES.findIndex((s) => s.id === stage);
        if (stageIndex === -1) return { ok: false, error: `Unknown stage: ${stage}` };

        // Validate prerequisites — all prior required stages must be done
        for (let i = 0; i < stageIndex; i++) {
            const prior = STAGES[i];
            if (prior.required && !state.stages[prior.id].done) {
                return { ok: false, error: `Stage "${prior.id}" must be completed before "${stage}"`, currentStage: state.currentStage };
            }
        }

        // Process the stage
        const handler = {
            auth: () => this._processAuth(state, stageData),
            permissions: () => this._processPermissions(state, stageData),
            email: () => this._processEmail(state, stageData),
            'email-config': () => this._processEmailConfig(state, stageData),
            'buddy-setup': () => this._processBuddySetup(state, stageData),
        };

        const processor = handler[stage];
        if (!processor) return { ok: false, error: `Cannot process stage: ${stage}` };
        const result = processor();

        // Mark complete and advance
        state.stages[stage].done = true;
        state.stages[stage].data = result.data || stageData;
        state.stages[stage].completedAt = new Date().toISOString();
        state.updatedAt = new Date().toISOString();

        const nextStageIndex = stageIndex + 1;
        if (nextStageIndex < STAGES.length) {
            state.currentStage = STAGES[nextStageIndex].id;
        } else {
            state.currentStage = 'complete';
            state.completed = true;
            state.completedAt = new Date().toISOString();
        }

        onboardingStates.set(userId, state);

        return { ok: true, currentStage: state.currentStage, completed: state.completed, ...result };
    }

    _processAuth(_state, stageData) {
        const { provider, email, displayName } = stageData;
        return { data: { provider: provider || 'unknown', email: email || null, displayName: displayName || null, authenticatedAt: new Date().toISOString() } };
    }

    _processPermissions(_state, stageData) {
        const { grants } = stageData;
        const defaultGrants = ['filesystem', 'device', 'network', 'memory', 'swarm', 'auth'];
        const grantedPermissions = (grants || defaultGrants).map((g) => ({
            type: typeof g === 'string' ? g : g.type,
            scope: typeof g === 'string' ? 'full' : (g.scope || 'full'),
            grantedAt: new Date().toISOString(),
        }));
        return { data: { permissions: grantedPermissions, allCloudExecuted: true } };
    }

    _processEmail(state, stageData) {
        const authData = state.stages.auth.data || {};
        const username = stageData.username || deriveUsername({
            displayName: authData.displayName,
            email: authData.email,
            provider: authData.provider,
        });

        const headyEmail = `${username}@${this.domain}`;
        const provisioned = this.googleWorkspaceEnabled;

        return {
            email: headyEmail,
            username,
            data: {
                headyEmail,
                username,
                provisionStatus: provisioned ? 'provisioned' : 'pending-admin-review',
                googleWorkspace: provisioned,
                imapServer: 'imap.gmail.com',
                smtpServer: 'smtp.gmail.com',
                provisionedAt: provisioned ? new Date().toISOString() : null,
            },
        };
    }

    _processEmailConfig(state, stageData) {
        const emailData = state.stages.email.data || {};
        const authData = state.stages.auth.data || {};
        const { mode, forwardTo, clientId } = stageData;

        const validModes = EMAIL_FORWARDING_MODES.map((m) => m.id);
        const selectedMode = validModes.includes(mode) ? mode : 'skip';

        let forwardingTarget = null;
        let clientConfig = null;

        if (selectedMode === 'secure-client') {
            clientConfig = SECURE_EMAIL_CLIENTS.find((c) => c.id === (clientId || 'thunderbird')) || SECURE_EMAIL_CLIENTS[0];
        } else if (selectedMode === 'forward-custom') {
            forwardingTarget = forwardTo || null;
        } else if (selectedMode === 'forward-to-auth') {
            forwardingTarget = authData.email || null;
        }

        return {
            data: {
                mode: selectedMode,
                headyEmail: emailData.headyEmail,
                forwardingTarget,
                clientConfig: clientConfig ? {
                    id: clientConfig.id, name: clientConfig.name, platform: clientConfig.platform,
                    imapConfig: clientConfig.imapConfig, smtpConfig: clientConfig.smtpConfig,
                    emailAddress: emailData.headyEmail,
                } : null,
                configuredAt: new Date().toISOString(),
            },
        };
    }

    _processBuddySetup(state, stageData) {
        const { contexts, preferences, customUiLayouts, contextDefinitions } = stageData;

        const selectedContexts = contexts || ['dev-platform'];
        const userPreferences = {
            theme: preferences?.theme || 'sacred-geometry-dark',
            notificationCadence: preferences?.notificationCadence || 'smart',
            displayDensity: preferences?.displayDensity || 'comfortable',
            connectorAutoDiscovery: preferences?.connectorAutoDiscovery !== false,
            ...preferences,
        };

        const layouts = customUiLayouts || [{
            id: 'default-dashboard',
            sections: ['quick-actions', 'context-feed', 'bee-status', 'memory-explorer'],
        }];

        const definitions = contextDefinitions || selectedContexts.map((ctx) => ({
            contextId: ctx, workflows: [], shortcuts: [], pinned: true,
        }));

        return {
            data: {
                selectedContexts,
                preferences: userPreferences,
                uiLayouts: layouts,
                contextDefinitions: definitions,
                buddyWelcomeMessage: this._generateBuddyWelcome(state),
                configuredAt: new Date().toISOString(),
            },
        };
    }

    _generateBuddyWelcome(state) {
        const authData = state.stages.auth.data || {};
        const emailData = state.stages.email.data || {};
        const name = authData.displayName || emailData.username || 'friend';

        return {
            greeting: `Welcome aboard, ${name}! 🎉`,
            message: `Your Heady workspace is fully configured. Your personal email is ${emailData.headyEmail || 'pending setup'}. I'm HeadyBuddy — your AI companion. Everything runs on cloud HeadyBees, so your devices stay light and fast.`,
            quickStartActions: [
                { label: 'Open Dashboard', action: '/dashboard', icon: '📊' },
                { label: 'Chat with Buddy', action: '/buddy', icon: '🤖' },
                { label: 'Explore Connectors', action: '/connectors', icon: '🔌' },
                { label: 'Check Email', action: `https://mail.google.com/a/${emailData.headyEmail?.split('@')[1] || 'headyme.com'}`, icon: '📧' },
            ],
        };
    }

    getSuggestionsForUser(userId) {
        const state = this.getOnboardingState(userId);
        const authData = state.stages.auth.data || {};
        const provider = authData.provider || 'unknown';

        const providerSuggestions = {
            github: { contexts: ['dev-platform', 'creative-studio'], reason: 'You signed in with GitHub — developer tools and creative workflows are perfect for you.' },
            google: { contexts: ['business-ops', 'personal-wellness'], reason: 'Google users often love business ops and personal wellness tracking.' },
            spotify: { contexts: ['creative-studio'], reason: 'Music lover detected — the Creative Studio is your jam.' },
            instagram: { contexts: ['creative-studio', 'business-ops'], reason: 'Visual creator? Creative Studio + Business Ops will power your brand.' },
            tiktok: { contexts: ['creative-studio', 'business-ops'], reason: 'Content creator! Creative Studio for production, Business Ops for analytics.' },
            default: { contexts: ['dev-platform', 'business-ops'], reason: 'Here are some popular starting points.' },
        };

        return {
            ok: true,
            userId,
            provider,
            suggestedContexts: (providerSuggestions[provider] || providerSuggestions.default).contexts,
            reason: (providerSuggestions[provider] || providerSuggestions.default).reason,
            allAvailableContexts: ['business-ops', 'creative-studio', 'nonprofit-mgmt', 'dev-platform', 'personal-wellness'],
        };
    }

    getHealth() {
        return {
            ok: true,
            service: 'onboarding-orchestrator',
            domain: this.domain,
            startedAt: this.startedAt,
            activeOnboardings: onboardingStates.size,
            completedOnboardings: Array.from(onboardingStates.values()).filter((s) => s.completed).length,
            stages: STAGES.length,
            emailClients: SECURE_EMAIL_CLIENTS.length,
            forwardingModes: EMAIL_FORWARDING_MODES.length,
            ts: new Date().toISOString(),
        };
    }
}

// ─── Express Routes ─────────────────────────────────────────────────
function registerOnboardingOrchestratorRoutes(app, orchestrator = new OnboardingOrchestrator()) {
    app.get('/api/onboarding/state', (req, res) => {
        const userId = req.query.userId || req.headers['x-heady-user-id'];
        if (!userId) return res.status(400).json({ ok: false, error: 'userId required (query or x-heady-user-id header)' });
        const state = orchestrator.getOnboardingState(userId);
        const currentStageMeta = STAGES.find((s) => s.id === state.currentStage) || { step: 6, label: 'Complete', icon: '✅' };
        return res.json({ ok: true, ...state, currentStageMeta, stages: STAGES });
    });

    app.post('/api/onboarding/advance', (req, res) => {
        const userId = req.body?.userId || req.headers['x-heady-user-id'];
        if (!userId) return res.status(400).json({ ok: false, error: 'userId required' });
        const result = orchestrator.advanceStage(userId, req.body);
        if (!result.ok) return res.status(400).json(result);
        const currentStageMeta = STAGES.find((s) => s.id === result.currentStage) || { step: 6, label: 'Complete', icon: '✅' };
        return res.json({ ...result, currentStageMeta });
    });

    app.get('/api/onboarding/email-clients', (_req, res) => {
        res.json({
            ok: true,
            clients: SECURE_EMAIL_CLIENTS,
            forwardingModes: EMAIL_FORWARDING_MODES,
            domain: orchestrator.domain,
            note: 'All @headyme.com accounts are Google Workspace accounts — any client supporting IMAP/SMTP works.',
        });
    });

    app.get('/api/onboarding/suggestions', (req, res) => {
        const userId = req.query.userId || req.headers['x-heady-user-id'];
        if (!userId) return res.status(400).json({ ok: false, error: 'userId required' });
        res.json(orchestrator.getSuggestionsForUser(userId));
    });

    app.get('/api/onboarding/health', (_req, res) => {
        res.json(orchestrator.getHealth());
    });

    logger.logNodeActivity('CONDUCTOR', '    → Endpoints: /api/onboarding/state, /advance, /email-clients, /suggestions, /health');
    return orchestrator;
}

module.exports = {
    OnboardingOrchestrator,
    registerOnboardingOrchestratorRoutes,
    deriveUsername,
    STAGES,
    SECURE_EMAIL_CLIENTS,
    EMAIL_FORWARDING_MODES,
};
