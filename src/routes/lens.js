/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * HeadyLens — System-Wide Differential Observer
 * Connected to EVERY aspect of the system to capture real-time
 * differentials — state changes, metric deltas, service transitions.
 * Forms a complete picture from granular observations.
 *
 * Architecture: Lens taps into all services, captures snapshots,
 * computes deltas, stores in vector-ready format for Qdrant.
 */
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require("../utils/logger");

// ── Vision Provider Setup (lazy — reads env at request time) ──
let _genAI = null;
function getGenAI() {
    const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY_HEADY || "";
    if (!key) return null;
    if (!_genAI) _genAI = new GoogleGenerativeAI(key);
    return _genAI;
}

function normalizeServiceKey(source) {
    if (!source) return null;
    if (serviceTruth.has(source)) return source;
    const prefixed = source.startsWith("heady-") ? source : `heady-${source}`;
    if (serviceTruth.has(prefixed)) return prefixed;
    return null;
}

function persistSourceOfTruthState() {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(LENS_STATE_FILE, JSON.stringify({
            lastRealtimePoll,
            services: Array.from(serviceTruth.values()),
            updatedAt: new Date().toISOString(),
        }, null, 2));
    } catch {
        // non-critical persistence path
    }
}

function hydrateSourceOfTruthState() {
    try {
        if (!fs.existsSync(LENS_STATE_FILE)) return;
        const saved = JSON.parse(fs.readFileSync(LENS_STATE_FILE, "utf8"));
        if (Array.isArray(saved?.services)) {
            for (const svc of saved.services) {
                if (!svc?.service) continue;
                const existing = serviceTruth.get(svc.service) || {};
                serviceTruth.set(svc.service, { ...existing, ...svc });
                snapshots.set(svc.service, {
                    value: svc.healthy ? 1 : 0,
                    metric: "health",
                    status: svc.status || (svc.healthy ? "healthy" : "degraded"),
                    ts: svc.ts || saved.updatedAt || null,
                });
            }
        }
        lastRealtimePoll = saved?.lastRealtimePoll || saved?.updatedAt || null;
    } catch {
        // non-critical hydration path
    }
}
function getOpenAIKey() { return process.env.OPENAI_API_KEY || ""; }

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const LENS_STATE_FILE = path.join(DATA_DIR, "lens-state.json");
const INTERNAL_MANAGER_URL = process.env.HEADY_MANAGER_URL || "https://127.0.0.1:3301";
const _PHI_LENS = 1.618;
const LENS_POLL_INTERVAL_MS = parseInt(process.env.LENS_POLL_INTERVAL_MS || String(Math.round(_PHI_LENS ** 5 * 1000)), 10); // φ⁵ ≈ 11,090ms — fluid observation pulse

// System-wide differential store
const differentials = [];
const snapshots = new Map(); // service → last snapshot
const MAX_DIFFERENTIALS = 1000;
const serviceTruth = new Map(); // service → canonical realtime status
let lastRealtimePoll = null;
let realtimePollInFlight = false;

const MONITORED_ENDPOINTS = {
    "heady-brain": "/api/brain/health",
    "heady-soul": "/api/soul/health",
    "heady-battle": "/api/battle/health",
    "heady-hcfp": "/api/hcfp/health",
    "heady-patterns": "/api/patterns/health",
    "heady-ops": "/api/ops/health",
    "heady-maintenance": "/api/maintenance/health",
    "heady-vinci": "/api/vinci/health",
    "heady-notion": "/api/notion/health",
    "heady-auto-success": "/api/auto-success/health",
    "heady-conductor": "/api/conductor/health",
    "heady-lens": "/api/lens/health",
};

// Services HeadyLens monitors
const MONITORED_SERVICES = [
    "heady-brain", "heady-soul", "heady-battle", "heady-hcfp",
    "heady-patterns", "heady-ops", "heady-maintenance", "heady-vinci",
    "heady-notion", "heady-auto-success", "heady-lens", "heady-conductor",
];

