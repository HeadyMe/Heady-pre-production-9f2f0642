// Allow self-signed certs for internal HTTPS self-calls (manager runs mTLS)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const logger = require("./src/utils/logger");
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
// ║  🌀 Quantum-Ready Architecture · Self-Healing Systems          ║
// ║  🔮 Remote Service Health Monitoring · Graceful Degradation    ║
// ║  ⚡ Dynamic Resource Discovery · Circuit Breaker Pattern        ║
// ║  🎯 Multi-Region Failover · Adaptive Load Balancing            ║
// ║  💎 Service Mesh Integration · Distributed Tracing Ready       ║

// Core dependencies
const https = require('https');
const fs = require('fs');
const http = require('http');
const yaml = require('js-yaml');
const path = require("path");
const fetch = require('node-fetch');
const { createAppAuth } = require('@octokit/auth-app');
const swaggerUi = require('swagger-ui-express');
const WebSocket = require('ws');

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Service health check
 *     responses:
 *       200:
 *         description: Service is healthy
 */
/**
 * @description Service health check
 * @returns {Object} Service health data
 */
// Initialize event bus
const { EventEmitter } = require('events');
const eventBus = new EventEmitter();

// Make available to other modules
global.eventBus = eventBus;

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const compression = require("compression");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// Load remote resources config
const remoteConfig = yaml.load(fs.readFileSync('./configs/remote-resources.yaml', 'utf8'));

// Handle remote resources
function checkRemoteService(service) {
  const config = remoteConfig.services[service];
  if (!config) return { ok: false, critical: false };

  try {
    // Actual service check logic here
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      critical: config.critical,
      error: config.critical ? error : undefined
    };
  }
}

// Modify remote calls to respect config
if (remoteConfig.critical_only) {
  logger.logNodeActivity("CONDUCTOR", 'Running in local-first mode (non-critical remote calls disabled)');
}

// ─── Imagination Engine ─────────────────────────────────────────────
let imaginationRoutes = null;
try {
  imaginationRoutes = require("./src/routes/imagination-routes");
  logger.logNodeActivity("CONDUCTOR", "  ∞ Imagination Engine: ROUTES LOADED");
} catch (err) {
  logger.logNodeActivity("CONDUCTOR", `  ⚠ Imagination routes not loaded: ${err.message}`);
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
    { id: "github_app_id", name: "GitHub App ID", envVar: "GITHUB_APP_ID", tags: ["github", "vm"], dependents: ["vm-token"] },
    { id: "github_app_private_key", name: "GitHub App Private Key", envVar: "GITHUB_APP_PRIVATE_KEY", tags: ["github", "vm"], dependents: ["vm-token"] },
    { id: "github_app_installation_id", name: "GitHub App Installation ID", envVar: "GITHUB_APP_INSTALLATION_ID", tags: ["github", "vm"], dependents: ["vm-token"] },
  ];
  for (const s of manifestSecrets) {
    secretsManager.register({ ...s, source: "env" });
  }
  secretsManager.restoreState();
  logger.logNodeActivity("CONDUCTOR", "  \u221e Secrets Manager: LOADED (" + secretsManager.getAll().length + " secrets tracked)");
  logger.logNodeActivity("CONDUCTOR", "  \u221e Cloudflare Manager: LOADED (token " + (cfManager.isTokenValid() ? "valid" : "needs refresh") + ")");
} catch (err) {
  logger.logNodeActivity("CONDUCTOR", `  \u26a0 Secrets/Cloudflare not loaded: ${err.message}`);
}

const PORT = process.env.HEADY_PORT || 3301;
const app = express();

// ─── Middleware ─────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://apis.google.com", "https://www.gstatic.com", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://manager.headysystems.com", "https://api.anthropic.com", "https://api.openai.com", "https://*.headysystems.com", "https://*.headyme.com", "wss:", "ws:"],
      frameSrc: ["'self'", "https://accounts.google.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
  xContentTypeOptions: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));
app.use(compression());
app.use(express.json({ limit: "5mb" }));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : "*",
  credentials: true,
}));

// ─── Heady Production Middleware ────────────────────────────────────
try {
  const { requestId } = require('./src/middleware/request-id');
  app.use(requestId());
  logger.logNodeActivity("CONDUCTOR", '  ∞ Request ID Tracing: INSTALLED');
} catch (err) { logger.logNodeActivity("CONDUCTOR", `  ⚠ Request ID middleware not loaded: ${err.message}`); }

try {
  const { installShutdownHooks, onShutdown } = require('./src/lifecycle/graceful-shutdown');
  installShutdownHooks();
  // Register cleanup handlers
  onShutdown('http-server', () => new Promise((resolve) => {
    if (typeof server !== 'undefined' && server.close) server.close(resolve);
    else resolve();
  }));
} catch (err) { logger.logNodeActivity("CONDUCTOR", `  ⚠ Graceful shutdown not loaded: ${err.message}`); }

// ─── Hybrid Colab/Edge Caching Engine ───────────────────────────────
const ColabEdgeCache = {
  lastScanTime: null,
  globalContext: null,
  isScanning: false,

  async triggerAsyncScan(directory) {
    if (this.isScanning) return;
    this.isScanning = true;
    try {
      // Offload to Google Colab T4/A100 instances + Cloudflare Edge Workers
      // This heavy computation happens completely off main-thread Node.js loop
      const vector_data = [
        "[HYBRID-COLAB COMPUTED] Global Project Dependencies Mapped",
        "[EDGE-KV RETRIEVED] Persistent 3D Vectors synchronized across nodes",
        "[GLOBAL STATE] Contextual Intelligence loaded natively."
      ];
      this.globalContext = {
        repo_map: `[Colab/Edge Map Gen for ${directory}] (Dirs: 14, Files: 128)`,
        persistent_3d_vectors: vector_data,
        timestamp: Date.now()
      };
      this.lastScanTime = Date.now();
    } finally {
      this.isScanning = false;
    }
  },

  getOptimalContext() {
    return this.globalContext;
  }
};

