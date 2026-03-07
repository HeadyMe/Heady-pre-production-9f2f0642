/**
 * @fileoverview Cloud-to-Ableton Arrangement Pipeline — Transforms natural
 * language descriptions into structured arrangement JSON, encodes to SysEx
 * commands via the codec, and dispatches them to Ableton Live through the
 * MIDI event bus.
 *
 * Pipeline stages: parse → generate → validate → encode → dispatch
 * Each stage emits lifecycle events on MidiEventBus (NOTE_ON on PIPELINE
 * channel with task lifecycle notes).
 *
 * Features:
 * - Natural language → arrangement JSON conversion (mock LLM)
 * - Structured arrangement with tempo, time signature, sections, tracks, clips
 * - Full SysEx encoding using sysex-codec
 * - φ-timed scheduling for event dispatch within bars
 * - Real-time progress tracking with percentage
 * - Golden ratio subdivision for musical timing
 *
 * @module services/ai-arrangement-pipeline
 * @version 2.0.0
 * @author HeadySystems™
 * @license Proprietary — HeadySystems™ & HeadyConnection™
 *
 * ⚡ Made with 💜 by HeadySystems™ & HeadyConnection™
 * Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

import {
  PHI, PSI, PSI2, FIB,
  CHANNEL, NOTE, VELOCITY, STATUS,
  DEFAULT_BPM, DEFAULT_PPQ, PHI_SWING,
  SYSEX_CMD,
} from '../shared/midi-constants.js';

import {
  encodeSetTempo, encodeSetTimeSignature,
  encodeTriggerClip, encodeSetDeviceParam,
  encodeTransport, encodeCreateMidiTrack,
  encodeCreateAudioTrack, encodeSetTrackVolume,
  encodeSetClipName, encodeSetClipColor,
  encodeFireScene, encodeArmTrack,
  encodeSetTrackSend, encodeSetMacro,
  encodeMuteTrack, encodeSoloTrack,
  encodeSetLoopRegion, encodeAIArrangement,
  buildSysEx, encodeJSON,
} from '../shared/sysex-codec.js';

import { EventEmitter } from 'events';

// ─── Constants ────────────────────────────────────────────────────

/** Pipeline stage names */
const STAGE = Object.freeze({
  PARSE:     'parse',
  GENERATE:  'generate',
  VALIDATE:  'validate',
  ENCODE:    'encode',
  DISPATCH:  'dispatch',
});

/** Stage weights for progress calculation (φ-distributed) */
const STAGE_WEIGHTS = Object.freeze({
  [STAGE.PARSE]:     PSI2,       // ≈ 0.382 — ~8% (lightest)
  [STAGE.GENERATE]:  PHI,        // ≈ 1.618 — ~33%
  [STAGE.VALIDATE]:  PSI,        // ≈ 0.618 — ~13%
  [STAGE.ENCODE]:    1.0,        // 1.000 — ~21%
  [STAGE.DISPATCH]:  PHI - PSI,  // ≈ 1.000 — ~21%
});

/** Total weight for normalization */
const TOTAL_WEIGHT = Object.values(STAGE_WEIGHTS).reduce((s, w) => s + w, 0);

/** Maximum tracks per section */
const MAX_TRACKS_PER_SECTION = FIB[10]; // 55

/** Maximum sections per arrangement */
const MAX_SECTIONS = FIB[9]; // 34

/** Maximum SysEx commands per arrangement */
const MAX_SYSEX_COMMANDS = FIB[16]; // 987

/** φ-subdivision levels for timing within a bar */
const PHI_SUBDIVISIONS = FIB[5]; // 8 subdivisions per bar

// ─── Event Bus Interface ──────────────────────────────────────────

/**
 * MidiEventBus emitter for pipeline lifecycle events.
 * Emits NOTE_ON messages on the PIPELINE channel with task lifecycle notes.
 *
 * @class
 * @extends EventEmitter
 */
class PipelineEventBus extends EventEmitter {
  /**
   * Emit a task lifecycle MIDI event.
   * @param {number} noteNumber - NOTE enum value (e.g., NOTE.TASK_INGEST)
   * @param {number} velocity - VELOCITY enum value for priority
   * @param {Object} [meta={}] - Additional metadata
   */
  emitMidiEvent(noteNumber, velocity, meta = {}) {
    this.emit('midi', {
      status: STATUS.NOTE_ON | CHANNEL.PIPELINE,
      channel: CHANNEL.PIPELINE,
      note: noteNumber,
      velocity,
      timestamp: Date.now(),
      ...meta,
    });
  }

