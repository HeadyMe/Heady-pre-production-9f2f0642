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

const LIQUID_STATE_PATH = path.join(__dirname, "..", "data", "liquid-state.json");

// ─── Component Capability Definitions ────────────────────────────────
// Each component is defined by WHAT IT CAN DO, not WHERE it lives.
const COMPONENT_REGISTRY = {
    "brain": {
        capabilities: ["inference", "reasoning", "decision-making", "model-override"],
        contexts: ["api-request", "orchestration", "user-chat", "system-eval", "canvas-design"],
        weight: 10, // importance weight for allocation priority
        minInstances: 1,
        maxInstances: 4,
        stateless: true,
    },
    "soul": {
        capabilities: ["reflection", "introspection", "quality-eval", "depth-analysis"],
        contexts: ["post-inference", "self-critique", "system-eval", "deep-scan"],
        weight: 8,
        minInstances: 1,
        maxInstances: 2,
        stateless: true,
    },
    "conductor": {
        capabilities: ["orchestration", "health-polling", "decision-routing", "macro-view"],
        contexts: ["system-startup", "health-check", "orchestration", "scaling-decision"],
        weight: 9,
        minInstances: 1,
        maxInstances: 1,
        stateless: false,
    },
    "battle": {
        capabilities: ["multi-model-competition", "solution-ranking", "quality-comparison"],
        contexts: ["high-stakes-decision", "model-evaluation", "creative-contest"],
        weight: 6,
        minInstances: 0,
        maxInstances: 3,
        stateless: true,
    },
    "vinci": {
        capabilities: ["creative-learning", "prediction", "pattern-recognition", "design-assist"],
        contexts: ["canvas-design", "creative-task", "pattern-analysis", "user-preference-learning"],
        weight: 7,
        minInstances: 1,
        maxInstances: 3,
        stateless: false,
    },
    "patterns": {
        capabilities: ["circuit-breaking", "pool-management", "cache-control", "resilience"],
        contexts: ["every-request", "system-protection", "performance-optimization"],
        weight: 10,
        minInstances: 1,
        maxInstances: 1,
        stateless: false,
        alwaysPresent: true,
    },
    "lens": {
        capabilities: ["differential-tracking", "micro-change-detection", "perspective-comparison"],
        contexts: ["code-review", "config-change", "drift-detection"],
        weight: 5,
        minInstances: 0,
        maxInstances: 2,
        stateless: true,
    },
    "notion": {
        capabilities: ["knowledge-management", "documentation", "context-synthesis"],
        contexts: ["knowledge-query", "documentation-gen", "context-building"],
        weight: 6,
        minInstances: 0,
        maxInstances: 2,
        stateless: false,
    },
    "ops": {
        capabilities: ["operations", "deployment", "infrastructure-management"],
        contexts: ["deployment", "infrastructure-change", "monitoring"],
        weight: 7,
        minInstances: 1,
        maxInstances: 2,
        stateless: true,
    },
    "maintenance": {
        capabilities: ["cleanup", "rotation", "compaction", "housekeeping"],
        contexts: ["scheduled-maintenance", "resource-pressure", "storage-management"],
        weight: 5,
        minInstances: 1,
        maxInstances: 1,
        stateless: true,
    },
    "auto-success": {
        capabilities: ["background-optimization", "continuous-improvement", "task-cycling"],
        contexts: ["background", "idle-time", "continuous-improvement"],
        weight: 8,
        minInstances: 1,
        maxInstances: 1,
        stateless: false,
        alwaysPresent: true,
    },
    "stream": {
        capabilities: ["real-time-delivery", "text-streaming", "live-updates"],
        contexts: ["user-facing", "canvas-update", "live-edit", "broadcast"],
        weight: 6,
        minInstances: 1,
        maxInstances: 1,
        stateless: true,
        alwaysPresent: true,
    },
    "buddy": {
        capabilities: ["browser-extension", "user-assist", "guest-mode", "quick-access"],
        contexts: ["browser-context", "user-assist", "quick-lookup"],
        weight: 5,
        minInstances: 0,
        maxInstances: 1,
        stateless: true,
    },
    "cloud": {
        capabilities: ["external-connectivity", "provider-management", "domain-routing"],
        contexts: ["cloud-operation", "domain-management", "external-api"],
        weight: 7,
        minInstances: 1,
        maxInstances: 1,
        stateless: true,
        alwaysPresent: true,
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

    console.log("  💧 HeadyLiquid: LOADED (dynamic allocation, context-aware routing)");
    console.log("    → Endpoints: /api/liquid/health, /allocate, /state, /flows, /query, /components");
}

module.exports = { LiquidAllocator, registerLiquidRoutes, analyzeContext, calculateAffinity, COMPONENT_REGISTRY };
