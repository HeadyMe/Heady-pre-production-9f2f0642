/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * HeadyMe Onboarding Router
 * Manages user context preferences, target sites, and dynamic connector generation
 * during the onboarding flow.
 *
 * Endpoints:
 *   GET    /api/headyme-onboarding/templates    — Available onboarding context templates
 *   POST   /api/headyme-onboarding/plan         — Generate a personalized onboarding plan
 *   POST   /api/headyme-onboarding/activate     — Activate selected contexts and create sites
 *   GET    /api/headyme-onboarding/status        — Get current onboarding status for user
 *   GET    /api/headyme-onboarding/health        — Health check
 */

const express = require("express");
const router = express.Router();
const crypto = require("crypto");

// ─── In-memory onboarding store (production: replace with DB/KV) ─────
const onboardingProfiles = new Map();

// ─── Context Templates ──────────────────────────────────────────────
const CONTEXT_TEMPLATES = [
    {
        id: "business-ops",
        label: "Business Operations",
        description: "Financial tracking, project management, stakeholder reporting",
        sites: ["dashboard.headyme.com", "reports.headyme.com"],
        connectors: ["quickbooks", "stripe", "google-sheets"],
        features: ["auto-reports", "budget-tracking", "kpi-alerts"],
    },
    {
        id: "creative-studio",
        label: "Creative Studio",
        description: "Music production, visual design, content creation tools",
        sites: ["studio.headyme.com", "media.headyme.com"],
        connectors: ["ableton-live", "figma", "canva", "youtube"],
        features: ["midi-bridge", "asset-library", "live-collaboration"],
    },
    {
        id: "nonprofit-mgmt",
        label: "Nonprofit Management",
        description: "Volunteer coordination, grant writing, impact measurement",
        sites: ["impact.headyme.com", "grants.headyme.com"],
        connectors: ["donor-crm", "google-forms", "mailchimp"],
        features: ["grant-tracker", "volunteer-scheduler", "impact-dashboard"],
    },
    {
        id: "dev-platform",
        label: "Developer Platform",
        description: "CI/CD, code review, system monitoring",
        sites: ["dev.headyme.com", "monitor.headyme.com"],
        connectors: ["github", "vercel", "cloudflare", "sentry"],
        features: ["deploy-pipeline", "error-sentinel", "performance-gates"],
    },
    {
        id: "personal-wellness",
        label: "Personal Wellness",
        description: "Health tracking, mindfulness, habit building",
        sites: ["wellness.headyme.com"],
        connectors: ["apple-health", "google-fit", "calm"],
        features: ["habit-tracker", "mood-journal", "meditation-timer"],
    },
];

// ─── Templates ──────────────────────────────────────────────────────
router.get("/templates", (req, res) => {
    res.json({ ok: true, templates: CONTEXT_TEMPLATES, total: CONTEXT_TEMPLATES.length });
});

// ─── Generate Plan ──────────────────────────────────────────────────
router.post("/plan", (req, res) => {
    const { userId, selectedContexts, customPreferences } = req.body;
    if (!userId || !selectedContexts || !Array.isArray(selectedContexts)) {
        return res.status(400).json({ ok: false, error: "userId and selectedContexts[] required" });
    }

    const planId = `plan-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;

    // Resolve selected contexts into a unified plan
    const resolvedContexts = selectedContexts
        .map((ctxId) => CONTEXT_TEMPLATES.find((t) => t.id === ctxId))
        .filter(Boolean);

    const allSites = [...new Set(resolvedContexts.flatMap((c) => c.sites))];
    const allConnectors = [...new Set(resolvedContexts.flatMap((c) => c.connectors))];
    const allFeatures = [...new Set(resolvedContexts.flatMap((c) => c.features))];

    const plan = {
        planId,
        userId,
        status: "draft",
        contexts: resolvedContexts.map((c) => c.id),
        sites: allSites,
        connectors: allConnectors.map((c) => ({
            id: c,
            status: "pending",
            type: "dynamic",
            protocol: "MCP",
        })),
        features: allFeatures,
        customPreferences: customPreferences || {},
        createdAt: new Date().toISOString(),
    };

    onboardingProfiles.set(planId, plan);

    res.json({ ok: true, plan });
});

// ─── Activate Plan ──────────────────────────────────────────────────
router.post("/activate", (req, res) => {
    const { planId } = req.body;
    if (!planId) return res.status(400).json({ ok: false, error: "planId required" });

    const plan = onboardingProfiles.get(planId);
    if (!plan) return res.status(404).json({ ok: false, error: "Plan not found" });

    // Mark connectors as provisioned
    plan.connectors = plan.connectors.map((c) => ({
        ...c,
        status: "active",
        provisionedAt: new Date().toISOString(),
    }));
    plan.status = "active";
    plan.activatedAt = new Date().toISOString();

    onboardingProfiles.set(planId, plan);

    res.json({
        ok: true,
        plan,
        message: `Onboarding activated: ${plan.sites.length} sites, ${plan.connectors.length} connectors, ${plan.features.length} features`,
    });
});

// ─── Status ─────────────────────────────────────────────────────────
router.get("/status", (req, res) => {
    const { userId, planId } = req.query;

    if (planId) {
        const plan = onboardingProfiles.get(planId);
        if (!plan) return res.status(404).json({ ok: false, error: "Plan not found" });
        return res.json({ ok: true, plan });
    }

    if (userId) {
        const userPlans = Array.from(onboardingProfiles.values()).filter((p) => p.userId === userId);
        return res.json({ ok: true, plans: userPlans, total: userPlans.length });
    }

    res.json({
        ok: true,
        totalProfiles: onboardingProfiles.size,
        ts: new Date().toISOString(),
    });
});

// ─── Health ─────────────────────────────────────────────────────────
router.get("/health", (req, res) => {
    res.json({
        ok: true,
        service: "headyme-onboarding",
        profiles: onboardingProfiles.size,
        templates: CONTEXT_TEMPLATES.length,
        ts: new Date().toISOString(),
    });
});

// ─── Buddy-Guided Setup ─────────────────────────────────────────────
router.post("/buddy-setup", (req, res) => {
    const { userId, selectedContexts, preferences, customUiLayouts, contextDefinitions } = req.body;
    if (!userId) return res.status(400).json({ ok: false, error: "userId required" });

    const contexts = (selectedContexts || [])
        .map((ctxId) => CONTEXT_TEMPLATES.find((t) => t.id === ctxId))
        .filter(Boolean);

    const userPreferences = {
        theme: preferences?.theme || 'sacred-geometry-dark',
        notificationCadence: preferences?.notificationCadence || 'smart',
        displayDensity: preferences?.displayDensity || 'comfortable',
        connectorAutoDiscovery: preferences?.connectorAutoDiscovery !== false,
        ...(preferences || {}),
    };

    const layouts = customUiLayouts || [{
        id: 'default-dashboard',
        sections: ['quick-actions', 'context-feed', 'bee-status', 'memory-explorer'],
    }];

    const definitions = contextDefinitions || contexts.map((ctx) => ({
        contextId: ctx.id,
        label: ctx.label,
        sites: ctx.sites,
        connectors: ctx.connectors,
        features: ctx.features,
        workflows: [],
        shortcuts: [],
        pinned: true,
    }));

    const setupId = `buddy-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;

    const buddySetup = {
        setupId,
        userId,
        step: 'buddy-guided-setup',
        contexts: contexts.map((c) => c.id),
        resolvedContexts: contexts,
        preferences: userPreferences,
        uiLayouts: layouts,
        contextDefinitions: definitions,
        allSites: [...new Set(contexts.flatMap((c) => c.sites))],
        allConnectors: [...new Set(contexts.flatMap((c) => c.connectors))],
        allFeatures: [...new Set(contexts.flatMap((c) => c.features))],
        createdAt: new Date().toISOString(),
    };

    onboardingProfiles.set(setupId, buddySetup);

    res.json({
        ok: true,
        setup: buddySetup,
        buddyMessage: {
            greeting: `Great choices! 🎉`,
            summary: `I've configured ${contexts.length} context(s) with ${buddySetup.allConnectors.length} connectors and ${buddySetup.allFeatures.length} features.`,
            nextStep: 'Review your setup below and hit finalize when ready, or customize further.',
        },
    });
});

