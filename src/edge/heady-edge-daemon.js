#!/usr/bin/env node
/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

/**
 * ═══════════════════════════════════════════════════════════════
 * Heady Edge Daemon
 * ═══════════════════════════════════════════════════════════════
 *
 * Persistent local process that provides a reliable tether between
 * the cloud-based Heady brain and local hardware:
 *
 *   - WebSocket bridge to Heady Cloud (Cloud Run / Cloudflare)
 *   - MIDI integration via easymidi (Ableton Live, hardware synths)
 *   - Local file system watch for real-time embedding triggers
 *   - Secure token authentication (EDGE_DAEMON_TOKEN)
 *
 * Usage:
 *   EDGE_DAEMON_TOKEN=xxx node heady-edge-daemon.js
 *   EDGE_DAEMON_TOKEN=xxx HEADY_CLOUD_URL=https://heady.headyme.com node heady-edge-daemon.js
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const PORT = parseInt(process.env.EDGE_DAEMON_PORT || '9876', 10);
const HEADY_CLOUD_URL = process.env.HEADY_CLOUD_URL || 'https://heady.headyme.com';
const EDGE_DAEMON_TOKEN = process.env.EDGE_DAEMON_TOKEN;
const MONOREPO_ROOT = process.env.HEADY_DIR || path.resolve(__dirname, '..', '..');

// ── State ───────────────────────────────────────────────────────
const state = {
    running: false,
    startedAt: null,
    cloudConnected: false,
    midiConnected: false,
    fileWatcherActive: false,
    eventsProcessed: 0,
    errors: [],
};

// ── MIDI Bridge ─────────────────────────────────────────────────
let midi = null;
let midiInput = null;
let midiOutput = null;

function initMIDI() {
    try {
        midi = require('easymidi');
        const inputs = midi.getInputs();
        const outputs = midi.getOutputs();

        console.log(`  🎹 MIDI Inputs:  [${inputs.join(', ')}]`);
        console.log(`  🎹 MIDI Outputs: [${outputs.join(', ')}]`);

        if (inputs.length > 0) {
            midiInput = new midi.Input(inputs[0]);
            midiInput.on('sysex', handleSysEx);
            midiInput.on('cc', handleCC);
            midiInput.on('noteon', handleNoteOn);
            state.midiConnected = true;
            console.log(`  ✅ MIDI connected: ${inputs[0]}`);
        }

        if (outputs.length > 0) {
            midiOutput = new midi.Output(outputs[0]);
        }
    } catch (err) {
        console.log('  ⚠️  easymidi not installed — MIDI bridge disabled');
        console.log('     Install with: npm install easymidi');
    }
}

function handleSysEx(msg) {
    state.eventsProcessed++;
    const data = msg.bytes || [];

    // Heady SysEx prefix: 0xF0 0x7D (non-commercial manufacturer ID)
    if (data[0] === 0xF0 && data[1] === 0x7D) {
        const commandByte = data[2];
        const payload = Buffer.from(data.slice(3, -1)).toString('utf8');

        console.log(`  🎵 SysEx command: 0x${commandByte.toString(16)} payload: ${payload}`);

        // Route to Heady cloud
        sendToCloud({
            type: 'sysex',
            command: commandByte,
            payload,
            timestamp: new Date().toISOString(),
        });
    }
}

function handleCC(msg) {
    state.eventsProcessed++;
    // CC messages for real-time parameter control
    sendToCloud({
        type: 'cc',
        controller: msg.controller,
        value: msg.value,
        channel: msg.channel,
        timestamp: new Date().toISOString(),
    });
}

function handleNoteOn(msg) {
    state.eventsProcessed++;
    // Note events for triggers
    if (msg.velocity > 0) {
        sendToCloud({
            type: 'noteon',
            note: msg.note,
            velocity: msg.velocity,
            channel: msg.channel,
            timestamp: new Date().toISOString(),
        });
    }
}

/**
 * Send a MIDI-triggered SysEx command back to the MIDI output.
 */
