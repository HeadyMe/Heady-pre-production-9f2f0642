/**
 * @fileoverview MidiVisualizer — Combined real-time MIDI visualizer with tabbed views.
 * Piano Roll, CC Curves, SysEx Log, and Latency tabs with Sacred Geometry background.
 *
 * @module client/components/midi/MidiVisualizer
 * @version 2.0.0
 * @author HeadySystems™
 * @license Proprietary — HeadySystems™ & HeadyConnection™
 *
 * ⚡ Made with 💜 by HeadySystems™ & HeadyConnection™
 * Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import PianoRoll from './PianoRoll.jsx';
import SysExLog from './SysExLog.jsx';
import LatencyGraph from './LatencyGraph.jsx';
import {
  STATUS, CHANNEL_LABELS, CHANNEL_COLORS, CC_LABELS, FIB,
} from '../../../shared/midi-constants.js';

// ─── Constants ─────────────────────────────────────────────────────
const TABS = ['Piano Roll', 'CC Curves', 'SysEx Log', 'Latency'];

/** Number of values to track per CC per channel (Fibonacci) */
const CC_HISTORY_LENGTH = FIB[10]; // 89

/** Number of channels to display */
const NUM_CHANNELS = Object.keys(CHANNEL_LABELS).length; // 8

// ─── Sacred Geometry SVG Background ─────────────────────────────
const SACRED_GEOMETRY_BG = (
  <svg
    className="midi-viz__sacred-bg"
    style={{
      position: 'absolute', inset: 0, width: '100%', height: '100%',
      opacity: 0.05, pointerEvents: 'none', zIndex: 0,
    }}
    viewBox="0 0 400 400"
    preserveAspectRatio="xMidYMid slice"
  >
    {/* Flower of Life — overlapping circles */}
    {[0, 60, 120, 180, 240, 300].map((angle) => {
      const r = 50;
      const cx = 200 + r * Math.cos((angle * Math.PI) / 180);
      const cy = 200 + r * Math.sin((angle * Math.PI) / 180);
      return (
        <circle
          key={angle}
          cx={cx} cy={cy} r={r}
          fill="none" stroke="rgba(100,200,255,0.6)" strokeWidth="0.5"
        />
      );
    })}
    <circle cx="200" cy="200" r="50" fill="none" stroke="rgba(100,200,255,0.6)" strokeWidth="0.5" />
    <circle cx="200" cy="200" r="100" fill="none" stroke="rgba(100,200,255,0.3)" strokeWidth="0.3" />
    {/* Hexagonal frame */}
    <polygon
      points={[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i * 60 - 30) * (Math.PI / 180);
        return `${200 + 150 * Math.cos(a)},${200 + 150 * Math.sin(a)}`;
      }).join(' ')}
      fill="none" stroke="rgba(100,200,255,0.2)" strokeWidth="0.4"
    />
  </svg>
);

/**
 * MidiVisualizer — Combined real-time MIDI visualizer with 4 tab views.
 *
 * @param {Object} props
 * @param {Object} props.midiState - State from useMidiWebSocket hook
 * @param {boolean} props.midiState.connected - WebSocket connection status
 * @param {Object[]} props.midiState.events - Ring buffer of MIDI events
 * @param {Object} props.midiState.channels - Per-channel state map
 * @param {Object} props.midiState.ccValues - Flat CC values map { "ch:cc": value }
 * @param {number} props.midiState.latencyMs - Current ping latency
 * @returns {React.ReactElement}
 */
