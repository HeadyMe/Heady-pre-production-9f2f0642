// HEADY_BRAND:BEGIN
// HEADY SYSTEMS :: SACRED GEOMETRY
// FILE: backend/index.js
// LAYER: backend
// 
//         _   _  _____    _    ____   __   __
//        | | | || ____|  / \  |  _ \ \ \ / /
//        | |_| ||  _|   / _ \ | | | | \ V / 
//        |  _  || |___ / ___ \| |_| |  | |  
//        |_| |_||_____/_/   \_\____/   |_|  
// 
//    Sacred Geometry :: Organic Systems :: Breathing Interfaces
// HEADY_BRAND:END

const express = require("express");
const cors = require("cors");
const Docker = require("dockerode");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { EventEmitter } = require("events");
const { VectorStore3D } = require("./src/utils/vectorStore3d");

const fsp = fs.promises;

// ─── Configuration ──────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT || 3300);

const HF_TOKEN = process.env.HF_TOKEN;
const HEADY_API_KEY = process.env.HEADY_API_KEY;

const HEADY_TRUST_PROXY = process.env.HEADY_TRUST_PROXY === "true";
const HEADY_CORS_ORIGINS = (process.env.HEADY_CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const HEADY_RATE_LIMIT_WINDOW_MS = Number(process.env.HEADY_RATE_LIMIT_WINDOW_MS) || 60_000;
const HEADY_RATE_LIMIT_MAX = Number(process.env.HEADY_RATE_LIMIT_MAX) || 120;
const HF_MAX_CONCURRENCY = Number(process.env.HF_MAX_CONCURRENCY) || 4;

const HEADY_QA_BACKEND = process.env.HEADY_QA_BACKEND || "auto";
const HEADY_PYTHON_BIN = process.env.HEADY_PYTHON_BIN || "python";
const HEADY_PY_WORKER_TIMEOUT_MS = Number(process.env.HEADY_PY_WORKER_TIMEOUT_MS) || 90_000;
const HEADY_PY_MAX_CONCURRENCY = Number(process.env.HEADY_PY_MAX_CONCURRENCY) || 2;
const HEADY_QA_MAX_NEW_TOKENS = Number(process.env.HEADY_QA_MAX_NEW_TOKENS) || 256;
const HEADY_QA_MODEL = process.env.HEADY_QA_MODEL;
const HEADY_QA_MAX_QUESTION_CHARS = Number(process.env.HEADY_QA_MAX_QUESTION_CHARS) || 4000;
const HEADY_QA_MAX_CONTEXT_CHARS = Number(process.env.HEADY_QA_MAX_CONTEXT_CHARS) || 12000;

const DEFAULT_HF_TEXT_MODEL = process.env.HF_TEXT_MODEL || "gpt2";
const DEFAULT_HF_EMBED_MODEL = process.env.HF_EMBED_MODEL || "sentence-transformers/all-MiniLM-L6-v2";

const HEADY_ADMIN_ROOT = process.env.HEADY_ADMIN_ROOT || path.resolve(__dirname);
const HEADY_ADMIN_ALLOWED_PATHS = (process.env.HEADY_ADMIN_ALLOWED_PATHS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
const HEADY_ADMIN_MAX_BYTES = Number(process.env.HEADY_ADMIN_MAX_BYTES) || 512_000;
const HEADY_ADMIN_OP_LOG_LIMIT = Number(process.env.HEADY_ADMIN_OP_LOG_LIMIT) || 2000;
const HEADY_ADMIN_OP_LIMIT = Number(process.env.HEADY_ADMIN_OP_LIMIT) || 50;
const HEADY_ADMIN_BUILD_SCRIPT =
    process.env.HEADY_ADMIN_BUILD_SCRIPT || path.join(__dirname, "python_worker", "consolidated_builder.py");
const HEADY_ADMIN_AUDIT_SCRIPT =
    process.env.HEADY_ADMIN_AUDIT_SCRIPT || path.join(__dirname, "python_worker", "admin_console.py");

const HEADY_ADMIN_ENABLE_GPU = process.env.HEADY_ADMIN_ENABLE_GPU === "true";
const REMOTE_GPU_HOST = process.env.REMOTE_GPU_HOST || "";
const REMOTE_GPU_PORT = process.env.REMOTE_GPU_PORT || "";
const GPU_MEMORY_LIMIT = process.env.GPU_MEMORY_LIMIT || "";
const ENABLE_GPUDIRECT = process.env.ENABLE_GPUDIRECT === "true";

// ─── Utility Functions ──────────────────────────────────────────────────────────

function getClientIp(req) {
    if (typeof req.ip === "string" && req.ip) return req.ip;
    if (req.socket && typeof req.socket.remoteAddress === "string" && req.socket.remoteAddress) return req.socket.remoteAddress;
    return "unknown";
}

function createRateLimiter({ windowMs, max }) {
    const usedWindowMs = typeof windowMs === "number" && windowMs > 0 ? windowMs : 60_000;
    const usedMax = typeof max === "number" && max > 0 ? max : 120;
    const hits = new Map();

    function pruneExpiredHits(nowTs) {
        for (const [key, value] of hits.entries()) {
            if (!value || typeof value.resetAt !== "number" || nowTs >= value.resetAt) hits.delete(key);
        }
    }

    const cleanupEveryMs = Math.max(usedWindowMs, 30_000);
    const cleanupTimer = setInterval(() => pruneExpiredHits(Date.now()), cleanupEveryMs);
    if (typeof cleanupTimer.unref === "function") cleanupTimer.unref();

    return (req, res, next) => {
        if (req.method === "OPTIONS") return next();
        if (req.path === "/health") return next();

        const now = Date.now();
        const ip = getClientIp(req);
        const existing = hits.get(ip);
        const entry = existing && now < existing.resetAt ? existing : { count: 0, resetAt: now + usedWindowMs };
        entry.count += 1;
        hits.set(ip, entry);

        res.setHeader("X-RateLimit-Limit", String(usedMax));
        res.setHeader("X-RateLimit-Remaining", String(Math.max(0, usedMax - entry.count)));
        res.setHeader("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

        if (entry.count > usedMax) {
            res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
            return res.status(429).json({ ok: false, error: "Rate limit exceeded", request_id: req.requestId });
        }

        if (hits.size > 10000) pruneExpiredHits(now);

        return next();
    };
}

const rateLimitApi = createRateLimiter({ windowMs: HEADY_RATE_LIMIT_WINDOW_MS, max: HEADY_RATE_LIMIT_MAX });

function createSemaphore(max) {
    const usedMax = typeof max === "number" && max > 0 ? Math.floor(max) : 1;
    let inUse = 0;
    const queue = [];

    function release() {
        inUse = Math.max(0, inUse - 1);
        const next = queue.shift();
        if (next) next();
    }

    async function acquire() {
        if (inUse < usedMax) {
            inUse += 1;
            return;
        }
        await new Promise((resolve) => queue.push(resolve));
        inUse += 1;
    }

    async function run(fn) {
        await acquire();
        try {
            return await fn();
        } finally {
            release();
        }
    }

    return { run };
}

const hfSemaphore = createSemaphore(HF_MAX_CONCURRENCY);
const pySemaphore = createSemaphore(HEADY_PY_MAX_CONCURRENCY);
const PY_WORKER_SCRIPT = path.join(__dirname, "python_worker", "process_data.py");
const HEADY_REGISTRY_PATH = path.join(__dirname, "heady_registry.json");
const HEADY_VECTOR_STORE_PATH = process.env.HEADY_VECTOR_STORE_PATH || path.join(__dirname, "heady_vector_store.json");
const vectorStore3d = new VectorStore3D(HEADY_VECTOR_STORE_PATH);

// ─── Request Metrics ────────────────────────────────────────────────────────────

const requestMetrics = {
    startedAt: Date.now(),
    total: 0,
    success: 0,
    clientError: 0,
    serverError: 0,
    inFlight: 0,
    latenciesMs: [],
};
const REQUEST_METRIC_WINDOW = 1000;

function recordRequestMetric(status, durationMs) {
    requestMetrics.total += 1;
    if (status >= 500) requestMetrics.serverError += 1;
    else if (status >= 400) requestMetrics.clientError += 1;
    else requestMetrics.success += 1;

    requestMetrics.latenciesMs.push(durationMs);
    if (requestMetrics.latenciesMs.length > REQUEST_METRIC_WINDOW) requestMetrics.latenciesMs.shift();
}

function percentile(sortedValues, ratio) {
    if (!sortedValues.length) return 0;
    const idx = Math.min(sortedValues.length - 1, Math.max(0, Math.floor(sortedValues.length * ratio)));
    return sortedValues[idx];
}

function summarizeRequestMetrics() {
    const sorted = [...requestMetrics.latenciesMs].sort((a, b) => a - b);
    const sum = requestMetrics.latenciesMs.reduce((acc, n) => acc + n, 0);
    const avg = requestMetrics.latenciesMs.length ? sum / requestMetrics.latenciesMs.length : 0;
    return {
        startedAt: new Date(requestMetrics.startedAt).toISOString(),
        uptimeMs: Date.now() - requestMetrics.startedAt,
        inFlight: requestMetrics.inFlight,
        total: requestMetrics.total,
        success: requestMetrics.success,
        clientError: requestMetrics.clientError,
        serverError: requestMetrics.serverError,
        latencyMs: {
            avg: Number(avg.toFixed(2)),
            p50: percentile(sorted, 0.5),
            p95: percentile(sorted, 0.95),
            p99: percentile(sorted, 0.99),
            samples: requestMetrics.latenciesMs.length,
        },
    };
}

// ─── System Script Status ───────────────────────────────────────────────────────

function getSystemScriptStatus() {
    const checks = {
        pythonWorker: PY_WORKER_SCRIPT,
        adminBuild: HEADY_ADMIN_BUILD_SCRIPT,
        adminAudit: HEADY_ADMIN_AUDIT_SCRIPT,
    };

    const scripts = Object.fromEntries(
        Object.entries(checks).map(([key, scriptPath]) => [key, { path: scriptPath, exists: fs.existsSync(scriptPath) }]),
    );

    return {
        scripts,
        allReady: Object.values(scripts).every((item) => item.exists),
    };
}

// ─── Registry Management ────────────────────────────────────────────────────────

async function loadRegistry() {
    try {
        if (fs.existsSync(HEADY_REGISTRY_PATH)) {
            const data = await fsp.readFile(HEADY_REGISTRY_PATH, "utf8");
            return JSON.parse(data);
        }
    } catch (err) {
        console.error("Failed to load registry:", err);
    }
    return { files: {}, patterns: {}, tasks: [] };
}

async function saveRegistry(registry) {
    try {
        const tempPath = `${HEADY_REGISTRY_PATH}.tmp`;
        await fsp.writeFile(tempPath, JSON.stringify(registry, null, 2), "utf8");
        await fsp.rename(tempPath, HEADY_REGISTRY_PATH);
    } catch (err) {
        console.error("Failed to save registry:", err);
    }
}

async function logFilePattern(filePath, patternData) {
    const registry = await loadRegistry();
    const fileHash = crypto.createHash("sha256").update(filePath).digest("hex");

    registry.files[fileHash] = {
        path: filePath,
        lastSeen: new Date().toISOString(),
        patternId: patternData.patternId,
        similarityHash: patternData.similarityHash
    };

    if (!registry.patterns[patternData.patternId]) {
        registry.patterns[patternData.patternId] = {
            description: patternData.description,
            files: []
        };
    }

    if (!registry.patterns[patternData.patternId].files.includes(filePath)) {
        registry.patterns[patternData.patternId].files.push(filePath);
    }

    const similarFiles = Object.values(registry.files).filter(f =>
        f.path !== filePath && f.similarityHash === patternData.similarityHash
    );

    if (similarFiles.length > 0) {
        const taskId = `merge_${Date.now()}`;
        const taskExists = registry.tasks.some(t =>
            t.type === "merge_suggestion" &&
            t.files.includes(filePath) &&
            similarFiles.some(sf => t.files.includes(sf.path))
        );

        if (!taskExists) {
            registry.tasks.push({
                id: taskId,
                type: "merge_suggestion",
                status: "pending",
                files: [filePath, ...similarFiles.map(f => f.path)],
                reason: "High similarity detected in file patterns",
                createdAt: new Date().toISOString()
            });
        }
    }

    await saveRegistry(registry);
}

// ─── Helper Functions ───────────────────────────────────────────────────────────

function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

function createHttpError(status, message, details) {
    const err = new Error(message);
    err.status = status;
    if (details !== undefined) err.details = details;
    return err;
}

function toRelativePath(rootPath, absPath) {
    const rel = path.relative(rootPath, absPath);
    return rel.split(path.sep).join("/");
}

// ─── Admin Root Management ──────────────────────────────────────────────────────

function buildAdminRoots() {
    const roots = [];
    const seen = new Set();
    const candidates = [HEADY_ADMIN_ROOT, ...HEADY_ADMIN_ALLOWED_PATHS];

    for (const candidate of candidates) {
        if (!candidate) continue;
        const resolved = path.resolve(candidate);
        const key = process.platform === "win32" ? resolved.toLowerCase() : resolved;
        if (seen.has(key)) continue;
        seen.add(key);

        roots.push({
            id: `root-${roots.length + 1}`,
            path: resolved,
            label: path.basename(resolved) || resolved,
            exists: fs.existsSync(resolved),
        });
    }

    return roots;
}

const ADMIN_ROOTS = buildAdminRoots();

function getAdminRoot(rootParam) {
    if (!ADMIN_ROOTS.length) return null;
    if (!rootParam) return ADMIN_ROOTS[0];
    return ADMIN_ROOTS.find((root) => root.id === rootParam || root.path === rootParam) || null;
}

function assertAdminRoot(rootParam) {
    const root = getAdminRoot(rootParam);
    if (!root) throw createHttpError(400, "Invalid root");
    if (!root.exists) throw createHttpError(404, "Root not found");
    return root;
}

function resolveAdminPath(rootPath, relPath = "") {
    if (typeof relPath !== "string") throw createHttpError(400, "path must be a string");
    if (relPath.includes("\0")) throw createHttpError(400, "Invalid path");

    const resolvedRoot = path.resolve(rootPath);
    const resolved = path.resolve(resolvedRoot, relPath);
    const rootWithSep = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;

    if (resolved !== resolvedRoot && !resolved.startsWith(rootWithSep)) {
        throw createHttpError(403, "Path is outside allowed root");
    }
    return resolved;
}

// ─── HF Inference ───────────────────────────────────────────────────────────────

async function hfInfer({ model, inputs, parameters, options }) {
    return hfSemaphore.run(async () => {
        if (!HF_TOKEN) throw createHttpError(503, "HF_TOKEN not configured");
        const usedModel = model || DEFAULT_HF_TEXT_MODEL;
        const resp = await fetch(`https://api-inference.huggingface.co/models/${usedModel}`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${HF_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ inputs, parameters, options }),
        });
        if (!resp.ok) {
            const text = await resp.text().catch(() => "");
            throw createHttpError(resp.status, `HF API error: ${text}`);
        }
        return { data: await resp.json(), model: usedModel };
    });
}

async function hfEmbed({ model, inputs }) {
    return hfSemaphore.run(async () => {
        if (!HF_TOKEN) throw createHttpError(503, "HF_TOKEN not configured");
        const usedModel = model || DEFAULT_HF_EMBED_MODEL;
        const resp = await fetch(`https://api-inference.huggingface.co/pipeline/feature-extraction/${usedModel}`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${HF_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ inputs, options: { wait_for_model: true } }),
        });
        if (!resp.ok) {
            const text = await resp.text().catch(() => "");
            throw createHttpError(resp.status, `HF embed error: ${text}`);
        }
        return { data: await resp.json(), model: usedModel };
    });
}

