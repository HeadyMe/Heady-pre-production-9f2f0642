/**
 * Google Cloud Bridge — Vision, NLP, Translation, TTS, BigQuery
 * Uses REST APIs directly (no Google SDK dependency).
 */

const https = require("https");

class GCloudBridge {
    constructor(opts = {}) {
        this.projectId = opts.projectId || process.env.GCLOUD_PROJECT_ID || "";
        this.apiKey = opts.apiKey || process.env.GCLOUD_API_KEY || "";
        this._token = opts.accessToken || process.env.GCLOUD_ACCESS_TOKEN || "";
    }

    /** Raw Google API request */
    _req(hostname, path, body, opts = {}) {
        return new Promise((resolve, reject) => {
            const payload = body ? JSON.stringify(body) : null;
            const method = payload ? "POST" : "GET";
            const headers = {
                "Content-Type": "application/json",
                ...(this._token ? { Authorization: `Bearer ${this._token}` } : {}),
                ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
            };
            const url = this.apiKey ? `${path}?key=${this.apiKey}` : path;
            const reqOpts = { hostname, path: url, method, headers, timeout: 30000 };
            const req = https.request(reqOpts, (res) => {
                let data = "";
                res.on("data", (c) => (data += c));
                res.on("end", () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (res.statusCode >= 400) reject(new Error(`GCloud ${res.statusCode}: ${parsed.error?.message || data.substring(0, 200)}`));
                        else resolve(parsed);
                    } catch { reject(new Error(`Parse: ${data.substring(0, 200)}`)); }
                });
            });
            req.on("error", reject);
            req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
            if (payload) req.write(payload);
            req.end();
        });
    }

    // ─── Cloud Vision API ───────────────────────────────────────────

    /** Analyze an image (labels, text, objects, faces) */
    async vision(imageBase64, features = ["LABEL_DETECTION"]) {
        return this._req("vision.googleapis.com", "/v1/images:annotate", {
            requests: [{
                image: { content: imageBase64 },
                features: features.map(f => ({ type: f, maxResults: 10 })),
            }],
        });
    }

    /** OCR — extract text from image */
    async ocr(imageBase64) {
        return this.vision(imageBase64, ["TEXT_DETECTION"]);
    }

    // ─── Cloud Natural Language API ─────────────────────────────────

    /** Analyze sentiment */
    async sentiment(text) {
        return this._req("language.googleapis.com", "/v1/documents:analyzeSentiment", {
            document: { type: "PLAIN_TEXT", content: text }, encodingType: "UTF8",
        });
    }

    /** Extract entities */
    async entities(text) {
        return this._req("language.googleapis.com", "/v1/documents:analyzeEntities", {
            document: { type: "PLAIN_TEXT", content: text }, encodingType: "UTF8",
        });
    }

    /** Classify content */
    async classify(text) {
        return this._req("language.googleapis.com", "/v1/documents:classifyText", {
            document: { type: "PLAIN_TEXT", content: text },
        });
    }

    // ─── Cloud Translation ──────────────────────────────────────────

    /** Translate text */
    async translate(text, target = "en", source = "") {
        return this._req("translation.googleapis.com", "/language/translate/v2", {
            q: text, target, ...(source ? { source } : {}), format: "text",
        });
    }

    /** Detect language */
    async detectLanguage(text) {
        return this._req("translation.googleapis.com", "/language/translate/v2/detect", {
            q: text,
        });
    }

    // ─── Cloud Text-to-Speech ───────────────────────────────────────

    /** Synthesize speech */
    async tts(text, opts = {}) {
        return this._req("texttospeech.googleapis.com", "/v1/text:synthesize", {
            input: { text },
            voice: {
                languageCode: opts.language || "en-US",
                name: opts.voice || "en-US-Neural2-J",
                ssmlGender: opts.gender || "NEUTRAL",
            },
            audioConfig: { audioEncoding: opts.encoding || "MP3" },
        });
    }

    // ─── BigQuery ───────────────────────────────────────────────────

    /** Run a BigQuery SQL query */
    async query(sql, opts = {}) {
        return this._req("bigquery.googleapis.com",
            `/bigquery/v2/projects/${this.projectId}/queries`, {
            query: sql, useLegacySql: false,
            maxResults: opts.maxResults || 100,
        });
    }

    // ─── Vertex AI ──────────────────────────────────────────────────

    /** Vertex AI prediction */
    async predict(endpointId, instances, opts = {}) {
        return this._req("us-central1-aiplatform.googleapis.com",
            `/v1/projects/${this.projectId}/locations/us-central1/endpoints/${endpointId}:predict`, {
            instances, parameters: opts.parameters || {},
        });
    }

    /** Health check */
    async health() {
        const checks = {};
        try { await this.sentiment("health check"); checks.nlp = true; } catch { checks.nlp = false; }
        return { healthy: Object.values(checks).some(Boolean), services: checks };
    }
}

module.exports = GCloudBridge;
