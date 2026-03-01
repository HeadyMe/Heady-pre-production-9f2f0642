/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * HeadyLiquid — Dynamic Component Allocation Engine
 *
 * Makes the entire Heady system "liquid": every component is dynamically
 * allocatable, exists in all sensible places, and is intelligently routed
 * to the best context for any given situation.
 *
 * Core Concepts:
 * - Component = a capability (not a fixed service)
 * - Presence  = where a component is currently available
 * - Context   = what the system is trying to accomplish right now
 * - Affinity  = how well a component fits a given context
 * - Flow      = the dynamic routing decision for each request
 */
const EventEmitter = require("events");
const fs = require("fs");
const path = require("path");
const logger = require("./utils/logger");

const LIQUID_STATE_PATH = path.join(__dirname, "..", "data", "liquid-state.json");

// ─── Component Capability Definitions ────────────────────────────────
// Each component defines WHAT IT CAN DO + WHERE it runs (provider topology).
// Provider topology maps each component to the optimal service/platform.
const COMPONENT_REGISTRY = {
    "brain": {
        capabilities: ["inference", "reasoning", "decision-making", "model-override"],
        contexts: ["api-request", "orchestration", "user-chat", "system-eval", "canvas-design"],
        weight: 10,
        minInstances: 1,
        maxInstances: 4,
        stateless: true,
        providers: {
            primary: { service: "groq", model: "llama-3.1-70b-versatile", cost: "free", latency: "100ms" },
            secondary: { service: "hf-biz", model: "Llama-3.1-70B-Instruct", cost: "biz-seat", latency: "500ms" },
            tertiary: { service: "gemini", model: "gemini-2.0-flash", cost: "gcloud", latency: "300ms" },
            quality: { service: "claude", model: "claude-sonnet-4-20250514", cost: "$60-api", latency: "800ms" },
            fallback: { service: "openai-biz", model: "gpt-4o", cost: "biz-seat", latency: "600ms" },
        },
        providerPriority: ["groq", "hf-biz", "gemini", "openai-biz", "claude"],
    },
    "soul": {
        capabilities: ["reflection", "introspection", "quality-eval", "depth-analysis"],
        contexts: ["post-inference", "self-critique", "system-eval", "deep-scan"],
        weight: 8,
        minInstances: 1,
        maxInstances: 2,
        stateless: true,
        providers: {
            primary: { service: "claude", model: "claude-sonnet-4-20250514", cost: "$60-api", latency: "800ms" },
            secondary: { service: "perplexity", model: "sonar-pro", cost: "api-key", latency: "500ms" },
            fallback: { service: "gemini", model: "gemini-1.5-pro", cost: "gcloud", latency: "600ms" },
        },
        providerPriority: ["claude", "perplexity", "gemini"],
    },
    "conductor": {
        capabilities: ["orchestration", "health-polling", "decision-routing", "macro-view"],
        contexts: ["system-startup", "health-check", "orchestration", "scaling-decision"],
        weight: 9,
        minInstances: 1,
        maxInstances: 1,
        stateless: false,
        providers: {
            primary: { service: "gcloud-run", platform: "Cloud Run", cost: "gcloud-$530", latency: "50ms" },
            edge: { service: "cloudflare", platform: "Workers/Edge", cost: "free", latency: "10ms" },
        },
        providerPriority: ["gcloud-run", "cloudflare"],
    },
    "battle": {
        capabilities: ["multi-model-competition", "solution-ranking", "quality-comparison"],
        contexts: ["high-stakes-decision", "model-evaluation", "creative-contest"],
        weight: 6,
        minInstances: 0,
        maxInstances: 3,
        stateless: true,
        providers: {
            // Battle intentionally uses ALL providers for diversity
            racer_a: { service: "claude", model: "claude-sonnet-4-20250514", cost: "$60-api" },
            racer_b: { service: "gemini", model: "gemini-2.0-flash", cost: "gcloud" },
            racer_c: { service: "openai-biz", model: "gpt-4o", cost: "biz-seat" },
            judge: { service: "groq", model: "llama-3.1-70b-versatile", cost: "free" },
        },
        providerPriority: ["claude", "gemini", "openai-biz", "groq"],
    },
    "vinci": {
        capabilities: ["creative-learning", "prediction", "pattern-recognition", "design-assist"],
        contexts: ["canvas-design", "creative-task", "pattern-analysis", "user-preference-learning"],
        weight: 7,
        minInstances: 1,
        maxInstances: 3,
        stateless: false,
        providers: {
            primary: { service: "hf-biz", model: "stabilityai/sdxl", cost: "biz-seat", latency: "2s" },
            inference: { service: "hf-biz", model: "Llama-3.1-70B-Instruct", cost: "biz-seat", latency: "500ms" },
            secondary: { service: "ai-studio", model: "gemini-2.0-flash", cost: "free", latency: "300ms" },
            fallback: { service: "vertex-ai", model: "gemini-1.5-pro", cost: "gcloud", latency: "600ms" },
        },
        providerPriority: ["hf-biz", "ai-studio", "vertex-ai"],
    },
    "patterns": {
        capabilities: ["circuit-breaking", "pool-management", "cache-control", "resilience"],
        contexts: ["every-request", "system-protection", "performance-optimization"],
        weight: 10,
        minInstances: 1,
        maxInstances: 1,
        stateless: false,
        alwaysPresent: true,
        providers: {
            primary: { service: "cloudflare", platform: "Workers KV", cost: "free", latency: "5ms" },
            secondary: { service: "gcloud-run", platform: "Cloud Run", cost: "gcloud", latency: "50ms" },
        },
        providerPriority: ["cloudflare", "gcloud-run"],
    },
    "lens": {
        capabilities: ["differential-tracking", "micro-change-detection", "perspective-comparison"],
        contexts: ["code-review", "config-change", "drift-detection"],
        weight: 5,
        minInstances: 0,
        maxInstances: 2,
        stateless: true,
        providers: {
            primary: { service: "github-ent", platform: "GitHub Enterprise", cost: "biz-seat", latency: "200ms" },
            secondary: { service: "groq", model: "llama-3.1-8b-instant", cost: "free", latency: "50ms" },
        },
        providerPriority: ["github-ent", "groq"],
    },
    "notion": {
        capabilities: ["knowledge-management", "documentation", "context-synthesis"],
        contexts: ["knowledge-query", "documentation-gen", "context-building"],
        weight: 6,
        minInstances: 0,
        maxInstances: 2,
        stateless: false,
        providers: {
            primary: { service: "hf-biz", platform: "HF Datasets", cost: "biz-seat", latency: "200ms" },
            inference: { service: "hf-biz", model: "Llama-3.1-70B-Instruct", cost: "biz-seat", latency: "500ms" },
            research: { service: "perplexity", model: "sonar-pro", cost: "api-key", latency: "500ms" },
            fallback: { service: "gemini", model: "gemini-2.0-flash", cost: "gcloud", latency: "300ms" },
        },
        providerPriority: ["hf-biz", "perplexity", "gemini"],
    },
    "ops": {
        capabilities: ["operations", "deployment", "infrastructure-management"],
        contexts: ["deployment", "infrastructure-change", "monitoring"],
        weight: 7,
        minInstances: 1,
        maxInstances: 2,
        stateless: true,
        providers: {
            primary: { service: "gcloud-run", platform: "Cloud Run", cost: "gcloud-$530", latency: "100ms" },
            ci: { service: "github-ent", platform: "GitHub Actions", cost: "biz-seat", latency: "30s" },
            edge: { service: "cloudflare", platform: "Pages/Workers", cost: "free", latency: "10ms" },
        },
        providerPriority: ["gcloud-run", "github-ent", "cloudflare"],
    },
    "maintenance": {
        capabilities: ["cleanup", "rotation", "compaction", "housekeeping"],
        contexts: ["scheduled-maintenance", "resource-pressure", "storage-management"],
        weight: 5,
        minInstances: 1,
        maxInstances: 1,
        stateless: true,
        providers: {
            primary: { service: "hf-biz", platform: "HF Spaces", cost: "biz-seat", latency: "batch" },
            secondary: { service: "colab", platform: "Google Colab", cost: "free", latency: "batch" },
            fallback: { service: "gcloud-run", platform: "Cloud Run Jobs", cost: "gcloud", latency: "5min" },
        },
        providerPriority: ["hf-biz", "colab", "gcloud-run"],
    },
    "auto-success": {
        capabilities: ["background-optimization", "continuous-improvement", "task-cycling"],
        contexts: ["background", "idle-time", "continuous-improvement"],
        weight: 8,
        minInstances: 1,
        maxInstances: 1,
        stateless: false,
        alwaysPresent: true,
        providers: {
            primary: { service: "hf-biz", model: "Llama-3.1-70B-Instruct", cost: "biz-seat", latency: "500ms" },
            speed: { service: "groq", model: "llama-3.1-70b-versatile", cost: "free", latency: "100ms" },
            reasoning: { service: "claude", model: "claude-3-haiku-20240307", cost: "$60-api", latency: "300ms" },
        },
        providerPriority: ["hf-biz", "groq", "claude"],
    },
    "stream": {
        capabilities: ["real-time-delivery", "text-streaming", "live-updates"],
        contexts: ["user-facing", "canvas-update", "live-edit", "broadcast"],
        weight: 6,
        minInstances: 1,
        maxInstances: 1,
        stateless: true,
        alwaysPresent: true,
        providers: {
            primary: { service: "cloudflare", platform: "Workers SSE", cost: "free", latency: "5ms" },
            origin: { service: "gcloud-run", platform: "Cloud Run", cost: "gcloud", latency: "50ms" },
        },
        providerPriority: ["cloudflare", "gcloud-run"],
    },
    "buddy": {
        capabilities: ["browser-extension", "user-assist", "guest-mode", "quick-access"],
        contexts: ["browser-context", "user-assist", "quick-lookup"],
        weight: 5,
        minInstances: 0,
        maxInstances: 1,
        stateless: true,
        providers: {
            primary: { service: "groq", model: "llama-3.1-8b-instant", cost: "free", latency: "50ms" },
            inference: { service: "hf-biz", model: "Llama-3.1-8B-Instruct", cost: "biz-seat", latency: "200ms" },
            research: { service: "perplexity", model: "sonar", cost: "api-key", latency: "500ms" },
            fallback: { service: "ai-studio", model: "gemini-2.0-flash", cost: "free", latency: "300ms" },
        },
        providerPriority: ["groq", "hf-biz", "perplexity", "ai-studio"],
    },
    "cloud": {
        capabilities: ["external-connectivity", "provider-management", "domain-routing"],
        contexts: ["cloud-operation", "domain-management", "external-api"],
        weight: 7,
        minInstances: 1,
        maxInstances: 1,
        stateless: true,
        alwaysPresent: true,
        providers: {
            edge: { service: "cloudflare", platform: "Edge Proxy", cost: "free", latency: "5ms" },
            origin: { service: "gcloud-run", platform: "Cloud Run", cost: "gcloud-$530", latency: "50ms" },
            storage: { service: "gcloud", platform: "Cloud Storage (2)", cost: "gcloud", latency: "100ms" },
            ci: { service: "github-ent", platform: "GitHub Actions", cost: "biz-seat", latency: "30s" },
        },
        providerPriority: ["cloudflare", "gcloud-run", "gcloud", "github-ent"],
    },
};

