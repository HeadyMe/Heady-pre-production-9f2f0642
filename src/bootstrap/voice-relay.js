/**
 * ∞ Voice Relay — Phase 9 Bootstrap
 * Extracted from heady-manager.js lines 1588-1732
 * WebSocket-based cross-device voice transcription relay
 */
module.exports = function mountVoiceRelay(app, { logger }) {
    const voiceSessions = new Map();

    app.get('/api/voice/session', (req, res) => {
        const sessionId = req.query.id || `voice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        if (!voiceSessions.has(sessionId)) {
            voiceSessions.set(sessionId, { sender: null, receivers: new Set(), created: Date.now(), lastActivity: Date.now() });
        }
        const session = voiceSessions.get(sessionId);
        res.json({ sessionId, hasSender: !!session.sender, receiverCount: session.receivers.size, created: new Date(session.created).toISOString() });
    });

    app.get('/api/voice/sessions', (req, res) => {
        const sessions = [];
        voiceSessions.forEach((v, k) => sessions.push({
            sessionId: k, hasSender: !!v.sender, receiverCount: v.receivers.size,
            created: new Date(v.created).toISOString(), lastActivity: new Date(v.lastActivity).toISOString(),
        }));
        res.json({ sessions });
    });

    // Cleanup stale sessions every 30 minutes
    setInterval(() => {
        const staleThreshold = Date.now() - 3600000;
        voiceSessions.forEach((session, id) => {
            if (session.lastActivity < staleThreshold) {
                if (session.sender) try { session.sender.close(); } catch { }
                session.receivers.forEach(r => { try { r.close(); } catch { } });
                voiceSessions.delete(id);
            }
        });
    }, 1800000);

    return { voiceSessions };
};
