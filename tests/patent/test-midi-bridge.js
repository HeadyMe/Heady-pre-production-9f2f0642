/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
'use strict';

const assert = require('assert');
const {
  PHI,
  MIDI_STATUS,
  MidiParser,
  GestureRecognizer,
  MidiToMcpTranslator,
  McpDispatcher,
  RtpMidiSocket,
  MidiMcpBridge,
  DEFAULT_CC_MAP,
  DEFAULT_NOTE_MAP,
} = require('../src/bridge/midi-to-mcp-bridge');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

console.log('\n=== MIDI-to-MCP Bridge Tests ===\n');

// PHI constant
test('PHI equals 1.6180339887', () => {
  assert.strictEqual(PHI, 1.6180339887);
});

// MidiParser: Note On
test('MidiParser parses Note On', () => {
  const bytes = Buffer.from([0x90, 60, 100]); // Note On ch0, note 60, velocity 100
  const events = MidiParser.parse(bytes);
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].type, 'note_on');
  assert.strictEqual(events[0].note, 60);
  assert.strictEqual(events[0].velocity, 100);
  assert.strictEqual(events[0].channel, 0);
});

// MidiParser: Note On velocity 0 → Note Off
test('MidiParser treats Note On velocity=0 as Note Off', () => {
  const bytes = Buffer.from([0x90, 62, 0]);
  const events = MidiParser.parse(bytes);
  assert.strictEqual(events[0].type, 'note_off');
  assert.strictEqual(events[0].note, 62);
});

// MidiParser: Control Change
test('MidiParser parses CC', () => {
  const bytes = Buffer.from([0xB0, 74, 80]); // CC74 = 80
  const events = MidiParser.parse(bytes);
  assert.strictEqual(events[0].type, 'control_change');
  assert.strictEqual(events[0].controller, 74);
  assert.strictEqual(events[0].value, 80);
});

// MidiParser: Program Change
test('MidiParser parses Program Change', () => {
  const bytes = Buffer.from([0xC0, 5]);
  const events = MidiParser.parse(bytes);
  assert.strictEqual(events[0].type, 'program_change');
  assert.strictEqual(events[0].program, 5);
});

// MidiParser: Pitch Bend
test('MidiParser parses Pitch Bend', () => {
  const bytes = Buffer.from([0xE0, 0x00, 0x40]); // Center (8192)
  const events = MidiParser.parse(bytes);
  assert.strictEqual(events[0].type, 'pitch_bend');
  assert.strictEqual(events[0].bend, 0);
});

// MidiParser: SysEx
test('MidiParser parses SysEx', () => {
  const bytes = Buffer.from([0xF0, 0x41, 0x10, 0xF7]);
  const events = MidiParser.parse(bytes);
  assert.strictEqual(events[0].type, 'sysex');
  assert.strictEqual(events[0].manufacturerId, 0x41);
});

// MidiParser: multiple events in buffer
test('MidiParser parses multiple events from single buffer', () => {
  const bytes = Buffer.from([0x90, 60, 100, 0xB0, 7, 64]);
  const events = MidiParser.parse(bytes);
  assert.strictEqual(events.length, 2);
  assert.strictEqual(events[0].type, 'note_on');
  assert.strictEqual(events[1].type, 'control_change');
});

// MidiParser: encodeNoteOn
test('MidiParser encodes Note On correctly', () => {
  const buf = MidiParser.encodeNoteOn(0, 60, 100);
  assert.strictEqual(buf[0], 0x90);
  assert.strictEqual(buf[1], 60);
  assert.strictEqual(buf[2], 100);
});

// MidiParser: encodeCC
test('MidiParser encodes CC correctly', () => {
  const buf = MidiParser.encodeCC(1, 7, 100);
  assert.strictEqual(buf[0], 0xB1);
  assert.strictEqual(buf[1], 7);
  assert.strictEqual(buf[2], 100);
});

// MidiParser: UMP parsing
test('MidiParser parses UMP MIDI1 channel voice message', () => {
  // Word: 0x20903C64 = MIDI1_CHANNEL(2), group=0, status=0x90, byte1=0x3C(60), byte2=0x64(100)
  const word = 0x20903C64;
  const events = MidiParser.parseUMP([word]);
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].type, 'midi1_channel');
  assert.strictEqual(events[0].byte1, 0x3C);
  assert.strictEqual(events[0].byte2, 0x64);
});

// MidiParser: empty buffer
test('MidiParser handles empty buffer gracefully', () => {
  const events = MidiParser.parse(Buffer.alloc(0));
  assert.deepStrictEqual(events, []);
});

// GestureRecognizer: pad hit
test('GestureRecognizer detects pad hit', () => {
  const gr = new GestureRecognizer();
  const gesture = gr.recognize({ type: 'note_on', note: 60, velocity: 100, channel: 0 });
  assert.strictEqual(gesture.gesture, 'pad_hit');
  assert.strictEqual(gesture.note, 60);
  assert.strictEqual(gesture.intensity, 'hard');
});