// ─── Distributed Storage Topology ────────────────────────────────────
// Maps data types to optimal storage providers across HF, GCloud, Cloudflare, GitHub.
// Each entry defines primary, replica, and cache layers for redundancy + speed.
const STORAGE_TOPOLOGY = {
    "models": {
        description: "ML models, fine-tuned weights, LoRAs",
        primary: { service: "hf-biz", platform: "HF Model Hub", cost: "biz-seat", latency: "200ms" },
        replica: { service: "gcloud", platform: "Cloud Storage", cost: "gcloud-$530", latency: "100ms" },
        cache: { service: "cloudflare", platform: "R2 Storage", cost: "free", latency: "20ms" },
        priority: ["hf-biz", "gcloud", "cloudflare"],
    },
    "datasets": {
        description: "Training data, embeddings, vector DBs",
        primary: { service: "hf-biz", platform: "HF Datasets", cost: "biz-seat", latency: "200ms" },
        replica: { service: "gcloud", platform: "Cloud Storage", cost: "gcloud", latency: "100ms" },
        cache: { service: "cloudflare", platform: "R2 Storage", cost: "free", latency: "20ms" },
        priority: ["hf-biz", "gcloud", "cloudflare"],
    },
    "code": {
        description: "Source code, configs, infra-as-code, CI/CD",
        primary: { service: "github-ent", platform: "GitHub Enterprise", cost: "biz-seat", latency: "100ms" },
        replica: { service: "gcloud", platform: "Cloud Source Repos", cost: "gcloud", latency: "200ms" },
        mirror: { service: "hf-biz", platform: "HF Spaces (deploy)", cost: "biz-seat", latency: "500ms" },
        priority: ["github-ent", "gcloud", "hf-biz"],
    },
    "static-assets": {
        description: "Images, fonts, CSS, JS bundles, public files",
        primary: { service: "cloudflare", platform: "Pages / R2", cost: "free", latency: "5ms" },
        replica: { service: "gcloud", platform: "Cloud Storage", cost: "gcloud", latency: "100ms" },
        origin: { service: "github-ent", platform: "GitHub Pages", cost: "biz-seat", latency: "200ms" },
        priority: ["cloudflare", "gcloud", "github-ent"],
    },
    "edge-cache": {
        description: "KV pairs, session state, config, feature flags",
        primary: { service: "cloudflare", platform: "Workers KV", cost: "free", latency: "5ms" },
        replica: { service: "gcloud", platform: "Memorystore / Redis", cost: "gcloud", latency: "50ms" },
        priority: ["cloudflare", "gcloud"],
    },
    "logs-telemetry": {
        description: "Audit logs, traces, metrics, observability data",
        primary: { service: "gcloud", platform: "Cloud Logging / BigQuery", cost: "gcloud-$530", latency: "200ms" },
        replica: { service: "hf-biz", platform: "HF Datasets (archive)", cost: "biz-seat", latency: "batch" },
        priority: ["gcloud", "hf-biz"],
    },
    "secrets": {
        description: "API keys, tokens, certificates, env vars",
        primary: { service: "gcloud", platform: "Secret Manager", cost: "gcloud", latency: "50ms" },
        replica: { service: "cloudflare", platform: "Workers Secrets", cost: "free", latency: "5ms" },
        priority: ["gcloud", "cloudflare"],
    },
    "user-content": {
        description: "User-generated files, uploads, avatars",
        primary: { service: "cloudflare", platform: "R2 Storage", cost: "free", latency: "20ms" },
        replica: { service: "gcloud", platform: "Cloud Storage", cost: "gcloud", latency: "100ms" },
        priority: ["cloudflare", "gcloud"],
    },
    "vector-memory": {
        description: "Episodic/semantic/procedural memory vectors (3D storage)",
        primary: { service: "gcloud", platform: "Cloud SQL (pgvector)", cost: "gcloud-$530", latency: "50ms" },
        replica: { service: "hf-biz", platform: "HF Datasets (export)", cost: "biz-seat", latency: "batch" },
        cache: { service: "cloudflare", platform: "Workers KV (hot)", cost: "free", latency: "5ms" },
        priority: ["gcloud", "hf-biz", "cloudflare"],
    },
    "notebooks": {
        description: "Jupyter notebooks, experiments, research",
        primary: { service: "hf-biz", platform: "HF Spaces", cost: "biz-seat", latency: "1s" },
        replica: { service: "gcloud", platform: "Colab / Vertex Workbench", cost: "free", latency: "2s" },
        backup: { service: "github-ent", platform: "GitHub Repos", cost: "biz-seat", latency: "200ms" },
        priority: ["hf-biz", "gcloud", "github-ent"],
    },
};

