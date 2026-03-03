import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs-extra';
import compression from 'compression';
import { geminiChat, geminiChatStream, geminiEmbed, geminiStatus, listGeminiModels, HEADY_SYSTEM_PROMPT, AUTHORIZED_HEADY_KEYS } from './services/gemini.js';
import { computeHCFP, getHCFPHistory, getHCFPSubsystem } from './services/hcfp.js';
import { getAutonomyState, ingestConcept, runAutonomyTick, createAbletonSession, getAuditEvents, getMonorepoProjection, getAutonomyRuntimeStatus, startAutonomyLoop, subscribeAutonomyEvents } from './services/autonomy-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8090;
const AUTONOMY_WRITE_KEY = process.env.AUTONOMY_WRITE_KEY || '';
const AUTONOMY_SSE_CLIENT_LIMIT = Number(process.env.AUTONOMY_SSE_CLIENT_LIMIT || 50);
const AUTONOMY_RATE_WINDOW_MS = Number(process.env.AUTONOMY_RATE_WINDOW_MS || 60000);
const AUTONOMY_RATE_MAX = Number(process.env.AUTONOMY_RATE_MAX || 120);
const DATA_FILE = join(__dirname, 'data', 'config.json');
const LOGS_FILE = join(__dirname, 'data', 'logs.json');
const PROFILES_FILE = join(__dirname, 'data', 'profiles.json');
const DNS_FILE = join(__dirname, 'data', 'dns-records.json');
const TUNNEL_FILE = join(__dirname, 'data', 'tunnel-config.yml');
const TASKS_FILE = join(__dirname, 'data', 'tasks.json');
const ROUTES_FILE = join(__dirname, 'data', 'routes.json');

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('short'));


app.use((req, res, next) => {
    if (!req.path.startsWith('/api/autonomy')) return next();
    if (!checkAutonomyRateLimit(req)) {
        return res.status(429).json({ error: 'Autonomy API rate limit exceeded' });
    }
    next();
});

// ── Heady API Key Auth (optional — validates X-Heady-Key header) ──
app.use((req, res, next) => {
    const key = req.headers['x-heady-key'];
    if (key && AUTHORIZED_HEADY_KEYS.size > 0 && !AUTHORIZED_HEADY_KEYS.has(key)) {
        return res.status(401).json({ error: 'Invalid Heady API key' });
    }
    next();
});

// ── Data helpers ──
const distPath = join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
}


const autonomyRateMap = new Map();
let autonomySseClients = 0;

function checkAutonomyRateLimit(req) {
    const id = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
    const now = Date.now();
    const rec = autonomyRateMap.get(id) || { count: 0, resetAt: now + AUTONOMY_RATE_WINDOW_MS };
    if (now > rec.resetAt) {
        rec.count = 0;
        rec.resetAt = now + AUTONOMY_RATE_WINDOW_MS;
    }
    rec.count += 1;
    autonomyRateMap.set(id, rec);
    return rec.count <= AUTONOMY_RATE_MAX;
}

function requireAutonomyWriteAuth(req, res) {
    if (!AUTONOMY_WRITE_KEY) return true;
    const key = req.headers['x-autonomy-key'];
    if (key !== AUTONOMY_WRITE_KEY) {
        res.status(401).json({ error: 'Invalid autonomy write key' });
        return false;
    }
    return true;
}

async function ensureFile(file, defaultContent = {}) {
    await fs.ensureDir(join(__dirname, 'data'));
    if (!(await fs.pathExists(file))) await fs.writeJson(file, defaultContent, { spaces: 2 });
}

async function readConfig() { await ensureFile(DATA_FILE, { services: [], domains: [], design: {} }); return fs.readJson(DATA_FILE); }
async function writeConfig(data) { await fs.writeJson(DATA_FILE, data, { spaces: 2 }); }
async function readLogs() { await ensureFile(LOGS_FILE, []); return fs.readJson(LOGS_FILE); }
async function writeLogs(data) { await fs.writeJson(LOGS_FILE, data, { spaces: 2 }); }
async function readProfiles() { await ensureFile(PROFILES_FILE, []); return fs.readJson(PROFILES_FILE); }
async function writeProfiles(data) { await fs.writeJson(PROFILES_FILE, data, { spaces: 2 }); }
async function readDns() { await ensureFile(DNS_FILE, []); return fs.readJson(DNS_FILE); }
async function writeDns(data) { await fs.writeJson(DNS_FILE, data, { spaces: 2 }); }
async function readTasks() { await ensureFile(TASKS_FILE, []); return fs.readJson(TASKS_FILE); }
async function writeTasks(data) { await fs.writeJson(TASKS_FILE, data, { spaces: 2 }); }
async function readRoutes() { await ensureFile(ROUTES_FILE, []); return fs.readJson(ROUTES_FILE); }
async function writeRoutes(data) { await fs.writeJson(ROUTES_FILE, data, { spaces: 2 }); }

