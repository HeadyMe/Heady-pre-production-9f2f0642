/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * AI DVR — Agentic Session Replay Engine
 *
 * Backed by in-memory columnar storage (production: ClickHouse).
 * Enables admins to scrub back in time through agent execution traces:
 * - Left pane: A2UI components rendered to the user
 * - Right pane: cascading waterfall of ternary logic + MCP payloads
 */

'use strict';

const crypto = require('crypto');
const logger = require('../utils/logger');

// ─── Session Recording ───────────────────────────────────────────────────────
class SessionRecorder {
    constructor(maxSessions = 1000) {
        this._sessions = new Map();       // sessionId → session
        this._maxSessions = maxSessions;
    }

    /**
     * Start recording a new session.
     */
    startSession(userId, metadata = {}) {
        const sessionId = `session-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        this._sessions.set(sessionId, {
            sessionId,
            userId,
            startedAt: new Date().toISOString(),
            endedAt: null,
            metadata,
            frames: [],       // Ordered list of all events
            a2uiPayloads: [], // UI payloads sent to user
            mcpPayloads: [],  // MCP tool calls
            ternaryDecisions: [], // Ternary classifications
            agentActions: [],  // Agent decisions and actions
        });

        // Evict oldest if over limit
        if (this._sessions.size > this._maxSessions) {
            const oldest = [...this._sessions.keys()][0];
            this._sessions.delete(oldest);
        }

        return sessionId;
    }

    /**
     * Record a frame (event) in a session.
     */
    recordFrame(sessionId, frame) {
        const session = this._sessions.get(sessionId);
        if (!session) return false;

        const enrichedFrame = {
            frameId: session.frames.length,
            ts: Date.now(),
            isoTs: new Date().toISOString(),
            type: frame.type, // 'a2ui', 'mcp', 'ternary', 'agent_action', 'user_input', 'system'
            data: frame.data,
            agent: frame.agent || null,
            traceId: frame.traceId || null,
            duration: frame.duration || null,
        };

        session.frames.push(enrichedFrame);

        // Also add to type-specific arrays for efficient replay
        switch (frame.type) {
            case 'a2ui':
                session.a2uiPayloads.push(enrichedFrame);
                break;
            case 'mcp':
                session.mcpPayloads.push(enrichedFrame);
                break;
            case 'ternary':
                session.ternaryDecisions.push(enrichedFrame);
                break;
            case 'agent_action':
                session.agentActions.push(enrichedFrame);
                break;
        }

        return true;
    }

    /**
     * End a session.
     */
    endSession(sessionId) {
        const session = this._sessions.get(sessionId);
        if (!session) return null;
        session.endedAt = new Date().toISOString();
        return session;
    }

    /**
     * Replay a session from a specific frame index.
     * Returns the dual-pane view: UI state + agent waterfall.
     */
    replay(sessionId, fromFrame = 0, toFrame = null) {
        const session = this._sessions.get(sessionId);
        if (!session) return null;

        const end = toFrame !== null ? Math.min(toFrame, session.frames.length) : session.frames.length;
        const frames = session.frames.slice(fromFrame, end);

        // Build the dual-pane replay
        const leftPane = {
            label: 'User View (A2UI Components)',
            payloads: frames.filter(f => f.type === 'a2ui').map(f => ({
                frameId: f.frameId,
                ts: f.isoTs,
                components: f.data?.components || f.data,
            })),
        };

        const rightPane = {
            label: 'Agent Waterfall (Ternary + MCP)',
            waterfall: frames.filter(f => ['mcp', 'ternary', 'agent_action'].includes(f.type)).map(f => ({
                frameId: f.frameId,
                ts: f.isoTs,
                type: f.type,
                agent: f.agent,
                duration: f.duration,
                data: f.data,
                traceId: f.traceId,
            })),
        };

        return {
            sessionId,
            userId: session.userId,
            totalFrames: session.frames.length,
            replayRange: { from: fromFrame, to: end },
            duration: session.endedAt
                ? new Date(session.endedAt) - new Date(session.startedAt)
                : Date.now() - new Date(session.startedAt).getTime(),
            leftPane,
            rightPane,
        };
    }

    /**
     * Search sessions by userId or metadata.
     */
    search(query) {
        const results = [];
        for (const [sessionId, session] of this._sessions) {
            if (session.userId?.includes(query) ||
                JSON.stringify(session.metadata).includes(query)) {
                results.push({
                    sessionId,
                    userId: session.userId,
                    startedAt: session.startedAt,
                    endedAt: session.endedAt,
                    frameCount: session.frames.length,
                    a2uiCount: session.a2uiPayloads.length,
                    mcpCount: session.mcpPayloads.length,
                });
            }
            if (results.length >= 50) break;
        }
        return results;
    }

    /**
     * Get session summary.
     */
    getSummary(sessionId) {
        const session = this._sessions.get(sessionId);
        if (!session) return null;

        return {
            sessionId,
            userId: session.userId,
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            totalFrames: session.frames.length,
            breakdown: {
                a2ui: session.a2uiPayloads.length,
                mcp: session.mcpPayloads.length,
                ternary: session.ternaryDecisions.length,
                agentActions: session.agentActions.length,
                other: session.frames.length - session.a2uiPayloads.length -
                    session.mcpPayloads.length - session.ternaryDecisions.length -
                    session.agentActions.length,
            },
            agents: [...new Set(session.frames.filter(f => f.agent).map(f => f.agent))],
        };
    }

    getStats() {
        return {
            totalSessions: this._sessions.size,
            activeSessions: [...this._sessions.values()].filter(s => !s.endedAt).length,
            totalFrames: [...this._sessions.values()].reduce((sum, s) => sum + s.frames.length, 0),
        };
    }
}

// ─── AI DVR Service ──────────────────────────────────────────────────────────
class AIDVRService {
    constructor(opts = {}) {
        this.recorder = new SessionRecorder(opts.maxSessions || 1000);
    }

    /**
     * Register HTTP routes.
     */
    registerRoutes(app) {
        // Start recording
        app.post('/api/v2/dvr/session/start', (req, res) => {
            const { userId, metadata } = req.body;
            if (!userId) return res.status(400).json({ error: 'userId required' });
            const sessionId = this.recorder.startSession(userId, metadata);
            res.json({ ok: true, sessionId });
        });

        // Record a frame
        app.post('/api/v2/dvr/session/:sessionId/record', (req, res) => {
            const recorded = this.recorder.recordFrame(req.params.sessionId, req.body);
            if (!recorded) return res.status(404).json({ error: 'Session not found' });
            res.json({ ok: true, recorded: true });
        });

        // End session
        app.post('/api/v2/dvr/session/:sessionId/end', (req, res) => {
            const session = this.recorder.endSession(req.params.sessionId);
            if (!session) return res.status(404).json({ error: 'Session not found' });
            res.json({ ok: true, sessionId: session.sessionId, endedAt: session.endedAt });
        });

        // Replay a session (dual-pane view)
        app.get('/api/v2/dvr/replay/:sessionId', (req, res) => {
            const from = parseInt(req.query.from) || 0;
            const to = req.query.to ? parseInt(req.query.to) : null;
            const replay = this.recorder.replay(req.params.sessionId, from, to);
            if (!replay) return res.status(404).json({ error: 'Session not found' });
            res.json({ ok: true, ...replay });
        });

        // Session summary
        app.get('/api/v2/dvr/session/:sessionId', (req, res) => {
            const summary = this.recorder.getSummary(req.params.sessionId);
            if (!summary) return res.status(404).json({ error: 'Session not found' });
            res.json({ ok: true, ...summary });
        });

        // Search sessions
        app.get('/api/v2/dvr/search', (req, res) => {
            const results = this.recorder.search(req.query.q || '');
            res.json({ ok: true, results });
        });

        // Stats
        app.get('/api/v2/dvr/stats', (req, res) => {
            res.json({ ok: true, ...this.recorder.getStats() });
        });
    }
}

module.exports = { AIDVRService, SessionRecorder };
