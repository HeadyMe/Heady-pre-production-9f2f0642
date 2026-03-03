/**
 * Voice Relay WebSocket System
 * Cross-device voice-to-text relay: phone dictates → mini computer receives
 *
 * Extracted from heady-manager.js for modularity (Phase 2 God Class decomposition).
 */
const WebSocket = require('ws');
const logger = require('../utils/logger');

const voiceSessions = new Map(); // sessionId → { sender, receivers, created, lastActivity }

function registerVoiceRelayRoutes(app) {
    // Generate / retrieve voice session for pairing
    app.get('/api/voice/session', (req, res) => {
        const sessionId = req.query.id || `voice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        if (!voiceSessions.has(sessionId)) {
            voiceSessions.set(sessionId, { sender: null, receivers: new Set(), created: Date.now(), lastActivity: Date.now() });
        }
        const session = voiceSessions.get(sessionId);
        res.json({
            sessionId,
            hasSender: !!session.sender,
            receiverCount: session.receivers.size,
            created: new Date(session.created).toISOString(),
            ts: new Date().toISOString(),
        });
    });

    app.get('/api/voice/sessions', (req, res) => {
        const sessions = [];
        voiceSessions.forEach((v, k) => sessions.push({
            sessionId: k, hasSender: !!v.sender, receiverCount: v.receivers.size,
            created: new Date(v.created).toISOString(), lastActivity: new Date(v.lastActivity).toISOString(),
        }));
        res.json({ sessions, ts: new Date().toISOString() });
    });
}

function attachVoiceWebSocket(server) {
    const voiceWss = new WebSocket.Server({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
        const url = new URL(request.url, `http://${request.headers.host}`);
        const match = url.pathname.match(/^\/ws\/voice\/(.+)$/);
        if (!match) {
            // Don't destroy — other upgrade handlers (sync hub, etc.) may handle this
            return;
        }
        const sessionId = match[1];
        voiceWss.handleUpgrade(request, socket, head, (ws) => {
            voiceWss.emit('connection', ws, request, sessionId);
        });
    });

    voiceWss.on('connection', (ws, request, sessionId) => {
        if (!voiceSessions.has(sessionId)) {
            voiceSessions.set(sessionId, { sender: null, receivers: new Set(), created: Date.now(), lastActivity: Date.now() });
        }
        const session = voiceSessions.get(sessionId);
        const url = new URL(request.url, `http://${request.headers.host}`);
        const role = url.searchParams.get('role') || 'receiver';

        if (role === 'sender') {
            session.sender = ws;
            logger.logNodeActivity("CONDUCTOR", `[VoiceRelay] Sender connected to session ${sessionId}`);
            session.receivers.forEach((r) => {
                if (r.readyState === WebSocket.OPEN) r.send(JSON.stringify({ type: 'sender_connected' }));
            });
        } else {
            session.receivers.add(ws);
            logger.logNodeActivity("CONDUCTOR", `[VoiceRelay] Receiver connected to session ${sessionId} (${session.receivers.size} total)`);
            if (session.sender && session.sender.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'sender_connected' }));
            }
        }

        ws.on('message', (data) => {
            session.lastActivity = Date.now();
            try {
                const msg = JSON.parse(data);
                if (role === 'sender' && (msg.type === 'transcript' || msg.type === 'interim' || msg.type === 'final')) {
                    session.receivers.forEach((r) => {
                        if (r.readyState === WebSocket.OPEN) r.send(JSON.stringify(msg));
                    });
                }
                if (role === 'receiver' && msg.type === 'command' && session.sender && session.sender.readyState === WebSocket.OPEN) {
                    session.sender.send(JSON.stringify(msg));
                }
            } catch { /* ignore malformed messages */ }
        });

        ws.on('close', () => {
            if (role === 'sender') {
                session.sender = null;
                logger.logNodeActivity("CONDUCTOR", `[VoiceRelay] Sender disconnected from session ${sessionId}`);
                session.receivers.forEach((r) => {
                    if (r.readyState === WebSocket.OPEN) r.send(JSON.stringify({ type: 'sender_disconnected' }));
                });
            } else {
                session.receivers.delete(ws);
                logger.logNodeActivity("CONDUCTOR", `[VoiceRelay] Receiver disconnected from session ${sessionId} (${session.receivers.size} remain)`);
            }
            if (!session.sender && session.receivers.size === 0) voiceSessions.delete(sessionId);
        });

        ws.on('error', (err) => {
            logger.logNodeActivity("CONDUCTOR", `[VoiceRelay] WebSocket error in session ${sessionId}:`, err.message);
        });
    });

    // Clean up stale sessions every 30 minutes
    setInterval(() => {
        const staleThreshold = Date.now() - 3600000;
        voiceSessions.forEach((session, id) => {
            if (session.lastActivity < staleThreshold) {
                if (session.sender) try { session.sender.close(); } catch { /* */ }
                session.receivers.forEach((r) => { try { r.close(); } catch { /* */ } });
                voiceSessions.delete(id);
            }
        });
    }, 1800000);

    return voiceWss;
}

module.exports = { registerVoiceRelayRoutes, attachVoiceWebSocket, voiceSessions };