// ─── Python QA Worker ───────────────────────────────────────────────────────────

async function runPythonQa({ question, context, model, parameters, requestId }) {
    return pySemaphore.run(async () => {
        const safeQuestion = typeof question === "string" ? question.slice(0, HEADY_QA_MAX_QUESTION_CHARS) : "";
        const safeContext = typeof context === "string" ? context.slice(0, HEADY_QA_MAX_CONTEXT_CHARS) : "";
        const payload = {
            question: safeQuestion,
            context: safeContext,
            model: model || DEFAULT_HF_TEXT_MODEL,
            parameters: parameters || {},
            requestId: requestId || `qa-${Date.now()}`,
        };

        return new Promise((resolve, reject) => {
            const child = spawn(HEADY_PYTHON_BIN, [PY_WORKER_SCRIPT, "qa"], {
                stdio: ["pipe", "pipe", "pipe"],
                env: { ...process.env, HF_TOKEN: HF_TOKEN || "", PYTHONUNBUFFERED: "1" },
                windowsHide: true,
            });

            let stdout = "";
            let stderr = "";

            child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
            child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });

            child.stdin.write(JSON.stringify(payload));
            child.stdin.end();

            const timer = setTimeout(() => {
                child.kill("SIGKILL");
                reject(new Error(`Python worker timed out after ${HEADY_PY_WORKER_TIMEOUT_MS}ms`));
            }, HEADY_PY_WORKER_TIMEOUT_MS);

            child.on("close", (code) => {
                clearTimeout(timer);
                if (code !== 0) {
                    return reject(new Error(stderr.trim() || `Python worker exited with code ${code}`));
                }
                try {
                    const result = JSON.parse(stdout.trim());
                    resolve(result);
                } catch {
                    reject(new Error(`Invalid JSON from Python worker: ${stdout.slice(0, 200)}`));
                }
            });

            child.on("error", (err) => {
                clearTimeout(timer);
                reject(err);
            });
        });
    });
}

