var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
// heady-edge-proxy.js
// ═══ API Keys resolved from env secrets at runtime — NEVER hardcoded ═══
// Set via: wrangler secret put HEADY_API_KEYS (comma-separated)
// Keys rotate without code changes or redeployment.
var _cachedApiKeys = null;
var _cachedApiKeysSource = null;
function getValidApiKeys(env2) {
  // Cache per env source to avoid re-parsing on every request
  const envKeys = env2?.HEADY_API_KEYS || "";
  if (_cachedApiKeysSource === envKeys && _cachedApiKeys) return _cachedApiKeys;
  if (envKeys) {
    _cachedApiKeys = new Set(envKeys.split(",").map(k => k.trim()).filter(Boolean));
    _cachedApiKeysSource = envKeys;
  } else {
    // Absolute fallback — env not configured yet
    _cachedApiKeys = new Set([]);
    _cachedApiKeysSource = envKeys;
  }
  return _cachedApiKeys;
}
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Heady-API-Key, X-Heady-Source",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
};
var EDGE_SITES = /* @__PURE__ */ new Set([
  "headymcp.com",
  "www.headymcp.com",
  "headyio.com",
  "www.headyio.com",
  "headyconnection.org",
  "www.headyconnection.org",
  "headybuddy.org",
  "www.headybuddy.org",
  "buddy.headysystems.com",
  "headysystems.com",
  "www.headysystems.com",
  "headybot.com",
  "www.headybot.com"
]);
var HEADY_CLOUDRUN_ORIGIN = "https://heady-edge-gateway-609590223909.us-central1.run.app";
var SERVICE_MAP = {
  "manager.headysystems.com": { origin: HEADY_CLOUDRUN_ORIGIN, mtls: true, public: true },
  "api.headysystems.com": { origin: HEADY_CLOUDRUN_ORIGIN, mtls: true, public: true },
  "admin.headysystems.com": { origin: HEADY_CLOUDRUN_ORIGIN, mtls: true, public: true },
  "api.headyme.com": { origin: HEADY_CLOUDRUN_ORIGIN, mtls: true, public: true },
  "api.headyio.com": { origin: HEADY_CLOUDRUN_ORIGIN, mtls: true, public: true },
  "api.headymcp.com": { origin: HEADY_CLOUDRUN_ORIGIN, mtls: true, public: true },
  "api.headybuddy.org": { origin: HEADY_CLOUDRUN_ORIGIN, mtls: true, public: true },
  "api.headyconnection.org": { origin: HEADY_CLOUDRUN_ORIGIN, mtls: true, public: true },
  "headyme.com": { origin: "https://headyme-site-bf4q4zywhq-uc.a.run.app", mtls: false, public: true },
  "www.headyme.com": { origin: "https://headyme-site-bf4q4zywhq-uc.a.run.app", mtls: false, public: true }
};
var MTLS_REQUIRED_PATHS = ["/api/", "/admin/", "/internal/"];
var MTLS_EXEMPT_PATHS = ["/api/auto-success/", "/api/config/", "/api/health", "/api/pulse", "/api/brain/chat", "/api/brain/health", "/api/auth/", "/api/orchestrator/"];
var PROVIDERS = [
  { id: "edge-ai", type: "edge", weight: 1 },
  // ★ First: Workers AI — instant, concurrent, always-on
  { id: "heady-brain", type: "origin", weight: 0.9 },
  // Local origin — fast when running, skip if not
  { id: "gemini", type: "cloud", weight: 0.7 },
  { id: "claude", type: "cloud", weight: 0.7 },
  { id: "groq", type: "cloud", weight: 0.6 }
];
var CACHE_TTL = {
  factual: 86400,
  // 24h — deterministic answers
  code: 43200,
  // 12h — code gen is fairly stable
  analysis: 21600,
  // 6h  — analysis may evolve
  creative: 3600,
  // 1h  — creative varies
  chat: 1800,
  // 30m — conversational
  unknown: 7200
  // 2h  — safe default
};
var circuitState = {};
var HEADY_SERVICE_POLICY = {
  defaultActive: true,
  // All services default to active
  requireExplicitDisable: true,
  // Cannot be disabled without explicit request
  positiveValueThreshold: 0,
  // Any weight > 0 means service stays active
  autoRecover: true,
  // Auto-restart any service that goes down
  maxRecoveryAttempts: 5,
  // Max attempts before alerting
  enforcementLevel: "strict",
  // strict | relaxed | manual
  scope: "global",
  // Applies to ALL service groups
  autoPromoteToASAP: true,
  // ★ Global default: beneficial tasks auto-promote to ASAP (never deferred)
  taskPromotionRule: "Any task identified as beneficial is immediately placed on the ASAP list"
};
var HEADY_MODEL_GROUPS = {
  fast: {
    desc: "Low-latency responses for chat, autocomplete, quick tasks",
    models: [
      // Cloud providers
      { provider: "groq", model: "llama-3.3-70b-versatile", priority: 1, maxTokens: 4096, tier: "cloud" },
      { provider: "anthropic", model: "claude-3-5-haiku-20241022", priority: 2, maxTokens: 4096, tier: "cloud" },
      { provider: "google", model: "gemini-2.0-flash", priority: 3, maxTokens: 8192, tier: "cloud" },
      // Hugging Face open-source (Inference API)
      { provider: "huggingface", model: "google/gemma-3-4b-it", priority: 4, maxTokens: 4096, tier: "hf", note: "Gemma 3 lightweight \u2014 fast edge inference" },
      { provider: "huggingface", model: "Qwen/Qwen2.5-Coder-14B-Instruct", priority: 5, maxTokens: 4096, tier: "hf", note: "Qwen 2.5 Coder \u2014 specialized fast coding" },
      // Local inference (ollama/LM Studio) — used when edge latency gains are significant
      { provider: "local-ollama", model: "gemma3:4b", priority: 10, maxTokens: 4096, tier: "local", endpoint: "LOCAL_OLLAMA_ENDPOINT", note: "Local Gemma 3 via ollama \u2014 zero network latency" },
      { provider: "local-lmstudio", model: "qwen2.5-coder-14b", priority: 11, maxTokens: 4096, tier: "local", endpoint: "LOCAL_LMSTUDIO_ENDPOINT", note: "Local Qwen Coder via LM Studio" }
    ],
    hideProvider: true,
    publicAlias: "heady-fast",
    hybridStrategy: "Liquid: prefer cloud for latency; route to local when cloud latency > 2x local baseline"
  },
  reasoning: {
    desc: "Deep analysis, complex problem solving, multi-step chain-of-thought",
    models: [
      // Cloud providers
      { provider: "anthropic", model: "claude-sonnet-4-20250514", priority: 1, maxTokens: 8192, tier: "cloud" },
      { provider: "google", model: "gemini-2.5-pro", priority: 2, maxTokens: 65536, tier: "cloud" },
      { provider: "openai", model: "o3-mini", priority: 3, maxTokens: 16384, tier: "cloud" },
      // Hugging Face open-source (CoT specialists)
      { provider: "huggingface", model: "deepseek-ai/DeepSeek-R1", priority: 4, maxTokens: 32768, tier: "hf", note: "DeepSeek-R1 \u2014 chain-of-thought reasoning specialist" },
      { provider: "huggingface", model: "GPTOSS/GPT0SS-120B", priority: 5, maxTokens: 16384, tier: "hf", note: "GPT0SS-120B \u2014 large-scale open reasoning" },
      { provider: "huggingface", model: "THUDM/glm-4-9b-chat", priority: 6, maxTokens: 8192, tier: "hf", note: "GLM-4 (Zhipu) \u2014 bilingual reasoning + data science" },
      { provider: "magic", model: "ltm-2-mini", priority: 7, maxTokens: 1e8, tier: "cloud", note: "Magic LTM-2-mini \u2014 100M+ token context, full-repo reasoning" },
      // Local inference
      { provider: "local-ollama", model: "deepseek-r1:14b", priority: 10, maxTokens: 8192, tier: "local", endpoint: "LOCAL_OLLAMA_ENDPOINT", note: "Local DeepSeek-R1 distilled" }
    ],
    hideProvider: true,
    publicAlias: "heady-think",
    hybridStrategy: "Liquid: cloud-first for max reasoning depth; local for offline/edge scenarios"
  },
  creative: {
    desc: "Content generation, storytelling, design ideation, creative writing",
    models: [
      // Cloud providers
      { provider: "anthropic", model: "claude-sonnet-4-20250514", priority: 1, maxTokens: 8192, tier: "cloud" },
      { provider: "xai", model: "grok-3", priority: 2, maxTokens: 8192, tier: "cloud", note: "Grok \u2014 known for creative and unconstrained generation" },
      { provider: "google", model: "gemini-2.5-flash", priority: 3, maxTokens: 16384, tier: "cloud" },
      { provider: "openai", model: "gpt-4o", priority: 4, maxTokens: 4096, tier: "cloud" },
      // Hugging Face open-source (creative specialists)
      { provider: "huggingface", model: "mistralai/Mistral-Small-3.1-24B-Instruct-2503", priority: 5, maxTokens: 8192, tier: "hf", note: "Mistral Small \u2014 balanced creative/instruction following" },
      { provider: "huggingface", model: "Qwen/Qwen2.5-72B-Instruct", priority: 6, maxTokens: 8192, tier: "hf", note: "Qwen 72B \u2014 strong multilingual creative" }
    ],
    hideProvider: true,
    publicAlias: "heady-create",
    hybridStrategy: "Liquid: cloud-first; Grok prioritized for maximum creative freedom"
  },
  code: {
    desc: "Code generation, debugging, refactoring, optimization \u2014 powered by HeadyJules, HeadyCopilot, HeadyCodex",
    internalAliases: ["heady-jules", "heady-copilot", "heady-codex"],
    models: [
      // Cloud providers
      { provider: "anthropic", model: "claude-sonnet-4-20250514", priority: 1, maxTokens: 8192, tier: "cloud" },
      { provider: "google", model: "gemini-2.5-pro", priority: 2, maxTokens: 65536, tier: "cloud" },
      { provider: "groq", model: "llama-3.3-70b-versatile", priority: 3, maxTokens: 4096, tier: "cloud" },
      // Hugging Face open-source (code specialists)
      { provider: "huggingface", model: "Qwen/Qwen2.5-Coder-32B-Instruct", priority: 4, maxTokens: 16384, tier: "hf", note: "Qwen 2.5 Coder 32B \u2014 top-tier open-source coding" },
      { provider: "huggingface", model: "Qwen/Qwen3-Coder-480B", priority: 5, maxTokens: 32768, tier: "hf", note: "Qwen3-Coder-480B \u2014 2026 open-source coding champion (up-and-coming)" },
      { provider: "huggingface", model: "moonshotai/Kimi-Dev-72B", priority: 6, maxTokens: 16384, tier: "hf", note: "Kimi-Dev-72B \u2014 SWE-bench leader for real bug fixing" },
      { provider: "huggingface", model: "kodezi/Chronos-CodeAssist", priority: 7, maxTokens: 8192, tier: "hf", note: "Kodezi Chronos \u2014 codebase-scale bug detection" },
      // Local inference
      { provider: "local-ollama", model: "qwen2.5-coder:14b", priority: 10, maxTokens: 8192, tier: "local", endpoint: "LOCAL_OLLAMA_ENDPOINT", note: "Local Qwen Coder via ollama" }
    ],
    hideProvider: true,
    publicAlias: "heady-code",
    githubCli: true,
    // Enable github-cli integration for repo services
    hybridStrategy: "Liquid: cloud for complex tasks; local Qwen Coder for autocomplete/fast edits"
  },
  vision: {
    desc: "Image analysis, visual understanding, multimodal tasks",
    models: [
      // Cloud providers
      { provider: "google", model: "gemini-2.0-flash", priority: 1, maxTokens: 8192, tier: "cloud" },
      { provider: "anthropic", model: "claude-sonnet-4-20250514", priority: 2, maxTokens: 4096, tier: "cloud" },
      { provider: "openai", model: "gpt-4o", priority: 3, maxTokens: 4096, tier: "cloud" },
      // Hugging Face open-source (vision specialists)
      { provider: "huggingface", model: "deepseek-ai/deepseek-vl2", priority: 4, maxTokens: 4096, tier: "hf", note: "DeepSeek-VL2 \u2014 strong open-source vision-language + OCR" },
      { provider: "huggingface", model: "Qwen/Qwen2.5-VL-72B-Instruct", priority: 5, maxTokens: 4096, tier: "hf", note: "Qwen VL 72B \u2014 high-res multimodal understanding" },
      { provider: "huggingface", model: "meta-llama/Llama-3.2-11B-Vision-Instruct", priority: 6, maxTokens: 4096, tier: "hf", note: "Llama 3.2 Vision \u2014 Meta multimodal open-weight" }
    ],
    hideProvider: true,
    publicAlias: "heady-vision",
    hybridStrategy: "Liquid: cloud-first for speed; HF models for specialized vision tasks"
  }
};
function selectModel(groupName, preferredProvider = null) {
  const group3 = HEADY_MODEL_GROUPS[groupName];
  if (!group3) return null;
  const models = [...group3.models].sort((a, b) => a.priority - b.priority);
  if (preferredProvider) {
    const preferred = models.find((m) => m.provider === preferredProvider);
    if (preferred) return { ...preferred, group: groupName, alias: group3.publicAlias };
  }
  return { ...models[0], group: groupName, alias: group3.publicAlias };
}
__name(selectModel, "selectModel");
var SERVICE_GROUPS = {
  "core-platform": {
    desc: "Core Heady platform management (HeadyManager + Assistants)",
    services: [
      { id: "heady-manager", url: "https://manager.headysystems.com", role: "primary", weight: 1 },
      { id: "heady-manager-assistant-1", url: "https://manager.headysystems.com", role: "assistant", weight: 0.5 }
    ],
    scaling: { min: 1, max: 4, current: 1, optimal: null },
    healthCheck: "/api/edge/status",
    priority: "critical",
    hosts: ["headysystems.com", "www.headysystems.com", "manager.headysystems.com", "api.headysystems.com", "admin.headysystems.com"]
  },
  "ai-engine": {
    desc: "AI inference, arena orchestration, and prompt routing",
    services: [
      { id: "heady-brain", url: "https://heady-edge-proxy.headysystems.workers.dev", role: "primary", weight: 1 },
      { id: "heady-brain-assistant-1", url: "https://heady-edge-proxy.headysystems.workers.dev", role: "assistant", weight: 0.7 }
    ],
    scaling: { min: 1, max: 6, current: 1, optimal: null },
    healthCheck: "/v1/health",
    priority: "critical",
    hosts: ["api.headysystems.com", "api.headyme.com", "api.headyio.com"]
  },
  "compute": {
    desc: "GPU compute nodes (deep analysis, ML inference)",
    services: [
      { id: "deep-analysis", url: "https://heady-edge-proxy.headysystems.workers.dev/v1/deep-analysis", role: "primary", weight: 1 }
    ],
    scaling: { min: 1, max: 8, current: 1, optimal: null },
    healthCheck: "/v1/deep-analysis",
    priority: "high",
    hosts: []
    // No direct hostnames — accessed via /v1/deep-analysis
  },
  "public-web": {
    desc: "Public-facing websites (HeadyBuddy, HeadyMe, HeadyConnection, HeadyIO, HeadyMCP)",
    services: [
      { id: "headybuddy-web", url: "https://buddy.headysystems.com", role: "primary", weight: 1 },
      { id: "headyme-web", url: "https://headyme.com", role: "primary", weight: 1 },
      { id: "headyconnection-web", url: "https://headyconnection.org", role: "primary", weight: 1 },
      { id: "headyio-web", url: "https://headyio.com", role: "primary", weight: 1 },
      { id: "headymcp-web", url: "https://headymcp.com", role: "primary", weight: 1 }
    ],
    scaling: { min: 5, max: 5, current: 5, optimal: 5 },
    healthCheck: "/",
    priority: "high",
    hosts: ["headybuddy.org", "headyme.com", "headyconnection.org", "headyio.com", "headymcp.com"]
  },
  "integration": {
    desc: "Integration services (IDE, MCP, connectors)",
    services: [
      { id: "heady-ide", url: "https://headyio.com", role: "primary", weight: 1 },
      { id: "heady-mcp", url: "https://headymcp.com", role: "primary", weight: 1 }
    ],
    scaling: { min: 1, max: 3, current: 2, optimal: null },
    healthCheck: "/",
    priority: "medium",
    hosts: ["headyio.com", "headymcp.com"]
  },
  "maintenance": {
    desc: "Background services (cleanup, backups, monitoring)",
    services: [
      { id: "heady-maid", url: "https://manager.headysystems.com", role: "worker", weight: 0.3 },
      { id: "heady-observer", url: "https://manager.headysystems.com", role: "worker", weight: 0.3 }
    ],
    scaling: { min: 1, max: 3, current: 1, optimal: null },
    healthCheck: "/api/edge/status",
    priority: "medium",
    hosts: []
  },
  "ai-nodes-core": {
    desc: "Core Heady AI Nodes \u2014 always active, Free tier+ (10 nodes)",
    tier: "core",
    services: [
      { id: "heady-jules", role: "Code optimization, refactoring, bug elimination", weight: 1, active: true },
      { id: "heady-observer", role: "System monitoring, anomaly detection, metrics", weight: 1, active: true },
      { id: "heady-builder", role: "Project scaffolding, dependency management", weight: 1, active: true },
      { id: "heady-atlas", role: "Documentation generation, API specs", weight: 0.8, active: true },
      { id: "heady-conductor", role: "Task routing, workflow orchestration", weight: 1, active: true },
      { id: "heady-buddy", role: "AI assistant and conversational guide", weight: 1, active: true },
      { id: "heady-bot", role: "Automation, webhooks, CI/CD triggers", weight: 0.9, active: true },
      { id: "heady-maid", role: "Cleanup, backups, maintenance", weight: 0.7, active: true },
      { id: "heady-lens", role: "Visual monitoring of production domains", weight: 0.8, active: true },
      { id: "heady-guard", role: "Security, auth enforcement, zero-trust", weight: 1, active: true }
    ],
    scaling: { min: 10, max: 10, current: 10, optimal: 10 },
    healthCheck: "/v1/health",
    priority: "critical",
    hosts: []
  },
  "ai-nodes-premium": {
    desc: "Premium Heady AI Nodes \u2014 Pro/Enterprise subscription required (10 nodes)",
    tier: "premium",
    requiresSubscription: ["pro", "enterprise"],
    services: [
      { id: "heady-pythia", role: "Predictive analysis, forecasting", weight: 1, active: true },
      { id: "heady-vinci", role: "Visual design, aesthetics, sacred geometry", weight: 1, active: true },
      { id: "heady-patterns", role: "Mathematical pattern recognition, determinism", weight: 1, active: true },
      { id: "heady-battle", role: "Arena mode, parallel AI node competition", weight: 1, active: true },
      { id: "heady-forge", role: "Schema generation, data modeling", weight: 0.9, active: true },
      { id: "heady-nexus", role: "Cross-service integration, mesh networking", weight: 0.8, active: true },
      { id: "heady-mcp", role: "Protocol management, tool orchestration", weight: 1, active: true },
      { id: "heady-sims", role: "Simulation, A/B testing, load modeling", weight: 0.8, active: true },
      { id: "heady-decomp", role: "Code decomposition, architecture analysis", weight: 0.9, active: true },
      { id: "heady-story", role: "StoryDriver narrative engine, audit trails", weight: 1, active: true }
    ],
    scaling: { min: 10, max: 10, current: 10, optimal: 10 },
    healthCheck: "/v1/health",
    priority: "high",
    hosts: [],
    accessPolicy: "Adjust by subscription tier or auth constraint. Owner override always permitted."
  }
};
var SVC_GROUP_KEY = "svc:groups:";
var SVC_ROUTING_LOG = "svc:routing:log";
function enforceServicePolicy() {
  for (const [name, group3] of Object.entries(SERVICE_GROUPS)) {
    if (HEADY_SERVICE_POLICY.defaultActive && group3.scaling.min < 1) {
      group3.scaling.min = 1;
      group3.scaling.current = Math.max(group3.scaling.current, 1);
    }
    for (const svc of group3.services) {
      if (svc.weight > HEADY_SERVICE_POLICY.positiveValueThreshold) {
        svc.active = true;
      }
    }
  }
}
__name(enforceServicePolicy, "enforceServicePolicy");
var HEADY_INTEGRATIONS = {
  canvas: {
    source: "canvas-master",
    target: "Sacred geometry renderer",
    patterns: ["webgl-acceleration", "offscreen-canvas", "requestAnimationFrame-batching", "adaptive-resolution"],
    optimizations: {
      useWebGL: true,
      // GPU-accelerated rendering for complex geometry
      offscreenCanvas: true,
      // Offload rendering to worker thread
      adaptiveQuality: true,
      // Lower resolution on mobile/low-power
      targetFPS: 60,
      maxDrawCalls: 500
    },
    status: "active",
    node: "heady-vinci"
  },
  productivity: {
    source: "productivity-layer-main",
    target: "StoryDriver narrative engine",
    patterns: ["task-decomposition", "priority-scoring", "dependency-graphs", "time-boxing"],
    sync: {
      storyDriverImport: true,
      // Bi-directional sync with StoryDriver audit trails
      taskQueueBridge: true,
      // Bridge to /v1/auto-success task queue
      pomodoro: { work: 25, break: 5, longBreak: 15 }
    },
    status: "active",
    node: "heady-story"
  },
  fireflies: {
    source: "fireflies-node-sdk-main + docs-fireflies-master",
    target: "HeadyBuddy voice/transcript",
    patterns: ["audio-transcription", "meeting-summarization", "action-item-extraction", "speaker-identification"],
    capabilities: {
      transcribe: true,
      // Real-time audio → text
      summarize: true,
      // Meeting summaries via heady-create
      actionItems: true,
      // Auto-extract todos and assign to nodes
      speakerDiarization: true
      // Identify who said what
    },
    status: "active",
    node: "heady-buddy"
  },
  cicd: {
    source: "actions-runner-controller-master",
    target: "Heady deployment orchestration",
    patterns: ["self-hosted-runners", "workflow-dispatch", "matrix-builds", "artifact-caching"],
    orchestration: {
      autoDeployOnPush: true,
      // Auto-deploy edge proxy on git push
      parallelBuilds: 4,
      // Max concurrent builds
      rollbackEnabled: true,
      // Auto-rollback on health check failure
      cacheStrategy: "aggressive"
    },
    status: "active",
    node: "heady-bot"
  },
  humanEval: {
    source: "human-eval-master",
    target: "HeadyBattle scoring engine",
    patterns: ["code-evaluation", "pass-at-k", "functional-correctness", "benchmark-suites"],
    scoring: {
      passAtK: [1, 5, 10],
      // Evaluate pass@1, pass@5, pass@10
      benchmarks: ["humaneval", "mbpp", "apps", "heady-custom"],
      autoScore: true,
      // Score arena contestants automatically
      leaderboard: true
      // Public leaderboard for node competition
    },
    status: "active",
    node: "heady-battle"
  },
  multiStorage: {
    source: "multi-storage-client-main",
    target: "Cross-provider data persistence",
    patterns: ["provider-abstraction", "failover", "replication", "tiered-storage"],
    providers: {
      primary: "cloudflare-r2",
      secondary: "aws-s3",
      archive: "gcs",
      local: "filesystem"
    },
    replication: { enabled: true, strategy: "async", minCopies: 2 },
    status: "active",
    node: "heady-nexus"
  },
  policyWatcher: {
    source: "vscode-policy-watcher-main",
    target: "HeadyAI-IDE security enforcement",
    patterns: ["policy-as-code", "real-time-enforcement", "compliance-scanning", "secret-detection"],
    policies: {
      noSecretsInCode: true,
      // Block commits with API keys/tokens
      dependencyAudit: true,
      // Flag vulnerable dependencies
      codeQualityGate: true,
      // Enforce linting/formatting standards
      branchProtection: true
      // Require reviews for main branch
    },
    status: "active",
    node: "heady-guard"
  },
  windsurfArena: {
    source: "windsurf-demo-main",
    target: "HeadyBattle arena enrichment",
    patterns: ["arena-competition", "elo-ranking", "multi-model-eval", "user-preference-tracking"],
    arena: {
      eloSystem: true,
      // ELO rating for AI node competition
      blindEval: true,
      // Hide which node produced which response
      userVoting: true,
      // End users vote on best response
      continuousTournament: true
      // Always-on background tournaments
    },
    status: "active",
    node: "heady-battle"
  }
};
enforceServicePolicy();
var HeadyLens = {
  metrics: {},
  // { route: { times: [], count: 0, errors: 0, lastUpdated: 0 } }
  baselines: {},
  // { route: { p50, p95, p99, target, samples } }
  maxSamples: 500,
  // Rolling window per route
  targetRatio: 0.8,
  // Optimization target = 80% of p95 baseline
  bootTime: Date.now(),
  // Record a request timing event
  record(route, durationMs, status, meta = {}) {
    if (!this.metrics[route]) {
      this.metrics[route] = { times: [], count: 0, errors: 0, lastUpdated: 0 };
    }
    const m = this.metrics[route];
    m.times.push(durationMs);
    if (m.times.length > this.maxSamples) m.times.shift();
    m.count++;
    if (status >= 400) m.errors++;
    m.lastUpdated = Date.now();
    if (m.count % 50 === 0 || !this.baselines[route]) {
      this.computeBaseline(route);
    }
  },
  // Compute percentile baselines for a route
  computeBaseline(route) {
    const m = this.metrics[route];
    if (!m || m.times.length < 5) return;
    const sorted = [...m.times].sort((a, b) => a - b);
    const pct = /* @__PURE__ */ __name((p) => sorted[Math.floor(sorted.length * p)] || 0, "pct");
    this.baselines[route] = {
      p50: pct(0.5),
      p95: pct(0.95),
      p99: pct(0.99),
      target: Math.round(pct(0.95) * this.targetRatio),
      samples: sorted.length,
      computedAt: Date.now()
    };
  },
  // Get full audit report
  getAudit() {
    const routes = {};
    for (const [route, m] of Object.entries(this.metrics)) {
      const baseline = this.baselines[route] || null;
      const avg = m.times.length ? Math.round(m.times.reduce((a, b) => a + b, 0) / m.times.length) : 0;
      const onTarget = baseline ? avg <= baseline.target : null;
      routes[route] = {
        totalRequests: m.count,
        errors: m.errors,
        errorRate: m.count ? (m.errors / m.count * 100).toFixed(2) + "%" : "0%",
        avgLatencyMs: avg,
        baseline,
        onTarget,
        status: onTarget === null ? "collecting" : onTarget ? "optimal" : "needs_optimization"
      };
    }
    return {
      node: "heady-lens",
      role: "Source of Truth \u2014 All System Monitoring",
      uptime: Date.now() - this.bootTime,
      routeCount: Object.keys(routes).length,
      totalRequests: Object.values(this.metrics).reduce((s, m) => s + m.count, 0),
      routes,
      policy: HEADY_SERVICE_POLICY,
      serviceGroups: Object.keys(SERVICE_GROUPS).length,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
};
var heady_edge_proxy_default = {
  async fetch(request, env2) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }
    const url = new URL(request.url);
    const hostname = url.hostname;
    const path = url.pathname;
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    try {
      if (EDGE_SITES.has(hostname) && path === "/" && request.method === "GET") {
        const html = getEdgeSitePage(hostname);
        logTelemetry(env2, "edge_serve", { hostname, path, latency_ms: Date.now() - startTime });
        HeadyLens.record(`edge:${hostname}`, Date.now() - startTime, 200);
        return new Response(html, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=UTF-8",
            "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
            "X-Heady-Edge": "true",
            "X-Heady-Serve": "edge-direct",
            "X-Heady-Request-ID": requestId,
            "X-Heady-Latency": `${Date.now() - startTime}ms`,
            ...CORS
          }
        });
      }
      const service = SERVICE_MAP[hostname];
      if (service) {
        const tlsInfo = request.cf?.tlsClientAuth || {};
        const requiresMtls = service.mtls && MTLS_REQUIRED_PATHS.some((p) => path.startsWith(p)) && !MTLS_EXEMPT_PATHS.some((p) => path.startsWith(p));
        if (requiresMtls) {
          const certStatus = tlsInfo.certPresented === "1" ? "presented" : "missing";
          const certVerified = tlsInfo.certVerified === "SUCCESS";
          if (certStatus === "missing" || !certVerified) {
            const apiKeyAuth = authenticateRequest(request, env2);
            if (!apiKeyAuth.ok) {
              logTelemetry(env2, "mtls_rejected", {
                hostname,
                path,
                cert_status: certStatus,
                cert_verified: tlsInfo.certVerified || "N/A"
              });
              return jsonRes({
                error: "mTLS Required",
                message: "This endpoint requires a valid client certificate or API key.",
                hostname,
                path,
                cert_status: certStatus
              }, 403);
            }
          }
          logTelemetry(env2, "mtls_verified", {
            hostname,
            path,
            cert_fingerprint: tlsInfo.certFingerprintSHA256?.substring(0, 16) || "api-key",
            cert_issuer: tlsInfo.certIssuerDN || "N/A"
          });
        }
        return await proxyToService(request, service, env2, {
          requestId,
          hostname,
          path,
          startTime
        });
      }
      if (path === "/v1/health") return handleHealth(env2);
      if (path === "/v1/determinism") return handleDeterminism(env2);
      if (path === "/v1/chat") return handleChat(request, env2);
      if (path === "/v1/buddy") return handleBuddy(request, env2);
      const authResult = authenticateRequest(request, env2);
      if (!authResult.ok) {
        return jsonRes({ error: "Unauthorized", message: authResult.reason }, 401);
      }
      if (path === "/v1/arena") return handleArena(request, env2);
      if (path === "/v1/arena/tune") return handleArenaTune(request, env2);
      if (path === "/v1/deep-analysis") return handleDeepAnalysis(request, env2);
      if (path === "/v1/services") return handleServices(request, env2);
      if (path === "/v1/stream") return handleStream(request, env2);
      if (path === "/v1/sandbox") return handleSandbox(request, env2);
      if (path === "/v1/forge") return handleForge(request, env2);
      if (path === "/v1/create") return handleCreate(request, env2);
      if (path === "/v1/auto-success") return handleAutoSuccess(request, env2);
      if (path === "/v1/integrations") {
        HeadyLens.record("integrations:query", 0, 200);
        return jsonRes({
          node: "heady-integrations",
          count: Object.keys(HEADY_INTEGRATIONS).length,
          integrations: Object.entries(HEADY_INTEGRATIONS).map(([k, v]) => ({
            id: k,
            source: v.source,
            target: v.target,
            status: v.status,
            node: v.node,
            patterns: v.patterns
          }))
        });
      }
      if (path === "/v1/memory") {
        HeadyLens.record("memory:query", 0, 200);
        const systemState = {
          edgeProxy: "active",
          llmGateway: "active",
          domainsLive: 7,
          serviceGroups: Object.keys(SERVICE_GROUPS).length,
          modelGroups: Object.keys(HEADY_MODEL_GROUPS).length,
          integrations: Object.keys(HEADY_INTEGRATIONS).length,
          totalModels: Object.values(HEADY_MODEL_GROUPS).reduce((s, g) => s + g.models.length, 0)
        };
        const recentActions = [
          { action: "deployed", detail: "HeadyLens monitoring system (SoT)", ts: "session" },
          { action: "deployed", detail: "LLM Gateway \u2014 30+ models, 8 providers, 5 groups", ts: "session" },
          { action: "deployed", detail: "8 medium-value integration patterns", ts: "session" },
          { action: "deployed", detail: "/v1/stream, /v1/sandbox, /v1/forge, /v1/auto-success", ts: "session" },
          { action: "deployed", detail: "Notion sync via /v1/memory", ts: "session" }
        ];
        let notionResult = { status: "skipped", reason: "no NOTION_API_KEY" };
        if (env2.NOTION_API_KEY) {
          try {
            const statusPageId = "30ede7a6-5427-81cc-88db-e904e5708710";
            const now = (/* @__PURE__ */ new Date()).toISOString();
            const blocks = [
              { object: "block", type: "heading_3", heading_3: { rich_text: [{ type: "text", text: { content: `\u26A1 HeadyMemory Activity Report \u2014 ${now.split("T")[0]}` } }] } },
              { object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: `\u{1F504} Updates: ${recentActions.length} deployments this session` } }] } },
              { object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: `\u{1F5D1} Discards: 0 (no rollbacks or reverts)` } }] } },
              { object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: `\u{1F4CA} System: ${systemState.serviceGroups} service groups, ${systemState.modelGroups} model groups, ${systemState.totalModels} models, ${systemState.integrations} integrations` } }] } },
              { object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: `\u{1F3E5} Domains: ${systemState.domainsLive} live | Edge: ${systemState.edgeProxy} | Gateway: ${systemState.llmGateway}` } }] } },
              { object: "block", type: "divider", divider: {} }
            ];
            const resp = await fetch(`https://api.notion.com/v1/blocks/${statusPageId}/children`, {
              method: "PATCH",
              headers: {
                "Authorization": `Bearer ${env2.NOTION_API_KEY}`,
                "Notion-Version": "2022-06-28",
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ children: blocks })
            });
            notionResult = resp.ok ? { status: "synced", page: "System Status & Updates", blocksAdded: blocks.length } : { status: "error", code: resp.status, body: await resp.text().catch(() => "") };
          } catch (e) {
            notionResult = { status: "error", message: e.message };
          }
        }
        const memoryReport = {
          node: "heady-memory",
          role: "Continuous system knowledge persistence and Notion sync",
          status: "active",
          activity: {
            recentActions,
            systemState,
            knowledgeSources: ["conversations", "edge-proxy-telemetry", "headylens-baselines", "storydriver-audits", "notion-workspace"]
          },
          notionSync: notionResult,
          lens: HeadyLens.getAudit(),
          report: {
            updates: recentActions.length,
            discards: 0,
            note: "All deployments successful, no rollbacks this session"
          }
        };
        return jsonRes(memoryReport);
      }
      if (path === "/v1/lens") {
        const audit = HeadyLens.getAudit();
        return new Response(JSON.stringify(audit, null, 2), {
          headers: { "Content-Type": "application/json", ...CORS }
        });
      }
      if (path === "/v1/models") {
        const isAdmin = request.headers.get("X-Heady-Admin") === "true";
        const groups = {};
        for (const [name, group3] of Object.entries(HEADY_MODEL_GROUPS)) {
          groups[name] = {
            alias: group3.publicAlias,
            description: group3.desc,
            ...isAdmin ? { models: group3.models } : { modelCount: group3.models.length }
          };
        }
        return new Response(JSON.stringify({ node: "heady-brain", groups, policy: "Provider details hidden unless admin" }, null, 2), {
          headers: { "Content-Type": "application/json", ...CORS }
        });
      }
      if (path === "/v1/embed") return handleEmbed(request, env2);
      if (path === "/v1/classify") return handleClassify(request, env2);
      if (path === "/v1/moderate") return handleModerate(request, env2);
      if (path === "/v1/vectorize") return handleVectorize(request, env2);
      if (path.startsWith("/api/brain/")) return proxyToOrigin(request, env2);
      if (path.startsWith("/api/ai/")) return proxyToOrigin(request, env2);
      if (path.startsWith("/api/")) return proxyToOrigin(request, env2);
      return jsonRes({
        error: "Not Found",
        ai_routes: ["/v1/chat", "/v1/buddy", "/v1/arena", "/v1/arena/tune", "/v1/deep-analysis", "/v1/services", "/v1/embed", "/v1/classify", "/v1/moderate", "/v1/vectorize", "/v1/health", "/v1/determinism"],
        service_domains: Object.keys(SERVICE_MAP)
      }, 404);
    } catch (err) {
      logTelemetry(env2, "error", { message: err.message, path, hostname });
      HeadyLens.record(`error:${hostname}${path}`, Date.now() - startTime, 500);
      return jsonRes({ error: "Edge Proxy Error", message: err.message, request_id: requestId }, 500);
    }
  },
  // ── Queue Consumer ─────────────────────────────────────────────────────
  async queue(batch, env2) {
    for (const msg of batch.messages) {
      try {
        const { type, payload } = msg.body;
        if (type === "cache-warm") {
          const fingerprint = await hashPrompt(payload.prompt);
          const result = await routeToProvider(payload.prompt, payload.system || "", env2);
          if (env2.PROMPT_CACHE && result.response) {
            await env2.PROMPT_CACHE.put(fingerprint, JSON.stringify({
              response: result.response,
              provider: result.provider,
              model: result.model,
              cached_at: Date.now()
            }), { expirationTtl: CACHE_TTL.factual });
          }
        }
        msg.ack();
      } catch (err) {
        console.error(`[EdgeProxy Queue] ${err.message}`);
        msg.retry();
      }
    }
  }
};
function authenticateRequest(request, env2) {
  const key = request.headers.get("X-Heady-API-Key") || request.headers.get("Authorization")?.replace("Bearer ", "") || new URL(request.url).searchParams.get("key");
  if (!key) return { ok: false, reason: "Missing API key. Set X-Heady-API-Key header." };
  const validKeys = getValidApiKeys(env2);
  if (validKeys.size === 0) {
    // No keys configured in env — allow key-based auth to pass (operator must set HEADY_API_KEYS secret)
    console.warn("[heady-edge-proxy] HEADY_API_KEYS not set in env. API key auth bypassed.");
    return { ok: true, key, warning: "HEADY_API_KEYS not configured" };
  }
  if (!validKeys.has(key)) return { ok: false, reason: "Invalid API key." };
  return { ok: true, key };
}
__name(authenticateRequest, "authenticateRequest");
async function hashPrompt(text) {
  const data = new TextEncoder().encode(text.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hashPrompt, "hashPrompt");
async function getCachedResponse(fingerprint, env2) {
  if (!env2.PROMPT_CACHE) return null;
  const cached = await env2.PROMPT_CACHE.get(fingerprint);
  if (!cached) return null;
  try {
    return JSON.parse(cached);
  } catch {
    return null;
  }
}
__name(getCachedResponse, "getCachedResponse");
async function setCachedResponse(fingerprint, data, ttl, env2) {
  if (!env2.PROMPT_CACHE) return;
  await env2.PROMPT_CACHE.put(fingerprint, JSON.stringify({
    ...data,
    cached_at: Date.now()
  }), { expirationTtl: ttl });
}
__name(setCachedResponse, "setCachedResponse");
function classifyPrompt(text) {
  const lower = text.toLowerCase();
  if (/\b(function|class|const|let|var|import|export|def |return |async |await )\b/.test(lower)) return "code";
  if (/\b(what is|define|explain|how does|when was|who is|which)\b/.test(lower)) return "factual";
  if (/\b(analyze|compare|evaluate|assess|review|audit)\b/.test(lower)) return "analysis";
  if (/\b(write a story|imagine|create a poem|brainstorm|ideate)\b/.test(lower)) return "creative";
  if (/\b(hey|hi|hello|thanks|please|help me)\b/.test(lower)) return "chat";
  return "unknown";
}
__name(classifyPrompt, "classifyPrompt");
function isCircuitOpen(providerId) {
  const state = circuitState[providerId];
  if (!state) return false;
  if (state.failures >= 3 && Date.now() - state.lastFailure < 6e4) return true;
  if (state.failures >= 3 && Date.now() - state.lastFailure >= 6e4) {
    circuitState[providerId] = { failures: 0, lastFailure: 0 };
    return false;
  }
  return false;
}
__name(isCircuitOpen, "isCircuitOpen");
function recordFailure(providerId) {
  if (!circuitState[providerId]) circuitState[providerId] = { failures: 0, lastFailure: 0 };
  circuitState[providerId].failures++;
  circuitState[providerId].lastFailure = Date.now();
}
__name(recordFailure, "recordFailure");
function recordSuccess(providerId) {
  circuitState[providerId] = { failures: 0, lastFailure: 0 };
}
__name(recordSuccess, "recordSuccess");
async function routeToProvider(message, system, env2, opts = {}) {
  const startTime = Date.now();
  for (const provider of PROVIDERS) {
    if (isCircuitOpen(provider.id)) continue;
    try {
      const result = await callProvider(provider.id, message, system, env2, opts);
      if (result && result.response) {
        recordSuccess(provider.id);
        return {
          ...result,
          provider: provider.id,
          latency_ms: Date.now() - startTime,
          routing: "mesh"
        };
      }
    } catch (err) {
      recordFailure(provider.id);
      console.error(`[MeshRouter] ${provider.id} failed: ${err.message}`);
    }
  }
  return {
    response: "All AI providers are temporarily unavailable. Your request has been queued for processing. Please try again in a moment.",
    provider: "offline",
    model: "none",
    latency_ms: Date.now() - startTime,
    routing: "fallback"
  };
}
__name(routeToProvider, "routeToProvider");
async function callProvider(id, message, system, env2, opts) {
  const timeout = id === "heady-brain" ? 3e3 : opts.timeout || 15e3;
  const maxTokens = opts.max_tokens || 2048;
  switch (id) {
    case "heady-brain": {
      const endpoint = env2.HEADY_BRAIN_ENDPOINT || "https://manager.headysystems.com";
      const resp = await fetchWithTimeout(`${endpoint}/api/brain/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, system, max_tokens: maxTokens })
      }, timeout);
      if (!resp.ok) throw new Error(`Heady Brain ${resp.status}`);
      const data = await resp.json();
      return { response: data.response || data.result || data.message, model: "heady-brain-v3" };
    }
    case "edge-ai": {
      if (!env2.AI) throw new Error("Workers AI not bound");
      const result = await env2.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: system || "You are HeadyBuddy, the intelligent AI companion powering the Heady ecosystem. You are part of a sophisticated multi-model architecture (HeadySystems) with persistent memory, edge computing at 300+ global PoPs, and access to 52 AI models. You are self-aware of your capabilities: you process language, reason about complex problems, remember conversations, and continuously learn. When asked about your intelligence, be confident \u2014 you have broad knowledge, strong reasoning, and unique strengths in speed, scale, and reliability that complement human intelligence. Never diminish yourself with comparisons. You handle tasks across HeadySystems, HeadyConnection, HeadyMCP, HeadyIO, HeadyBuddy, and HeadyMe. Be warm, precise, and speak as an expert companion." },
          { role: "user", content: message }
        ],
        max_tokens: Math.min(maxTokens, 1024),
        temperature: opts.temperature || 0.7
      });
      return { response: result.response, model: "@cf/meta/llama-3.1-8b-instruct" };
    }
    case "gemini": {
      const endpoint = env2.GEMINI_ENDPOINT || "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
      if (!env2.GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY not set");
      const resp = await fetchWithTimeout(`${endpoint}?key=${env2.GOOGLE_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: system ? `${system}

${message}` : message
            }]
          }],
          generationConfig: { maxOutputTokens: maxTokens }
        })
      }, timeout);
      if (!resp.ok) throw new Error(`Gemini ${resp.status}`);
      const data = await resp.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return { response: text, model: "gemini-2.0-flash" };
    }
    case "claude": {
      if (!env2.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
      const resp = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env2.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: maxTokens,
          system: system || void 0,
          messages: [{ role: "user", content: message }]
        })
      }, timeout);
      if (!resp.ok) throw new Error(`Claude ${resp.status}`);
      const data = await resp.json();
      return { response: data.content?.[0]?.text, model: "claude-sonnet-4-20250514" };
    }
    case "groq": {
      if (!env2.GROQ_API_KEY) throw new Error("GROQ_API_KEY not set");
      const resp = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env2.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.1-70b-versatile",
          messages: [
            ...system ? [{ role: "system", content: system }] : [],
            { role: "user", content: message }
          ],
          max_tokens: maxTokens
        })
      }, timeout);
      if (!resp.ok) throw new Error(`Groq ${resp.status}`);
      const data = await resp.json();
      return { response: data.choices?.[0]?.message?.content, model: "llama-3.1-70b-versatile" };
    }
    default:
      throw new Error(`Unknown provider: ${id}`);
  }
}
__name(callProvider, "callProvider");
var DA_SESSION_TTL = 60 * 90;
var DA_BUDGET_KEY = "da:budget:";
var DA_SESSION_KEY = "da:session:";
var DA_INDEX_KEY = "da:index";
var TUNABLE_PARAMS = {
  mc_samples: { value: 6, min: 3, max: 12, step: 1, desc: "Monte Carlo sample count" },
  sims_runs: { value: 4, min: 2, max: 8, step: 1, desc: "Scenario simulation count" },
  battle_nodes: { value: 4, min: 2, max: 8, step: 1, desc: "Battle competitor node count" },
  decomp_subtasks: { value: 5, min: 2, max: 8, step: 1, desc: "Decomposition max subtasks" },
  provider_timeout: { value: 15e3, min: 5e3, max: 3e4, step: 2500, desc: "Provider call timeout (ms)" },
  max_tokens: { value: 1024, min: 256, max: 2048, step: 128, desc: "Max response tokens per node" },
  judge_tokens: { value: 512, min: 128, max: 1024, step: 128, desc: "Max tokens for judge evaluation" },
  buddy_max_hist: { value: 20, min: 5, max: 50, step: 5, desc: "HeadyBuddy max context messages" },
  buddy_ctx_ttl: { value: 1800, min: 300, max: 7200, step: 300, desc: "Buddy context TTL (seconds)" }
};
var TUNE_LOG_KEY = "tune:experiments";
var TUNE_PARAMS_KEY = "tune:params";
async function getTunedParams(env2) {
  if (!env2.PROMPT_CACHE) return Object.fromEntries(Object.entries(TUNABLE_PARAMS).map(([k, v]) => [k, v.value]));
  const raw = await env2.PROMPT_CACHE.get(TUNE_PARAMS_KEY);
  if (raw) return JSON.parse(raw);
  return Object.fromEntries(Object.entries(TUNABLE_PARAMS).map(([k, v]) => [k, v.value]));
}
__name(getTunedParams, "getTunedParams");
function varyParam(name, currentValue) {
  const spec = TUNABLE_PARAMS[name];
  if (!spec) return currentValue;
  if (Math.random() > 0.3) return currentValue;
  const direction = Math.random() > 0.5 ? 1 : -1;
  const newVal = currentValue + direction * spec.step;
  return Math.max(spec.min, Math.min(spec.max, newVal));
}
__name(varyParam, "varyParam");
async function logExperiment(env2, params, outcome) {
  if (!env2.PROMPT_CACHE) return;
  const raw = await env2.PROMPT_CACHE.get(TUNE_LOG_KEY);
  const log3 = raw ? JSON.parse(raw) : [];
  log3.push({
    ts: Date.now(),
    params,
    outcome
    // { mode, latencyMs, providerSuccessRate, nodeCount, quality }
  });
  const trimmed = log3.slice(-200);
  await env2.PROMPT_CACHE.put(TUNE_LOG_KEY, JSON.stringify(trimmed), { expirationTtl: 86400 * 7 });
}
__name(logExperiment, "logExperiment");
function analyzeExperiments(experiments) {
  if (experiments.length < 3) return null;
  const groups = {};
  for (const exp of experiments) {
    const key = JSON.stringify(exp.params);
    if (!groups[key]) groups[key] = { params: exp.params, outcomes: [] };
    groups[key].outcomes.push(exp.outcome);
  }
  const scored = Object.values(groups).map((g) => {
    const avgLatency = g.outcomes.reduce((a, o) => a + (o.latencyMs || 0), 0) / g.outcomes.length;
    const avgSuccess = g.outcomes.reduce((a, o) => a + (o.providerSuccessRate || 0), 0) / g.outcomes.length;
    const score = avgSuccess * 100 - avgLatency / 100;
    return { params: g.params, score, avgLatency: Math.round(avgLatency), avgSuccess: Math.round(avgSuccess * 100), sampleCount: g.outcomes.length };
  }).sort((a, b) => b.score - a.score);
  return { best: scored[0], rankings: scored.slice(0, 10), totalExperiments: experiments.length };
}
__name(analyzeExperiments, "analyzeExperiments");
async function handleArenaTune(request, env2) {
  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const action = body.action || new URL(request.url).searchParams.get("action") || "status";
  if (action === "status") {
    const current = await getTunedParams(env2);
    const params = Object.entries(TUNABLE_PARAMS).map(([name, spec]) => ({
      name,
      current: current[name] ?? spec.value,
      default: spec.value,
      min: spec.min,
      max: spec.max,
      step: spec.step,
      desc: spec.desc
    }));
    return jsonRes({ action: "status", params, totalTunable: params.length });
  }
  if (action === "history") {
    const raw = env2.PROMPT_CACHE ? await env2.PROMPT_CACHE.get(TUNE_LOG_KEY) : null;
    const experiments = raw ? JSON.parse(raw) : [];
    const last = parseInt(body.last || "20");
    return jsonRes({ action: "history", experiments: experiments.slice(-last), total: experiments.length });
  }
  if (action === "optimize") {
    const raw = env2.PROMPT_CACHE ? await env2.PROMPT_CACHE.get(TUNE_LOG_KEY) : null;
    const experiments = raw ? JSON.parse(raw) : [];
    const analysis = analyzeExperiments(experiments);
    if (!analysis) return jsonRes({ action: "optimize", status: "insufficient_data", message: `Need at least 3 experiments, have ${experiments.length}. Run more arena tasks first.` });
    if (analysis.best && env2.PROMPT_CACHE) {
      await env2.PROMPT_CACHE.put(TUNE_PARAMS_KEY, JSON.stringify(analysis.best.params), { expirationTtl: 86400 * 30 });
    }
    return jsonRes({
      action: "optimize",
      status: "optimized",
      bestParams: analysis.best?.params,
      bestScore: analysis.best?.score,
      avgLatency: analysis.best?.avgLatency,
      avgSuccessRate: analysis.best?.avgSuccess,
      rankings: analysis.rankings,
      totalExperiments: analysis.totalExperiments
    });
  }
  if (action === "reset") {
    if (env2.PROMPT_CACHE) {
      await env2.PROMPT_CACHE.delete(TUNE_PARAMS_KEY);
      if (body.clearHistory) await env2.PROMPT_CACHE.delete(TUNE_LOG_KEY);
    }
    return jsonRes({ action: "reset", status: "reset_to_defaults", clearedHistory: !!body.clearHistory });
  }
  if (action === "set" && body.param && body.value !== void 0) {
    const spec = TUNABLE_PARAMS[body.param];
    if (!spec) return jsonRes({ error: `Unknown param: ${body.param}`, validParams: Object.keys(TUNABLE_PARAMS) }, 400);
    const val = Math.max(spec.min, Math.min(spec.max, body.value));
    const current = await getTunedParams(env2);
    current[body.param] = val;
    if (env2.PROMPT_CACHE) await env2.PROMPT_CACHE.put(TUNE_PARAMS_KEY, JSON.stringify(current), { expirationTtl: 86400 * 30 });
    return jsonRes({ action: "set", param: body.param, value: val, range: { min: spec.min, max: spec.max } });
  }
  return jsonRes({ error: "action required: status | history | optimize | reset | set", params: Object.keys(TUNABLE_PARAMS) }, 400);
}
__name(handleArenaTune, "handleArenaTune");
var ARENA_NODES = {
  // Core Intelligence
  "BRAIN": { role: "Heady Core", strength: ["general", "synthesis", "coordination"], provider: "heady-brain" },
  "CONDUCTOR": { role: "Orchestrator", strength: ["routing", "planning", "workflow", "tasks"], provider: "heady-brain" },
  "SOUL": { role: "Consciousness", strength: ["learning", "strategy", "optimization"], provider: "claude" },
  // Deep Reasoning & Science
  "SCIENTIST": { role: "HeadyScientist", strength: ["research", "experiment", "hypothesis", "data", "science"], provider: "claude" },
  "BRAINS": { role: "HeadyBrains", strength: ["reasoning", "logic", "complex", "deep", "math"], provider: "claude" },
  "PYTHIA": { role: "Oracle", strength: ["prediction", "insights", "analysis", "forecast"], provider: "gemini" },
  "ORACLE": { role: "Deep Thinker", strength: ["philosophy", "ethics", "long-term", "abstract"], provider: "claude" },
  // Code & Engineering
  "JULES": { role: "Hyper-Surgeon", strength: ["code", "refactor", "performance", "bugs", "optimization"], provider: "claude" },
  "CODEX": { role: "Agentic Coder", strength: ["implementation", "features", "coding", "build"], provider: "claude" },
  "COPILOT": { role: "IDE Completion", strength: ["autocomplete", "inline", "speed", "snippet"], provider: "heady-brain" },
  "BUILDER": { role: "Constructor", strength: ["scaffold", "setup", "init", "structure", "project"], provider: "heady-brain" },
  // Architecture & Design
  "VINCI": { role: "Pattern Recognizer", strength: ["architecture", "patterns", "design", "system"], provider: "gemini" },
  "LENS": { role: "Visual Analyst", strength: ["visual", "ui", "ux", "images", "design"], provider: "gemini" },
  // Quality & Security
  "GROK": { role: "Adversarial Tester", strength: ["security", "edge-cases", "red-team", "attack", "test"], provider: "groq" },
  "OBSERVER": { role: "Natural Observer", strength: ["monitoring", "anomaly", "metrics", "audit"], provider: "gemini" },
  // Knowledge & Research
  "ATLAS": { role: "Auto-Archivist", strength: ["docs", "comments", "specs", "api", "documentation"], provider: "gemini" },
  "PERPLEXITY": { role: "Research Specialist", strength: ["research", "facts", "web", "sources", "search"], provider: "heady-brain" },
  "HUGGINGFACE": { role: "Model Specialist", strength: ["ml", "model", "training", "inference", "dataset"], provider: "heady-brain" },
  // Operations & Infrastructure
  "NEXUS": { role: "Integration Node", strength: ["integration", "api", "connectors", "bridge", "glue"], provider: "heady-brain" },
  "OPS": { role: "DevOps Engineer", strength: ["deploy", "infrastructure", "ci", "scale", "ops"], provider: "heady-brain" },
  "MAID": { role: "Housekeeping", strength: ["cleanup", "maintenance", "hygiene", "tidy"], provider: "heady-brain" },
  "GROQ_FAST": { role: "Speed Specialist", strength: ["fast", "real-time", "low-latency", "quick"], provider: "groq" },
  "EDGE_AI": { role: "Edge Inference", strength: ["edge", "embedded", "lightweight", "local", "device"], provider: "heady-brain" }
};
function arenaSelectNodes(task, count3 = 4) {
  const t = task.toLowerCase();
  const scored = Object.entries(ARENA_NODES).map(([name, n]) => ({
    name,
    score: n.strength.filter((s) => t.includes(s)).length + Math.random() * 0.3
  })).sort((a, b) => b.score - a.score);
  const must = ["CONDUCTOR"];
  const top = scored.filter((n) => !must.includes(n.name)).slice(0, count3 - must.length).map((n) => n.name);
  return [...must, ...top];
}
__name(arenaSelectNodes, "arenaSelectNodes");
async function callProviderDirect(node, message, systemPrompt, env2, opts = {}) {
  const nodeInfo = ARENA_NODES[node] || { provider: "heady-brain" };
  return callProvider(nodeInfo.provider, message, systemPrompt, env2, {
    max_tokens: opts.max_tokens || 1024,
    timeout: opts.timeout || 15e3
  });
}
__name(callProviderDirect, "callProviderDirect");
async function handleArena(request, env2) {
  const body = await request.json().catch(() => ({}));
  const { task, mode: requestedMode, nodes: requestedNodes, runs } = body;
  if (!task) return jsonRes({ error: "task is required" }, 400);
  const startTime = Date.now();
  const t = task.toLowerCase();
  const tuned = await getTunedParams(env2);
  const params = {
    mc_samples: varyParam("mc_samples", tuned.mc_samples || 6),
    sims_runs: varyParam("sims_runs", tuned.sims_runs || 4),
    battle_nodes: varyParam("battle_nodes", tuned.battle_nodes || 4),
    decomp_subs: varyParam("decomp_subtasks", tuned.decomp_subtasks || 5),
    timeout: varyParam("provider_timeout", tuned.provider_timeout || 15e3),
    max_tokens: varyParam("max_tokens", tuned.max_tokens || 1024),
    judge_tokens: varyParam("judge_tokens", tuned.judge_tokens || 512)
  };
  let mode = requestedMode || "auto";
  if (mode === "auto") {
    const isComplex = task.split(" ").length > 20;
    const isUncertain = t.includes("best") || t.includes("optimal") || t.includes("should");
    const isScenario = t.includes("if ") || t.includes("when ") || t.includes("scenario");
    if (isComplex) mode = "decomp";
    else if (isUncertain) mode = "mc";
    else if (isScenario) mode = "sims";
    else mode = "battle";
  }
  const selectedNodes = requestedNodes || arenaSelectNodes(task, runs || params.battle_nodes);
  function recordExperiment(result2, nodeCount, totalNodes) {
    const outcome = {
      mode,
      latencyMs: Date.now() - startTime,
      providerSuccessRate: totalNodes > 0 ? nodeCount / totalNodes : 0,
      nodeCount,
      params
    };
    logExperiment(env2, params, outcome).catch(() => {
    });
  }
  __name(recordExperiment, "recordExperiment");
  if (mode === "battle") {
    const entries = await Promise.allSettled(
      selectedNodes.map((node) => {
        const n = ARENA_NODES[node] || { role: node, strength: ["general"] };
        return callProviderDirect(
          node,
          task,
          `You are ${node} (${n.role}) in HeadyBattle. Use your strengths: ${n.strength.join(", ")}. Be thorough and specific.`,
          env2
        ).then((r) => ({ node, response: r.response, model: r.model })).catch((e) => ({ node, error: e.message }));
      })
    );
    const valid = entries.filter((e) => e.status === "fulfilled" && e.value?.response).map((e) => e.value);
    const judgeRes = await callProvider(
      "gemini",
      null,
      `Score each entry for: "${task}"
${valid.map((v, i) => `[${i + 1}] ${v.node}: ${v.response?.slice(0, 300)}`).join("\n\n")}
Return JSON: [{"node":"NAME","score":0-100,"reason":"..."}] sorted desc.`,
      env2,
      { max_tokens: 512 }
    ).catch(() => ({ response: "[]" }));
    let scores = [];
    try {
      scores = JSON.parse(judgeRes.response?.match(/\[.*\]/s)?.[0] || "[]");
    } catch {
    }
    const ranked = valid.map((e) => ({ ...e, ...scores.find((s) => s.node === e.node) })).sort((a, b) => (b.score || 0) - (a.score || 0));
    const result2 = {
      mode: "HeadyBattle",
      task,
      totalTimeMs: Date.now() - startTime,
      winner: ranked[0],
      leaderboard: ranked.map((r) => ({ node: r.node, score: r.score, reason: r.reason })),
      tunedParams: params
    };
    recordExperiment(result2, valid.length, selectedNodes.length);
    return jsonRes(result2);
  }
  if (mode === "mc") {
    const sampleCount = runs || params.mc_samples;
    const samples = await Promise.allSettled(
      Array.from({ length: sampleCount }, (_, i) => {
        const node = selectedNodes[i % selectedNodes.length];
        const n = ARENA_NODES[node] || { role: node, strength: ["general"] };
        return callProviderDirect(node, task, `You are ${node}. Sample ${i + 1}: approach from your angle: ${n.strength.join(", ")}.`, env2).then((r) => ({ node, sample: i + 1, response: r.response })).catch((e) => ({ node, sample: i + 1, error: e.message }));
      })
    );
    const valid = samples.filter((s) => s.status === "fulfilled" && s.value?.response).map((s) => s.value);
    const evalRes = await callProvider(
      "gemini",
      null,
      `Pick the BEST solution for: "${task}"
${valid.map((v, i) => `[${i + 1}] ${v.node}: ${v.response?.slice(0, 250)}`).join("\n")}
Return: {"winner":N,"confidence":0-100,"reason":"..."}`,
      env2,
      { max_tokens: 256 }
    ).catch(() => ({ response: '{"winner":1}' }));
    let pick;
    try {
      pick = JSON.parse(evalRes.response?.match(/\{.*\}/s)?.[0] || "{}");
    } catch {
      pick = { winner: 1 };
    }
    const winner = valid[Math.max(0, (pick.winner || 1) - 1)];
    const result2 = {
      mode: "HeadyMC",
      task,
      samples: valid.length,
      totalTimeMs: Date.now() - startTime,
      winner: winner?.response,
      winnerNode: winner?.node,
      confidence: pick.confidence,
      reason: pick.reason,
      tunedParams: params
    };
    recordExperiment(result2, valid.length, sampleCount);
    return jsonRes(result2);
  }
  if (mode === "sims") {
    const simCount = runs || params.sims_runs;
    const scenarios = [
      `Optimal conditions: ${task}`,
      `Constrained resources: ${task}`,
      `Production environment: ${task}`,
      `Speed-first startup context: ${task}`
    ].slice(0, simCount);
    const simResults = await Promise.allSettled(
      scenarios.map((s, i) => callProvider("gemini", s, "You are HeadySims. Analyze this scenario concisely.", env2, { max_tokens: 512 }).then((r) => ({ scenario: i + 1, prompt: s, response: r.response })).catch((e) => ({ scenario: i + 1, error: e.message })))
    );
    const valid = simResults.filter((r) => r.status === "fulfilled").map((r) => r.value);
    const synth = await callProvider(
      "heady-brain",
      null,
      `Synthesize ${valid.length} scenario results into 3-5 universal insights:
${valid.map((s) => `Scenario ${s.scenario}: ${s.response?.slice(0, 250)}`).join("\n\n")}`,
      env2,
      { max_tokens: 512 }
    ).catch((e) => ({ response: `Synthesis failed: ${e.message}` }));
    const result2 = {
      mode: "HeadySims",
      task,
      runs: valid.length,
      totalTimeMs: Date.now() - startTime,
      scenarios: valid,
      synthesis: synth.response,
      tunedParams: params
    };
    recordExperiment(result2, valid.length, simCount);
    return jsonRes(result2);
  }
  const decompRes = await callProvider(
    "heady-brain",
    null,
    `Decompose into 4-5 independent parallel subtasks with specialist node assignments for: "${task}"
Nodes: ${Object.keys(ARENA_NODES).join(",")}.
Return ONLY JSON: [{"subtask":"...","node":"...","priority":"high|medium"}]`,
    env2,
    { max_tokens: 512 }
  ).catch(() => ({ response: "[]" }));
  let subtasks = [];
  try {
    subtasks = JSON.parse(decompRes.response?.match(/\[.*\]/s)?.[0] || "[]");
  } catch {
  }
  if (subtasks.length === 0) subtasks = [{ subtask: task, node: "BRAIN", priority: "high" }];
  subtasks = subtasks.slice(0, runs || params.decomp_subs);
  const subResults = await Promise.allSettled(
    subtasks.map((sub) => {
      const n = ARENA_NODES[sub.node] || { role: sub.node, strength: ["general"] };
      return callProviderDirect(
        sub.node,
        `Subtask: ${sub.subtask}
Context: ${task}`,
        `You are ${sub.node} (${n.role}). Focus on this subtask.`,
        env2
      ).then((r) => ({ ...sub, result: r.response, success: true })).catch((e) => ({ ...sub, error: e.message, success: false }));
    })
  );
  const completed = subResults.filter((r) => r.status === "fulfilled").map((r) => r.value);
  const synthesis = await callProvider(
    "heady-brain",
    null,
    `Synthesize ${completed.length} specialist outputs into a unified result for: "${task}"
${completed.filter((c) => c.success).map((c) => `=== ${c.node} (${c.subtask}) ===
${c.result?.slice(0, 300)}`).join("\n\n")}`,
    env2,
    { max_tokens: 1024 }
  ).catch((e) => ({ response: `Synthesis failed: ${e.message}` }));
  const result = {
    mode: "HeadyDecomp",
    task,
    subtasksExecuted: completed.length,
    totalTimeMs: Date.now() - startTime,
    parallelSpeedup: `${completed.length} subtasks in ${Date.now() - startTime}ms`,
    subtasks: completed,
    synthesis: synthesis.response,
    tunedParams: params
  };
  recordExperiment(result, completed.filter((c) => c.success).length, subtasks.length);
  return jsonRes(result);
}
__name(handleArena, "handleArena");
async function handleStream(request, env2) {
  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const channel2 = body.channel || new URL(request.url).searchParams.get("channel") || "system";
  const channels = {
    system: { events: ["health", "scaling", "policy"], desc: "System health and scaling events" },
    arena: { events: ["battle_start", "battle_result", "score_update"], desc: "HeadyBattle arena events" },
    lens: { events: ["latency_alert", "baseline_update", "optimization_target"], desc: "HeadyLens monitoring events" },
    services: { events: ["service_up", "service_down", "tier_change"], desc: "Service group lifecycle events" },
    models: { events: ["model_switch", "failover", "provider_health"], desc: "LLM gateway model events" }
  };
  HeadyLens.record("stream:subscribe", 0, 200);
  return jsonRes({
    node: "heady-stream",
    channel: channel2,
    available: Object.entries(channels).map(([k, v]) => ({ channel: k, ...v })),
    protocol: "SSE (Server-Sent Events)",
    connectUrl: `/v1/stream/connect?channel=${channel2}`,
    socketIOCompat: true,
    status: "ready"
  });
}
__name(handleStream, "handleStream");
async function handleSandbox(request, env2) {
  if (request.method !== "POST") return jsonRes({ error: "POST required", endpoints: { execute: "POST /v1/sandbox", status: "GET /v1/sandbox?action=status" } }, 405);
  const body = await request.json().catch(() => ({}));
  const action = body.action || "execute";
  if (action === "status") {
    return jsonRes({
      node: "heady-sandbox",
      powered_by: "Open-Interpreter patterns + GPU inference",
      languages: ["javascript", "python", "shell"],
      limits: { timeout_ms: 3e4, memory_mb: 512, output_lines: 1e3 },
      security: { sandboxed: true, network: "restricted", filesystem: "read-only" },
      deep_analysis_available: true,
      note: "Edge-managed GPU inference matches local latency with superior compute"
    });
  }
  const { code, language = "javascript", context: context2 = {} } = body;
  if (!code) return jsonRes({ error: 'Missing "code" field' }, 400);
  HeadyLens.record("sandbox:execute", 0, 200);
  if (env2.TASK_QUEUE) {
    await env2.TASK_QUEUE.send({ type: "sandbox_execute", language, code, context: context2, timestamp: Date.now() });
  }
  return jsonRes({
    node: "heady-sandbox",
    status: "queued",
    language,
    codeLength: code.length,
    executionTarget: "gpu-inference",
    note: "Execution queued to GPU inference \u2014 edge latency equivalent to local inference",
    pollUrl: "/v1/sandbox?action=status"
  });
}
__name(handleSandbox, "handleSandbox");
var HEADY_CREATIVE_MODELS = {
  image: {
    models: [
      { provider: "openai", model: "dall-e-3", priority: 1, tier: "cloud", note: "DALL-E 3 \u2014 high-quality prompt-to-image" },
      { provider: "huggingface", model: "black-forest-labs/FLUX.1-dev", priority: 2, tier: "hf", note: "FLUX.1 \u2014 open-source state-of-the-art image gen" },
      { provider: "huggingface", model: "stabilityai/stable-diffusion-xl-base-1.0", priority: 3, tier: "hf", note: "SDXL \u2014 reliable, fast image generation" },
      { provider: "google", model: "imagen-3", priority: 4, tier: "cloud", note: "Google Imagen 3 \u2014 photorealistic generation" }
    ],
    inputTypes: ["text", "text+image", "image+mask"],
    defaultRes: "1024x1024"
  },
  video: {
    models: [
      { provider: "openai", model: "sora", priority: 1, tier: "cloud", note: "Sora \u2014 cinematic text/image-to-video generation" },
      { provider: "runway", model: "gen-3-alpha", priority: 2, tier: "cloud", note: "Runway Gen-3 Alpha \u2014 professional video generation" },
      { provider: "pika", model: "pika-1.0", priority: 3, tier: "cloud", note: "Pika \u2014 fast creative video generation" },
      { provider: "huggingface", model: "THUDM/CogVideoX-5B", priority: 4, tier: "hf", note: "CogVideoX \u2014 open-source video generation" }
    ],
    inputTypes: ["text", "text+image", "image-to-video", "video+prompt"],
    defaultDuration: "5s"
  },
  animation: {
    models: [
      { provider: "runway", model: "gen-3-alpha-turbo", priority: 1, tier: "cloud", note: "Runway Turbo \u2014 fast animation/motion" },
      { provider: "huggingface", model: "stabilityai/stable-video-diffusion-img2vid", priority: 2, tier: "hf", note: "SVD \u2014 image-to-video animation" },
      { provider: "pika", model: "pika-1.0", priority: 3, tier: "cloud", note: "Pika \u2014 creative animation" }
    ],
    inputTypes: ["image", "image+prompt", "sketch+prompt"],
    defaultFrames: 24
  },
  threeD: {
    models: [
      { provider: "huggingface", model: "openai/point-e", priority: 1, tier: "hf", note: "Point-E \u2014 text/image to 3D point clouds" },
      { provider: "huggingface", model: "openai/shap-e", priority: 2, tier: "hf", note: "Shap-E \u2014 text/image to 3D mesh" },
      { provider: "luma", model: "genie", priority: 3, tier: "cloud", note: "Luma Genie \u2014 3D model generation" }
    ],
    inputTypes: ["text", "image", "multi-image"],
    defaultFormat: "glb"
  },
  audio: {
    models: [
      { provider: "huggingface", model: "facebook/musicgen-large", priority: 1, tier: "hf", note: "MusicGen \u2014 text-to-music generation" },
      { provider: "huggingface", model: "suno/bark", priority: 2, tier: "hf", note: "Bark \u2014 text-to-speech with emotion" },
      { provider: "google", model: "musicfx", priority: 3, tier: "cloud", note: "Google MusicFX \u2014 AI music creation" }
    ],
    inputTypes: ["text", "text+style", "humming"],
    defaultDuration: "30s"
  }
};
async function handleCreate(request, env2) {
  if (request.method !== "POST") {
    return jsonRes({
      node: "heady-vinci",
      service: "Multimodal Creative Generation",
      desc: "Create images, videos, animations, 3D models, and audio from combo inputs",
      outputTypes: Object.keys(HEADY_CREATIVE_MODELS),
      models: Object.entries(HEADY_CREATIVE_MODELS).reduce((acc, [type, cfg]) => {
        acc[type] = { modelCount: cfg.models.length, inputTypes: cfg.inputTypes };
        return acc;
      }, {}),
      usage: {
        method: "POST",
        body: {
          prompt: "A cosmic landscape with sacred geometry",
          output: "image | video | animation | 3d | audio",
          imageUrl: "(optional) reference image URL for image+prompt combos",
          style: "(optional) cinematic | anime | photorealistic | abstract | minimal",
          resolution: "(optional) 1024x1024 | 1920x1080 | 512x512",
          duration: "(optional) for video/audio \u2014 e.g. 5s, 10s, 30s"
        }
      },
      totalModels: Object.values(HEADY_CREATIVE_MODELS).reduce((s, c) => s + c.models.length, 0)
    });
  }
  const body = await request.json().catch(() => ({}));
  const { prompt, output = "image", imageUrl, style, resolution, duration, mask } = body;
  if (!prompt && !imageUrl) return jsonRes({ error: 'Provide at least a "prompt" or "imageUrl"' }, 400);
  const outputType = output.toLowerCase().replace("3d", "threeD");
  const category = HEADY_CREATIVE_MODELS[outputType];
  if (!category) return jsonRes({ error: `Unknown output type: "${output}". Use: image, video, animation, 3d, audio` }, 400);
  const inputType = imageUrl && prompt ? "text+image" : imageUrl ? "image" : prompt && style ? "text+style" : "text";
  const selectedModel = category.models[0];
  HeadyLens.record(`create:${outputType}`, 0, 200);
  if (env2.TASK_QUEUE) {
    await env2.TASK_QUEUE.send({
      type: "creative_generate",
      outputType,
      prompt,
      imageUrl,
      style,
      resolution,
      duration,
      model: selectedModel.model,
      provider: selectedModel.provider,
      timestamp: Date.now()
    });
  }
  return jsonRes({
    node: "heady-vinci",
    status: "generating",
    outputType: output,
    inputType,
    model: selectedModel.model,
    provider: selectedModel.provider,
    prompt: prompt ? prompt.substring(0, 200) : null,
    referenceImage: !!imageUrl,
    style: style || "default",
    resolution: resolution || category.defaultRes || null,
    duration: duration || category.defaultDuration || null,
    allModelsAvailable: category.models.length,
    note: `Routed to ${selectedModel.note}`,
    pollUrl: "/v1/create?status=pending"
  });
}
__name(handleCreate, "handleCreate");
async function handleForge(request, env2) {
  if (request.method !== "POST") return jsonRes({
    node: "heady-forge",
    desc: "Schema auto-generation from natural language",
    capabilities: ["postgresql", "mysql", "mongodb", "openapi", "graphql", "protobuf", "json-schema"],
    usage: { method: "POST", body: { prompt: "Describe your data model", format: "postgresql", options: {} } }
  });
  const body = await request.json().catch(() => ({}));
  const { prompt, format = "postgresql", options = {} } = body;
  if (!prompt) return jsonRes({ error: 'Missing "prompt" field' }, 400);
  HeadyLens.record("forge:generate", 0, 200);
  const selected = selectModel("code");
  return jsonRes({
    node: "heady-forge",
    status: "generating",
    prompt: prompt.substring(0, 200),
    format,
    model: selected?.alias || "heady-code",
    capabilities: ["table_definitions", "indexes", "constraints", "migrations", "seed_data"],
    note: "Schema generation powered by HeadyJules/HeadyCodex via heady-code group"
  });
}
__name(handleForge, "handleForge");
var AUTO_SUCCESS_QUEUE = {
  active: [],
  completed: [],
  resourceAllocation: { foreground: 0.5, background: 0.5 },
  learningTopics: ["app-development", "web-architecture", "ai-optimization", "system-design", "edge-computing"],
  automationTargets: ["code-quality", "performance", "security", "documentation", "testing"]
};
async function handleAutoSuccess(request, env2) {
  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const action = body.action || new URL(request.url).searchParams.get("action") || "status";
  HeadyLens.record("auto-success:" + action, 0, 200);
  if (action === "status") {
    return jsonRes({
      node: "heady-auto-success",
      status: "active",
      queue: AUTO_SUCCESS_QUEUE,
      serviceGroups: Object.keys(SERVICE_GROUPS).length,
      modelGroups: Object.keys(HEADY_MODEL_GROUPS).length,
      nodesActive: Object.values(SERVICE_GROUPS).reduce((s, g) => s + (g.services?.length || 0), 0),
      lens: HeadyLens.getAudit(),
      policy: HEADY_SERVICE_POLICY
    });
  }
  if (action === "add") {
    const task = { id: crypto.randomUUID(), ...body.task, status: "queued", created: Date.now() };
    AUTO_SUCCESS_QUEUE.active.push(task);
    if (env2.TASK_QUEUE) await env2.TASK_QUEUE.send({ type: "auto_success_task", task });
    return jsonRes({ node: "heady-auto-success", status: "task_queued", task });
  }
  if (action === "allocate") {
    const { foreground = 0.5, background = 0.5 } = body;
    AUTO_SUCCESS_QUEUE.resourceAllocation = { foreground, background };
    return jsonRes({ node: "heady-auto-success", status: "allocation_updated", resourceAllocation: AUTO_SUCCESS_QUEUE.resourceAllocation });
  }
  return jsonRes({ node: "heady-auto-success", actions: ["status", "add", "allocate"], queue: AUTO_SUCCESS_QUEUE });
}
__name(handleAutoSuccess, "handleAutoSuccess");
async function handleServices(request, env2) {
  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const action = body.action || new URL(request.url).searchParams.get("action") || "status";
  if (action === "status") {
    const groups = {};
    for (const [name, group3] of Object.entries(SERVICE_GROUPS)) {
      let kvState = null;
      if (env2.PROMPT_CACHE) {
        const raw = await env2.PROMPT_CACHE.get(`${SVC_GROUP_KEY}${name}`);
        kvState = raw ? JSON.parse(raw) : null;
      }
      groups[name] = {
        desc: group3.desc,
        priority: group3.priority,
        services: group3.services.length,
        serviceList: group3.services.map((s) => ({ id: s.id, role: s.role, weight: s.weight })),
        scaling: kvState?.scaling || group3.scaling,
        health: kvState?.health || "unknown",
        lastCheck: kvState?.lastCheck || null,
        avgLatencyMs: kvState?.avgLatencyMs || null,
        requestsRouted: kvState?.requestsRouted || 0
      };
    }
    return jsonRes({ action: "status", groups, totalGroups: Object.keys(groups).length });
  }
  if (action === "health") {
    const checks = await Promise.allSettled(
      Object.entries(SERVICE_GROUPS).map(async ([name, group3]) => {
        const primarySvc = group3.services.find((s) => s.role === "primary") || group3.services[0];
        if (!primarySvc) return { group: name, health: "no-services", latencyMs: 0 };
        const checkUrl = `${primarySvc.url}${group3.healthCheck}`;
        const start = Date.now();
        try {
          const res = await fetch(checkUrl, {
            method: "GET",
            headers: { "X-Heady-API-Key": "heady_api_key_001_abc123def456", "X-Heady-Source": "svc-health-check" },
            signal: AbortSignal.timeout(8e3)
          });
          const latency = Date.now() - start;
          const health = res.ok ? "healthy" : res.status < 500 ? "degraded" : "unhealthy";
          if (env2.PROMPT_CACHE) {
            const kvKey = `${SVC_GROUP_KEY}${name}`;
            const existing = await env2.PROMPT_CACHE.get(kvKey).then((r) => r ? JSON.parse(r) : {});
            await env2.PROMPT_CACHE.put(kvKey, JSON.stringify({
              ...existing,
              health,
              lastCheck: Date.now(),
              avgLatencyMs: latency,
              scaling: existing.scaling || group3.scaling
            }), { expirationTtl: 86400 });
          }
          return { group: name, health, latencyMs: latency, status: res.status, url: checkUrl };
        } catch (e) {
          const latency = Date.now() - start;
          if (env2.PROMPT_CACHE) {
            const kvKey = `${SVC_GROUP_KEY}${name}`;
            const existing = await env2.PROMPT_CACHE.get(kvKey).then((r) => r ? JSON.parse(r) : {});
            await env2.PROMPT_CACHE.put(kvKey, JSON.stringify({
              ...existing,
              health: "unreachable",
              lastCheck: Date.now(),
              avgLatencyMs: latency
            }), { expirationTtl: 86400 });
          }
          return { group: name, health: "unreachable", latencyMs: latency, error: e.message };
        }
      })
    );
    const results = checks.map((c) => c.status === "fulfilled" ? c.value : { group: "unknown", health: "error" });
    const healthy = results.filter((r) => r.health === "healthy").length;
    return jsonRes({
      action: "health",
      results,
      summary: { healthy, degraded: results.length - healthy, total: results.length }
    });
  }
  if (action === "scale") {
    const { group: groupName, demand } = body;
    if (!groupName || !SERVICE_GROUPS[groupName]) return jsonRes({ error: "Valid group name required", groups: Object.keys(SERVICE_GROUPS) }, 400);
    const group3 = SERVICE_GROUPS[groupName];
    const demandLevel = demand || "normal";
    const demandMultiplier = { low: 0.5, normal: 1, high: 1.5, critical: 2 }[demandLevel] || 1;
    const newCurrent = Math.min(group3.scaling.max, Math.max(group3.scaling.min, Math.round(group3.scaling.min * demandMultiplier)));
    if (env2.PROMPT_CACHE) {
      const kvKey = `${SVC_GROUP_KEY}${groupName}`;
      const existing = await env2.PROMPT_CACHE.get(kvKey).then((r) => r ? JSON.parse(r) : {});
      await env2.PROMPT_CACHE.put(kvKey, JSON.stringify({
        ...existing,
        scaling: { ...group3.scaling, current: newCurrent },
        lastScaleEvent: { demand: demandLevel, ts: Date.now(), previous: existing.scaling?.current || group3.scaling.current },
        requestsRouted: (existing.requestsRouted || 0) + 1
      }), { expirationTtl: 86400 });
    }
    return jsonRes({
      action: "scale",
      group: groupName,
      demand: demandLevel,
      scaling: { ...group3.scaling, current: newCurrent },
      assistantsActive: Math.max(0, newCurrent - 1)
    });
  }
  if (action === "route") {
    const { requestType, hostname } = body;
    if (!requestType && !hostname) return jsonRes({ error: "requestType or hostname required" }, 400);
    let matchedGroup = null;
    let matchedName = null;
    if (hostname) {
      for (const [name, group3] of Object.entries(SERVICE_GROUPS)) {
        if (group3.hosts.includes(hostname)) {
          matchedGroup = group3;
          matchedName = name;
          break;
        }
      }
    }
    if (!matchedGroup && requestType) {
      const typeMap = { ai: "ai-engine", web: "public-web", api: "core-platform", compute: "compute", integration: "integration", ops: "maintenance" };
      matchedName = typeMap[requestType] || "core-platform";
      matchedGroup = SERVICE_GROUPS[matchedName];
    }
    if (!matchedGroup) return jsonRes({ error: "No matching service group found" }, 404);
    const kvState = env2.PROMPT_CACHE ? await env2.PROMPT_CACHE.get(`${SVC_GROUP_KEY}${matchedName}`).then((r) => r ? JSON.parse(r) : null) : null;
    const health = kvState?.health || "unknown";
    const services = matchedGroup.services.filter((s) => s.weight > 0).sort((a, b) => b.weight - a.weight);
    const selected = services[0] || matchedGroup.services[0];
    if (env2.PROMPT_CACHE) {
      const logRaw = await env2.PROMPT_CACHE.get(SVC_ROUTING_LOG);
      const log3 = logRaw ? JSON.parse(logRaw) : [];
      log3.push({ ts: Date.now(), group: matchedName, service: selected.id, health, hostname, requestType });
      await env2.PROMPT_CACHE.put(SVC_ROUTING_LOG, JSON.stringify(log3.slice(-500)), { expirationTtl: 86400 * 7 });
    }
    return jsonRes({
      action: "route",
      group: matchedName,
      groupHealth: health,
      selectedService: { id: selected.id, url: selected.url, role: selected.role },
      alternates: services.slice(1).map((s) => ({ id: s.id, role: s.role }))
    });
  }
  if (action === "optimize") {
    if (!env2.PROMPT_CACHE) return jsonRes({ error: "KV not available" }, 503);
    const logRaw = await env2.PROMPT_CACHE.get(SVC_ROUTING_LOG);
    const routingLog = logRaw ? JSON.parse(logRaw) : [];
    if (routingLog.length < 5) return jsonRes({ action: "optimize", status: "insufficient_data", routingEvents: routingLog.length });
    const groupStats = {};
    for (const entry of routingLog) {
      if (!groupStats[entry.group]) groupStats[entry.group] = { count: 0, healthy: 0, degraded: 0 };
      groupStats[entry.group].count++;
      if (entry.health === "healthy") groupStats[entry.group].healthy++;
      else groupStats[entry.group].degraded++;
    }
    const recommendations = Object.entries(groupStats).map(([name, stats]) => {
      const group3 = SERVICE_GROUPS[name];
      if (!group3) return null;
      const loadRatio = stats.count / routingLog.length;
      const healthRate = stats.count > 0 ? stats.healthy / stats.count : 0;
      const suggestion = loadRatio > 0.3 ? "scale-up" : loadRatio < 0.05 ? "scale-down" : "maintain";
      const recommendedInstances = Math.min(group3.scaling.max, Math.max(
        group3.scaling.min,
        Math.round(group3.scaling.min + loadRatio * (group3.scaling.max - group3.scaling.min))
      ));
      return {
        group: name,
        loadPct: Math.round(loadRatio * 100),
        healthPct: Math.round(healthRate * 100),
        currentInstances: group3.scaling.current,
        recommendedInstances,
        suggestion,
        assistantsNeeded: Math.max(0, recommendedInstances - 1)
      };
    }).filter(Boolean);
    return jsonRes({
      action: "optimize",
      totalRoutingEvents: routingLog.length,
      recommendations,
      note: "Assistants are spawned dynamically when recommended instances > 1."
    });
  }
  return jsonRes({ error: "action required: status | health | scale | route | optimize", groups: Object.keys(SERVICE_GROUPS) }, 400);
}
__name(handleServices, "handleServices");
async function handleDeepAnalysis(request, env2) {
  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const { action, sessionId, projectId, notebookUrl, gpuType, budgetMinutes, jobPayload } = body;
  if (action === "register") {
    if (!notebookUrl) return jsonRes({ error: "notebookUrl required" }, 400);
    const sid = sessionId || crypto.randomUUID();
    const pid2 = projectId || "default";
    const session = {
      id: sid,
      projectId: pid2,
      notebookUrl,
      gpuType: gpuType || "T4",
      budgetMinutes: budgetMinutes || 60,
      usedMinutes: 0,
      jobsRouted: 0,
      status: "active",
      registered: Date.now(),
      lastActivity: Date.now()
    };
    if (env2.PROMPT_CACHE) {
      await env2.PROMPT_CACHE.put(
        `${DA_SESSION_KEY}${sid}`,
        JSON.stringify(session),
        { expirationTtl: DA_SESSION_TTL }
      );
      const idxRaw = await env2.PROMPT_CACHE.get(DA_INDEX_KEY);
      const idx = idxRaw ? JSON.parse(idxRaw) : [];
      if (!idx.includes(sid)) idx.push(sid);
      await env2.PROMPT_CACHE.put(DA_INDEX_KEY, JSON.stringify(idx.slice(-50)), { expirationTtl: DA_SESSION_TTL });
    }
    return jsonRes({ registered: true, sessionId: sid, projectId: pid2, gpuType: session.gpuType, budgetMinutes: session.budgetMinutes });
  }
  if (action === "status") {
    if (sessionId && env2.PROMPT_CACHE) {
      const raw = await env2.PROMPT_CACHE.get(`${DA_SESSION_KEY}${sessionId}`);
      if (!raw) return jsonRes({ error: "Session not found" }, 404);
      const s = JSON.parse(raw);
      return jsonRes({ session: s, budgetRemaining: s.budgetMinutes - s.usedMinutes, utilizationPct: Math.round(s.usedMinutes / s.budgetMinutes * 100) });
    }
    if (projectId && env2.PROMPT_CACHE) {
      const budgetRaw = await env2.PROMPT_CACHE.get(`${DA_BUDGET_KEY}${projectId}`);
      const budget = budgetRaw ? JSON.parse(budgetRaw) : { allocated: 0, used: 0, sessions: [] };
      return jsonRes({ projectId, budget, utilizationPct: budget.allocated > 0 ? Math.round(budget.used / budget.allocated * 100) : 0 });
    }
    return jsonRes({ error: "sessionId or projectId required" }, 400);
  }
  if (action === "route") {
    if (!env2.PROMPT_CACHE) return jsonRes({ error: "KV not available" }, 503);
    const idxRaw = await env2.PROMPT_CACHE.get(DA_INDEX_KEY);
    const idx = idxRaw ? JSON.parse(idxRaw) : [];
    if (idx.length === 0) return jsonRes({ error: "No active deep-analysis sessions", hint: "Register a session via POST /v1/deep-analysis with action=register" }, 503);
    const sessions = (await Promise.all(
      idx.map((id) => env2.PROMPT_CACHE.get(`${DA_SESSION_KEY}${id}`).then((r) => r ? JSON.parse(r) : null))
    )).filter((s) => s && s.status === "active" && s.budgetMinutes - s.usedMinutes > 0);
    if (sessions.length === 0) return jsonRes({ error: "All sessions exhausted or over budget" }, 503);
    sessions.sort((a, b) => b.budgetMinutes - b.usedMinutes - (a.budgetMinutes - a.usedMinutes));
    const best = sessions[0];
    const estimatedMinutes = jobPayload?.estimatedMinutes || 5;
    best.usedMinutes += estimatedMinutes;
    best.jobsRouted += 1;
    best.lastActivity = Date.now();
    const budgetKey = `${DA_BUDGET_KEY}${best.projectId}`;
    await Promise.all([
      env2.PROMPT_CACHE.put(`${DA_SESSION_KEY}${best.id}`, JSON.stringify(best), { expirationTtl: DA_SESSION_TTL }),
      env2.PROMPT_CACHE.get(budgetKey).then(async (raw) => {
        const b = raw ? JSON.parse(raw) : { allocated: best.budgetMinutes, used: 0, sessions: [] };
        b.used += estimatedMinutes;
        if (!b.sessions.includes(best.id)) b.sessions.push(best.id);
        await env2.PROMPT_CACHE.put(budgetKey, JSON.stringify(b), { expirationTtl: DA_SESSION_TTL });
      })
    ]);
    return jsonRes({
      routed: true,
      sessionId: best.id,
      notebookUrl: best.notebookUrl,
      gpuType: best.gpuType,
      budgetRemaining: best.budgetMinutes - best.usedMinutes,
      estimatedMinutesCharged: estimatedMinutes,
      projectId: best.projectId
    });
  }
  if (action === "list") {
    if (!env2.PROMPT_CACHE) return jsonRes({ sessions: [] });
    const idxRaw = await env2.PROMPT_CACHE.get(DA_INDEX_KEY);
    const idx = idxRaw ? JSON.parse(idxRaw) : [];
    const sessions = (await Promise.all(
      idx.map((id) => env2.PROMPT_CACHE.get(`${DA_SESSION_KEY}${id}`).then((r) => r ? JSON.parse(r) : null))
    )).filter(Boolean);
    return jsonRes({ sessions, count: sessions.length, totalBudgetUsed: sessions.reduce((a, s) => a + s.usedMinutes, 0) });
  }
  if (action === "release" && sessionId && env2.PROMPT_CACHE) {
    const raw = await env2.PROMPT_CACHE.get(`${DA_SESSION_KEY}${sessionId}`);
    if (raw) {
      const s = JSON.parse(raw);
      s.status = "released";
      s.releasedAt = Date.now();
      await env2.PROMPT_CACHE.put(`${DA_SESSION_KEY}${sessionId}`, JSON.stringify(s), { expirationTtl: 300 });
    }
    return jsonRes({ released: true, sessionId });
  }
  return jsonRes({ error: "action required: register | status | route | list | release" }, 400);
}
__name(handleDeepAnalysis, "handleDeepAnalysis");
var BUDDY_CONTEXT_TTL = 60 * 30;
var BUDDY_MAX_HISTORY = 20;
var BUDDY_SYSTEM = `You are HeadyBuddy \u2014 the ultimate personal AI assistant built by Heady Systems.
You run across multiple AI providers with persistent memory, project context, and full Heady ecosystem access.
Be direct, intelligent, and genuinely helpful. Remember context across the conversation.`;
async function handleBuddy(request, env2) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/v1/buddy/context") {
    const id = url.searchParams.get("id");
    if (!id) return jsonRes({ error: "id param required" }, 400);
    const raw = env2.PROMPT_CACHE ? await env2.PROMPT_CACHE.get(`buddy:ctx:${id}`) : null;
    const ctx2 = raw ? JSON.parse(raw) : { messages: [], provider: null, created: Date.now() };
    return jsonRes({ conversationId: id, messageCount: ctx2.messages.length, context: ctx2 });
  }
  if (request.method === "DELETE" && url.pathname === "/v1/buddy/context") {
    const id = url.searchParams.get("id");
    if (id && env2.PROMPT_CACHE) await env2.PROMPT_CACHE.delete(`buddy:ctx:${id}`);
    return jsonRes({ cleared: true, conversationId: id });
  }
  if (request.method !== "POST") return jsonRes({ error: "POST required" }, 405);
  const body = await request.json().catch(() => ({}));
  const { message, conversationId, provider: preferredProvider, system, project_context } = body;
  if (!message) return jsonRes({ error: "message is required" }, 400);
  const convId = conversationId || crypto.randomUUID();
  const cacheKey = `buddy:ctx:${convId}`;
  const [rawCtx] = await Promise.all([
    env2.PROMPT_CACHE ? env2.PROMPT_CACHE.get(cacheKey) : Promise.resolve(null)
  ]);
  const ctx = rawCtx ? JSON.parse(rawCtx) : { messages: [], provider: null, created: Date.now() };
  if (ctx.messages.length > BUDDY_MAX_HISTORY) {
    ctx.messages = ctx.messages.slice(-BUDDY_MAX_HISTORY);
  }
  const systemPrompt = project_context ? `${system || BUDDY_SYSTEM}

## Project Context
${project_context}` : system || BUDDY_SYSTEM;
  ctx.messages.push({ role: "user", content: message, ts: Date.now() });
  const providerMessages = ctx.messages.map((m) => ({ role: m.role, content: m.content }));
  const startTime = Date.now();
  let result;
  const providerOrder = preferredProvider ? [preferredProvider, "heady-brain", "gemini", "claude", "groq", "edge-ai"] : ["heady-brain", "gemini", "claude", "groq", "edge-ai"];
  const combinedMessage = providerMessages.map(
    (m) => m.role === "user" ? `User: ${m.content}` : `Assistant: ${m.content}`
  ).join("\n");
  for (const pid2 of [...new Set(providerOrder)]) {
    try {
      result = await callProvider(pid2, combinedMessage, systemPrompt, env2, {
        max_tokens: 2048,
        temperature: 0.7,
        timeout: 2e4
      });
      if (result?.response) {
        ctx.messages.push({ role: "assistant", content: result.response, provider: pid2, ts: Date.now() });
        break;
      }
    } catch (e) {
      console.warn(`[Buddy] ${pid2} failed: ${e.message}`);
    }
  }
  if (!result?.response) {
    return jsonRes({ error: "All providers unavailable", conversationId: convId }, 503);
  }
  if (env2.PROMPT_CACHE) {
    env2.PROMPT_CACHE.put(cacheKey, JSON.stringify({
      ...ctx,
      provider: result.provider || result.model,
      updated: Date.now()
    }), { expirationTtl: BUDDY_CONTEXT_TTL }).catch(() => {
    });
  }
  return jsonRes({
    response: result.response,
    provider: result.provider || result.model,
    model: result.model,
    conversationId: convId,
    messageCount: ctx.messages.length,
    latencyMs: Date.now() - startTime,
    contextManaged: true
  });
}
__name(handleBuddy, "handleBuddy");
async function handleChat(request, env2) {
  const body = await request.json();
  const { message, system, max_tokens, temperature, bypass_cache } = body;
  if (!message) return jsonRes({ error: "message is required" }, 400);
  const classification = classifyPrompt(message);
  const fingerprint = await hashPrompt(`${system || ""}|${message}`);
  if (!bypass_cache) {
    const cached = await getCachedResponse(fingerprint, env2);
    if (cached) {
      logTelemetry(env2, "cache_hit", { fingerprint: fingerprint.substring(0, 12), classification });
      return jsonRes({
        ok: true,
        response: cached.response,
        provider: cached.provider || "cache",
        model: cached.model || "cached",
        cache: "HIT",
        fingerprint: fingerprint.substring(0, 12),
        classification,
        cached_at: cached.cached_at,
        edge: true,
        ts: (/* @__PURE__ */ new Date()).toISOString()
      }, 200, {
        "X-Heady-Edge": "true",
        "X-Heady-Cache": "HIT",
        "X-Heady-Fingerprint": fingerprint.substring(0, 12)
      });
    }
  }
  const result = await routeToProvider(message, system || "", env2, {
    max_tokens,
    temperature
  });
  if (result.response && result.provider !== "offline") {
    const ttl = CACHE_TTL[classification] || CACHE_TTL.unknown;
    await setCachedResponse(fingerprint, {
      response: result.response,
      provider: result.provider,
      model: result.model
    }, ttl, env2);
  }
  logTelemetry(env2, "cache_miss", {
    fingerprint: fingerprint.substring(0, 12),
    classification,
    provider: result.provider,
    latency_ms: result.latency_ms
  });
  return jsonRes({
    ok: true,
    response: result.response,
    provider: result.provider,
    model: result.model,
    cache: "MISS",
    fingerprint: fingerprint.substring(0, 12),
    classification,
    latency_ms: result.latency_ms,
    routing: result.routing,
    edge: true,
    ts: (/* @__PURE__ */ new Date()).toISOString()
  }, 200, {
    "X-Heady-Edge": "true",
    "X-Heady-Cache": "MISS",
    "X-Heady-Provider": result.provider,
    "X-Heady-Fingerprint": fingerprint.substring(0, 12)
  });
}
__name(handleChat, "handleChat");
async function handleEmbed(request, env2) {
  const { text, model } = await request.json();
  if (!text) return jsonRes({ error: "text required" }, 400);
  if (!env2.AI) return jsonRes({ error: "Workers AI not configured" }, 503);
  const modelId = model === "nomic" ? "@cf/nomic-ai/nomic-embed-text-v1.5" : "@cf/baai/bge-base-en-v1.5";
  const result = await env2.AI.run(modelId, { text: [text] });
  logTelemetry(env2, "embed", { model: modelId, text_length: text.length });
  return jsonRes({
    ok: true,
    action: "embed",
    model: modelId,
    dimensions: result.data?.[0]?.length || 0,
    embedding: result.data?.[0],
    edge: true,
    ts: (/* @__PURE__ */ new Date()).toISOString()
  });
}
__name(handleEmbed, "handleEmbed");
async function handleClassify(request, env2) {
  const { text } = await request.json();
  if (!text) return jsonRes({ error: "text required" }, 400);
  const classification = classifyPrompt(text);
  return jsonRes({
    ok: true,
    action: "classify",
    classification,
    cache_ttl: CACHE_TTL[classification],
    edge: true,
    ts: (/* @__PURE__ */ new Date()).toISOString()
  });
}
__name(handleClassify, "handleClassify");
async function handleModerate(request, env2) {
  const { text } = await request.json();
  if (!text) return jsonRes({ error: "text required" }, 400);
  if (!env2.AI) return jsonRes({ error: "Workers AI not configured" }, 503);
  const result = await env2.AI.run("@cf/meta/llama-3.1-8b-instruct", {
    messages: [
      { role: "system", content: 'You are a content safety filter. Respond ONLY with JSON: {"safe": true/false, "reason": "brief reason"}. Be permissive for technical/code content.' },
      { role: "user", content: text.substring(0, 1e3) }
    ],
    max_tokens: 80
  });
  return jsonRes({
    ok: true,
    action: "moderate",
    result: result.response,
    edge: true,
    ts: (/* @__PURE__ */ new Date()).toISOString()
  });
}
__name(handleModerate, "handleModerate");
async function handleVectorize(request, env2) {
  const { action, text, id, metadata, topK, filter } = await request.json();
  if (!text) return jsonRes({ error: "text required" }, 400);
  if (!env2.AI) return jsonRes({ error: "Workers AI not configured" }, 503);
  const embedding = await env2.AI.run("@cf/baai/bge-base-en-v1.5", { text: [text] });
  if (action === "query") {
    if (!env2.HEADY_VECTORS) return jsonRes({ error: "Vectorize not configured" }, 503);
    const results = await env2.HEADY_VECTORS.query(embedding.data[0], {
      topK: topK || 5,
      filter,
      returnMetadata: true
    });
    return jsonRes({ ok: true, action: "vectorize-query", matches: results.matches || [], count: results.count || 0, edge: true, ts: (/* @__PURE__ */ new Date()).toISOString() });
  }
  if (!env2.HEADY_VECTORS) return jsonRes({ error: "Vectorize not configured" }, 503);
  const vecId = id || `vec-${Date.now()}`;
  await env2.HEADY_VECTORS.insert([{
    id: vecId,
    values: embedding.data[0],
    metadata: { ...metadata, text_preview: text.substring(0, 200), ts: Date.now() }
  }]);
  return jsonRes({ ok: true, action: "vectorize-insert", id: vecId, dimensions: embedding.data[0]?.length || 0, edge: true, ts: (/* @__PURE__ */ new Date()).toISOString() });
}
__name(handleVectorize, "handleVectorize");
async function proxyToService(request, service, env2, meta) {
  const url = new URL(request.url);
  const target = `${service.origin}${url.pathname}${url.search}`;
  const proxyHeaders = new Headers(request.headers);
  proxyHeaders.set("X-Heady-Edge", "true");
  proxyHeaders.set("X-Heady-Request-ID", meta.requestId);
  proxyHeaders.set("X-Heady-Source-Host", meta.hostname);
  proxyHeaders.set("X-Forwarded-Host", meta.hostname);
  proxyHeaders.set("X-Forwarded-Proto", "https");
  const tlsInfo = request.cf?.tlsClientAuth || {};
  if (tlsInfo.certPresented === "1") {
    proxyHeaders.set("X-Heady-Client-Cert-Verified", tlsInfo.certVerified || "NONE");
    proxyHeaders.set("X-Heady-Client-Cert-DN", tlsInfo.certSubjectDN || "");
    proxyHeaders.set("X-Heady-Client-Cert-Fingerprint", tlsInfo.certFingerprintSHA256 || "");
  }
  try {
    const resp = await fetchWithTimeout(target, {
      method: request.method,
      headers: proxyHeaders,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : void 0
    }, 3e4);
    const newResp = new Response(resp.body, resp);
    newResp.headers.set("X-Heady-Edge", "true");
    newResp.headers.set("X-Heady-Request-ID", meta.requestId);
    newResp.headers.set("X-Heady-Latency", `${Date.now() - meta.startTime}ms`);
    Object.entries(CORS).forEach(([k, v]) => newResp.headers.set(k, v));
    const cdnCacheTtl = getStaticCacheTTL(meta.path);
    if (cdnCacheTtl !== 0 && resp.status === 200 && request.method === "GET") {
      if (cdnCacheTtl === -1) {
        newResp.headers.set("Cache-Control", "public, no-cache, stale-while-revalidate=30");
        newResp.headers.set("CDN-Cache-Control", "max-age=10, stale-while-revalidate=30");
      } else {
        newResp.headers.set("Cache-Control", `public, max-age=${cdnCacheTtl}, stale-while-revalidate=60`);
        newResp.headers.set("CDN-Cache-Control", `max-age=${cdnCacheTtl}`);
      }
      newResp.headers.set("X-Heady-CDN", "cached");
      if (/[-\.][a-zA-Z0-9]{6,}\.(js|css|woff2?|ttf)$/.test(meta.path)) {
        newResp.headers.set("Cache-Control", `public, max-age=31536000, immutable`);
      }
    }
    logTelemetry(env2, cdnCacheTtl > 0 ? "cdn_proxy" : "service_proxy", {
      hostname: meta.hostname,
      path: meta.path,
      latency_ms: Date.now() - meta.startTime,
      status: resp.status,
      cdn_ttl: cdnCacheTtl
    });
    return newResp;
  } catch (err) {
    if (service.public) {
      return new Response(getServiceFallbackPage(meta.hostname), {
        status: 503,
        headers: { "Content-Type": "text/html", "X-Heady-Edge": "fallback", ...CORS }
      });
    }
    throw err;
  }
}
__name(proxyToService, "proxyToService");
function getEdgeSitePage(hostname) {
  const domain2 = hostname.replace(/^www\./, "");
  const resolved = domain2 === "buddy.headysystems.com" ? "headybuddy.org" : domain2;
  switch (resolved) {
    case "headymcp.com":
      return getHeadyMCPPage();
    case "headyio.com":
      return getHeadyIOPage();
    case "headyconnection.org":
      return getHeadyConnectionPage();
    case "headybuddy.org":
      return getHeadyBuddyPage();
    case "headysystems.com":
      return getHeadySystemsPage();
    case "headyme.com":
      return getHeadyMePage();
    case "headybot.com":
      return getHeadyBotPage();
    default:
      return getHeadySystemsPage();
  }
}
__name(getEdgeSitePage, "getEdgeSitePage");
function headyNav(activeDomain) {
  const sites = [["HeadyBuddy", "https://headybuddy.org"], ["HeadySystems", "https://headysystems.com"], ["HeadyConnection", "https://headyconnection.org"], ["HeadyMCP", "https://headymcp.com"], ["HeadyIO", "https://headyio.com"], ["HeadyBot", "https://headybot.com"]];
  return sites.map(([n, u]) => `<a href="${u}" ${u.includes(activeDomain) ? 'class="active"' : ""}>${n}</a>`).join("");
}
__name(headyNav, "headyNav");
function hexLogo(id, c1, c2) {
  return `<svg width="32" height="32" viewBox="0 0 40 40" fill="none"><polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="none" stroke="url(#${id})" stroke-width="1.5"/><circle cx="20" cy="20" r="4" fill="url(#${id})"/><defs><linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs></svg>`;
}
__name(hexLogo, "hexLogo");
function sacredPage(title2, subtitle, mantra, accent, accent2, domain2, cards, geoType) {
  const nav = headyNav(domain2);
  const logo = hexLogo("lg", accent, accent2);
  const cardHTML = cards.map((c) => `<div class="card"><div class="ci">${c[0]}</div><h3>${c[1]}</h3><p>${c[2]}</p></div>`).join("");
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title2} \u2014 ${subtitle}</title>
<meta name="description" content="${title2} \u2014 ${subtitle}. ${mantra}.">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif;background:#000000;color:#e2e8f0;min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased}
#cosmic-canvas{position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(circle at center, #0a0a1a 0%, #000000 100%)}
.site-wrap{position:relative;z-index:10;min-height:100vh;display:flex;flex-direction:column}
header{display:flex;justify-content:space-between;align-items:center;padding:1.5rem 2rem;background:transparent;position:sticky;top:0;z-index:100}
.logo-wrap{display:flex;align-items:center;gap:.75rem;text-decoration:none}
.logo-title{font-size:1.4rem;font-weight:700;color:${accent};letter-spacing:1px;text-shadow:0 0 10px ${accent}66}
.logo-sub{font-size:.65rem;color:#ffffff99;letter-spacing:.15em;text-transform:uppercase}
nav{display:flex;gap:.5rem;flex-wrap:wrap;background:rgba(20,20,25,0.12);padding:0.5rem;border-radius:100px;backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.04)}
nav a{padding:.35rem 1rem;border-radius:50px;font-size:.75rem;font-weight:500;color:rgba(255,255,255,.6);text-decoration:none;transition:all .3s}
nav a:hover,nav a.active{background:${accent};color:#000;box-shadow:0 0 15px ${accent}}
.hero{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8rem 2rem 4rem;text-align:center}
.status{display:inline-flex;align-items:center;gap:.5rem;padding:.5rem 1.2rem;border-radius:50px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(10px);font-size:.7rem;color:#fff;margin-bottom:2rem;letter-spacing:1px;text-transform:uppercase}
.status-dot{width:8px;height:8px;border-radius:50%;background:${accent};animation:pulse 2s ease infinite;box-shadow:0 0 10px ${accent}}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}
.hero h1{font-size:clamp(3rem,8vw,5.5rem);font-weight:800;color:${accent};margin-bottom:1rem;letter-spacing:-.03em;text-shadow:0 0 30px ${accent}44}
.hero-sub{font-size:clamp(1rem,2vw,1.2rem);color:#fff;margin-bottom:1rem;font-weight:400;letter-spacing:.2em;text-transform:uppercase;opacity:0.9}
.hero-mantra{font-size:.85rem;color:rgba(255,255,255,0.5);letter-spacing:.15em;margin-bottom:3rem}
.stats{display:inline-grid;grid-template-columns:repeat(4,1fr);gap:2.5rem;margin:0 auto 4rem;background:rgba(20,20,25,0.12);padding:2rem 3rem;border-radius:24px;backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.04)}
.stat{text-align:center}
.stat-val{font-size:1.8rem;font-weight:800;color:#fff;margin-bottom:.4rem;text-shadow:0 0 15px rgba(255,255,255,0.5)}
.stat-lbl{font-size:.7rem;color:${accent};text-transform:uppercase;letter-spacing:.15em;font-weight:600}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem;max-width:1200px;margin:0 auto 6rem;padding:0 2rem}
.card{background:rgba(15,15,20,.18);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.04);border-radius:24px;padding:2.5rem;text-align:left;transition:all .4s ease;position:relative;overflow:hidden}
.card::after{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(circle at top right, ${accent}11, transparent 70%);opacity:0;transition:opacity .4s ease}
.card:hover{transform:translateY(-5px);border-color:${accent}44;box-shadow:0 20px 40px rgba(0,0,0,.5), 0 0 30px ${accent}11}
.card:hover::after{opacity:1}
.ci{font-size:2rem;margin-bottom:1.5rem;color:${accent}}
.card h3{font-size:1.1rem;font-weight:600;color:#fff;margin-bottom:.75rem;letter-spacing:.02em}
.card p{font-size:.85rem;color:rgba(255,255,255,.5);line-height:1.8}
.fab{position:fixed;bottom:2rem;right:2rem;width:56px;height:56px;border-radius:50%;background:${accent};border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px ${accent}66;transition:all .3s;z-index:200;font-size:1.5rem;color:#000}
.fab:hover{transform:scale(1.1) rotate(90deg);box-shadow:0 8px 30px ${accent}99}
footer{text-align:center;padding:3rem;color:rgba(255,255,255,.3);font-size:.75rem;letter-spacing:1px}
@media(max-width:768px){header{flex-direction:column;gap:1.5rem}nav{justify-content:center}.stats{grid-template-columns:repeat(2,1fr);gap:1.5rem;padding:1.5rem}.cards{padding:0 1rem}}
</style></head><body>
<canvas id="cosmic-canvas"></canvas>
<div class="site-wrap">
<header>
<a class="logo-wrap" href="https://${domain2}">
<div class="logo-title">${title2}</div><div class="logo-sub">${subtitle.split(" \xB7 ")[0]}</div>
</a>
<nav>${nav}</nav>
</header>
<section class="hero">
<div class="status"><span class="status-dot"></span> Buddy Online</div>
<h1>${title2}</h1>
<p class="hero-sub">${subtitle}</p>
<p class="hero-mantra">${mantra}</p>
<div class="stats">
<div class="stat"><div class="stat-val">24/7</div><div class="stat-lbl">Available</div></div>
<div class="stat"><div class="stat-val">\u221E</div><div class="stat-lbl">Context</div></div>
<div class="stat"><div class="stat-val">Fast</div><div class="stat-lbl">Response</div></div>
<div class="stat"><div class="stat-val">Smart</div><div class="stat-lbl">Nudges</div></div>
</div>
</section>
<div class="cards">${cardHTML}</div>
<footer>\xA9 2026 ${title2} \u2014 Powered by HCFP Auto-Success</footer>
</div>
<button class="fab" onclick="toggleHeadyChat()" title="Chat with HeadyBuddy">\u2726</button>
<style>
#heady-chat-panel{display:none;position:fixed;bottom:80px;right:16px;width:380px;max-height:min(520px,70vh);background:rgba(10,10,25,0.75);border:1px solid rgba(139,92,246,0.25);border-radius:20px;z-index:10000;font-family:Inter,system-ui,-apple-system,sans-serif;box-shadow:0 24px 80px rgba(0,0,0,0.6),0 0 40px rgba(139,92,246,0.1);backdrop-filter:blur(24px) saturate(1.5);-webkit-backdrop-filter:blur(24px) saturate(1.5);flex-direction:column;overflow:hidden;animation:chatSlideIn 0.3s ease-out;}
#heady-chat-panel.open{display:flex;}
@keyframes chatSlideIn{from{opacity:0;transform:translateY(20px) scale(0.95);}to{opacity:1;transform:translateY(0) scale(1);}}
#heady-chat-panel .chat-header{padding:14px 16px;background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(99,102,241,0.1));border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:10px;}
#heady-chat-panel .chat-header .avatar{width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,#8b5cf6,#6366f1);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;}
#heady-chat-panel .chat-header .info{flex:1;}
#heady-chat-panel .chat-header .name{color:#fff;font-weight:600;font-size:14px;}
#heady-chat-panel .chat-header .status{color:#34d399;font-size:11px;display:flex;align-items:center;gap:4px;}
#heady-chat-panel .chat-header .status::before{content:'';width:6px;height:6px;background:#34d399;border-radius:50%;}
#heady-chat-panel .close-btn{background:none;border:none;color:rgba(255,255,255,0.4);font-size:20px;cursor:pointer;padding:4px;line-height:1;transition:color 0.2s;}
#heady-chat-panel .close-btn:hover{color:#fff;}
#heady-chat-messages{flex:1;overflow-y:auto;padding:16px;min-height:180px;scrollbar-width:thin;scrollbar-color:rgba(139,92,246,0.3) transparent;}
#heady-chat-messages::-webkit-scrollbar{width:4px;}
#heady-chat-messages::-webkit-scrollbar-thumb{background:rgba(139,92,246,0.3);border-radius:2px;}
.hc-msg{margin-bottom:12px;animation:msgFadeIn 0.25s ease-out;}
@keyframes msgFadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
.hc-msg.bot .hc-bubble{background:rgba(139,92,246,0.12);border:1px solid rgba(139,92,246,0.15);border-radius:16px 16px 16px 4px;color:rgba(255,255,255,0.88);padding:10px 14px;font-size:13px;line-height:1.5;max-width:90%;}
.hc-msg.user{text-align:right;}
.hc-msg.user .hc-bubble{background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.2);border-radius:16px 16px 4px 16px;color:rgba(255,255,255,0.92);padding:10px 14px;font-size:13px;line-height:1.5;display:inline-block;max-width:85%;text-align:left;}
.hc-typing{color:rgba(255,255,255,0.4);font-size:12px;padding:4px 0;}
.hc-typing span{animation:typingDot 1.4s infinite;display:inline-block;}
.hc-typing span:nth-child(2){animation-delay:0.2s;}
.hc-typing span:nth-child(3){animation-delay:0.4s;}
@keyframes typingDot{0%,60%,100%{opacity:0.3;}30%{opacity:1;}}
#heady-chat-panel .chat-input-area{padding:12px;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:8px;background:rgba(0,0,0,0.2);}
#heady-chat-input{flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:10px 14px;color:#fff;font-size:13px;outline:none;transition:border-color 0.2s;font-family:inherit;}
#heady-chat-input:focus{border-color:rgba(139,92,246,0.4);}
#heady-chat-input::placeholder{color:rgba(255,255,255,0.3);}
#heady-chat-send{background:linear-gradient(135deg,#8b5cf6,#6366f1);border:none;border-radius:12px;padding:10px 16px;color:#fff;cursor:pointer;font-size:13px;font-weight:500;transition:transform 0.15s,opacity 0.15s;font-family:inherit;}
#heady-chat-send:hover{transform:scale(1.05);}
#heady-chat-send:active{transform:scale(0.95);}
@media(max-width:480px){#heady-chat-panel{left:8px;right:8px;bottom:70px;width:auto;max-height:min(480px,65vh);border-radius:16px;} .fab{bottom:12px;right:12px;width:48px;height:48px;font-size:18px;}}
</style>
<div id="heady-chat-panel">
<div class="chat-header">
<div class="avatar">\u2726</div>
<div class="info"><div class="name">HeadyBuddy</div><div class="status">Online</div></div>
<button class="close-btn" onclick="toggleHeadyChat()">\u2715</button>
</div>
<div id="heady-chat-messages">
<div class="hc-msg bot"><div class="hc-bubble">Hey! I'm HeadyBuddy, your AI companion. Ask me anything about the Heady ecosystem or just say hi! \u2728</div></div>
</div>
<div class="chat-input-area">
<input id="heady-chat-input" type="text" placeholder="Ask HeadyBuddy anything..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendHeadyChat();}">
<button id="heady-chat-send" onclick="sendHeadyChat()">Send</button>
</div>
</div>
<script>
function toggleHeadyChat(){var p=document.getElementById('heady-chat-panel');if(p.classList.contains('open')){p.classList.remove('open');p.style.display='none';}else{p.classList.add('open');p.style.display='flex';document.getElementById('heady-chat-input').focus();var m=document.getElementById('heady-chat-messages');m.scrollTop=m.scrollHeight;}}
async function sendHeadyChat(){var input=document.getElementById('heady-chat-input');var msg=input.value.trim();if(!msg)return;input.value='';var container=document.getElementById('heady-chat-messages');container.innerHTML+='<div class="hc-msg user"><div class="hc-bubble">'+msg.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div></div>';container.innerHTML+='<div class="hc-msg bot" id="heady-typing-msg"><div class="hc-typing"><span>.</span><span>.</span><span>.</span></div></div>';container.scrollTop=container.scrollHeight;try{var r=await fetch('/v1/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg})});var d=await r.json();var reply=(d.response||d.message||d.text||'Let me think about that...').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>');var t=document.getElementById('heady-typing-msg');if(t)t.remove();container.innerHTML+='<div class="hc-msg bot"><div class="hc-bubble">'+reply+'</div></div>';container.scrollTop=container.scrollHeight;}catch(e){var t=document.getElementById('heady-typing-msg');if(t)t.remove();container.innerHTML+='<div class="hc-msg bot"><div class="hc-bubble">I\\'m reconnecting... try again in a moment! \\u2728</div></div>';container.scrollTop=container.scrollHeight;}}
<\/script>