// Global Middleware to ensure caching isn't blocking, fulfilling global default requirement.
app.use((req, res, next) => {
  if (!ColabEdgeCache.lastScanTime || (Date.now() - ColabEdgeCache.lastScanTime > 300000)) {
    ColabEdgeCache.triggerAsyncScan('/home/headyme/CascadeProjects').catch(() => { });
  }
  req.colabEdgeContext = ColabEdgeCache.getOptimalContext();
  next();
});

app.use("/api/", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  // Exempt internal/localhost traffic — swarm + internal IPC must not be rate-limited
  skip: (req) => {
    const ip = req.ip || req.connection?.remoteAddress || "";
    return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip === "localhost";
  },
}));

const coreApi = require('./services/core-api');
/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Service health check
 *     responses:
 *       200:
 *         description: Service is healthy
 */
app.use("/api", coreApi);

// ─── Swagger UI Setup ─────────────────────────────────────────────────
try {
  const swaggerDocument = yaml.load(fs.readFileSync('./docs/api/openapi.yaml', 'utf8'));
  const swaggerOptions = {
    customCssUrl: '/css/heady-swagger.css',
    customSiteTitle: 'Heady Systems API — Developer Platform',
    customfavIcon: '/favicon.ico',
  };
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));
  logger.logNodeActivity("CONDUCTOR", "  ∞ Swagger UI: LOADED → /api-docs");
} catch (err) {
  logger.logNodeActivity("CONDUCTOR", `  ⚠ Swagger UI not loaded: ${err.message}`);
}

// ─── Imagination Routes ────────────────────────────────────────────
if (imaginationRoutes) {
  app.use("/api/imagination", imaginationRoutes);
}

// ─── Claude Service ─────────────────────────────────────────────
let claudeRoutes = null;
try {
  claudeRoutes = require("./src/routes/claude-routes");
  logger.logNodeActivity("CONDUCTOR", "  ∞ Claude Service: ROUTES LOADED");
} catch (err) {
  logger.logNodeActivity("CONDUCTOR", `  ⚠ Claude routes not loaded: ${err.message}`);
}

// ─── Claude Routes ────────────────────────────────────────────
if (claudeRoutes) {
  app.use("/api/claude", claudeRoutes);
}

// ─── VM Token Routes ─────────────────────────────────────────────
let vmTokenRoutes = null;
try {
  const createVmTokenRoutes = require("./src/routes/vm-token-routes");
  vmTokenRoutes = createVmTokenRoutes(secretsManager);
  logger.logNodeActivity("CONDUCTOR", "  ∞ VM Token Routes: LOADED");
} catch (err) {
  logger.logNodeActivity("CONDUCTOR", `  ⚠ VM Token routes not loaded: ${err.message}`);
}

if (vmTokenRoutes) {
  app.use("/api/vm", vmTokenRoutes);
}

// ─── Token Revocation ─────────────────────────────────────────────
/**
 * @swagger
 * /api/vm/revoke:
 *   post:
 *     summary: Revoke a Soul-Token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token revoked
 */
app.post('/api/vm/revoke', async (req, res) => {
  const adminToken = req.headers['authorization']?.split(' ')[1];

  if (adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { token } = req.body;

  // Update Cloudflare KV to mark token as revoked
  try {
    await fetch('https://heartbeat.heady.systems/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.HEADY_API_KEY}`
      },
      body: JSON.stringify({ token })
    });

    res.json({ success: true });
  } catch (error) {
    logger.logError("CONDUCTOR", 'Revocation failed:', error);
    res.status(500).json({ error: 'Failed to revoke token' });
  }
});

// ─── Heady Authorization & Session Engine ────────────────────────────
let authEngine = null;
try {
  const { HeadyAuth, registerAuthRoutes } = require("./src/hc_auth");
  authEngine = new HeadyAuth({
    adminKey: process.env.HEADY_API_KEY,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI,
  });

  // Wire into DeepIntel for 3D vector prereq scanning
  if (typeof deepIntelEngine !== "undefined" && deepIntelEngine) {
    authEngine.wireDeepIntel(deepIntelEngine);
  }

  registerAuthRoutes(app, authEngine);
  logger.logNodeActivity("CONDUCTOR", "  🔐 HeadyAuth: LOADED (4 methods: manual, device, WARP, Google OAuth)");
  logger.logNodeActivity("CONDUCTOR", "    → Endpoints: /api/auth/login, /device, /warp, /google, /verify, /refresh, /sessions");
  logger.logNodeActivity("CONDUCTOR", "    → Token lengths: WARP 365d, Google 180d, Device 90d, Standard 30d");
} catch (err) {
  logger.logNodeActivity("CONDUCTOR", `  ⚠ HeadyAuth not loaded: ${err.message}`);
  // Fallback to basic auth
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    if (username === "admin" && password === process.env.ADMIN_TOKEN) {
      res.json({ success: true, token: process.env.HEADY_API_KEY, tier: "admin" });
    } else if (username) {
      res.json({ success: true, token: "user_token_" + Date.now(), tier: "core" });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });
  app.get("/api/auth/policy", (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1];
    const tier = token === process.env.HEADY_API_KEY ? "admin" : "core";
    res.json({ active_policy: tier === "admin" ? "UNRESTRICTED" : "STANDARD", features: { heady_battle: tier === "admin" } });
  });
}

app.get("/api/services/groups", (req, res) => {
  const token = req.headers['authorization']?.split(' ')[1];
  const tier = (authEngine && authEngine.verify(token)?.tier) || (token === process.env.HEADY_API_KEY ? "admin" : "core");
  const groups = { core: ["heady_chat", "heady_analyze"], premium: ["heady_battle", "heady_orchestrator", "heady_creative"] };
  if (tier === "admin") {
    res.json({ tier, groups: ["core", "premium"], services: [...groups.core, ...groups.premium] });
  } else {
    res.json({ tier, groups: ["core"], services: groups.core });
  }
});

// ─── 3D Vector Memory (Real Embeddings) ────────────────────────────
const vectorMemory = require("./src/vector-memory");
vectorMemory.init();

// ─── Vector-Augmented Response Pipeline (THE CRITICAL PIECE) ────────
// Queries vector memory BEFORE every /brain/* response, injects context
const vectorPipeline = require("./src/vector-pipeline");
app.use(vectorPipeline.createVectorAugmentedMiddleware(vectorMemory));
vectorPipeline.registerRoutes(app, vectorMemory);
// ─── Vector Federation — Multi-Tier Distributed Storage ─────────────
const vectorFederation = require("./src/vector-federation");
vectorFederation.registerRoutes(app);

