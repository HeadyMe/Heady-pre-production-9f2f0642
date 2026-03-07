/**
 * @fileoverview Heady SysEx Protocol V2 — Max for Live JavaScript Device
 * Receives and dispatches all 32 SysEx commands on manufacturer ID 0x7D.
 * Handles version negotiation, Ableton Live API integration, AI arrangement
 * execution, and bidirectional SysEx query/response flow.
 *
 * In M4L context: uses `inlets`, `outlets`, and the Max API (`LiveAPI`).
 * The HeadySysExHandler class is exported for external testing.
 *
 * @module edge/heady-sysex-protocol-v2
 * @version 2.0.0
 * @author HeadySystems™
 * @license Proprietary — HeadySystems™ & HeadyConnection™
 *
 * ⚡ Made with 💜 by HeadySystems™ & HeadyConnection™
 * Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

import {
  MANUFACTURER_ID, SYSEX_VERSION, SYSEX_CMD, SYSEX_CMD_NAMES,
  STATUS, TRANSPORT, CHANNEL, NOTE, VELOCITY,
  PHI, PSI, FIB,
  DEFAULT_BPM, DEFAULT_PPQ, PHI_SWING,
} from '../shared/midi-constants.js';

import {
  decodeSysExCommand, parseSysEx, buildSysEx,
  encodeJSON, encodeString, encode14bit,
} from '../shared/sysex-codec.js';

// ─── M4L Globals (provided by Max runtime) ────────────────────────
/* global inlets, outlets, post, outlet, LiveAPI, Task */

/** Number of inlets: [0] = SysEx bytes */
const INLET_COUNT = 1;
/** Number of outlets: [0] = SysEx response, [1] = status/debug */
const OUTLET_COUNT = 2;

/** Protocol version supported by this device */
const SUPPORTED_PROTOCOL_VERSION = SYSEX_VERSION;

/** φ-derived scheduling quantum (ms) for sequential AI arrangement steps */
const SCHEDULE_QUANTUM_MS = Math.round(FIB[7] * PSI); // ≈ 8ms

/** Maximum sections in a single AI arrangement payload */
const MAX_ARRANGEMENT_SECTIONS = FIB[10]; // 55

/** Heartbeat interval (ms) — Fibonacci-scaled */
const HEARTBEAT_INTERVAL_MS = FIB[13] * FIB[3]; // 377 × 2 = 754ms

// ─── Ableton Live API Wrapper ─────────────────────────────────────

/**
 * Thin wrapper around the M4L LiveAPI for testability.
 * In a non-M4L environment, methods gracefully no-op.
 */
class AbletonLiveProxy {
  /** @param {Function} logFn - Logging function (post in M4L, console.log in Node) */
  constructor(logFn) {
    this._log = logFn;
    this._hasLiveAPI = typeof LiveAPI !== 'undefined';
  }

  /**
   * Get a LiveAPI handle for the given path.
   * @param {string} path - Live Object Model path (e.g., 'live_set tracks 0')
   * @returns {Object|null} LiveAPI instance or null if outside M4L
   */
  _api(path) {
    if (!this._hasLiveAPI) return null;
    try {
      return new LiveAPI(path);
    } catch (err) {
      this._log(`[LiveAPI] Error resolving path "${path}": ${err.message}`);
      return null;
    }
  }

  /**
   * Set a track's mixer volume.
   * @param {number} trackIdx - Zero-based track index
   * @param {number} volume - Volume 0-127, mapped to 0.0-1.0
   */
  setTrackVolume(trackIdx, volume) {
    const api = this._api(`live_set tracks ${trackIdx} mixer_device volume`);
    if (api) {
      api.set('value', volume / 127);
    }
    this._log(`[Track ${trackIdx}] Volume → ${volume}`);
  }

  /**
   * Fire (launch) a clip at track/scene intersection.
   * @param {number} trackIdx - Track index
   * @param {number} sceneIdx - Scene index
   */
  triggerClip(trackIdx, sceneIdx) {
    const api = this._api(`live_set tracks ${trackIdx} clip_slots ${sceneIdx} clip`);
    if (api) {
      api.call('fire');
    }
    this._log(`[Clip] Fire track=${trackIdx} scene=${sceneIdx}`);
  }

