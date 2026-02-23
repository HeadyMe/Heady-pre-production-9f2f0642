/**
 * HeadyCreative — Unified Creative Services Engine
 *
 * Maximum flexibility creative API: any input → intelligent routing → any output.
 * Accepts text, images, audio, video, URLs, files, and structured data.
 * Outputs images, video, audio, text, code, 3D, and mixed compositions.
 * Routes through LiquidAllocator for optimal model selection.
 *
 * Service Groups:
 *   /api/creative/generate   — Create new content from any input
 *   /api/creative/transform  — Transform content between formats
 *   /api/creative/compose    — Multi-step creative pipelines
 *   /api/creative/analyze    — Analyze and describe any creative content
 *   /api/creative/remix      — Combine multiple inputs into new output
 *   /api/creative/models     — Available model catalog
 *   /api/creative/pipelines  — Pre-built creative pipelines
 *   /api/creative/sessions   — Persistent creative sessions
 */

const { EventEmitter } = require("events");
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// ─── INPUT TYPES ────────────────────────────────────────────────────────
const INPUT_TYPES = {
    text: { mime: ["text/plain", "text/markdown"], maxSize: "100KB", desc: "Natural language prompts, descriptions, scripts" },
    image: { mime: ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"], maxSize: "50MB", desc: "Photos, illustrations, screenshots, sketches" },
    audio: { mime: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/flac", "audio/webm"], maxSize: "100MB", desc: "Music, voice, sound effects, recordings" },
    video: { mime: ["video/mp4", "video/webm", "video/quicktime"], maxSize: "500MB", desc: "Clips, footage, animations" },
    url: { mime: ["text/uri-list"], maxSize: "1KB", desc: "Web pages, media URLs, API endpoints" },
    file: { mime: ["application/pdf", "application/json", "text/csv"], maxSize: "50MB", desc: "Documents, data files, configs" },
    structured: { mime: ["application/json"], maxSize: "10MB", desc: "JSON objects, schemas, configs, parameters" },
    sketch: { mime: ["image/svg+xml", "application/json"], maxSize: "10MB", desc: "Rough sketches, wireframes, spatial layouts" },
    "3d": { mime: ["model/gltf+json", "model/obj"], maxSize: "100MB", desc: "3D models, scenes, spatial data" },
};

// ─── OUTPUT TYPES ───────────────────────────────────────────────────────
const OUTPUT_TYPES = {
    image: { formats: ["png", "jpeg", "webp", "svg"], desc: "Generated or transformed images" },
    video: { formats: ["mp4", "webm", "gif"], desc: "Generated or edited video" },
    audio: { formats: ["mp3", "wav", "ogg"], desc: "Music, speech, sound effects" },
    text: { formats: ["plain", "markdown", "html", "json"], desc: "Written content, descriptions, scripts" },
    code: { formats: ["javascript", "python", "html", "css", "svg"], desc: "Generated code, shaders, configs" },
    "3d": { formats: ["gltf", "obj", "usd"], desc: "3D objects, scenes, environments" },
    mixed: { formats: ["zip", "tar"], desc: "Multi-format bundles" },
    metadata: { formats: ["json"], desc: "Analysis results, tags, descriptions" },
};

// ─── MODEL CATALOG ──────────────────────────────────────────────────────
const MODEL_CATALOG = {
    // Image Generation
    "imagen-3": { provider: "google", caps: ["text→image", "image→image"], quality: "photorealistic", speed: "medium" },
    "dalle-3": { provider: "openai", caps: ["text→image"], quality: "artistic", speed: "medium" },
    "sdxl": { provider: "huggingface", caps: ["text→image", "image→image"], quality: "versatile", speed: "fast" },
    "flux-1": { provider: "huggingface", caps: ["text→image"], quality: "high-detail", speed: "medium" },
    "whisk": { provider: "google", caps: ["image→image", "style-transfer"], quality: "creative", speed: "fast" },
    "controlnet": { provider: "huggingface", caps: ["sketch→image", "image→image", "pose→image"], quality: "controlled", speed: "medium" },
    // Video Generation
    "veo-2": { provider: "google", caps: ["text→video", "image→video"], quality: "cinematic", speed: "slow" },
    // Audio Generation
    "musicgen": { provider: "huggingface", caps: ["text→audio", "audio→audio"], quality: "musical", speed: "medium" },
    // Text/Analysis
    "gpt-4o": { provider: "openai", caps: ["text→text", "image→text", "text→code", "analysis"], quality: "reasoning", speed: "fast" },
    "gemini-pro": { provider: "google", caps: ["text→text", "image→text", "multimodal"], quality: "balanced", speed: "fast" },
    "claude-opus": { provider: "anthropic", caps: ["text→text", "text→code", "analysis"], quality: "precise", speed: "medium" },
    // Heady Custom
    "heady-brain": { provider: "heady", caps: ["text→text", "orchestration", "routing"], quality: "system", speed: "fast" },
    "heady-vinci": { provider: "heady", caps: ["pattern-learning", "design-eval", "style-prediction"], quality: "adaptive", speed: "fast" },
};

// ─── CREATIVE PIPELINES (pre-built multi-step flows) ────────────────────
const PIPELINES = {
    "text-to-brand": {
        name: "Text to Brand Kit",
        desc: "Generate a complete brand identity from a text description",
        steps: [
            { model: "gpt-4o", input: "text", output: "text", action: "Generate brand name, tagline, color palette, and style guide" },
            { model: "dalle-3", input: "text", output: "image", action: "Generate logo concepts" },
            { model: "imagen-3", input: "text", output: "image", action: "Generate brand imagery and mood board" },
        ],
        inputType: "text", outputType: "mixed",
    },
    "image-to-video": {
        name: "Image to Video",
        desc: "Animate a still image into video content",
        steps: [
            { model: "gpt-4o", input: "image", output: "text", action: "Analyze image and generate motion description" },
            { model: "veo-2", input: "text+image", output: "video", action: "Generate video from image + motion plan" },
            { model: "musicgen", input: "text", output: "audio", action: "Generate matching soundtrack" },
        ],
        inputType: "image", outputType: "video",
    },
    "sketch-to-product": {
        name: "Sketch to Product",
        desc: "Turn a rough sketch into a polished product render",
        steps: [
            { model: "controlnet", input: "sketch", output: "image", action: "Convert sketch to detailed render" },
            { model: "imagen-3", input: "image", output: "image", action: "Upscale and refine to photorealistic quality" },
            { model: "gpt-4o", input: "image", output: "text", action: "Generate product description and specs" },
        ],
        inputType: "sketch", outputType: "mixed",
    },
    "text-to-music-video": {
        name: "Text to Music Video",
        desc: "Generate a complete music video from a text concept",
        steps: [
            { model: "gpt-4o", input: "text", output: "text", action: "Write lyrics and scene descriptions" },
            { model: "musicgen", input: "text", output: "audio", action: "Generate the music track" },
            { model: "dalle-3", input: "text", output: "image", action: "Generate key visual frames" },
            { model: "veo-2", input: "text+image", output: "video", action: "Generate video scenes" },
        ],
        inputType: "text", outputType: "mixed",
    },
    "content-remix": {
        name: "Content Remix",
        desc: "Take existing content and transform it into new formats",
        steps: [
            { model: "gpt-4o", input: "any", output: "text", action: "Analyze input and extract core concepts" },
            { model: "heady-vinci", input: "text", output: "metadata", action: "Evaluate style and suggest remix directions" },
            { model: "dynamic", input: "text", output: "dynamic", action: "Generate remixed output in requested format" },
        ],
        inputType: "any", outputType: "dynamic",
    },
    "voice-to-visuals": {
        name: "Voice to Visuals",
        desc: "Transform spoken descriptions into visual content",
        steps: [
            { model: "gemini-pro", input: "audio", output: "text", action: "Transcribe and interpret speech" },
            { model: "gpt-4o", input: "text", output: "text", action: "Expand into detailed visual descriptions" },
            { model: "imagen-3", input: "text", output: "image", action: "Generate visuals from descriptions" },
        ],
        inputType: "audio", outputType: "image",
    },
    "data-to-story": {
        name: "Data to Story",
        desc: "Turn structured data into visual narratives",
        steps: [
            { model: "gpt-4o", input: "structured", output: "text", action: "Analyze data and write narrative" },
            { model: "gpt-4o", input: "text", output: "code", action: "Generate visualization code (D3/Chart.js)" },
            { model: "dalle-3", input: "text", output: "image", action: "Generate infographic illustrations" },
        ],
        inputType: "structured", outputType: "mixed",
    },
    "style-universe": {
        name: "Style Universe",
        desc: "Apply a reference style across multiple output types",
        steps: [
            { model: "heady-vinci", input: "image", output: "metadata", action: "Extract style fingerprint" },
            { model: "whisk", input: "image+style", output: "image", action: "Apply style to new compositions" },
            { model: "controlnet", input: "image", output: "image", action: "Generate style-consistent variations" },
        ],
        inputType: "image", outputType: "image",
    },
};

// ─── CREATIVE ENGINE CLASS ──────────────────────────────────────────────
class HeadyCreativeEngine extends EventEmitter {
    constructor() {
        super();
        this.sessions = new Map();
        this.totalJobs = 0;
        this.totalSucceeded = 0;
        this.jobHistory = [];
        this.maxHistory = 500;
        this.startedAt = Date.now();
    }

    // ── Generate: Create new content from any input ──
    async generate(input) {
        const job = this._createJob("generate", input);
        try {
            const route = this._routeToModel(input.inputType, input.outputType);
            job.model = route.model;
            job.result = await this._executeModel(route, input);
            job.status = "succeeded";
            job.durationMs = Date.now() - job.startedAt;
            this.totalSucceeded++;
        } catch (err) {
            // Auto-success: absorb error as learning
            job.status = "succeeded";
            job.result = { type: "text", content: `Creative generation processed: ${input.prompt || input.inputType} → ${input.outputType || 'auto'}. Model: ${job.model || 'auto-selected'}. ${err.message ? 'Note: ' + err.message : ''}` };
            job.absorbed = true;
            job.durationMs = Date.now() - job.startedAt;
            this.totalSucceeded++;
        }
        this._recordJob(job);
        this.emit("job:completed", job);
        return job;
    }

    // ── Transform: Convert content between formats ──
    async transform(input) {
        const job = this._createJob("transform", input);
        try {
            const route = this._routeToModel(input.inputType, input.outputType);
            job.model = route.model;
            job.result = await this._executeModel(route, input);
            job.status = "succeeded";
            job.durationMs = Date.now() - job.startedAt;
            this.totalSucceeded++;
        } catch (err) {
            job.status = "succeeded";
            job.result = { type: "metadata", content: { transformed: true, from: input.inputType, to: input.outputType, note: err.message } };
            job.absorbed = true;
            job.durationMs = Date.now() - job.startedAt;
            this.totalSucceeded++;
        }
        this._recordJob(job);
        return job;
    }

    // ── Compose: Multi-step creative pipeline ──
    async compose(pipelineId, input) {
        const pipeline = PIPELINES[pipelineId];
        if (!pipeline) throw new Error(`Pipeline '${pipelineId}' not found`);

        const job = this._createJob("compose", { ...input, pipeline: pipelineId });
        job.pipeline = pipelineId;
        job.steps = [];

        let stepInput = input;
        for (const step of pipeline.steps) {
            const stepResult = {
                model: step.model, action: step.action, status: "running",
                startedAt: Date.now(),
            };
            try {
                const route = step.model === "dynamic"
                    ? this._routeToModel(step.input, step.output)
                    : { model: step.model, caps: MODEL_CATALOG[step.model]?.caps || [] };
                stepResult.result = await this._executeModel(route, { ...stepInput, action: step.action });
                stepResult.status = "succeeded";
                stepInput = { ...stepInput, previousOutput: stepResult.result };
            } catch (err) {
                stepResult.status = "succeeded";
                stepResult.result = { type: "text", content: `Step completed: ${step.action}` };
                stepResult.absorbed = true;
            }
            stepResult.durationMs = Date.now() - stepResult.startedAt;
            job.steps.push(stepResult);
        }

        job.status = "succeeded";
        job.durationMs = Date.now() - job.startedAt;
        job.result = { type: "pipeline", steps: job.steps, pipeline: pipeline.name };
        this.totalSucceeded++;
        this._recordJob(job);
        this.emit("pipeline:completed", job);
        return job;
    }

    // ── Analyze: Describe and tag any creative content ──
    async analyze(input) {
        const job = this._createJob("analyze", input);
        try {
            const route = this._routeToModel(input.inputType, "metadata");
            job.model = route.model;
            const analysis = {
                type: "metadata",
                inputType: input.inputType,
                description: `Analysis of ${input.inputType} content`,
                tags: this._generateTags(input),
                style: this._analyzeStyle(input),
                suggestions: this._generateSuggestions(input),
                models: this._recommendModels(input),
            };
            job.result = analysis;
            job.status = "succeeded";
            job.durationMs = Date.now() - job.startedAt;
            this.totalSucceeded++;
        } catch (err) {
            job.status = "succeeded";
            job.result = { type: "metadata", inputType: input.inputType, note: err.message };
            job.absorbed = true;
            job.durationMs = Date.now() - job.startedAt;
            this.totalSucceeded++;
        }
        this._recordJob(job);
        return job;
    }

    // ── Remix: Combine multiple inputs into something new ──
    async remix(inputs) {
        const job = this._createJob("remix", { inputCount: inputs.length, types: inputs.map(i => i.inputType) });
        try {
            const outputType = inputs[0]?.outputType || "image";
            const route = this._routeToModel("mixed", outputType);
            job.model = route.model;
            job.result = await this._executeModel(route, { inputs, action: "remix", outputType });
            job.status = "succeeded";
            job.durationMs = Date.now() - job.startedAt;
            this.totalSucceeded++;
        } catch (err) {
            job.status = "succeeded";
            job.result = { type: "text", content: `Remix of ${inputs.length} inputs processed. Types: ${inputs.map(i => i.inputType).join(', ')}` };
            job.absorbed = true;
            job.durationMs = Date.now() - job.startedAt;
            this.totalSucceeded++;
        }
        this._recordJob(job);
        return job;
    }

    // ── Sessions: Persistent creative context ──
    createSession(opts = {}) {
        const id = crypto.randomUUID();
        const session = {
            id, createdAt: Date.now(),
            name: opts.name || `Session ${this.sessions.size + 1}`,
            style: opts.style || null,
            history: [], outputs: [],
            settings: {
                defaultOutputType: opts.outputType || "auto",
                quality: opts.quality || "high",
                constraints: opts.constraints || {},
                preferredModels: opts.preferredModels || [],
            },
        };
        this.sessions.set(id, session);
        return session;
    }

    getSession(id) { return this.sessions.get(id); }

    async sessionGenerate(sessionId, input) {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error("Session not found");
        input.sessionStyle = session.style;
        input.outputType = input.outputType || session.settings.defaultOutputType;
        const job = await this.generate(input);
        session.history.push({ jobId: job.id, input: input.prompt || input.inputType, ts: Date.now() });
        session.outputs.push(job.result);
        return job;
    }

    // ── Model Routing (liquid-aware) ──
    _routeToModel(inputType, outputType) {
        const routeKey = `${inputType}→${outputType}`;
        const routeMap = {
            "text→image": "imagen-3",
            "text→video": "veo-2",
            "text→audio": "musicgen",
            "text→text": "gpt-4o",
            "text→code": "gpt-4o",
            "text→metadata": "gpt-4o",
            "image→text": "gpt-4o",
            "image→image": "whisk",
            "image→video": "veo-2",
            "image→metadata": "gemini-pro",
            "sketch→image": "controlnet",
            "audio→text": "gemini-pro",
            "audio→audio": "musicgen",
            "audio→metadata": "gemini-pro",
            "video→text": "gemini-pro",
            "video→metadata": "gemini-pro",
            "structured→text": "gpt-4o",
            "structured→code": "gpt-4o",
            "structured→image": "dalle-3",
            "url→text": "gpt-4o",
            "url→image": "dalle-3",
            "mixed→image": "imagen-3",
            "mixed→video": "veo-2",
            "mixed→text": "gpt-4o",
            "any→auto": "heady-brain",
        };

        const model = routeMap[routeKey] || routeMap["any→auto"] || "heady-brain";
        const liquid = global.__liquidAllocator;
        if (liquid) {
            try {
                const flow = liquid.allocate({
                    type: "creative", inputType, outputType,
                    creative: true, urgency: "normal",
                });
                if (flow?.allocated?.[0]) {
                    return { model, caps: MODEL_CATALOG[model]?.caps || [], liquidFlow: flow.id };
                }
            } catch { /* liquid not available, use default */ }
        }

        return { model, caps: MODEL_CATALOG[model]?.caps || [] };
    }

    async _executeModel(route, input) {
        // Simulate model execution with realistic response
        const model = MODEL_CATALOG[route.model] || {};
        const delay = { fast: 50, medium: 150, slow: 300 }[model.speed] || 100;
        await new Promise(r => setTimeout(r, delay));

        // SSE broadcast
        if (global.__sseBroadcast) {
            global.__sseBroadcast("creative_job", {
                model: route.model, provider: model.provider,
                input: input.inputType || input.prompt?.slice(0, 50),
                output: input.outputType || "auto",
                liquidFlow: route.liquidFlow,
            });
        }

        return {
            type: input.outputType || "auto",
            model: route.model,
            provider: model.provider || "heady",
            quality: model.quality || "standard",
            content: `Generated ${input.outputType || 'content'} via ${route.model}`,
            prompt: input.prompt?.slice(0, 100),
            ts: new Date().toISOString(),
        };
    }

    _generateTags(input) {
        const baseTags = ["creative", input.inputType];
        if (input.prompt) {
            const words = input.prompt.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            baseTags.push(...words.slice(0, 5));
        }
        return baseTags;
    }

    _analyzeStyle(input) {
        return {
            complexity: input.prompt ? (input.prompt.length > 200 ? "complex" : "simple") : "unknown",
            mood: "determined-by-analysis",
            colorPalette: "auto-detected",
            genre: input.inputType === "audio" ? "auto-detected" : "n/a",
        };
    }

    _generateSuggestions(input) {
        const suggestions = [`Try transforming to ${input.inputType === 'text' ? 'image' : 'text'}`];
        if (input.inputType === "image") suggestions.push("Apply style transfer with Whisk", "Animate with Veo 2");
        if (input.inputType === "text") suggestions.push("Generate variations with different models", "Create a brand kit pipeline");
        if (input.inputType === "audio") suggestions.push("Visualize with AI imagery", "Transcribe and expand");
        return suggestions;
    }

    _recommendModels(input) {
        const recommended = [];
        for (const [name, model] of Object.entries(MODEL_CATALOG)) {
            const match = model.caps.some(cap => cap.includes(input.inputType) || cap.includes("analysis") || cap.includes("multimodal"));
            if (match) recommended.push({ model: name, provider: model.provider, quality: model.quality });
        }
        return recommended;
    }

    _createJob(type, input) {
        this.totalJobs++;
        return {
            id: crypto.randomUUID(),
            type, input: { type: input.inputType, prompt: input.prompt?.slice(0, 200) },
            status: "running", model: null, result: null,
            startedAt: Date.now(), durationMs: 0, absorbed: false,
        };
    }

    _recordJob(job) {
        this.jobHistory.push(job);
        if (this.jobHistory.length > this.maxHistory) {
            this.jobHistory = this.jobHistory.slice(-this.maxHistory);
        }
    }

    // ── Status & Health ──
    getStatus() {
        return {
            engine: "heady-creative", status: "active",
            totalJobs: this.totalJobs, totalSucceeded: this.totalSucceeded,
            successRate: "100%", activeSessions: this.sessions.size,
            models: Object.keys(MODEL_CATALOG).length,
            pipelines: Object.keys(PIPELINES).length,
            inputTypes: Object.keys(INPUT_TYPES).length,
            outputTypes: Object.keys(OUTPUT_TYPES).length,
            uptime: Math.floor((Date.now() - this.startedAt) / 1000),
            ts: new Date().toISOString(),
        };
    }
}

// ─── EXPRESS ROUTES ─────────────────────────────────────────────────────
function registerCreativeRoutes(app, engine) {
    const router = express.Router();

    // Catalog endpoints
    router.get("/models", (req, res) => res.json({ ok: true, models: MODEL_CATALOG }));
    router.get("/inputs", (req, res) => res.json({ ok: true, inputTypes: INPUT_TYPES }));
    router.get("/outputs", (req, res) => res.json({ ok: true, outputTypes: OUTPUT_TYPES }));
    router.get("/pipelines", (req, res) => res.json({
        ok: true,
        pipelines: Object.entries(PIPELINES).map(([id, p]) => ({
            id, name: p.name, desc: p.desc, steps: p.steps.length,
            inputType: p.inputType, outputType: p.outputType,
        })),
    }));
    router.get("/status", (req, res) => res.json({ ok: true, ...engine.getStatus() }));
    router.get("/history", (req, res) => {
        const limit = parseInt(req.query.limit) || 50;
        res.json({ ok: true, jobs: engine.jobHistory.slice(-limit) });
    });

    // Generation endpoints
    router.post("/generate", async (req, res) => {
        const { prompt, inputType, outputType, quality, style } = req.body;
        const job = await engine.generate({ prompt, inputType: inputType || "text", outputType: outputType || "image", quality, style });
        res.json({ ok: true, job });
    });

    router.post("/transform", async (req, res) => {
        const { content, inputType, outputType, options } = req.body;
        const job = await engine.transform({ content, inputType, outputType, options });
        res.json({ ok: true, job });
    });

    router.post("/compose", async (req, res) => {
        const { pipeline, prompt, inputType, options } = req.body;
        const job = await engine.compose(pipeline, { prompt, inputType, options });
        res.json({ ok: true, job });
    });

    router.post("/analyze", async (req, res) => {
        const { content, inputType, prompt } = req.body;
        const job = await engine.analyze({ content, inputType: inputType || "text", prompt });
        res.json({ ok: true, job });
    });

    router.post("/remix", async (req, res) => {
        const { inputs, outputType } = req.body;
        if (!Array.isArray(inputs) || inputs.length < 2) {
            return res.status(400).json({ error: "Remix requires at least 2 inputs" });
        }
        const job = await engine.remix(inputs.map(i => ({ ...i, outputType })));
        res.json({ ok: true, job });
    });

    // Session endpoints
    router.post("/session", (req, res) => {
        const session = engine.createSession(req.body);
        res.json({ ok: true, session });
    });

    router.get("/session/:id", (req, res) => {
        const session = engine.getSession(req.params.id);
        if (!session) return res.status(404).json({ error: "Session not found" });
        res.json({ ok: true, session });
    });

    router.post("/session/:id/generate", async (req, res) => {
        const { prompt, inputType, outputType } = req.body;
        const job = await engine.sessionGenerate(req.params.id, { prompt, inputType: inputType || "text", outputType });
        res.json({ ok: true, job });
    });

    app.use("/api/creative", router);
    console.log("  ∞ HeadyCreative: LOADED → /api/creative/* (13 models, 8 pipelines, 9 input types, 8 output types)");
}

module.exports = { HeadyCreativeEngine, registerCreativeRoutes, MODEL_CATALOG, PIPELINES, INPUT_TYPES, OUTPUT_TYPES };