for (const service of Object.keys(MONITORED_ENDPOINTS)) {
    serviceTruth.set(service, {
        service,
        endpoint: MONITORED_ENDPOINTS[service],
        status: "unknown",
        healthy: false,
        latencyMs: null,
        error: "not-yet-polled",
        source: "heady-lens",
        ts: null,
    });
}

function serviceIsHealthy(payload, statusCode) {
    if (statusCode && statusCode >= 500) return false;
    if (payload?.ok === false) return false;
    if (payload?.status) {
        const normalized = String(payload.status).toLowerCase();
        if (["error", "down", "critical", "unhealthy", "not_ready"].includes(normalized)) return false;
        if (["ok", "active", "ready", "healthy", "nominal"].includes(normalized)) return true;
    }
    return statusCode ? statusCode < 500 : true;
}

function fetchManagerJson(endpoint, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const base = new URL(INTERNAL_MANAGER_URL);
        const url = new URL(endpoint, base);
        const client = url.protocol === "https:" ? https : http;

        const req = client.request({
            hostname: url.hostname,
            port: url.port || (url.protocol === "https:" ? 443 : 80),
            path: `${url.pathname}${url.search}`,
            method: "GET",
            timeout: timeoutMs,
            rejectUnauthorized: false,
        }, (resp) => {
            let data = "";
            resp.on("data", (chunk) => { data += chunk; });
            resp.on("end", () => {
                try {
                    const parsed = data ? JSON.parse(data) : {};
                    resolve({ payload: parsed, statusCode: resp.statusCode, latencyMs: Date.now() - start });
                } catch {
                    reject(new Error(`Invalid JSON from ${endpoint}`));
                }
            });
        });

        req.on("error", reject);
        req.on("timeout", () => {
            req.destroy(new Error("Timeout"));
        });
        req.end();
    });
}

function pushDifferential(entry) {
    differentials.push(entry);
    if (differentials.length > MAX_DIFFERENTIALS) {
        differentials.splice(0, differentials.length - MAX_DIFFERENTIALS);
    }
    if (entry.significance > 0.5) persistObservation(entry);
}

function buildSourceOfTruthResponse(includeRawData = false) {
    const services = Array.from(serviceTruth.values()).map((svc) => ({
        service: svc.service,
        endpoint: svc.endpoint,
        status: svc.status,
        healthy: !!svc.healthy,
        latencyMs: svc.latencyMs,
        error: svc.error || null,
        ts: svc.ts,
        ...(includeRawData ? { data: svc.data || null } : {}),
    }));

    const healthyServices = services.filter((s) => s.healthy).length;
    const downServices = services.filter((s) => s.status === "down").length;
    const degradedServices = services.filter((s) => !s.healthy && s.status !== "down").length;

    return {
        ok: true,
        service: "heady-lens",
        sourceOfTruth: "heady-lens",
        mode: "realtime-monitoring-source-of-truth",
        realtime: {
            lastPoll: lastRealtimePoll,
            pollIntervalMs: LENS_POLL_INTERVAL_MS,
            services,
            summary: {
                totalServices: services.length,
                healthyServices,
                degradedServices,
                downServices,
                healthScore: services.length > 0 ? Number((healthyServices / services.length).toFixed(3)) : 0,
            },
        },
        ts: new Date().toISOString(),
    };
}