// ─── HF Spaces — Distributed Liquid Nodes ────────────────────────────
// Each HF Space is a Liquid node with multiple primary providers.
// They share the buddy-widget.js and cross-link, but each specializes.
const HF_SPACES_TOPOLOGY = {
    "main": {
        slug: "HeadyMe/heady-ai-brain",
        title: "Heady AI — Brain Demo",
        role: "Full-stack demo hub — live chat, code editor, gateway dashboard",
        providers: {
            chat: { service: "hf-biz", model: "Qwen/Qwen3-235B-A22B", cost: "biz-seat", latency: "800ms" },
            code: { service: "hf-biz", model: "Llama-3.1-70B-Instruct", cost: "biz-seat", latency: "500ms" },
            speed: { service: "groq", model: "llama-3.1-70b-versatile", cost: "free", latency: "100ms" },
            reasoning: { service: "gemini", model: "gemini-2.0-flash", cost: "gcloud", latency: "300ms" },
            quality: { service: "claude", model: "claude-sonnet-4-20250514", cost: "$60-api", latency: "800ms" },
        },
        providerPriority: ["hf-biz", "groq", "gemini", "claude"],
        storage: ["models", "datasets", "notebooks"],
        components: ["brain", "battle", "stream", "buddy"],
        sharedAssets: ["shared/buddy-widget.js", "shared/icon.png", "shared/logo.png"],
    },
    "connection": {
        slug: "HeadyMe/heady-connection",
        title: "HeadyConnection — AI for Nonprofit Impact",
        role: "Nonprofit AI — grant writing, impact dashboards, volunteer matching",
        providers: {
            grants: { service: "hf-biz", model: "Llama-3.1-70B-Instruct", cost: "biz-seat", latency: "500ms" },
            impact: { service: "gemini", model: "gemini-2.0-flash", cost: "gcloud", latency: "300ms" },
            research: { service: "perplexity", model: "sonar-pro", cost: "api-key", latency: "500ms" },
            speed: { service: "groq", model: "llama-3.1-8b-instant", cost: "free", latency: "50ms" },
        },
        providerPriority: ["hf-biz", "gemini", "perplexity", "groq"],
        storage: ["datasets", "user-content"],
        components: ["notion", "vinci", "buddy"],
        sharedAssets: ["shared/buddy-widget.js", "shared/icon.png", "shared/logo.png"],
    },
    "systems": {
        slug: "HeadyMe/heady-systems",
        title: "HeadySystems — Platform Operations Intelligence",
        role: "Ops intelligence — self-healing infra, monitoring, drift detection",
        providers: {
            ops: { service: "hf-biz", model: "Llama-3.1-70B-Instruct", cost: "biz-seat", latency: "500ms" },
            monitor: { service: "groq", model: "llama-3.1-8b-instant", cost: "free", latency: "50ms" },
            analysis: { service: "gemini", model: "gemini-2.0-flash", cost: "gcloud", latency: "300ms" },
            deep: { service: "claude", model: "claude-3-haiku-20240307", cost: "$60-api", latency: "300ms" },
        },
        providerPriority: ["hf-biz", "groq", "gemini", "claude"],
        storage: ["logs-telemetry", "edge-cache", "code"],
        components: ["ops", "conductor", "patterns", "lens", "auto-success"],
        sharedAssets: ["shared/buddy-widget.js", "shared/icon.png", "shared/logo.png"],
    },
};