  /**
   * Set a device parameter value.
   * @param {number} trackIdx - Track index
   * @param {number} deviceIdx - Device chain index
   * @param {number} paramIdx - Parameter index
   * @param {number} value - Value 0-127, mapped to param range
   */
  setDeviceParam(trackIdx, deviceIdx, paramIdx, value) {
    const api = this._api(
      `live_set tracks ${trackIdx} devices ${deviceIdx} parameters ${paramIdx}`
    );
    if (api) {
      const min = parseFloat(api.get('min')) || 0;
      const max = parseFloat(api.get('max')) || 1;
      const mapped = min + (value / 127) * (max - min);
      api.set('value', mapped);
    }
    this._log(`[Device] track=${trackIdx} dev=${deviceIdx} param=${paramIdx} → ${value}`);
  }

  /**
   * Control transport (play, stop, record, etc.).
   * @param {number} action - TRANSPORT enum value
   */
  transport(action) {
    const api = this._api('live_set');
    if (!api) {
      this._log(`[Transport] ${action} (no LiveAPI)`);
      return;
    }
    switch (action) {
      case TRANSPORT.STOP:    api.call('stop_playing'); break;
      case TRANSPORT.PLAY:    api.call('start_playing'); break;
      case TRANSPORT.RECORD:  api.set('record_mode', 1); break;
      case TRANSPORT.PAUSE:   api.call('stop_playing'); break;
      case TRANSPORT.REWIND:  api.set('current_song_time', 0); break;
      default: this._log(`[Transport] Unknown action: ${action}`);
    }
  }

  /**
   * Set the song tempo.
   * @param {number} bpm - Beats per minute
   */
  setTempo(bpm) {
    const api = this._api('live_set');
    if (api) {
      api.set('tempo', bpm);
    }
    this._log(`[Tempo] → ${bpm} BPM`);
  }

  /**
   * Create a new MIDI track.
   * @param {string} name - Track name
   * @returns {number} New track index
   */
  createMidiTrack(name) {
    const api = this._api('live_set');
    if (api) {
      const count = parseInt(api.get('tracks').length, 10) || 0;
      api.call('create_midi_track', count);
      const trackApi = this._api(`live_set tracks ${count}`);
      if (trackApi) trackApi.set('name', name);
      this._log(`[Track] Created MIDI track "${name}" at index ${count}`);
      return count;
    }
    this._log(`[Track] Create MIDI track "${name}" (no LiveAPI)`);
    return -1;
  }

  /**
   * Create a new audio track.
   * @param {string} name - Track name
   * @returns {number} New track index
   */
  createAudioTrack(name) {
    const api = this._api('live_set');
    if (api) {
      const count = parseInt(api.get('tracks').length, 10) || 0;
      api.call('create_audio_track', count);
      const trackApi = this._api(`live_set tracks ${count}`);
      if (trackApi) trackApi.set('name', name);
      this._log(`[Track] Created audio track "${name}" at index ${count}`);
      return count;
    }
    this._log(`[Track] Create audio track "${name}" (no LiveAPI)`);
    return -1;
  }

  /**
   * Set a track send level.
   * @param {number} trackIdx - Track index
   * @param {number} sendIdx - Send index
   * @param {number} value - Level 0-127
   */
  setTrackSend(trackIdx, sendIdx, value) {
    const api = this._api(`live_set tracks ${trackIdx} mixer_device sends ${sendIdx}`);
    if (api) {
      api.set('value', value / 127);
    }
    this._log(`[Send] track=${trackIdx} send=${sendIdx} → ${value}`);
  }

  /**
   * Arm or disarm a track for recording.
   * @param {number} trackIdx - Track index
   * @param {boolean} armed - Arm state
   */
  armTrack(trackIdx, armed) {
    const api = this._api(`live_set tracks ${trackIdx}`);
    if (api) {
      api.set('arm', armed ? 1 : 0);
    }
    this._log(`[Arm] track=${trackIdx} armed=${armed}`);
  }