// ─── Buddy Suggestions (AI-powered) ────────────────────────────────
router.get("/buddy-suggestions", (req, res) => {
    const { userId, provider } = req.query;

    const providerHints = {
        github: { contexts: ['dev-platform', 'creative-studio'], reason: 'Developer workflows + creative tools based on your GitHub sign-in.' },
        google: { contexts: ['business-ops', 'personal-wellness'], reason: 'Productivity + wellness based on your Google profile.' },
        spotify: { contexts: ['creative-studio'], reason: 'Music production tools for Spotify creators.' },
        instagram: { contexts: ['creative-studio', 'business-ops'], reason: 'Visual content creation + brand analytics.' },
        tiktok: { contexts: ['creative-studio', 'business-ops'], reason: 'Short-form content creation + growth analytics.' },
        amazon: { contexts: ['business-ops'], reason: 'Commerce and operations management.' },
        discord: { contexts: ['dev-platform', 'creative-studio'], reason: 'Community management + development tools.' },
    };

    const suggestion = providerHints[provider] || { contexts: ['dev-platform', 'business-ops'], reason: 'Popular starting contexts for new users.' };

    res.json({
        ok: true,
        userId: userId || null,
        provider: provider || null,
        suggestedContexts: suggestion.contexts,
        reason: suggestion.reason,
        allTemplates: CONTEXT_TEMPLATES.map((t) => ({ id: t.id, label: t.label, description: t.description })),
    });
});

// ─── Finalize Onboarding ────────────────────────────────────────────
router.post("/finalize", (req, res) => {
    const { userId, setupId } = req.body;
    if (!userId) return res.status(400).json({ ok: false, error: "userId required" });

    let setup = null;
    if (setupId) {
        setup = onboardingProfiles.get(setupId);
    } else {
        // Find latest setup for user
        const userSetups = Array.from(onboardingProfiles.values())
            .filter((p) => p.userId === userId && p.step === 'buddy-guided-setup')
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setup = userSetups[0] || null;
    }

    if (!setup) {
        return res.status(404).json({ ok: false, error: "No buddy setup found — complete /buddy-setup first" });
    }

    setup.status = 'finalized';
    setup.finalizedAt = new Date().toISOString();
    onboardingProfiles.set(setup.setupId, setup);

    return res.json({
        ok: true,
        status: 'complete',
        setup,
        buddyWelcome: {
            greeting: `Welcome to Heady! 🎉`,
            message: `Your workspace is live with ${setup.contexts.length} contexts, ${setup.allConnectors.length} connectors, and ${setup.allFeatures.length} features. Everything runs on cloud HeadyBees — your device stays light and fast.`,
            quickStartActions: [
                { label: 'Open Dashboard', action: '/dashboard', icon: '📊' },
                { label: 'Chat with Buddy', action: '/buddy', icon: '🤖' },
                { label: 'Explore Connectors', action: '/connectors', icon: '🔌' },
                { label: 'View Memory', action: '/memory', icon: '🧠' },
            ],
        },
    });
});

module.exports = router;