// ─── Admin Operations ───────────────────────────────────────────────────────────

const adminOps = new Map();
const adminOpsEmitter = new EventEmitter();
adminOpsEmitter.setMaxListeners(100);

function startAdminOperation({ type, script, args, cwd }) {
    if (adminOps.size >= HEADY_ADMIN_OP_LIMIT) {
        const oldest = [...adminOps.values()]
            .filter((op) => op.status !== "running")
            .sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0));
        if (oldest.length > 0) {
            adminOps.delete(oldest[0].id);
        }
    }

    const id = crypto.randomUUID();
    const op = {
        id,
        type,
        script,
        args,
        status: "running",
        startedAt: Date.now(),
        lines: [],
        exitCode: null,
        error: null,
    };

    adminOps.set(id, op);

    const child = spawn(HEADY_PYTHON_BIN, [script, ...(args || [])], {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
        cwd: cwd || __dirname,
        windowsHide: true,
    });

    function pushLine(source, text) {
        const line = { ts: Date.now(), source, text };
        op.lines.push(line);
        if (op.lines.length > HEADY_ADMIN_OP_LOG_LIMIT) op.lines.shift();
        adminOpsEmitter.emit(`op:${id}`, line);
    }

    child.stdout.on("data", (chunk) => {
        chunk.toString("utf8").split("\n").filter(Boolean).forEach((l) => pushLine("stdout", l));
    });

    child.stderr.on("data", (chunk) => {
        chunk.toString("utf8").split("\n").filter(Boolean).forEach((l) => pushLine("stderr", l));
    });

    child.on("close", (code) => {
        op.exitCode = code;
        op.status = code === 0 ? "success" : "error";
        op.finishedAt = Date.now();
        adminOpsEmitter.emit(`op:${id}`, { ts: Date.now(), source: "system", text: `Exited with code ${code}` });
        adminOpsEmitter.emit(`op:${id}:done`);
    });

    child.on("error", (err) => {
        op.status = "error";
        op.error = err.message;
        op.finishedAt = Date.now();
        pushLine("system", `Error: ${err.message}`);
        adminOpsEmitter.emit(`op:${id}:done`);
    });

    return op;
}