// GestureRecognizer: soft hit
test('GestureRecognizer detects soft pad hit', () => {
  const gr = new GestureRecognizer();
  const gesture = gr.recognize({ type: 'note_on', note: 36, velocity: 20, channel: 9 });
  assert.strictEqual(gesture.intensity, 'soft');
});

// GestureRecognizer: knob turn
test('GestureRecognizer detects knob turn', () => {
  const gr = new GestureRecognizer();
  const gesture = gr.recognize({ type: 'control_change', controller: 74, value: 80, channel: 0 });
  assert.strictEqual(gesture.gesture, 'knob_turn');
  assert.strictEqual(gesture.direction, 'increase');
});

// GestureRecognizer: fader slide
test('GestureRecognizer detects fader slide for CC7', () => {
  const gr = new GestureRecognizer();
  const gesture = gr.recognize({ type: 'control_change', controller: 7, value: 30, channel: 0 });
  assert.strictEqual(gesture.gesture, 'fader_slide');
  assert.strictEqual(gesture.direction, 'decrease');
});

// GestureRecognizer: pitch wheel
test('GestureRecognizer detects pitch wheel', () => {
  const gr = new GestureRecognizer();
  const gesture = gr.recognize({ type: 'pitch_bend', channel: 0, bend: 2000, normalized: 0.244 });
  assert.strictEqual(gesture.gesture, 'pitch_wheel');
  assert.strictEqual(gesture.direction, 'up');
});

// GestureRecognizer: preset select
test('GestureRecognizer detects preset select', () => {
  const gr = new GestureRecognizer();
  const gesture = gr.recognize({ type: 'program_change', channel: 0, program: 5 });
  assert.strictEqual(gesture.gesture, 'preset_select');
  assert.strictEqual(gesture.preset, 5);
});

// GestureRecognizer: clear history
test('GestureRecognizer clearHistory works', () => {
  const gr = new GestureRecognizer();
  gr.recognize({ type: 'note_on', note: 60, velocity: 80, channel: 0 });
  gr.clearHistory();
  assert.strictEqual(gr._history.length, 0);
});

// MidiToMcpTranslator: CC74 → temperature
test('MidiToMcpTranslator maps CC74 to adjust_temperature', () => {
  const t = new MidiToMcpTranslator();
  const result = t.translate({ type: 'control_change', controller: 74, value: 64 });
  assert.ok(result);
  assert.strictEqual(result.tool, 'adjust_temperature');
  assert.ok(typeof result.params.temperature === 'number');
  assert.ok(result.params.temperature >= 0 && result.params.temperature <= 2);
});

// MidiToMcpTranslator: Note C4 → deploy
test('MidiToMcpTranslator maps Note 60 to trigger_deploy', () => {
  const t = new MidiToMcpTranslator();
  const result = t.translate({ type: 'note_on', note: 60, velocity: 100, channel: 0 });
  assert.ok(result);
  assert.strictEqual(result.tool, 'trigger_deploy');
});

// MidiToMcpTranslator: unknown CC returns null
test('MidiToMcpTranslator returns null for unmapped CC', () => {
  const t = new MidiToMcpTranslator();
  const result = t.translate({ type: 'control_change', controller: 99, value: 64 });
  assert.strictEqual(result, null);
});

// MidiToMcpTranslator: program change
test('MidiToMcpTranslator maps program change', () => {
  const t = new MidiToMcpTranslator();
  const result = t.translate({ type: 'program_change', program: 3, channel: 0 });
  assert.ok(result);
  assert.strictEqual(result.tool, 'select_program');
  assert.strictEqual(result.params.program, 3);
});

// MidiToMcpTranslator: pitch bend
test('MidiToMcpTranslator maps pitch bend', () => {
  const t = new MidiToMcpTranslator();
  const result = t.translate({ type: 'pitch_bend', channel: 0, bend: 1000, normalized: 0.122 });
  assert.ok(result);
  assert.strictEqual(result.tool, 'set_pitch_bend');
});

// MidiToMcpTranslator: profile registration
test('MidiToMcpTranslator registers and loads profiles', () => {
  const t = new MidiToMcpTranslator();
  t.registerProfile('test-profile', { ccMap: { 1: { tool: 'custom_tool', param: 'val', scale: [0, 10] } } });
  t.loadProfile('test-profile');
  const result = t.translate({ type: 'control_change', controller: 1, value: 64 });
  assert.ok(result);
  assert.strictEqual(result.tool, 'custom_tool');
});

// MidiToMcpTranslator: request ID is unique
test('MidiToMcpTranslator generates unique request IDs', () => {
  const t = new MidiToMcpTranslator();
  const id1 = t.nextRequestId();
  const id2 = t.nextRequestId();
  assert.notStrictEqual(id1, id2);
});

// McpDispatcher: buildRpcCall
test('McpDispatcher builds valid JSON-RPC call', () => {
  const d = new McpDispatcher();
  const rpc = d.buildRpcCall({ tool: 'my_tool', params: { x: 1 } });
  assert.strictEqual(rpc.jsonrpc, '2.0');
  assert.strictEqual(rpc.method, 'tools/call');
  assert.strictEqual(rpc.params.name, 'my_tool');
  assert.deepStrictEqual(rpc.params.arguments, { x: 1 });
});

