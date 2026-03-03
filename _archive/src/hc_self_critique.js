/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 * Self-Critique & Optimization Engine — Records critiques and improvements for self-optimization.
 */
const { EventEmitter } = require("events");
const logger = require("./utils/logger");

class SelfCritiqueEngine extends EventEmitter {
    constructor() { super(); this._critiques = []; this._improvements = []; }

    recordCritique(critique) {
        const entry = { id: `crit-${Date.now()}`, ...critique, recordedAt: new Date().toISOString() };
        this._critiques.push(entry);
        if (this._critiques.length > 100) this._critiques.shift();
        this.emit("critique:recorded", entry);
        return entry;
    }

    recordImprovement(improvement) {
        const entry = { id: `imp-${Date.now()}`, ...improvement, recordedAt: new Date().toISOString() };
        this._improvements.push(entry);
        if (this._improvements.length > 100) this._improvements.shift();
        this.emit("improvement:recorded", entry);
        return entry;
    }

    getCritiques(limit = 10) { return this._critiques.slice(-limit); }
    getImprovements(limit = 10) { return this._improvements.slice(-limit); }
    getHealth() { return { ok: true, service: "self-critique", critiques: this._critiques.length, improvements: this._improvements.length }; }
}

const selfCritique = new SelfCritiqueEngine();

function registerSelfCritiqueRoutes(app, engine) {
    app.get("/api/self/health", (_req, res) => res.json(engine.getHealth()));
    app.get("/api/self/critiques", (req, res) => res.json({ ok: true, critiques: engine.getCritiques(parseInt(req.query.limit) || 10) }));
    app.get("/api/self/improvements", (req, res) => res.json({ ok: true, improvements: engine.getImprovements(parseInt(req.query.limit) || 10) }));
    app.get("/api/pricing/health", (_req, res) => res.json({ ok: true, service: "pricing", note: "Placeholder — pricing wired via self-critique" }));
}

module.exports = { SelfCritiqueEngine, selfCritique, registerSelfCritiqueRoutes };
