/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 * MIDI Bee — Covers all music/audio infrastructure:
 * midi/network-midi.js, engines/midi-event-bus.js, engines/ump-udp-transport.js,
 * services/daw-mcp-bridge.js, ableton-remote-script/HeadyBuddy
 *
 * This bee also registers all MIDI/DAW components in vector memory
 * for 3D vector space awareness of the music infrastructure.
 */
const path = require('path');
const fs = require('fs');
const domain = 'midi';
const description = 'Network MIDI, MIDI event bus, UMP UDP transport, DAW MCP bridge, Ableton Remote Script';
const priority = 0.5;

function getWork(ctx = {}) {
    const mods = [
        { name: 'network-midi', path: '../midi/network-midi' },
        { name: 'midi-event-bus', path: '../engines/midi-event-bus' },
        { name: 'ump-udp-transport', path: '../engines/ump-udp-transport' },
        { name: 'daw-mcp-bridge', path: '../services/daw-mcp-bridge' },
    ];

    const work = mods.map(m => async () => {
        try { require(m.path); return { bee: domain, action: m.name, loaded: true }; }
        catch { return { bee: domain, action: m.name, loaded: false }; }
    });

    // ─── Ableton Remote Script — validate and register in vector space ───
    work.push(async () => {
        const scriptDir = path.join(__dirname, '../../ableton-remote-script/HeadyBuddy');
        const initPy = path.join(scriptDir, '__init__.py');
        const mainPy = path.join(scriptDir, 'HeadyBuddyScript.py');

        const initExists = fs.existsSync(initPy);
        const mainExists = fs.existsSync(mainPy);
        const mainSize = mainExists ? fs.statSync(mainPy).size : 0;

        // Register in vector memory — 3D vector space awareness
        const vectorMemory = global.__vectorMemory;
        if (vectorMemory && typeof vectorMemory.add === 'function') {
            vectorMemory.add('midi:ableton-remote-script', {
                component: 'HeadyBuddy',
                type: 'ableton-remote-script',
                domain: 'midi',
                files: {
                    '__init__.py': initExists,
                    'HeadyBuddyScript.py': { exists: mainExists, bytes: mainSize },
                },
                capabilities: [
                    'transport.play', 'transport.stop', 'transport.record',
                    'transport.set_tempo', 'track.create_midi', 'track.create_audio',
                    'track.volume', 'track.pan', 'track.mute', 'track.solo', 'track.arm',
                    'device.set_param', 'device.get_params', 'device.set_macro',
                    'clip.create', 'clip.set_notes', 'clip.fire', 'scene.fire',
                    'session.get_state', 'session.get_tracks', 'session.get_routing',
                ],
                protocol: { host: '127.0.0.1', port: 11411, transport: 'tcp', format: 'json-newline' },
                installPaths: {
                    mac: '~/Library/Preferences/Ableton/Live 12/User Remote Scripts/HeadyBuddy/',
                    windows: '%APPDATA%\\Ableton\\Live 12\\Preferences\\User Remote Scripts\\HeadyBuddy\\',
                },
                registeredAt: new Date().toISOString(),
            });

            // Also register the DAW MCP Bridge config
            vectorMemory.add('midi:daw-mcp-bridge', {
                component: 'DawMcpBridge',
                type: 'node-tcp-bridge',
                domain: 'midi',
                ports: { tcp: 11411, udp: 11412, mcp: 11413 },
                capabilities: [
                    'semantic-intent', 'param-smoothing', 'midi-injection',
                    'session-mirror', 'lom-commands', 'real-time-events',
                ],
                registeredAt: new Date().toISOString(),
            });
        }

        // Emit event for reactor
        if (global.eventBus) {
            global.eventBus.emit('midi:ableton-script:validated', {
                initPy: initExists, mainPy: mainExists, bytes: mainSize,
            });
        }

        return {
            bee: domain,
            action: 'ableton-remote-script',
            validated: initExists && mainExists,
            files: { initPy: initExists, mainPy: mainExists, bytes: mainSize },
        };
    });

    return work;
}

module.exports = { domain, description, priority, getWork };