async function pollRealtimeSourceOfTruth(reason = "interval") {
    if (realtimePollInFlight) return buildSourceOfTruthResponse();
    realtimePollInFlight = true;

    try {
        const entries = Object.entries(MONITORED_ENDPOINTS);

        for (const [service, endpoint] of entries) {
            const previous = serviceTruth.get(service);
            const nowIso = new Date().toISOString();

            try {
                const { payload, statusCode, latencyMs } = await fetchManagerJson(endpoint);
                const healthy = serviceIsHealthy(payload, statusCode);
                const status = healthy ? "healthy" : "degraded";

                serviceTruth.set(service, {
                    service,
                    endpoint,
                    status,
                    healthy,
                    latencyMs,
                    error: null,
                    data: payload,
                    source: "heady-lens",
                    ts: nowIso,
                });

                snapshots.set(service, { value: healthy ? 1 : 0, metric: "health", status, ts: nowIso });

                const prevValue = previous?.healthy ? 1 : 0;
                const nextValue = healthy ? 1 : 0;
                if (!previous || prevValue !== nextValue || previous.status !== status) {
                    pushDifferential({
                        id: `lens-rt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                        source: service,
                        metric: "health",
                        value: nextValue,
                        previous: prevValue,
                        delta: nextValue - prevValue,
                        context: `realtime:${reason} ${previous?.status || "unknown"} -> ${status}`,
                        significance: healthy ? 0.65 : 0.95,
                        ts: nowIso,
                    });
                }
            } catch (err) {
                serviceTruth.set(service, {
                    service,
                    endpoint,
                    status: "down",
                    healthy: false,
                    latencyMs: null,
                    error: err.message,
                    source: "heady-lens",
                    ts: nowIso,
                });

                snapshots.set(service, { value: 0, metric: "health", status: "down", ts: nowIso });

                if (!previous || previous.status !== "down") {
                    pushDifferential({
                        id: `lens-rt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                        source: service,
                        metric: "health",
                        value: 0,
                        previous: previous?.healthy ? 1 : 0,
                        delta: previous?.healthy ? -1 : 0,
                        context: `realtime:${reason} ${previous?.status || "unknown"} -> down (${err.message})`,
                        significance: 0.98,
                        ts: nowIso,
                    });
                }
            }
        }

        lastRealtimePoll = new Date().toISOString();
        persistSourceOfTruthState();
        return buildSourceOfTruthResponse();
    } finally {
        realtimePollInFlight = false;
    }
}

hydrateSourceOfTruthState();

const startupPollTimer = setTimeout(() => {
    pollRealtimeSourceOfTruth("startup").catch(() => { /* no-op */ });
}, 1200);
if (typeof startupPollTimer.unref === "function") startupPollTimer.unref();

const realtimePollTimer = setInterval(() => {
    pollRealtimeSourceOfTruth("interval").catch(() => { /* no-op */ });
}, LENS_POLL_INTERVAL_MS);
if (typeof realtimePollTimer.unref === "function") realtimePollTimer.unref();

router.get("/health", (req, res) => {
    const realtime = buildSourceOfTruthResponse().realtime;
    res.json({
        status: "ACTIVE",
        service: "heady-lens",
        mode: "realtime-monitoring-source-of-truth",
        sourceOfTruth: true,
        lastRealtimePoll,
        realtimeHealthScore: realtime.summary.healthScore,
        monitoredServices: MONITORED_SERVICES.length,
        differentials: differentials.length,
        snapshots: snapshots.size,
        memoryGained: differentials.filter(d => d.significance > 0.5).length,
        memoryDiscarded: differentials.filter(d => d.significance <= 0.5).length,
        ts: new Date().toISOString(),
    });
});

router.get("/source-of-truth", async (req, res) => {
    try {
        const refresh = req.query.refresh === "1" || req.query.refresh === "true";
        const includeRawData = req.query.raw === "1" || req.query.raw === "true";

        if (refresh || !lastRealtimePoll) {
            await pollRealtimeSourceOfTruth(refresh ? "manual-refresh" : "first-read");
        }

        res.json(buildSourceOfTruthResponse(includeRawData));
    } catch (err) {
        res.status(502).json({ ok: false, service: "heady-lens", error: err.message });
    }
});

router.get("/realtime", async (req, res) => {
    try {
        const refresh = req.query.refresh === "1" || req.query.refresh === "true";
        const includeRawData = req.query.raw === "1" || req.query.raw === "true";

        if (refresh || !lastRealtimePoll) {
            await pollRealtimeSourceOfTruth(refresh ? "manual-realtime-refresh" : "first-realtime-read");
        }

        res.json(buildSourceOfTruthResponse(includeRawData));
    } catch (err) {
        res.status(502).json({ ok: false, service: "heady-lens", error: err.message });
    }
});