function serializeAdminOp(op) {
    return {
        id: op.id,
        type: op.type,
        status: op.status,
        startedAt: op.startedAt ? new Date(op.startedAt).toISOString() : null,
        finishedAt: op.finishedAt ? new Date(op.finishedAt).toISOString() : null,
        exitCode: op.exitCode,
        error: op.error,
        lineCount: op.lines.length,
    };
}

// ─── Scaffold Artifacts ─────────────────────────────────────────────────────────

async function createScaffoldArtifact({ root, basePath, type, name, description, metadata }) {
    const safeName = String(name || "").trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-");
    if (!safeName) throw createHttpError(400, "name is required");
    const usedType = ["app", "connector", "website"].includes(type) ? type : "app";

    const rootPath = assertAdminRoot(root).path;
    const relativeBase = typeof basePath === "string" ? basePath : "generated";
    const targetDir = resolveAdminPath(rootPath, path.join(relativeBase, usedType, safeName));
    await fsp.mkdir(targetDir, { recursive: true });

    const manifest = {
        id: `${usedType}_${safeName}`,
        type: usedType,
        name: safeName,
        description: typeof description === "string" ? description : "",
        metadata: metadata && typeof metadata === "object" ? metadata : {},
        createdAt: new Date().toISOString(),
    };

    await fsp.writeFile(path.join(targetDir, "heady.manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    await fsp.writeFile(
        path.join(targetDir, "README.md"),
        `# ${safeName}\n\nType: ${usedType}\n\n${manifest.description || "Generated by Heady orchestrator."}\n`,
        "utf8",
    );

    if (usedType === "website") {
        await fsp.writeFile(
            path.join(targetDir, "index.html"),
            `<!doctype html><html><head><meta charset="utf-8"><title>${safeName}</title></head><body><h1>${safeName}</h1></body></html>`,
            "utf8",
        );
    } else if (usedType === "connector") {
        await fsp.writeFile(
            path.join(targetDir, "connector.config.json"),
            JSON.stringify({ source: "", target: "", schedule: "on-demand" }, null, 2),
            "utf8",
        );
    } else {
        await fsp.writeFile(path.join(targetDir, "app.js"), "module.exports = () => 'heady-app-ready';\n", "utf8");
    }

    const relPath = toRelativePath(rootPath, targetDir);
    const vectorDoc = await vectorStore3d.upsert({
        id: manifest.id,
        type: usedType,
        name: safeName,
        description: manifest.description,
        path: relPath,
        metadata: manifest.metadata,
    });

    return { manifest, relPath, vectorDoc };
}

// ─── Express App Setup ──────────────────────────────────────────────────────────

const app = express();
app.disable("x-powered-by");
if (HEADY_TRUST_PROXY) {
    app.set("trust proxy", 1);
}

// Request ID tracing
app.use((req, res, next) => {
    const id = crypto.randomUUID();
    req.requestId = id;
    res.setHeader("x-request-id", id);
    next();
});

// Request metrics middleware
app.use((req, res, next) => {
    requestMetrics.inFlight += 1;
    const started = process.hrtime.bigint();

    res.on("finish", () => {
        requestMetrics.inFlight = Math.max(0, requestMetrics.inFlight - 1);
        const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
        recordRequestMetric(res.statusCode || 200, Number(elapsed.toFixed(2)));
    });

    next();
});

// Security headers
app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    if (process.env.NODE_ENV === "production") {
        res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    }
    next();
});

