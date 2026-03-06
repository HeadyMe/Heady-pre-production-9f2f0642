/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 * HCStoryDriver — Narrative engine that ingests system events and builds operational "stories".
 */
const logger = require("./utils/logger");

class HCStoryDriver {
    constructor() { this._events = []; this._stories = []; this._maxEvents = 200; }

    ingestSystemEvent(event) {
        const entry = { ...event, ingestedAt: new Date().toISOString(), id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` };
        this._events.push(entry);
        if (this._events.length > this._maxEvents) this._events.shift();

        // Auto-generate story fragments from significant events
        if (event.type?.includes("CRITICAL") || event.type?.includes("BURST") || event.type?.includes("CONVERGED")) {
            this._stories.push({ title: `${event.type} from ${event.source || "system"}`, event: entry, createdAt: new Date().toISOString() });
            if (this._stories.length > 50) this._stories.shift();
        }
    }

    getRecentStories(limit = 10) { return this._stories.slice(-limit); }
    getHealth() { return { ok: true, service: "story-driver", events: this._events.length, stories: this._stories.length }; }
}

function registerStoryRoutes(app, driver) {
    app.get("/api/stories/health", (_req, res) => res.json(driver.getHealth()));
    app.get("/api/stories/recent", (req, res) => res.json({ ok: true, stories: driver.getRecentStories(parseInt(req.query.limit) || 10) }));
    app.get("/api/stories/events", (_req, res) => res.json({ ok: true, events: driver._events.slice(-20) }));
}

module.exports = { HCStoryDriver, registerStoryRoutes };