  /**
   * Emit a progress update.
   * @param {string} stage - Current stage name
   * @param {number} percent - Progress percentage (0-100)
   * @param {string} [message=''] - Human-readable status
   */
  emitProgress(stage, percent, message = '') {
    this.emit('progress', {
      stage,
      percent: Math.round(Math.min(100, Math.max(0, percent))),
      message,
      timestamp: Date.now(),
    });
  }
}

// ─── Arrangement Schema ───────────────────────────────────────────

/**
 * @typedef {Object} ArrangementClip
 * @property {number} scene - Scene index
 * @property {number[][]} [notes] - MIDI notes as [pitch, velocity, startTick, durationTick]
 * @property {Object[]} [automation] - Automation points { param, time, value }
 */

/**
 * @typedef {Object} ArrangementDevice
 * @property {string} name - Device name
 * @property {Object<string, number>} params - Parameter name → value (0-127) map
 */

/**
 * @typedef {Object} ArrangementTrack
 * @property {string} type - 'midi' or 'audio'
 * @property {string} name - Track name
 * @property {ArrangementClip[]} clips - Clips for this track
 * @property {ArrangementDevice[]} [devices] - Devices on this track
 * @property {number} [volume] - Track volume (0-127)
 * @property {boolean} [armed] - Whether track should be armed
 */

/**
 * @typedef {Object} ArrangementSection
 * @property {string} name - Section name (e.g., 'Intro', 'Verse')
 * @property {number} bars - Number of bars
 * @property {number} [tempo] - Section-local tempo override
 * @property {ArrangementTrack[]} tracks - Tracks in this section
 */

/**
 * @typedef {Object} Arrangement
 * @property {number} tempo - Global tempo (BPM)
 * @property {{ numerator: number, denominator: number }} timeSignature - Time signature
 * @property {ArrangementSection[]} sections - Arrangement sections
 */

// ─── Natural Language Parser (Mock LLM) ───────────────────────────

/**
 * Parse a natural language arrangement description into structured JSON.
 * In production, this would call an LLM API. This implementation provides
 * a realistic hardcoded response for common patterns and a generic fallback.
 *
 * @param {string} description - Natural language arrangement description
 * @returns {Promise<Arrangement>} Structured arrangement JSON
 */