// CORS
app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (HEADY_CORS_ORIGINS.includes("*")) return callback(null, true);
            if (HEADY_CORS_ORIGINS.length === 0) {
                if (process.env.NODE_ENV !== "production") return callback(null, true);
                return callback(null, false);
            }
            if (HEADY_CORS_ORIGINS.includes(origin)) return callback(null, true);
            return callback(null, false);
        },
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type", "X-Heady-Api-Key", "Authorization"],
        maxAge: 600,
    }),
);
app.use(express.json({ limit: "2mb" }));
app.use("/api", rateLimitApi);
app.use("/api/admin", requireApiKey);
app.use(express.static("public"));

// ─── Auth Functions ─────────────────────────────────────────────────────────────

function timingSafeEqualString(a, b) {
    const aBuf = Buffer.from(String(a));
    const bBuf = Buffer.from(String(b));
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
}

function getProvidedApiKey(req) {
    const direct = req.get("x-heady-api-key");
    if (typeof direct === "string" && direct) return direct;

    const auth = req.get("authorization");
    if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
        const token = auth.slice(7).trim();
        if (token) return token;
    }

    return undefined;
}

function requireApiKey(req, res, next) {
    if (!HEADY_API_KEY) {
        return res.status(500).json({ ok: false, error: "HEADY_API_KEY is not set" });
    }
    const provided = getProvidedApiKey(req);
    if (!provided) {
        return res.status(401).json({ ok: false, error: "API key required" });
    }
    if (!timingSafeEqualString(provided, HEADY_API_KEY)) {
        return res.status(403).json({ ok: false, error: "Invalid API key" });
    }
    return next();
}

// ─── Admin Routes: Scan Patterns ────────────────────────────────────────────────

app.post(
    "/api/admin/scan-patterns",
    asyncHandler(async (req, res) => {
        const root = assertAdminRoot(req.body.root);
        const relPath = req.body.path;
        if (!relPath) throw createHttpError(400, "path is required");

        const targetPath = resolveAdminPath(root.path, relPath);
        const content = await fsp.readFile(targetPath, "utf8");
        const fileHash = crypto.createHash("sha256").update(content).digest("hex");
        const patternId = `pattern_${fileHash.slice(0, 12)}`;

        const patternData = {
            patternId,
            description: `Pattern for ${relPath}`,
            similarityHash: fileHash.slice(0, 16),
        };

        await logFilePattern(relPath, patternData);
        res.json({ ok: true, patterns: patternData, path: relPath });
    }),
);

// ─── Admin Routes: Registry ─────────────────────────────────────────────────────

app.get(
    "/api/admin/registry",
    asyncHandler(async (req, res) => {
        const registry = await loadRegistry();
        res.json({ ok: true, registry });
    }),
);

// ─── Admin Routes: Config ───────────────────────────────────────────────────────

app.get(
    "/api/admin/config/render-yaml",
    asyncHandler(async (req, res) => {
        const renderPath = path.join(__dirname, "render.yaml");
        if (!fs.existsSync(renderPath)) throw createHttpError(404, "render.yaml not found");
        const content = await fsp.readFile(renderPath, "utf8");
        res.json({ ok: true, content });
    }),
);

app.get(
    "/api/admin/config/mcp",
    asyncHandler(async (req, res) => {
        const mcpPath = path.join(__dirname, "mcp_config.json");
        if (!fs.existsSync(mcpPath)) throw createHttpError(404, "mcp_config.json not found");
        const raw = await fsp.readFile(mcpPath, "utf8");
        const parsed = JSON.parse(raw);
        const masked = JSON.parse(JSON.stringify(parsed, (k, v) => {
            if (typeof v === "string" && /(token|password|secret)/i.test(k)) return v ? "***MASKED***" : v;
            return v;
        }));
        res.json({ ok: true, config: masked });
    }),
);

// ─── Admin Routes: GPU Settings / Inference ─────────────────────────────────────

app.get(
    "/api/admin/settings/gpu",
    asyncHandler(async (req, res) => {
        res.json({
            ok: true,
            enabled: HEADY_ADMIN_ENABLE_GPU,
            remoteHost: REMOTE_GPU_HOST ? "***MASKED***" : "",
            remotePort: REMOTE_GPU_PORT ? "***MASKED***" : "",
            memoryLimit: GPU_MEMORY_LIMIT,
            enableGpuDirect: ENABLE_GPUDIRECT,
        });
    }),
);

app.post(
    "/api/admin/gpu/infer",
    asyncHandler(async (req, res) => {
        if (!HEADY_ADMIN_ENABLE_GPU) {
            throw createHttpError(503, "GPU features are disabled");
        }
        const { inputs, model, parameters } = req.body || {};
        if (!inputs) throw createHttpError(400, "inputs is required");
        const usedModel = model || DEFAULT_HF_TEXT_MODEL;
        const result = await hfInfer({
            model: usedModel,
            inputs,
            parameters,
            options: { wait_for_model: true, use_gpu: true },
        });
        res.json({ ok: true, backend: "huggingface", model: usedModel, result: result.data, rdma: ENABLE_GPUDIRECT });
    }),
);

