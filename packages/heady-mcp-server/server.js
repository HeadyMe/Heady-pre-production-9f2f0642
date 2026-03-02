#!/usr/bin/env node
/**
 * ═══ Heady MCP Server — Buddy Everywhere ═══
 * Standalone MCP server connecting any MCP client to the Heady Intelligence Layer.
 *
 * Transports:
 *   - stdio     (default — IDE integration: Claude Desktop, Cursor, VS Code)
 *   - streamable-http  (MCP 2025-03-26 spec — remote cross-device)
 *   - sse       (legacy fallback)
 *
 * Usage:
 *   npx heady-mcp-server                              # stdio
 *   HEADY_TRANSPORT=streamable-http node server.js     # Streamable HTTP
 *   HEADY_TRANSPORT=sse node server.js                 # Legacy SSE
 */

const http = require("http");
const crypto = require("crypto");
const TOOLS = require("./tools");

const HEADY_API = process.env.HEADY_URL || "http://127.0.0.1:3301";
const TRANSPORT = process.env.HEADY_TRANSPORT || "stdio";
const PORT = parseInt(process.env.HEADY_MCP_PORT || "3302");
const PROTOCOL_VERSION = "2025-03-26";

// ── Device Identity ──
const DEVICE_ID = process.env.HEADY_DEVICE_ID || crypto.randomBytes(8).toString("hex");
const DEVICE_NAME = process.env.HEADY_DEVICE_NAME || require("os").hostname();

// ── Session Management ──
const sessions = new Map(); // sessionId → { created, lastSeen, deviceId }

function createSession() {
    const id = crypto.randomUUID();
    sessions.set(id, { created: Date.now(), lastSeen: Date.now(), deviceId: DEVICE_ID });
    return id;
}

function validateSession(sessionId) {
    if (!sessionId) return null;
    const session = sessions.get(sessionId);
    if (session) session.lastSeen = Date.now();
    return session;
}

// ── Heady API Caller ──
function callHeady(path, body) {
    const url = new URL(HEADY_API);
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const req = http.request({
            hostname: url.hostname, port: url.port || 3301,
            path, method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
            timeout: 30000,
        }, (res) => {
            let data = "";
            res.on("data", c => data += c);
            res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve({ text: data }); } });
        });
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
        req.write(payload); req.end();
    });
}

// ── MCP Protocol Handler ──
async function handleRequest(request) {
    const { method, params, id } = request;

    if (method === "initialize") {
        const sessionId = createSession();
        return {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: {
                tools: { listChanged: false },
            },
            serverInfo: {
                name: "heady-mcp-server",
                version: "2.0.0",
            },
            _meta: { sessionId, deviceId: DEVICE_ID, deviceName: DEVICE_NAME },
        };
    }

    if (method === "initialized") return {};

    if (method === "tools/list") {
        return { tools: TOOLS.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) };
    }

    if (method === "tools/call") {
        const tool = TOOLS.find(t => t.name === params.name);
        if (!tool) return { content: [{ type: "text", text: `Unknown tool: ${params.name}` }], isError: true };
        try {
            const result = await tool.handler(params.arguments || {}, callHeady);
            return { content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }] };
        } catch (e) {
            return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
        }
    }

    if (method === "ping") return {};

    if (method === "notifications/cancelled") return undefined; // notification, no response

    return { error: { code: -32601, message: `Unknown method: ${method}` } };
}

// ═══════════════════════════════════════════════════════════════════
// STDIO Transport
// ═══════════════════════════════════════════════════════════════════
if (TRANSPORT === "stdio") {
    let buffer = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", async (chunk) => {
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const req = JSON.parse(line);
                const result = await handleRequest(req);
                if (result === undefined) continue; // notification — no response
                const response = { jsonrpc: "2.0", id: req.id };
                if (result.error) response.error = result.error;
                else response.result = result;
                process.stdout.write(JSON.stringify(response) + "\n");
            } catch (e) {
                process.stderr.write(`Parse error: ${e.message}\n`);
            }
        }
    });
    process.stderr.write(`🐝 Heady MCP Server v2.0.0 (stdio) — ${TOOLS.length} tools | Device: ${DEVICE_NAME}\n`);
}