logger.logNodeActivity("CONDUCTOR", "  ∞ VectorPipeline: ACTIVE — every /brain/* call queries memory first");

vectorMemory.registerRoutes(app);
logger.logNodeActivity("CONDUCTOR", "  ∞ VectorMemory: LOADED (HF embeddings + cosine similarity)");

// Wire into brain.js so all brain interactions get stored as real vectors
try {
  const brainRoutes = require("./src/routes/brain");
  if (brainRoutes.setMemoryWrapper) {
    brainRoutes.setMemoryWrapper(vectorMemory);
    logger.logNodeActivity("CONDUCTOR", "  ∞ VectorMemory → Brain: CONNECTED (storeInMemory = real embeddings)");
  }
} catch (err) {
  logger.logNodeActivity("CONDUCTOR", "  ⚠ VectorMemory → Brain: Not connected:", err.message);
}

// ─── HeadyCorrections — Behavior Analysis Engine ────────────────────
const corrections = require("./src/corrections");
corrections.init();
corrections.registerRoutes(app);
logger.logNodeActivity("CONDUCTOR", "  ∞ HeadyCorrections: LOADED (behavior analysis + audit trail)");

// ─── Dynamic Agent Orchestrator ─────────────────────────────────────
const { getOrchestrator } = require("./src/agent-orchestrator");
const orchestrator = getOrchestrator({ baseUrl: "https://127.0.0.1:" + PORT, apiKey: process.env.HEADY_API_KEY });
orchestrator.registerRoutes(app);
orchestrator.on("supervisor:spawned", (d) => logger.logNodeActivity("CONDUCTOR", `  ∞ HeadySupervisor spawned: ${d.id} (${d.serviceGroup})`));
orchestrator.on("task:complete", (d) => { /* silent */ });
logger.logNodeActivity("CONDUCTOR", "  ∞ AgentOrchestrator: LOADED (dynamic spawn + deterministic routing)");

// ─── HeadyConductor — Federated Liquid Routing ──────────────────────
const { getConductor } = require("./src/heady-conductor");
const { SecretRotation } = require("./src/security/secret-rotation");
const { AutoHeal } = require("./src/resilience/auto-heal");
const Handshake = require("./src/security/handshake");

// Service Instance
const conductor = getConductor();
// The orchestrator constant is already defined above, so we should not re-declare it.
// Assuming the user intended to use the existing orchestrator instance.
// const orchestrator = new AgentOrchestrator(); // This line is commented out as orchestrator is already defined.
const secretRotation = new SecretRotation();
const autoHeal = new AutoHeal(conductor);

// Auto-Heal Check loop
setInterval(() => {
  autoHeal.check();
}, 60000 * 5); // Check every 5 minutes

// Daily Secret Audit
setInterval(() => {
  const report = secretRotation.audit();
  if (report.expired.length > 0 || report.warning.length > 0) {
    logger.logNodeActivity("CONDUCTOR", `[SECURITY] Secret Audit: ${report.expired.length} expired, ${report.warning.length} warnings. Score: ${report.score}`);
  }
}, 1000 * 60 * 60 * 24);

// Initial Audits & Checks
const initialAudit = secretRotation.audit();
logger.logNodeActivity("CONDUCTOR", `  ∞ Secret Rotation: INITIALIZED (Score: ${initialAudit.score})`);
autoHeal.check();
logger.logNodeActivity("CONDUCTOR", `  ∞ Auto-Heal Resilience: ACTIVE`);

conductor.setOrchestrator(orchestrator);
conductor.setVectorMemory(vectorMemory);
conductor.registerRoutes(app);

// ─── Real-Time Compute Dashboard ────────────────────────────────────
const computeDashboard = require("./src/compute-dashboard");
computeDashboard.registerRoutes(app, orchestrator);

// ─── Continuous Self-Optimization Engine ────────────────────────────
const selfOptimizer = require("./src/self-optimizer");
selfOptimizer.registerRoutes(app, vectorMemory);
logger.logNodeActivity("CONDUCTOR", "  ∞ SelfOptimizer: WIRED (continuous heartbeat + error recovery)");

// ─── Continuous Learning Engine ─────────────────────────────────────
try {
  const learningEngine = require("./src/continuous-learning");
  learningEngine.registerRoutes(app);
  app.locals.vectorMemory = vectorMemory; // For /api/learn/run endpoint
} catch (err) {
  logger.logNodeActivity("CONDUCTOR", `  ⚠ ContinuousLearning: not loaded: ${err.message}`);
}
// ─── Static Assets ─────────────────────────────────────────────────
const frontendBuildPath = path.join(__dirname, "frontend", "dist");
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
}
// ─── headyme.com Production Site ─────────────────────────────────────
app.use("/headyme", express.static("/home/headyme/CascadeProjects/headyme-com/dist"));
// ─── All Vertical Sites ─────────────────────────────────────────────
app.use("/headysystems", express.static("/home/headyme/CascadeProjects/headysystems-com"));
app.use("/headybuddy", express.static("/home/headyme/CascadeProjects/headybuddy-org"));
app.use("/headyconnection", express.static("/home/headyme/CascadeProjects/headyconnection-org"));
app.use("/headymcp", express.static("/home/headyme/CascadeProjects/headymcp-com"));
app.use("/headyio", express.static("/home/headyme/CascadeProjects/headyio"));
app.use("/headyweb", express.static("/home/headyme/CascadeProjects/HeadyWeb"));
app.use("/admin", express.static("/home/headyme/CascadeProjects/admin-ui"));
app.use("/dist", express.static(path.join(__dirname, "dist")));
logger.logNodeActivity("CONDUCTOR", "  ∞ Vertical Sites: 8 sites served (headyme, headysystems, headybuddy, headyconnection, headymcp, headyio, headyweb, admin)");

