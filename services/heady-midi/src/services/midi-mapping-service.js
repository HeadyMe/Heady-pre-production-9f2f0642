/**
 * @fileoverview Hardware Mapping Service with MIDI Learn — Profile manager
 * for saving/loading/sharing CC-to-parameter mapping profiles. Supports
 * five curve types (LINEAR, LOGARITHMIC, EXPONENTIAL, S_CURVE, BEZIER),
 * configurable dead zones, range limits, and multi-device profiles.
 *
 * Features:
 * - Profile manager: save/load/share mapping profiles as JSON
 * - CC curve editor with five response curves (using applyCurve)
 * - Dead zone and range configuration per CC
 * - Multi-device support: per-controller profiles keyed by device name
 * - MIDI learn: listen for next CC → auto-map to target parameter
 * - JSON file persistence to data/midi-mappings.json
 *
 * @module services/midi-mapping-service
 * @version 2.0.0
 * @author HeadySystems™
 * @license Proprietary — HeadySystems™ & HeadyConnection™
 *
 * ⚡ Made with 💜 by HeadySystems™ & HeadyConnection™
 * Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

import {
  PHI, PSI, PSI2, FIB,
  CURVE_TYPE, applyCurve,
  MIDI_LEARN_TIMEOUT_MS, STATUS,
  CHANNEL, CC, VELOCITY,
} from '../shared/midi-constants.js';

import {
  parseSysEx,
} from '../shared/sysex-codec.js';

import { EventEmitter } from 'events';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';

// ─── Constants ────────────────────────────────────────────────────

/** Default persistence path */
const DEFAULT_STORAGE_PATH = 'data/midi-mappings.json';

/** Maximum mappings per profile (Fibonacci) */
const MAX_MAPPINGS_PER_PROFILE = FIB[13]; // 377

/** Maximum profiles per device (Fibonacci) */
const MAX_PROFILES_PER_DEVICE = FIB[8]; // 34

/** Minimum dead zone range (Fibonacci-scaled fraction) */
const MIN_DEAD_ZONE = FIB[3] / 127; // 2/127 ≈ 0.016

/** Default dead zone size (φ-derived) */
const DEFAULT_DEAD_ZONE = Math.round(FIB[4] * PSI); // 3 × 0.618 ≈ 1.9 → 2

/** Auto-save debounce interval (ms, Fibonacci-scaled) */
const AUTOSAVE_DEBOUNCE_MS = FIB[11] * FIB[3]; // 89 × 2 = 178ms

// ─── Mapping Schema ───────────────────────────────────────────────

/**
 * @typedef {Object} CCMapping
 * @property {string} id - Unique mapping ID
 * @property {string} deviceId - Controller device identifier
 * @property {number} ccNumber - MIDI CC number (0-127)
 * @property {number} channel - MIDI channel (0-15)
 * @property {string} targetParam - Target parameter path (e.g., 'track.0.device.1.param.3')
 * @property {string} curveType - Curve type from CURVE_TYPE enum
 * @property {Object} curveParams - Curve-specific parameters (cp1, cp2, steepness)
 * @property {number} deadZone - Dead zone width (CC units, 0-63)
 * @property {number} rangeMin - Minimum output value (0-127)
 * @property {number} rangeMax - Maximum output value (0-127)
 * @property {string} label - Human-readable label
 */

/**
 * @typedef {Object} MappingProfile
 * @property {string} id - Profile ID
 * @property {string} name - Profile display name
 * @property {string} deviceId - Controller device identifier
 * @property {string} [manufacturer] - Device manufacturer
 * @property {number} createdAt - Creation timestamp
 * @property {number} updatedAt - Last update timestamp
 * @property {CCMapping[]} mappings - CC mappings in this profile
 */

// ─── Mapping ID Generator ─────────────────────────────────────────

/** @type {number} Monotonic ID counter */
let _idCounter = 0;

/**
 * Generate a unique mapping ID using φ-derived encoding.
 * @param {string} prefix - ID prefix (e.g., 'map', 'prof')
 * @returns {string} Unique ID
 */