function sendSysEx(commandByte, payload) {
    if (!midiOutput) return;
    const sysexData = [
        0xF0, 0x7D, commandByte,
        ...Buffer.from(payload, 'utf8'),
        0xF7,
    ];
    midiOutput.send('sysex', sysexData);
}

// ── Cloud Bridge ────────────────────────────────────────────────

async function sendToCloud(event) {
    if (!EDGE_DAEMON_TOKEN) return;

    try {
        const body = JSON.stringify(event);
        const url = new URL('/api/v1/edge/event', HEADY_CLOUD_URL);

        const res = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${EDGE_DAEMON_TOKEN}`,
                'X-Heady-Source': 'edge-daemon',
            },
            body,
        });

        if (!res.ok) {
            state.errors.push({ error: `Cloud: ${res.status}`, timestamp: new Date().toISOString() });
        }
        state.cloudConnected = true;
    } catch (err) {
        state.cloudConnected = false;
        state.errors.push({ error: err.message, timestamp: new Date().toISOString() });
    }

    // Cap error log
    if (state.errors.length > 100) state.errors.splice(0, state.errors.length - 100);
}

// ── File System Watcher ─────────────────────────────────────────

function initFileWatcher() {
    const srcDir = path.join(MONOREPO_ROOT, 'src');
    if (!fs.existsSync(srcDir)) {
        console.log(`  ⚠️  Source directory not found: ${srcDir}`);
        return;
    }

    try {
        const watcher = fs.watch(srcDir, { recursive: true }, (eventType, filename) => {
            if (!filename) return;
            if (filename.includes('node_modules') || filename.startsWith('.')) return;

            state.eventsProcessed++;
            sendToCloud({
                type: 'file-change',
                eventType,
                filename,
                timestamp: new Date().toISOString(),
            });
        });

        watcher.on('error', (err) => {
            console.error(`  ❌ File watcher error: ${err.message}`);
        });

        state.fileWatcherActive = true;
        console.log(`  👁️  File watcher active on: ${srcDir}`);
    } catch (err) {
        console.log(`  ⚠️  File watcher failed: ${err.message}`);
    }
}

// ── HTTP Server ─────────────────────────────────────────────────

function startServer() {
    const server = http.createServer((req, res) => {
        // Auth check
        const authHeader = req.headers.authorization;
        const providedToken = authHeader ? authHeader.replace('Bearer ', '') : null;

        if (EDGE_DAEMON_TOKEN && providedToken !== EDGE_DAEMON_TOKEN) {
            if (req.url !== '/health') {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Unauthorized' }));
                return;
            }
        }

        if (req.url === '/health' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                service: 'heady-edge-daemon',
                ...state,
                uptime: state.startedAt ? Date.now() - new Date(state.startedAt).getTime() : 0,
            }));
            return;
        }

        if (req.url === '/midi/sysex' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const { command, payload } = JSON.parse(body);
                    sendSysEx(command, payload);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, sent: { command, payload } }));
                } catch (err) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                }
            });
            return;
        }

        if (req.url === '/status' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(state));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    });

    server.listen(PORT, () => {
        state.running = true;
        state.startedAt = new Date().toISOString();
        console.log(`\n  ═══════════════════════════════════════════`);
        console.log(`  ⚡ Heady Edge Daemon running on port ${PORT}`);
        console.log(`  ═══════════════════════════════════════════`);
        console.log(`  Cloud:   ${HEADY_CLOUD_URL}`);
        console.log(`  Auth:    ${EDGE_DAEMON_TOKEN ? '✅ Token set' : '⚠️  No token'}`);
        console.log(`  MIDI:    ${state.midiConnected ? '✅ Connected' : '⚠️  Not available'}`);
        console.log(`  Watcher: ${state.fileWatcherActive ? '✅ Active' : '⚠️  Inactive'}`);
        console.log(`  ═══════════════════════════════════════════\n`);
    });
}

// ── Boot ─────────────────────────────────────────────────────────

function boot() {
    console.log('\n  🚀 Booting Heady Edge Daemon...\n');
    initMIDI();
    initFileWatcher();
    startServer();
}

// Auto-start if run directly
if (require.main === module) {
    boot();
}

module.exports = { boot, sendSysEx, sendToCloud, state };
