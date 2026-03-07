/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

const crypto = require("crypto");

const TEMPLATE_REGISTRY = [
    {
        id: "incident-response-sentinel",
        name: "Incident Response Sentinel",
        domains: ["ops", "security", "reliability"],
        triggers: ["error-spike", "latency-regression", "security-alert"],
        workflows: ["triage", "blast-radius-analysis", "rollback", "postmortem"],
        skills: ["root-cause-analysis", "budget-aware-routing", "vector-recall"],
        nodes: ["OBSERVER", "CONDUCTOR", "BATTLE"],
        swarmTasks: ["detect", "contain", "recover", "harden"],
        optimizationChannels: ["self-awareness", "healing", "constraint-analysis"],
        vectorZone: 5,
    },
    {
        id: "digital-presence-launchpad",
        name: "Digital Presence Launchpad",
        domains: ["marketing", "web", "seo"],
        triggers: ["new-campaign", "site-refresh", "content-gap"],
        workflows: ["content-plan", "landing-page-build", "schema-markup", "deploy"],
        skills: ["brand-voice", "conversion-optimization", "projection-publishing"],
        nodes: ["BUILDER", "ATLAS", "PATTERNS"],
        swarmTasks: ["research", "compose", "validate", "publish"],
        optimizationChannels: ["learning", "projection-sync"],
        vectorZone: 0,
    },
    {
        id: "autonomous-projection-keeper",
        name: "Autonomous Projection Keeper",
        domains: ["governance", "repos", "compliance"],
        triggers: ["registry-change", "release-cut", "policy-update"],
        workflows: ["diff", "projection-build", "signature", "sync-to-github"],
        skills: ["manifest-integrity", "repo-attestation", "drift-detection"],
        nodes: ["CONDUCTOR", "ATLAS", "BRANCH"],
        swarmTasks: ["scan", "compare", "project", "attest"],
        optimizationChannels: ["self-awareness", "optimization", "healing"],
        vectorZone: 7,
    },
    {
        id: "headyswarm-task-router",
        name: "HeadySwarm Task Router",
        domains: ["orchestration", "routing", "finops"],
        triggers: ["queue-pressure", "budget-threshold", "provider-failure"],
        workflows: ["budget-check", "candidate-ranking", "parallel-execution", "telemetry"],
        skills: ["provider-fallback", "cost-optimization", "latency-shaping"],
        nodes: ["CONDUCTOR", "ARENA", "JULES"],
        swarmTasks: ["rank", "route", "execute", "record"],
        optimizationChannels: ["learning", "optimization"],
        vectorZone: 5,
    },
    {
        id: "maintenance-pruner",
        name: "Maintenance Pruner",
        domains: ["maintenance", "cleanup", "infra"],
        triggers: ["stale-file-detected", "service-worker-drift", "tunnel-drift"],
        workflows: ["inventory", "classify", "prune", "confirm"],
        skills: ["stale-detection", "safe-delete-planning", "infra-hygiene"],
        nodes: ["OBSERVER", "ATLAS", "CONDUCTOR"],
        swarmTasks: ["scan", "score", "queue-cleanup", "verify"],
        optimizationChannels: ["healing", "optimization"],
        vectorZone: 7,
    },
    {
        id: "customer-lifecycle-orchestrator",
        name: "Customer Lifecycle Orchestrator",
        domains: ["crm", "support", "growth"],
        triggers: ["new-lead", "churn-risk", "upsell-window"],
        workflows: ["segment", "engage", "assist", "renew"],
        skills: ["intent-classification", "response-scripting", "handoff-automation"],
        nodes: ["PYTHIA", "JULES", "OBSERVER"],
        swarmTasks: ["classify", "respond", "escalate", "log"],
        optimizationChannels: ["learning", "self-awareness"],
        vectorZone: 3,
    },
];

const REQUIRED_SCENARIOS = [
    "incident-response",
    "digital-presence",
    "autonomous-projection",
    "maintenance-cleanup",
    "swarm-routing",
];

function tokenize(values = []) {
    return values.map((value) => String(value || "").toLowerCase().trim()).filter(Boolean);
}