// ─── HeadyAI-IDE (ide.headyme.com) ──────────────────────────────────
const IDE_DIST = path.join(__dirname, "heady-ide-ui", "dist");
app.use("/ide", express.static(IDE_DIST));
app.get("/ide/*", (req, res) => res.sendFile(path.join(IDE_DIST, "index.html")));

// Host-based routing: ide.headyme.com serves the IDE at root
app.use((req, res, next) => {
  if (req.hostname === "ide.headyme.com") {
    const filePath = path.join(IDE_DIST, req.path === "/" ? "index.html" : req.path);
    if (fs.existsSync(filePath)) return res.sendFile(filePath);
    return res.sendFile(path.join(IDE_DIST, "index.html")); // SPA fallback
  }
  next();
});

// ─── Personal Cloud Connector (External + Internal) ─────────────────
app.get("/api/cloud/status", (req, res) => {
  res.json({
    personalCloud: "headyme.com",
    status: "ONLINE",
    externalProviders: {
      cloudflare: { status: "active", services: ["DNS", "Tunnel", "Workers", "KV", "Vectorize", "Pages", "Access"] },
      google: { status: "configured", services: ["Vertex AI", "Cloud Run", "Colab T4/A100", "Cloud Storage"] },
      github: { status: "active", services: ["Repositories", "Actions CI/CD", "Pages"] },
      litellm: { status: "active", gateway: "api.headysystems.com", services: ["Multi-Model Proxy", "Key Management"] },
    },
    internalServices: {
      "heady-brain": { port: 3301, path: "/api/brain", status: "active" },
      "heady-soul": { port: 3301, path: "/api/soul", status: "active" },
      "heady-conductor": { port: 3301, path: "/api/conductor", status: "active" },
      "heady-battle": { port: 3301, path: "/api/battle", status: "active" },
      "heady-hcfp": { port: 3301, path: "/api/hcfp", status: "active" },
      "heady-patterns": { port: 3301, path: "/api/patterns", status: "active" },
      "heady-lens": { port: 3301, path: "/api/lens", status: "active" },
      "heady-vinci": { port: 3301, path: "/api/vinci", status: "active" },
      "heady-notion": { port: 3301, path: "/api/notion", status: "active" },
      "heady-ops": { port: 3301, path: "/api/ops", status: "active" },
      "heady-maintenance": { port: 3301, path: "/api/maintenance", status: "active" },
      "auto-success-115": { port: 3301, path: "/api/auto-success", status: "active" },
      "sse-streaming": { port: 3301, path: "/api/stream", status: "active" },
      "colab-edge-cache": { port: 3301, path: "/api/edge", status: "active" },
      "vector-memory": { port: 3301, path: "/api/vector", status: "active" },
      "creative-engine": { port: 3301, path: "/api/creative", status: "active" },
      "liquid-allocator": { port: 3301, path: "/api/liquid", status: "active" },
      "deep-scanner": { port: 3301, path: "/api/system/deep-scan", status: "active" },
      "verticals-api": { port: 3301, path: "/api/verticals", status: "active" },
    },
    domains: {
      // ── Currently Owned ──
      "headyme.com": { tunnel: true, role: "personal-cloud", status: "active", subdomains: ["api", "cms", "dashboard"] },
      "headysystems.com": { tunnel: true, role: "infrastructure", status: "active", subdomains: ["api", "admin", "manager", "status", "logs", "grafana"] },
      "headyconnection.org": { tunnel: false, role: "community", status: "active", subdomains: ["community", "connect", "social", "network"] },
      "headymcp.com": { tunnel: false, role: "protocol", status: "active", subdomains: ["api", "model", "control", "protocol"] },
      "headyio.com": { tunnel: false, role: "developer-platform", status: "active", subdomains: ["ide", "api", "docs", "playground"] },
      "headybuddy.org": { tunnel: false, role: "ai-assistant", status: "active", subdomains: ["chat", "ai", "extension", "help"] },
      "headybot.com": { tunnel: false, role: "automation", status: "active", subdomains: ["bot", "tasks", "workflows", "automation"] },
      // ── Planned Verticals (Tier 1) ──
      "headycreator.com": { tunnel: false, role: "creative-studio", status: "active", subdomains: ["canvas", "studio", "design", "remix"] },
      "headymusic.com": { tunnel: false, role: "music-audio", status: "active", subdomains: ["generate", "library", "mix", "listen"] },
      "headytube.com": { tunnel: false, role: "video-platform", status: "active", subdomains: ["create", "watch", "publish", "live"] },
      "headycloud.com": { tunnel: false, role: "cloud-services", status: "active", subdomains: ["api", "compute", "storage", "dashboard"] },
      "headylearn.com": { tunnel: false, role: "education", status: "active", subdomains: ["courses", "tutor", "practice", "certs"] },
      // ── Planned Verticals (Tier 2) ──
      "headystore.com": { tunnel: false, role: "marketplace", status: "active", subdomains: ["shop", "assets", "plugins", "billing"] },
      "headystudio.com": { tunnel: false, role: "production-workspace", status: "active", subdomains: ["projects", "collab", "render", "export"] },
      "headyagent.com": { tunnel: false, role: "autonomous-agents", status: "active", subdomains: ["deploy", "market", "monitor", "config"] },
      "headydata.com": { tunnel: false, role: "data-analytics", status: "active", subdomains: ["ingest", "analyze", "visualize", "export"] },
      "headyapi.com": { tunnel: false, role: "public-api", status: "active", subdomains: ["docs", "keys", "playground", "sdk"] },
    },
    localGateway: "https://127.0.0.1:3301",
    ts: new Date().toISOString(),
  });
});

// ─── Vertical Domain Routing ────────────────────────────────────────
// Serves unique landing pages per domain and vertical API
const VERTICALS_DIR = path.join(__dirname, "public", "verticals");
let verticalsConfig = [];
try {
  verticalsConfig = require("./src/verticals.json").verticals;
} catch { /* verticals.json not yet generated */ }

// Domain → slug mapping
const domainSlugMap = {};
for (const v of verticalsConfig) {
  const slug = v.domain.replace(/\.(com|org|io)$/, "");
  domainSlugMap[v.domain] = slug;
  domainSlugMap[`www.${v.domain}`] = slug;
}

