/**
 * @fileoverview SysEx Codec — Encode/decode all 32 Heady SysEx commands.
 * Manufacturer ID 0x7D. Protocol version 2.
 * All payloads use 7-bit safe encoding per MIDI spec (data bytes 0x00-0x7F).
 * 
 * @module shared/sysex-codec
 * @version 2.0.0
 * @author HeadySystems™
 * 
 * ⚡ Made with 💜 by HeadySystems™ & HeadyConnection™
 * Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

import {
  MANUFACTURER_ID, SYSEX_VERSION, SYSEX_CMD, SYSEX_CMD_NAMES,
  STATUS, TRANSPORT, QUANTIZE,
} from './midi-constants.js';

// ─── 7-Bit Encoding Utilities ──────────────────────────────────────

/**
 * Encode a 14-bit value into two 7-bit bytes (MSB first).
 * Used for tempo (BPM × 10), position values, etc.
 * @param {number} value - 14-bit value (0-16383)
 * @returns {number[]} [msb, lsb] each 0-127
 */
export function encode14bit(value) {
  const clamped = Math.max(0, Math.min(16383, Math.round(value)));
  return [(clamped >> 7) & 0x7F, clamped & 0x7F];
}

/**
 * Decode two 7-bit bytes into a 14-bit value.
 * @param {number} msb - Most significant 7 bits
 * @param {number} lsb - Least significant 7 bits
 * @returns {number} 14-bit value (0-16383)
 */
export function decode14bit(msb, lsb) {
  return ((msb & 0x7F) << 7) | (lsb & 0x7F);
}

/**
 * Encode a string to 7-bit safe bytes (ASCII, chars > 127 are clamped).
 * @param {string} str - String to encode
 * @returns {number[]} Array of 7-bit bytes
 */
export function encodeString(str) {
  return Array.from(str).map(ch => Math.min(0x7F, ch.charCodeAt(0)));
}

/**
 * Decode 7-bit bytes to a string.
 * @param {number[]} bytes - Array of 7-bit bytes
 * @returns {string} Decoded string
 */
export function decodeString(bytes) {
  return bytes.map(b => String.fromCharCode(b & 0x7F)).join('');
}

/**
 * Encode a JSON object into 7-bit safe bytes.
 * Uses nibble encoding: each byte becomes two 7-bit nibbles.
 * @param {Object} obj - JSON-serializable object
 * @returns {number[]} 7-bit safe bytes
 */
export function encodeJSON(obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  const result = [];
  for (const b of bytes) {
    result.push((b >> 4) & 0x0F);    // High nibble (always < 0x10, so 7-bit safe)
    result.push(b & 0x0F);            // Low nibble
  }
  return result;
}

/**
 * Decode nibble-encoded bytes back to a JSON object.
 * @param {number[]} nibbles - Nibble-encoded bytes
 * @returns {Object} Decoded JSON object
 */
export function decodeJSON(nibbles) {
  const bytes = [];
  for (let i = 0; i < nibbles.length - 1; i += 2) {
    bytes.push(((nibbles[i] & 0x0F) << 4) | (nibbles[i + 1] & 0x0F));
  }
  const str = new TextDecoder().decode(new Uint8Array(bytes));
  return JSON.parse(str);
}

/**
 * Encode RGB color to three 7-bit values.
 * Maps 0-255 → 0-127 (half resolution, MIDI safe).
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {number[]} [r7, g7, b7] each 0-127
 */
export function encodeRGB(r, g, b) {
  return [
    Math.round((r / 255) * 127),
    Math.round((g / 255) * 127),
    Math.round((b / 255) * 127),
  ];
}

/**
 * Decode three 7-bit values back to RGB.
 * @param {number} r7 - Red (0-127)
 * @param {number} g7 - Green (0-127)
 * @param {number} b7 - Blue (0-127)
 * @returns {number[]} [r, g, b] each 0-255
 */
export function decodeRGB(r7, g7, b7) {
  return [
    Math.round((r7 / 127) * 255),
    Math.round((g7 / 127) * 255),
    Math.round((b7 / 127) * 255),
  ];
}

// ─── SysEx Frame Builder ───────────────────────────────────────────

/**
 * Build a complete SysEx frame: F0 7D <cmd> <payload...> F7
 * @param {number} cmd - Command byte from SYSEX_CMD
 * @param {number[]} payload - Data payload (7-bit values only)
 * @returns {Uint8Array} Complete SysEx frame
 */