function scoreTemplate(template, context) {
    const intents = tokenize(context.intents);
    const tags = tokenize(context.tags);
    const needs = tokenize(context.needs);
    const allSignals = new Set([...intents, ...tags, ...needs]);

    let score = 0;
    const matches = [];
    for (const token of allSignals) {
        if (template.domains.some((domain) => token.includes(domain) || domain.includes(token))) {
            score += 4;
            matches.push(`domain:${token}`);
        }
        if (template.triggers.some((trigger) => token.includes(trigger) || trigger.includes(token))) {
            score += 5;
            matches.push(`trigger:${token}`);
        }
        if (template.skills.some((skill) => token.includes(skill) || skill.includes(token))) {
            score += 3;
            matches.push(`skill:${token}`);
        }
    }

    if (context.preferredZone !== undefined && template.vectorZone === context.preferredZone) {
        score += 2;
        matches.push(`zone:${context.preferredZone}`);
    }

    return {
        templateId: template.id,
        score,
        matches,
        template,
    };
}

function recommendTemplates(context = {}, limit = 5) {
    const scored = TEMPLATE_REGISTRY.map((template) => scoreTemplate(template, context))
        .sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map((entry, rank) => ({
        rank: rank + 1,
        templateId: entry.templateId,
        score: entry.score,
        matches: entry.matches,
        name: entry.template.name,
        workflows: entry.template.workflows,
        skills: entry.template.skills,
        nodes: entry.template.nodes,
        swarmTasks: entry.template.swarmTasks,
        optimizationChannels: entry.template.optimizationChannels,
        vectorZone: entry.template.vectorZone,
    }));
}

function validateTemplateCoverage(templates = TEMPLATE_REGISTRY) {
    const keys = templates.map((template) => template.id).join("|");
    const contains = {
        "incident-response": /incident|sentinel/.test(keys),
        "digital-presence": /digital-presence|launchpad/.test(keys),
        "autonomous-projection": /projection/.test(keys),
        "maintenance-cleanup": /maintenance|pruner/.test(keys),
        "swarm-routing": /swarm|router/.test(keys),
    };

    const missing = REQUIRED_SCENARIOS.filter((scenario) => !contains[scenario]);
    return {
        valid: missing.length === 0,
        totalTemplates: templates.length,
        requiredScenarios: REQUIRED_SCENARIOS,
        missing,
        coverageScore: Number(((REQUIRED_SCENARIOS.length - missing.length) / REQUIRED_SCENARIOS.length).toFixed(2)),
    };
}

function buildGithubSourceOfTruthProjection(options = {}) {
    const now = new Date().toISOString();
    const repository = options.repository || "https://github.com/HeadySystems/Heady";
    const branch = options.branch || "main";
    const commitSha = options.commitSha || "unknown";
    const coverage = validateTemplateCoverage();
    const digest = crypto.createHash("sha256").update(JSON.stringify(TEMPLATE_REGISTRY)).digest("hex");

    return {
        version: 1,
        generatedAt: now,
        sourceOfTruth: {
            repository,
            branch,
            commitSha,
        },
        registryDigest: digest,
        coverage,
        channels: {
            selfAwareness: { status: "active", strategy: "continuous-feedback" },
            learning: { status: "active", strategy: "vector-ingestion-and-replay" },
            healing: { status: "active", strategy: "self-healing-pipeline-remediation" },
            optimization: { status: "active", strategy: "task-routing-and-template-downshift" },
        },
        templates: TEMPLATE_REGISTRY,
    };
}

function auditInfrastructureDrift(input = {}) {
    const serviceWorkers = Array.isArray(input.serviceWorkers) ? input.serviceWorkers : [];
    const tunnels = Array.isArray(input.tunnels) ? input.tunnels : [];
    const staleWorkers = serviceWorkers.filter((entry) => entry && entry.active === false);
    const staleTunnels = tunnels.filter((entry) => entry && entry.active === false);

    return {
        ok: true,
        actions: {
            removeServiceWorkers: staleWorkers.map((entry) => entry.id),
            removeTunnels: staleTunnels.map((entry) => entry.id),
        },
        counts: {
            staleServiceWorkers: staleWorkers.length,
            staleTunnels: staleTunnels.length,
        },
    };
}

module.exports = {
    TEMPLATE_REGISTRY,
    recommendTemplates,
    validateTemplateCoverage,
    buildGithubSourceOfTruthProjection,
    auditInfrastructureDrift,
};