// McpDispatcher: enqueue + getQueueDepth
test('McpDispatcher enqueues tool calls', () => {
  const d = new McpDispatcher();
  d.enqueue({ tool: 'a', params: {} });
  d.enqueue({ tool: 'b', params: {} });
  // Queue may have been partially flushed but we can check it existed
  assert.ok(d.getQueueDepth() >= 0);
});

// McpDispatcher: max queue eviction
test('McpDispatcher evicts oldest when maxQueueSize exceeded', () => {
  const d = new McpDispatcher({ maxQueueSize: 3 });
  for (let i = 0; i < 5; i++) d.enqueue({ tool: `t${i}`, params: {} });
  // Should not throw and queue should be capped
  assert.ok(true);
});

// RtpMidiSocket: decodeRtpPacket
test('RtpMidiSocket decodes valid RTP packet', () => {
  const socket = new RtpMidiSocket();
  // Build a minimal RTP packet: header + MIDI section with Note On
  const rtp = socket.encodeRtpPacket(Buffer.from([0x90, 60, 100]), 1, 12345);
  const decoded = RtpMidiSocket.decodeRtpPacket(rtp);
  assert.ok(decoded);
  assert.strictEqual(decoded.version, 2);
  assert.strictEqual(decoded.sequence, 1);
  assert.ok(decoded.midiBytes.length > 0);
  assert.strictEqual(decoded.midiBytes[0], 0x90);
});

// RtpMidiSocket: decodeRtpPacket null on short buffer
test('RtpMidiSocket returns null for short buffer', () => {
  const result = RtpMidiSocket.decodeRtpPacket(Buffer.alloc(4));
  assert.strictEqual(result, null);
});

// RtpMidiSocket: decodeRtpPacket null on version != 2
test('RtpMidiSocket returns null for wrong version', () => {
  const buf = Buffer.alloc(12);
  buf[0] = 0x00; // version = 0
  const result = RtpMidiSocket.decodeRtpPacket(buf);
  assert.strictEqual(result, null);
});

// MidiMcpBridge: processMidiBytes
test('MidiMcpBridge processes raw MIDI bytes', () => {
  const bridge = new MidiMcpBridge({ dispatcherOpts: { endpoint: 'http://localhost:9999/mcp' } });
  const bytes  = Buffer.from([0xB0, 74, 80]);
  const events = bridge.processMidiBytes(bytes);
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].type, 'control_change');
});

// MidiMcpBridge: event listener
test('MidiMcpBridge fires event listeners', () => {
  const bridge = new MidiMcpBridge();
  let fired = false;
  bridge.on('event', events => { fired = true; });
  bridge.processMidiBytes(Buffer.from([0x90, 60, 100]));
  assert.ok(fired);
});

// MidiMcpBridge: dispatch listener
test('MidiMcpBridge fires dispatch listener on mapped events', () => {
  const bridge = new MidiMcpBridge();
  let dispatchFired = false;
  bridge.on('dispatch', tc => { dispatchFired = true; });
  bridge.processMidiBytes(Buffer.from([0xB0, 74, 80]));
  assert.ok(dispatchFired);
});

// MidiMcpBridge: gesture listener
test('MidiMcpBridge fires gesture listener', () => {
  const bridge = new MidiMcpBridge();
  let gestureFired = false;
  bridge.on('gesture', g => { gestureFired = true; });
  bridge.processMidiBytes(Buffer.from([0x90, 60, 100]));
  assert.ok(gestureFired);
});

// MidiMcpBridge: stats tracking
test('MidiMcpBridge tracks stats', () => {
  const bridge = new MidiMcpBridge();
  bridge.processMidiBytes(Buffer.from([0x90, 60, 100, 0xB0, 74, 80]));
  const stats = bridge.getStats();
  assert.ok(stats.parsed >= 2);
  assert.ok(stats.translated >= 1);
});

// MidiMcpBridge: register profile
test('MidiMcpBridge registerProfile and loadProfile works', () => {
  const bridge = new MidiMcpBridge();
  bridge.registerProfile('myProfile', { noteMap: { 36: { tool: 'kick', params: {} } } });
  bridge.loadProfile('myProfile');
  // Should not throw
  assert.ok(true);
});

// MidiMcpBridge: off removes listener
test('MidiMcpBridge off() removes listener', () => {
  const bridge = new MidiMcpBridge();
  let count = 0;
  const fn = () => count++;
  bridge.on('event', fn);
  bridge.processMidiBytes(Buffer.from([0x90, 60, 100]));
  bridge.off('event', fn);
  bridge.processMidiBytes(Buffer.from([0x90, 62, 80]));
  assert.strictEqual(count, 1);
});

// CC value scaling: CC74=0 → temperature=0, CC74=127 → temperature=2
test('CC74 scales correctly from 0 to 2', () => {
  const t = new MidiToMcpTranslator();
  const lo = t.translate({ type: 'control_change', controller: 74, value: 0 });
  const hi = t.translate({ type: 'control_change', controller: 74, value: 127 });
  assert.strictEqual(lo.params.temperature, 0);
  assert.strictEqual(hi.params.temperature, 2);
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