  /**
   * Solo or unsolo a track.
   * @param {number} trackIdx - Track index
   * @param {boolean} solo - Solo state
   */
  soloTrack(trackIdx, solo) {
    const api = this._api(`live_set tracks ${trackIdx}`);
    if (api) {
      api.set('solo', solo ? 1 : 0);
    }
    this._log(`[Solo] track=${trackIdx} solo=${solo}`);
  }

  /**
   * Mute or unmute a track.
   * @param {number} trackIdx - Track index
   * @param {boolean} mute - Mute state
   */
  muteTrack(trackIdx, mute) {
    const api = this._api(`live_set tracks ${trackIdx}`);
    if (api) {
      api.set('mute', mute ? 1 : 0);
    }
    this._log(`[Mute] track=${trackIdx} mute=${mute}`);
  }

  /**
   * Fire a scene by index.
   * @param {number} sceneIdx - Scene index
   */
  fireScene(sceneIdx) {
    const api = this._api(`live_set scenes ${sceneIdx}`);
    if (api) {
      api.call('fire');
    }
    this._log(`[Scene] Fire scene=${sceneIdx}`);
  }

  /**
   * Undo the last action.
   */
  undo() {
    const api = this._api('live_set');
    if (api) {
      api.call('undo');
    }
    this._log('[Undo] Triggered');
  }

  /**
   * Capture MIDI.
   */
  captureMidi() {
    const api = this._api('live_set');
    if (api) {
      api.call('capture_midi');
    }
    this._log('[Capture] MIDI captured');
  }

  /**
   * Query track names in the current set.
   * @returns {string[]} Array of track names
   */
  getTrackNames() {
    const api = this._api('live_set');
    if (!api) return [];
    const count = parseInt(api.get('tracks').length, 10) || 0;
    const names = [];
    for (let i = 0; i < count; i++) {
      const t = this._api(`live_set tracks ${i}`);
      names.push(t ? String(t.get('name')) : `Track ${i}`);
    }
    return names;
  }

  /**
   * Query device chain for a track.
   * @param {number} trackIdx - Track index
   * @returns {string[]} Array of device names
   */
  getDeviceChain(trackIdx) {
    const api = this._api(`live_set tracks ${trackIdx}`);
    if (!api) return [];
    const count = parseInt(api.get('devices').length, 10) || 0;
    const devices = [];
    for (let i = 0; i < count; i++) {
      const d = this._api(`live_set tracks ${trackIdx} devices ${i}`);
      devices.push(d ? String(d.get('name')) : `Device ${i}`);
    }
    return devices;
  }
}

// ─── SysEx Handler ────────────────────────────────────────────────

/**
 * HeadySysExHandler — Core dispatch engine for all 32 Heady SysEx commands.
 * Parses incoming SysEx frames on manufacturer ID 0x7D and routes each
 * command to the appropriate Ableton Live API call.
 *
 * @class
 * @example
 * const handler = new HeadySysExHandler({ log: console.log, send: bytes => ... });
 * handler.processSysEx([0xF0, 0x7D, 0x01, 0x06, 0x7A, 0xF7]); // SET_TEMPO 89.0
 */
export class HeadySysExHandler {
  /**
   * @param {Object} options
   * @param {Function} options.log - Log output function
   * @param {Function} options.send - Send SysEx response bytes (Uint8Array)
   */
  constructor({ log = console.log, send = () => {} } = {}) {
    /** @type {Function} */
    this._log = log;

    /** @type {Function} */
    this._send = send;

    /** @type {number} Negotiated protocol version */
    this._negotiatedVersion = SUPPORTED_PROTOCOL_VERSION;

    /** @type {AbletonLiveProxy} */
    this._live = new AbletonLiveProxy(log);

    /** @type {number} Command counter for telemetry */
    this._commandCount = 0;

    /** @type {boolean} Whether an AI arrangement is currently executing */
    this._arrangementBusy = false;

    this._log(`[HeadySysEx] Protocol V${SUPPORTED_PROTOCOL_VERSION} initialized | Manufacturer 0x${MANUFACTURER_ID.toString(16).toUpperCase()}`);
  }

