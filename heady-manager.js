// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: heady-manager.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  🌈 HEADY SYSTEMS — MANAGER SERVER                                         ║
 * ║  🚀 Node.js MCP Server • API Gateway • Sacred Geometry v3.0.0               ║
 * ║  🎨 Phi-Based Design • Rainbow Magic • Zero Defect Code ✨                   ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const compression = require("compression");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// ─── Imagination Engine ─────────────────────────────────────────────
let imaginationRoutes = null;
try {
  imaginationRoutes = require("./src/routes/imagination-routes");
  console.log("  ∞ Imagination Engine: ROUTES LOADED");
} catch (err) {
  console.warn(`  ⚠ Imagination routes not loaded: ${err.message}`);
}

// ─── Secrets & Cloudflare Management ──────────────────────────────
let secretsManager = null;
let cfManager = null;
try {
  const { secretsManager: sm, registerSecretsRoutes } = require("./src/hc_secrets_manager");
  const { CloudflareManager, registerCloudflareRoutes } = require("./src/hc_cloudflare");
  secretsManager = sm;
  cfManager = new CloudflareManager(secretsManager);

  // Register non-Cloudflare secrets from manifest
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
  ];
  for (const s of manifestSecrets) {
    secretsManager.register({ ...s, source: "env" });
  }
  secretsManager.restoreState();
  console.log("  \u221e Secrets Manager: LOADED (" + secretsManager.getAll().length + " secrets tracked)");
  console.log("  \u221e Cloudflare Manager: LOADED (token " + (cfManager.isTokenValid() ? "valid" : "needs refresh") + ")");
} catch (err) {
  console.warn(`  \u26a0 Secrets/Cloudflare not loaded: ${err.message}`);
}

const PORT = Number(process.env.PORT || 3300);
const app = express();

// ─── Middleware ─────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(express.json({ limit: "5mb" }));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : "*",
  credentials: true,
}));
app.use("/api/", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ─── Imagination Routes ────────────────────────────────────────────
if (imaginationRoutes) {
  app.use("/api/imagination", imaginationRoutes);
}

// ─── Static Assets ─────────────────────────────────────────────────
const frontendBuildPath = path.join(__dirname, "frontend", "dist");
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
}
app.use(express.static("public"));

// ─── Utility ────────────────────────────────────────────────────────
function readJsonSafe(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
  catch { return null; }
}

// ─── Health & Pulse ─────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "heady-manager",
    version: "3.0.0",
    ts: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

app.get("/api/pulse", (req, res) => {
  res.json({
    ok: true,
    service: "heady-manager",
    version: "3.0.0",
    ts: new Date().toISOString(),
    status: "active",
    endpoints: [
      "/api/health", "/api/pulse", "/api/registry", "/api/registry/component/:id",
      "/api/registry/environments", "/api/registry/docs", "/api/registry/notebooks",
      "/api/registry/patterns", "/api/registry/workflows", "/api/registry/ai-nodes",
      "/api/nodes", "/api/system/status", "/api/pipeline/*",
      "/api/ide/spec", "/api/ide/agents",
      "/api/playbook", "/api/agentic", "/api/activation", "/api/public-domain",
      "/api/resources/health", "/api/resources/snapshot", "/api/resources/events",
      "/api/resources/diagnose", "/api/resources/quick-wins", "/api/resources/system-profile",
      "/api/scheduler/status", "/api/scheduler/queues", "/api/scheduler/history",
      "/api/stories", "/api/stories/recent", "/api/stories/summary",
      "/api/monte-carlo/plan", "/api/monte-carlo/result", "/api/monte-carlo/metrics",
      "/api/monte-carlo/status", "/api/monte-carlo/drift", "/api/monte-carlo/simulate",
      "/api/monte-carlo/speed-mode",
      "/api/patterns", "/api/patterns/summary", "/api/patterns/recent",
      "/api/patterns/bottlenecks", "/api/patterns/improvements",
      "/api/self/status", "/api/self/knowledge", "/api/self/critique", "/api/self/critiques",
      "/api/self/improvement", "/api/self/improvements", "/api/self/diagnose", "/api/self/diagnostics",
      "/api/self/connection-health", "/api/self/connections", "/api/self/meta-analysis",
      "/api/pricing/tiers", "/api/pricing/fair-access", "/api/pricing/metrics",
      "/api/secrets/status", "/api/secrets", "/api/secrets/:id", "/api/secrets/alerts",
      "/api/secrets/check", "/api/secrets/:id/refresh", "/api/secrets/audit",
      "/api/cloudflare/status", "/api/cloudflare/refresh", "/api/cloudflare/zones",
      "/api/cloudflare/domains", "/api/cloudflare/verify",
      "/api/aloha/status", "/api/aloha/protocol", "/api/aloha/de-optimization",
      "/api/aloha/stability", "/api/aloha/priorities", "/api/aloha/checklist",
      "/api/aloha/crash-report", "/api/aloha/de-opt-check", "/api/aloha/web-baseline",
      "/api/imagination/primitives", "/api/imagination/concepts", "/api/imagination/imagine",
      "/api/imagination/hot-concepts", "/api/imagination/top-concepts", "/api/imagination/ip-packages",
    ],
    aloha: alohaState ? {
      mode: alohaState.mode,
      protocols: alohaState.protocols,
      stabilityDiagnosticMode: alohaState.stabilityDiagnosticMode,
      crashReports: alohaState.crashReports.length,
    } : null,
    secrets: secretsManager ? secretsManager.getSummary() : null,
    cloudflare: cfManager ? { tokenValid: cfManager.isTokenValid(), expiresIn: cfManager.expiresAt ? cfManager._timeUntil(cfManager.expiresAt) : null } : null,
  });
});

// ─── Registry ───────────────────────────────────────────────────────
const REGISTRY_PATH = path.join(__dirname, ".heady", "registry.json");

function loadRegistry() {
  return readJsonSafe(REGISTRY_PATH) || { nodes: {}, tools: {}, workflows: {}, services: {}, skills: {}, metadata: {} };
}

function saveRegistry(data) {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2), "utf8");
}