async function addLog(level, message, source = 'system') {
    const logs = await readLogs();
    logs.unshift({ ts: new Date().toISOString(), level, msg: message, source });
    if (logs.length > 500) logs.length = 500;
    await writeLogs(logs);
}

// ── Dashboard ──
app.get('/api/dashboard', async (req, res) => {
    try {
        const config = await readConfig();
        const hcfp = await computeHCFP();
        res.json({
            services: (config.services || []).length,
            domains: (config.domains || []).length,
            tunnels: 3,
            hcfp,
            version: '2.0.0',
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: '2.0.0', uptime: process.uptime(), env: process.env.NODE_ENV || 'production' });
});

// ── Config ──
app.get('/api/config/system', async (req, res) => {
    try { res.json(await readConfig()); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/config/system', async (req, res) => {
    try { await writeConfig(req.body); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Services ──
app.get('/api/services', async (req, res) => {
    try { const c = await readConfig(); res.json(c.services || []); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/services', async (req, res) => {
    try {
        const c = await readConfig();
        const svc = { id: `svc-${Date.now()}`, ...req.body, createdAt: new Date().toISOString() };
        c.services = [...(c.services || []), svc];
        await writeConfig(c);
        await addLog('info', `Service created: ${svc.name || svc.id}`, 'services');
        res.status(201).json(svc);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Domains ──
app.get('/api/domains', async (req, res) => {
    try { const c = await readConfig(); res.json(c.domains || []); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/domains', async (req, res) => {
    try {
        const c = await readConfig();
        const domain = { id: `dom-${Date.now()}`, ...req.body, createdAt: new Date().toISOString() };
        c.domains = [...(c.domains || []), domain];
        await writeConfig(c);
        await addLog('info', `Domain added: ${domain.name || domain.domain}`, 'domains');
        res.status(201).json(domain);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Tunnels ──
app.get('/api/tunnels', async (req, res) => {
    try {
        if (await fs.pathExists(TUNNEL_FILE)) {
            const raw = await fs.readFile(TUNNEL_FILE, 'utf8');
            res.json({ config: raw });
        } else {
            res.json({ config: '# No tunnel config yet' });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Profiles / Users ──
app.get('/api/profiles', async (req, res) => {
    try { res.json(await readProfiles()); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/profiles', async (req, res) => {
    try {
        const profiles = await readProfiles();
        const profile = { id: `usr-${Date.now()}`, ...req.body, createdAt: new Date().toISOString() };
        profiles.push(profile);
        await writeProfiles(profiles);
        await addLog('info', `Profile created: ${profile.name || profile.email}`, 'users');
        res.status(201).json(profile);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Logs ──
app.get('/api/logs', async (req, res) => {
    try {
        const limit = parseBoundedInt(req.query.limit, 100, 1, 500);
        const logs = await readLogs();
        res.json(logs.slice(0, limit));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Design ──
app.get('/api/design', async (req, res) => {
    try { const c = await readConfig(); res.json(c.design || {}); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/design', async (req, res) => {
    try { const c = await readConfig(); c.design = req.body; await writeConfig(c); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Tasks ──
app.get('/api/tasks', async (req, res) => {
    try { res.json(await readTasks()); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/tasks', async (req, res) => {
    try {
        const tasks = await readTasks();
        const task = { id: `task-${Date.now()}`, ...req.body, createdAt: new Date().toISOString() };
        tasks.push(task);
        await writeTasks(tasks);
        await addLog('info', `Task created: ${task.title || task.id}`, 'tasks');
        res.status(201).json(task);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── HCFP ──
app.get('/api/hcfp/status', async (req, res) => {
    try { res.json(await computeHCFP()); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/auto-success/status', async (req, res) => {
    try { res.json(await computeHCFP()); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/hcfp/history', async (req, res) => {
    try { res.json(await getHCFPHistory(parseBoundedInt(req.query.limit, 100, 1, 1000))); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/hcfp/subsystems/:id', async (req, res) => {
    try { res.json(await getHCFPSubsystem(req.params.id)); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Routes ──
app.get('/api/routes', async (req, res) => {
    try { res.json(await readRoutes()); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/routes', async (req, res) => {
    try {
        const routes = await readRoutes();
        const route = { id: `route-${Date.now()}`, ...req.body, createdAt: new Date().toISOString() };
        routes.push(route);
        await writeRoutes(routes);
        await addLog('info', `Route created: ${route.name || route.id}`, 'routing');
        res.status(201).json(route);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── AUTONOMY CORE (Headless, vector-space-first orchestration) ──
app.get('/api/autonomy/state', async (req, res) => {
    try { res.json(await getAutonomyState()); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/autonomy/ingest', async (req, res) => {
    try {
        if (!requireAutonomyWriteAuth(req, res)) return;
        const text = String(req.body?.text || '').trim();
        if (!text) return res.status(400).json({ error: 'text is required' });
        res.status(201).json(await ingestConcept({ text, priority: req.body?.priority || 'balanced' }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/autonomy/tick', async (req, res) => {
    try {
        if (!requireAutonomyWriteAuth(req, res)) return;
        res.json(await runAutonomyTick('api'));
    }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/autonomy/music-session', async (req, res) => {
    try {
        if (!requireAutonomyWriteAuth(req, res)) return;
        const user = String(req.body?.user || '').trim();
        if (!user) return res.status(400).json({ error: 'user is required' });
        res.status(201).json(await createAbletonSession({ user, bpm: req.body?.bpm, key: req.body?.key }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/autonomy/audit', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        res.json(await getAuditEvents(limit));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/autonomy/monorepo-projection', async (req, res) => {
    try { res.json(await getMonorepoProjection()); }
    catch (e) { res.status(500).json({ error: e.message }); }
});


app.get('/api/autonomy/health', async (req, res) => {
    try {
        const runtime = await getAutonomyRuntimeStatus();
        const health = runtime.alive && runtime.loopActive ? 'healthy' : 'degraded';
        res.json({
            health,
            realtime: runtime.loopActive,
            latencyMs: runtime.lastTickMs,
            pendingConcepts: runtime.pendingConcepts,
            tickIntervalMs: runtime.tickIntervalMs,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/autonomy/runtime', async (req, res) => {
    try {
        const runtime = await getAutonomyRuntimeStatus();
        res.json({ ...runtime, streamClients: autonomySseClients, streamClientLimit: AUTONOMY_SSE_CLIENT_LIMIT, rateWindowMs: AUTONOMY_RATE_WINDOW_MS, rateMax: AUTONOMY_RATE_MAX });
    }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/autonomy/control/start', async (req, res) => {
    try {
        if (!requireAutonomyAdmin(req, res)) return;
        const started = startAutonomyLoop();
        res.json({ success: true, started, runtime: await getAutonomyRuntimeStatus() });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/autonomy/control/stop', async (req, res) => {
    try {
        if (!requireAutonomyAdmin(req, res)) return;
        const stopped = stopAutonomyLoop();
        res.json({ success: true, stopped, runtime: await getAutonomyRuntimeStatus() });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/autonomy/stream', async (req, res) => {
    if (autonomySseClients >= AUTONOMY_SSE_CLIENT_LIMIT) {
        return res.status(503).json({ error: 'Autonomy stream capacity reached' });
    }

    autonomySseClients += 1;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const heartbeat = setInterval(() => {
        res.write(`event: heartbeat\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);
    }, 15000);

    const unsubscribe = subscribeAutonomyEvents((event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    res.write(`data: ${JSON.stringify({ type: 'hello', ts: new Date().toISOString() })}\n\n`);

    req.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
        autonomySseClients = Math.max(autonomySseClients - 1, 0);
        res.end();
    });
});

// ── GOOGLE AI STUDIO (Gemini) ──
app.get('/api/ai/models', async (req, res) => {
    try { res.json(await listGeminiModels()); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/ai/status', async (req, res) => {
    try { res.json(await geminiStatus()); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ai/chat', async (req, res) => {
    try {
        const { model, messages, systemPrompt, temperature, maxTokens } = req.body;
        if (!messages?.length) return res.status(400).json({ error: 'messages required' });
        const result = await geminiChat({ model, messages, systemPrompt, temperature, maxTokens });
        await addLog('info', `Gemini chat: ${model} — ${result.usage?.totalTokens ?? '?'} tokens`, 'ai');
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ai/chat/stream', async (req, res) => {
    try {
        const { model, messages, systemPrompt, temperature, maxTokens } = req.body;
        if (!messages?.length) return res.status(400).json({ error: 'messages required' });
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        const result = await geminiChatStream({ model, messages, systemPrompt, temperature, maxTokens });
        res.write(`data: ${JSON.stringify({ text: result.text, usage: result.usage })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ai/embed', async (req, res) => {
    try {
        const { text, model, taskType } = req.body;
        if (!text) return res.status(400).json({ error: 'text required' });
        const result = await geminiEmbed({ text, model, taskType });
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/ai/system-prompt', (req, res) => {
    res.json({ systemPrompt: HEADY_SYSTEM_PROMPT });
});

// ── SPA FALLBACK ───────────────────────────────────────────────
app.get('*', (req, res) => {
    const indexPath = join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(200).json({ status: 'Heady Admin API running', version: '2.0.0', docs: '/api/dashboard' });
    }
});

// ── START ──────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Heady Admin UI server running on http://0.0.0.0:${PORT}`);
    console.log(`Drupal 11 Hybrid Admin - HCFP Auto-Success Mode`);
    await addLog('info', `Admin server started on port ${PORT}`, 'system');

    startAutonomyLoop();
});

export default app;