export function buildSysEx(cmd, payload = []) {
  const frame = new Uint8Array(3 + payload.length + 1);
  frame[0] = STATUS.SYSEX_START;    // 0xF0
  frame[1] = MANUFACTURER_ID;        // 0x7D
  frame[2] = cmd & 0x7F;
  for (let i = 0; i < payload.length; i++) {
    frame[3 + i] = payload[i] & 0x7F;
  }
  frame[frame.length - 1] = STATUS.SYSEX_END; // 0xF7
  return frame;
}

/**
 * Parse a SysEx frame, extracting command and payload.
 * @param {Uint8Array|number[]} data - Raw SysEx bytes
 * @returns {{ cmd: number, cmdName: string, payload: number[], valid: boolean, version: number|null }}
 */
export function parseSysEx(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

  if (bytes.length < 4 || bytes[0] !== STATUS.SYSEX_START || bytes[bytes.length - 1] !== STATUS.SYSEX_END) {
    return { cmd: 0, cmdName: 'INVALID', payload: [], valid: false, version: null };
  }
  if (bytes[1] !== MANUFACTURER_ID) {
    return { cmd: 0, cmdName: 'UNKNOWN_MANUFACTURER', payload: [], valid: false, version: null };
  }

  const cmd = bytes[2];
  const payload = Array.from(bytes.slice(3, bytes.length - 1));
  const cmdName = SYSEX_CMD_NAMES[cmd] || `UNKNOWN_0x${cmd.toString(16).padStart(2, '0')}`;

  return { cmd, cmdName, payload, valid: true, version: SYSEX_VERSION };
}

// ─── Command Encoders ──────────────────────────────────────────────
// Each returns a complete SysEx Uint8Array ready to send.

/**
 * 0x00 VERSION_NEGOTIATE — Request or respond with protocol version.
 * Frame: F0 7D 00 <version> F7
 * @param {number} [version=SYSEX_VERSION] - Protocol version
 * @returns {Uint8Array}
 */
export function encodeVersionNegotiate(version = SYSEX_VERSION) {
  return buildSysEx(SYSEX_CMD.VERSION_NEGOTIATE, [version & 0x7F]);
}

/**
 * 0x01 SET_TEMPO — Set BPM (14-bit: BPM × 10 for 0.1 BPM resolution).
 * @param {number} bpm - Beats per minute (20.0 - 999.9)
 * @returns {Uint8Array}
 */
export function encodeSetTempo(bpm) {
  return buildSysEx(SYSEX_CMD.SET_TEMPO, encode14bit(Math.round(bpm * 10)));
}

/** Decode SET_TEMPO payload → BPM */
export function decodeSetTempo(payload) {
  return decode14bit(payload[0], payload[1]) / 10;
}

/**
 * 0x02 SET_TRACK_VOLUME — Set track volume (0-127).
 * @param {number} track - Track index (0-127)
 * @param {number} volume - Volume (0-127)
 * @returns {Uint8Array}
 */
export function encodeSetTrackVolume(track, volume) {
  return buildSysEx(SYSEX_CMD.SET_TRACK_VOLUME, [track & 0x7F, volume & 0x7F]);
}

/**
 * 0x03 TRIGGER_CLIP — Trigger a clip in Ableton.
 * @param {number} track - Track index
 * @param {number} scene - Scene index
 * @returns {Uint8Array}
 */
export function encodeTriggerClip(track, scene) {
  return buildSysEx(SYSEX_CMD.TRIGGER_CLIP, [track & 0x7F, scene & 0x7F]);
}

/**
 * 0x04 SET_DEVICE_PARAM — Set a device parameter value.
 * @param {number} track - Track index
 * @param {number} device - Device index in chain
 * @param {number} param - Parameter index
 * @param {number} value - Parameter value (0-127)
 * @returns {Uint8Array}
 */
export function encodeSetDeviceParam(track, device, param, value) {
  return buildSysEx(SYSEX_CMD.SET_DEVICE_PARAM, [
    track & 0x7F, device & 0x7F, param & 0x7F, value & 0x7F,
  ]);
}

/**
 * 0x05 TRANSPORT — Control transport (play, stop, record, etc.).
 * @param {number} action - TRANSPORT enum value
 * @returns {Uint8Array}
 */