// ═══════════════════════════════════════════════════════════════════
// Streamable HTTP Transport (MCP 2025-03-26)
// ═══════════════════════════════════════════════════════════════════
if (TRANSPORT === "streamable-http") {
    const server = http.createServer(async (req, res) => {
        // CORS
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Mcp-Session-Id");
        res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
        if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

        const sessionId = req.headers["mcp-session-id"];

        // ── POST /mcp — primary JSON-RPC endpoint ──
        if (req.url === "/mcp" && req.method === "POST") {
            let body = "";
            req.on("data", c => body += c);
            req.on("end", async () => {
                try {
                    const request = JSON.parse(body);

                    // Handle batch requests
                    if (Array.isArray(request)) {
                        const results = [];
                        for (const r of request) {
                            const result = await handleRequest(r);
                            if (result === undefined) continue;
                            const response = { jsonrpc: "2.0", id: r.id };
                            if (result.error) response.error = result.error;
                            else response.result = result;
                            results.push(response);
                        }
                        res.writeHead(200, { "Content-Type": "application/json" });
                        res.end(JSON.stringify(results));
                        return;
                    }

                    // Single request
                    const result = await handleRequest(request);

                    // Notification — no response needed
                    if (result === undefined) {
                        res.writeHead(202);
                        return res.end();
                    }

                    const response = { jsonrpc: "2.0", id: request.id };
                    if (result.error) response.error = result.error;
                    else response.result = result;

                    // Set session header if initialize
                    if (request.method === "initialize" && result._meta?.sessionId) {
                        res.setHeader("Mcp-Session-Id", result._meta.sessionId);
                    }

                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify(response));
                } catch (e) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({
                        jsonrpc: "2.0",
                        error: { code: -32700, message: `Parse error: ${e.message}` },
                        id: null,
                    }));
                }
            });
            return;
        }

        // ── GET /mcp — SSE stream for server-initiated messages ──
        if (req.url === "/mcp" && req.method === "GET") {
            if (!sessionId || !validateSession(sessionId)) {
                res.writeHead(400, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ error: "Valid Mcp-Session-Id header required" }));
            }
            res.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            });
            const keepAlive = setInterval(() => res.write(":ping\n\n"), 15000);
            req.on("close", () => clearInterval(keepAlive));
            return;
        }

        // ── DELETE /mcp — terminate session ──
        if (req.url === "/mcp" && req.method === "DELETE") {
            if (sessionId) sessions.delete(sessionId);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));
            return;
        }

        // ── Health endpoint ──
        if (req.url === "/health") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                ok: true,
                transport: "streamable-http",
                protocol: PROTOCOL_VERSION,
                tools: TOOLS.length,
                sessions: sessions.size,
                device: { id: DEVICE_ID, name: DEVICE_NAME },
            }));
            return;
        }

        res.writeHead(404); res.end("Not found");
    });
    server.listen(PORT, () => {
        console.log(`🐝 Heady MCP Server v2.0.0 (Streamable HTTP) — ${TOOLS.length} tools on port ${PORT}`);
        console.log(`   Endpoint: http://localhost:${PORT}/mcp`);
        console.log(`   Device: ${DEVICE_NAME} (${DEVICE_ID})`);
    });
}

// ═══════════════════════════════════════════════════════════════════
// Legacy SSE Transport (backward compat)
// ═══════════════════════════════════════════════════════════════════
if (TRANSPORT === "sse") {
    const server = http.createServer(async (req, res) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

        if (req.url === "/sse") {
            res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
            res.write(`data: ${JSON.stringify({ type: "endpoint", url: "/message" })}\n\n`);
            const keepAlive = setInterval(() => res.write(":ping\n\n"), 15000);
            req.on("close", () => clearInterval(keepAlive));
            return;
        }

        if (req.url === "/message" && req.method === "POST") {
            let body = "";
            req.on("data", c => body += c);
            req.on("end", async () => {
                try {
                    const request = JSON.parse(body);
                    const result = await handleRequest(request);
                    if (result === undefined) { res.writeHead(202); return res.end(); }
                    const response = { jsonrpc: "2.0", id: request.id };
                    if (result.error) response.error = result.error;
                    else response.result = result;
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify(response));
                } catch (e) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        if (req.url === "/health") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true, tools: TOOLS.length, transport: "sse", device: DEVICE_NAME }));
            return;
        }

        res.writeHead(404); res.end("Not found");
    });
    server.listen(PORT, () => {
        console.log(`🐝 Heady MCP Server v2.0.0 (SSE) — ${TOOLS.length} tools on port ${PORT}`);
    });
}