// ─── Context Analyzer ────────────────────────────────────────────────
// Analyzes incoming requests/situations and produces a context vector.
function analyzeContext(request = {}) {
    const context = {
        type: request.type || "unknown",
        urgency: request.urgency || "normal",      // low, normal, high, critical
        domain: request.domain || "system",         // which Heady domain
        userFacing: request.userFacing !== false,
        requiresCreativity: request.creative || false,
        requiresSpeed: request.speed || false,
        requiresDepth: request.depth || false,
        requiresResilience: true,                   // always true in liquid mode
        resourcePressure: request.resourcePressure || "normal",
        tags: request.tags || [],
    };

    // Derive context labels from analysis
    context.labels = [];
    if (context.userFacing) context.labels.push("user-facing");
    if (context.requiresCreativity) context.labels.push("creative-task", "canvas-design");
    if (context.requiresSpeed) context.labels.push("api-request");
    if (context.requiresDepth) context.labels.push("deep-scan", "self-critique");
    if (context.urgency === "critical") context.labels.push("high-stakes-decision");
    if (context.type === "chat") context.labels.push("user-chat");
    if (context.type === "orchestration") context.labels.push("orchestration");
    if (context.type === "background") context.labels.push("background", "continuous-improvement");
    context.labels.push("every-request");

    return context;
}

