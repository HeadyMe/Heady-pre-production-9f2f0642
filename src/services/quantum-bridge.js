/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Quantum Bridge (Long-814 Spec)
 *
 * Hardened WebSocket layer facilitating live archetype consultations
 * and visual feedback for consciousness shifts (Multi-Modal Experience Engine).
 */

'use strict';

const WebSocket = require('ws');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { telemetry } = require('../telemetry/otel');

class QuantumBridge {
    constructor(server, opts = {}) {
        this.wss = new WebSocket.Server({ noServer: true });
        this.sessions = new Map(); // sessionId → ws connection

        // Attach upgrade handler to HTTP server
        server.on('upgrade', (request, socket, head) => {
            // Long-814 Spec: Hardened endpoint validation
            if (request.url.startsWith('/quantum-bridge/')) {
                const sessionId = request.url.split('/')[2];
                if (!sessionId || sessionId.length < 16) {
                    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
                    socket.destroy();
                    return;
                }

                // TODO: WebAuthn/token validation here

                this.wss.handleUpgrade(request, socket, head, (ws) => {
                    this.wss.emit('connection', ws, request, sessionId);
                });
            } else {
                socket.destroy();
            }
        });

        this.wss.on('connection', (ws, req, sessionId) => {
            this._handleConnection(ws, sessionId);
        });

        logger.info(`🌀 Quantum Bridge initialized`);
    }

    _handleConnection(ws, sessionId) {
        logger.info(`[QuantumBridge] Session ${sessionId} connected.`);
        this.sessions.set(sessionId, ws);

        // Ping/Pong for connection resilience
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });

        ws.on('message', async (data) => {
            await telemetry.withSpan('quantum_bridge.message_receive', { sessionId }, async (span) => {
                try {
                    const payload = JSON.parse(data);
                    await this._processPayload(sessionId, ws, payload, span);
                } catch (err) {
                    logger.error(`[QuantumBridge] Error processing payload from ${sessionId}:`, err);
                    ws.send(JSON.stringify({ error: 'invalid_payload', msg: err.message }));
                }
            });
        });

        ws.on('close', () => {
            logger.info(`[QuantumBridge] Session ${sessionId} disconnected.`);
            this.sessions.delete(sessionId);
        });
    }

    async _processPayload(sessionId, ws, payload, span) {
        span.setAttribute('payload.type', payload.type);

        switch (payload.type) {
            case 'archetype_consultation':
                // Route to Python ML agents for Archetypal synthesis
                const response = await this._consultArchetype(payload.archetype, payload.context);
                ws.send(JSON.stringify({
                    type: 'archetype_response',
                    ...response
                }));
                break;
            case 'consciousness_shift':
                // Generate 3D Sacred Geometry visual metadata based on Chaos Factor
                const vizMetadata = this._generateMultiModalVisuals(payload.chaosFactor || 0.5);
                ws.send(JSON.stringify({
                    type: 'visual_metadata_sync',
                    metadata: vizMetadata
                }));
                break;
            default:
                ws.send(JSON.stringify({ error: 'unknown_type' }));
        }
    }

    async _consultArchetype(archetype, context) {
        // Mocked response: In reality, delegates via A2A protocol to Python agents
        return {
            archetype,
            resonance: 0.88,
            insight: `The ${archetype} archetype perceives current market volatility not as risk, but as generative friction.`,
            geometry: 'icosahedron',
            timestamp: Date.now()
        };
    }

    _generateMultiModalVisuals(chaosFactor) {
        // Pentagonal Pattern visual generation logic
        const phi = 1.6180339887;
        const vertices = Math.floor(20 * (1 + chaosFactor));
        return {
            renderMode: 'webgl',
            topology: 'pentagonal_dodecahedron',
            vertices,
            colorPalette: {
                primary: 'oklch(0.7 0.15 200)',
                secondary: 'oklch(0.6 0.2 300)'
            },
            oscillationHz: 963 * (1 + (chaosFactor * 0.1)), // 963Hz baseline, varies with chaos
            goldenRatioScale: phi
        };
    }

    /**
     * Broadcast a 3D visual resonance shift to all active sessions.
     */
    broadcastShift(shiftData) {
        const payload = JSON.stringify({ type: 'global_resonance_shift', data: shiftData });
        for (const [id, ws] of this.sessions) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(payload);
            }
        }
    }

    // Interval to terminate dead connections
    startHeartbeat() {
        this.interval = setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (ws.isAlive === false) return ws.terminate();
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000);
    }

    stopHeartbeat() {
        clearInterval(this.interval);
    }
}

module.exports = { QuantumBridge };