// ─── Admin Routes: Assistant ────────────────────────────────────────────────────

app.post(
    "/api/admin/assistant",
    asyncHandler(async (req, res) => {
        const { context, filePath, instruction } = req.body || {};
        if (!instruction || typeof instruction !== "string") {
            throw createHttpError(400, "instruction is required");
        }
        try {
            const qaResult = await runPythonQa({
                question: instruction,
                context: context || "",
                model: HEADY_QA_MODEL,
                parameters: { max_new_tokens: HEADY_QA_MAX_NEW_TOKENS },
                requestId: `assistant-${Date.now()}`,
            });
            res.json({
                ok: true,
                response: qaResult.answer || "No response",
                model: qaResult.model,
                backend: "python-hf",
            });
        } catch (err) {
            throw createHttpError(502, `Assistant backend unavailable: ${err.message}`);
        }
    }),
);

// ─── Admin Routes: Lint ─────────────────────────────────────────────────────────

app.post(
    "/api/admin/lint",
    asyncHandler(async (req, res) => {
        const { root: rootParam, path: relPath, content } = req.body || {};
        if (typeof relPath !== "string" || !relPath) {
            throw createHttpError(400, "path is required");
        }
        if (typeof content !== "string") {
            throw createHttpError(400, "content is required");
        }
        const root = assertAdminRoot(rootParam);
        const targetPath = resolveAdminPath(root.path, relPath);

        let errors = [];
        if (targetPath.endsWith(".py")) {
            const tempPath = path.join(root.path, `.heady_lint_${Date.now()}_${crypto.randomUUID()}.py`);
            try {
                await fsp.writeFile(tempPath, content, "utf8");
                await new Promise((resolve, reject) => {
                    const child = spawn(HEADY_PYTHON_BIN, ["-m", "py_compile", tempPath], {
                        stdio: ["ignore", "pipe", "pipe"],
                        env: { ...process.env, PYTHONUNBUFFERED: "1" },
                        windowsHide: true,
                    });

                    let stderr = "";
                    child.stderr.on("data", (chunk) => {
                        stderr += chunk.toString("utf8");
                    });

                    child.on("close", (code) => {
                        if (code === 0) return resolve();
                        reject(new Error(stderr.trim() || "Python lint failed"));
                    });

                    child.on("error", reject);
                });
            } catch (e) {
                errors = [e && e.message ? e.message : "Syntax error"];
            } finally {
                try {
                    await fsp.unlink(tempPath);
                } catch { }
            }
        }

        res.json({ ok: true, errors, fixed: false });
    }),
);

// ─── Admin Routes: Test ─────────────────────────────────────────────────────────

app.post(
    "/api/admin/test",
    asyncHandler(async (req, res) => {
        const { root: rootParam, path: relPath, testType } = req.body || {};
        const root = assertAdminRoot(rootParam);
        const targetPath = resolveAdminPath(root.path, relPath || ".");
        const op = startAdminOperation({
            type: "test",
            script: PY_WORKER_SCRIPT,
            args: ["test", targetPath],
            cwd: root.path,
        });
        res.json({
            ok: true,
            op: serializeAdminOp(op),
            streamUrl: `/api/admin/ops/${op.id}/stream`,
        });
    }),
);

// ─── Admin Routes: Roots & Files ────────────────────────────────────────────────

app.get(
    "/api/admin/roots",
    asyncHandler(async (req, res) => {
        res.json({ ok: true, roots: ADMIN_ROOTS });
    }),
);

app.get(
    "/api/admin/files",
    asyncHandler(async (req, res) => {
        const root = assertAdminRoot(req.query.root);
        const relPath = typeof req.query.path === "string" ? req.query.path : "";
        const targetPath = resolveAdminPath(root.path, relPath || ".");
        const stat = await fsp.stat(targetPath);

        if (stat.isFile()) {
            if (stat.size > HEADY_ADMIN_MAX_BYTES) {
                throw createHttpError(413, `File exceeds max size (${HEADY_ADMIN_MAX_BYTES} bytes)`);
            }
            const content = await fsp.readFile(targetPath, "utf8");
            res.json({
                ok: true,
                type: "file",
                path: relPath,
                size: stat.size,
                content,
            });
        } else if (stat.isDirectory()) {
            const entries = await fsp.readdir(targetPath, { withFileTypes: true });
            const items = entries.map((entry) => ({
                name: entry.name,
                type: entry.isDirectory() ? "directory" : "file",
                path: relPath ? `${relPath}/${entry.name}` : entry.name,
            }));
            res.json({ ok: true, type: "directory", path: relPath, items });
        } else {
            throw createHttpError(400, "Unsupported file type");
        }
    }),
);

app.post(
    "/api/admin/files",
    asyncHandler(async (req, res) => {
        const { root: rootParam, path: relPath, content, mkdir: mkdirFlag } = req.body || {};
        if (typeof relPath !== "string" || !relPath) throw createHttpError(400, "path is required");
        const root = assertAdminRoot(rootParam);
        const targetPath = resolveAdminPath(root.path, relPath);

        if (mkdirFlag) {
            await fsp.mkdir(targetPath, { recursive: true });
            return res.json({ ok: true, action: "mkdir", path: relPath });
        }

        if (typeof content !== "string") throw createHttpError(400, "content is required");
        if (Buffer.byteLength(content) > HEADY_ADMIN_MAX_BYTES) {
            throw createHttpError(413, `Content exceeds max size (${HEADY_ADMIN_MAX_BYTES} bytes)`);
        }

        await fsp.mkdir(path.dirname(targetPath), { recursive: true });
        await fsp.writeFile(targetPath, content, "utf8");
        res.json({ ok: true, action: "write", path: relPath, size: Buffer.byteLength(content) });
    }),
);

