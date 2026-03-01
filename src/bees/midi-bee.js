/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 * MIDI Bee — Covers all music/audio infrastructure:
 * midi/network-midi.js, engines/midi-event-bus.js, engines/ump-udp-transport.js,
 * services/daw-mcp-bridge.js (796 lines)
 */
const domain = 'midi';
const description = 'Network MIDI, MIDI event bus, UMP UDP transport, DAW MCP bridge';
const priority = 0.5;

function getWork(ctx = {}) {
    const mods = [
        { name: 'network-midi', path: '../midi/network-midi' },
        { name: 'midi-event-bus', path: '../engines/midi-event-bus' },
        { name: 'ump-udp-transport', path: '../engines/ump-udp-transport' },
        { name: 'daw-mcp-bridge', path: '../services/daw-mcp-bridge' },
    ];
    return mods.map(m => async () => {
        try { require(m.path); return { bee: domain, action: m.name, loaded: true }; }
        catch { return { bee: domain, action: m.name, loaded: false }; }
    });
}

module.exports = { domain, description, priority, getWork };
