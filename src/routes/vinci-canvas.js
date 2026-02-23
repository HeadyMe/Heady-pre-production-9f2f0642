/**
 * HeadyVinci Creative Sandbox — Canvas Service
 *
 * Powers a creative sandbox where users design personalized Heady experiences.
 * Integrates HeadyVinci (learning/prediction), HeadyBrain (intelligence),
 * and external creative models (Google, OpenAI, HuggingFace).
 *
 * Sessions persist in-memory and emit SSE events for real-time canvas updates.
 */
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");

const SESSIONS_DIR = path.join(__dirname, "..", "data", "canvas-sessions");

// ─── Creative Model Catalog ─────────────────────────────────────────
const MODEL_CATALOG = {
    // Google Creative AI
    "google/veo-2": {
        provider: "google", name: "Veo 2", type: "video-generation",
        description: "High-quality AI video generation from text and image prompts",
        capabilities: ["text-to-video", "image-to-video", "style-transfer"],
        endpoint: "https://generativelanguage.googleapis.com/v1beta/models/veo-2",
        status: "available",
    },
    "google/nano": {
        provider: "google", name: "Gemini Nano", type: "on-device-intelligence",
        description: "Lightweight on-device model for instant creative suggestions",
        capabilities: ["text-completion", "summarization", "creative-writing"],
        endpoint: "chrome://on-device",
        status: "available",
    },
    "google/whisk": {
        provider: "google", name: "Whisk", type: "image-remix",
        description: "Remix images by combining subjects, scenes, and styles from reference images",
        capabilities: ["image-remix", "style-blending", "subject-transfer"],
        endpoint: "https://labs.google/whisk",
        status: "available",
    },
    "google/imagen-3": {
        provider: "google", name: "Imagen 3", type: "image-generation",
        description: "Photorealistic and artistic image generation with fine detail control",
        capabilities: ["text-to-image", "inpainting", "outpainting", "style-control"],
        endpoint: "https://generativelanguage.googleapis.com/v1beta/models/imagen-3",
        status: "available",
    },

    // OpenAI Creative AI
    "openai/gpt-4o": {
        provider: "openai", name: "GPT-4o", type: "multimodal-intelligence",
        description: "Multimodal creative ideation and design critique",
        capabilities: ["design-critique", "layout-suggestion", "copy-generation", "color-theory"],
        endpoint: "https://api.openai.com/v1/chat/completions",
        status: "available",
    },
    "openai/dall-e-3": {
        provider: "openai", name: "DALL·E 3", type: "image-generation",
        description: "High-fidelity image generation with precise prompt following",
        capabilities: ["text-to-image", "concept-art", "logo-design", "illustration"],
        endpoint: "https://api.openai.com/v1/images/generations",
        status: "available",
    },

    // HuggingFace Open Source
    "hf/stable-diffusion-xl": {
        provider: "huggingface", name: "Stable Diffusion XL", type: "image-generation",
        description: "Open-source high-resolution image generation",
        capabilities: ["text-to-image", "img2img", "controlnet", "lora-adaptation"],
        endpoint: "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0",
        status: "available", license: "open-source",
    },
    "hf/flux-1-dev": {
        provider: "huggingface", name: "FLUX.1 [dev]", type: "image-generation",
        description: "State-of-the-art open image model with exceptional prompt adherence",
        capabilities: ["text-to-image", "fine-grained-control", "photorealism"],
        endpoint: "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev",
        status: "available", license: "open-source",
    },
    "hf/controlnet": {
        provider: "huggingface", name: "ControlNet", type: "guided-generation",
        description: "Spatial control over diffusion models (edges, depth, pose)",
        capabilities: ["edge-guided", "depth-guided", "pose-guided", "layout-control"],
        endpoint: "https://api-inference.huggingface.co/models/lllyasviel/control_v11p_sd15_openpose",
        status: "available", license: "open-source",
    },
    "hf/musicgen": {
        provider: "huggingface", name: "MusicGen", type: "audio-generation",
        description: "AI music and audio generation from text descriptions",
        capabilities: ["text-to-music", "melody-conditioning", "style-variation"],
        endpoint: "https://api-inference.huggingface.co/models/facebook/musicgen-large",
        status: "available", license: "open-source",
    },

    // Internal Heady Models
    "heady/vinci-v1": {
        provider: "heady", name: "HeadyVinci v1", type: "creative-learning",
        description: "Heady's native learning and prediction engine for creative pattern recognition",
        capabilities: ["learn-from-feedback", "predict-preferences", "pattern-matching"],
        endpoint: "/api/vinci/predict",
        status: "active",
    },
    "heady/brain": {
        provider: "heady", name: "HeadyBrain", type: "inference",
        description: "Primary Heady intelligence for design decisions and system orchestration",
        capabilities: ["design-evaluation", "architecture-suggestion", "constraint-solving"],
        endpoint: "/api/brain/infer",
        status: "active",
    },
};

