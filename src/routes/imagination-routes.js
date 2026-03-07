/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  🌈 IMAGINATION ENGINE — Creative Intelligence Routes       ║
 * ║  ∞ Sacred Geometry · Generative Concepts · IP Packaging     ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
const express = require('../core/heady-server');
const router = express.Router();
const logger = require("../utils/logger");

// ─── In-Memory Concept Store ────────────────────────────────────────
const conceptStore = {
    primitives: [],
    concepts: [],
    hotConcepts: [],
    ipPackages: [],
};

// ─── Primitives — Atomic Creative Building Blocks ───────────────────
router.get("/primitives", (_req, res) => {
    res.json({
        ok: true,
        primitives: conceptStore.primitives.length > 0
            ? conceptStore.primitives
            : [
                { id: "phi-spiral", type: "geometry", description: "Golden ratio spiral pattern" },
                { id: "wave-collapse", type: "quantum", description: "Superposition collapse into creative output" },
                { id: "fractal-branch", type: "organic", description: "Self-similar branching structure" },
                { id: "breath-cycle", type: "rhythm", description: "Inhale-hold-exhale creative cadence" },
            ],
        ts: new Date().toISOString(),
    });
});

// ─── Concepts — Higher-Order Creative Structures ────────────────────
router.get("/concepts", (_req, res) => {
    res.json({
        ok: true,
        count: conceptStore.concepts.length,
        concepts: conceptStore.concepts,
        ts: new Date().toISOString(),
    });
});

router.post("/concepts", express.json(), (req, res) => {
    const { name, description, primitives = [], tags = [] } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    const concept = {
        id: `concept-${Date.now()}`,
        name,
        description: description || "",
        primitives,
        tags,
        score: 0,
        createdAt: new Date().toISOString(),
    };
    conceptStore.concepts.push(concept);
    logger.logNodeActivity("CONDUCTOR", `  ∞ Imagination: New concept "${name}" registered`);
    res.status(201).json({ ok: true, concept });
});

// ─── Imagine — Generative Endpoint ──────────────────────────────────
router.post("/imagine", express.json(), async (req, res) => {
    const { prompt, mode = "freeform", constraints = {} } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt is required" });

    const result = {
        id: `imag-${Date.now()}`,
        prompt,
        mode,
        output: {
            text: `[Imagination Engine] Creative synthesis for: "${prompt}"`,
            primitives_used: ["phi-spiral", "breath-cycle"],
            confidence: 0.85,
            novelty_score: Math.random() * 0.4 + 0.6,
        },
        constraints,
        ts: new Date().toISOString(),
    };

    // Track as hot concept if novelty is high
    if (result.output.novelty_score > 0.8) {
        conceptStore.hotConcepts.push({
            id: result.id,
            prompt,
            novelty: result.output.novelty_score,
            ts: result.ts,
        });
    }

    res.json({ ok: true, result });
});

// ─── Hot Concepts — Trending Creative Ideas ─────────────────────────
router.get("/hot-concepts", (_req, res) => {
    const sorted = [...conceptStore.hotConcepts]
        .sort((a, b) => b.novelty - a.novelty)
        .slice(0, 20);
    res.json({ ok: true, count: sorted.length, hotConcepts: sorted });
});

// ─── Top Concepts — Highest Scored ──────────────────────────────────
router.get("/top-concepts", (_req, res) => {
    const sorted = [...conceptStore.concepts]
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
    res.json({ ok: true, count: sorted.length, topConcepts: sorted });
});

// ─── IP Packages — Bundled Creative Output ──────────────────────────
router.get("/ip-packages", (_req, res) => {
    res.json({
        ok: true,
        count: conceptStore.ipPackages.length,
        packages: conceptStore.ipPackages,
    });
});

router.post("/ip-packages", express.json(), (req, res) => {
    const { name, concepts = [], license = "proprietary" } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    const pkg = {
        id: `ip-${Date.now()}`,
        name,
        concepts,
        license,
        createdAt: new Date().toISOString(),
    };
    conceptStore.ipPackages.push(pkg);
    logger.logNodeActivity("CONDUCTOR", `  ∞ Imagination: IP Package "${name}" created (${concepts.length} concepts)`);
    res.status(201).json({ ok: true, package: pkg });
});

module.exports = router;
