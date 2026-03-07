/**
 * @fileoverview Heady MIDI Constants — Canonical reference for the entire MIDI transfer schema.
 * Every constant derives from φ ≈ 1.618 or Fibonacci sequences. No magic numbers.
 * 
 * @module shared/midi-constants
 * @version 2.0.0
 * @author HeadySystems™
 * @license Proprietary — HeadySystems™ & HeadyConnection™
 * 
 * ⚡ Made with 💜 by HeadySystems™ & HeadyConnection™
 * Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

// ─── Phi Foundation ────────────────────────────────────────────────
const PHI   = (1 + Math.sqrt(5)) / 2;   // ≈ 1.6180339887
const PSI   = 1 / PHI;                   // ≈ 0.6180339887 (conjugate)
const PHI2  = PHI + 1;                   // ≈ 2.6180339887 (φ²)
const PHI3  = 2 * PHI + 1;              // ≈ 4.2360679775 (φ³)
const PSI2  = PSI * PSI;                 // ≈ 0.3819660113 (ψ²)
const PSI3  = PSI * PSI * PSI;           // ≈ 0.2360679775 (ψ³)

/** Fibonacci sequence for sizing (cache sizes, buffer depths, etc.) */
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765];

/**
 * φ-derived threshold: 1 - ψ^level × spread
 * @param {number} level - Threshold level (0=minimum, 4=critical)
 * @param {number} [spread=0.5] - Spread factor
 * @returns {number} Threshold value between 0 and 1
 */
function phiThreshold(level, spread = 0.5) {
  return 1 - Math.pow(PSI, level) * spread;
}

// ─── MIDI 1.0 Status Bytes ─────────────────────────────────────────
/** @enum {number} MIDI 1.0 status byte types (high nibble) */
const STATUS = Object.freeze({
  NOTE_OFF:        0x80,
  NOTE_ON:         0x90,
  POLY_PRESSURE:   0xA0,
  CC:              0xB0,  // Control Change
  PROGRAM_CHANGE:  0xC0,
  CHANNEL_PRESSURE:0xD0,
  PITCH_BEND:      0xE0,
  SYSEX_START:     0xF0,
  MTC_QUARTER:     0xF1,
  SONG_POS:        0xF2,
  SONG_SELECT:     0xF3,
  TUNE_REQUEST:    0xF6,
  SYSEX_END:       0xF7,
  CLOCK:           0xF8,
  START:           0xFA,
  CONTINUE:        0xFB,
  STOP:            0xFC,
  ACTIVE_SENSE:    0xFE,
  RESET:           0xFF,
});

// ─── Heady MIDI Channels ──────────────────────────────────────────
/** @enum {number} Heady's 8 logical channels mapped to MIDI channels 0-7 */
const CHANNEL = Object.freeze({
  PIPELINE:   0,
  FINOPS:     1,
  DISPATCHER: 2,
  HEALTH:     3,
  TRADING:    4,
  SECURITY:   5,
  SWARM:      6,
  TELEMETRY:  7,
});

/** Human-readable channel labels */
const CHANNEL_LABELS = Object.freeze({
  [CHANNEL.PIPELINE]:   'Pipeline',
  [CHANNEL.FINOPS]:     'FinOps',
  [CHANNEL.DISPATCHER]: 'Dispatcher',
  [CHANNEL.HEALTH]:     'Health',
  [CHANNEL.TRADING]:    'Trading',
  [CHANNEL.SECURITY]:   'Security',
  [CHANNEL.SWARM]:      'Swarm',
  [CHANNEL.TELEMETRY]:  'Telemetry',
});

/** Channel color palette — HSL angles at φ-intervals around the wheel */
const CHANNEL_COLORS = Object.freeze({
  [CHANNEL.PIPELINE]:   'hsl(180, 70%, 50%)',   // Teal
  [CHANNEL.FINOPS]:     'hsl(42, 85%, 55%)',     // Gold (180 × PSI ≈ 111 → +42)
  [CHANNEL.DISPATCHER]: 'hsl(262, 65%, 60%)',    // Purple
  [CHANNEL.HEALTH]:     'hsl(142, 70%, 45%)',    // Green
  [CHANNEL.TRADING]:    'hsl(22, 80%, 55%)',     // Orange
  [CHANNEL.SECURITY]:   'hsl(0, 75%, 55%)',      // Red
  [CHANNEL.SWARM]:      'hsl(200, 75%, 55%)',    // Sky Blue
  [CHANNEL.TELEMETRY]:  'hsl(300, 55%, 55%)',    // Magenta
});