function generateId(prefix = 'map') {
  _idCounter++;
  const ts = Date.now().toString(36);
  const seq = _idCounter.toString(36).padStart(4, '0');
  return `${prefix}-${ts}-${seq}`;
}

// ─── CC Mapping Processor ─────────────────────────────────────────

/**
 * Process a raw CC value through a mapping's curve, dead zone, and range.
 *
 * @param {number} rawValue - Raw CC value (0-127)
 * @param {CCMapping} mapping - Mapping configuration
 * @returns {{ value: number, normalized: number, inDeadZone: boolean }}
 */
export function processCCValue(rawValue, mapping) {
  const {
    curveType = CURVE_TYPE.LINEAR,
    curveParams = {},
    deadZone = 0,
    rangeMin = 0,
    rangeMax = 127,
  } = mapping;

  // Apply dead zone (centered around midpoint 64)
  if (deadZone > 0) {
    const midpoint = 64;
    const halfDZ = deadZone / 2;
    if (rawValue >= midpoint - halfDZ && rawValue <= midpoint + halfDZ) {
      return { value: Math.round((rangeMin + rangeMax) / 2), normalized: 0.5, inDeadZone: true };
    }
    // Rescale value outside dead zone to fill full range
    if (rawValue < midpoint - halfDZ) {
      rawValue = Math.round((rawValue / (midpoint - halfDZ)) * midpoint);
    } else {
      rawValue = Math.round(midpoint + ((rawValue - midpoint - halfDZ) / (127 - midpoint - halfDZ)) * (127 - midpoint));
    }
  }

  // Apply curve (returns 0.0 - 1.0)
  const curved = applyCurve(rawValue, curveType, curveParams);

  // Map to output range
  const range = rangeMax - rangeMin;
  const mapped = Math.round(rangeMin + curved * range);
  const clamped = Math.max(0, Math.min(127, mapped));

  return { value: clamped, normalized: curved, inDeadZone: false };
}

// ─── MIDI Learn Session ───────────────────────────────────────────

/**
 * @typedef {Object} LearnSession
 * @property {string} targetParam - Parameter to map to
 * @property {string} label - Display label for the mapping
 * @property {string} curveType - Default curve type
 * @property {number} startedAt - Session start time
 * @property {Function} resolve - Promise resolve callback
 * @property {Function} reject - Promise reject callback
 * @property {NodeJS.Timeout} timeout - Timeout handle
 */

// ─── Main Service Class ──────────────────────────────────────────

/**
 * MidiMappingService — Manages CC-to-parameter mappings with MIDI learn,
 * multi-device profiles, curve editing, and JSON file persistence.
 *
 * @class
 * @extends EventEmitter
 *
 * @fires MidiMappingService#mapping_added - When a mapping is created
 * @fires MidiMappingService#mapping_removed - When a mapping is deleted
 * @fires MidiMappingService#mapping_updated - When a mapping is modified
 * @fires MidiMappingService#profile_loaded - When a profile is loaded
 * @fires MidiMappingService#profile_saved - When a profile is saved
 * @fires MidiMappingService#learn_start - When MIDI learn starts
 * @fires MidiMappingService#learn_complete - When MIDI learn captures a CC
 * @fires MidiMappingService#learn_timeout - When MIDI learn times out
 * @fires MidiMappingService#cc_value - When a mapped CC value is processed
 *
 * @example
 * const service = new MidiMappingService({ storagePath: 'data/midi-mappings.json' });
 * await service.load();
 *
 * // Create a profile for a controller
 * const profile = service.createProfile('my-controller', 'Akai MPK Mini');
 *
 * // Start MIDI learn
 * const mapping = await service.startLearn('my-controller', 'track.0.volume', 'Volume Fader');
 * // → User moves a CC knob → mapping is auto-created
 *
 * // Process incoming CC
 * const result = service.processCC('my-controller', 0, 1, 64);
 * console.log(result.value); // Curve-mapped value
 */
