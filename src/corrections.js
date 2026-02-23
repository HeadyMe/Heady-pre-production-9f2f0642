/**
 * ─── HeadyCorrections — Behavior Analysis Engine ──────────────────
 * 3D vector-powered behavior analysis for the Heady ecosystem.
 * 
 * Core capabilities:
 *   1. Interaction pattern detection (tone, sentiment, conflict signals)
 *   2. Correction suggestions (response psychology, conflict avoidance)
 *   3. Learning from conversation history (vector-stored patterns)
 *   4. Audit trail for all corrections and behavioral insights
 *
 * Architecture:
 *   - Stores interaction patterns as vectors for similarity matching
 *   - Builds user preference models over time
 *   - Detects frustration/conflict signals and adjusts responses
 *   - Provides correction suggestions before responses are sent
 * ──────────────────────────────────────────────────────────────────
 */

const fs = require("fs");
const path = require("path");

const CORRECTIONS_LOG = path.join(__dirname, "..", "data", "corrections-audit.jsonl");
const BEHAVIOR_STORE = path.join(__dirname, "..", "data", "behavior-patterns.json");

// Behavioral signal patterns
const SIGNALS = {
    frustration: [
        /\bfuck\b/i, /\bshit\b/i, /\bdamn\b/i, /\bwtf\b/i,
        /\buseless\b/i, /\bstupid\b/i, /\bidiot\b/i,
        /not working/i, /broken/i, /wrong/i, /fix this/i,
        /stop\b.*\b(doing|asking|researching)/i,
        /how (many|long) (times|more)/i,
        /i (already|just) (said|told|asked)/i,
    ],
    urgency: [
        /\basap\b/i, /\bright now\b/i, /\bimmediately\b/i,
        /\bASAP\b/, /\bhurry\b/i, /\bquick(ly)?\b/i,
        /\bfull throttle\b/i, /\bmax(imum)?\s*(speed|velocity)\b/i,
    ],
    satisfaction: [
        /\bperfect\b/i, /\bgreat\b/i, /\bexcellent\b/i,
        /\bawesome\b/i, /\bamazing\b/i, /\blove it\b/i,
        /\bwell done\b/i, /\bnice\b/i, /\bgood job\b/i,
    ],
    confusion: [
        /\bwhat\?\b/i, /\bdon'?t understand\b/i, /\bconfused\b/i,
        /\bwhat do you mean\b/i, /\bhuh\b/i, /\b(makes? )?no sense\b/i,
    ],
    directive: [
        /\bdo\s+(this|that|it)\b/i, /\bjust\s+(do|make|build|fix)\b/i,
        /\bstop\s+(and|then)?\s*(do|make|build)\b/i,
        /\bi want\b/i, /\bi need\b/i, /\bmake (sure|it)\b/i,
    ],
};

// Response tone adjustments
const TONE_ADJUSTMENTS = {
    frustration: {
        approach: "direct_action",
        principles: [
            "Skip explanations, show results",
            "Acknowledge the issue briefly",
            "Take immediate action",
            "Don't ask clarifying questions",
            "Don't repeat what was already said",
        ],
    },
    urgency: {
        approach: "maximum_velocity",
        principles: [
            "Execute in parallel where possible",
            "Minimize research, maximize building",
            "Show progress constantly",
            "Batch related operations",
        ],
    },
    satisfaction: {
        approach: "maintain_momentum",
        principles: [
            "Continue current approach",
            "Suggest next improvements",
            "Build on the positive direction",
        ],
    },
    confusion: {
        approach: "clarify_concisely",
        principles: [
            "Provide concrete examples",
            "Use visual aids where possible",
            "Break complex ideas into steps",
            "Confirm understanding before proceeding",
        ],
    },
    directive: {
        approach: "execute_immediately",
        principles: [
            "Do exactly what was asked",
            "Don't propose alternatives unless critical",
            "Report completion, not plans",
        ],
    },
};

// In-memory behavior model
let behaviorModel = {
    interactionCount: 0,
    signalHistory: [],
    dominantTone: "neutral",
    preferences: {},
    lastUpdated: null,
};

