/**
 * @fileoverview MidiMapper — Hardware Mapping Configurator page.
 * MIDI Learn integration, mapping table, CC curve editor with SVG previews,
 * profile management, and Bezier control point dragging.
 *
 * @module client/pages/MidiMapper
 * @version 2.0.0
 * @author HeadySystems™
 * @license Proprietary — HeadySystems™ & HeadyConnection™
 *
 * ⚡ Made with 💜 by HeadySystems™ & HeadyConnection™
 * Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useMidiWebSocket } from '../hooks/useMidiWebSocket.js';
import { useMidiLearn } from '../hooks/useMidiLearn.js';
import {
  CURVE_TYPE, applyCurve, CHANNEL_LABELS, CHANNEL_COLORS, CC_LABELS,
  FIB, PSI, PSI2, MIDI_LEARN_TIMEOUT_MS,
} from '../../shared/midi-constants.js';
import '../styles/midi-dashboard.css';

// ─── Constants ─────────────────────────────────────────────────────
const CURVE_TYPES = Object.values(CURVE_TYPE);
const CURVE_LABELS = {
  [CURVE_TYPE.LINEAR]: 'Linear',
  [CURVE_TYPE.LOGARITHMIC]: 'Logarithmic',
  [CURVE_TYPE.EXPONENTIAL]: 'Exponential (φ)',
  [CURVE_TYPE.S_CURVE]: 'S-Curve (Sigmoid)',
  [CURVE_TYPE.BEZIER]: 'Bezier (Custom)',
};

/** Default mapping row */
function createDefaultMapping() {
  return {
    id: `map_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    device: 'Unknown',
    cc: 1,
    channel: 0,
    target: '',
    curveType: CURVE_TYPE.LINEAR,
    curveParams: { cp1: PSI2, cp2: PSI },
    deadZone: 0,
    rangeMin: 0,
    rangeMax: 127,
  };
}

/** Profile storage key */
const PROFILES_KEY = 'heady_midi_mapper_profiles';
const ACTIVE_PROFILE_KEY = 'heady_midi_mapper_active_profile';

/**
 * Generate SVG path data for a curve preview.
 * @param {string} curveType - Curve type from CURVE_TYPE enum
 * @param {Object} params - Curve parameters
 * @param {number} width - SVG width
 * @param {number} height - SVG height
 * @returns {string} SVG path d attribute
 */
function generateCurvePath(curveType, params, width, height) {
  const steps = 50;
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const ccVal = (i / steps) * 127;
    const mapped = applyCurve(ccVal, curveType, params);
    const x = (i / steps) * width;
    const y = height - mapped * (height - 4) - 2;
    points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return points.join(' ');
}

/**
 * Tiny inline curve preview SVG for table rows.
 * @param {Object} props
 * @param {string} props.curveType - Curve type
 * @param {Object} props.params - Curve parameters
 */
function CurveThumb({ curveType, params }) {
  const path = useMemo(
    () => generateCurvePath(curveType, params, 40, 20),
    [curveType, params]
  );
  return (
    <svg width="40" height="20" viewBox="0 0 40 20" style={{ display: 'block' }}>
      <rect width="40" height="20" fill="rgba(0,0,0,0.2)" rx="2" />
      <path d={path} fill="none" stroke="var(--midi-accent)" strokeWidth="1.2" />
    </svg>
  );
}

/**
 * CC Curve Editor panel with visual preview and parameter controls.
 * @param {Object} props
 * @param {Object|null} props.mapping - Currently selected mapping (null if none)
 * @param {Function} props.onUpdate - Callback to update mapping fields
 * @param {Function} props.onSave - Save handler
 * @param {Function} props.onCancel - Cancel handler
 */
function CurveEditor({ mapping, onUpdate, onSave, onCancel }) {
  const svgRef = useRef(null);
  const [dragging, setDragging] = useState(null); // 'cp1' | 'cp2' | null

  const curveType = mapping?.curveType || CURVE_TYPE.LINEAR;
  const params = mapping?.curveParams || { cp1: PSI2, cp2: PSI };
  const deadZone = mapping?.deadZone ?? 0;
  const rangeMin = mapping?.rangeMin ?? 0;
  const rangeMax = mapping?.rangeMax ?? 127;

  const previewW = 220;
  const previewH = 180;

  const curvePath = useMemo(
    () => generateCurvePath(curveType, params, previewW, previewH),
    [curveType, params]
  );

  // ── Bezier Control Point Dragging ─────────────────────────────
  const handleMouseDown = useCallback((point) => (e) => {
    e.preventDefault();
    setDragging(point);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!dragging || !svgRef.current || curveType !== CURVE_TYPE.BEZIER) return;
    const rect = svgRef.current.getBoundingClientRect();
    const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    onUpdate({ curveParams: { ...params, [dragging]: y } });
  }, [dragging, curveType, params, onUpdate]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  if (!mapping) {
    return (
      <div className="midi-curve-editor" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--midi-muted)',
        fontFamily: 'var(--font-mono)', fontSize: '12px',
      }}>
        Select a mapping to edit
      </div>
    );
  }

  return (
    <div className="midi-curve-editor">
      {/* Curve Type Selector */}
      <div className="midi-slider-group">
        <label>Curve Type</label>
        <select
          className="midi-select"
          value={curveType}
          onChange={(e) => onUpdate({ curveType: e.target.value })}
        >
          {CURVE_TYPES.map((ct) => (
            <option key={ct} value={ct}>{CURVE_LABELS[ct]}</option>
          ))}
        </select>
      </div>

      {/* Visual Preview */}
      <div className="midi-curve-preview">
        <svg
          ref={svgRef}
          width="100%" height="180"
          viewBox={`0 0 ${previewW} ${previewH}`}
          style={{ cursor: dragging ? 'grabbing' : 'default' }}
        >
          {/* Background grid */}
          {[0.25, 0.5, 0.75].map((frac) => (
            <React.Fragment key={frac}>
              <line
                x1={frac * previewW} y1="0" x2={frac * previewW} y2={previewH}
                stroke="rgba(100,200,255,0.06)" strokeWidth="0.5"
              />
              <line
                x1="0" y1={frac * previewH} x2={previewW} y2={frac * previewH}
                stroke="rgba(100,200,255,0.06)" strokeWidth="0.5"
              />
            </React.Fragment>
          ))}

          {/* Axis labels */}
          <text x="3" y="12" fill="var(--midi-muted)" fontSize="8" fontFamily="var(--font-mono)">
            Output
          </text>
          <text x={previewW - 30} y={previewH - 4} fill="var(--midi-muted)" fontSize="8" fontFamily="var(--font-mono)">
            Input
          </text>

          {/* Dead zone shading */}
          {deadZone > 0 && (
            <rect
              x="0" y="0"
              width={(deadZone / 100) * previewW} height={previewH}
              fill="rgba(255,80,80,0.08)"
            />
          )}

          {/* Diagonal reference (linear) */}
          <line
            x1="0" y1={previewH} x2={previewW} y2="0"
            stroke="rgba(100,200,255,0.08)" strokeWidth="0.5" strokeDasharray="3,3"
          />

          {/* Actual curve */}
          <path d={curvePath} fill="none" stroke="var(--midi-accent)" strokeWidth="2" />

          {/* Bezier control points (draggable) */}
          {curveType === CURVE_TYPE.BEZIER && (
            <>
              <circle
                cx={previewW * 0.33}
                cy={previewH - params.cp1 * (previewH - 4) - 2}
                r="6" fill="var(--midi-accent)" opacity="0.8"
                style={{ cursor: 'grab' }}
                onMouseDown={handleMouseDown('cp1')}
              />
              <circle
                cx={previewW * 0.66}
                cy={previewH - params.cp2 * (previewH - 4) - 2}
                r="6" fill="var(--midi-purple)" opacity="0.8"
                style={{ cursor: 'grab' }}
                onMouseDown={handleMouseDown('cp2')}
              />
              <text
                x={previewW * 0.33 + 10}
                y={previewH - params.cp1 * (previewH - 4)}
                fill="var(--midi-accent)" fontSize="8" fontFamily="var(--font-mono)"
              >
                CP1: {params.cp1.toFixed(3)}
              </text>
              <text
                x={previewW * 0.66 + 10}
                y={previewH - params.cp2 * (previewH - 4)}
                fill="var(--midi-purple)" fontSize="8" fontFamily="var(--font-mono)"
              >
                CP2: {params.cp2.toFixed(3)}
              </text>
            </>
          )}
        </svg>
      </div>

      {/* Dead Zone */}
      <div className="midi-slider-group">
        <label>Dead Zone: {deadZone}%</label>
        <input
          type="range" min="0" max="20" step="1"
          value={deadZone}
          onChange={(e) => onUpdate({ deadZone: Number(e.target.value) })}
        />
      </div>

      {/* Range Min/Max */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-8)' }}>
        <div className="midi-slider-group">
          <label>Range Min: {rangeMin}</label>
          <input
            type="range" min="0" max="126" step="1"
            value={rangeMin}
            onChange={(e) => onUpdate({ rangeMin: Math.min(Number(e.target.value), rangeMax - 1) })}
          />
        </div>
        <div className="midi-slider-group">
          <label>Range Max: {rangeMax}</label>
          <input
            type="range" min="1" max="127" step="1"
            value={rangeMax}
            onChange={(e) => onUpdate({ rangeMax: Math.max(Number(e.target.value), rangeMin + 1) })}
          />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 'var(--sp-8)', marginTop: 'var(--sp-5)' }}>
        <button className="midi-btn midi-btn--primary" onClick={onSave} style={{ flex: 1 }}>
          Save
        </button>
        <button className="midi-btn" onClick={onCancel} style={{ flex: 1 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * MidiMapper — Hardware Mapping Configurator page.
 * Left panel: mapping table with MIDI Learn. Right panel: CC Curve Editor.
 * Profile management bar at top.
 *
 * @returns {React.ReactElement}
 */
export default function MidiMapper() {
  // ── Hooks ──────────────────────────────────────────────────────
  const { connected, events } = useMidiWebSocket();
  const midiLearn = useMidiLearn({ events, connected });

  // ── Local State ────────────────────────────────────────────────
  const [mappings, setMappings] = useState(/** @type {Object[]} */ ([]));
  const [selectedId, setSelectedId] = useState(/** @type {string|null} */ (null));
  const [editBuffer, setEditBuffer] = useState(/** @type {Object|null} */ (null));

  // ── Profile State ──────────────────────────────────────────────
  const [profiles, setProfiles] = useState(() => {
    try {
      const stored = localStorage.getItem(PROFILES_KEY);
      return stored ? JSON.parse(stored) : { Default: [] };
    } catch { return { Default: [] }; }
  });
  const [activeProfile, setActiveProfile] = useState(() => {
    try {
      return localStorage.getItem(ACTIVE_PROFILE_KEY) || 'Default';
    } catch { return 'Default'; }
  });

  // ── Load profile mappings on profile change ────────────────────
  useEffect(() => {
    setMappings(profiles[activeProfile] || []);
    setSelectedId(null);
    setEditBuffer(null);
  }, [activeProfile, profiles]);

  // ── Persist profiles to localStorage ───────────────────────────
  const saveProfiles = useCallback((newProfiles) => {
    setProfiles(newProfiles);
    try { localStorage.setItem(PROFILES_KEY, JSON.stringify(newProfiles)); } catch { /* noop */ }
  }, []);

  const saveActiveProfile = useCallback((name) => {
    setActiveProfile(name);
    try { localStorage.setItem(ACTIVE_PROFILE_KEY, name); } catch { /* noop */ }
  }, []);

  // ── Mapping CRUD ───────────────────────────────────────────────
  const addMapping = useCallback(() => {
    const newMapping = createDefaultMapping();
    setMappings((prev) => {
      const updated = [...prev, newMapping];
      saveProfiles({ ...profiles, [activeProfile]: updated });
      return updated;
    });
    setSelectedId(newMapping.id);
    setEditBuffer({ ...newMapping });
  }, [profiles, activeProfile, saveProfiles]);

  const deleteMapping = useCallback((id) => {
    setMappings((prev) => {
      const updated = prev.filter((m) => m.id !== id);
      saveProfiles({ ...profiles, [activeProfile]: updated });
      return updated;
    });
    if (selectedId === id) {
      setSelectedId(null);
      setEditBuffer(null);
    }
  }, [profiles, activeProfile, saveProfiles, selectedId]);

  const selectMapping = useCallback((id) => {
    const mapping = mappings.find((m) => m.id === id);
    setSelectedId(id);
    setEditBuffer(mapping ? { ...mapping } : null);
  }, [mappings]);

  const updateEditBuffer = useCallback((updates) => {
    setEditBuffer((prev) => prev ? { ...prev, ...updates } : null);
  }, []);

  const saveEdit = useCallback(() => {
    if (!editBuffer || !selectedId) return;
    setMappings((prev) => {
      const updated = prev.map((m) => m.id === selectedId ? { ...editBuffer } : m);
      saveProfiles({ ...profiles, [activeProfile]: updated });
      return updated;
    });
  }, [editBuffer, selectedId, profiles, activeProfile, saveProfiles]);

  const cancelEdit = useCallback(() => {
    const mapping = mappings.find((m) => m.id === selectedId);
    setEditBuffer(mapping ? { ...mapping } : null);
  }, [mappings, selectedId]);

  // ── MIDI Learn Integration ─────────────────────────────────────
  const startLearnForNew = useCallback(() => {
    const newMapping = createDefaultMapping();
    newMapping.target = `param_${Date.now()}`;
    setMappings((prev) => [...prev, newMapping]);
    setSelectedId(newMapping.id);
    setEditBuffer({ ...newMapping });
    midiLearn.startLearn(newMapping.target);
  }, [midiLearn]);

  // When MIDI Learn detects a CC, update the latest mapping
  useEffect(() => {
    if (midiLearn.lastDetected && selectedId) {
      const { channel, cc } = midiLearn.lastDetected;
      setEditBuffer((prev) => prev ? { ...prev, channel, cc } : null);
      setMappings((prev) => {
        const updated = prev.map((m) =>
          m.id === selectedId ? { ...m, channel, cc, device: `Ch${channel}:CC${cc}` } : m
        );
        saveProfiles({ ...profiles, [activeProfile]: updated });
        return updated;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midiLearn.lastDetected]);

  // ── Profile Actions ────────────────────────────────────────────
  const saveProfile = useCallback(() => {
    saveProfiles({ ...profiles, [activeProfile]: mappings });
  }, [profiles, activeProfile, mappings, saveProfiles]);

  const createProfile = useCallback(() => {
    const name = `Profile ${Object.keys(profiles).length + 1}`;
    const newProfiles = { ...profiles, [name]: [] };
    saveProfiles(newProfiles);
    saveActiveProfile(name);
  }, [profiles, saveProfiles, saveActiveProfile]);

  const exportProfile = useCallback(() => {
    const data = JSON.stringify({ name: activeProfile, mappings }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `heady-midi-${activeProfile.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeProfile, mappings]);

  const importProfile = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(/** @type {string} */ (ev.target?.result));
          const name = data.name || file.name.replace('.json', '');
          const newProfiles = { ...profiles, [name]: data.mappings || [] };
          saveProfiles(newProfiles);
          saveActiveProfile(name);
        } catch { /* Invalid JSON — silent fail */ }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [profiles, saveProfiles, saveActiveProfile]);

  return (
    <div className="midi-dashboard midi-sacred-bg">
      {/* Header */}
      <header className="midi-dashboard__header">
        <h1>
          <span style={{ marginRight: 'var(--sp-5)' }}>⬡</span>
          MIDI Mapper
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-8)' }}>
          <span className={`midi-badge midi-badge--${connected ? 'connected' : 'disconnected'}`}>
            <span className={`midi-led${connected ? ' midi-led--connected' : ''}`} />
            {connected ? 'Connected' : 'Disconnected'}
          </span>
          {midiLearn.learning && (
            <span className="midi-badge midi-badge--learning">
              <span className="midi-led midi-led--learning" />
              Learning ({Math.ceil(midiLearn.timeRemaining / 1000)}s)
            </span>
          )}
        </div>
      </header>

      {/* Profile Manager Bar */}
      <div className="midi-profile-bar" style={{ margin: 'var(--sp-13) var(--sp-13) 0' }}>
        <span className="midi-profile-bar__label">Profile:</span>
        <select
          className="midi-select"
          value={activeProfile}
          onChange={(e) => saveActiveProfile(e.target.value)}
          style={{ width: '180px' }}
        >
          {Object.keys(profiles).map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <button className="midi-btn midi-btn--small" onClick={saveProfile}>Save</button>
        <button className="midi-btn midi-btn--small" onClick={createProfile}>New</button>
        <button className="midi-btn midi-btn--small" onClick={exportProfile}>Export</button>
        <button className="midi-btn midi-btn--small" onClick={importProfile}>Import</button>
      </div>

      {/* Body: Golden Ratio Grid */}
      <main className="midi-dashboard__body">
        <div className="midi-grid">
          {/* Left Panel (61.8%): Mapping Table */}
          <div className="midi-panel midi-scroll" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 'var(--sp-8)',
            }}>
              <div className="midi-panel__title" style={{ margin: 0 }}>Hardware Mappings</div>
              <div style={{ display: 'flex', gap: 'var(--sp-5)' }}>
                <button className="midi-btn midi-btn--primary midi-btn--small" onClick={addMapping}>
                  + Add Mapping
                </button>
                <button
                  className="midi-btn midi-btn--small"
                  onClick={startLearnForNew}
                  disabled={!connected || midiLearn.learning}
                  style={{ opacity: (!connected || midiLearn.learning) ? 0.5 : 1 }}
                >
                  🎹 MIDI Learn
                </button>
              </div>
            </div>

            <table className="midi-table">
              <thead>
                <tr>
                  <th>Device</th>
                  <th>CC#</th>
                  <th>Ch</th>
                  <th>Target</th>
                  <th>Curve</th>
                  <th>Preview</th>
                  <th>Dead</th>
                  <th>Range</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mappings.length === 0 && (
                  <tr>
                    <td colSpan="9" style={{
                      textAlign: 'center', color: 'var(--midi-muted)',
                      padding: 'var(--sp-34)',
                    }}>
                      No mappings configured. Add one or use MIDI Learn.
                    </td>
                  </tr>
                )}
                {mappings.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => selectMapping(m.id)}
                    style={{
                      cursor: 'pointer',
                      background: selectedId === m.id ? 'rgba(100,200,255,0.06)' : undefined,
                    }}
                  >
                    <td>{m.device}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>
                      {m.cc}
                      <span style={{ color: 'var(--midi-muted)', marginLeft: '4px', fontSize: '10px' }}>
                        {CC_LABELS[m.cc] || ''}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: CHANNEL_COLORS[m.channel] || 'var(--midi-text)' }}>
                        {m.channel} {CHANNEL_LABELS[m.channel] ? `(${CHANNEL_LABELS[m.channel]})` : ''}
                      </span>
                    </td>
                    <td>
                      <input
                        className="midi-input"
                        value={m.target}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMappings((prev) => prev.map((x) =>
                            x.id === m.id ? { ...x, target: val } : x
                          ));
                          if (selectedId === m.id) {
                            setEditBuffer((prev) => prev ? { ...prev, target: val } : null);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: '120px', padding: '2px 5px', fontSize: '11px' }}
                        placeholder="parameter..."
                      />
                    </td>
                    <td style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                      {CURVE_LABELS[m.curveType] || m.curveType}
                    </td>
                    <td>
                      <CurveThumb curveType={m.curveType} params={m.curveParams} />
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                      {m.deadZone}%
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                      {m.rangeMin}–{m.rangeMax}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                        <button
                          className="midi-btn midi-btn--small"
                          onClick={(e) => { e.stopPropagation(); selectMapping(m.id); }}
                        >
                          Edit
                        </button>
                        <button
                          className="midi-btn midi-btn--danger midi-btn--small"
                          onClick={(e) => { e.stopPropagation(); deleteMapping(m.id); }}
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Right Panel (38.2%): CC Curve Editor */}
          <div className="midi-panel">
            <div className="midi-panel__title">
              CC Curve Editor
              {editBuffer && (
                <span style={{
                  color: 'var(--midi-accent)', fontWeight: 400,
                  marginLeft: 'var(--sp-8)', textTransform: 'none',
                }}>
                  — CC{editBuffer.cc} Ch{editBuffer.channel}
                </span>
              )}
            </div>
            <CurveEditor
              mapping={editBuffer}
              onUpdate={updateEditBuffer}
              onSave={saveEdit}
              onCancel={cancelEdit}
            />
          </div>
        </div>
      </main>

      {/* MIDI Learn Overlay */}
      {midiLearn.learning && (
        <div className="midi-learn-overlay">
          <div className="midi-learn-overlay__ring">
            <div className="midi-learn-overlay__countdown">
              {Math.ceil(midiLearn.timeRemaining / 1000)}s
            </div>
          </div>
          <div className="midi-learn-overlay__text">
            Move a controller...
            <br />
            <span style={{ color: 'var(--midi-muted)', fontSize: '12px' }}>
              Mapping to: {midiLearn.targetParam}
            </span>
          </div>
          <button
            className="midi-btn midi-btn--danger"
            style={{ marginTop: 'var(--sp-21)' }}
            onClick={midiLearn.cancelLearn}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Footer */}
      <footer className="midi-dashboard__footer">
        ⚡ Made with 💜 by HeadySystems™ &amp; HeadyConnection™ — Sacred Geometry :: Organic Systems :: Breathing Interfaces
      </footer>
    </div>
  );
}