// ─── Affinity Calculator ─────────────────────────────────────────────
// Scores how well a component fits a given context (0.0 - 1.0).
function calculateAffinity(componentId, context) {
    const comp = COMPONENT_REGISTRY[componentId];
    if (!comp) return 0;

    let score = 0;
    let factors = 0;

    // Context match (how many of the component's contexts overlap with the request)
    const contextOverlap = comp.contexts.filter(c => context.labels.includes(c)).length;
    const contextScore = comp.contexts.length > 0 ? contextOverlap / comp.contexts.length : 0;
    score += contextScore * 3;
    factors += 3;

    // Capability relevance based on tags
    const capOverlap = comp.capabilities.filter(cap =>
        context.tags.some(tag => cap.includes(tag) || tag.includes(cap))
    ).length;
    if (context.tags.length > 0) {
        score += (capOverlap / context.tags.length) * 2;
        factors += 2;
    }

    // Weight bonus (higher weight components are preferred)
    score += (comp.weight / 10) * 1;
    factors += 1;

    // Always-present components get a baseline
    if (comp.alwaysPresent) {
        score += 0.5;
        factors += 1;
    }

    // Penalize if resource pressure is high and component is heavy
    if (context.resourcePressure === "high" && comp.maxInstances > 2) {
        score -= 0.3;
    }

    return Math.max(0, Math.min(1, score / factors));
}