// ── Initialize ──────────────────────────────────────────────────────
function init() {
    const dir = path.dirname(BEHAVIOR_STORE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    try {
        if (fs.existsSync(BEHAVIOR_STORE)) {
            behaviorModel = JSON.parse(fs.readFileSync(BEHAVIOR_STORE, "utf-8"));
            console.log(`  ∞ HeadyCorrections: Loaded behavior model (${behaviorModel.interactionCount} interactions)`);
        }
    } catch (err) {
        console.warn("  ⚠ HeadyCorrections: Starting fresh behavior model");
    }
}

// ── Analyze Input ───────────────────────────────────────────────────
function analyzeInput(text) {
    if (!text) return { signals: [], dominant: "neutral", intensity: 0 };

    const detected = [];
    for (const [signal, patterns] of Object.entries(SIGNALS)) {
        const matches = patterns.filter(p => p.test(text));
        if (matches.length > 0) {
            detected.push({ signal, matchCount: matches.length, intensity: matches.length / patterns.length });
        }
    }

    // Sort by intensity
    detected.sort((a, b) => b.intensity - a.intensity);
    const dominant = detected[0]?.signal || "neutral";
    const intensity = detected[0]?.intensity || 0;

    return { signals: detected, dominant, intensity };
}

// ── Get Correction Suggestion ───────────────────────────────────────
function getCorrectionSuggestion(inputAnalysis) {
    const { dominant, intensity, signals } = inputAnalysis;

    const adjustment = TONE_ADJUSTMENTS[dominant] || {
        approach: "balanced",
        principles: ["Be helpful and concise", "Show progress"],
    };

    return {
        approach: adjustment.approach,
        principles: adjustment.principles,
        dominant,
        intensity,
        signalCount: signals.length,
    };
}

// ── Record Interaction ──────────────────────────────────────────────
function recordInteraction(input, analysis, vectorMemory) {
    behaviorModel.interactionCount++;
    behaviorModel.signalHistory.push({
        dominant: analysis.dominant,
        intensity: analysis.intensity,
        ts: Date.now(),
    });

    // Keep only last 1000 signals
    if (behaviorModel.signalHistory.length > 1000) {
        behaviorModel.signalHistory = behaviorModel.signalHistory.slice(-1000);
    }

    // Update dominant tone (weighted recent)
    const recent = behaviorModel.signalHistory.slice(-20);
    const toneCounts = {};
    recent.forEach(s => { toneCounts[s.dominant] = (toneCounts[s.dominant] || 0) + 1; });
    behaviorModel.dominantTone = Object.entries(toneCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || "neutral";

    behaviorModel.lastUpdated = new Date().toISOString();

    // Persist
    try {
        fs.writeFileSync(BEHAVIOR_STORE, JSON.stringify(behaviorModel, null, 2));
    } catch { }

    // Audit trail
    const auditEntry = {
        type: "interaction",
        inputPreview: (input || "").substring(0, 100),
        analysis: { dominant: analysis.dominant, intensity: analysis.intensity },
        modelState: { total: behaviorModel.interactionCount, dominantTone: behaviorModel.dominantTone },
        ts: new Date().toISOString(),
    };
    try {
        fs.appendFileSync(CORRECTIONS_LOG, JSON.stringify(auditEntry) + "\n");
    } catch { }

    // Store in vector memory for pattern detection
    if (vectorMemory && typeof vectorMemory.ingestMemory === "function") {
        vectorMemory.ingestMemory({
            content: `Behavioral signal: ${analysis.dominant} (intensity ${analysis.intensity.toFixed(2)}) — "${(input || "").substring(0, 200)}"`,
            metadata: { type: "behavior_signal", signal: analysis.dominant, intensity: analysis.intensity },
        }).catch(() => { });
    }
}

// ── Get Model State ─────────────────────────────────────────────────
function getModelState() {
    return {
        interactionCount: behaviorModel.interactionCount,
        dominantTone: behaviorModel.dominantTone,
        recentSignals: behaviorModel.signalHistory.slice(-10),
        lastUpdated: behaviorModel.lastUpdated,
    };
}

// ── Express Routes ──────────────────────────────────────────────────
function registerRoutes(app) {
    app.post("/api/corrections/analyze", (req, res) => {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: "text required" });
        const analysis = analyzeInput(text);
        const suggestion = getCorrectionSuggestion(analysis);
        res.json({ ok: true, analysis, suggestion, model: getModelState() });
    });

    app.get("/api/corrections/model", (req, res) => {
        res.json({ ok: true, ...getModelState() });
    });

    app.get("/api/corrections/audit", (req, res) => {
        try {
            const lines = fs.readFileSync(CORRECTIONS_LOG, "utf-8").trim().split("\n").slice(-50);
            const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
            res.json({ ok: true, entries, total: entries.length });
        } catch {
            res.json({ ok: true, entries: [], total: 0 });
        }
    });
}

module.exports = { init, analyzeInput, getCorrectionSuggestion, recordInteraction, getModelState, registerRoutes };