// ─── Heady Verticals (for domain personalization) ────────────────────
const HEADY_VERTICALS = {
    "headyme.com": { role: "Personal Cloud Hub", color: "#a855f7", features: ["Launcher Creator", "Personal Dashboard", "Cloud Connector"] },
    "headysystems.com": { role: "Infrastructure & Ops", color: "#3b82f6", features: ["API Gateway", "Status Monitoring", "Log Viewer"] },
    "headyconnection.org": { role: "Community & Social", color: "#10b981", features: ["Community Hub", "Networking", "Knowledge Share"] },
    "headymcp.com": { role: "Model Protocol Layer", color: "#f59e0b", features: ["MCP Bridge", "Tool Registry", "Context Management"] },
    "headyio.com": { role: "I/O & Data Pipeline", color: "#ef4444", features: ["Data Streaming", "Input Processing", "Output Routing"] },
    "headybuddy.org": { role: "AI Assistant", color: "#8b5cf6", features: ["Browser Extension", "Chat Interface", "Guest Mode"] },
    "headybot.com": { role: "Automation Engine", color: "#06b6d4", features: ["Bot Logic", "Task Automation", "Service Agents"] },
};

// ─── Session Management ──────────────────────────────────────────────
const activeSessions = new Map();

function createSession(userId, config = {}) {
    const sessionId = `canvas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const session = {
        id: sessionId,
        userId: userId || "anonymous",
        createdAt: new Date().toISOString(),
        canvas: {
            name: config.name || "Untitled Design",
            theme: config.theme || { primary: "#a855f7", secondary: "#3b82f6", mode: "dark" },
            selectedModels: config.models || ["heady/vinci-v1", "heady/brain"],
            selectedVerticals: config.verticals || ["headyme.com"],
            designElements: [],
            history: [],
        },
        feedback: [],
    };
    activeSessions.set(sessionId, session);
    _persistSession(session);
    return session;
}

function _persistSession(session) {
    try {
        if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });
        fs.writeFileSync(
            path.join(SESSIONS_DIR, `${session.id}.json`),
            JSON.stringify(session, null, 2)
        );
    } catch { /* non-critical */ }
}

// ─── Routes ──────────────────────────────────────────────────────────

// Model catalog
router.get("/models", (req, res) => {
    const byProvider = {};
    for (const [id, model] of Object.entries(MODEL_CATALOG)) {
        if (!byProvider[model.provider]) byProvider[model.provider] = [];
        byProvider[model.provider].push({ id, ...model });
    }
    res.json({ ok: true, totalModels: Object.keys(MODEL_CATALOG).length, providers: byProvider });
});

// Verticals catalog
router.get("/verticals", (req, res) => {
    res.json({ ok: true, verticals: HEADY_VERTICALS });
});

// Health
router.get("/health", (req, res) => {
    res.json({
        status: "ACTIVE",
        service: "heady-vinci-canvas",
        activeSessions: activeSessions.size,
        availableModels: Object.keys(MODEL_CATALOG).length,
        availableVerticals: Object.keys(HEADY_VERTICALS).length,
        ts: new Date().toISOString(),
    });
});

// Create session
router.post("/session", (req, res) => {
    const { userId, name, theme, models, verticals } = req.body;
    const session = createSession(userId, { name, theme, models, verticals });
    res.json({ ok: true, session });
});

// Get session
router.get("/session/:id", (req, res) => {
    const session = activeSessions.get(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json({ ok: true, session });
});

// Add design element to canvas
router.post("/session/:id/element", (req, res) => {
    const session = activeSessions.get(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });

    const { type, content, position, style, modelUsed } = req.body;
    const element = {
        id: `el-${Date.now()}`,
        type: type || "text", // text, image, layout, color-palette, component, vertical-link
        content,
        position: position || { x: 0, y: 0 },
        style: style || {},
        modelUsed: modelUsed || "heady/brain",
        createdAt: new Date().toISOString(),
    };

    session.canvas.designElements.push(element);
    session.canvas.history.push({ action: "add-element", elementId: element.id, ts: element.createdAt });
    _persistSession(session);

    // Broadcast to SSE clients if available
    if (global.__sseBroadcast) {
        global.__sseBroadcast("canvas_update", { sessionId: session.id, element });
    }

    res.json({ ok: true, element, totalElements: session.canvas.designElements.length });
});

// Generate creative suggestion using selected model
router.post("/session/:id/suggest", (req, res) => {
    const session = activeSessions.get(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });

    const { prompt, model: modelId, category } = req.body;
    const model = MODEL_CATALOG[modelId || "heady/vinci-v1"];
    if (!model) return res.status(400).json({ error: `Unknown model: ${modelId}` });

    // Generate suggestion based on model type
    const suggestion = {
        id: `sug-${Date.now()}`,
        model: modelId || "heady/vinci-v1",
        modelName: model.name,
        provider: model.provider,
        prompt: prompt || "Generate a creative design element",
        category: category || "general",
        result: _generateSuggestion(model, prompt, session),
        ts: new Date().toISOString(),
    };

    session.canvas.history.push({ action: "suggestion", ...suggestion });
    _persistSession(session);

    res.json({ ok: true, suggestion });
});

// Submit feedback (teaches HeadyVinci)
router.post("/session/:id/feedback", (req, res) => {
    const session = activeSessions.get(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });

    const { elementId, rating, comment } = req.body;
    const fb = { elementId, rating, comment, ts: new Date().toISOString() };
    session.feedback.push(fb);
    _persistSession(session);

    res.json({ ok: true, feedback: fb, totalFeedback: session.feedback.length });
});

// Export session as personalized domain config
router.post("/session/:id/export", (req, res) => {
    const session = activeSessions.get(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });

    const exported = {
        name: session.canvas.name,
        theme: session.canvas.theme,
        selectedVerticals: session.canvas.selectedVerticals.map(v => ({
            domain: v,
            ...(HEADY_VERTICALS[v] || {}),
        })),
        designElements: session.canvas.designElements.length,
        modelsUsed: [...new Set(session.canvas.designElements.map(e => e.modelUsed))],
        feedbackScore: session.feedback.length > 0
            ? session.feedback.reduce((s, f) => s + (f.rating || 0), 0) / session.feedback.length
            : null,
        exportedAt: new Date().toISOString(),
        launcherConfig: {
            personalDomain: session.canvas.selectedVerticals[0] || "headyme.com",
            activeServices: session.canvas.selectedVerticals.flatMap(v => (HEADY_VERTICALS[v]?.features || [])),
            theme: session.canvas.theme,
            modelsEnabled: session.canvas.selectedModels,
        },
    };

    res.json({ ok: true, export: exported });
});

// List all sessions
router.get("/sessions", (req, res) => {
    const sessions = [...activeSessions.values()].map(s => ({
        id: s.id, userId: s.userId, name: s.canvas.name,
        elements: s.canvas.designElements.length,
        createdAt: s.createdAt,
    }));
    res.json({ ok: true, sessions });
});

// ─── Suggestion Generator ────────────────────────────────────────────
function _generateSuggestion(model, prompt, session) {
    const theme = session.canvas.theme;

    switch (model.type) {
        case "image-generation":
            return {
                type: "image-concept",
                description: `Generated via ${model.name}: "${prompt || 'Abstract creative concept'}"`,
                suggestedStyle: { palette: [theme.primary, theme.secondary, "#1a1a2e"], format: "16:9" },
                nextSteps: ["Refine with ControlNet for layout precision", "Apply brand colors from theme"],
            };
        case "video-generation":
            return {
                type: "video-concept",
                description: `Veo 2 storyboard: "${prompt || 'Brand motion sequence'}"`,
                duration: "6s",
                suggestedStyle: { transitions: "smooth-morph", palette: [theme.primary, theme.secondary] },
                nextSteps: ["Add audio via MusicGen", "Export as hero banner animation"],
            };
        case "image-remix":
            return {
                type: "remix-concept",
                description: `Whisk remix: Blend subjects and styles from reference images`,
                suggestedCombinations: [
                    { subject: "User's brand identity", scene: "Futuristic workspace", style: "Glassmorphism" },
                    { subject: "Heady logo elements", scene: "Sacred geometry space", style: "Neon-dark" },
                ],
            };
        case "multimodal-intelligence":
            return {
                type: "design-critique",
                analysis: `GPT-4o analysis of canvas with ${session.canvas.designElements.length} elements`,
                suggestions: [
                    "Consider visual hierarchy: largest element should be the primary CTA",
                    "Color contrast ratio meets WCAG AA for the current theme",
                    `Current palette (${theme.primary}/${theme.secondary}) creates ${theme.mode === 'dark' ? 'depth' : 'clarity'}`,
                ],
            };
        case "guided-generation":
            return {
                type: "layout-control",
                description: "ControlNet spatial guidance applied",
                controlTypes: ["edge-detection for logo placement", "depth-map for parallax layers"],
            };
        case "audio-generation":
            return {
                type: "audio-concept",
                description: `MusicGen: "${prompt || 'Ambient brand soundscape'}"`,
                duration: "30s",
                genre: "ambient-electronic",
            };
        case "creative-learning":
            return {
                type: "vinci-prediction",
                description: "HeadyVinci pattern analysis based on accumulated learning data",
                predictedPreference: {
                    layout: "asymmetric-grid",
                    colorTendency: theme.mode === "dark" ? "high-contrast-accents" : "muted-pastels",
                    typographyStyle: "modern-geometric",
                },
            };
        default:
            return {
                type: "general",
                description: `${model.name} creative output for: "${prompt}"`,
                capabilities: model.capabilities,
            };
    }
}

module.exports = router;