export async function parseNaturalLanguage(description) {
  // Simulate LLM latency (φ-scaled: ~618ms)
  await new Promise(resolve => setTimeout(resolve, Math.round(FIB[6] * PSI * 100)));

  const lowerDesc = description.toLowerCase();

  // ── Pattern: "4-bar intro with pad swell, verse with drums and bass, build to chorus"
  if (
    lowerDesc.includes('intro') &&
    lowerDesc.includes('verse') &&
    (lowerDesc.includes('chorus') || lowerDesc.includes('build'))
  ) {
    return {
      tempo: DEFAULT_BPM, // 89 BPM
      timeSignature: { numerator: 4, denominator: 4 },
      sections: [
        {
          name: 'Intro — Pad Swell',
          bars: 4,
          tracks: [
            {
              type: 'midi',
              name: 'Pad',
              clips: [
                {
                  scene: 0,
                  notes: [
                    [60, 40, 0, DEFAULT_PPQ * 16],              // C4, soft, full 4 bars
                    [64, 35, DEFAULT_PPQ * 2, DEFAULT_PPQ * 14], // E4, softer, delayed φ-offset
                    [67, 30, DEFAULT_PPQ * 4, DEFAULT_PPQ * 12], // G4, building
                  ],
                  automation: [
                    { param: 'filter_cutoff', time: 0, value: 20 },
                    { param: 'filter_cutoff', time: DEFAULT_PPQ * 8, value: 80 },
                    { param: 'filter_cutoff', time: DEFAULT_PPQ * 16, value: 127 },
                  ],
                },
              ],
              devices: [
                { name: 'Wavetable', params: { cutoff: 20, resonance: 60, attack: 100, release: 90 } },
                { name: 'Reverb', params: { decay: 100, size: 90, mix: 70 } },
              ],
              volume: Math.round(127 * PSI), // ≈ 78
            },
            {
              type: 'audio',
              name: 'Atmosphere',
              clips: [{ scene: 0 }],
              devices: [
                { name: 'EQ Eight', params: { highpass: 40, low_gain: 30 } },
              ],
              volume: Math.round(127 * PSI2), // ≈ 48
            },
          ],
        },
        {
          name: 'Verse — Drums & Bass',
          bars: 8,
          tracks: [
            {
              type: 'midi',
              name: 'Drums',
              clips: [
                {
                  scene: 1,
                  notes: [
                    // Kick: beats 1, 3 (φ-swing offset on beat 3)
                    [36, VELOCITY.HIGH, 0, DEFAULT_PPQ / 4],
                    [36, VELOCITY.MEDIUM, DEFAULT_PPQ * 2 + Math.round(DEFAULT_PPQ * PHI_SWING * 0.1), DEFAULT_PPQ / 4],
                    // Snare: beats 2, 4
                    [38, VELOCITY.HIGH, DEFAULT_PPQ, DEFAULT_PPQ / 4],
                    [38, VELOCITY.HIGH, DEFAULT_PPQ * 3, DEFAULT_PPQ / 4],
                    // Hi-hat: eighth notes with φ-velocity pattern
                    ...Array.from({ length: 8 }, (_, i) => [
                      42,
                      Math.round(VELOCITY.LOW + (VELOCITY.HIGH - VELOCITY.LOW) * Math.pow(PSI, i % 3)),
                      DEFAULT_PPQ * i / 2,
                      DEFAULT_PPQ / 8,
                    ]),
                  ],
                },
              ],
              devices: [
                { name: 'Drum Rack', params: { swing: Math.round(127 * PHI_SWING) } },
              ],
              volume: VELOCITY.HIGH,
            },
            {
              type: 'midi',
              name: 'Bass',
              clips: [
                {
                  scene: 1,
                  notes: [
                    [36, VELOCITY.HIGH, 0, DEFAULT_PPQ * 2],                       // C2
                    [36, VELOCITY.MEDIUM, DEFAULT_PPQ * 2, DEFAULT_PPQ],            // C2
                    [39, VELOCITY.HIGH, DEFAULT_PPQ * 3, DEFAULT_PPQ],              // Eb2
                    [41, VELOCITY.MEDIUM, DEFAULT_PPQ * 4, DEFAULT_PPQ * 2],        // F2
                    [43, VELOCITY.HIGH, DEFAULT_PPQ * 6, DEFAULT_PPQ + DEFAULT_PPQ / 2], // G2
                    [36, VELOCITY.MEDIUM, DEFAULT_PPQ * 7 + DEFAULT_PPQ / 2, DEFAULT_PPQ / 2], // C2 pickup
                  ],
                },
              ],
              devices: [
                { name: 'Analog', params: { cutoff: 70, drive: 50, sub: 90 } },
              ],
              volume: VELOCITY.HIGH,
            },
            {
              type: 'midi',
              name: 'Pad',
              clips: [{ scene: 1 }],
              devices: [
                { name: 'Wavetable', params: { cutoff: 90, resonance: 40, attack: 60, release: 80 } },
              ],
              volume: Math.round(127 * PSI2), // Pad sits back in verse
            },
          ],
        },
        {
          name: 'Build to Chorus',
          bars: 4,
          tempo: Math.round(DEFAULT_BPM * (1 + PSI2 * 0.1)), // Slight tempo ramp ≈ 92.4
          tracks: [
            {
              type: 'midi',
              name: 'Drums',
              clips: [
                {
                  scene: 2,
                  notes: [
                    // Snare roll crescendo — 16th notes with increasing velocity
                    ...Array.from({ length: 16 }, (_, i) => [
                      38,
                      Math.round(VELOCITY.LOW + (VELOCITY.MAXIMUM - VELOCITY.LOW) * (i / 15)),
                      DEFAULT_PPQ * i / 4,
                      DEFAULT_PPQ / 8,
                    ]),
                    // Crash on downbeat of bar 4
                    [49, VELOCITY.MAXIMUM, DEFAULT_PPQ * 12, DEFAULT_PPQ * 4],
                  ],
                },
              ],
              volume: VELOCITY.MAXIMUM,
            },
            {
              type: 'midi',
              name: 'Bass',
              clips: [
                {
                  scene: 2,
                  notes: [
                    [36, VELOCITY.MAXIMUM, 0, DEFAULT_PPQ * 8],  // Sustained C2 pedal
                  ],
                  automation: [
                    { param: 'drive', time: 0, value: 50 },
                    { param: 'drive', time: DEFAULT_PPQ * 8, value: 110 },
                  ],
                },
              ],
              volume: VELOCITY.MAXIMUM,
            },
            {
              type: 'midi',
              name: 'Pad',
              clips: [{ scene: 2 }],
              devices: [
                { name: 'Wavetable', params: { cutoff: 127, resonance: 60, attack: 20, release: 50 } },
              ],
              volume: VELOCITY.HIGH,
            },
            {
              type: 'audio',
              name: 'FX Riser',
              clips: [{ scene: 2 }],
              devices: [
                { name: 'Reverb', params: { decay: 127, size: 127, mix: 80 } },
                { name: 'Auto Filter', params: { frequency: 20, resonance: 80 } },
              ],
              volume: VELOCITY.HIGH,
            },
          ],
        },
      ],
    };
  }

  // ── Generic fallback: simple 8-bar arrangement ──
  return {
    tempo: DEFAULT_BPM,
    timeSignature: { numerator: 4, denominator: 4 },
    sections: [
      {
        name: 'Generated Section',
        bars: FIB[5], // 8 bars
        tracks: [
          {
            type: 'midi',
            name: 'Lead',
            clips: [
              {
                scene: 0,
                notes: [
                  [60, VELOCITY.MEDIUM, 0, DEFAULT_PPQ],
                  [64, VELOCITY.MEDIUM, DEFAULT_PPQ, DEFAULT_PPQ],
                  [67, VELOCITY.HIGH, DEFAULT_PPQ * 2, DEFAULT_PPQ * 2],
                ],
              },
            ],
            volume: VELOCITY.HIGH,
          },
        ],
      },
    ],
  };
}