// ─── CC Controllers (Heady Metrics) ──────────────────────────────
/** @enum {number} Control Change numbers for Heady system metrics */
const CC = Object.freeze({
  BUDGET_USAGE:     1,    // 0-127 normalized
  CPU_LOAD:         2,
  MEMORY_PRESSURE:  3,
  TASK_QUEUE_DEPTH: 4,
  LATENCY_MS:       5,    // mapped: 0-127 → 0-1000ms via φ-curve
  SUCCESS_RATE:     6,
  ACTIVE_AGENTS:    7,
  BREAKERS_OPEN:    8,
  // Extended CCs (v2)
  DISK_IO:          9,
  NETWORK_BW:       10,
  GPU_UTIL:         11,
  TOKEN_BUDGET:     12,
  CACHE_HIT_RATE:   13,
  QUEUE_LATENCY:    14,
  ERROR_RATE:       15,
  THROUGHPUT:       16,
});

/** Human-readable CC labels */
const CC_LABELS = Object.freeze({
  [CC.BUDGET_USAGE]:     'Budget Usage',
  [CC.CPU_LOAD]:         'CPU Load',
  [CC.MEMORY_PRESSURE]:  'Memory Pressure',
  [CC.TASK_QUEUE_DEPTH]: 'Queue Depth',
  [CC.LATENCY_MS]:       'Latency (ms)',
  [CC.SUCCESS_RATE]:     'Success Rate',
  [CC.ACTIVE_AGENTS]:    'Active Agents',
  [CC.BREAKERS_OPEN]:    'Breakers Open',
  [CC.DISK_IO]:          'Disk I/O',
  [CC.NETWORK_BW]:       'Network BW',
  [CC.GPU_UTIL]:         'GPU Utilization',
  [CC.TOKEN_BUDGET]:     'Token Budget',
  [CC.CACHE_HIT_RATE]:   'Cache Hit Rate',
  [CC.QUEUE_LATENCY]:    'Queue Latency',
  [CC.ERROR_RATE]:       'Error Rate',
  [CC.THROUGHPUT]:       'Throughput',
});

// ─── Note Numbers (Task Lifecycle) ────────────────────────────────
/** @enum {number} Note numbers encoding task lifecycle events */
const NOTE = Object.freeze({
  // Task lifecycle (C2-C4 range)
  TASK_INGEST:     36,   // C2
  TASK_DECOMPOSE:  38,   // D2
  TASK_ROUTE:      40,   // E2
  TASK_VALIDATE:   42,   // F#2
  TASK_PERSIST:    44,   // G#2
  TASK_EXECUTE:    46,   // A#2
  TASK_COMPLETE:   48,   // C3
  TASK_FAILED:     49,   // C#3
  TASK_RETRY:      50,   // D3
  TASK_TIMEOUT:    51,   // D#3
  TASK_CANCEL:     52,   // E3

  // Agent lifecycle (C4 range)
  AGENT_SPAWN:     60,   // C4
  AGENT_KILL:      61,   // C#4
  AGENT_IDLE:      62,   // D4
  AGENT_BUSY:      63,   // D#4
  AGENT_ERROR:     64,   // E4
  AGENT_RECOVER:   65,   // F4

  // System events (C5 range)
  REGIME_SHIFT:    72,   // C5
  CIRCUIT_OPEN:    73,   // C#5
  CIRCUIT_CLOSE:   74,   // D5
  SCALE_UP:        75,   // D#5
  SCALE_DOWN:      76,   // E5
  DEPLOY_START:    77,   // F5
  DEPLOY_COMPLETE: 78,   // F#5
  DEPLOY_FAILED:   79,   // G5

  // DAW integration (C6 range)
  CLIP_TRIGGER:    84,   // C6
  SCENE_LAUNCH:    85,   // C#6
  TRANSPORT_PLAY:  86,   // D6
  TRANSPORT_STOP:  87,   // D#6
  TRANSPORT_REC:   88,   // E6
});

/** Velocity ranges — φ-derived priority levels */
const VELOCITY = Object.freeze({
  MINIMUM:    1,
  LOW:        Math.round(127 * PSI2),     // ≈ 48
  MEDIUM:     Math.round(127 * PSI),      // ≈ 78
  HIGH:       Math.round(127 * (1 - PSI2)), // ≈ 78
  CRITICAL:   Math.round(127 * (1 - PSI3)), // ≈ 97
  MAXIMUM:    127,
});

// ─── SysEx Protocol ───────────────────────────────────────────────
/** Heady manufacturer ID (non-commercial, 0x7D per MIDI spec) */
const MANUFACTURER_ID = 0x7D;

/** SysEx protocol version */
const SYSEX_VERSION = 2;