export function encodeTransport(action) {
  return buildSysEx(SYSEX_CMD.TRANSPORT, [action & 0x7F]);
}

/**
 * 0x06 CREATE_MIDI_TRACK — Create a new MIDI track.
 * @param {string} name - Track name
 * @returns {Uint8Array}
 */
export function encodeCreateMidiTrack(name) {
  return buildSysEx(SYSEX_CMD.CREATE_MIDI_TRACK, encodeString(name));
}

/**
 * 0x07 CREATE_AUDIO_TRACK — Create a new audio track.
 * @param {string} name - Track name
 * @returns {Uint8Array}
 */
export function encodeCreateAudioTrack(name) {
  return buildSysEx(SYSEX_CMD.CREATE_AUDIO_TRACK, encodeString(name));
}

/**
 * 0x08 SET_TRACK_SEND — Set send level.
 * @param {number} track - Track index
 * @param {number} send - Send index
 * @param {number} value - Send level (0-127)
 * @returns {Uint8Array}
 */
export function encodeSetTrackSend(track, send, value) {
  return buildSysEx(SYSEX_CMD.SET_TRACK_SEND, [track & 0x7F, send & 0x7F, value & 0x7F]);
}

/**
 * 0x09 SET_TRACK_EQ — Set EQ band parameters.
 * @param {number} track - Track index
 * @param {number} band - EQ band index
 * @param {number} freqHi - Frequency high byte (14-bit split)
 * @param {number} freqLo - Frequency low byte
 * @param {number} gain - Gain (0-127, 64 = 0dB)
 * @param {number} q - Q factor (0-127)
 * @returns {Uint8Array}
 */
export function encodeSetTrackEQ(track, band, freqHi, freqLo, gain, q) {
  return buildSysEx(SYSEX_CMD.SET_TRACK_EQ, [
    track & 0x7F, band & 0x7F, freqHi & 0x7F, freqLo & 0x7F, gain & 0x7F, q & 0x7F,
  ]);
}

/**
 * 0x0A ARM_TRACK — Arm track for recording.
 * @param {number} track - Track index
 * @param {number} armState - 1 = arm, 0 = disarm
 * @returns {Uint8Array}
 */
export function encodeArmTrack(track, armState) {
  return buildSysEx(SYSEX_CMD.ARM_TRACK, [track & 0x7F, armState ? 1 : 0]);
}

/**
 * 0x0B SET_CLIP_COLOR — Set clip color (RGB).
 * @param {number} track - Track index
 * @param {number} scene - Scene index
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {Uint8Array}
 */
export function encodeSetClipColor(track, scene, r, g, b) {
  return buildSysEx(SYSEX_CMD.SET_CLIP_COLOR, [
    track & 0x7F, scene & 0x7F, ...encodeRGB(r, g, b),
  ]);
}

/**
 * 0x0C SET_CLIP_NAME — Set clip name.
 * @param {number} track - Track index
 * @param {number} scene - Scene index
 * @param {string} name - Clip name
 * @returns {Uint8Array}
 */
export function encodeSetClipName(track, scene, name) {
  return buildSysEx(SYSEX_CMD.SET_CLIP_NAME, [track & 0x7F, scene & 0x7F, ...encodeString(name)]);
}

/**
 * 0x0D QUANTIZE_CLIP — Quantize a clip.
 * @param {number} track - Track index
 * @param {number} scene - Scene index
 * @param {number} quantizeValue - QUANTIZE enum value
 * @returns {Uint8Array}
 */
export function encodeQuantizeClip(track, scene, quantizeValue) {
  return buildSysEx(SYSEX_CMD.QUANTIZE_CLIP, [track & 0x7F, scene & 0x7F, quantizeValue & 0x7F]);
}

/**
 * 0x0E DUPLICATE_CLIP — Duplicate a clip.
 * @param {number} srcTrack - Source track
 * @param {number} srcScene - Source scene
 * @param {number} dstTrack - Destination track
 * @param {number} dstScene - Destination scene
 * @returns {Uint8Array}
 */
export function encodeDuplicateClip(srcTrack, srcScene, dstTrack, dstScene) {
  return buildSysEx(SYSEX_CMD.DUPLICATE_CLIP, [
    srcTrack & 0x7F, srcScene & 0x7F, dstTrack & 0x7F, dstScene & 0x7F,
  ]);
}