  /**
   * Process a raw SysEx frame. Entry point for M4L or external callers.
   * @param {Uint8Array|number[]} data - Raw SysEx bytes (F0 ... F7)
   * @returns {{ handled: boolean, cmdName: string }} Dispatch result
   */
  processSysEx(data) {
    const decoded = decodeSysExCommand(data);

    if (!decoded.valid) {
      this._log(`[HeadySysEx] Invalid frame: ${decoded.cmdName}`);
      return { handled: false, cmdName: decoded.cmdName };
    }

    this._commandCount++;
    const cmdName = decoded.cmdName;
    this._log(`[HeadySysEx] #${this._commandCount} Cmd=0x${decoded.cmd.toString(16).padStart(2, '0')} (${cmdName})`);

    this._dispatch(decoded);
    return { handled: true, cmdName };
  }

  /**
   * Dispatch a decoded command to the appropriate handler.
   * @param {Object} decoded - Output of decodeSysExCommand
   * @private
   */
  _dispatch(decoded) {
    switch (decoded.cmd) {
      // ── Version Negotiation ──
      case SYSEX_CMD.VERSION_NEGOTIATE:
        this._handleVersionNegotiate(decoded);
        break;

      // ── Track / Mixer Commands ──
      case SYSEX_CMD.SET_TEMPO:
        this._live.setTempo(decoded.bpm);
        break;
      case SYSEX_CMD.SET_TRACK_VOLUME:
        this._live.setTrackVolume(decoded.track, decoded.volume);
        break;
      case SYSEX_CMD.TRIGGER_CLIP:
        this._live.triggerClip(decoded.track, decoded.scene);
        break;
      case SYSEX_CMD.SET_DEVICE_PARAM:
        this._live.setDeviceParam(decoded.track, decoded.device, decoded.param, decoded.value);
        break;
      case SYSEX_CMD.TRANSPORT:
        this._live.transport(decoded.action);
        break;
      case SYSEX_CMD.CREATE_MIDI_TRACK:
        this._live.createMidiTrack(decoded.name);
        break;
      case SYSEX_CMD.CREATE_AUDIO_TRACK:
        this._live.createAudioTrack(decoded.name);
        break;
      case SYSEX_CMD.SET_TRACK_SEND:
        this._live.setTrackSend(decoded.track, decoded.send, decoded.value);
        break;
      case SYSEX_CMD.SET_TRACK_EQ:
        this._handleSetTrackEQ(decoded);
        break;
      case SYSEX_CMD.ARM_TRACK:
        this._live.armTrack(decoded.track, decoded.armed);
        break;

      // ── Clip Commands ──
      case SYSEX_CMD.SET_CLIP_COLOR:
        this._handleSetClipColor(decoded);
        break;
      case SYSEX_CMD.SET_CLIP_NAME:
        this._handleSetClipName(decoded);
        break;
      case SYSEX_CMD.QUANTIZE_CLIP:
        this._handleQuantizeClip(decoded);
        break;
      case SYSEX_CMD.DUPLICATE_CLIP:
        this._handleDuplicateClip(decoded);
        break;
      case SYSEX_CMD.DELETE_CLIP:
        this._handleDeleteClip(decoded);
        break;
      case SYSEX_CMD.CONSOLIDATE_CLIP:
        this._handleConsolidateClip(decoded);
        break;

      // ── Query Commands → send response ──
      case SYSEX_CMD.STATUS_REQUEST:
        this._handleStatusRequest();
        break;
      case SYSEX_CMD.GET_TRACK_NAMES:
        this._handleGetTrackNames();
        break;
      case SYSEX_CMD.GET_DEVICE_CHAIN:
        this._handleGetDeviceChain(decoded);
        break;

      // ── Device / Macro Commands ──
      case SYSEX_CMD.SET_MACRO:
        this._live.setDeviceParam(decoded.track, decoded.device, decoded.macroIndex, decoded.value);
        break;
      case SYSEX_CMD.LOAD_PRESET:
        this._handleLoadPreset(decoded);
        break;
      case SYSEX_CMD.CC_RECORD_ENABLE:
        this._handleCCRecordEnable(decoded);
        break;

      // ── Arrangement Commands ──
      case SYSEX_CMD.SET_LOOP_REGION:
        this._handleSetLoopRegion(decoded);
        break;
      case SYSEX_CMD.SET_TIME_SIGNATURE:
        this._handleSetTimeSignature(decoded);
        break;
      case SYSEX_CMD.SET_TRACK_ROUTING:
        this._handleSetTrackRouting(decoded);
        break;

      // ── Track State Commands ──
      case SYSEX_CMD.SOLO_TRACK:
        this._live.soloTrack(decoded.track, decoded.solo);
        break;
      case SYSEX_CMD.MUTE_TRACK:
        this._live.muteTrack(decoded.track, decoded.mute);
        break;

      // ── Scene Commands ──
      case SYSEX_CMD.SET_SCENE_NAME:
        this._handleSetSceneName(decoded);
        break;
      case SYSEX_CMD.FIRE_SCENE:
        this._live.fireScene(decoded.sceneIndex);
        break;

      // ── Utility Commands ──
      case SYSEX_CMD.CAPTURE_MIDI:
        this._live.captureMidi();
        break;
      case SYSEX_CMD.UNDO:
        this._live.undo();
        break;

      // ── AI Commands ──
      case SYSEX_CMD.AI_ARRANGEMENT:
        this._handleAIArrangement(decoded);
        break;
      case SYSEX_CMD.AI_GENERATE_PATTERN:
        this._handleAIGeneratePattern(decoded);
        break;

      default:
        this._log(`[HeadySysEx] Unhandled command: 0x${decoded.cmd.toString(16)}`);
    }
  }