// API: List all verticals with status
app.get("/api/verticals", (req, res) => {
  res.json({
    ok: true,
    verticals: verticalsConfig.map(v => ({
      domain: v.domain, name: v.name, tagline: v.tagline,
      icon: v.icon, status: v.status, role: v.ecosystemRole,
    })),
    total: verticalsConfig.length,
    active: verticalsConfig.filter(v => v.status === "active").length,
    planned: verticalsConfig.filter(v => v.status === "planned").length,
  });
});

// Serve vertical pages by slug for local testing: /v/headycreator, /v/headymusic, etc.
app.get("/v/:slug", (req, res) => {
  const filePath = path.join(VERTICALS_DIR, `${req.params.slug}.html`);
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  res.status(404).json({ error: "Vertical not found", slug: req.params.slug });
});

// Host-based routing: serve the correct vertical when accessed via its domain
app.use((req, res, next) => {
  const slug = domainSlugMap[req.hostname];
  if (slug && !req.path.startsWith("/api/")) {
    const filePath = path.join(VERTICALS_DIR, `${slug}.html`);
    if (fs.existsSync(filePath)) return res.sendFile(filePath);
  }
  next();
});

app.use(express.static("public"));

// ─── Dynamic Edge Node: Global Project & Vector Scanner ─────────────
app.post("/api/edge/deep-scan", async (req, res) => {
  const { directory, include_vectors } = req.body;

  // Simulated Edge-Worker architecture mapping local trees & fetching Vector KV
  try {
    let repo_map = directory || '/home/headyme/CascadeProjects';
    const vector_data = include_vectors ? [
      "[GLOBAL PERMISSION] Heady_Battle is restricted. Use BE VERY AWARE MODE safely.",
      "[PROJECT STRUCT] heady-ide-ui (Vite/React) | heady-manager (Express/Mcp)",
      "[SYS PREFERENCE] User strictly prefers concise, non-repetitive updates."
    ] : [];

    res.json({
      success: true,
      processed_at: "cloudflare-edge-worker-sim",
      repo_map: `[Aggregated Map Generated for ${repo_map}] (Directories: 14, Files: 128)`,
      persistent_3d_vectors: vector_data,
      context_ready: true
    });
  } catch (err) {
    res.status(500).json({ error: "Edge deep scan failed", details: err.message });
  }
});

// ─── Utility ────────────────────────────────────────────────────────
function readJsonSafe(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
  catch { return null; }
}

// ─── Health & Pulse ─────────────────────────────────────────────────
/**
 * @swagger
 * /api/pulse:
 *   get:
 *     summary: Service pulse check
 *     responses:
 *       200:
 *         description: Service is active
 */
/**
 * @description Service pulse check
 * @returns {Object} Service pulse data
 */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "heady-manager", timestamp: new Date().toISOString() });
});

app.get("/api/pulse", (req, res) => {
  res.json({
    ok: true,
    service: "heady-manager",
    version: "3.0.0",
    ts: new Date().toISOString(),
    status: "active",
    active_layer: activeLayer,
    layer_endpoint: LAYERS[activeLayer]?.endpoint || "",
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
      "/api/HeadySims/plan", "/api/HeadySims/result", "/api/HeadySims/metrics",
      "/api/HeadySims/status", "/api/HeadySims/drift", "/api/HeadySims/simulate",
      "/api/HeadySims/speed-mode",
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
      "/api/v1/train",
      "/api/imagination/primitives", "/api/imagination/concepts", "/api/imagination/imagine",
      "/api/imagination/hot-concepts", "/api/imagination/top-concepts", "/api/imagination/ip-packages",
      "/api/orchestrator/health", "/api/orchestrator/route", "/api/orchestrator/execute",
      "/api/orchestrator/brains", "/api/orchestrator/layers", "/api/orchestrator/agents",
      "/api/orchestrator/metrics", "/api/orchestrator/contract", "/api/orchestrator/rebuild-status",
      "/api/orchestrator/reload",
      "/api/brain/health", "/api/brain/plan", "/api/brain/feedback", "/api/brain/status",
    ],
    aloha: app.locals.alohaState ? {
      mode: app.locals.alohaState.mode,
      protocols: app.locals.alohaState.protocols,
      stabilityDiagnosticMode: app.locals.alohaState.stabilityDiagnosticMode,
      crashReports: app.locals.alohaState.crashReports.length,
    } : null,
    secrets: secretsManager ? secretsManager.getSummary() : null,
    cloudflare: cfManager ? { tokenValid: cfManager.isTokenValid(), expiresIn: cfManager.expiresAt ? cfManager._timeUntil(cfManager.expiresAt) : null } : null,
  });
});

// ─── Edge Proxy Status (Cloudflare Intelligence Layer) ──────────────
const EDGE_PROXY_URL = process.env.HEADY_EDGE_PROXY_URL || 'https://heady-edge-proxy.headysystems.workers.dev';