// ─── Liquid Allocator ────────────────────────────────────────────────
class LiquidAllocator extends EventEmitter {
    constructor() {
        super();
        this.allocations = new Map();    // componentId -> { instances, presences }
        this.flowLog = [];               // recent allocation decisions
        this.totalFlows = 0;
        this.contextCache = new Map();

        // Initialize all components with their minimum presence
        for (const [id, comp] of Object.entries(COMPONENT_REGISTRY)) {
            this.allocations.set(id, {
                activeInstances: comp.minInstances,
                maxInstances: comp.maxInstances,
                presences: this._derivePresences(id, comp),
                lastAllocatedAt: null,
                allocationCount: 0,
                avgAffinity: 0,
            });
        }
    }

    // Determine where a component should be present
    _derivePresences(id, comp) {
        const presences = ["local"]; // always present locally

        // Determine cloud/edge/extension presence based on capabilities
        if (comp.capabilities.some(c => ["external-connectivity", "domain-routing"].includes(c))) {
            presences.push("cloudflare-edge", "tunnel");
        }
        if (comp.capabilities.some(c => ["browser-extension", "quick-access"].includes(c))) {
            presences.push("extension", "browser");
        }
        if (comp.capabilities.some(c => ["real-time-delivery", "live-updates"].includes(c))) {
            presences.push("sse-channel", "websocket");
        }
        if (comp.capabilities.some(c => ["background-optimization", "continuous-improvement"].includes(c))) {
            presences.push("background-worker", "timer");
        }
        if (comp.capabilities.some(c => ["creative-learning", "design-assist"].includes(c))) {
            presences.push("canvas", "creative-sandbox");
        }
        if (comp.capabilities.some(c => ["inference", "reasoning"].includes(c))) {
            presences.push("api-gateway", "mcp-bridge", "canvas");
        }
        if (comp.alwaysPresent) {
            presences.push("system-wide");
        }

        return [...new Set(presences)];
    }

    // Core: Allocate the best components for a given context
    allocate(request = {}) {
        const context = analyzeContext(request);
        const scored = [];

        for (const [id] of Object.entries(COMPONENT_REGISTRY)) {
            const affinity = calculateAffinity(id, context);
            if (affinity > 0.15) {
                scored.push({ id, affinity });
            }
        }

        // Sort by affinity descending
        scored.sort((a, b) => b.affinity - a.affinity);

        // Select top components (at most 6 per allocation for efficiency)
        const allocated = scored.slice(0, 6).map(s => {
            const alloc = this.allocations.get(s.id);
            alloc.lastAllocatedAt = new Date().toISOString();
            alloc.allocationCount++;
            alloc.avgAffinity = (alloc.avgAffinity * (alloc.allocationCount - 1) + s.affinity) / alloc.allocationCount;
            return {
                component: s.id,
                affinity: Math.round(s.affinity * 100) / 100,
                presences: alloc.presences,
                role: COMPONENT_REGISTRY[s.id].capabilities[0],
            };
        });

        const flow = {
            id: `flow-${++this.totalFlows}`,
            context: { type: context.type, urgency: context.urgency, labels: context.labels },
            allocated,
            ts: new Date().toISOString(),
        };

        this.flowLog.push(flow);
        if (this.flowLog.length > 500) this.flowLog.splice(0, this.flowLog.length - 500);

        this.emit("flow:allocated", flow);
        return flow;
    }