router.post("/realtime/poll", async (req, res) => {
    try {
        const response = await pollRealtimeSourceOfTruth("manual-api");
        res.json({ ...response, action: "realtime-poll" });
    } catch (err) {
        res.status(502).json({ ok: false, service: "heady-lens", error: err.message });
    }
});

// Capture a differential from any system component
router.post("/observe", (req, res) => {
    const { source, metric, value, previous, context } = req.body;
    const entry = {
        id: `lens-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        source: source || "unknown",
        metric: metric || "state-change",
        value,
        previous,
        delta: typeof value === "number" && typeof previous === "number" ? value - previous : null,
        context: (context || "").substring(0, 500),
        significance: calculateSignificance(source, metric, value, previous),
        ts: new Date().toISOString(),
    };

    pushDifferential(entry);

    // Update snapshot for this source
    snapshots.set(source || "unknown", { value, metric, ts: entry.ts });

    const truthKey = normalizeServiceKey(source || "");
    if (truthKey && (metric === "health" || metric === "status" || metric === "state-change")) {
        const numeric = typeof value === "number" ? value : null;
        const asString = typeof value === "string" ? value.toLowerCase() : "";
        const healthy = numeric !== null
            ? numeric > 0
            : !["down", "error", "critical", "unhealthy", "failed"].includes(asString);
        const status = healthy ? "healthy" : "degraded";
        const prev = serviceTruth.get(truthKey) || { endpoint: MONITORED_ENDPOINTS[truthKey] };
        serviceTruth.set(truthKey, {
            ...prev,
            service: truthKey,
            status,
            healthy,
            error: healthy ? null : (asString || "observed-unhealthy"),
            source: "heady-lens-observe",
            ts: entry.ts,
        });
        lastRealtimePoll = entry.ts;
        persistSourceOfTruthState();
    }

    res.json({ ok: true, service: "heady-lens", observation: entry });
});

// Full system differential analysis or Image Analysis
router.post("/analyze", async (req, res) => {
    const { focus, depth, timeRange, action, image_url } = req.body;

    // Check if this is an image analysis request (from CLI)
    if (action === "analyze" && typeof image_url === "string" && image_url.trim()) {
        return handleImageAnalysis(req, res, "analyze");
    }

    const requestedRange = Number.parseInt(timeRange, 10);
    const rangeSeconds = Number.isFinite(requestedRange) ? Math.min(Math.max(requestedRange, 1), 86400) : 300;
    const cutoffMs = rangeSeconds * 1000;
    const cutoff = new Date(Date.now() - cutoffMs).toISOString();

    const recent = differentials.filter(d => d.ts >= cutoff);
    const bySources = {};
    for (const d of recent) {
        if (!bySources[d.source]) bySources[d.source] = [];
        bySources[d.source].push(d);
    }

    const analysis = {
        timeRange: `${rangeSeconds}s`,
        totalObservations: recent.length,
        sources: Object.keys(bySources).length,
        bySource: {},
        significantEvents: recent.filter(d => d.significance > 0.7).length,
        systemHealth: recent.length > 0
            ? recent.reduce((s, d) => s + d.significance, 0) / recent.length
            : 1.0,
    };

    for (const [src, obs] of Object.entries(bySources)) {
        analysis.bySource[src] = {
            observations: obs.length,
            avgSignificance: (obs.reduce((s, d) => s + d.significance, 0) / obs.length).toFixed(3),
            latestMetric: obs[obs.length - 1]?.metric,
            latestValue: obs[obs.length - 1]?.value,
        };
    }

    res.json({ ok: true, service: "heady-lens", action: "system-analysis", analysis, focus: focus || "all", depth: depth || "standard", ts: new Date().toISOString() });
});

// Post endpoints for CLI commands
router.post("/detect", (req, res) => handleImageAnalysis(req, res, "detect"));
router.post("/process", (req, res) => handleImageAnalysis(req, res, "process"));

// ── Vision AI — real provider integration ──
const ACTION_PROMPTS = {
    analyze: "Analyze this image in detail. Describe what you see, identify key elements, colors, composition, and any text present.",
    detect: "Detect and list all distinct objects, people, text, logos, and notable elements in this image. Return structured results.",
    process: "Process this image: extract all text (OCR), identify dominant colors, estimate dimensions, and summarize the visual content.",
};

async function handleImageAnalysis(req, res, actionType) {
    const { image_url, prompt } = req.body;
    const imageRef = typeof image_url === "string" ? image_url.trim() : "";
    if (!imageRef) {
        return res.status(400).json({ ok: false, service: "heady-lens", error: "image_url is required" });
    }

    const customPrompt = typeof prompt === "string" ? prompt.trim() : "";
    const systemPrompt = customPrompt || ACTION_PROMPTS[actionType] || ACTION_PROMPTS.analyze;
    let provider = "none";

    try {
        let analysisText = "";

        // ── Strategy 1: Google Gemini Vision ──
        const genAI = getGenAI();
        const OPENAI_API_KEY = getOpenAIKey();
        if (genAI) {
            try {
                provider = "google-gemini";
                const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

                let parts = [{ text: systemPrompt }];

                // If image_url is a local file path, read and inline it
                const resolvedPath = path.isAbsolute(imageRef)
                    ? imageRef
                    : path.join(__dirname, "..", "..", imageRef);

                if (fs.existsSync(resolvedPath)) {
                    const imageData = fs.readFileSync(resolvedPath);
                    const ext = path.extname(resolvedPath).toLowerCase().replace(".", "");
                    const mimeMap = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" };
                    parts.push({
                        inlineData: {
                            mimeType: mimeMap[ext] || "image/png",
                            data: imageData.toString("base64"),
                        },
                    });
                } else if (imageRef.startsWith("http")) {
                    // For remote URLs, pass as file data via fetch
                    const imgRes = await fetch(imageRef, { signal: AbortSignal.timeout(10000) });
                    if (imgRes.ok) {
                        const buf = Buffer.from(await imgRes.arrayBuffer());
                        const ct = imgRes.headers.get("content-type") || "image/png";
                        parts.push({ inlineData: { mimeType: ct, data: buf.toString("base64") } });
                    } else {
                        parts = [{ text: `${systemPrompt}\n\nImage URL: ${imageRef}` }];
                    }
                } else {
                    parts = [{ text: `${systemPrompt}\n\nImage reference: ${imageRef}` }];
                }

                const result = await model.generateContent(parts);
                analysisText = result.response.text();
            } catch (geminiErr) {
                logger.logError('OBSERVER', `HeadyLens Gemini failed: ${geminiErr.message}, falling back to OpenAI`, geminiErr);
                analysisText = "";
            }
        }

        // ── Strategy 2: OpenAI Vision fallback ──
        if (!analysisText && OPENAI_API_KEY) {
            try {
                provider = "openai-vision";
                const messages = [{ role: "user", content: [{ type: "text", text: systemPrompt }] }];

                const resolvedPath = path.isAbsolute(imageRef)
                    ? imageRef
                    : path.join(__dirname, "..", "..", imageRef);

                if (fs.existsSync(resolvedPath)) {
                    const imageData = fs.readFileSync(resolvedPath);
                    const ext = path.extname(resolvedPath).toLowerCase().replace(".", "");
                    const mimeMap = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };
                    const dataUrl = `data:${mimeMap[ext] || "image/png"};base64,${imageData.toString("base64")}`;
                    messages[0].content.push({ type: "image_url", image_url: { url: dataUrl } });
                } else if (imageRef.startsWith("http")) {
                    messages[0].content.push({ type: "image_url", image_url: { url: imageRef } });
                }

                const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
                    body: JSON.stringify({ model: "gpt-4o-mini", messages, max_tokens: 1024 }),
                    signal: AbortSignal.timeout(20000),
                });

                if (oaiRes.ok) {
                    const data = await oaiRes.json();
                    analysisText = data.choices?.[0]?.message?.content || "";
                }
            } catch (oaiErr) {
                logger.logError('OBSERVER', `HeadyLens OpenAI fallback failed: ${oaiErr.message}`, oaiErr);
            }
        }

        if (!analysisText) {
            analysisText = `No vision provider available. Ensure GOOGLE_API_KEY or OPENAI_API_KEY is set.`;
            provider = "none";
        }

        // Persist as a lens observation
        const observation = {
            id: `lens-vision-${Date.now()}`,
            source: "heady-lens-vision",
            metric: actionType,
            value: analysisText.substring(0, 500),
            context: imageRef,
            significance: 0.8,
            ts: new Date().toISOString(),
        };
        pushDifferential(observation);

        res.json({
            ok: true,
            service: "heady-lens",
            action: actionType,
            provider,
            target: imageRef,
            result: {
                analysis: analysisText,
                confidence: analysisText && provider !== "none" ? 0.95 : 0.0,
                tags: ["vision", actionType, provider],
                prompt_used: systemPrompt,
            },
            ts: new Date().toISOString(),
        });
    } catch (err) {
        logger.logError('OBSERVER', 'HeadyLens vision error', err);
        res.status(500).json({ ok: false, service: "heady-lens", error: err.message });
    }
}

// Get all current snapshots (system state)
router.get("/snapshots", (req, res) => {
    const snap = {};
    for (const [k, v] of snapshots) snap[k] = v;
    res.json({ ok: true, snapshots: snap, count: snapshots.size });
});

// Get differential history
router.get("/differentials", (req, res) => {
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 50;
    res.json({ ok: true, differentials: differentials.slice(-limit), total: differentials.length });
});

// Memory summary: gained vs discarded
router.get("/memory", (req, res) => {
    const gained = differentials.filter(d => d.significance > 0.5);
    const discarded = differentials.filter(d => d.significance <= 0.5);
    res.json({
        ok: true, service: "heady-lens",
        memory: {
            gained: gained.length,
            discarded: discarded.length,
            retentionRate: differentials.length > 0 ? (gained.length / differentials.length * 100).toFixed(1) + "%" : "N/A",
            recentGained: gained.slice(-5).map(d => ({ source: d.source, metric: d.metric, significance: d.significance, ts: d.ts })),
            recentDiscarded: discarded.slice(-3).map(d => ({ source: d.source, metric: d.metric, significance: d.significance, ts: d.ts })),
        },
        ts: new Date().toISOString(),
    });
});

// Vector-ready export for Qdrant
router.get("/vector-export", (req, res) => {
    const significant = differentials.filter(d => d.significance > 0.3);
    const vectors = significant.map(d => ({
        id: d.id,
        payload: { source: d.source, metric: d.metric, value: d.value, significance: d.significance, ts: d.ts },
        text: `${d.source} ${d.metric}: ${JSON.stringify(d.value)} (Δ=${d.delta}, sig=${d.significance.toFixed(2)})`,
    }));
    res.json({ ok: true, vectors, count: vectors.length, format: "qdrant-ready" });
});

router.get("/analyze", (req, res) => res.json({ ok: true, recentDifferentials: differentials.slice(-10) }));
router.get("/process", (req, res) => res.json({ ok: true, snapshots: snapshots.size, differentials: differentials.length }));

// ── Helpers ──
function calculateSignificance(source, metric, value, previous) {
    let sig = 0.5;
    if (source && MONITORED_SERVICES.includes(source)) sig += 0.1;
    if (metric === "error" || metric === "failure") sig += 0.3;
    if (metric === "state-change") sig += 0.2;
    if (typeof value === "number" && typeof previous === "number") {
        const delta = Math.abs(value - previous);
        const pctChange = previous !== 0 ? delta / Math.abs(previous) : delta;
        if (pctChange > 0.5) sig += 0.2;
        if (pctChange > 1.0) sig += 0.1;
    }
    return Math.min(1.0, sig);
}

function persistObservation(entry) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        const line = JSON.stringify({ ...entry, persisted: true }) + "\n";
        fs.appendFileSync(path.join(DATA_DIR, "lens-observations.jsonl"), line);
    } catch { /* non-critical */ }
}

module.exports = router;
