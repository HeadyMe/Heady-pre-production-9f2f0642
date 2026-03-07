/**
 * ∞ Server Boot — Phase 10 Bootstrap
 * Extracted from heady-manager.js lines 1629-1831
 * HTTP/HTTPS server creation + WebSocket upgrade + listen
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { HeadyWebSocket } = require('../core/heady-server');

module.exports = function bootServer(app, { logger, voiceSessions }) {
    const PORT = process.env.PORT || process.env.HEADY_PORT || 3301;
    const certDir = path.join(__dirname, '../../certs');
    const redisPool = require('../utils/redis-pool');
    let server;

    if (fs.existsSync(path.join(certDir, 'server.key')) && fs.existsSync(path.join(certDir, 'server.crt'))) {
        server = https.createServer({
            key: fs.readFileSync(path.join(certDir, 'server.key')),
            cert: fs.readFileSync(path.join(certDir, 'server.crt')),
            ca: fs.existsSync(path.join(certDir, 'ca.crt')) ? fs.readFileSync(path.join(certDir, 'ca.crt')) : undefined,
            requestCert: true, rejectUnauthorized: false,
        }, app);
        logger.logNodeActivity("BUILDER", "  🔒 mTLS/HTTPS Server Configured");
    } else {
        server = http.createServer(app);
        logger.logNodeActivity("BUILDER", "  ⚠️ No certs found. Falling back to HTTP Server");
    }

    // WebSocket upgrade for voice relay
    const voiceWss = new HeadyWebSocket.Server({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
        const url = new URL(request.url, `http://${request.headers.host}`);
        const match = url.pathname.match(/^\/ws\/voice\/(.+)$/);
        if (!match) { socket.destroy(); return; }
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
            session.receivers.forEach(r => { if (r.readyState === 1) r.send(JSON.stringify({ type: 'sender_connected' })); });
        } else {
            session.receivers.add(ws);
            if (session.sender && session.sender.readyState === 1) ws.send(JSON.stringify({ type: 'sender_connected' }));
        }

        ws.on('message', (data) => {
            session.lastActivity = Date.now();
            try {
                const msg = JSON.parse(data);
                if (role === 'sender' && ['transcript', 'interim', 'final'].includes(msg.type)) {
                    session.receivers.forEach(r => { if (r.readyState === 1) r.send(JSON.stringify(msg)); });
                }
                if (role === 'receiver' && msg.type === 'command' && session.sender && session.sender.readyState === 1) {
                    session.sender.send(JSON.stringify(msg));
                }
            } catch { }
        });

        ws.on('close', () => {
            if (role === 'sender') {
                session.sender = null;
                session.receivers.forEach(r => { if (r.readyState === 1) r.send(JSON.stringify({ type: 'sender_disconnected' })); });
            } else { session.receivers.delete(ws); }
            if (!session.sender && session.receivers.size === 0) voiceSessions.delete(sessionId);
        });
    });

    // Boot
    redisPool.init().then(() => {
        server.listen(PORT, '0.0.0.0', () => {
            const c = { reset: "\x1b[0m", bold: "\x1b[1m", cyan: "\x1b[36m", purple: "\x1b[35m", green: "\x1b[32m" };
            logger.logNodeActivity("CONDUCTOR", `\n${c.bold}${c.purple}╭────────────────────────────────────────────────────────╮${c.reset}`);
            logger.logNodeActivity("CONDUCTOR", `${c.bold}${c.purple}│${c.reset}  ${c.cyan}⚡ HEADY SYSTEMS CORE — OS V3.0${c.reset}`);
            logger.logNodeActivity("CONDUCTOR", `${c.bold}${c.purple}│${c.reset}  ${c.green}Gateway: http://0.0.0.0:${PORT}${c.reset}`);
            logger.logNodeActivity("CONDUCTOR", `${c.bold}${c.purple}│${c.reset}  ${c.purple}Voice: ws://0.0.0.0:${PORT}/ws/voice/:id${c.reset}`);
            logger.logNodeActivity("CONDUCTOR", `${c.bold}${c.purple}╰────────────────────────────────────────────────────────╯${c.reset}\n`);
        });
    });
};
