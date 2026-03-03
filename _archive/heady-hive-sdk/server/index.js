const express = require("express");
const HeadyGateway = require("../lib/gateway");
const { createProviders } = require("../lib/providers");

const app = express();
app.use(express.json({ limit: "1mb" }));

// ── Gateway Singleton ──
const gateway = new HeadyGateway({ cacheTTL: 300000 });
const providers = createProviders(process.env);
for (const p of providers) gateway.registerProvider(p);
console.log(`⚡ Gateway service: ${providers.length} providers [${providers.map(p => p.name).join(", ")}]`);

// ── Routes ──
app.get("/health", (req, res) => {
    res.json({ ok: true, service: "heady-gateway", providers: providers.length, stats: gateway.getStats() });
});

app.post("/chat", async (req, res) => {
    try {
        const { message, system, temperature, maxTokens, priority } = req.body;
        if (!message) return res.status(400).json({ ok: false, error: "message required" });
        const result = await gateway.chat(message, { system, temperature, maxTokens, priority });
        res.json(result);
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.post("/embed", async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ ok: false, error: "text required" });
        const result = await gateway.embed(text);
        res.json(result);
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.post("/decompose", async (req, res) => {
    try {
        const { task, system } = req.body;
        if (!task) return res.status(400).json({ ok: false, error: "task required" });
        const result = await gateway.decompose(task, { system });
        res.json(result);
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.get("/stats", (req, res) => {
    res.json({ ok: true, ...gateway.getStats() });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`⚡ Heady Gateway listening on :${PORT}`));