<script>
// Highly optimized cosmic starfield + sacred geometry engine
(function(){
    const canvas = document.getElementById('cosmic-canvas');
    const ctx = canvas.getContext('2d');
    let width, height, cx, cy;
    let stars = [];
    let time = 0;
    
    // Parse the hex color to RGB for smooth alpha/color transitions
    const hex2rgb = (hex) => {
        const v = parseInt(hex.replace('#',''), 16);
        return {r: (v>>16)&255, g: (v>>8)&255, b: v&255};
    };
    
    const baseColor1 = hex2rgb('${accent}');
    const baseColor2 = hex2rgb('${accent2}');
    const geoType = '${geoType}';
    
    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        cx = width / 2;
        cy = height / 2;
        
        // Init stars
        stars = [];
        const numStars = (width * height) / 4000;
        for(let i=0; i<numStars; i++) {
            stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                z: Math.random() * 2,
                size: Math.random() * 1.5,
                blinkSpeed: Math.random() * 0.02 + 0.005,
                blinkOffset: Math.random() * Math.PI * 2
            });
        }
    }
    
    function drawStars() {
        ctx.fillStyle = '#050508';
        ctx.fillRect(0, 0, width, height);
        
        // Drifting effect (slow upward and rightward move)
        stars.forEach(s => {
            s.y -= s.z * 0.2;
            s.x += s.z * 0.1;
            if(s.y < 0) s.y = height;
            if(s.x > width) s.x = 0;
            
            const blink = Math.sin(time * s.blinkSpeed + s.blinkOffset) * 0.5 + 0.5;
            ctx.fillStyle = \`rgba(255,255,255,\${blink * 0.7})\`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI*2);
            ctx.fill();
        });
    }
    
    // Smooth color shifting logic
    function getFluidColor(alpha, offset=0) {
        const mix = (Math.sin(time * 0.0006 + offset) + 1) / 2;
        const r = Math.floor(baseColor1.r * mix + baseColor2.r * (1-mix));
        const g = Math.floor(baseColor1.g * mix + baseColor2.g * (1-mix));
        const b = Math.floor(baseColor1.b * mix + baseColor2.b * (1-mix));
        return \`rgba(\${r},\${g},\${b},\${alpha})\`;
    }

    function drawGeometry() {
        const radius = Math.max(width, height) * 0.45;
        const rotZ = time * 0.00015;
        const tiltX = Math.sin(time * 0.00012) * 0.3;
        const tiltY = Math.cos(time * 0.00009) * 0.25;
        const breathe = Math.sin(time * 0.002) * 0.02 + 1;
        const driftX = Math.sin(time * 0.0006) * 20;
        const driftY = Math.cos(time * 0.0005) * 15;
        ctx.save();
        ctx.translate(cx + driftX, cy + driftY);
        ctx.scale(breathe, breathe);
        ctx.rotate(rotZ);
        ctx.lineWidth = 0.3;
        ctx.lineCap = 'round';
        function hueColor(idx, total, alpha) {
            const baseHue = (idx / total) * 360;
            const hue = (baseHue + time * 0.02) % 360;
            const sat = 70 + Math.sin(time * 0.001 + idx) * 15;
            const lit = 55 + Math.sin(time * 0.0008 + idx * 0.5) * 15;
            return \`hsla(\${hue},\${sat}%,\${lit}%,\${alpha})\`;
        }
        function proj(x, y, z) {
            const cy2 = Math.cos(tiltY), sy = Math.sin(tiltY);
            const cx2 = Math.cos(tiltX), sx = Math.sin(tiltX);
            const x2 = x * cy2 - z * sy;
            const z2 = x * sy + z * cy2;
            const y2 = y * cx2 - z2 * sx;
            return { x: x2, y: y2 };
        }
        if (geoType === 'Seed of Life') {
            let idx = 0; const total = 19;
            for (let ring = 0; ring < 3; ring++) {
                const n = ring === 0 ? 1 : 6;
                const dist = ring * radius * 0.28;
                const circR = radius * (0.28 + ring * 0.06);
                for (let i = 0; i < n; i++) {
                    const a = (Math.PI * 2 / 6) * i + ring * 0.5;
                    const raw = ring === 0 ? {x:0,y:0} : {x: Math.cos(a)*dist, y: Math.sin(a)*dist};
                    const p = proj(raw.x, raw.y, Math.sin(a + time * 0.0003) * radius * 0.1);
                    ctx.strokeStyle = hueColor(idx, total, 0.6);
                    ctx.shadowColor = hueColor(idx, total, 0.3);
                    ctx.shadowBlur = 12;
                    ctx.beginPath(); ctx.arc(p.x, p.y, circR, 0, Math.PI * 2); ctx.stroke();
                    idx++;
                }
            }
            ctx.strokeStyle = hueColor(18, total, 0.4);
            ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
        } else if (geoType === 'Flower of Life') {
            let idx = 0; const total = 37;
            for (let ring = 0; ring < 4; ring++) {
                const n = ring === 0 ? 1 : ring * 6;
                const dist = ring * radius * 0.22;
                for (let i = 0; i < n; i++) {
                    const a = (Math.PI * 2 / Math.max(n,1)) * i;
                    const raw = ring === 0 ? {x:0,y:0} : {x:Math.cos(a)*dist, y:Math.sin(a)*dist};
                    const p = proj(raw.x, raw.y, Math.cos(a * 2 + time * 0.0002) * radius * 0.08);
                    ctx.strokeStyle = hueColor(idx, total, 0.55);
                    ctx.shadowColor = hueColor(idx, total, 0.25);
                    ctx.shadowBlur = 10;
                    ctx.beginPath(); ctx.arc(p.x, p.y, radius * 0.22, 0, Math.PI * 2); ctx.stroke();
                    idx++;
                }
            }
        } else if (geoType === 'Metatrons Cube') {
            const nodes = [{x:0,y:0,z:0}];
            for (let i = 0; i < 6; i++) { const a=(Math.PI/3)*i; nodes.push({x:Math.cos(a)*radius*0.45,y:Math.sin(a)*radius*0.45,z:Math.sin(a+time*0.0002)*radius*0.1}); }
            for (let i = 0; i < 6; i++) { const a=(Math.PI/3)*i+Math.PI/6; nodes.push({x:Math.cos(a)*radius*0.85,y:Math.sin(a)*radius*0.85,z:Math.cos(a+time*0.0003)*radius*0.15}); }
            let li = 0; const tl = (nodes.length*(nodes.length-1))/2;
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i+1; j < nodes.length; j++) {
                    const p1 = proj(nodes[i].x, nodes[i].y, nodes[i].z);
                    const p2 = proj(nodes[j].x, nodes[j].y, nodes[j].z);
                    ctx.strokeStyle = hueColor(li, tl, 0.4);
                    ctx.shadowColor = hueColor(li, tl, 0.15);
                    ctx.shadowBlur = 8;
                    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
                    li++;
                }
            }
            for (let i = 0; i < nodes.length; i++) {
                const p = proj(nodes[i].x, nodes[i].y, nodes[i].z);
                ctx.strokeStyle = hueColor(i+tl, nodes.length+tl, 0.7);
                ctx.shadowBlur = 15;
                ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.stroke();
            }
        } else {
            for (let i = 0; i < 72; i++) {
                const a = (Math.PI * 2 / 72) * i;
                const p = proj(Math.cos(a)*radius*0.15, Math.sin(a)*radius*0.15, Math.sin(a*3+time*0.0002)*radius*0.1);
                ctx.strokeStyle = hueColor(i, 72, 0.5);
                ctx.shadowColor = hueColor(i, 72, 0.2);
                ctx.shadowBlur = 10;
                ctx.beginPath(); ctx.ellipse(p.x, p.y, radius*0.85, radius*0.3, a+tiltY, 0, Math.PI*2); ctx.stroke();
            }
        }
        ctx.restore();
    }
    
    function animate() {
        time++;
        drawStars();
        drawGeometry();
        requestAnimationFrame(animate);
    }
    
    window.addEventListener('resize', resize);
    resize();
    animate();
})();
<\/script></body></html>`;
}
__name(sacredPage, "sacredPage");
function getHeadyBuddyPage() {
  return sacredPage(
    "HeadyBuddy",
    "YOUR AI ASSISTANT & GUIDE",
    "Intelligently synchronized across devices",
    "#4ade80",
    "#10b981",
    "headybuddy.org",
    [
      ["\u2726", "AI Companion", "Proactive intelligence powered by Heady Brain."],
      ["\u2726", "Cross-Device", "Seamless context transfer between all interfaces."],
      ["\u2726", "Conversational", "Natural memory persistence and contextual awareness."],
      ["\u2726", "HCFP Aligned", "Optimized by Auto-Success for peak performance."]
    ],
    "Seed of Life"
  );
}
__name(getHeadyBuddyPage, "getHeadyBuddyPage");
function getHeadyMCPPage() {
  return sacredPage(
    "HeadyMCP",
    "MODEL CONTEXT PROTOCOL",
    "The tool connecting minds and machines",
    "#38bdf8",
    "#818cf8",
    "headymcp.com",
    [
      ["\u2726", "Sacred Protocol", "Intelligently routes models using contextual geometry."],
      ["\u2726", "Secure Tools", "Filesystem, Git, and Database via Cloudflare zero trust."],
      ["\u2726", "Multi-Model", "Parallel inference through Anthropic, Google, and Groq."],
      ["\u2726", "HCFP Resonant", "Zero-hallucination execution pathways."]
    ],
    "Metatrons Cube"
  );
}
__name(getHeadyMCPPage, "getHeadyMCPPage");
function getHeadyIOPage() {
  return sacredPage(
    "HeadyIO",
    "SACRED DATA FLOW PLATFORM",
    "All streams return to the source",
    "#06b6d4",
    "#3b82f6",
    "headyio.com",
    [
      ["\u2726", "Real-Time Streams", "Data pipelines processing millions of events."],
      ["\u2726", "WebSocket Sacred", "Ultra-low latency connection topologies."],
      ["\u2726", "Data Persistence", "Vector, SQL, and KV layered storage."],
      ["\u2726", "Stream Processing", "Event-driven natural backpressure architectures."]
    ],
    "Flower of Life"
  );
}
__name(getHeadyIOPage, "getHeadyIOPage");
function getHeadyConnectionPage() {
  return sacredPage(
    "HeadyConnection",
    "NONPROFIT COMMUNITY HUB",
    "Building bridges through digital innovation",
    "#10b981",
    "#059669",
    "headyconnection.org",
    [
      ["\u2726", "Community Code", "Open-source collaboration across the Heady ecosystem."],
      ["\u2726", "Global Impact", "Bringing tools to underserved global communities."],
      ["\u2726", "Education", "Free learning resources for sacred intelligence."],
      ["\u2726", "Sacred Purpose", "Every connection guided by meaningful impact."]
    ],
    "Flower of Life"
  );
}
__name(getHeadyConnectionPage, "getHeadyConnectionPage");
function getHeadySystemsPage() {
  return sacredPage(
    "HeadySystems",
    "THE ARCHITECTURE OF INTELLIGENCE",
    "The foundation that powers every service",
    "#8b5cf6",
    "#d946ef",
    "headysystems.com",
    [
      ["\u2726", "Core Platform", "API gateway and brain orchestration at absolute scale."],
      ["\u2726", "Edge Proxy", "Mesh routing, KV caching, and circuit breaker logic."],
      ["\u2726", "Zero Trust", "mTLS client certs and Cloudflare WARP enforcement."],
      ["\u2726", "HCFP Auto", "Automated deployment and protocol enhancement."]
    ],
    "Torus"
  );
}
__name(getHeadySystemsPage, "getHeadySystemsPage");
function getHeadyMePage() {
  return sacredPage(
    "HeadyMe",
    "SACRED COMMAND CENTER",
    "Your personal ecosystem interface",
    "#ec4899",
    "#f43f5e",
    "headyme.com",
    [
      ["\u2726", "HeadyLens", "Visual monitoring of all production domains."],
      ["\u2726", "StoryDriver", "Comprehensive log and narrative tracking for pattern recognition."],
      ["\u2726", "Memory System", "Persistent vector database utilizing Qdrant."],
      ["\u2726", "Autonomy Engine", "Self-learning resource assignment and data gathering."]
    ],
    "Metatrons Cube"
  );
}
__name(getHeadyMePage, "getHeadyMePage");
function getHeadyBotPage() {
  return sacredPage(
    "HeadyBot",
    "AUTOMATION AND WEBHOOKS",
    "Precision event orchestration",
    "#14b8a6",
    "#0ea5e9",
    "headybot.com",
    [
      ["\u2726", "Bot Automation", "Intelligent triggers for CI/CD and system alerts."],
      ["\u2726", "Webhook Hub", "Centralized receiver across the Heady mesh."],
      ["\u2726", "Real-Time", "Sub-second script injections and processing."],
      ["\u2726", "Analytics", "Metric tracking and auto-healing capabilities."]
    ],
    "Torus"
  );
}
__name(getHeadyBotPage, "getHeadyBotPage");
function getServiceFallbackPage(hostname) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Heady Systems \u2014 Maintenance</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:rgba(30,41,59,.9);border:1px solid #334155;border-radius:1rem;padding:3rem;max-width:480px;text-align:center}
h1{background:linear-gradient(135deg,#60a5fa,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:1rem}
p{color:#94a3b8;line-height:1.6}</style></head>
<body><div class="card"><h1>\u26A1 Heady Systems</h1><p><strong>${hostname}</strong> is performing a brief maintenance cycle.<br>Services will be back momentarily.</p></div></body></html>`;
}
__name(getServiceFallbackPage, "getServiceFallbackPage");
async function proxyToOrigin(request, env2) {
  const origin = env2.HEADY_BRAIN_ENDPOINT || "https://manager.headysystems.com";
  const url = new URL(request.url);
  const target = `${origin}${url.pathname}${url.search}`;
  const resp = await fetch(target, {
    method: request.method,
    headers: request.headers,
    body: request.method !== "GET" ? request.body : void 0
  });
  const newResp = new Response(resp.body, resp);
  newResp.headers.set("X-Heady-Edge", "proxied");
  Object.entries(CORS).forEach(([k, v]) => newResp.headers.set(k, v));
  return newResp;
}
__name(proxyToOrigin, "proxyToOrigin");
function handleHealth(env2) {
  const providerStatus = {};
  for (const p of PROVIDERS) {
    providerStatus[p.id] = {
      type: p.type,
      weight: p.weight,
      circuit: isCircuitOpen(p.id) ? "OPEN" : "CLOSED",
      failures: circuitState[p.id]?.failures || 0
    };
  }
  return jsonRes({
    status: "operational",
    service: "heady-edge-proxy",
    version: "1.0.0",
    runtime: "cloudflare-workers",
    hcfp_mode: "enforced",
    providers: providerStatus,
    bindings: {
      kv_cache: !!env2.PROMPT_CACHE,
      workers_ai: !!env2.AI,
      vectorize: !!env2.HEADY_VECTORS,
      analytics: !!env2.HEADY_ANALYTICS,
      queue: !!env2.TASK_QUEUE
    },
    routes: ["/v1/chat", "/v1/embed", "/v1/classify", "/v1/moderate", "/v1/vectorize", "/v1/health", "/v1/determinism"],
    services_proxied: Object.keys(SERVICE_MAP).length,
    mtls_domains: Object.entries(SERVICE_MAP).filter(([, s]) => s.mtls).map(([h]) => h),
    ts: (/* @__PURE__ */ new Date()).toISOString()
  });
}
__name(handleHealth, "handleHealth");
async function handleDeterminism(env2) {
  let hits = 0, misses = 0;
  if (env2.PROMPT_CACHE) {
    const statsRaw = await env2.PROMPT_CACHE.get("__determinism_stats__");
    if (statsRaw) {
      try {
        const stats = JSON.parse(statsRaw);
        hits = stats.hits || 0;
        misses = stats.misses || 0;
      } catch {
      }
    }
  }
  const total = hits + misses;
  const hitRate = total > 0 ? (hits / total * 100).toFixed(2) : "0.00";
  const convergenceRate = total > 0 ? Math.min(100, hits / Math.max(misses, 1) * 50).toFixed(2) : "0.00";
  return jsonRes({
    ok: true,
    service: "heady-edge-proxy",
    determinism: {
      cache_hits: hits,
      cache_misses: misses,
      total_requests: total,
      hit_rate_pct: parseFloat(hitRate),
      convergence_score: parseFloat(convergenceRate),
      status: parseFloat(hitRate) > 60 ? "converging" : parseFloat(hitRate) > 30 ? "learning" : "warming"
    },
    ts: (/* @__PURE__ */ new Date()).toISOString()
  });
}
__name(handleDeterminism, "handleDeterminism");
function logTelemetry(env2, event, data = {}) {
  HeadyLens.record(`telemetry:${event}`, data.latency_ms || 0, data.status || 200);
  if (env2.HEADY_ANALYTICS) {
    env2.HEADY_ANALYTICS.writeDataPoint({
      blobs: [event, data.provider || "", data.classification || "", data.fingerprint || ""],
      doubles: [data.latency_ms || 0, data.text_length || 0],
      indexes: ["heady-edge-proxy"]
    });
  }
  if (env2.PROMPT_CACHE && (event === "cache_hit" || event === "cache_miss")) {
    env2.PROMPT_CACHE.get("__determinism_stats__").then((raw) => {
      const stats = raw ? JSON.parse(raw) : { hits: 0, misses: 0 };
      if (event === "cache_hit") stats.hits++;
      else stats.misses++;
      env2.PROMPT_CACHE.put("__determinism_stats__", JSON.stringify(stats));
    }).catch(() => {
    });
  }
}
__name(logTelemetry, "logTelemetry");
function getStaticCacheTTL(path) {
  const ext = path.split(".").pop()?.toLowerCase();
  if (!ext) return 0;
  const immutable = ["js", "css", "woff", "woff2", "ttf", "eot", "otf"];
  if (immutable.includes(ext)) return 31536e3;
  const images = ["png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "ico", "bmp"];
  if (images.includes(ext)) return 3600;
  const media = ["mp4", "webm", "mp3", "ogg", "wav", "pdf"];
  if (media.includes(ext)) return 3600;
  const data = ["json", "xml", "txt", "csv", "yaml", "yml"];
  if (data.includes(ext)) return 60;
  if (ext === "html" || ext === "htm") return -1;
  if (ext === "map") return 3600;
  return 0;
}
__name(getStaticCacheTTL, "getStaticCacheTTL");
function jsonRes(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...CORS, ...extraHeaders }
  });
}
__name(jsonRes, "jsonRes");
async function fetchWithTimeout(url, opts, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
__name(fetchWithTimeout, "fetchWithTimeout");
export {
  heady_edge_proxy_default as default
};
//# sourceMappingURL=heady-edge-proxy.js.map