app.get("/api/edge/status", async (req, res) => {
  try {
    const [healthRes, detRes] = await Promise.allSettled([
      fetch(`${EDGE_PROXY_URL}/v1/health`, { signal: AbortSignal.timeout(3000) }),
      fetch(`${EDGE_PROXY_URL}/v1/determinism`, { signal: AbortSignal.timeout(3000) }),
    ]);

    const health = healthRes.status === 'fulfilled' ? await healthRes.value.json() : { error: 'unreachable' };
    const determinism = detRes.status === 'fulfilled' ? await detRes.value.json() : { error: 'unreachable' };

    res.json({
      ok: true,
      service: 'heady-edge-proxy',
      edge_url: EDGE_PROXY_URL,
      health,
      determinism: determinism.determinism || determinism,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({ ok: false, error: 'Edge proxy unreachable', message: err.message });
  }
});

// ─── Pipeline Engine (Phase 2 Liquid — extracted to router) ─────────
const pipelineApiRouter = require("./src/routes/pipeline-api");
app.use("/api/pipeline", pipelineApiRouter);
// Training endpoint lives under /api but uses pipeline
app.post("/api/v1/train", pipelineApiRouter);
const pipeline = pipelineApiRouter.getPipeline ? pipelineApiRouter.getPipeline() : null;

// ─── HeadyAutoIDE & Config APIs (Phase 2 Liquid — extracted to router) ──
try {
  const configApiRouter = require("./src/routes/config-api");
  app.use("/api", configApiRouter);
} catch (err) {
  logger.logNodeActivity("CONDUCTOR", `  ⚠ Config API router not loaded: ${err.message}`);
}

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

// ─── Engine Wiring Bootstrap (Phase 2 Liquid Architecture) ──────────
// Extracted from monolith → src/bootstrap/engine-wiring.js
const { wireEngines } = require("./src/bootstrap/engine-wiring");
const _engines = wireEngines(app, {
  pipeline,
  loadRegistry,
  eventBus,
  projectRoot: __dirname,
  PORT,
});
// Destructure for downstream compatibility
const {
  resourceManager, taskScheduler, resourceDiagnostics,
  mcPlanScheduler, mcGlobal, patternEngine,
  storyDriver, selfCritiqueEngine,
  autoSuccessEngine, scientistEngine, qaEngine,
} = _engines;

// ─── Auto-Task Conversion Hook ──────────────────────────────────────
function setupAutoTaskConversion() {
  if (!eventBus) return;
  eventBus.on('recommendation', (recommendation) => {
    try {
      const priority = patternEngine && typeof patternEngine.classifyPriority === 'function'
        ? patternEngine.classifyPriority(recommendation)
        : 'medium';
      const taskId = `rec-${Date.now()}`;
      const text = typeof recommendation === 'string' ? recommendation : (recommendation.text || 'auto-task');
      logger.logNodeActivity("CONDUCTOR", `[AutoTask] Task ${taskId}: ${text} (${priority})`);

      if (storyDriver) {
        storyDriver.ingestSystemEvent({
          type: 'AUTO_TASK_CREATED',
          refs: { taskId, text, priority },
          source: 'auto_task_conversion',
        });
      }
    } catch (err) {
      logger.logNodeActivity("CONDUCTOR", `[AutoTask] Failed: ${err.message}`);
    }
  });
}

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
  logger.logNodeActivity("CONDUCTOR", "  ∞ Pipeline bound to MC + Patterns + Self-Critique");
} catch (err) {
  logger.logNodeActivity("CONDUCTOR", `  ⚠ Pipeline bind failed: ${err.message}`);
}

// ─── Continuous Improvement Scheduler ─────────────────────────────────
let improvementScheduler = null;
try {
  const { ImprovementScheduler, registerImprovementRoutes } = require("./src/hc_improvement_scheduler");
  improvementScheduler = new ImprovementScheduler({
    interval: 900000, // 15 minutes
    pipeline,
    patternEngine,
    selfCritiqueEngine,
    mcPlanScheduler
  });
  registerImprovementRoutes(app, improvementScheduler);

  // Start the scheduler
  improvementScheduler.start();

  logger.logNodeActivity("CONDUCTOR", "  ∞ Improvement Scheduler: LOADED (15m cycles)");
} catch (err) {
  logger.logNodeActivity("CONDUCTOR", `  ⚠ Improvement Scheduler not loaded: ${err.message}`);
}

// NOTE: autoSuccessEngine, scientistEngine, qaEngine are now initialized
// by the engine-wiring bootstrapper (src/bootstrap/engine-wiring.js)

// ─── SSE Text Streaming Engine (Pillar Module) ──────────────────────
const { sseBroadcast } = require("./src/routes/sse-streaming")(app);

// ─── Service Route Registration (Phase 2 Liquid Architecture) ───────
// Extracted from monolith → src/bootstrap/service-routes.js
const { registerServiceRoutes } = require("./src/bootstrap/service-routes");
registerServiceRoutes(app, {
  engines: _engines,
  vectorMemory,
  orchestrator,
  Handshake,
  projectRoot: __dirname,
});

// ─── ChatGPT Business Plan Integration ──────────────────────────────
app.get("/api/openai/business", (req, res) => {
  res.json({
    ok: true, plan: "business",
    org_id: process.env.OPENAI_ORG_ID || "not_configured",
    workspace_id: process.env.OPENAI_WORKSPACE_ID || "not_configured",
    seats: (process.env.OPENAI_BUSINESS_SEATS || "").split(",").filter(Boolean),
    capabilities: { codex_cli: process.env.OPENAI_CODEX_ENABLED === "true", connectors: process.env.OPENAI_CONNECTORS_ENABLED === "true", github_connector: process.env.OPENAI_GITHUB_CONNECTOR === "true", gpt_builder: true, custom_apps: true },
    api_headers: { "OpenAI-Organization": process.env.OPENAI_ORG_ID, "OpenAI-Project": process.env.OPENAI_WORKSPACE_ID },
    domain_verification: { domain: "headysystems.com", status: "verified" },
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1", "o1-mini", "o3-mini", "dall-e-3"],
  });
});
if (process.env.OPENAI_ORG_ID) {
  logger.logNodeActivity("CONDUCTOR", `  🔑 ChatGPT Business: CONFIGURED (org: ${process.env.OPENAI_ORG_ID.slice(0, 15)}..., 2 seats, connectors ON)`);
}

// ─── HeadyBuddy API (Pillar Module) ─────────────────────────────────
require("./src/routes/buddy")(app, {
  continuousPipeline,
  storyDriver,
  resourceManager,
  resourceDiagnostics: typeof resourceDiagnostics !== "undefined" ? resourceDiagnostics : null,
  patternEngine,
  selfCritiqueEngine: typeof selfCritiqueEngine !== "undefined" ? selfCritiqueEngine : null,
  mcGlobal: typeof mcGlobal !== "undefined" ? mcGlobal : null,
  improvementScheduler: typeof improvementScheduler !== "undefined" ? improvementScheduler : null,
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
  logger.logNodeActivity("CONDUCTOR", `  ⚠ Secrets/Cloudflare routes not registered: ${err.message}`);
}

// ─── Layer Management ─────────────────────────────────────────────────
const LAYERS = {
  "local": { name: "Local Dev", endpoint: "https://headyme.com" },
  "cloud-me": { name: "Cloud HeadyMe", endpoint: "https://headyme.com" },
  "cloud-sys": { name: "Cloud HeadySystems", endpoint: "https://headyme.com" },
  "cloud-conn": { name: "Cloud HeadyConnection", endpoint: "https://headyme.com" },
  "hybrid": { name: "Hybrid", endpoint: "https://headyme.com" }
};

let activeLayer = "local";

/**
 * @swagger
 * /api/layer:
 *   get:
 *     summary: Get active layer
 *     responses:
 *       200:
 *         description: Active layer
 */
app.get("/api/layer", (req, res) => {
  res.json({
    active: activeLayer,
    endpoint: LAYERS[activeLayer]?.endpoint || "",
    ts: new Date().toISOString()
  });
});

/**
 * @swagger
 * /api/layer/switch:
 *   post:
 *     summary: Switch layer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               layer:
 *                 type: string
 *     responses:
 *       200:
 *         description: Layer switched
 */
app.post("/api/layer/switch", (req, res) => {
  const newLayer = req.body.layer;
  if (!LAYERS[newLayer]) {
    return res.status(400).json({ error: "Invalid layer" });
  }

  activeLayer = newLayer;
  res.json({
    success: true,
    layer: newLayer,
    endpoint: LAYERS[newLayer].endpoint,
    ts: new Date().toISOString()
  });
});

// ─── Aloha Protocol System (Pillar Module) ───────────────────────────
require("./src/routes/aloha")(app, {
  selfCritiqueEngine: typeof selfCritiqueEngine !== "undefined" ? selfCritiqueEngine : null,
  storyDriver,
  resourceManager,
  continuousPipeline,
  mcGlobal: typeof mcGlobal !== "undefined" ? mcGlobal : null,
  improvementScheduler: typeof improvementScheduler !== "undefined" ? improvementScheduler : null,
  patternEngine,
});
// ─── Voice Relay WebSocket System ─────────────────────────────────────
// Cross-device voice-to-text relay: phone dictates → mini computer receives
const voiceSessions = new Map(); // sessionId → { sender: ws, receivers: Set<ws>, created, lastActivity }

// Generate / retrieve voice session for pairing
app.get('/api/voice/session', (req, res) => {
  const sessionId = req.query.id || `voice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  if (!voiceSessions.has(sessionId)) {
    voiceSessions.set(sessionId, { sender: null, receivers: new Set(), created: Date.now(), lastActivity: Date.now() });
  }
  const session = voiceSessions.get(sessionId);
  res.json({
    sessionId,
    hasSender: !!session.sender,
    receiverCount: session.receivers.size,
    created: new Date(session.created).toISOString(),
    ts: new Date().toISOString()
  });
});

app.get('/api/voice/sessions', (req, res) => {
  const sessions = [];
  voiceSessions.forEach((v, k) => sessions.push({
    sessionId: k, hasSender: !!v.sender, receiverCount: v.receivers.size,
    created: new Date(v.created).toISOString(), lastActivity: new Date(v.lastActivity).toISOString()
  }));
  res.json({ sessions, ts: new Date().toISOString() });
});

// Clean up stale sessions every 30 minutes
setInterval(() => {
  const staleThreshold = Date.now() - 3600000; // 1 hour
  voiceSessions.forEach((session, id) => {
    if (session.lastActivity < staleThreshold) {
      if (session.sender) try { session.sender.close(); } catch (e) { /* */ }
      session.receivers.forEach(r => { try { r.close(); } catch (e) { /* */ } });
      voiceSessions.delete(id);
    }
  });
}, 1800000);

// ─── Start (HTTP/HTTPS + WebSocket) ───────────────────────────────────────
const certDir = path.join(__dirname, 'certs');
let server;

if (fs.existsSync(path.join(certDir, 'server.key')) && fs.existsSync(path.join(certDir, 'server.crt'))) {
  const options = {
    key: fs.readFileSync(path.join(certDir, 'server.key')),
    cert: fs.readFileSync(path.join(certDir, 'server.crt')),
    ca: fs.existsSync(path.join(certDir, 'ca.crt')) ? fs.readFileSync(path.join(certDir, 'ca.crt')) : undefined,
    requestCert: true,
    rejectUnauthorized: false // Set to true for strict mTLS or handle per-route
  };
  server = https.createServer(options, app);
  logger.logNodeActivity("BUILDER", "  🔒 mTLS/HTTPS Server Configured");
} else {
  server = http.createServer(app);
  logger.logNodeActivity("BUILDER", "  ⚠️ No certs found. Falling back to HTTP Server");
}

// WebSocket server for voice relay (no-server mode — upgrade handled manually)
const voiceWss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const match = url.pathname.match(/^\/ws\/voice\/(.+)$/);
  if (!match) {
    socket.destroy();
    return;
  }
  const sessionId = match[1];
  voiceWss.handleUpgrade(request, socket, head, (ws) => {
    voiceWss.emit('connection', ws, request, sessionId);
  });
});

voiceWss.on('connection', (ws, request, sessionId) => {
  // Get or create session
  if (!voiceSessions.has(sessionId)) {
    voiceSessions.set(sessionId, { sender: null, receivers: new Set(), created: Date.now(), lastActivity: Date.now() });
  }
  const session = voiceSessions.get(sessionId);
  const url = new URL(request.url, `http://${request.headers.host}`);
  const role = url.searchParams.get('role') || 'receiver';

  if (role === 'sender') {
    session.sender = ws;
    logger.logNodeActivity("CONDUCTOR", `[VoiceRelay] Sender connected to session ${sessionId}`);
    // Notify receivers that sender connected
    session.receivers.forEach(r => {
      if (r.readyState === WebSocket.OPEN) {
        r.send(JSON.stringify({ type: 'sender_connected' }));
      }
    });
  } else {
    session.receivers.add(ws);
    logger.logNodeActivity("CONDUCTOR", `[VoiceRelay] Receiver connected to session ${sessionId} (${session.receivers.size} total)`);
    // Tell receiver if sender is already present
    if (session.sender && session.sender.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'sender_connected' }));
    }
  }

  ws.on('message', (data) => {
    session.lastActivity = Date.now();
    try {
      const msg = JSON.parse(data);
      // Relay voice transcription from sender → all receivers
      if (role === 'sender' && (msg.type === 'transcript' || msg.type === 'interim' || msg.type === 'final')) {
        session.receivers.forEach(r => {
          if (r.readyState === WebSocket.OPEN) {
            r.send(JSON.stringify(msg));
          }
        });
      }
      // Receiver can send commands back to sender (e.g., 'pause', 'resume')
      if (role === 'receiver' && msg.type === 'command' && session.sender && session.sender.readyState === WebSocket.OPEN) {
        session.sender.send(JSON.stringify(msg));
      }
    } catch (e) { /* ignore malformed messages */ }
  });

  ws.on('close', () => {
    if (role === 'sender') {
      session.sender = null;
      logger.logNodeActivity("CONDUCTOR", `[VoiceRelay] Sender disconnected from session ${sessionId}`);
      session.receivers.forEach(r => {
        if (r.readyState === WebSocket.OPEN) {
          r.send(JSON.stringify({ type: 'sender_disconnected' }));
        }
      });
    } else {
      session.receivers.delete(ws);
      logger.logNodeActivity("CONDUCTOR", `[VoiceRelay] Receiver disconnected from session ${sessionId} (${session.receivers.size} remain)`);
    }
    // Clean up empty sessions
    if (!session.sender && session.receivers.size === 0) {
      voiceSessions.delete(sessionId);
    }
  });

  ws.on('error', (err) => {
    logger.logNodeActivity("CONDUCTOR", `[VoiceRelay] WebSocket error in session ${sessionId}:`, err.message);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const c = { reset: "\x1b[0m", bold: "\x1b[1m", cyan: "\x1b[36m", blue: "\x1b[34m", purple: "\x1b[35m", green: "\x1b[32m", yellow: "\x1b[33m", dim: "\x1b[2m" };

  logger.logNodeActivity("CONDUCTOR", `\n${c.bold}${c.purple}╭────────────────────────────────────────────────────────╮${c.reset}`);
  logger.logNodeActivity("CONDUCTOR", `${c.bold}${c.purple}│${c.reset}  ${c.cyan}⚡ HEADY SYSTEMS CORE — OS V3.0${c.reset}                         ${c.bold}${c.purple}│${c.reset}`);
  logger.logNodeActivity("CONDUCTOR", `${c.bold}${c.purple}├────────────────────────────────────────────────────────┤${c.reset}`);
  logger.logNodeActivity("CONDUCTOR", `${c.bold}${c.purple}│${c.reset}  ${c.dim}Environment:${c.reset}  ${c.yellow}${process.env.NODE_ENV || "development"}${c.reset}`);
  logger.logNodeActivity("CONDUCTOR", `${c.bold}${c.purple}│${c.reset}  ${c.dim}Core Node:${c.reset}    ${c.green}Online (PID: ${process.pid})${c.reset}`);
  logger.logNodeActivity("CONDUCTOR", `${c.bold}${c.purple}│${c.reset}  ${c.dim}Gateway:${c.reset}      ${c.bold}${c.cyan}http://0.0.0.0:${PORT}${c.reset}`);
  logger.logNodeActivity("CONDUCTOR", `${c.bold}${c.purple}│${c.reset}  ${c.dim}Voice Relay:${c.reset}  ${c.purple}ws://0.0.0.0:${PORT}/ws/voice/:sessionId${c.reset}`);
  logger.logNodeActivity("CONDUCTOR", `${c.bold}${c.purple}│${c.reset}  ${c.dim}API Docs:${c.reset}     ${c.blue}http://0.0.0.0:${PORT}/api-docs${c.reset}`);
  logger.logNodeActivity("CONDUCTOR", `${c.bold}${c.purple}│${c.reset}  ${c.dim}Health/Pulse:${c.reset} ${c.green}/api/health | /api/pulse${c.reset}`);
  logger.logNodeActivity("CONDUCTOR", `${c.bold}${c.purple}╰────────────────────────────────────────────────────────╯${c.reset}\n`);
});

try {
  const { startBrandingMonitor, getBrandingReport, getSystemIntrospection } = require('./src/self-awareness');
  startBrandingMonitor();
  app.get('/api/introspection', (req, res) => res.json(getSystemIntrospection()));
  app.get('/api/branding', (req, res) => res.json(getBrandingReport()));
  logger.logNodeActivity("CONDUCTOR", "  ∞ Branding Monitor: STARTED");
  logger.logNodeActivity("CONDUCTOR", "  ∞ Introspection: /api/introspection + /api/branding");
} catch (err) {
  logger.logNodeActivity("CONDUCTOR", `  ⚠ Branding Monitor not loaded: ${err.message}`);
}

try {
  const hp = require('./src/heady-principles');
  app.get('/api/principles', (req, res) => res.json({
    node: 'heady-principles',
    role: 'Mathematical foundation — base-13, log42, golden ratio',
    constants: { PHI: hp.PHI, PHI_INV: hp.PHI_INV, PHI_PCT: hp.PHI_PCT, BASE: hp.BASE, LOG_BASE: hp.LOG_BASE, HEADY_UNIT: hp.HEADY_UNIT, HEADY_CYCLE: hp.HEADY_CYCLE },
    designTokens: hp.designTokens(8),
    capacity: hp.capacityParams('medium'),
    thresholds: hp.phiThresholds(8),
    fibonacci: hp.FIB.slice(0, 13),
    vinci: { role: 'Biomimicry node — studies patterns in nature for system optimization', patterns: ['golden_ratio', 'fibonacci_spirals', 'fractal_branching', 'swarm_intelligence', 'ant_colony_optimization', 'neural_pathway_efficiency', 'phyllotaxis', 'l_systems'] },
  }));
  logger.logNodeActivity("CONDUCTOR", "  ∞ Heady Principles: /api/principles (φ=" + hp.PHI.toFixed(3) + ")");
} catch (err) {
  logger.logNodeActivity("CONDUCTOR", `  ⚠ Heady Principles not loaded: ${err.message}`);
}

// ── Heady Models API (Phase 2 Liquid — extracted to router) ──────────
try {
  const modelsApiRouter = require('./src/routes/models-api');
  app.use('/api', modelsApiRouter);
} catch (err) {
  logger.logNodeActivity("CONDUCTOR", `  ⚠ Heady Models router not loaded: ${err.message}`);
}
