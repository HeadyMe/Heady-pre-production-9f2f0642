import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { EventEmitter } from 'node:events';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { WebSocketServer } from 'ws';
import { getConfig } from '@heady/shared';
import { logger } from '@heady/shared';
import { signToken, verifyToken, hashPassword, verifyPassword, createApiKey, hashApiKey, apiKeyPrefix, randomId, nowIso } from '@heady/shared/src/crypto.mjs';
import { createMemoryStore } from '@heady/vector-memory';
import { createMcpRegistry, handleRpc } from '@heady/mcp';

const config = getConfig(process.env);
const app = express();
const server = http.createServer(app);
const eventHub = new EventEmitter();
const dataDir = config.dataDir;
const authFile = path.join(dataDir, 'auth.json');

const state = {
  auth: { users: [], apiKeys: [] }
};

async function loadAuth() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    state.auth = JSON.parse(await fs.readFile(authFile, 'utf8'));
  } catch {
    await saveAuth();
  }
}

async function saveAuth() {
  const temp = `${authFile}.tmp`;
  await fs.writeFile(temp, JSON.stringify(state.auth, null, 2));
  await fs.rename(temp, authFile);
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function createSession(user) {
  const token = signToken({ sub: user.id, role: user.role, email: user.email }, config.jwtSecret, '7d');
  return { token, user: sanitizeUser(user) };
}

function findUserByEmail(email) {
  return state.auth.users.find((user) => user.email === String(email || '').toLowerCase());
}

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7);
  return req.query.token || req.headers['x-access-token'] || null;
}

function resolveApiKey(key) {
  if (!key) return null;
  const hashed = hashApiKey(String(key));
  return state.auth.apiKeys.find((record) => record.hashedKey === hashed && !record.revokedAt) || null;
}

function authMiddleware(req, res, next) {
  const rawApiKey = req.headers['x-api-key'];
  const apiKeyRecord = resolveApiKey(rawApiKey);
  if (apiKeyRecord) {
    const user = state.auth.users.find((entry) => entry.id === apiKeyRecord.userId);
    if (user) {
      apiKeyRecord.lastUsedAt = nowIso();
      req.user = sanitizeUser(user);
      req.authMode = 'api_key';
      return next();
    }
  }

  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = verifyToken(token, config.jwtSecret);
    const user = state.auth.users.find((entry) => entry.id === payload.sub);
    if (!user) return res.status(401).json({ error: 'Unknown session user' });
    req.user = sanitizeUser(user);
    req.authMode = 'jwt';
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function broadcast(type, payload) {
  eventHub.emit('event', { type, payload, ts: nowIso() });
}

function optionalAuth(req, _res, next) {
  const token = getTokenFromRequest(req);
  if (!token) return next();
  try {
    const payload = verifyToken(token, config.jwtSecret);
    const user = state.auth.users.find((entry) => entry.id === payload.sub);
    if (user) req.user = sanitizeUser(user);
  } catch {
    // ignore optional auth failures on public routes
  }
  next();
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin(origin, callback) {
  if (!origin || config.origins.includes(origin)) return callback(null, true);
  return callback(new Error('Origin not allowed by CORS'));
} }));
app.use(express.json({ limit: '2mb' }));
app.use(optionalAuth);
app.use(express.static(path.join(process.cwd(), 'public')));

const memoryStore = await createMemoryStore({ databaseUrl: config.databaseUrl, dataDir });
const mcpRegistry = createMcpRegistry({ memoryStore });
await loadAuth();

app.get('/api/health', async (_req, res) => {
  res.json({
    ok: true,
    service: 'heady-gateway',
    mode: memoryStore.mode,
    stats: await memoryStore.stats(),
    users: state.auth.users.length,
    apiKeys: state.auth.apiKeys.filter((record) => !record.revokedAt).length
  });
});

app.post('/api/auth/register', async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const password = String(req.body.password || '');
  const name = String(req.body.name || '').trim() || email.split('@')[0] || 'user';
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  if (findUserByEmail(email)) return res.status(409).json({ error: 'user already exists' });

  const user = {
    id: randomId(),
    email,
    name,
    role: state.auth.users.length === 0 && config.autoPromoteFirstUser ? 'owner' : 'user',
    passwordHash: hashPassword(password),
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  state.auth.users.push(user);
  await saveAuth();
  broadcast('auth.registered', { user: sanitizeUser(user) });
  res.status(201).json(createSession(user));
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const password = String(req.body.password || '');
  const user = findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  user.updatedAt = nowIso();
  await saveAuth();
  broadcast('auth.logged_in', { user: sanitizeUser(user) });
  res.json(createSession(user));
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  res.json({ user: req.user, authMode: req.authMode });
});

app.get('/api/auth/api-keys', authMiddleware, async (req, res) => {
  const keys = state.auth.apiKeys
    .filter((record) => record.userId === req.user.id && !record.revokedAt)
    .map(({ prefix, name, scopes, createdAt, lastUsedAt }) => ({ prefix, name, scopes, createdAt, lastUsedAt }));
  res.json({ keys });
});

app.post('/api/auth/api-keys', authMiddleware, async (req, res) => {
  const name = String(req.body.name || 'default');
  const scopes = Array.isArray(req.body.scopes) ? req.body.scopes : ['memory:read', 'memory:write', 'mcp:call'];
  const rawKey = createApiKey();
  state.auth.apiKeys.push({
    id: randomId(),
    userId: req.user.id,
    name,
    scopes,
    prefix: apiKeyPrefix(rawKey),
    hashedKey: hashApiKey(rawKey),
    createdAt: nowIso(),
    lastUsedAt: null,
    revokedAt: null
  });
  await saveAuth();
  broadcast('auth.api_key_created', { userId: req.user.id, name });
  res.status(201).json({ apiKey: rawKey, prefix: apiKeyPrefix(rawKey), name, scopes });
});