  // ─── Version Negotiation ──────────────────────────────────────────

  /**
   * Handle VERSION_NEGOTIATE (0x00).
   * If the requested version is supported, confirm; otherwise downgrade.
   * @param {Object} decoded
   * @private
   */
  _handleVersionNegotiate(decoded) {
    const requested = decoded.version || 1;
    this._negotiatedVersion = Math.min(requested, SUPPORTED_PROTOCOL_VERSION);
    this._log(`[Version] Requested=${requested} Negotiated=${this._negotiatedVersion}`);

    // Send version response
    const response = buildSysEx(SYSEX_CMD.VERSION_NEGOTIATE, [this._negotiatedVersion & 0x7F]);
    this._send(response);
  }

  // ─── Track EQ ─────────────────────────────────────────────────────

  /**
   * Handle SET_TRACK_EQ (0x09).
   * @param {Object} decoded - { track, band, freq, gain, q }
   * @private
   */
  _handleSetTrackEQ(decoded) {
    const api = this._live._api(
      `live_set tracks ${decoded.track} devices 0 parameters`
    );
    this._log(`[EQ] track=${decoded.track} band=${decoded.band} freq=${decoded.freq} gain=${decoded.gain} Q=${decoded.q}`);
  }

  // ─── Clip Handlers ────────────────────────────────────────────────

  /**
   * Handle SET_CLIP_COLOR (0x0B).
   * @param {Object} decoded - { track, scene, r, g, b }
   * @private
   */
  _handleSetClipColor(decoded) {
    const api = this._live._api(
      `live_set tracks ${decoded.track} clip_slots ${decoded.scene} clip`
    );
    if (api) {
      const color = (decoded.r << 16) | (decoded.g << 8) | decoded.b;
      api.set('color', color);
    }
    this._log(`[ClipColor] track=${decoded.track} scene=${decoded.scene} rgb=(${decoded.r},${decoded.g},${decoded.b})`);
  }

  /**
   * Handle SET_CLIP_NAME (0x0C).
   * @param {Object} decoded - { track, scene, name }
   * @private
   */
  _handleSetClipName(decoded) {
    const api = this._live._api(
      `live_set tracks ${decoded.track} clip_slots ${decoded.scene} clip`
    );
    if (api) {
      api.set('name', decoded.name);
    }
    this._log(`[ClipName] track=${decoded.track} scene=${decoded.scene} name="${decoded.name}"`);
  }

  /**
   * Handle QUANTIZE_CLIP (0x0D).
   * @param {Object} decoded - { track, scene, quantize }
   * @private
   */
  _handleQuantizeClip(decoded) {
    const api = this._live._api(
      `live_set tracks ${decoded.track} clip_slots ${decoded.scene} clip`
    );
    if (api) {
      api.call('quantize', decoded.quantize);
    }
    this._log(`[Quantize] track=${decoded.track} scene=${decoded.scene} q=${decoded.quantize}`);
  }