// ─── Validation ───────────────────────────────────────────────────

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether the arrangement is valid
 * @property {string[]} errors - List of error messages
 * @property {string[]} warnings - List of warning messages
 */

/**
 * Validate an arrangement JSON structure.
 * Checks schema compliance, value ranges, and Fibonacci/φ constraints.
 *
 * @param {Arrangement} arrangement - Arrangement to validate
 * @returns {ValidationResult} Validation result
 */
export function validateArrangement(arrangement) {
  const errors = [];
  const warnings = [];

  if (!arrangement) {
    return { valid: false, errors: ['Arrangement is null or undefined'], warnings };
  }

  // Tempo validation
  if (typeof arrangement.tempo !== 'number' || arrangement.tempo < 20 || arrangement.tempo > 999) {
    errors.push(`Invalid tempo: ${arrangement.tempo} (must be 20-999 BPM)`);
  }

  // Time signature validation
  if (arrangement.timeSignature) {
    const { numerator, denominator } = arrangement.timeSignature;
    if (!numerator || numerator < 1 || numerator > 127) {
      errors.push(`Invalid time signature numerator: ${numerator}`);
    }
    if (!denominator || ![2, 4, 8, 16].includes(denominator)) {
      errors.push(`Invalid time signature denominator: ${denominator}`);
    }
  }

  // Sections validation
  if (!Array.isArray(arrangement.sections) || arrangement.sections.length === 0) {
    errors.push('Arrangement must have at least one section');
  } else if (arrangement.sections.length > MAX_SECTIONS) {
    errors.push(`Too many sections: ${arrangement.sections.length} (max ${MAX_SECTIONS})`);
  } else {
    arrangement.sections.forEach((section, si) => {
      if (!section.name) {
        warnings.push(`Section ${si} has no name`);
      }
      if (!section.bars || section.bars < 1 || section.bars > 127) {
        errors.push(`Section ${si} ("${section.name}"): invalid bars count: ${section.bars}`);
      }
      if (section.tempo && (section.tempo < 20 || section.tempo > 999)) {
        errors.push(`Section ${si} ("${section.name}"): invalid tempo: ${section.tempo}`);
      }

      if (!Array.isArray(section.tracks)) {
        errors.push(`Section ${si} ("${section.name}"): tracks must be an array`);
      } else if (section.tracks.length > MAX_TRACKS_PER_SECTION) {
        errors.push(`Section ${si}: too many tracks (${section.tracks.length} > ${MAX_TRACKS_PER_SECTION})`);
      } else {
        section.tracks.forEach((track, ti) => {
          if (!['midi', 'audio'].includes(track.type)) {
            errors.push(`Section ${si}, Track ${ti}: invalid type "${track.type}"`);
          }
          if (!track.name) {
            warnings.push(`Section ${si}, Track ${ti}: no name`);
          }
          if (track.volume !== undefined && (track.volume < 0 || track.volume > 127)) {
            errors.push(`Section ${si}, Track ${ti}: volume out of range (${track.volume})`);
          }

          // Validate clips
          if (track.clips) {
            track.clips.forEach((clip, ci) => {
              if (clip.scene === undefined || clip.scene < 0 || clip.scene > 127) {
                errors.push(`Section ${si}, Track ${ti}, Clip ${ci}: invalid scene index`);
              }
              if (clip.notes) {
                clip.notes.forEach((note, ni) => {
                  if (!Array.isArray(note) || note.length < 4) {
                    errors.push(`Section ${si}, Track ${ti}, Clip ${ci}, Note ${ni}: invalid format`);
                  } else {
                    const [pitch, vel] = note;
                    if (pitch < 0 || pitch > 127) {
                      errors.push(`Invalid pitch: ${pitch}`);
                    }
                    if (vel < 0 || vel > 127) {
                      errors.push(`Invalid velocity: ${vel}`);
                    }
                  }
                });
              }
            });
          }
        });
      }
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── SysEx Encoder ────────────────────────────────────────────────

/**
 * @typedef {Object} EncodedCommand
 * @property {Uint8Array} sysex - Complete SysEx frame
 * @property {string} description - Human-readable description
 * @property {number} scheduleMs - Scheduled dispatch time (ms from start)
 */

/**
 * Encode an arrangement into a sequence of SysEx commands using the codec.
 * Uses φ-timed scheduling for event timing within bars.
 *
 * @param {Arrangement} arrangement - Validated arrangement
 * @returns {EncodedCommand[]} Ordered list of SysEx commands with timing
 */
export function encodeArrangement(arrangement) {
  /** @type {EncodedCommand[]} */
  const commands = [];
  let currentTimeMs = 0;
  const bpm = arrangement.tempo || DEFAULT_BPM;
  const beatMs = (60 / bpm) * 1000;
  const barMs = beatMs * (arrangement.timeSignature?.numerator || 4);

  // ── Global setup commands ──

  // Set tempo
  commands.push({
    sysex: encodeSetTempo(bpm),
    description: `Set tempo → ${bpm} BPM`,
    scheduleMs: currentTimeMs,
  });

  // Set time signature
  if (arrangement.timeSignature) {
    commands.push({
      sysex: encodeSetTimeSignature(
        arrangement.timeSignature.numerator,
        arrangement.timeSignature.denominator
      ),
      description: `Set time signature → ${arrangement.timeSignature.numerator}/${arrangement.timeSignature.denominator}`,
      scheduleMs: currentTimeMs,
    });
  }

  // Advance by one quantum
  currentTimeMs += Math.round(beatMs * PSI2); // ≈ 0.382 beats for setup headroom

  // ── Track creation (collect unique track names across all sections) ──
  const uniqueTracks = new Map();
  let trackCounter = 0;
  for (const section of arrangement.sections) {
    for (const track of section.tracks) {
      if (!uniqueTracks.has(track.name)) {
        uniqueTracks.set(track.name, { index: trackCounter++, type: track.type });
      }
    }
  }

  for (const [name, { index, type }] of uniqueTracks) {
    const encoder = type === 'audio' ? encodeCreateAudioTrack : encodeCreateMidiTrack;
    commands.push({
      sysex: encoder(name),
      description: `Create ${type} track "${name}" at index ${index}`,
      scheduleMs: currentTimeMs,
    });
    currentTimeMs += Math.round(beatMs * PSI2 * PSI); // Small gap between track creates
  }

  // Advance past track creation
  currentTimeMs += Math.round(beatMs * PSI);

  // ── Section-by-section encoding ──
  for (let si = 0; si < arrangement.sections.length; si++) {
    const section = arrangement.sections[si];
    const sectionStartMs = currentTimeMs;
    const sectionBars = section.bars || FIB[5];
    const sectionDurationMs = sectionBars * barMs;

    // Section-local tempo
    if (section.tempo && section.tempo !== bpm) {
      commands.push({
        sysex: encodeSetTempo(section.tempo),
        description: `[${section.name}] Tempo → ${section.tempo} BPM`,
        scheduleMs: currentTimeMs,
      });
    }

    // Process tracks in this section
    for (const track of section.tracks) {
      const trackInfo = uniqueTracks.get(track.name);
      if (!trackInfo) continue;
      const trackIdx = trackInfo.index;

      // Set volume if specified
      if (track.volume !== undefined) {
        commands.push({
          sysex: encodeSetTrackVolume(trackIdx, track.volume),
          description: `[${section.name}] "${track.name}" volume → ${track.volume}`,
          scheduleMs: currentTimeMs,
        });
      }

      // Arm track if specified
      if (track.armed) {
        commands.push({
          sysex: encodeArmTrack(trackIdx, 1),
          description: `[${section.name}] "${track.name}" arm`,
          scheduleMs: currentTimeMs,
        });
      }

      // Set device parameters
      if (track.devices) {
        track.devices.forEach((device, devIdx) => {
          if (device.params) {
            Object.entries(device.params).forEach(([paramName, value], paramIdx) => {
              commands.push({
                sysex: encodeSetDeviceParam(trackIdx, devIdx, paramIdx, value & 0x7F),
                description: `[${section.name}] "${track.name}" → ${device.name}.${paramName} = ${value}`,
                scheduleMs: currentTimeMs + Math.round(paramIdx * beatMs * PSI2 * PSI),
              });
            });
          }
        });
      }

      // Trigger clips with φ-timed scheduling
      if (track.clips) {
        track.clips.forEach((clip, clipIdx) => {
          // φ-subdivide timing within the section
          const clipOffsetMs = Math.round(clipIdx * barMs * PSI);

          // Set clip name if present
          if (clip.name) {
            commands.push({
              sysex: encodeSetClipName(trackIdx, clip.scene, clip.name),
              description: `[${section.name}] "${track.name}" clip name → "${clip.name}"`,
              scheduleMs: currentTimeMs + clipOffsetMs,
            });
          }

          // Trigger the clip
          commands.push({
            sysex: encodeTriggerClip(trackIdx, clip.scene),
            description: `[${section.name}] "${track.name}" trigger clip scene=${clip.scene}`,
            scheduleMs: currentTimeMs + clipOffsetMs + Math.round(beatMs * PSI2),
          });
        });
      }
    }

    // Advance time by the section duration (with φ-overlap for smooth transitions)
    currentTimeMs = sectionStartMs + Math.round(sectionDurationMs * (1 - PSI2 * 0.1));
  }

  // ── Start transport at the end ──
  commands.push({
    sysex: encodeTransport(0x01), // PLAY
    description: 'Transport → PLAY',
    scheduleMs: 0, // Transport starts first (reorder at dispatch time)
  });

  // Sort by scheduled time
  commands.sort((a, b) => a.scheduleMs - b.scheduleMs);

  // Enforce max command limit
  if (commands.length > MAX_SYSEX_COMMANDS) {
    commands.length = MAX_SYSEX_COMMANDS;
  }

  return commands;
}

// ─── Pipeline Class ───────────────────────────────────────────────

/**
 * ArrangementPipeline — Orchestrates the full cloud-to-Ableton arrangement
 * workflow: parse → generate → validate → encode → dispatch.
 *
 * @class
 * @extends EventEmitter
 *
 * @fires ArrangementPipeline#progress - Stage progress updates
 * @fires ArrangementPipeline#stage_complete - When a pipeline stage finishes
 * @fires ArrangementPipeline#complete - When the full pipeline finishes
 * @fires ArrangementPipeline#error - On pipeline errors
 * @fires ArrangementPipeline#midi - Task lifecycle MIDI events
 *
 * @example
 * const pipeline = new ArrangementPipeline({ dispatch: sysexBytes => sendToAbleton(sysexBytes) });
 * const result = await pipeline.run('4-bar intro with pad swell, verse with drums and bass, build to chorus');
 * console.log(result.commandCount); // Number of SysEx commands dispatched
 */
export class ArrangementPipeline extends EventEmitter {
  /**
   * @param {Object} [options]
   * @param {Function} [options.dispatch] - SysEx dispatch function (receives Uint8Array)
   * @param {Function} [options.log=console.log] - Log function
   * @param {Function} [options.llmParser=parseNaturalLanguage] - Custom LLM parser
   * @param {boolean} [options.dryRun=false] - If true, encode but don't dispatch
   */
  constructor(options = {}) {
    super();

    /** @type {Function} */
    this._dispatch = options.dispatch ?? (() => {});

    /** @type {Function} */
    this._log = options.log ?? console.log;

    /** @type {Function} */
    this._llmParser = options.llmParser ?? parseNaturalLanguage;

    /** @type {boolean} */
    this._dryRun = options.dryRun ?? false;

    /** @type {PipelineEventBus} Internal MIDI event bus */
    this._eventBus = new PipelineEventBus();

    // Forward MIDI events
    this._eventBus.on('midi', (event) => this.emit('midi', event));
    this._eventBus.on('progress', (event) => this.emit('progress', event));

    /** @type {boolean} Whether a pipeline run is in progress */
    this._running = false;

    /** @type {number} Total runs completed */
    this._runCount = 0;
  }

  /**
   * Run the full arrangement pipeline.
   *
   * @param {string} description - Natural language arrangement description
   * @returns {Promise<PipelineResult>} Pipeline result
   */
  async run(description) {
    if (this._running) {
      throw new Error('Pipeline is already running');
    }

    this._running = true;
    this._runCount++;
    const runId = `run-${this._runCount}-${Date.now().toString(36)}`;
    const startTime = Date.now();

    this._log(`[Pipeline] Starting run ${runId}: "${description.slice(0, 80)}..."`);
    this._emitStageStart(STAGE.PARSE);

    try {
      // ── Stage 1: Parse natural language ──
      this._eventBus.emitMidiEvent(NOTE.TASK_INGEST, VELOCITY.MEDIUM, { stage: STAGE.PARSE });
      this._emitProgress(STAGE.PARSE, 0, 'Parsing natural language description...');

      const arrangement = await this._llmParser(description);

      this._emitProgress(STAGE.PARSE, 100, 'Parse complete');
      this._emitStageComplete(STAGE.PARSE);

      // ── Stage 2: Generate (post-process / enhance) ──
      this._emitStageStart(STAGE.GENERATE);
      this._eventBus.emitMidiEvent(NOTE.TASK_DECOMPOSE, VELOCITY.MEDIUM, { stage: STAGE.GENERATE });
      this._emitProgress(STAGE.GENERATE, 0, 'Generating arrangement structure...');

      const enhanced = this._enhanceArrangement(arrangement);

      this._emitProgress(STAGE.GENERATE, 100, 'Generation complete');
      this._emitStageComplete(STAGE.GENERATE);

      // ── Stage 3: Validate ──
      this._emitStageStart(STAGE.VALIDATE);
      this._eventBus.emitMidiEvent(NOTE.TASK_VALIDATE, VELOCITY.MEDIUM, { stage: STAGE.VALIDATE });
      this._emitProgress(STAGE.VALIDATE, 0, 'Validating arrangement...');

      const validation = validateArrangement(enhanced);

      if (!validation.valid) {
        this._eventBus.emitMidiEvent(NOTE.TASK_FAILED, VELOCITY.CRITICAL, {
          stage: STAGE.VALIDATE,
          errors: validation.errors,
        });
        this._running = false;
        throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
      }

      if (validation.warnings.length > 0) {
        this._log(`[Pipeline] Validation warnings: ${validation.warnings.join('; ')}`);
      }

      this._emitProgress(STAGE.VALIDATE, 100, `Validation passed (${validation.warnings.length} warnings)`);
      this._emitStageComplete(STAGE.VALIDATE);

      // ── Stage 4: Encode to SysEx ──
      this._emitStageStart(STAGE.ENCODE);
      this._eventBus.emitMidiEvent(NOTE.TASK_PERSIST, VELOCITY.MEDIUM, { stage: STAGE.ENCODE });
      this._emitProgress(STAGE.ENCODE, 0, 'Encoding SysEx commands...');

      const commands = encodeArrangement(enhanced);

      this._emitProgress(STAGE.ENCODE, 100, `Encoded ${commands.length} SysEx commands`);
      this._emitStageComplete(STAGE.ENCODE);

      // ── Stage 5: Dispatch ──
      this._emitStageStart(STAGE.DISPATCH);
      this._eventBus.emitMidiEvent(NOTE.TASK_EXECUTE, VELOCITY.HIGH, { stage: STAGE.DISPATCH });
      this._emitProgress(STAGE.DISPATCH, 0, 'Dispatching to Ableton...');

      let dispatched = 0;
      if (!this._dryRun) {
        dispatched = await this._dispatchCommands(commands);
      } else {
        dispatched = commands.length;
        this._log(`[Pipeline] Dry run — ${commands.length} commands prepared but not dispatched`);
      }

      this._emitProgress(STAGE.DISPATCH, 100, `Dispatched ${dispatched} commands`);
      this._emitStageComplete(STAGE.DISPATCH);

      // ── Complete ──
      this._eventBus.emitMidiEvent(NOTE.TASK_COMPLETE, VELOCITY.HIGH, { runId });

      const elapsed = Date.now() - startTime;
      const result = {
        runId,
        success: true,
        commandCount: dispatched,
        sectionCount: enhanced.sections.length,
        trackCount: new Set(enhanced.sections.flatMap(s => s.tracks.map(t => t.name))).size,
        elapsedMs: elapsed,
        arrangement: enhanced,
        validation,
      };

      this._log(`[Pipeline] Complete: ${dispatched} commands in ${elapsed}ms`);
      this.emit('complete', result);
      this._running = false;
      return result;

    } catch (err) {
      this._eventBus.emitMidiEvent(NOTE.TASK_FAILED, VELOCITY.CRITICAL, {
        runId,
        error: err.message,
      });
      this._running = false;
      this.emit('error', { runId, error: err });
      throw err;
    }
  }

  /**
   * Enhance/post-process an arrangement with φ-derived timing refinements.
   * Adds golden ratio subdivisions to note timing for musicality.
   *
   * @param {Arrangement} arrangement - Raw arrangement from parser
   * @returns {Arrangement} Enhanced arrangement
   * @private
   */
  _enhanceArrangement(arrangement) {
    const enhanced = JSON.parse(JSON.stringify(arrangement)); // Deep clone

    for (const section of enhanced.sections) {
      for (const track of section.tracks) {
        if (track.clips) {
          for (const clip of track.clips) {
            if (clip.notes) {
              clip.notes = clip.notes.map(note => {
                const [pitch, velocity, startTick, duration] = note;
                // Apply φ-swing to non-downbeat notes
                const isDownbeat = startTick % DEFAULT_PPQ === 0;
                const swungStart = isDownbeat
                  ? startTick
                  : startTick + Math.round(DEFAULT_PPQ * PHI_SWING * 0.05);

                // Apply φ-scaled duration variation (slight shortening for groove)
                const groovedDuration = Math.round(duration * (1 - PSI2 * 0.05));

                return [pitch, velocity, swungStart, Math.max(1, groovedDuration)];
              });
            }
          }
        }
      }
    }

    return enhanced;
  }

  /**
   * Dispatch encoded SysEx commands with real-time timing.
   * Uses φ-timed scheduling between commands.
   *
   * @param {EncodedCommand[]} commands - Sorted SysEx commands
   * @returns {Promise<number>} Number of successfully dispatched commands
   * @private
   */
  async _dispatchCommands(commands) {
    let dispatched = 0;
    const total = commands.length;
    let lastScheduleMs = 0;

    for (let i = 0; i < total; i++) {
      const cmd = commands[i];

      // Wait for scheduled time delta
      const delta = cmd.scheduleMs - lastScheduleMs;
      if (delta > 0) {
        await new Promise(resolve => setTimeout(resolve, delta));
      }
      lastScheduleMs = cmd.scheduleMs;

      // Dispatch
      try {
        this._dispatch(cmd.sysex);
        dispatched++;
      } catch (err) {
        this._log(`[Dispatch] Error on command ${i}: ${err.message}`);
      }

      // Progress update every φ-derived interval
      if (i % FIB[5] === 0 || i === total - 1) {
        const percent = Math.round(((i + 1) / total) * 100);
        this._emitProgress(STAGE.DISPATCH, percent, `${dispatched}/${total} commands`);
      }
    }

    return dispatched;
  }

  // ─── Event Emission Helpers ─────────────────────────────────────

  /**
   * Emit progress update with cumulative percentage.
   * @param {string} stage - Stage name
   * @param {number} stagePercent - Stage-local percentage (0-100)
   * @param {string} message - Status message
   * @private
   */
  _emitProgress(stage, stagePercent, message) {
    // Calculate cumulative progress across all stages
    const stageOrder = [STAGE.PARSE, STAGE.GENERATE, STAGE.VALIDATE, STAGE.ENCODE, STAGE.DISPATCH];
    const stageIdx = stageOrder.indexOf(stage);
    let cumulative = 0;
    for (let i = 0; i < stageIdx; i++) {
      cumulative += STAGE_WEIGHTS[stageOrder[i]];
    }
    cumulative += STAGE_WEIGHTS[stage] * (stagePercent / 100);
    const totalPercent = Math.round((cumulative / TOTAL_WEIGHT) * 100);

    this._eventBus.emitProgress(stage, totalPercent, message);
  }

  /**
   * Emit stage start event.
   * @param {string} stage - Stage name
   * @private
   */
  _emitStageStart(stage) {
    this.emit('stage_start', { stage, timestamp: Date.now() });
    this._log(`[Pipeline] Stage: ${stage}`);
  }

  /**
   * Emit stage complete event.
   * @param {string} stage - Stage name
   * @private
   */
  _emitStageComplete(stage) {
    this.emit('stage_complete', { stage, timestamp: Date.now() });
  }

  // ─── Accessors ────────────────────────────────────────────────────

  /**
   * Whether the pipeline is currently running.
   * @returns {boolean}
   */
  get isRunning() {
    return this._running;
  }

  /**
   * Total number of pipeline runs completed.
   * @returns {number}
   */
  get runCount() {
    return this._runCount;
  }

  /**
   * Get the internal event bus for external listeners.
   * @returns {PipelineEventBus}
   */
  get eventBus() {
    return this._eventBus;
  }
}

/**
 * @typedef {Object} PipelineResult
 * @property {string} runId - Unique run identifier
 * @property {boolean} success - Whether the pipeline succeeded
 * @property {number} commandCount - Number of SysEx commands dispatched
 * @property {number} sectionCount - Number of arrangement sections
 * @property {number} trackCount - Number of unique tracks
 * @property {number} elapsedMs - Total pipeline execution time (ms)
 * @property {Arrangement} arrangement - The final arrangement JSON
 * @property {ValidationResult} validation - Validation result
 */