export class MidiMappingService extends EventEmitter {
  /**
   * @param {Object} [options]
   * @param {string} [options.storagePath=DEFAULT_STORAGE_PATH] - JSON file path
   * @param {Function} [options.log=console.log] - Log function
   * @param {boolean} [options.autoSave=true] - Auto-save on changes
   */
  constructor(options = {}) {
    super();

    /** @type {string} */
    this._storagePath = resolve(options.storagePath ?? DEFAULT_STORAGE_PATH);

    /** @type {Function} */
    this._log = options.log ?? console.log;

    /** @type {boolean} */
    this._autoSave = options.autoSave ?? true;

    /**
     * Profiles indexed by deviceId.
     * @type {Map<string, MappingProfile[]>}
     */
    this._profiles = new Map();

    /**
     * Active profile per device.
     * @type {Map<string, string>}
     */
    this._activeProfiles = new Map();

    /**
     * Fast lookup: `${deviceId}:${channel}:${ccNumber}` → CCMapping
     * @type {Map<string, CCMapping>}
     */
    this._lookupIndex = new Map();

    /**
     * Active MIDI learn session (one at a time).
     * @type {LearnSession|null}
     */
    this._learnSession = null;

    /**
     * Auto-save debounce timer.
     * @type {NodeJS.Timeout|null}
     */
    this._saveTimer = null;

    /** @type {boolean} Whether data has been loaded from disk */
    this._loaded = false;
  }

  // ─── Profile Management ───────────────────────────────────────────

  /**
   * Create a new mapping profile for a device.
   *
   * @param {string} deviceId - Controller device identifier
   * @param {string} name - Profile display name
   * @param {string} [manufacturer=''] - Device manufacturer
   * @returns {MappingProfile} The created profile
   */
  createProfile(deviceId, name, manufacturer = '') {
    const profile = {
      id: generateId('prof'),
      name,
      deviceId,
      manufacturer,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      mappings: [],
    };

    if (!this._profiles.has(deviceId)) {
      this._profiles.set(deviceId, []);
    }

    const deviceProfiles = this._profiles.get(deviceId);
    if (deviceProfiles.length >= MAX_PROFILES_PER_DEVICE) {
      throw new Error(`Maximum profiles reached for device "${deviceId}" (${MAX_PROFILES_PER_DEVICE})`);
    }

    deviceProfiles.push(profile);

    // Auto-activate if it's the only profile
    if (deviceProfiles.length === 1) {
      this._activeProfiles.set(deviceId, profile.id);
    }

    this._log(`[Profile] Created "${name}" for device "${deviceId}" (${profile.id})`);
    this._scheduleSave();
    return profile;
  }

  /**
   * Get all profiles for a device.
   *
   * @param {string} deviceId - Controller device identifier
   * @returns {MappingProfile[]} Profiles for this device
   */
  getProfiles(deviceId) {
    return this._profiles.get(deviceId) ?? [];
  }

  /**
   * Get the active profile for a device.
   *
   * @param {string} deviceId - Controller device identifier
   * @returns {MappingProfile|null} Active profile or null
   */
  getActiveProfile(deviceId) {
    const activeId = this._activeProfiles.get(deviceId);
    if (!activeId) return null;
    const profiles = this._profiles.get(deviceId) ?? [];
    return profiles.find(p => p.id === activeId) ?? null;
  }

  /**
   * Activate a profile for a device.
   *
   * @param {string} deviceId - Controller device identifier
   * @param {string} profileId - Profile ID to activate
   * @returns {boolean} Whether activation succeeded
   */
  activateProfile(deviceId, profileId) {
    const profiles = this._profiles.get(deviceId);
    if (!profiles) return false;

    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return false;

    this._activeProfiles.set(deviceId, profileId);
    this._rebuildIndex();
    this._log(`[Profile] Activated "${profile.name}" for device "${deviceId}"`);
    this.emit('profile_loaded', { deviceId, profileId, name: profile.name });
    this._scheduleSave();
    return true;
  }

