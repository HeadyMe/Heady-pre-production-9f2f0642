/**
 * @fileoverview MidiDashboard — Main MIDI Dashboard page, the control center.
 * Golden ratio grid layout with glassmorphism panels and Sacred Geometry background.
 * Integrates all MIDI hooks and components into a unified monitoring interface.
 *
 * @module client/pages/MidiDashboard
 * @version 2.0.0
 * @author HeadySystems™
 * @license Proprietary — HeadySystems™ & HeadyConnection™
 *
 * ⚡ Made with 💜 by HeadySystems™ & HeadyConnection™
 * Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

import React, { useMemo } from 'react';
import { useMidiWebSocket } from '../hooks/useMidiWebSocket.js';
import { useMidiLearn } from '../hooks/useMidiLearn.js';
import { useSequencer } from '../hooks/useSequencer.js';
import ChannelMonitor from '../components/midi/ChannelMonitor.jsx';
import CCMeterBank from '../components/midi/CCMeterBank.jsx';
import MidiVisualizer from '../components/midi/MidiVisualizer.jsx';
import SequencerControls from '../components/midi/SequencerControls.jsx';
import {
  WS_MIDI_PORT, NETWORK_MIDI_PORT, ABLETON_TCP_PORT,
} from '../../shared/midi-constants.js';
import '../styles/midi-dashboard.css';

// ─── Sacred Geometry Background SVG ─────────────────────────────
/** Inline SVG: hexagonal grid + flower-of-life overlay at 8% opacity */
function SacredGeometryBg() {
  return (
    <svg
      style={{
        position: 'fixed', inset: 0, width: '100vw', height: '100vh',
        opacity: 0.08, pointerEvents: 'none', zIndex: 0,
      }}
      viewBox="0 0 800 800"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id="hex-grid" patternUnits="userSpaceOnUse" width="100" height="115.47">
          <polygon
            points="50,0 100,28.87 100,86.6 50,115.47 0,86.6 0,28.87"
            fill="none" stroke="rgba(100,200,255,0.5)" strokeWidth="0.4"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hex-grid)" />
      {/* Central flower of life */}
      {[0, 60, 120, 180, 240, 300].map((angle) => {
        const r = 80;
        const cx = 400 + r * Math.cos((angle * Math.PI) / 180);
        const cy = 400 + r * Math.sin((angle * Math.PI) / 180);
        return (
          <circle
            key={angle}
            cx={cx} cy={cy} r={r}
            fill="none" stroke="rgba(100,200,255,0.3)" strokeWidth="0.3"
          />
        );
      })}
      <circle cx="400" cy="400" r="80" fill="none" stroke="rgba(100,200,255,0.3)" strokeWidth="0.3" />
      <circle cx="400" cy="400" r="160" fill="none" stroke="rgba(100,200,255,0.15)" strokeWidth="0.25" />
      <circle cx="400" cy="400" r="240" fill="none" stroke="rgba(100,200,255,0.08)" strokeWidth="0.2" />
    </svg>
  );
}

/**
 * Connection status row component.
 * @param {Object} props
 * @param {string} props.label - Protocol label
 * @param {number} props.port - Network port
 * @param {boolean} props.active - Whether connection is active
 */
function ConnRow({ label, port, active }) {
  return (
    <div className="midi-conn-row">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-5)' }}>
        <span className={`midi-led${active ? ' midi-led--connected' : ''}`} />
        <span className="midi-conn-row__label">{label}</span>
      </div>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '10px',
        color: active ? 'var(--midi-success)' : 'var(--midi-muted)',
      }}>
        :{port}
      </span>
    </div>
  );
}

/**
 * MidiDashboard — Main MIDI control center page.
 * Golden ratio layout with channel monitoring, visualizer, sequencer, and CC meters.
 *
 * @returns {React.ReactElement}
 */