app.delete(
    "/api/admin/files",
    asyncHandler(async (req, res) => {
        const root = assertAdminRoot(req.query.root);
        const relPath = typeof req.query.path === "string" ? req.query.path : "";
        if (!relPath) throw createHttpError(400, "path is required");
        const targetPath = resolveAdminPath(root.path, relPath);

        const stat = await fsp.stat(targetPath).catch(() => null);
        if (!stat) throw createHttpError(404, "Not found");

        if (stat.isDirectory()) {
            await fsp.rm(targetPath, { recursive: true, force: true });
        } else {
            await fsp.unlink(targetPath);
        }

        res.json({ ok: true, action: "delete", path: relPath });
    }),
);

// ─── Admin Routes: Operations ───────────────────────────────────────────────────

app.get(
    "/api/admin/ops",
    asyncHandler(async (req, res) => {
        const ops = [...adminOps.values()].map(serializeAdminOp);
        res.json({ ok: true, ops });
    }),
);

app.get(
    "/api/admin/ops/:id",
    asyncHandler(async (req, res) => {
        const op = adminOps.get(req.params.id);
        if (!op) throw createHttpError(404, "Operation not found");
        const tail = Number(req.query.tail) || 50;
        res.json({
            ok: true,
            op: serializeAdminOp(op),
            lines: op.lines.slice(-tail),
        });
    }),
);

app.get(
    "/api/admin/ops/:id/stream",
    asyncHandler(async (req, res) => {
        const op = adminOps.get(req.params.id);
        if (!op) throw createHttpError(404, "Operation not found");

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        for (const line of op.lines) {
            res.write(`data: ${JSON.stringify(line)}\n\n`);
        }

        if (op.status !== "running") {
            res.write(`data: ${JSON.stringify({ ts: Date.now(), source: "system", text: `Done: ${op.status}` })}\n\n`);
            return res.end();
        }

        const onLine = (line) => {
            try {
                res.write(`data: ${JSON.stringify(line)}\n\n`);
            } catch { }
        };

        const onDone = () => {
            adminOpsEmitter.off(`op:${op.id}`, onLine);
            try { res.end(); } catch { }
        };

        adminOpsEmitter.on(`op:${op.id}`, onLine);
        adminOpsEmitter.once(`op:${op.id}:done`, onDone);

        req.on("close", () => {
            adminOpsEmitter.off(`op:${op.id}`, onLine);
            adminOpsEmitter.off(`op:${op.id}:done`, onDone);
        });
    }),
);

// ─── Admin Routes: Build & Audit ────────────────────────────────────────────────

app.post(
    "/api/admin/builds/run",
    asyncHandler(async (req, res) => {
        const { root: rootParam, path: relPath, args } = req.body || {};
        const root = assertAdminRoot(rootParam);
        const targetPath = resolveAdminPath(root.path, relPath || ".");

        const scriptArgs = [targetPath];
        if (Array.isArray(args)) {
            args.forEach((arg) => {
                if (arg !== undefined && arg !== null) scriptArgs.push(String(arg));
            });
        }

        const op = startAdminOperation({
            type: "build",
            script: HEADY_ADMIN_BUILD_SCRIPT,
            args: scriptArgs,
            cwd: root.path,
        });

        res.json({
            ok: true,
            op: serializeAdminOp(op),
            streamUrl: `/api/admin/ops/${op.id}/stream`,
        });
    }),
);

app.post(
    "/api/admin/audit/run",
    asyncHandler(async (req, res) => {
        const { root: rootParam, path: relPath, mode, args } = req.body || {};
        const root = assertAdminRoot(rootParam);
        const targetPath = resolveAdminPath(root.path, relPath || ".");

        const scriptArgs = [];
        if (mode) scriptArgs.push(String(mode));
        scriptArgs.push(targetPath);

        if (Array.isArray(args)) {
            args.forEach((arg) => {
                if (arg !== undefined && arg !== null) scriptArgs.push(String(arg));
            });
        }

        const op = startAdminOperation({
            type: "audit",
            script: HEADY_ADMIN_AUDIT_SCRIPT,
            args: scriptArgs,
            cwd: root.path,
        });

        res.json({
            ok: true,
            op: serializeAdminOp(op),
            streamUrl: `/api/admin/ops/${op.id}/stream`,
        });
    }),
);

// ─── Admin Routes: Orchestrator ─────────────────────────────────────────────────

app.get(
    "/api/admin/orchestrator/status",
    asyncHandler(async (req, res) => {
        const systemStatus = getSystemScriptStatus();
        const ops = Array.from(adminOps.values());
        const runningOps = ops.filter((op) => op.status === "running").length;
        const erroredOps = ops.filter((op) => op.status === "error").length;
        const succeededOps = ops.filter((op) => op.status === "success").length;
        const registry = await loadRegistry();
        const vectorStats = await vectorStore3d.stats();

        res.json({
            ok: true,
            ts: new Date().toISOString(),
            governance: {
                adminRoots: ADMIN_ROOTS.length,
                adminOpsTracked: ops.length,
                runningOps,
                erroredOps,
                succeededOps,
                opLimit: HEADY_ADMIN_OP_LIMIT,
            },
            orchestration: {
                scripts: systemStatus.scripts,
                allScriptsReady: systemStatus.allReady,
                qaBackend: HEADY_QA_BACKEND,
                pyWorkerTimeoutMs: HEADY_PY_WORKER_TIMEOUT_MS,
            },
            registry: {
                files: Object.keys(registry.files || {}).length,
                patterns: Object.keys(registry.patterns || {}).length,
                tasks: Array.isArray(registry.tasks) ? registry.tasks.length : 0,
            },
            vectorStore3d: vectorStats,
        });
    }),
);

