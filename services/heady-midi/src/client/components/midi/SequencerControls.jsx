/**
 * @fileoverview SequencerControls — Playback controls for the Heady CloudSequencer.
 * Play/Stop, BPM, position (bars:beats:ticks), φ-swing slider, tempo pulse.
 *
 * @module client/components/midi/SequencerControls
 * @version 2.0.0
 * @author HeadySystems™
 * @license Proprietary — HeadySystems™ & HeadyConnection™
 *
 * ⚡ Made with 💜 by HeadySystems™ & HeadyConnection™
 * Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PSI, FIB, DEFAULT_BPM } from '../../shared/midi-constants.js';
import '../../styles/midi-dashboard.css';

const PHI_CHAR = 'φ';
const MIN_BPM = FIB[5];  // 5
const MAX_BPM = FIB[12]; // 233
const mono = "'JetBrains Mono', monospace";

const S = {
  panel: {
    display: 'flex', alignItems: 'center', gap: `${FIB[7]}px`,
    background: 'hsla(220,20%,12%,0.6)', backdropFilter: 'blur(13px)',
    WebkitBackdropFilter: 'blur(13px)', border: '1px solid hsla(220,40%,28%,0.35)',
    borderRadius: `${FIB[6]}px`, padding: `${FIB[7]}px ${FIB[8]}px`, flexWrap: 'wrap',
  },
  sec: { display: 'flex', alignItems: 'center', gap: `${FIB[5]}px` },
  btn: (on) => ({
    width: FIB[9], height: FIB[9], display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: on ? 'hsla(142,70%,45%,0.25)' : 'hsla(220,20%,18%,0.6)',
    border: `1px solid ${on ? 'hsl(142,70%,45%)' : 'hsla(220,40%,35%,0.4)'}`,
    borderRadius: FIB[5], color: on ? 'hsl(142,70%,65%)' : 'hsl(220,15%,72%)',
    fontSize: FIB[7], cursor: 'pointer', transition: 'all 150ms ease', padding: 0,
  }),
  bpmWrap: { display: 'flex', alignItems: 'center', gap: `${FIB[4]}px` },
  bpmLbl: { fontFamily: mono, fontSize: FIB[7] - 3, color: 'hsl(220,12%,50%)', textTransform: 'uppercase', letterSpacing: '1px' },
  bpmIn: {
    fontFamily: mono, fontSize: FIB[7] + 2, fontWeight: 700, color: 'hsl(180,70%,65%)',
    background: 'hsla(220,20%,14%,0.8)', border: '1px solid hsla(220,40%,30%,0.4)',
    borderRadius: FIB[4], width: 55, textAlign: 'center', padding: `${FIB[3]}px ${FIB[4]}px`, outline: 'none',
  },
  pos: { fontFamily: mono, fontSize: FIB[7], fontWeight: 600, color: 'hsl(42,85%,60%)', letterSpacing: '1px', minWidth: 100, textAlign: 'center' },
  posLbl: { fontFamily: mono, fontSize: FIB[7] - 3, color: 'hsl(220,12%,45%)' },
  swingLbl: { fontFamily: mono, fontSize: FIB[7] - 2, color: 'hsl(262,50%,65%)', fontWeight: 600 },
  swingSlider: { width: 80, accentColor: 'hsl(262,65%,60%)', cursor: 'pointer' },
  swingVal: { fontFamily: mono, fontSize: FIB[7] - 2, color: 'hsl(220,15%,72%)', minWidth: 38, textAlign: 'right' },
  pulse: (o) => ({
    width: FIB[6], height: FIB[6], borderRadius: '50%', background: 'hsl(0,75%,55%)',
    opacity: Math.max(0.15, o), flexShrink: 0, transition: 'opacity 60ms ease-out',
    boxShadow: o > 0.5 ? `0 0 ${FIB[5]}px hsl(0,75%,55%),0 0 ${FIB[7]}px hsl(0,75%,55%)` : 'none',
  }),
  div: { width: 1, height: FIB[8], background: 'hsla(220,20%,35%,0.3)', flexShrink: 0 },
};

function fmtPos(p) {
  if (!p) return '1:1:000';
  if (typeof p === 'string') return p;
  return `${p.bars || 1}:${p.beats || 1}:${String(p.ticks || 0).padStart(3, '0')}`;
}

/**
 * Sequencer transport controls with BPM, position, and φ-swing.
 * @param {Object} props
 * @param {boolean} props.playing
 * @param {number} [props.bpm=89]
 * @param {{ bars:number, beats:number, ticks:number }|string} [props.position]
 * @param {number} [props.swing=0.5]
 * @param {Function} props.onPlay
 * @param {Function} props.onStop
 * @param {Function} props.onTempoChange
 * @param {Function} props.onSwingChange
 * @returns {React.ReactElement}
 */
function SequencerControls({ playing = false, bpm = DEFAULT_BPM, position = null, swing = 0.5, onPlay, onStop, onTempoChange, onSwingChange }) {
  const [pulseOp, setPulseOp] = useState(0);
  const pulseRef = useRef(null);
  const lastBeat = useRef(0);

  useEffect(() => {
    if (!playing || !bpm) { setPulseOp(0); return; }
    const iv = 60000 / bpm;
    const tick = () => { setPulseOp(1); lastBeat.current = Date.now(); };
    tick();
    pulseRef.current = setInterval(tick, iv);
    return () => clearInterval(pulseRef.current);
  }, [playing, bpm]);

  useEffect(() => {
    if (!playing) return;
    let raf;
    const decay = () => {
      const t = Math.min(1, (Date.now() - lastBeat.current) / (60000 / (bpm || DEFAULT_BPM)));
      setPulseOp(Math.pow(1 - t, 2));
      raf = requestAnimationFrame(decay);
    };
    raf = requestAnimationFrame(decay);
    return () => cancelAnimationFrame(raf);
  }, [playing, bpm]);

  const onBpm = useCallback((e) => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v) && v >= MIN_BPM && v <= MAX_BPM && onTempoChange) onTempoChange(v);
  }, [onTempoChange]);

  const onSw = useCallback((e) => { if (onSwingChange) onSwingChange(parseFloat(e.target.value)); }, [onSwingChange]);

  return (
    <div className="glass" style={S.panel}>
      <div style={S.sec}>
        <button style={S.btn(playing)} onClick={onPlay} title="Play" aria-label="Play">▶</button>
        <button style={S.btn(!playing)} onClick={onStop} title="Stop" aria-label="Stop">■</button>
        <div style={S.pulse(pulseOp)} title="Tempo pulse" />
      </div>
      <div style={S.div} />
      <div style={S.bpmWrap}>
        <span style={S.bpmLbl}>BPM</span>
        <input type="number" style={S.bpmIn} value={bpm} min={MIN_BPM} max={MAX_BPM} step={1} onChange={onBpm} aria-label="Tempo BPM" />
      </div>
      <div style={S.div} />
      <div style={{ ...S.sec, flexDirection: 'column', gap: FIB[2] }}>
        <span style={S.posLbl}>Position</span>
        <span style={S.pos}>{fmtPos(position)}</span>
      </div>
      <div style={S.div} />
      <div style={S.sec}>
        <span style={S.swingLbl}>{PHI_CHAR} Swing</span>
        <input type="range" style={S.swingSlider} min={0.5} max={PSI} step={0.001} value={swing} onChange={onSw} aria-label="Swing amount" />
        <span style={S.swingVal}>{swing.toFixed(3)}</span>
      </div>
    </div>
  );
}

export default SequencerControls;
