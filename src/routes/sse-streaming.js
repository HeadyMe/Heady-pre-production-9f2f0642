/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * SSE Text Streaming Engine — Extracted from heady-manager.js (HeadySupervisor Decomposition)
 * Handles: /api/stream/connect, /text, /file, /clients
 */
const fs = require("fs");

module.exports = function mountSSEStreaming(app) {
    const sseClients = new Set();

    app.get("/api/stream/connect", (req, res) => {
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "*",
        });
        res.write("data: {\"type\":\"connected\",\"ts\":\"" + new Date().toISOString() + "\"}\n\n");
        sseClients.add(res);
        req.on("close", () => sseClients.delete(res));
    });

    function sseBroadcast(eventType, payload) {
        const data = JSON.stringify({ type: eventType, ...payload, ts: new Date().toISOString() });
        for (const client of sseClients) {
            try { client.write(`data: ${data}\n\n`); } catch { sseClients.delete(client); }
        }
    }

    app.post("/api/stream/text", async (req, res) => {
        const { text, targetId, chunkSize = 3, delayMs = 30 } = req.body;
        if (!text) return res.status(400).json({ error: "text is required" });

        const chunks = [];
        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push(text.slice(i, i + chunkSize));
        }

        for (let i = 0; i < chunks.length; i++) {
            sseBroadcast("text_chunk", {
                targetId: targetId || "default", chunk: chunks[i],
                index: i, total: chunks.length, done: i === chunks.length - 1,
            });
            await new Promise((r) => setTimeout(r, delayMs));
        }

        res.json({ ok: true, chunksStreamed: chunks.length, targetId: targetId || "default" });
    });

    app.post("/api/stream/file", async (req, res) => {
        const { filePath, targetId, chunkSize = 80, delayMs = 15 } = req.body;
        if (!filePath) return res.status(400).json({ error: "filePath is required" });

        try {
            const content = fs.readFileSync(filePath, "utf8");
            const lines = content.split("\n");

            for (let i = 0; i < lines.length; i++) {
                sseBroadcast("text_line", {
                    targetId: targetId || "editor", line: lines[i],
                    lineNumber: i + 1, total: lines.length, done: i === lines.length - 1,
                });
                await new Promise((r) => setTimeout(r, delayMs));
            }

            res.json({ ok: true, linesStreamed: lines.length, filePath, targetId: targetId || "editor" });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.get("/api/stream/clients", (req, res) => {
        res.json({ ok: true, connectedClients: sseClients.size, ts: new Date().toISOString() });
    });

    // Expose sseBroadcast globally for other modules
    global.__sseBroadcast = sseBroadcast;

    require("../utils/logger").logSystem("  📡 SSE Text Streaming: LOADED (pillar module) → /api/stream/*");

    return { sseBroadcast, sseClients };
};
