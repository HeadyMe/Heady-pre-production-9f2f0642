/**
 * ═══════════════════════════════════════════════════════════════
 * Heady SysEx Receiver — Max for Live Device
 * ═══════════════════════════════════════════════════════════════
 *
 * Max for Live JavaScript (M4L JSUI / js object) that listens
 * for MIDI SysEx messages on manufacturer ID 0x7D (non-commercial),
 * parses the Heady command protocol, and routes to the
 * Live Object Model (LOM) for real-time Ableton control.
 *
 * Protocol:
 *   F0 7D <cmd> <payload...> F7
 *
 * Commands:
 *   0x01 = Set tempo (payload = BPM as 2 bytes)
 *   0x02 = Set track volume (payload = track:byte, vol:byte)
 *   0x03 = Trigger clip (payload = track:byte, scene:byte)
 *   0x04 = Set device param (payload = track:byte, device:byte, param:byte, value:byte)
 *   0x05 = Transport control (payload = 0=stop, 1=play, 2=record)
 *   0x10 = Heady status request (responds with current state)
 *   0x20 = AI-generated arrangement (payload = JSON arrangement data)
 *
 * Installation:
 *   1. Place this file in your Max for Live device's 'code' folder
 *   2. Create a [js heady_sysex_receiver.js] object in Max
 *   3. Connect a [midiin] → [midiparse] → [sysexin] chain to the inlet
 *   4. The outlet sends Live API calls to [live.object] abstractions
 */

// Max for Live globals
// In M4L context, these are provided by the runtime:
// autowatch, inlets, outlets, post, messnamed, LiveAPI
autowatch = 1;

inlets = 1;   // SysEx bytes in
outlets = 4;  // [0] = LOM path, [1] = LOM property, [2] = LOM value, [3] = status/debug

var MANUFACTURER_ID = 0x7D;  // Non-commercial SysEx ID

// ── SysEx Input Handler ─────────────────────────────────────────

function sysex() {
    var bytes = arrayfromargs(arguments);

    // Validate minimum length: F0 7D cmd F7
    if (bytes.length < 4) return;
    if (bytes[0] !== 0xF0) return;
    if (bytes[1] !== MANUFACTURER_ID) return;
    if (bytes[bytes.length - 1] !== 0xF7) return;

    var command = bytes[2];
    var payload = bytes.slice(3, bytes.length - 1);

    outlet(3, 'sysex_received', 'cmd:' + command.toString(16), 'len:' + payload.length);

    switch (command) {
        case 0x01: handleSetTempo(payload); break;
        case 0x02: handleSetTrackVolume(payload); break;
        case 0x03: handleTriggerClip(payload); break;
        case 0x04: handleSetDeviceParam(payload); break;
        case 0x05: handleTransport(payload); break;
        case 0x10: handleStatusRequest(); break;
        case 0x20: handleAIArrangement(payload); break;
        default:
            outlet(3, 'unknown_command', command.toString(16));
    }
}

// ── Command Handlers ────────────────────────────────────────────

function handleSetTempo(payload) {
    if (payload.length < 2) return;
    var bpm = (payload[0] << 7) | payload[1];  // 14-bit tempo value
    if (bpm < 20 || bpm > 999) return;

    var api = new LiveAPI('live_set');
    api.set('tempo', bpm);
    outlet(3, 'tempo_set', bpm);
}

function handleSetTrackVolume(payload) {
    if (payload.length < 2) return;
    var trackIdx = payload[0];
    var volume = payload[1] / 127.0;  // Normalize 0-127 → 0.0-1.0

    try {
        var api = new LiveAPI('live_set tracks ' + trackIdx + ' mixer_device volume');
        api.set('value', volume);
        outlet(3, 'volume_set', 'track:' + trackIdx, 'vol:' + volume.toFixed(3));
    } catch (e) {
        outlet(3, 'error', 'track_volume', e.message);
    }
}

function handleTriggerClip(payload) {
    if (payload.length < 2) return;
    var trackIdx = payload[0];
    var sceneIdx = payload[1];

    try {
        var api = new LiveAPI('live_set tracks ' + trackIdx + ' clip_slots ' + sceneIdx + ' clip');
        if (api.get('is_triggered') === 0) {
            api.call('fire');
            outlet(3, 'clip_fired', 'track:' + trackIdx, 'scene:' + sceneIdx);
        }
    } catch (e) {
        outlet(3, 'error', 'trigger_clip', e.message);
    }
}

function handleSetDeviceParam(payload) {
    if (payload.length < 4) return;
    var trackIdx = payload[0];
    var deviceIdx = payload[1];
    var paramIdx = payload[2];
    var value = payload[3] / 127.0;

    try {
        var api = new LiveAPI(
            'live_set tracks ' + trackIdx +
            ' devices ' + deviceIdx +
            ' parameters ' + paramIdx
        );
        api.set('value', value);
        outlet(3, 'param_set', 'track:' + trackIdx, 'dev:' + deviceIdx,
            'param:' + paramIdx, 'val:' + value.toFixed(3));
    } catch (e) {
        outlet(3, 'error', 'device_param', e.message);
    }
}

function handleTransport(payload) {
    if (payload.length < 1) return;
    var action = payload[0];

    var api = new LiveAPI('live_set');
    switch (action) {
        case 0: // Stop
            api.set('is_playing', 0);
            outlet(3, 'transport', 'stopped');
            break;
        case 1: // Play
            api.set('is_playing', 1);
            outlet(3, 'transport', 'playing');
            break;
        case 2: // Record
            api.set('record_mode', 1);
            api.set('is_playing', 1);
            outlet(3, 'transport', 'recording');
            break;
        default:
            outlet(3, 'transport', 'unknown', action);
    }
}

function handleStatusRequest() {
    try {
        var api = new LiveAPI('live_set');
        var tempo = api.get('tempo');
        var playing = api.get('is_playing');
        var trackCount = api.get('tracks').length / 2;  // LOM returns id pairs

        outlet(0, 'live_set');
        outlet(1, 'status');
        outlet(2, JSON.stringify({
            tempo: tempo,
            playing: playing,
            tracks: trackCount,
            timestamp: Date.now(),
        }));
        outlet(3, 'status_sent');
    } catch (e) {
        outlet(3, 'error', 'status', e.message);
    }
}

function handleAIArrangement(payload) {
    // Convert SysEx bytes to JSON string
    var jsonStr = '';
    for (var i = 0; i < payload.length; i++) {
        jsonStr += String.fromCharCode(payload[i]);
    }

    try {
        var arrangement = JSON.parse(jsonStr);
        outlet(3, 'ai_arrangement_received', 'sections:' + (arrangement.sections || []).length);

        // Apply arrangement sections
        if (arrangement.tempo) {
            handleSetTempo([(arrangement.tempo >> 7) & 0x7F, arrangement.tempo & 0x7F]);
        }

        // Fire clips based on arrangement timeline
        if (arrangement.sections) {
            for (var s = 0; s < arrangement.sections.length; s++) {
                var section = arrangement.sections[s];
                if (section.track !== undefined && section.scene !== undefined) {
                    // Schedule clip triggers (simplified — in production, use Transport.scheduleCallback)
                    handleTriggerClip([section.track, section.scene]);
                }
            }
        }
    } catch (e) {
        outlet(3, 'error', 'ai_arrangement', e.message);
    }
}

// ── Init ─────────────────────────────────────────────────────────

function loadbang() {
    post('  🎵 Heady SysEx Receiver loaded (manufacturer: 0x7D)\n');
    post('  📡 Listening for Heady AI commands...\n');
    outlet(3, 'heady_sysex_ready');
}