app.delete('/api/auth/api-keys/:prefix', authMiddleware, async (req, res) => {
  const record = state.auth.apiKeys.find((entry) => entry.userId === req.user.id && entry.prefix === req.params.prefix && !entry.revokedAt);
  if (!record) return res.status(404).json({ error: 'api key not found' });
  record.revokedAt = nowIso();
  await saveAuth();
  res.json({ ok: true });
});

app.post('/api/memory/upsert', authMiddleware, async (req, res) => {
  const record = await memoryStore.upsertMemory({
    id: req.body.id,
    userId: req.user.id,
    namespace: req.body.namespace || 'default',
    content: String(req.body.content || ''),
    metadata: typeof req.body.metadata === 'object' && req.body.metadata ? req.body.metadata : {}
  });
  broadcast('memory.upserted', { userId: req.user.id, namespace: record.namespace, id: record.id });
  res.status(201).json(record);
});

app.post('/api/memory/search', authMiddleware, async (req, res) => {
  const result = await memoryStore.searchMemories({
    userId: req.user.id,
    namespace: req.body.namespace || null,
    query: String(req.body.query || ''),
    limit: Number(req.body.limit || 10)
  });
  res.json({ results: result });
});

app.get('/api/memory/list', authMiddleware, async (req, res) => {
  const result = await memoryStore.listMemories({
    userId: req.user.id,
    namespace: req.query.namespace || null,
    limit: Number(req.query.limit || 50)
  });
  res.json({ memories: result });
});

app.get('/api/memory/timeline', authMiddleware, async (req, res) => {
  const result = await memoryStore.timeline({
    userId: req.user.id,
    namespace: req.query.namespace || null,
    limit: Number(req.query.limit || 100)
  });
  res.json({ timeline: result });
});

app.post('/mcp/rpc', authMiddleware, async (req, res) => {
  const payload = await handleRpc(mcpRegistry, req.body, { user: req.user });
  res.json(payload);
});

app.get('/mcp/sse', authMiddleware, async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.write(`event: ready
data: ${JSON.stringify({ ok: true, userId: req.user.id })}

`);

  const handler = (event) => {
    res.write(`event: ${event.type}
data: ${JSON.stringify(event.payload)}

`);
  };
  eventHub.on('event', handler);
  req.on('close', () => eventHub.off('event', handler));
});

app.get('/api/domains', (_req, res) => {
  res.sendFile(path.resolve(process.cwd(), '../../configs/domains.json'));
});

app.get('*', (_req, res, next) => {
  if (_req.path.startsWith('/api/') || _req.path.startsWith('/mcp/')) return next();
  res.sendFile(path.join(process.cwd(), 'public/index.html'));
});

const eventsWss = new WebSocketServer({ noServer: true });
const mcpWss = new WebSocketServer({ noServer: true });

async function authenticateUpgrade(request) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const headerToken = request.headers['sec-websocket-protocol'];
  const token = url.searchParams.get('token') || (headerToken && headerToken.startsWith('bearer,') ? headerToken.split(',')[1] : null);
  const apiKey = url.searchParams.get('apiKey');

  if (apiKey) {
    const record = resolveApiKey(apiKey);
    if (!record) throw new Error('invalid api key');
    const user = state.auth.users.find((entry) => entry.id === record.userId);
    if (!user) throw new Error('unknown user');
    return sanitizeUser(user);
  }

  if (!token) throw new Error('missing token');
  const payload = verifyToken(token, config.jwtSecret);
  const user = state.auth.users.find((entry) => entry.id === payload.sub);
  if (!user) throw new Error('unknown user');
  return sanitizeUser(user);
}

server.on('upgrade', async (request, socket, head) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === '/ws/events') {
      const user = await authenticateUpgrade(request);
      eventsWss.handleUpgrade(request, socket, head, (ws) => {
        ws.user = user;
        eventsWss.emit('connection', ws, request);
      });
      return;
    }
    if (url.pathname === '/ws/mcp') {
      const user = await authenticateUpgrade(request);
      mcpWss.handleUpgrade(request, socket, head, (ws) => {
        ws.user = user;
        mcpWss.emit('connection', ws, request);
      });
      return;
    }
    socket.destroy();
  } catch {
    socket.destroy();
  }
});

eventsWss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'ready', payload: { userId: ws.user.id } }));
  const handler = (event) => ws.readyState === 1 && ws.send(JSON.stringify(event));
  eventHub.on('event', handler);
  ws.on('close', () => eventHub.off('event', handler));
});

mcpWss.on('connection', (ws) => {
  ws.send(JSON.stringify({ jsonrpc: '2.0', method: 'ready', params: { userId: ws.user.id } }));
  ws.on('message', async (buffer) => {
    try {
      const body = JSON.parse(buffer.toString('utf8'));
      const payload = await handleRpc(mcpRegistry, body, { user: ws.user });
      ws.send(JSON.stringify(payload));
    } catch (error) {
      ws.send(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: error.message } }));
    }
  });
});

server.listen(config.port, () => {
  logger.info('heady gateway listening', { port: config.port, mode: memoryStore.mode, dataDir });
});