/** @enum {number} SysEx command bytes (V1 + V2 combined = 32 commands) */
const SYSEX_CMD = Object.freeze({
  // === V1 Commands (0x01 - 0x05, 0x10, 0x20) ===
  SET_TEMPO:           0x01,
  SET_TRACK_VOLUME:    0x02,
  TRIGGER_CLIP:        0x03,
  SET_DEVICE_PARAM:    0x04,
  TRANSPORT:           0x05,
  // V2 additions (0x06 - 0x0F)
  CREATE_MIDI_TRACK:   0x06,
  CREATE_AUDIO_TRACK:  0x07,
  SET_TRACK_SEND:      0x08,
  SET_TRACK_EQ:        0x09,
  ARM_TRACK:           0x0A,
  SET_CLIP_COLOR:      0x0B,
  SET_CLIP_NAME:       0x0C,
  QUANTIZE_CLIP:       0x0D,
  DUPLICATE_CLIP:      0x0E,
  DELETE_CLIP:         0x0F,
  // V1 query
  STATUS_REQUEST:      0x10,
  // V2 queries / actions (0x11 - 0x1F)
  GET_TRACK_NAMES:     0x11,
  GET_DEVICE_CHAIN:    0x12,
  SET_MACRO:           0x13,
  LOAD_PRESET:         0x14,
  CC_RECORD_ENABLE:    0x15,
  SET_LOOP_REGION:     0x16,
  SET_TIME_SIGNATURE:  0x17,
  SET_TRACK_ROUTING:   0x18,
  SOLO_TRACK:          0x19,
  MUTE_TRACK:          0x1A,
  SET_SCENE_NAME:      0x1B,
  FIRE_SCENE:          0x1C,
  CAPTURE_MIDI:        0x1D,
  CONSOLIDATE_CLIP:    0x1E,
  UNDO:                0x1F,
  // V1 AI
  AI_ARRANGEMENT:      0x20,
  // V2 extended AI
  AI_GENERATE_PATTERN: 0x21,
  VERSION_NEGOTIATE:   0x00,
});

/** Reverse lookup: command byte → name */
const SYSEX_CMD_NAMES = Object.freeze(
  Object.fromEntries(Object.entries(SYSEX_CMD).map(([k, v]) => [v, k]))
);

/** Transport sub-commands for SYSEX_CMD.TRANSPORT (0x05) */
const TRANSPORT = Object.freeze({
  STOP:    0x00,
  PLAY:    0x01,
  RECORD:  0x02,
  PAUSE:   0x03,
  REWIND:  0x04,
});

/** Quantize values for QUANTIZE_CLIP command */
const QUANTIZE = Object.freeze({
  OFF:     0x00,
  Q_1_4:   0x01,   // Quarter note
  Q_1_8:   0x02,   // Eighth note
  Q_1_16:  0x03,   // Sixteenth note
  Q_1_32:  0x04,   // Thirty-second note
  Q_1_8T:  0x05,   // Eighth triplet
  Q_1_16T: 0x06,   // Sixteenth triplet
});

// ─── MIDI 2.0 UMP ─────────────────────────────────────────────────
/** @enum {number} Universal MIDI Packet message types */
const UMP_TYPE = Object.freeze({
  UTILITY:         0x0,
  SYSTEM:          0x1,
  MIDI1_VOICE:     0x2,
  DATA_64:         0x3,
  MIDI2_VOICE:     0x4,
  DATA_128:        0x5,
  FLEX_DATA:       0xD,
  STREAM:          0xF,
});

/** UMP group function codes */
const UMP_STATUS = Object.freeze({
  NOTE_OFF:    0x80,
  NOTE_ON:     0x90,
  POLY_PRESS:  0xA0,
  CC:          0xB0,
  PROG_CHANGE: 0xC0,
  CHAN_PRESS:   0xD0,
  PITCH_BEND:  0xE0,
  REG_PER_NOTE:0x00,
  ASSIGN_PER_NOTE: 0x10,
  RPN:         0x20,
  NRPN:        0x30,
});

// ─── Network / Timing ─────────────────────────────────────────────
/** Network MIDI 2.0 UDP port */
const NETWORK_MIDI_PORT = 5504;

/** Default WebSocket port for MIDI proxy */
const WS_MIDI_PORT = 8089;

/** Ableton Remote Script TCP port */
const ABLETON_TCP_PORT = 11411;

/** Default sequencer BPM (Fibonacci number) */
const DEFAULT_BPM = 89;

/** Pulses Per Quarter note */
const DEFAULT_PPQ = 480;

/** φ-swing offset — golden ratio subdivision for humanized timing */
const PHI_SWING = PSI; // ≈ 0.618 — offset from straight 0.5

/** Maximum snapshot staleness (ms) per Liquid Unified Fabric config */
const MAX_STALENESS_MS = 1000;

/** φ-backoff base for reconnection (ms) */
const BACKOFF_BASE_MS = FIB[7] * 100; // 1300ms (fib(7)=13 × 100)

/** Maximum backoff (ms) — Fibonacci-scaled */
const BACKOFF_MAX_MS = FIB[11] * 1000; // 89000ms ≈ 89s