  /**
   * Delete a profile.
   *
   * @param {string} deviceId - Controller device identifier
   * @param {string} profileId - Profile ID to delete
   * @returns {boolean} Whether deletion succeeded
   */
  deleteProfile(deviceId, profileId) {
    const profiles = this._profiles.get(deviceId);
    if (!profiles) return false;

    const idx = profiles.findIndex(p => p.id === profileId);
    if (idx === -1) return false;

    profiles.splice(idx, 1);

    // Deactivate if it was the active profile
    if (this._activeProfiles.get(deviceId) === profileId) {
      this._activeProfiles.delete(deviceId);
      if (profiles.length > 0) {
        this._activeProfiles.set(deviceId, profiles[0].id);
      }
    }

    this._rebuildIndex();
    this._log(`[Profile] Deleted profile ${profileId} from device "${deviceId}"`);
    this._scheduleSave();
    return true;
  }

  /**
   * Export a profile as a shareable JSON object.
   *
   * @param {string} deviceId - Controller device identifier
   * @param {string} profileId - Profile ID to export
   * @returns {Object|null} Exportable profile JSON or null
   */
  exportProfile(deviceId, profileId) {
    const profile = this.getProfiles(deviceId).find(p => p.id === profileId);
    if (!profile) return null;

    return {
      ...profile,
      exportedAt: Date.now(),
      version: 2,
    };
  }

  /**
   * Import a profile from a JSON object.
   *
   * @param {string} deviceId - Target device identifier
   * @param {Object} profileData - Profile JSON to import
   * @returns {MappingProfile} The imported profile
   */
  importProfile(deviceId, profileData) {
    const profile = {
      id: generateId('prof'),
      name: profileData.name || 'Imported Profile',
      deviceId,
      manufacturer: profileData.manufacturer || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      mappings: (profileData.mappings || []).map(m => ({
        ...m,
        id: generateId('map'),
        deviceId,
      })),
    };

    if (!this._profiles.has(deviceId)) {
      this._profiles.set(deviceId, []);
    }

    this._profiles.get(deviceId).push(profile);
    this._rebuildIndex();
    this._log(`[Profile] Imported "${profile.name}" for device "${deviceId}" (${profile.mappings.length} mappings)`);
    this._scheduleSave();
    return profile;
  }

  // ─── Mapping CRUD ──────────────────────────────────────────────────

  /**
   * Add a CC mapping to the active profile of a device.
   *
   * @param {string} deviceId - Controller device identifier
   * @param {Omit<CCMapping, 'id'|'deviceId'>} mappingData - Mapping configuration
   * @returns {CCMapping|null} Created mapping or null if no active profile
   */
  addMapping(deviceId, mappingData) {
    const profile = this.getActiveProfile(deviceId);
    if (!profile) {
      this._log(`[Mapping] No active profile for device "${deviceId}"`);
      return null;
    }

    if (profile.mappings.length >= MAX_MAPPINGS_PER_PROFILE) {
      throw new Error(`Maximum mappings reached for profile "${profile.name}" (${MAX_MAPPINGS_PER_PROFILE})`);
    }

    /** @type {CCMapping} */
    const mapping = {
      id: generateId('map'),
      deviceId,
      ccNumber: mappingData.ccNumber ?? 0,
      channel: mappingData.channel ?? 0,
      targetParam: mappingData.targetParam ?? '',
      curveType: mappingData.curveType ?? CURVE_TYPE.LINEAR,
      curveParams: mappingData.curveParams ?? {},
      deadZone: mappingData.deadZone ?? DEFAULT_DEAD_ZONE,
      rangeMin: mappingData.rangeMin ?? 0,
      rangeMax: mappingData.rangeMax ?? 127,
      label: mappingData.label ?? `CC${mappingData.ccNumber}`,
    };

    // Remove any existing mapping for the same CC/channel on this device
    const existingIdx = profile.mappings.findIndex(
      m => m.ccNumber === mapping.ccNumber && m.channel === mapping.channel
    );
    if (existingIdx !== -1) {
      profile.mappings.splice(existingIdx, 1);
    }

    profile.mappings.push(mapping);
    profile.updatedAt = Date.now();

    // Update lookup index
    const key = `${deviceId}:${mapping.channel}:${mapping.ccNumber}`;
    this._lookupIndex.set(key, mapping);

    this._log(`[Mapping] Added: CC${mapping.ccNumber} ch${mapping.channel} → "${mapping.targetParam}" (${mapping.curveType})`);
    this.emit('mapping_added', mapping);
    this._scheduleSave();
    return mapping;
  }