app.get("/api/registry", (req, res) => {
  const registryPath = path.join(__dirname, "heady-registry.json");
  const registry = readJsonSafe(registryPath);
  if (!registry) return res.status(404).json({ error: "Registry not found" });
  res.json(registry);
});

app.get("/api/registry/component/:id", (req, res) => {
  const registry = readJsonSafe(path.join(__dirname, "heady-registry.json"));
  if (!registry) return res.status(404).json({ error: "Registry not found" });
  const comp = (registry.components || []).find(c => c.id === req.params.id);
  if (!comp) return res.status(404).json({ error: `Component '${req.params.id}' not found` });
  res.json(comp);
});

app.get("/api/registry/environments", (req, res) => {
  const registry = readJsonSafe(path.join(__dirname, "heady-registry.json"));
  if (!registry) return res.status(404).json({ error: "Registry not found" });
  res.json({ environments: registry.environments || [], ts: new Date().toISOString() });
});

app.get("/api/registry/docs", (req, res) => {
  const registry = readJsonSafe(path.join(__dirname, "heady-registry.json"));
  if (!registry) return res.status(404).json({ error: "Registry not found" });
  res.json({ docs: registry.docs || [], ts: new Date().toISOString() });
});

app.get("/api/registry/notebooks", (req, res) => {
  const registry = readJsonSafe(path.join(__dirname, "heady-registry.json"));
  if (!registry) return res.status(404).json({ error: "Registry not found" });
  res.json({ notebooks: registry.notebooks || [], ts: new Date().toISOString() });
});

app.get("/api/registry/patterns", (req, res) => {
  const registry = readJsonSafe(path.join(__dirname, "heady-registry.json"));
  if (!registry) return res.status(404).json({ error: "Registry not found" });
  res.json({ patterns: registry.patterns || [], ts: new Date().toISOString() });
});

app.get("/api/registry/workflows", (req, res) => {
  const registry = readJsonSafe(path.join(__dirname, "heady-registry.json"));
  if (!registry) return res.status(404).json({ error: "Registry not found" });
  res.json({ workflows: registry.workflows || [], ts: new Date().toISOString() });
});

app.get("/api/registry/ai-nodes", (req, res) => {
  const registry = readJsonSafe(path.join(__dirname, "heady-registry.json"));
  if (!registry) return res.status(404).json({ error: "Registry not found" });
  res.json({ aiNodes: registry.aiNodes || [], ts: new Date().toISOString() });
});

// ─── Node Management ────────────────────────────────────────────────
app.get("/api/nodes", (req, res) => {
  const reg = loadRegistry();
  const nodes = Object.entries(reg.nodes || {}).map(([id, n]) => ({ id, ...n }));
  res.json({ total: nodes.length, active: nodes.filter(n => n.status === "active").length, nodes, ts: new Date().toISOString() });
});

app.get("/api/nodes/:nodeId", (req, res) => {
  const reg = loadRegistry();
  const node = reg.nodes[req.params.nodeId.toUpperCase()];
  if (!node) return res.status(404).json({ error: `Node '${req.params.nodeId}' not found` });
  res.json({ id: req.params.nodeId.toUpperCase(), ...node });
});

app.post("/api/nodes/:nodeId/activate", (req, res) => {
  const reg = loadRegistry();
  const id = req.params.nodeId.toUpperCase();
  if (!reg.nodes[id]) return res.status(404).json({ error: `Node '${id}' not found` });
  reg.nodes[id].status = "active";
  reg.nodes[id].last_invoked = new Date().toISOString();
  saveRegistry(reg);
  res.json({ success: true, node: id, status: "active" });
});

app.post("/api/nodes/:nodeId/deactivate", (req, res) => {
  const reg = loadRegistry();
  const id = req.params.nodeId.toUpperCase();
  if (!reg.nodes[id]) return res.status(404).json({ error: `Node '${id}' not found` });
  reg.nodes[id].status = "available";
  saveRegistry(reg);
  res.json({ success: true, node: id, status: "available" });
});

// ─── System Status & Production Activation ──────────────────────────
app.get("/api/system/status", (req, res) => {
  const reg = loadRegistry();
  const nodeList = Object.entries(reg.nodes || {});
  const activeNodes = nodeList.filter(([, n]) => n.status === "active").length;

  res.json({
    system: "Heady Systems",
    version: "3.0.0",
    environment: (reg.metadata || {}).environment || "development",
    production_ready: activeNodes === nodeList.length && nodeList.length > 0,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    capabilities: {
      nodes: { total: nodeList.length, active: activeNodes },
      tools: { total: Object.keys(reg.tools || {}).length },
      workflows: { total: Object.keys(reg.workflows || {}).length },
      services: { total: Object.keys(reg.services || {}).length },
    },
    sacred_geometry: { architecture: "active", organic_systems: activeNodes === nodeList.length },
    ts: new Date().toISOString(),
  });
});

app.post("/api/system/production", (req, res) => {
  const reg = loadRegistry();
  const ts = new Date().toISOString();
  const report = { nodes: [], tools: [], workflows: [], services: [] };

  for (const [name, node] of Object.entries(reg.nodes || {})) {
    node.status = "active"; node.last_invoked = ts; report.nodes.push(name);
  }
  for (const [name, tool] of Object.entries(reg.tools || {})) {
    tool.status = "active"; report.tools.push(name);
  }
  for (const [name, wf] of Object.entries(reg.workflows || {})) {
    wf.status = "active"; report.workflows.push(name);
  }
  for (const [name, svc] of Object.entries(reg.services || {})) {
    svc.status = name === "heady-manager" ? "healthy" : "active"; report.services.push(name);
  }
  for (const [, sk] of Object.entries(reg.skills || {})) { sk.status = "active"; }

  reg.metadata = { ...reg.metadata, last_updated: ts, version: "3.0.0-production", environment: "production", all_nodes_active: true, production_activated_at: ts };
  saveRegistry(reg);

  res.json({
    success: true,
    environment: "production",
    activated: { nodes: report.nodes.length, tools: report.tools.length, workflows: report.workflows.length, services: report.services.length },
    sacred_geometry: "FULLY_ACTIVATED",
    ts,
  });
});