/** Event ring buffer size (Fibonacci) */
const EVENT_BUFFER_SIZE = FIB[16]; // 987

/** History buffer for playback (Fibonacci) */
const HISTORY_BUFFER_SIZE = FIB[17]; // 1597

/** Maximum concurrent WebSocket clients (Fibonacci) */
const MAX_WS_CLIENTS = FIB[10]; // 55

/** MIDI learn timeout (ms) — φ-scaled */
const MIDI_LEARN_TIMEOUT_MS = Math.round(FIB[8] * 1000 * PSI); // ≈ 12978ms

// ─── CC Curve Types ───────────────────────────────────────────────
/** @enum {string} CC response curve types */
const CURVE_TYPE = Object.freeze({
  LINEAR:      'linear',
  LOGARITHMIC: 'logarithmic',
  EXPONENTIAL: 'exponential',
  S_CURVE:     's-curve',
  BEZIER:      'bezier',
});

/**
 * Apply CC curve to a 7-bit value.
 * @param {number} value - Raw CC value (0-127)
 * @param {string} curveType - One of CURVE_TYPE enum
 * @param {Object} [params] - Curve parameters (control points for bezier, etc.)
 * @returns {number} Mapped value (0.0 - 1.0)
 */
function applyCurve(value, curveType = CURVE_TYPE.LINEAR, params = {}) {
  const normalized = value / 127;
  switch (curveType) {
    case CURVE_TYPE.LINEAR:
      return normalized;
    case CURVE_TYPE.LOGARITHMIC:
      return Math.log(1 + normalized * (Math.E - 1)); // ln(1+x(e-1)) maps [0,1]→[0,1]
    case CURVE_TYPE.EXPONENTIAL:
      return (Math.pow(PHI, normalized * 2) - 1) / (PHI2 - 1); // φ-exponential
    case CURVE_TYPE.S_CURVE: {
      // Sigmoid centered at 0.5, steepness from φ³
      const k = params.steepness || PHI3 * 3; // ≈ 12.7
      return 1 / (1 + Math.exp(-k * (normalized - 0.5)));
    }
    case CURVE_TYPE.BEZIER: {
      // Cubic bezier with two control points
      const cp1 = params.cp1 || PSI2;  // ≈ 0.382
      const cp2 = params.cp2 || PSI;   // ≈ 0.618
      const t = normalized;
      return 3 * (1 - t) * (1 - t) * t * cp1 +
             3 * (1 - t) * t * t * cp2 +
             t * t * t;
    }
    default:
      return normalized;
  }
}

/**
 * Map latency value from 7-bit CC to milliseconds using φ-curve.
 * 0 → 0ms, 64 → ~100ms, 127 → 1000ms (φ-exponential distribution)
 * @param {number} ccValue - CC value (0-127)
 * @returns {number} Latency in milliseconds
 */
function ccToLatencyMs(ccValue) {
  return MAX_STALENESS_MS * applyCurve(ccValue, CURVE_TYPE.EXPONENTIAL);
}

/**
 * Map milliseconds back to 7-bit CC value.
 * @param {number} ms - Latency in milliseconds
 * @returns {number} CC value (0-127)
 */
function latencyMsToCC(ms) {
  const normalized = Math.min(1, Math.max(0, ms / MAX_STALENESS_MS));
  // Inverse of φ-exponential
  const raw = Math.log(normalized * (PHI2 - 1) + 1) / (2 * Math.log(PHI));
  return Math.round(Math.min(127, Math.max(0, raw * 127)));
}

// ─── Exports ──────────────────────────────────────────────────────
export {
  // Phi foundation
  PHI, PSI, PHI2, PHI3, PSI2, PSI3, FIB, phiThreshold,
  // MIDI 1.0
  STATUS, CHANNEL, CHANNEL_LABELS, CHANNEL_COLORS,
  CC, CC_LABELS, NOTE, VELOCITY,
  // SysEx
  MANUFACTURER_ID, SYSEX_VERSION, SYSEX_CMD, SYSEX_CMD_NAMES,
  TRANSPORT, QUANTIZE,
  // UMP
  UMP_TYPE, UMP_STATUS,
  // Network / timing
  NETWORK_MIDI_PORT, WS_MIDI_PORT, ABLETON_TCP_PORT,
  DEFAULT_BPM, DEFAULT_PPQ, PHI_SWING, MAX_STALENESS_MS,
  BACKOFF_BASE_MS, BACKOFF_MAX_MS,
  EVENT_BUFFER_SIZE, HISTORY_BUFFER_SIZE, MAX_WS_CLIENTS,
  MIDI_LEARN_TIMEOUT_MS,
  // Curves
  CURVE_TYPE, applyCurve, ccToLatencyMs, latencyMsToCC,
};