  /**
   * Remove a mapping by ID.
   *
   * @param {string} deviceId - Controller device identifier
   * @param {string} mappingId - Mapping ID to remove
   * @returns {boolean} Whether removal succeeded
   */
  removeMapping(deviceId, mappingId) {
    const profile = this.getActiveProfile(deviceId);
    if (!profile) return false;

    const idx = profile.mappings.findIndex(m => m.id === mappingId);
    if (idx === -1) return false;

    const [removed] = profile.mappings.splice(idx, 1);
    profile.updatedAt = Date.now();

    // Remove from lookup index
    const key = `${deviceId}:${removed.channel}:${removed.ccNumber}`;
    this._lookupIndex.delete(key);

    this._log(`[Mapping] Removed: ${mappingId} (CC${removed.ccNumber})`);
    this.emit('mapping_removed', removed);
    this._scheduleSave();
    return true;
  }

  /**
   * Update an existing mapping's parameters.
   *
   * @param {string} deviceId - Controller device identifier
   * @param {string} mappingId - Mapping ID to update
   * @param {Partial<CCMapping>} updates - Fields to update
   * @returns {CCMapping|null} Updated mapping or null
   */
  updateMapping(deviceId, mappingId, updates) {
    const profile = this.getActiveProfile(deviceId);
    if (!profile) return null;

    const mapping = profile.mappings.find(m => m.id === mappingId);
    if (!mapping) return null;

    // Remove old index key if CC/channel changed
    const oldKey = `${deviceId}:${mapping.channel}:${mapping.ccNumber}`;

    // Apply updates (only allowed fields)
    const allowedFields = [
      'ccNumber', 'channel', 'targetParam', 'curveType',
      'curveParams', 'deadZone', 'rangeMin', 'rangeMax', 'label',
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        mapping[field] = updates[field];
      }
    }

    profile.updatedAt = Date.now();

    // Update index
    this._lookupIndex.delete(oldKey);
    const newKey = `${deviceId}:${mapping.channel}:${mapping.ccNumber}`;
    this._lookupIndex.set(newKey, mapping);