// ─── Pipeline Engine (wired to src/hc_pipeline.js) ──────────────────
let pipeline = null;
let pipelineError = null;
try {
  const pipelineMod = require("./src/hc_pipeline");
  pipeline = pipelineMod.pipeline;
  console.log("  ∞ Pipeline engine: LOADED");
} catch (err) {
  pipelineError = err.message;
  console.warn(`  ⚠ Pipeline engine not loaded: ${err.message}`);
}

app.get("/api/pipeline/config", (req, res) => {
  if (!pipeline) return res.status(503).json({ error: "Pipeline not loaded", reason: pipelineError });
  try {
    const summary = pipeline.getConfigSummary();
    res.json({ ok: true, ...summary });
  } catch (err) {
    res.status(500).json({ error: "Failed to load pipeline config", message: err.message });
  }
});

app.post("/api/pipeline/run", async (req, res) => {
  if (!pipeline) return res.status(503).json({ error: "Pipeline not loaded", reason: pipelineError });
  try {
    const result = await pipeline.run(req.body || {});
    res.json({
      ok: true,
      runId: result.runId,
      status: result.status,
      metrics: result.metrics,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Pipeline run failed", message: err.message });
  }
});

app.get("/api/pipeline/state", (req, res) => {
  if (!pipeline) return res.status(503).json({ error: "Pipeline not loaded", reason: pipelineError });
  try {
    const state = pipeline.getState();
    if (!state) return res.json({ ok: true, state: null, message: "No run executed yet" });
    res.json({ ok: true, runId: state.runId, status: state.status, metrics: state.metrics, ts: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to get pipeline state", message: err.message });
  }
});

// ─── HeadyAutoIDE & Methodology APIs ────────────────────────────────
const jsYaml = require("js-yaml");

function loadYamlConfig(filename) {
  const filePath = path.join(__dirname, "configs", filename);
  if (!fs.existsSync(filePath)) return null;
  try { return jsYaml.load(fs.readFileSync(filePath, "utf8")); }
  catch { return null; }
}

app.get("/api/ide/spec", (req, res) => {
  const spec = loadYamlConfig("heady-auto-ide.yaml");
  if (!spec) return res.status(404).json({ error: "HeadyAutoIDE spec not found" });
  res.json({ ok: true, ...spec, ts: new Date().toISOString() });
});

app.get("/api/ide/agents", (req, res) => {
  const spec = loadYamlConfig("heady-auto-ide.yaml");
  if (!spec) return res.status(404).json({ error: "HeadyAutoIDE spec not found" });
  res.json({ ok: true, agents: spec.agentRoles || [], ts: new Date().toISOString() });
});

app.get("/api/playbook", (req, res) => {
  const playbook = loadYamlConfig("build-playbook.yaml");
  if (!playbook) return res.status(404).json({ error: "Build Playbook not found" });
  res.json({ ok: true, ...playbook, ts: new Date().toISOString() });
});

app.get("/api/agentic", (req, res) => {
  const agentic = loadYamlConfig("agentic-coding.yaml");
  if (!agentic) return res.status(404).json({ error: "Agentic Coding config not found" });
  res.json({ ok: true, ...agentic, ts: new Date().toISOString() });
});

app.get("/api/activation", (req, res) => {
  const manifest = loadYamlConfig("activation-manifest.yaml");
  if (!manifest) return res.status(404).json({ error: "Activation Manifest not found" });
  const reg = loadRegistry();
  const nodeList = Object.entries(reg.nodes || {});
  const activeNodes = nodeList.filter(([, n]) => n.status === "active").length;

  res.json({
    ok: true,
    status: manifest.status || "PENDING",
    activatedAt: manifest.activatedAt,
    version: manifest.version,
    verifiedResources: {
      configs: (manifest.verifiedResources?.configs || []).length,
      coreEngines: (manifest.verifiedResources?.coreEngines || []).length,
      companionSystems: (manifest.verifiedResources?.companionSystems || []).length,
      registryNodes: { total: nodeList.length, active: activeNodes },
    },
    operatingDirectives: (manifest.operatingDirectives || []).length,
    pipelineStages: (manifest.pipelineInitTemplate?.stages || []).length,
    ts: new Date().toISOString(),
  });
});

app.get("/api/public-domain", (req, res) => {
  const pdi = loadYamlConfig("public-domain-integration.yaml");
  if (!pdi) return res.status(404).json({ error: "Public Domain Integration config not found" });
  res.json({ ok: true, ...pdi, ts: new Date().toISOString() });
});

// ─── Continuous Pipeline State (shared by resources & buddy APIs) ────
let continuousPipeline = {
  running: false,
  cycleCount: 0,
  lastCycleTs: null,
  exitReason: null,
  errors: [],
  gateResults: { quality: null, resource: null, stability: null, user: null },
  intervalId: null,
};

// ─── Intelligent Resource Manager ────────────────────────────────────
let resourceManager = null;
try {
  const { HCResourceManager, registerRoutes: registerResourceRoutes } = require("./src/hc_resource_manager");
  resourceManager = new HCResourceManager({ pollIntervalMs: 5000 });
  registerResourceRoutes(app, resourceManager);
  resourceManager.start();

  resourceManager.on("resource_event", (event) => {
    if (event.severity === "WARN_HARD" || event.severity === "CRITICAL") {
      console.warn(`  ⚠ Resource ${event.severity}: ${event.resourceType} at ${event.currentUsagePercent}%`);
    }
  });

  resourceManager.on("escalation_required", (data) => {
    console.warn(`  ⚠ ESCALATION: ${data.event.resourceType} at ${data.event.currentUsagePercent}% — user prompt required`);
  });

  console.log("  ∞ Resource Manager: LOADED (polling every 5s)");
} catch (err) {
  console.warn(`  ⚠ Resource Manager not loaded: ${err.message}`);

  // Fallback inline resource health endpoint
  app.get("/api/resources/health", (req, res) => {
    const mem = process.memoryUsage();
    const osLib = require("os");
    const totalMem = osLib.totalmem();
    const freeMem = osLib.freemem();
    const usedMem = totalMem - freeMem;
    const cpuCount = osLib.cpus().length;
    const ramPercent = Math.round((usedMem / totalMem) * 100);

    res.json({
      cpu: { currentPercent: 0, cores: cpuCount, unit: "%" },
      ram: { currentPercent: ramPercent, absoluteValue: Math.round(usedMem / 1048576), capacity: Math.round(totalMem / 1048576), unit: "MB" },
      disk: { currentPercent: 0, absoluteValue: 0, capacity: 0, unit: "GB" },
      gpu: null,
      safeMode: false,
      status: "fallback",
      ts: new Date().toISOString(),
    });
  });
}

// ─── Task Scheduler ──────────────────────────────────────────────────
let taskScheduler = null;
try {
  const { HCTaskScheduler, registerSchedulerRoutes } = require("./src/hc_task_scheduler");
  taskScheduler = new HCTaskScheduler();
  registerSchedulerRoutes(app, taskScheduler);

  // Wire resource manager safe mode into scheduler
  if (resourceManager) {
    resourceManager.on("mitigation:safe_mode_activated", () => {
      taskScheduler.enterSafeMode();
    });
    resourceManager.on("mitigation:batch_paused", () => {
      taskScheduler.adjustConcurrency("batch", 1);
    });
    resourceManager.on("mitigation:concurrency_lowered", () => {
      taskScheduler.adjustConcurrency("batch", 1);
      taskScheduler.adjustConcurrency("training", 0);
    });
  }

  console.log("  ∞ Task Scheduler: LOADED");
} catch (err) {
  console.warn(`  ⚠ Task Scheduler not loaded: ${err.message}`);
}

// ─── Resource Diagnostics ────────────────────────────────────────────
let resourceDiagnostics = null;
try {
  const { HCResourceDiagnostics, registerDiagnosticRoutes } = require("./src/hc_resource_diagnostics");
  resourceDiagnostics = new HCResourceDiagnostics({
    resourceManager,
    taskScheduler,
  });
  registerDiagnosticRoutes(app, resourceDiagnostics);
  console.log("  ∞ Resource Diagnostics: LOADED");
} catch (err) {
  console.warn(`  ⚠ Resource Diagnostics not loaded: ${err.message}`);
}

// ─── Monte Carlo Plan Scheduler ──────────────────────────────────────
let mcPlanScheduler = null;
let mcGlobal = null;
try {
  const { mcPlanScheduler: _mcPS, mcGlobal: _mcG, registerMonteCarloRoutes } = require("./src/hc_monte_carlo");
  mcPlanScheduler = _mcPS;
  mcGlobal = _mcG;
  registerMonteCarloRoutes(app, mcPlanScheduler, mcGlobal);

  // Wire MC plan scheduler drift alerts into pattern engine (loaded below)
  mcPlanScheduler.on("drift:detected", (alert) => {
    console.warn(`  ⚠ MC Drift: ${alert.taskType}/${alert.strategyId} at ${alert.medianMs}ms (target ${alert.targetMs}ms)`);
  });

  // Bind MC global to pipeline if available
  if (pipeline) {
    mcGlobal.bind({ pipeline, registry: loadRegistry });
  }

  // Start background MC cycles
  mcGlobal.startAutoRun();

  // Default to speed_priority mode — speed is a first-class objective
  mcPlanScheduler.setSpeedMode("on");

  console.log("  ∞ Monte Carlo Plan Scheduler: LOADED (speed_priority mode)");
  console.log("  ∞ Monte Carlo Global: AUTO-RUN started (60s cycles)");
} catch (err) {
  console.warn(`  ⚠ Monte Carlo not loaded: ${err.message}`);
}

// ─── Pattern Recognition Engine ──────────────────────────────────────
let patternEngine = null;
try {
  const { patternEngine: _pe, registerPatternRoutes } = require("./src/hc_pattern_engine");
  patternEngine = _pe;
  registerPatternRoutes(app, patternEngine);

  // Wire MC drift alerts into pattern engine
  if (mcPlanScheduler) {
    mcPlanScheduler.on("drift:detected", (alert) => {
      patternEngine.observeLatency(`mc_drift:${alert.taskType}`, alert.medianMs, {
        strategyId: alert.strategyId, targetMs: alert.targetMs,
        tags: ["drift", "monte_carlo"],
      });
    });
    mcPlanScheduler.on("result:recorded", (data) => {
      patternEngine.observeLatency(`task:${data.taskType}`, data.actualLatencyMs, {
        strategyId: data.strategyId, reward: data.reward,
        tags: ["monte_carlo", "execution"],
      });
    });
  }

  // Wire task scheduler into pattern engine
  if (taskScheduler) {
    taskScheduler.on("task:completed", (task) => {
      const execMs = (task.metrics.completedAt || 0) - (task.metrics.startedAt || 0);
      patternEngine.observeSuccess(`scheduler:${task.type}`, execMs, {
        tier: task.resourceTier, taskClass: task.taskClass,
        tags: ["scheduler"],
      });
    });
    taskScheduler.on("task:failed", (task) => {
      patternEngine.observeError(`scheduler:${task.type}`, task.error || "unknown", {
        tier: task.resourceTier, tags: ["scheduler", "failure"],
      });
    });
  }

  // Wire resource manager into pattern engine
  if (resourceManager) {
    resourceManager.on("resource_event", (event) => {
      if (event.severity === "WARN_HARD" || event.severity === "CRITICAL") {
        patternEngine.observe("reliability", `resource:${event.resourceType}`, event.currentUsagePercent, {
          severity: event.severity, tags: ["resource", event.resourceType],
        });
      }
    });
  }

  // Start continuous pattern analysis
  patternEngine.start();

  console.log("  ∞ Pattern Engine: LOADED (30s analysis cycles)");
} catch (err) {
  console.warn(`  ⚠ Pattern Engine not loaded: ${err.message}`);
}

// ─── Story Driver ────────────────────────────────────────────────────
let storyDriver = null;
try {
  const { HCStoryDriver, registerStoryRoutes } = require("./src/hc_story_driver");
  storyDriver = new HCStoryDriver();
  registerStoryRoutes(app, storyDriver);

  // Wire resource manager events into story driver
  if (resourceManager) {
    resourceManager.on("resource_event", (event) => {
      if (event.severity === "WARN_HARD" || event.severity === "CRITICAL") {
        storyDriver.ingestSystemEvent({
          type: `RESOURCE_${event.severity}`,
          refs: {
            resourceType: event.resourceType,
            percent: event.currentUsagePercent,
            mitigation: event.mitigationApplied || "pending",
          },
          source: "resource_manager",
        });
      }
    });
  }

  // Wire pattern engine events into story driver
  if (patternEngine) {
    patternEngine.on("pattern:converged", (data) => {
      storyDriver.ingestSystemEvent({
        type: "PATTERN_CONVERGED",
        refs: { patternId: data.id, name: data.name },
        source: "pattern_engine",
      });
    });
    patternEngine.on("anomaly:error_burst", (data) => {
      storyDriver.ingestSystemEvent({
        type: "ERROR_BURST_DETECTED",
        refs: { patternId: data.patternId, name: data.name, count: data.count },
        source: "pattern_engine",
      });
    });
    patternEngine.on("anomaly:correlated_slowdown", (data) => {
      storyDriver.ingestSystemEvent({
        type: "CORRELATED_SLOWDOWN",
        refs: { patterns: data.patterns, count: data.count },
        source: "pattern_engine",
      });
    });
  }

  console.log("  ∞ Story Driver: LOADED");
} catch (err) {
  console.warn(`  ⚠ Story Driver not loaded: ${err.message}`);
}

// ─── Self-Critique & Optimization Engine ─────────────────────────────
let selfCritiqueEngine = null;
try {
  const { selfCritique, registerSelfCritiqueRoutes } = require("./src/hc_self_critique");
  selfCritiqueEngine = selfCritique;
  registerSelfCritiqueRoutes(app, selfCritiqueEngine);

  // Wire MC drift into self-critique as bottleneck diagnostic data
  if (mcPlanScheduler) {
    mcPlanScheduler.on("drift:detected", (alert) => {
      selfCritiqueEngine.recordCritique({
        context: `mc_drift:${alert.taskType}`,
        weaknesses: [`Latency drift on ${alert.taskType}: ${alert.medianMs}ms vs ${alert.targetMs}ms target`],
        severity: alert.medianMs > alert.targetMs * 2 ? "critical" : "high",
        suggestedImprovements: ["Run MC re-optimization", "Check warm pool availability"],
      });
    });
  }

  // Wire pattern stagnation into self-critique
  if (patternEngine) {
    patternEngine.on("improvement:created", (task) => {
      selfCritiqueEngine.recordImprovement({
        description: task.title || "Pattern improvement task",
        type: "routing_change",
        status: "proposed",
      });
    });
  }

  console.log("  ∞ Self-Critique Engine: LOADED");
  console.log("    → Endpoints: /api/self/*, /api/pricing/*");
} catch (err) {
  console.warn(`  ⚠ Self-Critique Engine not loaded: ${err.message}`);
}

// NEW AUTO-TASK CONVERSION HOOK
function setupAutoTaskConversion() {
  eventBus.on('recommendation', (recommendation) => {
    const priority = patternEngine.classifyPriority(recommendation);
    
    // Call todo_list tool
    const taskId = `rec-${Date.now()}`;
    const todoItem = {
      id: taskId,
      content: recommendation.text,
      status: 'pending',
      priority
    };
    
    // Invoke tool
    toolCaller.callTool('todo_list', { todos: [todoItem] });
    
    // Notify user
    buddy.sendNotification(`New task created: ${recommendation.text}`);
    
    logger.info(`Created task from recommendation: ${recommendation.text}`);
  });
}

// Initialize during startup
setupAutoTaskConversion();

// ─── Bind Pipeline to External Systems ──────────────────────────────
// Connect HCFullPipeline to MC scheduler, pattern engine, and self-critique
// so post-run feedback loops (timing → MC, observations → patterns, critique → improvements) work.
try {
  pipeline.bind({
    mcScheduler: mcPlanScheduler || null,
    patternEngine: patternEngine || null,
    selfCritique: selfCritiqueEngine || null,
  });
  console.log("  ∞ Pipeline bound to MC + Patterns + Self-Critique");
} catch (err) {
  console.warn(`  ⚠ Pipeline bind failed: ${err.message}`);
}

// ─── HeadyBuddy API ─────────────────────────────────────────────────
const buddyStartTime = Date.now();

app.get("/api/buddy/health", (req, res) => {
  res.json({
    ok: true,
    service: "heady-buddy",
    version: "2.0.0",
    uptime: (Date.now() - buddyStartTime) / 1000,
    continuousMode: continuousPipeline.running,
    ts: new Date().toISOString(),
  });
});

app.post("/api/buddy/chat", (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "message required" });

  const reg = loadRegistry();
  const nodeCount = Object.keys(reg.nodes || {}).length;
  const activeNodes = Object.values(reg.nodes || {}).filter(n => n.status === "active").length;

  const hour = new Date().getHours();
  let greeting = hour < 12 ? "Good morning!" : hour < 17 ? "Good afternoon!" : "Good evening!";
  const lowerMsg = message.toLowerCase();
  let reply = "";

  if (lowerMsg.includes("plan") && lowerMsg.includes("day")) {
    reply = `${greeting} Let's plan your perfect day. I see ${activeNodes}/${nodeCount} nodes active. What are your top 3 priorities today?`;
  } else if (lowerMsg.includes("pipeline") || lowerMsg.includes("hcfull")) {
    const contState = continuousPipeline.running ? `running (cycle ${continuousPipeline.cycleCount})` : "stopped";
    reply = `Pipeline continuous mode: ${contState}. ${activeNodes} nodes active. Would you like me to start a pipeline run or check the orchestrator dashboard?`;
  } else if (lowerMsg.includes("diagnos") || lowerMsg.includes("why slow") || lowerMsg.includes("bottleneck") || lowerMsg.includes("fix resource")) {
    if (resourceDiagnostics) {
      const diag = resourceDiagnostics.diagnose();
      const snap = resourceManager ? resourceManager.getSnapshot() : {};
      const cpuPct = snap.cpu?.currentPercent || 0;
      const ramPct = snap.ram?.currentPercent || 0;
      const topIssue = diag.findings[0];
      reply = `Diagnostic scan complete — ${diag.totalFindings} findings (${diag.critical} critical, ${diag.high} high).\n\n${topIssue ? `Top issue: ${topIssue.title} (${topIssue.severity}).` : "No critical issues."} Say "diagnose" for full report or "apply quick wins" for fast fixes.`;
    } else if (resourceManager) {
      const snap = resourceManager.getSnapshot();
      const events = resourceManager.getRecentEvents(5);
      const cpuPct = snap.cpu?.currentPercent || 0;
      const ramPct = snap.ram?.currentPercent || 0;
      const contributors = events.length > 0 && events[events.length - 1].contributors
        ? events[events.length - 1].contributors.slice(0, 3).map(c => `${c.description} (${c.ramMB || 0} MB)`).join(", ")
        : "no major contributors detected";
      const severity = cpuPct >= 90 || ramPct >= 85 ? "CRITICAL" : cpuPct >= 75 || ramPct >= 70 ? "CONSTRAINED" : "HEALTHY";
      reply = `Resource status: ${severity}. CPU: ${cpuPct}%, RAM: ${ramPct}%. Top contributors: ${contributors}. ${snap.safeMode ? "Safe mode is ACTIVE." : ""} Check the Resources tab for details.`;
    } else {
      reply = `System memory at ${Math.round(process.memoryUsage().heapUsed / 1048576)}MB heap. For detailed analysis, the Resource Manager needs to be running.`;
    }
  } else if (lowerMsg.includes("resource") || lowerMsg.includes("gpu") || lowerMsg.includes("tier")) {
    if (resourceManager) {
      const snap = resourceManager.getSnapshot();
      const diskInfo = snap.disk && snap.disk.capacity > 0 ? `, Disk ${snap.disk.currentPercent}%` : "";
      reply = `Resource overview: CPU ${snap.cpu?.currentPercent || 0}%, RAM ${snap.ram?.currentPercent || 0}%${diskInfo}${snap.gpu ? `, GPU ${snap.gpu.compute?.currentPercent || 0}%` : ""}. ${activeNodes}/${nodeCount} nodes active. ${snap.safeMode ? "⚠ Safe mode active." : ""} Say "diagnose" for deep analysis.`;
    } else {
      reply = `Resource overview: ${activeNodes}/${nodeCount} nodes active. Memory: ${Math.round(process.memoryUsage().heapUsed / 1048576)}MB heap. Check the Orchestrator tab for details.`;
    }
  } else if (lowerMsg.includes("story") || lowerMsg.includes("what changed") || lowerMsg.includes("narrative")) {
    if (storyDriver) {
      const sysSummary = storyDriver.getSystemSummary();
      reply = `Story Driver: ${sysSummary.totalStories} stories (${sysSummary.ongoing} ongoing). ${sysSummary.recentNarrative || "No recent events."} Check the Story tab in Expanded View for full timelines.`;
    } else {
      reply = "Story Driver is not loaded. It tracks project narratives, feature lifecycles, and incident timelines.";
    }
  } else if (lowerMsg.includes("status") || lowerMsg.includes("health")) {
    reply = `System healthy. ${activeNodes}/${nodeCount} nodes active. Uptime: ${Math.round(process.uptime())}s. Continuous mode: ${continuousPipeline.running ? "active" : "off"}.`;
  } else if (lowerMsg.includes("help") || lowerMsg.includes("what can")) {
    reply = `I can help with: planning your day, running HCFullPipeline, monitoring resources/nodes, orchestrating parallel tasks, automating workflows, and checking system health.`;
  } else if (lowerMsg.includes("stop") || lowerMsg.includes("pause")) {
    if (continuousPipeline.running) {
      clearInterval(continuousPipeline.intervalId);
      continuousPipeline.running = false;
      continuousPipeline.exitReason = "user_requested_stop";
      reply = `Continuous pipeline stopped after ${continuousPipeline.cycleCount} cycles. Resume anytime.`;
    } else {
      reply = "No continuous pipeline running. I'm here whenever you need me!";
    }
  } else {
    reply = `${greeting} I'm HeadyBuddy, your perfect day AI companion and orchestration copilot. ${activeNodes} nodes standing by. How can I help?`;
  }

  res.json({
    reply,
    context: {
      nodes: { total: nodeCount, active: activeNodes },
      continuousMode: continuousPipeline.running,
      cycleCount: continuousPipeline.cycleCount,
    },
    ts: new Date().toISOString(),
  });
});

app.get("/api/buddy/suggestions", (req, res) => {
  const hour = new Date().getHours();
  const reg = loadRegistry();
  const activeNodes = Object.values(reg.nodes || {}).filter(n => n.status === "active").length;
  const chips = [];

  if (hour < 10) chips.push({ label: "Plan my morning", icon: "calendar", prompt: "Help me plan my morning." });
  else if (hour < 14) chips.push({ label: "Plan my afternoon", icon: "calendar", prompt: "Help me plan my afternoon." });
  else if (hour < 18) chips.push({ label: "Wrap up my day", icon: "calendar", prompt: "Help me wrap up today." });
  else chips.push({ label: "Plan tomorrow", icon: "calendar", prompt: "Help me plan tomorrow." });

  chips.push({ label: "Summarize this", icon: "file-text", prompt: "Summarize the content I'm looking at." });
  chips.push({ label: continuousPipeline.running ? "Pipeline status" : "Run pipeline", icon: "play", prompt: continuousPipeline.running ? "Show pipeline status." : "Start HCFullPipeline." });
  if (activeNodes > 0) chips.push({ label: "Check resources", icon: "activity", prompt: "Show resource usage and node health." });
  chips.push({ label: "Surprise me", icon: "sparkles", prompt: "Suggest something useful right now." });

  res.json({ suggestions: chips.slice(0, 5), ts: new Date().toISOString() });
});

app.get("/api/buddy/orchestrator", (req, res) => {
  const reg = loadRegistry();
  const nodes = Object.entries(reg.nodes || {}).map(([id, n]) => ({
    id, name: n.name || id, role: n.role || "unknown",
    status: n.status || "unknown", tier: n.tier || "M",
    lastInvoked: n.last_invoked || null,
  }));
  const mem = process.memoryUsage();

  res.json({
    ok: true,
    system: {
      uptime: process.uptime(),
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1048576),
        heapTotalMB: Math.round(mem.heapTotal / 1048576),
        rssMB: Math.round(mem.rss / 1048576),
      },
    },
    nodes: {
      total: nodes.length,
      active: nodes.filter(n => n.status === "active").length,
      list: nodes,
    },
    resourceTiers: {
      L: nodes.filter(n => n.tier === "L").length,
      M: nodes.filter(n => n.tier === "M").length,
      S: nodes.filter(n => n.tier === "S").length,
    },
    pipeline: {
      available: true,
      state: null,
      continuous: {
        running: continuousPipeline.running,
        cycleCount: continuousPipeline.cycleCount,
        lastCycleTs: continuousPipeline.lastCycleTs,
        exitReason: continuousPipeline.exitReason,
        gates: continuousPipeline.gateResults,
        recentErrors: continuousPipeline.errors.slice(-5),
      },
    },
    ts: new Date().toISOString(),
  });
});