export default function MidiDashboard() {
  // ── Hooks ──────────────────────────────────────────────────────
  const midi = useMidiWebSocket();
  const { connected, events, channels, ccValues, latencyMs, peerCount, sendSysEx } = midi;

  const midiLearn = useMidiLearn({ events, connected });

  const sequencer = useSequencer({ events, connected, sendSysEx });

  // ── Derived State ──────────────────────────────────────────────
  const midiState = useMemo(() => ({
    connected,
    events,
    channels,
    ccValues,
    latencyMs,
  }), [connected, events, channels, ccValues, latencyMs]);

  const connectionInfo = useMemo(() => ({
    ws: connected,
    udp: connected, // Inferred from WS health — UDP status would come from server
    ableton: peerCount > 0,
  }), [connected, peerCount]);

  return (
    <div className="midi-dashboard midi-sacred-bg">
      <SacredGeometryBg />

      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="midi-dashboard__header" style={{ position: 'relative', zIndex: 10 }}>
        <h1>
          <span style={{ marginRight: 'var(--sp-5)' }}>⬡</span>
          MIDI Transfer Schema
        </h1>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--sp-8)',
        }}>
          <span className={`midi-badge midi-badge--${connected ? 'connected' : 'disconnected'}`}>
            <span className={`midi-led${connected ? ' midi-led--connected' : ''}`} />
            {connected ? 'Connected' : 'Disconnected'}
          </span>
          {midiLearn.learning && (
            <span className="midi-badge midi-badge--learning">
              <span className="midi-led midi-led--learning" />
              Learning
            </span>
          )}
        </div>
      </header>

      {/* ── Body: Golden Ratio Grid ─────────────────────────────── */}
      <main className="midi-dashboard__body" style={{ position: 'relative', zIndex: 1 }}>
        <div className="midi-grid">
          {/* Main Panel (61.8%) */}
          <div className="midi-grid__main">
            {/* Channel Monitor Strip */}
            <ChannelMonitor channels={channels} connected={connected} />

            {/* MIDI Visualizer — fills remaining space */}
            <MidiVisualizer midiState={midiState} />
          </div>

          {/* Sidebar (38.2%) */}
          <div className="midi-grid__sidebar">
            {/* Sequencer Controls */}
            <div className="midi-panel">
              <div className="midi-panel__title">Sequencer</div>
              <SequencerControls sequencer={sequencer} connected={connected} />
            </div>

            {/* CC Meter Bank */}
            <div className="midi-panel" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="midi-panel__title">CC Meters</div>
              <div className="midi-scroll" style={{ height: '100%' }}>
                <CCMeterBank ccValues={ccValues} channels={channels} />
              </div>
            </div>

            {/* Connection Status Panel */}
            <div className="midi-panel">
              <div className="midi-panel__title">Connections</div>
              <div className="midi-conn-status">
                <ConnRow
                  label="WebSocket"
                  port={WS_MIDI_PORT}
                  active={connectionInfo.ws}
                />
                <ConnRow
                  label="UDP/UMP"
                  port={NETWORK_MIDI_PORT}
                  active={connectionInfo.udp}
                />
                <ConnRow
                  label="Ableton Link"
                  port={ABLETON_TCP_PORT}
                  active={connectionInfo.ableton}
                />

                {/* Peer count and latency */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  paddingTop: 'var(--sp-5)',
                  fontFamily: 'var(--font-mono)', fontSize: '10px',
                  color: 'var(--midi-muted)',
                }}>
                  <span>Peers: {peerCount}</span>
                  <span>Latency: {latencyMs.toFixed(1)}ms</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── MIDI Learn Overlay ───────────────────────────────────── */}
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

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="midi-dashboard__footer" style={{ position: 'relative', zIndex: 10 }}>
        ⚡ Made with 💜 by HeadySystems™ &amp; HeadyConnection™ — Sacred Geometry :: Organic Systems :: Breathing Interfaces
      </footer>
    </div>
  );
}