/**
 * 0x0F DELETE_CLIP — Delete a clip.
 * @param {number} track - Track index
 * @param {number} scene - Scene index
 * @returns {Uint8Array}
 */
export function encodeDeleteClip(track, scene) {
  return buildSysEx(SYSEX_CMD.DELETE_CLIP, [track & 0x7F, scene & 0x7F]);
}

/**
 * 0x10 STATUS_REQUEST — Request status (returns JSON state via SysEx response).
 * @returns {Uint8Array}
 */
export function encodeStatusRequest() {
  return buildSysEx(SYSEX_CMD.STATUS_REQUEST, []);
}

/**
 * 0x11 GET_TRACK_NAMES — Request track names.
 * @returns {Uint8Array}
 */
export function encodeGetTrackNames() {
  return buildSysEx(SYSEX_CMD.GET_TRACK_NAMES, []);
}

/**
 * 0x12 GET_DEVICE_CHAIN — Request device chain for a track.
 * @param {number} track - Track index
 * @returns {Uint8Array}
 */
export function encodeGetDeviceChain(track) {
  return buildSysEx(SYSEX_CMD.GET_DEVICE_CHAIN, [track & 0x7F]);
}

/**
 * 0x13 SET_MACRO — Set macro knob value.
 * @param {number} track - Track index
 * @param {number} device - Device index
 * @param {number} macroIndex - Macro knob index (0-7)
 * @param {number} value - Value (0-127)
 * @returns {Uint8Array}
 */
export function encodeSetMacro(track, device, macroIndex, value) {
  return buildSysEx(SYSEX_CMD.SET_MACRO, [
    track & 0x7F, device & 0x7F, macroIndex & 0x7F, value & 0x7F,
  ]);
}

/**
 * 0x14 LOAD_PRESET — Load a preset for a device.
 * @param {number} track - Track index
 * @param {number} device - Device index
 * @param {number} presetIndex - Preset index
 * @returns {Uint8Array}
 */
export function encodeLoadPreset(track, device, presetIndex) {
  return buildSysEx(SYSEX_CMD.LOAD_PRESET, [track & 0x7F, device & 0x7F, presetIndex & 0x7F]);
}

/**
 * 0x15 CC_RECORD_ENABLE — Enable/disable CC recording.
 * @param {number} track - Track index
 * @param {number} ccNumber - CC number to record
 * @param {number} enable - 1 = enable, 0 = disable
 * @returns {Uint8Array}
 */
export function encodeCCRecordEnable(track, ccNumber, enable) {
  return buildSysEx(SYSEX_CMD.CC_RECORD_ENABLE, [track & 0x7F, ccNumber & 0x7F, enable ? 1 : 0]);
}

/**
 * 0x16 SET_LOOP_REGION — Set loop region.
 * @param {number} startBar - Start bar
 * @param {number} startBeat - Start beat
 * @param {number} endBar - End bar
 * @param {number} endBeat - End beat
 * @returns {Uint8Array}
 */
export function encodeSetLoopRegion(startBar, startBeat, endBar, endBeat) {
  return buildSysEx(SYSEX_CMD.SET_LOOP_REGION, [
    startBar & 0x7F, startBeat & 0x7F, endBar & 0x7F, endBeat & 0x7F,
  ]);
}

/**
 * 0x17 SET_TIME_SIGNATURE — Set time signature.
 * @param {number} numerator - Beats per bar (e.g., 4)
 * @param {number} denominator - Beat unit (e.g., 4)
 * @returns {Uint8Array}
 */
export function encodeSetTimeSignature(numerator, denominator) {
  return buildSysEx(SYSEX_CMD.SET_TIME_SIGNATURE, [numerator & 0x7F, denominator & 0x7F]);
}

/**
 * 0x18 SET_TRACK_ROUTING — Set track input routing.
 * @param {number} track - Track index
 * @param {number} inputType - Input type (0=no input, 1=ext, 2=track)
 * @param {number} inputChannel - Input channel/sub-route
 * @returns {Uint8Array}
 */
export function encodeSetTrackRouting(track, inputType, inputChannel) {
  return buildSysEx(SYSEX_CMD.SET_TRACK_ROUTING, [track & 0x7F, inputType & 0x7F, inputChannel & 0x7F]);
}