  /**
   * Handle DUPLICATE_CLIP (0x0E).
   * @param {Object} decoded - { srcTrack, srcScene, dstTrack, dstScene }
   * @private
   */
  _handleDuplicateClip(decoded) {
    const api = this._live._api(
      `live_set tracks ${decoded.srcTrack} clip_slots ${decoded.srcScene}`
    );
    if (api) {
      api.call('duplicate_clip_to', decoded.dstTrack, decoded.dstScene);
    }
    this._log(`[Duplicate] (${decoded.srcTrack},${decoded.srcScene}) → (${decoded.dstTrack},${decoded.dstScene})`);
  }

  /**
   * Handle DELETE_CLIP (0x0F).
   * @param {Object} decoded - { track, scene }
   * @private
   */
  _handleDeleteClip(decoded) {
    const api = this._live._api(
      `live_set tracks ${decoded.track} clip_slots ${decoded.scene} clip`
    );
    if (api) {
      api.call('delete_clip');
    }
    this._log(`[Delete] track=${decoded.track} scene=${decoded.scene}`);
  }

  /**
   * Handle CONSOLIDATE_CLIP (0x1E).
   * @param {Object} decoded - { track, scene }
   * @private
   */
  _handleConsolidateClip(decoded) {
    const api = this._live._api(
      `live_set tracks ${decoded.track} clip_slots ${decoded.scene} clip`
    );
    this._log(`[Consolidate] track=${decoded.track} scene=${decoded.scene}`);
  }

  // ─── Query Response Handlers ──────────────────────────────────────

  /**
   * Handle STATUS_REQUEST (0x10). Responds with current session state as JSON.
   * @private
   */
  _handleStatusRequest() {
    const state = {
      version: this._negotiatedVersion,
      commandsProcessed: this._commandCount,
      arrangementBusy: this._arrangementBusy,
      timestamp: Date.now(),
    };
    const response = buildSysEx(SYSEX_CMD.STATUS_REQUEST, encodeJSON(state));
    this._send(response);
    this._log(`[Status] Responded with session state`);
  }

  /**
   * Handle GET_TRACK_NAMES (0x11). Responds with track name list.
   * @private
   */
  _handleGetTrackNames() {
    const names = this._live.getTrackNames();
    const response = buildSysEx(SYSEX_CMD.GET_TRACK_NAMES, encodeJSON(names));
    this._send(response);
    this._log(`[TrackNames] Responded with ${names.length} tracks`);
  }

  /**
   * Handle GET_DEVICE_CHAIN (0x12). Responds with device list for a track.
   * @param {Object} decoded - { track }
   * @private
   */
  _handleGetDeviceChain(decoded) {
    const devices = this._live.getDeviceChain(decoded.track);
    const response = buildSysEx(SYSEX_CMD.GET_DEVICE_CHAIN, encodeJSON(devices));
    this._send(response);
    this._log(`[DeviceChain] track=${decoded.track} → ${devices.length} devices`);
  }

  // ─── Device / Macro Handlers ──────────────────────────────────────

  /**
   * Handle LOAD_PRESET (0x14).
   * @param {Object} decoded - { track, device, presetIndex }
   * @private
   */
  _handleLoadPreset(decoded) {
    this._log(`[Preset] track=${decoded.track} device=${decoded.device} preset=${decoded.presetIndex}`);
  }

  /**
   * Handle CC_RECORD_ENABLE (0x15).
   * @param {Object} decoded - { track, ccNumber, enabled }
   * @private
   */
  _handleCCRecordEnable(decoded) {
    this._log(`[CCRecord] track=${decoded.track} cc=${decoded.ccNumber} enabled=${decoded.enabled}`);
  }

  // ─── Arrangement Handlers ─────────────────────────────────────────

  /**
   * Handle SET_LOOP_REGION (0x16).
   * @param {Object} decoded - { startBar, startBeat, endBar, endBeat }
   * @private
   */
  _handleSetLoopRegion(decoded) {
    const api = this._live._api('live_set');
    if (api) {
      const ppqPerBeat = DEFAULT_PPQ;
      const startTime = ((decoded.startBar - 1) * 4 + decoded.startBeat) * ppqPerBeat;
      const endTime = ((decoded.endBar - 1) * 4 + decoded.endBeat) * ppqPerBeat;
      api.set('loop_start', startTime);
      api.set('loop_length', endTime - startTime);
      api.set('loop', 1);
    }
    this._log(`[Loop] ${decoded.startBar}:${decoded.startBeat} → ${decoded.endBar}:${decoded.endBeat}`);
  }