app.post("/api/buddy/pipeline/continuous", (req, res) => {
  const { action = "start" } = req.body;

  if (action === "stop") {
    if (continuousPipeline.intervalId) clearInterval(continuousPipeline.intervalId);
    continuousPipeline.running = false;
    continuousPipeline.exitReason = "user_requested_stop";
    return res.json({ ok: true, action: "stopped", cycleCount: continuousPipeline.cycleCount, ts: new Date().toISOString() });
  }

  if (continuousPipeline.running) return res.json({ ok: true, action: "already_running", cycleCount: continuousPipeline.cycleCount });

  continuousPipeline.running = true;
  continuousPipeline.exitReason = null;
  continuousPipeline.errors = [];
  continuousPipeline.cycleCount = 0;

  const runCycle = () => {
    if (!continuousPipeline.running) return;
    continuousPipeline.cycleCount++;
    continuousPipeline.lastCycleTs = new Date().toISOString();
    continuousPipeline.gateResults = {
      quality: true,
      resource: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) < 0.9,
      stability: true,
      user: continuousPipeline.running,
    };
    const allPass = Object.values(continuousPipeline.gateResults).every(Boolean);

    // Emit story events for pipeline cycles
    if (storyDriver) {
      if (allPass) {
        storyDriver.ingestSystemEvent({
          type: "PIPELINE_CYCLE_COMPLETE",
          refs: { cycleNumber: continuousPipeline.cycleCount, gatesSummary: "all passed" },
          source: "hcfullpipeline",
        });
      } else {
        storyDriver.ingestSystemEvent({
          type: "PIPELINE_GATE_FAIL",
          refs: {
            cycleNumber: continuousPipeline.cycleCount,
            gate: Object.entries(continuousPipeline.gateResults).find(([, v]) => !v)?.[0] || "unknown",
            reason: "Gate check returned false",
          },
          source: "hcfullpipeline",
        });
      }
    }

    if (!allPass) {
      continuousPipeline.running = false;
      continuousPipeline.exitReason = "gate_failed";
      if (continuousPipeline.intervalId) clearInterval(continuousPipeline.intervalId);
    }
  };

  runCycle();
  if (continuousPipeline.running) {
    continuousPipeline.intervalId = setInterval(runCycle, req.body.intervalMs || 30000);
  }

  res.json({
    ok: true, action: "started", running: continuousPipeline.running,
    cycleCount: continuousPipeline.cycleCount, gates: continuousPipeline.gateResults,
    ts: new Date().toISOString(),
  });
});