app.get(
    "/api/admin/orchestrator/performance",
    asyncHandler(async (req, res) => {
        const metrics = summarizeRequestMetrics();
        const vectorStats = await vectorStore3d.stats();
        res.json({
            ok: true,
            ts: new Date().toISOString(),
            performance: metrics,
            vectorStore3d: vectorStats,
            recommendations: [
                "Keep p95 latency under 300ms for control-plane routes.",
                "Scale HEADY_PY_MAX_CONCURRENCY based on CPU cores and worker saturation.",
                "Enable HEADY_CORS_ORIGINS allow-list in production and rotate HEADY_API_KEY regularly.",
            ],
        });
    }),
);

app.post(
    "/api/admin/orchestrator/assets",
    asyncHandler(async (req, res) => {
        const { root, basePath, type, name, description, metadata } = req.body || {};
        const created = await createScaffoldArtifact({ root, basePath, type, name, description, metadata });
        res.status(201).json({ ok: true, asset: created.manifest, path: created.relPath, vector: created.vectorDoc.vector });
    }),
);

app.post(
    "/api/admin/orchestrator/assets/search",
    asyncHandler(async (req, res) => {
        const { text, vector, topK, type } = req.body || {};
        if ((!text || typeof text !== "string") && !Array.isArray(vector)) {
            throw createHttpError(400, "text or vector is required");
        }

        const result = await vectorStore3d.search({ text, vector }, topK, { type });
        res.json({ ok: true, ...result });
    }),
);

// ─── Public Routes: Health & Pulse ──────────────────────────────────────────────

app.get(
    "/api/health",
    asyncHandler(async (req, res) => {
        res.json({
            ok: true,
            service: "heady-manager",
            ts: new Date().toISOString(),
            uptime_s: Math.round(process.uptime()),
            env: {
                has_hf_token: Boolean(HF_TOKEN),
                has_heady_api_key: Boolean(HEADY_API_KEY),
            },
            system: getSystemScriptStatus(),
        });
    }),
);

app.get(
    "/api/pulse",
    asyncHandler(async (req, res) => {
        const docker = new Docker();
        let dockerInfo;

        try {
            const version = await docker.version();
            dockerInfo = { ok: true, version };
        } catch (e) {
            dockerInfo = { ok: false, error: e && e.message ? e.message : String(e) };
        }

        res.json({ ok: true, ts: new Date().toISOString(), docker: dockerInfo });
    }),
);

// ─── Authenticated Routes: HF Inference & Embeddings ────────────────────────────

app.post(
    "/api/hf/infer",
    requireApiKey,
    asyncHandler(async (req, res) => {
        const { model, inputs, parameters, options } = req.body || {};
        if (!inputs) throw createHttpError(400, "inputs is required");
        const result = await hfInfer({ model, inputs, parameters, options });
        res.json({ ok: true, model: result.model, data: result.data });
    }),
);

app.post(
    "/api/hf/embed",
    requireApiKey,
    asyncHandler(async (req, res) => {
        const { model, inputs } = req.body || {};
        if (!inputs) throw createHttpError(400, "inputs is required");
        const result = await hfEmbed({ model, inputs });
        res.json({ ok: true, model: result.model, data: result.data });
    }),
);

app.post(
    "/api/hf/qa",
    requireApiKey,
    asyncHandler(async (req, res) => {
        const { question, context, model, parameters } = req.body || {};
        if (!question || typeof question !== "string") throw createHttpError(400, "question is required");
        const result = await runPythonQa({
            question,
            context: context || "",
            model: model || HEADY_QA_MODEL,
            parameters: parameters || { max_new_tokens: HEADY_QA_MAX_NEW_TOKENS },
            requestId: req.requestId,
        });
        res.json({ ok: true, ...result });
    }),
);

// ─── Static Pages ───────────────────────────────────────────────────────────────

app.get(
    "/admin",
    asyncHandler(async (req, res) => {
        res.sendFile(path.join(__dirname, "public", "admin.html"));
    }),
);

// ─── Error Handler ──────────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
    const status = typeof err.status === "number" ? err.status : 500;
    const payload = {
        ok: false,
        error: err && err.message ? err.message : "Server error",
    };

    if (err && err.response !== undefined) payload.details = err.response;
    if (err && err.details !== undefined) payload.details = err.details;

    if (status >= 500) {
        console.error(err);
    }

    res.status(status).json(payload);
});

// ─── Graceful Startup & Shutdown ────────────────────────────────────────────────

let server;

async function startServer() {
    const scriptStatus = getSystemScriptStatus();
    if (!scriptStatus.allReady) {
        console.warn("Startup warning: one or more worker scripts are missing", scriptStatus.scripts);
    }

    await vectorStore3d.ensureReady();

    server = app.listen(PORT, () => console.log(`∞ Heady System Active on Port ${PORT} ∞`));
}

function gracefulShutdown(signal) {
    console.log(`Received ${signal}, shutting down gracefully...`);
    if (!server) return process.exit(0);

    server.close((err) => {
        if (err) {
            console.error("Error during shutdown:", err);
            process.exit(1);
            return;
        }
        process.exit(0);
    });

    setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

startServer().catch((err) => {
    console.error("Failed to start Heady backend:", err);
    process.exit(1);
});