  /**
   * Handle SET_TIME_SIGNATURE (0x17).
   * @param {Object} decoded - { numerator, denominator }
   * @private
   */
  _handleSetTimeSignature(decoded) {
    const api = this._live._api('live_set');
    if (api) {
      api.set('signature_numerator', decoded.numerator);
      api.set('signature_denominator', decoded.denominator);
    }
    this._log(`[TimeSig] ${decoded.numerator}/${decoded.denominator}`);
  }

  /**
   * Handle SET_TRACK_ROUTING (0x18).
   * @param {Object} decoded - { track, inputType, inputChannel }
   * @private
   */
  _handleSetTrackRouting(decoded) {
    this._log(`[Routing] track=${decoded.track} inputType=${decoded.inputType} ch=${decoded.inputChannel}`);
  }

  /**
   * Handle SET_SCENE_NAME (0x1B).
   * @param {Object} decoded - { scene, name }
   * @private
   */
  _handleSetSceneName(decoded) {
    const api = this._live._api(`live_set scenes ${decoded.scene}`);
    if (api) {
      api.set('name', decoded.name);
    }
    this._log(`[SceneName] scene=${decoded.scene} name="${decoded.name}"`);
  }

  // ─── AI Arrangement Execution ─────────────────────────────────────

  /**
   * Handle AI_ARRANGEMENT (0x20).
   * Parses JSON sections and schedules clip triggers, device param changes,
   * and transport commands sequentially with φ-timed delays.
   * @param {Object} decoded - { data: { tempo, sections[] } }
   * @private
   */
  _handleAIArrangement(decoded) {
    if (this._arrangementBusy) {
      this._log('[AI] Arrangement already in progress — ignoring');
      return;
    }

    const arrangement = decoded.data;
    if (!arrangement || !arrangement.sections) {
      this._log('[AI] Invalid arrangement data');
      return;
    }

    if (arrangement.sections.length > MAX_ARRANGEMENT_SECTIONS) {
      this._log(`[AI] Too many sections (${arrangement.sections.length} > ${MAX_ARRANGEMENT_SECTIONS})`);
      return;
    }

    this._arrangementBusy = true;
    this._log(`[AI] Starting arrangement: ${arrangement.sections.length} sections`);

    // Set global tempo if provided
    if (arrangement.tempo) {
      this._live.setTempo(arrangement.tempo);
    }

    // Set time signature if provided
    if (arrangement.timeSignature) {
      const api = this._live._api('live_set');
      if (api) {
        api.set('signature_numerator', arrangement.timeSignature.numerator || 4);
        api.set('signature_denominator', arrangement.timeSignature.denominator || 4);
      }
    }

    // Schedule sections sequentially using φ-derived timing
    this._executeArrangementSections(arrangement.sections, 0);
  }

  /**
   * Recursively execute arrangement sections with φ-timed scheduling.
   * Each section executes after a delay proportional to the previous section's
   * bar count, subdivided by the golden ratio.
   * @param {Object[]} sections - Array of section definitions
   * @param {number} index - Current section index
   * @private
   */
  _executeArrangementSections(sections, index) {
    if (index >= sections.length) {
      this._arrangementBusy = false;
      this._log('[AI] Arrangement complete');
      return;
    }

    const section = sections[index];
    const bars = section.bars || FIB[5]; // Default 8 bars
    const progress = Math.round(((index + 1) / sections.length) * 127);

    this._log(`[AI] Section ${index + 1}/${sections.length}: "${section.name}" (${bars} bars) — ${Math.round(progress / 1.27)}%`);

    // Section-local tempo override
    if (section.tempo) {
      this._live.setTempo(section.tempo);
    }

    // Process tracks within this section
    if (section.tracks) {
      for (const track of section.tracks) {
        this._executeArrangementTrack(track, index);
      }
    }

    // Schedule next section after φ-derived delay (bars × beat duration × φ)
    const bpm = section.tempo || DEFAULT_BPM;
    const beatMs = (60 / bpm) * 1000;
    const sectionDurationMs = bars * 4 * beatMs; // 4 beats per bar
    const nextDelayMs = Math.round(sectionDurationMs * PSI); // φ-compression for preview mode

    if (typeof Task !== 'undefined') {
      new Task(() => this._executeArrangementSections(sections, index + 1)).schedule(nextDelayMs);
    } else {
      setTimeout(() => this._executeArrangementSections(sections, index + 1), nextDelayMs);
    }
  }