    // Get system-wide allocation state
    getState() {
        const state = {};
        for (const [id, alloc] of this.allocations) {
            state[id] = {
                ...alloc,
                capabilities: COMPONENT_REGISTRY[id].capabilities,
                weight: COMPONENT_REGISTRY[id].weight,
                alwaysPresent: COMPONENT_REGISTRY[id].alwaysPresent || false,
            };
        }
        return state;
    }

    // Get recent flow decisions
    getFlows(limit = 20) {
        return this.flowLog.slice(-limit);
    }

    // Persist liquid state to disk
    persist() {
        try {
            const dir = path.dirname(LIQUID_STATE_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(LIQUID_STATE_PATH, JSON.stringify({
                allocations: Object.fromEntries(this.allocations),
                totalFlows: this.totalFlows,
                ts: new Date().toISOString(),
            }, null, 2));
        } catch { /* non-critical */ }
    }
}

// ─── Express Routes ──────────────────────────────────────────────────
function registerLiquidRoutes(app, allocator) {

    app.get("/api/liquid/health", (req, res) => {
        res.json({
            status: "ACTIVE",
            service: "heady-liquid",
            mode: "dynamic-allocation",
            components: Object.keys(COMPONENT_REGISTRY).length,
            totalFlows: allocator.totalFlows,
            ts: new Date().toISOString(),
        });
    });

    // Allocate components for a context
    app.post("/api/liquid/allocate", (req, res) => {
        const flow = allocator.allocate(req.body);
        res.json({ ok: true, flow });
    });

    // Get full system allocation state
    app.get("/api/liquid/state", (req, res) => {
        res.json({ ok: true, state: allocator.getState() });
    });

    // Get recent flow decisions
    app.get("/api/liquid/flows", (req, res) => {
        const limit = parseInt(req.query.limit) || 20;
        res.json({ ok: true, flows: allocator.getFlows(limit), totalFlows: allocator.totalFlows });
    });

    // Query: what components would handle this context?
    app.post("/api/liquid/query", (req, res) => {
        const context = analyzeContext(req.body);
        const scores = [];
        for (const [id] of Object.entries(COMPONENT_REGISTRY)) {
            const affinity = calculateAffinity(id, context);
            const alloc = allocator.allocations.get(id);
            scores.push({
                component: id,
                affinity: Math.round(affinity * 100) / 100,
                presences: alloc.presences,
                capabilities: COMPONENT_REGISTRY[id].capabilities,
                wouldAllocate: affinity > 0.15,
            });
        }
        scores.sort((a, b) => b.affinity - a.affinity);
        res.json({ ok: true, context, scores });
    });

    // Component catalog
    app.get("/api/liquid/components", (req, res) => {
        const comps = {};
        for (const [id, comp] of Object.entries(COMPONENT_REGISTRY)) {
            const alloc = allocator.allocations.get(id);
            comps[id] = {
                capabilities: comp.capabilities,
                contexts: comp.contexts,
                weight: comp.weight,
                alwaysPresent: comp.alwaysPresent || false,
                presences: alloc.presences,
                allocationCount: alloc.allocationCount,
                avgAffinity: Math.round((alloc.avgAffinity || 0) * 100) / 100,
            };
        }
        res.json({ ok: true, components: comps });
    });
    // Storage topology — where data lives
    app.get("/api/liquid/storage", (req, res) => {
        res.json({ ok: true, storage: STORAGE_TOPOLOGY });
    });
    // HF Spaces topology — distributed nodes
    app.get("/api/liquid/spaces", (req, res) => {
        res.json({ ok: true, spaces: HF_SPACES_TOPOLOGY });
    });

    logger.logSystem("  💧 HeadyLiquid: LOADED (dynamic allocation, context-aware routing)");
    logger.logSystem("    → Endpoints: /api/liquid/health, /allocate, /state, /flows, /query, /components, /storage, /spaces");
}

module.exports = { LiquidAllocator, registerLiquidRoutes, analyzeContext, calculateAffinity, COMPONENT_REGISTRY, STORAGE_TOPOLOGY, HF_SPACES_TOPOLOGY };