/**
 * 0x19 SOLO_TRACK — Solo/unsolo a track.
 * @param {number} track - Track index
 * @param {number} soloState - 1 = solo, 0 = unsolo
 * @returns {Uint8Array}
 */
export function encodeSoloTrack(track, soloState) {
  return buildSysEx(SYSEX_CMD.SOLO_TRACK, [track & 0x7F, soloState ? 1 : 0]);
}

/**
 * 0x1A MUTE_TRACK — Mute/unmute a track.
 * @param {number} track - Track index
 * @param {number} muteState - 1 = mute, 0 = unmute
 * @returns {Uint8Array}
 */
export function encodeMuteTrack(track, muteState) {
  return buildSysEx(SYSEX_CMD.MUTE_TRACK, [track & 0x7F, muteState ? 1 : 0]);
}

/**
 * 0x1B SET_SCENE_NAME — Set a scene name.
 * @param {number} scene - Scene index
 * @param {string} name - Scene name
 * @returns {Uint8Array}
 */
export function encodeSetSceneName(scene, name) {
  return buildSysEx(SYSEX_CMD.SET_SCENE_NAME, [scene & 0x7F, ...encodeString(name)]);
}

/**
 * 0x1C FIRE_SCENE — Fire (launch) a scene.
 * @param {number} sceneIndex - Scene index
 * @returns {Uint8Array}
 */
export function encodeFireScene(sceneIndex) {
  return buildSysEx(SYSEX_CMD.FIRE_SCENE, [sceneIndex & 0x7F]);
}

/**
 * 0x1D CAPTURE_MIDI — Start capturing all incoming MIDI.
 * @returns {Uint8Array}
 */
export function encodeCaptureMidi() {
  return buildSysEx(SYSEX_CMD.CAPTURE_MIDI, []);
}

/**
 * 0x1E CONSOLIDATE_CLIP — Consolidate a clip.
 * @param {number} track - Track index
 * @param {number} scene - Scene index
 * @returns {Uint8Array}
 */
export function encodeConsolidateClip(track, scene) {
  return buildSysEx(SYSEX_CMD.CONSOLIDATE_CLIP, [track & 0x7F, scene & 0x7F]);
}

/**
 * 0x1F UNDO — Undo last action.
 * @returns {Uint8Array}
 */
export function encodeUndo() {
  return buildSysEx(SYSEX_CMD.UNDO, []);
}

/**
 * 0x20 AI_ARRANGEMENT — Send AI arrangement data as JSON.
 * @param {Object} arrangement - Arrangement config { tempo, sections: [...] }
 * @returns {Uint8Array}
 */
export function encodeAIArrangement(arrangement) {
  return buildSysEx(SYSEX_CMD.AI_ARRANGEMENT, encodeJSON(arrangement));
}

/** Decode AI_ARRANGEMENT payload → arrangement object */
export function decodeAIArrangement(payload) {
  return decodeJSON(payload);
}

/**
 * 0x21 AI_GENERATE_PATTERN — Request AI pattern generation.
 * @param {Object} params - Pattern generation params { style, bars, key, scale }
 * @returns {Uint8Array}
 */
export function encodeAIGeneratePattern(params) {
  return buildSysEx(SYSEX_CMD.AI_GENERATE_PATTERN, encodeJSON(params));
}

// ─── Master Decoder ────────────────────────────────────────────────

/**
 * Decode any SysEx frame into a structured command object.
 * @param {Uint8Array|number[]} data - Raw SysEx frame
 * @returns {Object} Decoded command with type-specific fields
 */