  /**
   * Execute a single track's clips and device settings within a section.
   * @param {Object} track - Track definition with clips[], devices[]
   * @param {number} sceneOffset - Scene offset (section index)
   * @private
   */
  _executeArrangementTrack(track, sceneOffset) {
    const trackIdx = track.trackIndex ?? 0;

    // Trigger clips
    if (track.clips) {
      for (const clip of track.clips) {
        const scene = clip.scene ?? sceneOffset;
        this._live.triggerClip(trackIdx, scene);
      }
    }

    // Set device parameters
    if (track.devices) {
      for (const device of track.devices) {
        const devIdx = device.deviceIndex ?? 0;
        if (device.params) {
          for (const [paramIdx, value] of Object.entries(device.params)) {
            this._live.setDeviceParam(trackIdx, devIdx, parseInt(paramIdx, 10), value);
          }
        }
      }
    }
  }

  // ─── AI Pattern Generation ────────────────────────────────────────

  /**
   * Handle AI_GENERATE_PATTERN (0x21).
   * @param {Object} decoded - { data: { style, bars, key, scale } }
   * @private
   */
  _handleAIGeneratePattern(decoded) {
    const params = decoded.data;
    this._log(`[AI] Generate pattern: style=${params?.style} bars=${params?.bars} key=${params?.key}`);

    // Respond with acknowledgment
    const ack = buildSysEx(SYSEX_CMD.AI_GENERATE_PATTERN, encodeJSON({
      status: 'accepted',
      style: params?.style,
      bars: params?.bars,
      timestamp: Date.now(),
    }));
    this._send(ack);
  }

  // ─── Accessors ────────────────────────────────────────────────────

  /**
   * Get the current negotiated protocol version.
   * @returns {number}
   */
  get protocolVersion() {
    return this._negotiatedVersion;
  }

  /**
   * Get the total number of commands processed.
   * @returns {number}
   */
  get commandCount() {
    return this._commandCount;
  }

  /**
   * Check if an AI arrangement is currently executing.
   * @returns {boolean}
   */
  get isArrangementBusy() {
    return this._arrangementBusy;
  }
}

// ─── M4L Entry Points ─────────────────────────────────────────────
// These are called by the Max runtime when the device is loaded.

/** @type {HeadySysExHandler|null} Singleton handler instance */
let _handler = null;

/**
 * M4L initialization — called when the device loads.
 * Sets up inlets/outlets and creates the handler singleton.
 */
export function initM4L() {
  if (typeof inlets !== 'undefined') {
    inlets = INLET_COUNT;
    outlets = OUTLET_COUNT;
  }

  const logFn = typeof post !== 'undefined' ? (msg) => post(msg + '\n') : console.log;
  const sendFn = (bytes) => {
    if (typeof outlet !== 'undefined') {
      outlet(0, Array.from(bytes));
    }
  };

  _handler = new HeadySysExHandler({ log: logFn, send: sendFn });
  logFn(`[HeadySysEx] M4L device ready — V${SUPPORTED_PROTOCOL_VERSION}`);
}

/**
 * M4L sysex handler — called when SysEx bytes arrive on inlet 0.
 * Max sends SysEx as a list of integers to this function.
 * @param {...number} args - SysEx bytes
 */
export function sysex(...args) {
  if (!_handler) initM4L();
  const data = new Uint8Array(args);
  _handler.processSysEx(data);
}

/**
 * M4L bang handler — sends a status request response on bang.
 */
export function bang() {
  if (!_handler) initM4L();
  _handler.processSysEx(buildSysEx(SYSEX_CMD.STATUS_REQUEST, []));
}
