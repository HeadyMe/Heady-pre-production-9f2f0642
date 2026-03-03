/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * ═══ Claude Routes ═══
 *
 * Cloud-only Anthropic Claude API routes for the Heady reasoning tier.
 * Proxies requests through HeadyJules node with cost tracking.
 *
 * Heady AI Nodes: JULES, CONDUCTOR
 */

const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");

const CLAUDE_API = "https://api.anthropic.com/v1/messages";
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

router.get("/health", (req, res) => {
    res.json({
        ok: true,
        service: "heady-claude",
        model: DEFAULT_MODEL,
        keyPresent: !!CLAUDE_KEY,
        ts: new Date().toISOString(),
    });
});

router.post("/chat", async (req, res) => {
    if (!CLAUDE_KEY) {
        return res.status(503).json({ ok: false, error: "ANTHROPIC_API_KEY not configured" });
    }

    const { message, system, model, max_tokens = 4096, temperature = 0.7 } = req.body;

    if (!message) {
        return res.status(400).json({ ok: false, error: "Missing 'message' field" });
    }

    try {
        const response = await fetch(CLAUDE_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": CLAUDE_KEY,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: model || DEFAULT_MODEL,
                max_tokens,
                ...(system ? { system } : {}),
                messages: [{ role: "user", content: message }],
            }),
            signal: AbortSignal.timeout(60000),
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ ok: false, error: data.error?.message || "Claude API error", type: data.error?.type });
        }

        const reply = data.content?.[0]?.text || "";
        const usage = data.usage || {};

        res.json({
            ok: true,
            reply,
            model: data.model,
            usage: {
                input_tokens: usage.input_tokens || 0,
                output_tokens: usage.output_tokens || 0,
            },
            stop_reason: data.stop_reason,
            ts: new Date().toISOString(),
        });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.post("/think", async (req, res) => {
    if (!CLAUDE_KEY) {
        return res.status(503).json({ ok: false, error: "ANTHROPIC_API_KEY not configured" });
    }

    const { message, thinking_budget = 32768 } = req.body;

    if (!message) {
        return res.status(400).json({ ok: false, error: "Missing 'message' field" });
    }

    try {
        const response = await fetch(CLAUDE_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": CLAUDE_KEY,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: DEFAULT_MODEL,
                max_tokens: thinking_budget + 4096,
                thinking: { type: "enabled", budget_tokens: thinking_budget },
                messages: [{ role: "user", content: message }],
            }),
            signal: AbortSignal.timeout(120000),
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ ok: false, error: data.error?.message || "Claude thinking error" });
        }

        const thinkingBlock = data.content?.find(b => b.type === "thinking");
        const textBlock = data.content?.find(b => b.type === "text");

        res.json({
            ok: true,
            thinking: thinkingBlock?.thinking || null,
            reply: textBlock?.text || "",
            model: data.model,
            usage: data.usage || {},
            ts: new Date().toISOString(),
        });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