// ─── HeadyBuddy State Sync Endpoints ─────────────────────────────────
let buddyState = {
  conversation: [],
  viewState: 'pill',
  pipelineState: {},
  config: null
};

app.post('/api/buddy/state', (req, res) => {
  try {
    // Validate and update state
    if (req.body.conversation) buddyState.conversation = req.body.conversation;
    if (req.body.viewState) buddyState.viewState = req.body.viewState;
    if (req.body.pipelineState) buddyState.pipelineState = req.body.pipelineState;
    if (req.body.config) buddyState.config = req.body.config;
    
    res.json({ 
      ok: true, 
      message: 'State updated successfully',
      ts: new Date().toISOString() 
    });
  } catch (err) {
    res.status(500).json({ 
      error: 'State update failed', 
      message: err.message 
    });
  }
});

app.get('/api/buddy/state', (req, res) => {
  res.json({ 
    ...buddyState,
    ts: new Date().toISOString() 
  });
});

// ─── Sync Events Endpoint ────────────────────────────────────────────
app.get('/api/buddy/sync-events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Send initial status
  res.write(`data: ${JSON.stringify({ status: 'connected' })}\n\n`);
  
  // Simulate status updates
  const interval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ status: Math.random() > 0.2 ? 'connected' : 'syncing' })}\n\n`);
  }, 10000);
  
  req.on('close', () => clearInterval(interval));
});

// ─── Secrets & Cloudflare Routes ─────────────────────────────────────
try {
  if (secretsManager) {
    const { registerSecretsRoutes } = require("./src/hc_secrets_manager");
    registerSecretsRoutes(app);
    secretsManager.startMonitor(60_000); // check every 60s
  }
  if (cfManager) {
    const { registerCloudflareRoutes } = require("./src/hc_cloudflare");
    registerCloudflareRoutes(app, cfManager);
  }
} catch (err) {
  console.warn(`  ⚠ Secrets/Cloudflare routes not registered: ${err.message}`);
}

// ─── Aloha Protocol System (Always-On) ───────────────────────────────
const alohaProtocol = loadYamlConfig("aloha-protocol.yaml");
const deOptProtocol = loadYamlConfig("de-optimization-protocol.yaml");
const stabilityFirst = loadYamlConfig("stability-first.yaml");

const alohaState = {
  mode: "aloha",
  activeSince: new Date().toISOString(),
  protocols: {
    aloha: !!alohaProtocol,
    deOptimization: !!deOptProtocol,
    stabilityFirst: !!stabilityFirst,
  },
  stabilityDiagnosticMode: false,
  crashReports: [],
  deOptChecks: 0,
};

if (alohaProtocol) console.log("  \u221e Aloha Protocol: LOADED (always-on)");
if (deOptProtocol) console.log("  \u221e De-Optimization Protocol: LOADED (simplicity > speed)");
if (stabilityFirst) console.log("  \u221e Stability First: LOADED (the canoe must not sink)");

app.get("/api/aloha/status", (req, res) => {
  res.json({
    ok: true,
    mode: alohaState.mode,
    activeSince: alohaState.activeSince,
    protocols: alohaState.protocols,
    stabilityDiagnosticMode: alohaState.stabilityDiagnosticMode,
    crashReportCount: alohaState.crashReports.length,
    deOptChecksRun: alohaState.deOptChecks,
    priorities: alohaProtocol ? alohaProtocol.priorities : null,
    ts: new Date().toISOString(),
  });
});

app.get("/api/aloha/protocol", (req, res) => {
  if (!alohaProtocol) return res.status(404).json({ error: "Aloha protocol not found" });
  res.json({ ok: true, ...alohaProtocol, ts: new Date().toISOString() });
});

app.get("/api/aloha/de-optimization", (req, res) => {
  if (!deOptProtocol) return res.status(404).json({ error: "De-optimization protocol not found" });
  res.json({ ok: true, ...deOptProtocol, ts: new Date().toISOString() });
});

app.get("/api/aloha/stability", (req, res) => {
  if (!stabilityFirst) return res.status(404).json({ error: "Stability first protocol not found" });
  res.json({ ok: true, ...stabilityFirst, ts: new Date().toISOString() });
});

app.get("/api/aloha/priorities", (req, res) => {
  if (!alohaProtocol) return res.status(404).json({ error: "Aloha protocol not found" });
  res.json({
    ok: true,
    priorities: alohaProtocol.priorities,
    no_assist: alohaProtocol.no_assist,
    web_baseline: alohaProtocol.web_baseline,
    ts: new Date().toISOString(),
  });
});

app.get("/api/aloha/checklist", (req, res) => {
  if (!deOptProtocol) return res.status(404).json({ error: "De-optimization protocol not found" });
  res.json({
    ok: true,
    checklist: deOptProtocol.checklist,
    code_rules: deOptProtocol.code_generation,
    arch_rules: deOptProtocol.architecture_suggestions,
    prompt_rules: deOptProtocol.prompt_and_workflow,
    ts: new Date().toISOString(),
  });
});

app.post("/api/aloha/crash-report", (req, res) => {
  const { description, context, severity } = req.body;
  const report = {
    id: `crash-${Date.now()}`,
    description: description || "IDE/system crash reported",
    context: context || "unknown",
    severity: severity || "high",
    ts: new Date().toISOString(),
  };
  alohaState.crashReports.push(report);
  alohaState.stabilityDiagnosticMode = true;

  // Wire crash report into self-critique
  if (selfCritiqueEngine) {
    selfCritiqueEngine.recordCritique({
      context: "stability:crash",
      weaknesses: [`System crash: ${report.description}`],
      severity: "critical",
      suggestedImprovements: [
        "Enter Stability Diagnostic Mode",
        "Reduce local resource usage",
        "Disable non-essential extensions",
      ],
    });
  }

  // Wire into story driver
  if (storyDriver) {
    storyDriver.ingestSystemEvent({
      type: "STABILITY_CRASH_REPORTED",
      refs: { crashId: report.id, description: report.description },
      source: "aloha_protocol",
    });
  }

  res.json({
    ok: true,
    report,
    diagnosticMode: true,
    checklist: stabilityFirst ? stabilityFirst.crash_response.diagnostic_mode.checks : [],
    message: "Stability Diagnostic Mode activated. Follow the checklist.",
  });
});

app.post("/api/aloha/de-opt-check", (req, res) => {
  const { suggestion, context } = req.body;
  alohaState.deOptChecks++;

  const result = {
    checkNumber: alohaState.deOptChecks,
    suggestion: suggestion || "unnamed",
    context: context || "general",
    questions: deOptProtocol ? deOptProtocol.checklist.steps : [],
    recommendation: "Prefer the simpler alternative unless measured need exists",
    ts: new Date().toISOString(),
  };

  res.json({ ok: true, ...result });
});

app.get("/api/aloha/web-baseline", (req, res) => {
  if (!alohaProtocol) return res.status(404).json({ error: "Aloha protocol not found" });
  res.json({
    ok: true,
    non_negotiable: true,
    requirements: alohaProtocol.web_baseline,
    message: "Websites must be fully functional as baseline. This is the easy thing to do.",
    ts: new Date().toISOString(),
  });
});

// ─── Access Point Configuration Loader ────────────────────────────────
const accessConfig = require('./configs/access-points.yaml');

app.use('/api/access-points', (req, res) => {
  res.json(accessConfig);
});

const headybuddyConfigRouter = require('./src/routes/headybuddy-config');
app.use('/api/headybuddy-config', headybuddyConfigRouter);

// ─── Error Handler ──────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("HeadyManager Error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
    ts: new Date().toISOString(),
  });
});

// ─── SPA Fallback ───────────────────────────────────────────────────
app.get("*", (req, res) => {
  const indexPath = path.join(frontendBuildPath, "index.html");
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(404).json({ error: "Not found" });
});

// ─── Start ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ∞ Heady Manager v3.0.0 listening on port ${PORT}`);
  console.log(`  ∞ Health: http://localhost:${PORT}/api/health`);
  console.log(`  ∞ Environment: ${process.env.NODE_ENV || "development"}\n`);
});