export function decodeSysExCommand(data) {
  const { cmd, cmdName, payload, valid } = parseSysEx(data);
  if (!valid) return { valid: false, cmd, cmdName };

  const result = { valid: true, cmd, cmdName };

  switch (cmd) {
    case SYSEX_CMD.VERSION_NEGOTIATE:
      result.version = payload[0] || 1;
      break;
    case SYSEX_CMD.SET_TEMPO:
      result.bpm = decode14bit(payload[0], payload[1]) / 10;
      break;
    case SYSEX_CMD.SET_TRACK_VOLUME:
      result.track = payload[0]; result.volume = payload[1];
      break;
    case SYSEX_CMD.TRIGGER_CLIP:
      result.track = payload[0]; result.scene = payload[1];
      break;
    case SYSEX_CMD.SET_DEVICE_PARAM:
      result.track = payload[0]; result.device = payload[1];
      result.param = payload[2]; result.value = payload[3];
      break;
    case SYSEX_CMD.TRANSPORT:
      result.action = payload[0];
      result.actionName = Object.entries(TRANSPORT).find(([, v]) => v === payload[0])?.[0] || 'UNKNOWN';
      break;
    case SYSEX_CMD.CREATE_MIDI_TRACK:
    case SYSEX_CMD.CREATE_AUDIO_TRACK:
      result.name = decodeString(payload);
      break;
    case SYSEX_CMD.SET_TRACK_SEND:
      result.track = payload[0]; result.send = payload[1]; result.value = payload[2];
      break;
    case SYSEX_CMD.SET_TRACK_EQ:
      result.track = payload[0]; result.band = payload[1];
      result.freq = decode14bit(payload[2], payload[3]);
      result.gain = payload[4]; result.q = payload[5];
      break;
    case SYSEX_CMD.ARM_TRACK:
      result.track = payload[0]; result.armed = payload[1] === 1;
      break;
    case SYSEX_CMD.SET_CLIP_COLOR:
      result.track = payload[0]; result.scene = payload[1];
      [result.r, result.g, result.b] = decodeRGB(payload[2], payload[3], payload[4]);
      break;
    case SYSEX_CMD.SET_CLIP_NAME:
      result.track = payload[0]; result.scene = payload[1];
      result.name = decodeString(payload.slice(2));
      break;
    case SYSEX_CMD.QUANTIZE_CLIP:
      result.track = payload[0]; result.scene = payload[1]; result.quantize = payload[2];
      break;
    case SYSEX_CMD.DUPLICATE_CLIP:
      result.srcTrack = payload[0]; result.srcScene = payload[1];
      result.dstTrack = payload[2]; result.dstScene = payload[3];
      break;
    case SYSEX_CMD.DELETE_CLIP:
      result.track = payload[0]; result.scene = payload[1];
      break;
    case SYSEX_CMD.STATUS_REQUEST:
    case SYSEX_CMD.GET_TRACK_NAMES:
      break; // No payload to decode
    case SYSEX_CMD.GET_DEVICE_CHAIN:
      result.track = payload[0];
      break;
    case SYSEX_CMD.SET_MACRO:
      result.track = payload[0]; result.device = payload[1];
      result.macroIndex = payload[2]; result.value = payload[3];
      break;
    case SYSEX_CMD.LOAD_PRESET:
      result.track = payload[0]; result.device = payload[1]; result.presetIndex = payload[2];
      break;
    case SYSEX_CMD.CC_RECORD_ENABLE:
      result.track = payload[0]; result.ccNumber = payload[1]; result.enabled = payload[2] === 1;
      break;
    case SYSEX_CMD.SET_LOOP_REGION:
      result.startBar = payload[0]; result.startBeat = payload[1];
      result.endBar = payload[2]; result.endBeat = payload[3];
      break;
    case SYSEX_CMD.SET_TIME_SIGNATURE:
      result.numerator = payload[0]; result.denominator = payload[1];
      break;
    case SYSEX_CMD.SET_TRACK_ROUTING:
      result.track = payload[0]; result.inputType = payload[1]; result.inputChannel = payload[2];
      break;
    case SYSEX_CMD.SOLO_TRACK:
      result.track = payload[0]; result.solo = payload[1] === 1;
      break;
    case SYSEX_CMD.MUTE_TRACK:
      result.track = payload[0]; result.mute = payload[1] === 1;
      break;
    case SYSEX_CMD.SET_SCENE_NAME:
      result.scene = payload[0]; result.name = decodeString(payload.slice(1));
      break;
    case SYSEX_CMD.FIRE_SCENE:
      result.sceneIndex = payload[0];
      break;
    case SYSEX_CMD.CAPTURE_MIDI:
    case SYSEX_CMD.UNDO:
      break; // No payload
    case SYSEX_CMD.CONSOLIDATE_CLIP:
      result.track = payload[0]; result.scene = payload[1];
      break;
    case SYSEX_CMD.AI_ARRANGEMENT:
    case SYSEX_CMD.AI_GENERATE_PATTERN:
      try { result.data = decodeJSON(payload); } catch { result.data = null; result.decodeError = true; }
      break;
    default:
      result.rawPayload = payload;
  }

  return result;
}