export default function MidiVisualizer({ midiState }) {
  const { connected, events, channels, ccValues, latencyMs } = midiState;
  const [activeTab, setActiveTab] = useState(0);

  // ── CC History Tracking ──────────────────────────────────────────
  // Track last 89 values per CC per channel: { "ch:cc": number[] }
  const ccHistoryRef = useRef(/** @type {Object.<string, number[]>} */ ({}));

  useEffect(() => {
    const history = ccHistoryRef.current;
    for (const [key, value] of Object.entries(ccValues)) {
      if (!history[key]) history[key] = [];
      const arr = history[key];
      arr.push(value);
      if (arr.length > CC_HISTORY_LENGTH) {
        arr.shift();
      }
    }
  }, [ccValues]);

  // ── Event Filters ────────────────────────────────────────────────
  const noteEvents = useMemo(() =>
    events.filter((e) =>
      e.status === STATUS.NOTE_ON ||
      e.status === STATUS.NOTE_OFF ||
      e.type === 'note'
    ),
  [events]);

  const sysexEvents = useMemo(() =>
    events.filter((e) =>
      e.status === STATUS.SYSEX_START ||
      e.type === 'sysex'
    ),
  [events]);

  // ── CC Curves Tab Renderer ───────────────────────────────────────
  const renderCCCurves = useCallback(() => {
    const history = ccHistoryRef.current;
    const charts = [];

    // Show one chart per channel, displaying all active CCs
    for (let ch = 0; ch < NUM_CHANNELS; ch++) {
      const channelCCs = Object.entries(history).filter(
        ([key]) => key.startsWith(`${ch}:`)
      );

      charts.push(
        <div key={ch} className="midi-cc-chart">
          <div className="midi-cc-chart__label" style={{ color: CHANNEL_COLORS[ch] }}>
            {CHANNEL_LABELS[ch]} (Ch {ch})
          </div>
          <svg viewBox="0 0 200 60" preserveAspectRatio="none">
            {/* Grid lines */}
            <line x1="0" y1="30" x2="200" y2="30" stroke="rgba(100,200,255,0.08)" strokeWidth="0.5" />
            <line x1="0" y1="15" x2="200" y2="15" stroke="rgba(100,200,255,0.04)" strokeWidth="0.3" />
            <line x1="0" y1="45" x2="200" y2="45" stroke="rgba(100,200,255,0.04)" strokeWidth="0.3" />

            {channelCCs.length === 0 && (
              <text x="100" y="33" textAnchor="middle" fill="rgba(107,123,141,0.5)"
                fontSize="6" fontFamily="var(--font-mono)">
                No data
              </text>
            )}

            {channelCCs.map(([key, values]) => {
              const ccNum = key.split(':')[1];
              const label = CC_LABELS[ccNum] || `CC${ccNum}`;
              const len = values.length;
              if (len < 2) return null;

              const points = values.map((v, i) => {
                const x = (i / (CC_HISTORY_LENGTH - 1)) * 200;
                const y = 60 - (v / 127) * 58 - 1;
                return `${x},${y}`;
              }).join(' ');

              return (
                <g key={key}>
                  <polyline
                    points={points}
                    fill="none"
                    stroke={CHANNEL_COLORS[ch]}
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.8"
                  />
                  <text
                    x="3" y="8"
                    fill={CHANNEL_COLORS[ch]}
                    fontSize="5" fontFamily="var(--font-mono)"
                    opacity="0.7"
                  >
                    {label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      );
    }

    return <div className="midi-cc-grid">{charts}</div>;
  }, []);

  // ── Tab Content ──────────────────────────────────────────────────
  const renderContent = () => {
    switch (activeTab) {
      case 0:
        return <PianoRoll events={noteEvents} channels={channels} />;
      case 1:
        return renderCCCurves();
      case 2:
        return <SysExLog events={sysexEvents} />;
      case 3:
        return <LatencyGraph latencyMs={latencyMs} events={events} />;
      default:
        return null;
    }
  };

  return (
    <div className="midi-viz midi-panel" style={{ position: 'relative', overflow: 'hidden' }}>
      {SACRED_GEOMETRY_BG}

      {/* Header: tabs + connection status */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 'var(--sp-8)', position: 'relative', zIndex: 1,
      }}>
        {/* Tab Bar */}
        <div className="midi-tabs">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              className={`midi-tab${i === activeTab ? ' midi-tab--active' : ''}`}
              onClick={() => setActiveTab(i)}
              aria-selected={i === activeTab}
              role="tab"
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Connection Status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--sp-5)',
          fontFamily: 'var(--font-mono)', fontSize: '11px',
        }}>
          <span className={`midi-led${connected ? ' midi-led--connected' : ''}`} />
          <span style={{ color: connected ? 'var(--midi-success)' : 'var(--midi-danger)' }}>
            {connected ? 'ONLINE' : 'OFFLINE'}
          </span>
          {connected && (
            <span style={{ color: 'var(--midi-muted)', marginLeft: 'var(--sp-3)' }}>
              {latencyMs.toFixed(0)}ms
            </span>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div className="midi-viz__content" style={{ position: 'relative', zIndex: 1 }}>
        {renderContent()}
      </div>
    </div>
  );
}
