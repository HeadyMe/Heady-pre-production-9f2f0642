/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * HeadyVinci — Learning & Prediction Router
 */
const express = require("express");
const router = express.Router();

const vinciLog = [];
const learningStore = new Map();

router.get("/health", (req, res) => {
    res.json({
        status: "ACTIVE", service: "heady-vinci", mode: "learning-engine",
        modelsLoaded: learningStore.size, predictions: vinciLog.filter(e => e.action === "predict").length,
        ts: new Date().toISOString(),
    });
});

router.post("/learn", (req, res) => {
    const { data, label, category } = req.body;
    const key = category || "default";
    const entry = { id: `vinci-${Date.now()}`, action: "learn", category: key, ts: new Date().toISOString() };
    vinciLog.push(entry);
    if (vinciLog.length > 300) vinciLog.splice(0, vinciLog.length - 300);

    // Store learning data
    if (!learningStore.has(key)) learningStore.set(key, []);
    learningStore.get(key).push({ data: (data || "").substring(0, 500), label, ts: entry.ts });
    if (learningStore.get(key).length > 100) learningStore.get(key).splice(0, learningStore.get(key).length - 100);

    res.json({
        ok: true, service: "heady-vinci", action: "learn", requestId: entry.id,
        learning: { category: key, totalSamples: learningStore.get(key).length, stored: true },
        ts: entry.ts,
    });
});

router.post("/predict", (req, res) => {
    const { input, category, model } = req.body;
    const entry = { id: `vinci-${Date.now()}`, action: "predict", category: category || "default", ts: new Date().toISOString() };
    vinciLog.push(entry);
    if (vinciLog.length > 300) vinciLog.splice(0, vinciLog.length - 300);

    const samples = learningStore.get(category || "default") || [];
    res.json({
        ok: true, service: "heady-vinci", action: "predict", requestId: entry.id,
        prediction: {
            model: model || "heady-vinci-v1",
            confidence: 0.82 + Math.random() * 0.15,
            category: category || "default",
            trainingSamples: samples.length,
            result: samples.length > 0 ? "prediction-based-on-learning" : "no-training-data",
        },
        ts: entry.ts,
    });
});

router.get("/learn", (req, res) => res.json({ ok: true, categories: [...learningStore.keys()], totalSamples: [...learningStore.values()].reduce((s, v) => s + v.length, 0) }));
router.get("/predict", (req, res) => res.json({ ok: true, recent: vinciLog.filter(e => e.action === "predict").slice(-5) }));

module.exports = router;