    this._log(`[Mapping] Updated: ${mappingId}`);
    this.emit('mapping_updated', mapping);
    this._scheduleSave();
    return mapping;
  }

  /**
   * Get a mapping by CC number and channel for a device.
   *
   * @param {string} deviceId - Controller device identifier
   * @param {number} channel - MIDI channel (0-15)
   * @param {number} ccNumber - CC number (0-127)
   * @returns {CCMapping|null} Mapping or null
   */
  getMapping(deviceId, channel, ccNumber) {
    const key = `${deviceId}:${channel}:${ccNumber}`;
    return this._lookupIndex.get(key) ?? null;
  }

  /**
   * Get all mappings for a device's active profile.
   *
   * @param {string} deviceId - Controller device identifier
   * @returns {CCMapping[]} All mappings
   */
  getMappings(deviceId) {
    const profile = this.getActiveProfile(deviceId);
    return profile?.mappings ?? [];
  }

  // ─── CC Processing ──────────────────────────────────────────────

  /**
   * Process an incoming CC value through the mapping pipeline.
   * Looks up the mapping, applies curve/dead zone/range, and emits events.
   *
   * @param {string} deviceId - Source device identifier
   * @param {number} channel - MIDI channel (0-15)
   * @param {number} ccNumber - CC number (0-127)
   * @param {number} rawValue - Raw CC value (0-127)
   * @returns {{ value: number, normalized: number, inDeadZone: boolean, mapped: boolean, targetParam: string|null }}
   */
  processCC(deviceId, channel, ccNumber, rawValue) {
    // Check if MIDI learn is active
    if (this._learnSession) {
      this._handleLearnCC(deviceId, channel, ccNumber, rawValue);
    }

    const mapping = this.getMapping(deviceId, channel, ccNumber);
    if (!mapping) {
      return { value: rawValue, normalized: rawValue / 127, inDeadZone: false, mapped: false, targetParam: null };
    }

    const result = processCCValue(rawValue, mapping);

    this.emit('cc_value', {
      deviceId,
      channel,
      ccNumber,
      rawValue,
      mappedValue: result.value,
      normalized: result.normalized,
      inDeadZone: result.inDeadZone,
      targetParam: mapping.targetParam,
      label: mapping.label,
    });

    return {
      ...result,
      mapped: true,
      targetParam: mapping.targetParam,
    };
  }

  // ─── MIDI Learn ─────────────────────────────────────────────────

  /**
   * Start a MIDI learn session. Listens for the next CC message from any
   * device on any channel, and auto-creates a mapping to the specified target.
   *
   * @param {string} deviceId - Device to create mapping for
   * @param {string} targetParam - Target parameter path
   * @param {string} [label=''] - Mapping label
   * @param {string} [curveType=CURVE_TYPE.LINEAR] - Default curve type
   * @returns {Promise<CCMapping>} Resolves with the created mapping
   * @throws {Error} If learn times out or is cancelled
   */
  startLearn(deviceId, targetParam, label = '', curveType = CURVE_TYPE.LINEAR) {
    // Cancel any existing learn session
    if (this._learnSession) {
      this.cancelLearn();
    }

    // Ensure device has an active profile
    if (!this.getActiveProfile(deviceId)) {
      this.createProfile(deviceId, `${deviceId} Default`);
    }

    this._log(`[Learn] Started — listening for CC on device "${deviceId}" → "${targetParam}"`);
    this.emit('learn_start', { deviceId, targetParam, label });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._learnSession = null;
        this._log(`[Learn] Timed out after ${MIDI_LEARN_TIMEOUT_MS}ms`);
        this.emit('learn_timeout', { deviceId, targetParam });
        reject(new Error(`MIDI learn timed out after ${MIDI_LEARN_TIMEOUT_MS}ms`));
      }, MIDI_LEARN_TIMEOUT_MS);

      this._learnSession = {
        deviceId,
        targetParam,
        label,
        curveType,
        startedAt: Date.now(),
        resolve,
        reject,
        timeout,
      };
    });
  }

  /**
   * Cancel an active MIDI learn session.
   */
  cancelLearn() {
    if (this._learnSession) {
      clearTimeout(this._learnSession.timeout);
      this._learnSession.reject(new Error('MIDI learn cancelled'));
      this._learnSession = null;
      this._log('[Learn] Cancelled');
    }
  }

  /**
   * Handle a CC message during an active learn session.
   *
   * @param {string} deviceId - Source device
   * @param {number} channel - MIDI channel
   * @param {number} ccNumber - CC number
   * @param {number} value - CC value
   * @private
   */
  _handleLearnCC(deviceId, channel, ccNumber, value) {
    const session = this._learnSession;
    if (!session) return;

    // Only respond to the target device (or accept any if device matches)
    if (session.deviceId !== deviceId) return;

    // Clear the session
    clearTimeout(session.timeout);
    this._learnSession = null;

    // Create the mapping
    const mapping = this.addMapping(deviceId, {
      ccNumber,
      channel,
      targetParam: session.targetParam,
      curveType: session.curveType,
      curveParams: {},
      deadZone: DEFAULT_DEAD_ZONE,
      rangeMin: 0,
      rangeMax: 127,
      label: session.label || `CC${ccNumber} → ${session.targetParam}`,
    });

    this._log(`[Learn] Complete: CC${ccNumber} ch${channel} → "${session.targetParam}"`);
    this.emit('learn_complete', {
      deviceId,
      channel,
      ccNumber,
      targetParam: session.targetParam,
      mapping,
    });

    session.resolve(mapping);
  }

  // ─── Persistence ────────────────────────────────────────────────

  /**
   * Load all profiles from the JSON file.
   * @returns {Promise<void>}
   */
  async load() {
    try {
      const raw = await readFile(this._storagePath, 'utf-8');
      const data = JSON.parse(raw);

      this._profiles.clear();
      this._activeProfiles.clear();

      if (data.profiles) {
        for (const [deviceId, profiles] of Object.entries(data.profiles)) {
          this._profiles.set(deviceId, profiles);
        }
      }

      if (data.activeProfiles) {
        for (const [deviceId, profileId] of Object.entries(data.activeProfiles)) {
          this._activeProfiles.set(deviceId, profileId);
        }
      }

      this._rebuildIndex();
      this._loaded = true;
      this._log(`[Storage] Loaded ${this._profiles.size} devices from ${this._storagePath}`);
    } catch (err) {
      if (err.code === 'ENOENT') {
        this._log('[Storage] No existing mappings file — starting fresh');
        this._loaded = true;
      } else {
        this._log(`[Storage] Load error: ${err.message}`);
        throw err;
      }
    }
  }

  /**
   * Save all profiles to the JSON file.
   * @returns {Promise<void>}
   */
  async save() {
    const data = {
      version: 2,
      savedAt: Date.now(),
      profiles: Object.fromEntries(this._profiles),
      activeProfiles: Object.fromEntries(this._activeProfiles),
    };

    try {
      // Ensure directory exists
      await mkdir(dirname(this._storagePath), { recursive: true });
      await writeFile(this._storagePath, JSON.stringify(data, null, 2), 'utf-8');
      this._log(`[Storage] Saved to ${this._storagePath}`);
      this.emit('profile_saved', { path: this._storagePath, deviceCount: this._profiles.size });
    } catch (err) {
      this._log(`[Storage] Save error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Schedule a debounced auto-save.
   * @private
   */
  _scheduleSave() {
    if (!this._autoSave) return;

    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
    }

    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this.save().catch(err => this._log(`[AutoSave] Error: ${err.message}`));
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  /**
   * Rebuild the fast lookup index from all active profiles.
   * @private
   */
  _rebuildIndex() {
    this._lookupIndex.clear();

    for (const [deviceId, activeProfileId] of this._activeProfiles) {
      const profiles = this._profiles.get(deviceId) ?? [];
      const active = profiles.find(p => p.id === activeProfileId);
      if (!active) continue;

      for (const mapping of active.mappings) {
        const key = `${deviceId}:${mapping.channel}:${mapping.ccNumber}`;
        this._lookupIndex.set(key, mapping);
      }
    }

    this._log(`[Index] Rebuilt with ${this._lookupIndex.size} mappings`);
  }

  // ─── Accessors ──────────────────────────────────────────────────

  /**
   * Get all known device IDs.
   * @returns {string[]}
   */
  get deviceIds() {
    return Array.from(this._profiles.keys());
  }

  /**
   * Get the total number of mappings across all devices.
   * @returns {number}
   */
  get totalMappings() {
    return this._lookupIndex.size;
  }

  /**
   * Whether data has been loaded from disk.
   * @returns {boolean}
   */
  get isLoaded() {
    return this._loaded;
  }

  /**
   * Whether a MIDI learn session is active.
   * @returns {boolean}
   */
  get isLearning() {
    return this._learnSession !== null;
  }

  /**
   * Get all supported curve types.
   * @returns {Object} CURVE_TYPE enum
   */
  get curveTypes() {
    return CURVE_TYPE;
  }
}
