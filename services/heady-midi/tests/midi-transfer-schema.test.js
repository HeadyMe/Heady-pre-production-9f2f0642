/**
 * @fileoverview Comprehensive test suite for the Heady MIDI Transfer Schema.
 * Runnable with: node tests/midi-transfer-schema.test.js
 * Uses Node.js built-in assert — no external test framework required.
 *
 * @version 2.0.0
 * @author HeadySystems™
 *
 * ⚡ Made with 💜 by HeadySystems™ & HeadyConnection™
 * Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

import assert from 'node:assert/strict';

import {
  PHI, PSI, PHI2, PHI3, PSI2, PSI3, FIB, phiThreshold,
  STATUS, CHANNEL, CHANNEL_LABELS, CHANNEL_COLORS,
  CC, CC_LABELS, NOTE, VELOCITY,
  MANUFACTURER_ID, SYSEX_VERSION, SYSEX_CMD, SYSEX_CMD_NAMES,
  TRANSPORT, QUANTIZE,
  UMP_TYPE, UMP_STATUS,
  NETWORK_MIDI_PORT, WS_MIDI_PORT, ABLETON_TCP_PORT,
  DEFAULT_BPM, DEFAULT_PPQ, PHI_SWING, MAX_STALENESS_MS,
  BACKOFF_BASE_MS, BACKOFF_MAX_MS,
  EVENT_BUFFER_SIZE, HISTORY_BUFFER_SIZE, MAX_WS_CLIENTS,
  MIDI_LEARN_TIMEOUT_MS,
  CURVE_TYPE, applyCurve, ccToLatencyMs, latencyMsToCC,
} from '../src/shared/midi-constants.js';

import {
  encode14bit, decode14bit,
  encodeString, decodeString,
  encodeJSON, decodeJSON,
  encodeRGB, decodeRGB,
  buildSysEx, parseSysEx,
  encodeVersionNegotiate, encodeSetTempo, decodeSetTempo,
  encodeSetTrackVolume, encodeTriggerClip, encodeSetDeviceParam,
  encodeTransport, encodeCreateMidiTrack, encodeCreateAudioTrack,
  encodeSetTrackSend, encodeSetTrackEQ, encodeArmTrack,
  encodeSetClipColor, encodeSetClipName, encodeQuantizeClip,
  encodeDuplicateClip, encodeDeleteClip, encodeStatusRequest,
  encodeGetTrackNames, encodeGetDeviceChain, encodeSetMacro,
  encodeLoadPreset, encodeCCRecordEnable, encodeSetLoopRegion,
  encodeSetTimeSignature, encodeSetTrackRouting, encodeSoloTrack,
  encodeMuteTrack, encodeSetSceneName, encodeFireScene,
  encodeCaptureMidi, encodeConsolidateClip, encodeUndo,
  encodeAIArrangement, decodeAIArrangement,
  encodeAIGeneratePattern,
  decodeSysExCommand,
} from '../src/shared/sysex-codec.js';

// ─── Simple Test Runner ──────────────────────────────────────────
let passed = 0, failed = 0, total = 0;

function test(name, fn) {
  total++;
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}: ${e.message}`); }
}

function suite(name) { console.log(`\n━━━ ${name} ━━━`); }

// ═════════════════════════════════════════════════════════════════
// Suite 1: midi-constants
// ═════════════════════════════════════════════════════════════════
suite('midi-constants — φ Foundation');

test('PHI ≈ 1.618', () => {
  assert.ok(Math.abs(PHI - 1.6180339887) < 0.0001);
});

test('PSI ≈ 0.618', () => {
  assert.ok(Math.abs(PSI - 0.6180339887) < 0.0001);
});

test('PHI * PSI ≈ 1', () => {
  assert.ok(Math.abs(PHI * PSI - 1) < 1e-10);
});

test('PHI² ≈ PHI + 1', () => {
  assert.ok(Math.abs(PHI2 - (PHI + 1)) < 1e-10);
});

test('PHI³ ≈ 2*PHI + 1', () => {
  assert.ok(Math.abs(PHI3 - (2 * PHI + 1)) < 1e-10);
});

test('FIB has 20 elements', () => {
  assert.equal(FIB.length, 20);
});

test('FIB correctness: F[n] + F[n-1] = F[n+1]', () => {
  for (let i = 2; i < FIB.length; i++) {
    assert.equal(FIB[i], FIB[i - 1] + FIB[i - 2], `FIB[${i}] mismatch`);
  }
});

test('FIB[0] = 1, FIB[1] = 1', () => {
  assert.equal(FIB[0], 1);
  assert.equal(FIB[1], 1);
});

test('FIB[15] = 987 (event buffer size)', () => {
  assert.equal(FIB[15], 987);
});

suite('midi-constants — Channel Enums');

test('CHANNEL has 8 entries', () => {
  assert.equal(Object.keys(CHANNEL).length, 8);
});

test('CHANNEL values are 0-7', () => {
  assert.equal(CHANNEL.PIPELINE, 0);
  assert.equal(CHANNEL.FINOPS, 1);
  assert.equal(CHANNEL.DISPATCHER, 2);
  assert.equal(CHANNEL.HEALTH, 3);
  assert.equal(CHANNEL.TRADING, 4);
  assert.equal(CHANNEL.SECURITY, 5);
  assert.equal(CHANNEL.SWARM, 6);
  assert.equal(CHANNEL.TELEMETRY, 7);
});

test('CHANNEL_LABELS has entry for each channel', () => {
  for (const ch of Object.values(CHANNEL)) {
    assert.ok(CHANNEL_LABELS[ch], `Missing label for channel ${ch}`);
  }
});

test('CHANNEL_COLORS has entry for each channel', () => {
  for (const ch of Object.values(CHANNEL)) {
    assert.ok(CHANNEL_COLORS[ch], `Missing color for channel ${ch}`);
  }
});

suite('midi-constants — CC Controllers');

test('CC has 16 entries', () => {
  assert.equal(Object.keys(CC).length, 16);
});

test('CC values are sequential 1-16', () => {
  assert.equal(CC.BUDGET_USAGE, 1);
  assert.equal(CC.THROUGHPUT, 16);
});

test('CC_LABELS has entry for each CC', () => {
  for (const ccVal of Object.values(CC)) {
    assert.ok(CC_LABELS[ccVal], `Missing label for CC ${ccVal}`);
  }
});

suite('midi-constants — Note Numbers');

test('NOTE.TASK_INGEST = 36 (C2)', () => {
  assert.equal(NOTE.TASK_INGEST, 36);
});

test('NOTE.TASK_COMPLETE = 48 (C3)', () => {
  assert.equal(NOTE.TASK_COMPLETE, 48);
});

test('NOTE.AGENT_SPAWN = 60 (C4)', () => {
  assert.equal(NOTE.AGENT_SPAWN, 60);
});

test('NOTE.REGIME_SHIFT = 72 (C5)', () => {
  assert.equal(NOTE.REGIME_SHIFT, 72);
});

test('NOTE.CLIP_TRIGGER = 84 (C6)', () => {
  assert.equal(NOTE.CLIP_TRIGGER, 84);
});

test('All NOTE values are valid MIDI (0-127)', () => {
  for (const [key, val] of Object.entries(NOTE)) {
    assert.ok(val >= 0 && val <= 127, `NOTE.${key}=${val} out of range`);
  }
});

suite('midi-constants — VELOCITY Thresholds');

test('VELOCITY thresholds are in ascending order', () => {
  const levels = [VELOCITY.MINIMUM, VELOCITY.LOW, VELOCITY.MEDIUM, VELOCITY.CRITICAL, VELOCITY.MAXIMUM];
  for (let i = 1; i < levels.length; i++) {
    assert.ok(levels[i] >= levels[i - 1], `VELOCITY order violated at index ${i}`);
  }
});

test('VELOCITY.MINIMUM = 1', () => {
  assert.equal(VELOCITY.MINIMUM, 1);
});

test('VELOCITY.MAXIMUM = 127', () => {
  assert.equal(VELOCITY.MAXIMUM, 127);
});

suite('midi-constants — Status Bytes');

test('STATUS.NOTE_ON = 0x90', () => {
  assert.equal(STATUS.NOTE_ON, 0x90);
});

test('STATUS.NOTE_OFF = 0x80', () => {
  assert.equal(STATUS.NOTE_OFF, 0x80);
});

test('STATUS.SYSEX_START = 0xF0', () => {
  assert.equal(STATUS.SYSEX_START, 0xF0);
});

test('STATUS.SYSEX_END = 0xF7', () => {
  assert.equal(STATUS.SYSEX_END, 0xF7);
});

test('STATUS.CC = 0xB0', () => {
  assert.equal(STATUS.CC, 0xB0);
});

suite('midi-constants — Network & Timing');

test('NETWORK_MIDI_PORT = 5504', () => {
  assert.equal(NETWORK_MIDI_PORT, 5504);
});

test('DEFAULT_BPM = 89 (Fibonacci)', () => {
  assert.equal(DEFAULT_BPM, 89);
  assert.ok(FIB.includes(89));
});

test('DEFAULT_PPQ = 480', () => {
  assert.equal(DEFAULT_PPQ, 480);
});

test('EVENT_BUFFER_SIZE = 1597 (Fibonacci)', () => {
  assert.equal(EVENT_BUFFER_SIZE, FIB[16]);
  assert.ok(FIB.includes(EVENT_BUFFER_SIZE));
});

test('PHI_SWING ≈ 0.618', () => {
  assert.ok(Math.abs(PHI_SWING - 0.618) < 0.001);
});

suite('midi-constants — Curve Functions');

test('applyCurve LINEAR returns 0-1 range for 0-127', () => {
  for (let v = 0; v <= 127; v++) {
    const result = applyCurve(v, CURVE_TYPE.LINEAR);
    assert.ok(result >= 0 && result <= 1, `LINEAR(${v}) = ${result} out of range`);
  }
});

test('applyCurve returns 0-1 range for all curve types', () => {
  for (const curveType of Object.values(CURVE_TYPE)) {
    for (const v of [0, 1, 32, 64, 96, 126, 127]) {
      const result = applyCurve(v, curveType);
      assert.ok(result >= -0.01 && result <= 1.01, `${curveType}(${v}) = ${result} out of range`);
    }
  }
});

test('ccToLatencyMs(0) = 0', () => {
  assert.equal(ccToLatencyMs(0), 0);
});

test('ccToLatencyMs(127) ≈ 1000', () => {
  const lat = ccToLatencyMs(127);
  assert.ok(Math.abs(lat - 1000) < 5, `ccToLatencyMs(127) = ${lat}, expected ≈ 1000`);
});

test('MANUFACTURER_ID = 0x7D', () => {
  assert.equal(MANUFACTURER_ID, 0x7D);
});

test('SYSEX_CMD has 34 commands', () => {
  assert.equal(Object.keys(SYSEX_CMD).length, 34);
});

// ═════════════════════════════════════════════════════════════════
// Suite 2: sysex-codec
// ═════════════════════════════════════════════════════════════════
suite('sysex-codec — 14-bit Encoding');

test('encode14bit/decode14bit roundtrip — 0', () => {
  const [msb, lsb] = encode14bit(0);
  assert.equal(decode14bit(msb, lsb), 0);
});

test('encode14bit/decode14bit roundtrip — 8192', () => {
  const [msb, lsb] = encode14bit(8192);
  assert.equal(decode14bit(msb, lsb), 8192);
});

test('encode14bit/decode14bit roundtrip — 16383', () => {
  const [msb, lsb] = encode14bit(16383);
  assert.equal(decode14bit(msb, lsb), 16383);
});

test('encode14bit clamps values above 16383', () => {
  const [msb, lsb] = encode14bit(20000);
  assert.equal(decode14bit(msb, lsb), 16383);
});

test('encode14bit produces 7-bit safe bytes', () => {
  for (const val of [0, 100, 1000, 8192, 16383]) {
    const [msb, lsb] = encode14bit(val);
    assert.ok(msb < 0x80, `MSB ${msb} >= 0x80 for val ${val}`);
    assert.ok(lsb < 0x80, `LSB ${lsb} >= 0x80 for val ${val}`);
  }
});

suite('sysex-codec — String Encoding');

test('encodeString/decodeString roundtrip — ASCII', () => {
  const original = 'Lead Synth';
  const encoded = encodeString(original);
  assert.equal(decodeString(encoded), original);
});

test('encodeString/decodeString roundtrip — empty string', () => {
  assert.equal(decodeString(encodeString('')), '');
});

test('encodeString produces all 7-bit safe bytes', () => {
  const encoded = encodeString('Hello World!');
  for (const b of encoded) {
    assert.ok(b < 0x80, `Byte ${b} >= 0x80`);
  }
});

suite('sysex-codec — JSON Encoding');

test('encodeJSON/decodeJSON roundtrip — simple object', () => {
  const obj = { tempo: 120, name: 'test' };
  const encoded = encodeJSON(obj);
  const decoded = decodeJSON(encoded);
  assert.deepEqual(decoded, obj);
});

test('encodeJSON/decodeJSON roundtrip — nested object', () => {
  const obj = { tempo: 120, sections: [{ name: 'Intro' }, { name: 'Verse' }] };
  const encoded = encodeJSON(obj);
  const decoded = decodeJSON(encoded);
  assert.deepEqual(decoded, obj);
});

test('encodeJSON produces all 7-bit safe nibbles', () => {
  const nibbles = encodeJSON({ test: true, value: 42 });
  for (const n of nibbles) {
    assert.ok(n < 0x80, `Nibble ${n} >= 0x80`);
  }
});

suite('sysex-codec — SysEx Frame Structure');

test('buildSysEx starts with F0 7D', () => {
  const frame = buildSysEx(0x01, [0x10, 0x20]);
  assert.equal(frame[0], 0xF0);
  assert.equal(frame[1], 0x7D);
});

test('buildSysEx ends with F7', () => {
  const frame = buildSysEx(0x01, [0x10, 0x20]);
  assert.equal(frame[frame.length - 1], 0xF7);
});

test('buildSysEx command byte in position 2', () => {
  const frame = buildSysEx(0x05, []);
  assert.equal(frame[2], 0x05);
});

test('buildSysEx correct frame length', () => {
  const payload = [0x01, 0x02, 0x03];
  const frame = buildSysEx(0x01, payload);
  // F0 + 7D + cmd + payload + F7 = 3 + payload.length + 1
  assert.equal(frame.length, 3 + payload.length + 1);
});

test('parseSysEx validates correct frames', () => {
  const frame = buildSysEx(SYSEX_CMD.SET_TEMPO, encode14bit(1200));
  const parsed = parseSysEx(frame);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.cmd, SYSEX_CMD.SET_TEMPO);
  assert.equal(parsed.cmdName, 'SET_TEMPO');
});

test('parseSysEx rejects frames without F0 start', () => {
  const parsed = parseSysEx(new Uint8Array([0x00, 0x7D, 0x01, 0xF7]));
  assert.equal(parsed.valid, false);
});

test('parseSysEx rejects frames without F7 end', () => {
  const parsed = parseSysEx(new Uint8Array([0xF0, 0x7D, 0x01, 0x00]));
  assert.equal(parsed.valid, false);
});

test('parseSysEx rejects wrong manufacturer ID', () => {
  const parsed = parseSysEx(new Uint8Array([0xF0, 0x43, 0x01, 0xF7]));
  assert.equal(parsed.valid, false);
  assert.equal(parsed.cmdName, 'UNKNOWN_MANUFACTURER');
});

test('parseSysEx rejects too-short frames', () => {
  const parsed = parseSysEx(new Uint8Array([0xF0, 0x7D]));
  assert.equal(parsed.valid, false);
});

suite('sysex-codec — All 32 Command Encoders Produce Valid SysEx');

const allEncoders = [
  ['VERSION_NEGOTIATE',   () => encodeVersionNegotiate(2)],
  ['SET_TEMPO',           () => encodeSetTempo(120.0)],
  ['SET_TRACK_VOLUME',    () => encodeSetTrackVolume(0, 100)],
  ['TRIGGER_CLIP',        () => encodeTriggerClip(0, 5)],
  ['SET_DEVICE_PARAM',    () => encodeSetDeviceParam(0, 0, 1, 64)],
  ['TRANSPORT',           () => encodeTransport(TRANSPORT.PLAY)],
  ['CREATE_MIDI_TRACK',   () => encodeCreateMidiTrack('Lead')],
  ['CREATE_AUDIO_TRACK',  () => encodeCreateAudioTrack('Drums')],
  ['SET_TRACK_SEND',      () => encodeSetTrackSend(0, 0, 100)],
  ['SET_TRACK_EQ',        () => encodeSetTrackEQ(0, 1, 10, 50, 64, 80)],
  ['ARM_TRACK',           () => encodeArmTrack(0, 1)],
  ['SET_CLIP_COLOR',      () => encodeSetClipColor(0, 0, 255, 128, 0)],
  ['SET_CLIP_NAME',       () => encodeSetClipName(0, 0, 'Verse')],
  ['QUANTIZE_CLIP',       () => encodeQuantizeClip(0, 0, QUANTIZE.Q_1_16)],
  ['DUPLICATE_CLIP',      () => encodeDuplicateClip(0, 0, 1, 0)],
  ['DELETE_CLIP',         () => encodeDeleteClip(0, 0)],
  ['STATUS_REQUEST',      () => encodeStatusRequest()],
  ['GET_TRACK_NAMES',     () => encodeGetTrackNames()],
  ['GET_DEVICE_CHAIN',    () => encodeGetDeviceChain(0)],
  ['SET_MACRO',           () => encodeSetMacro(0, 0, 3, 100)],
  ['LOAD_PRESET',         () => encodeLoadPreset(0, 0, 5)],
  ['CC_RECORD_ENABLE',    () => encodeCCRecordEnable(0, 1, 1)],
  ['SET_LOOP_REGION',     () => encodeSetLoopRegion(1, 1, 5, 1)],
  ['SET_TIME_SIGNATURE',  () => encodeSetTimeSignature(4, 4)],
  ['SET_TRACK_ROUTING',   () => encodeSetTrackRouting(0, 1, 0)],
  ['SOLO_TRACK',          () => encodeSoloTrack(0, 1)],
  ['MUTE_TRACK',          () => encodeMuteTrack(0, 1)],
  ['SET_SCENE_NAME',      () => encodeSetSceneName(0, 'Intro')],
  ['FIRE_SCENE',          () => encodeFireScene(3)],
  ['CAPTURE_MIDI',        () => encodeCaptureMidi()],
  ['CONSOLIDATE_CLIP',    () => encodeConsolidateClip(0, 0)],
  ['UNDO',                () => encodeUndo()],
];

for (const [name, encodeFn] of allEncoders) {
  test(`${name} produces valid SysEx`, () => {
    const frame = encodeFn();
    assert.ok(frame instanceof Uint8Array, 'Not a Uint8Array');
    assert.equal(frame[0], 0xF0, 'Missing F0');
    assert.equal(frame[1], 0x7D, 'Missing manufacturer ID');
    assert.equal(frame[frame.length - 1], 0xF7, 'Missing F7');
    // All data bytes < 0x80 (excluding start/end)
    for (let i = 1; i < frame.length - 1; i++) {
      assert.ok(frame[i] < 0x80, `Data byte at ${i} is ${frame[i]} (>= 0x80)`);
    }
  });
}

suite('sysex-codec — Decode Roundtrips');

test('SET_TEMPO(120.5) roundtrip', () => {
  const frame = encodeSetTempo(120.5);
  const decoded = decodeSysExCommand(frame);
  assert.equal(decoded.valid, true);
  assert.equal(decoded.cmdName, 'SET_TEMPO');
  assert.ok(Math.abs(decoded.bpm - 120.5) < 0.2);
});

test('SET_TRACK_VOLUME(3, 100) roundtrip', () => {
  const frame = encodeSetTrackVolume(3, 100);
  const decoded = decodeSysExCommand(frame);
  assert.equal(decoded.valid, true);
  assert.equal(decoded.track, 3);
  assert.equal(decoded.volume, 100);
});

test('TRIGGER_CLIP(0, 5) roundtrip', () => {
  const frame = encodeTriggerClip(0, 5);
  const decoded = decodeSysExCommand(frame);
  assert.equal(decoded.valid, true);
  assert.equal(decoded.track, 0);
  assert.equal(decoded.scene, 5);
});

test('CREATE_MIDI_TRACK("Lead Synth") roundtrip', () => {
  const frame = encodeCreateMidiTrack('Lead Synth');
  const decoded = decodeSysExCommand(frame);
  assert.equal(decoded.valid, true);
  assert.equal(decoded.name, 'Lead Synth');
});

test('SET_CLIP_COLOR(1, 2, 255, 128, 0) roundtrip', () => {
  const frame = encodeSetClipColor(1, 2, 255, 128, 0);
  const decoded = decodeSysExCommand(frame);
  assert.equal(decoded.valid, true);
  assert.equal(decoded.track, 1);
  assert.equal(decoded.scene, 2);
  // RGB roundtrip has ±2 tolerance due to 8→7→8 bit mapping
  assert.ok(Math.abs(decoded.r - 255) <= 2, `Red: ${decoded.r}`);
  assert.ok(Math.abs(decoded.g - 128) <= 2, `Green: ${decoded.g}`);
  assert.ok(Math.abs(decoded.b - 0) <= 2, `Blue: ${decoded.b}`);
});

test('AI_ARRANGEMENT roundtrip', () => {
  const arrangement = { tempo: 120, sections: [{ name: 'Intro' }] };
  const frame = encodeAIArrangement(arrangement);
  const decoded = decodeSysExCommand(frame);
  assert.equal(decoded.valid, true);
  assert.deepEqual(decoded.data, arrangement);
});

test('TRANSPORT(PLAY) roundtrip', () => {
  const frame = encodeTransport(TRANSPORT.PLAY);
  const decoded = decodeSysExCommand(frame);
  assert.equal(decoded.valid, true);
  assert.equal(decoded.action, TRANSPORT.PLAY);
  assert.equal(decoded.actionName, 'PLAY');
});

test('VERSION_NEGOTIATE(2) roundtrip', () => {
  const frame = encodeVersionNegotiate(2);
  const decoded = decodeSysExCommand(frame);
  assert.equal(decoded.valid, true);
  assert.equal(decoded.version, 2);
});

// ═════════════════════════════════════════════════════════════════
// Suite 3: Protocol Structure
// ═════════════════════════════════════════════════════════════════
suite('Protocol Structure');

test('Manufacturer ID is 0x7D', () => {
  assert.equal(MANUFACTURER_ID, 0x7D);
});

test('All data bytes in SysEx frames are < 0x80', () => {
  // Test several representative frames
  const frames = [
    encodeSetTempo(200),
    encodeCreateMidiTrack('Test Track'),
    encodeAIArrangement({ tempo: 120, sections: [{ name: 'A' }] }),
  ];
  for (const frame of frames) {
    for (let i = 1; i < frame.length - 1; i++) {
      assert.ok(frame[i] < 0x80, `Byte ${frame[i]} at pos ${i} >= 0x80`);
    }
  }
});

test('SysEx frames do not contain F0 or F7 in payload', () => {
  const frames = [
    encodeSetTempo(120),
    encodeTransport(TRANSPORT.RECORD),
    encodeCreateMidiTrack('Heavy Load'),
  ];
  for (const frame of frames) {
    // Check payload bytes only (positions 1 to length-2)
    for (let i = 1; i < frame.length - 1; i++) {
      assert.notEqual(frame[i], 0xF0, `F0 found in payload at pos ${i}`);
      assert.notEqual(frame[i], 0xF7, `F7 found in payload at pos ${i}`);
    }
  }
});

test('14-bit encoding handles edge case: 0', () => {
  const [msb, lsb] = encode14bit(0);
  assert.equal(msb, 0);
  assert.equal(lsb, 0);
  assert.equal(decode14bit(msb, lsb), 0);
});

test('14-bit encoding handles edge case: 16383', () => {
  const [msb, lsb] = encode14bit(16383);
  assert.equal(decode14bit(msb, lsb), 16383);
  assert.ok(msb < 0x80);
  assert.ok(lsb < 0x80);
});

test('RGB encoding maps [0,255] → [0,127] → back within ±2', () => {
  const testValues = [0, 64, 128, 192, 255];
  for (const r of testValues) {
    for (const g of testValues) {
      for (const b of testValues) {
        const [r7, g7, b7] = encodeRGB(r, g, b);
        assert.ok(r7 >= 0 && r7 <= 127, `r7=${r7} out of range`);
        assert.ok(g7 >= 0 && g7 <= 127, `g7=${g7} out of range`);
        assert.ok(b7 >= 0 && b7 <= 127, `b7=${b7} out of range`);
        const [rr, gg, bb] = decodeRGB(r7, g7, b7);
        assert.ok(Math.abs(rr - r) <= 2, `R: ${r} → ${r7} → ${rr}`);
        assert.ok(Math.abs(gg - g) <= 2, `G: ${g} → ${g7} → ${gg}`);
        assert.ok(Math.abs(bb - b) <= 2, `B: ${b} → ${b7} → ${bb}`);
      }
    }
  }
});

// ═════════════════════════════════════════════════════════════════
// Suite 4: Curve Functions
// ═════════════════════════════════════════════════════════════════
suite('Curve Functions');

test('LINEAR(0) = 0', () => {
  assert.equal(applyCurve(0, CURVE_TYPE.LINEAR), 0);
});

test('LINEAR(127) = 1', () => {
  assert.equal(applyCurve(127, CURVE_TYPE.LINEAR), 1);
});

test('LINEAR(64) ≈ 0.504', () => {
  const val = applyCurve(64, CURVE_TYPE.LINEAR);
  assert.ok(Math.abs(val - 64 / 127) < 0.001);
});

test('LOGARITHMIC curve is concave (midpoint > linear midpoint)', () => {
  const logMid = applyCurve(64, CURVE_TYPE.LOGARITHMIC);
  const linMid = applyCurve(64, CURVE_TYPE.LINEAR);
  assert.ok(logMid > linMid, `LOG(64)=${logMid} should be > LIN(64)=${linMid}`);
});

test('EXPONENTIAL curve is convex (midpoint < linear midpoint)', () => {
  const expMid = applyCurve(64, CURVE_TYPE.EXPONENTIAL);
  const linMid = applyCurve(64, CURVE_TYPE.LINEAR);
  assert.ok(expMid < linMid, `EXP(64)=${expMid} should be < LIN(64)=${linMid}`);
});

test('S_CURVE(64) ≈ 0.5', () => {
  const val = applyCurve(64, CURVE_TYPE.S_CURVE);
  assert.ok(Math.abs(val - 0.5) < 0.05, `S_CURVE(64) = ${val}, expected ≈ 0.5`);
});

test('BEZIER(0) = 0', () => {
  assert.equal(applyCurve(0, CURVE_TYPE.BEZIER), 0);
});

test('BEZIER(127) ≈ 1', () => {
  const val = applyCurve(127, CURVE_TYPE.BEZIER);
  assert.ok(Math.abs(val - 1) < 0.01, `BEZIER(127) = ${val}, expected ≈ 1`);
});

test('EXPONENTIAL(0) = 0', () => {
  assert.equal(applyCurve(0, CURVE_TYPE.EXPONENTIAL), 0);
});

test('LOGARITHMIC(0) = 0', () => {
  assert.equal(applyCurve(0, CURVE_TYPE.LOGARITHMIC), 0);
});

test('LOGARITHMIC(127) = 1', () => {
  const val = applyCurve(127, CURVE_TYPE.LOGARITHMIC);
  assert.ok(Math.abs(val - 1) < 0.01, `LOG(127) = ${val}`);
});

// ═════════════════════════════════════════════════════════════════
// Suite 5: φ-Math Validation
// ═════════════════════════════════════════════════════════════════
suite('φ-Math Validation');

test('PHI² ≈ PHI + 1', () => {
  assert.ok(Math.abs(PHI * PHI - (PHI + 1)) < 1e-10);
});

test('1/PHI ≈ PHI - 1', () => {
  assert.ok(Math.abs(1 / PHI - (PHI - 1)) < 1e-10);
});

test('FIB ratio convergence: FIB[19]/FIB[18] ≈ PHI within 0.001', () => {
  const ratio = FIB[19] / FIB[18];
  assert.ok(Math.abs(ratio - PHI) < 0.001, `Ratio = ${ratio}, PHI = ${PHI}`);
});

test('FIB ratios converge toward PHI monotonically', () => {
  let prevDiff = Infinity;
  for (let i = 3; i < FIB.length; i++) {
    const ratio = FIB[i] / FIB[i - 1];
    const diff = Math.abs(ratio - PHI);
    assert.ok(diff < prevDiff, `FIB[${i}]/FIB[${i - 1}] = ${ratio}, diverges from PHI`);
    prevDiff = diff;
  }
});

test('phiThreshold levels are monotonically increasing', () => {
  let prev = -Infinity;
  for (let level = 0; level <= 4; level++) {
    const t = phiThreshold(level);
    assert.ok(t > prev, `phiThreshold(${level})=${t} not > prev=${prev}`);
    prev = t;
  }
});

test('phiThreshold values are between 0 and 1', () => {
  for (let level = 0; level <= 4; level++) {
    const t = phiThreshold(level);
    assert.ok(t >= 0 && t <= 1, `phiThreshold(${level})=${t} out of [0,1]`);
  }
});

test('All VELOCITY levels are ordered', () => {
  const ordered = [VELOCITY.MINIMUM, VELOCITY.LOW, VELOCITY.MEDIUM, VELOCITY.CRITICAL, VELOCITY.MAXIMUM];
  for (let i = 1; i < ordered.length; i++) {
    assert.ok(ordered[i] >= ordered[i - 1],
      `VELOCITY order: ${ordered[i - 1]} should be <= ${ordered[i]}`);
  }
});

test('PSI² ≈ 0.382', () => {
  assert.ok(Math.abs(PSI2 - 0.382) < 0.001);
});

test('PSI³ ≈ 0.236', () => {
  assert.ok(Math.abs(PSI3 - 0.236) < 0.001);
});

test('PHI × PSI = 1 (golden ratio identity)', () => {
  assert.ok(Math.abs(PHI * PSI - 1) < 1e-10);
});

// ─── Summary ─────────────────────────────────────────────────────
console.log(`\n━━━ Results: ${passed}/${total} passed, ${failed} failed ━━━`);
process.exit(failed > 0 ? 1 : 0);
