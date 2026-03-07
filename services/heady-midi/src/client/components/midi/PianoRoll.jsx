/**
 * @fileoverview PianoRoll — Scrolling canvas-based piano roll visualization.
 * Renders MIDI note_on/note_off events on a 128-row grid with horizontal time scroll.
 * Active notes glow, completed notes fade. Grid lines at octave boundaries.
 * φ-scaled note heights give lower octaves more visual weight.
 *
 * @module client/components/midi/PianoRoll
 * @version 2.0.0
 * @author HeadySystems™
 * @license Proprietary — HeadySystems™ & HeadyConnection™
 *
 * ⚡ Made with 💜 by HeadySystems™ & HeadyConnection™
 * Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { PHI, PSI, FIB, CHANNEL_COLORS } from '../../shared/midi-constants.js';
import '../../styles/midi-dashboard.css';

const TOTAL_NOTES = 128;
const OCTAVES = 11;          // 0-10 (notes 0-127)
const TIME_WINDOW_MS = 8000; // Visible time window
const NOTE_FADE_MS = 3000;   // Completed notes fade over this period
const GRID_COLOR = 'hsla(220, 20%, 30%, 0.35)';
const BG_COLOR = 'hsl(220, 18%, 8%)';
const ACTIVE_GLOW_COLOR = 'hsla(180, 80%, 60%, 0.7)';
const KEYBOARD_WIDTH = 34;   // FIB[9] = 34 pixels for piano keys

/**
 * Build φ-scaled note heights: lower octaves are taller.
 * Uses φ^(octave/OCTAVES) for relative sizing, then normalizes to fill height.
 * @param {number} height - Canvas height
 * @returns {Float64Array} Cumulative Y offsets per note
 */
function buildNoteYMap(height) {
  const weights = new Float64Array(TOTAL_NOTES);
  for (let n = 0; n < TOTAL_NOTES; n++) {
    const octave = Math.floor(n / 12);
    // Lower octaves → bigger weight
    weights[n] = Math.pow(PHI, (OCTAVES - octave) / OCTAVES);
  }
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const yMap = new Float64Array(TOTAL_NOTES + 1);
  yMap[0] = 0;
  for (let n = 0; n < TOTAL_NOTES; n++) {
    yMap[n + 1] = yMap[n] + (weights[n] / totalWeight) * height;
  }
  return yMap;
}

/** Determine note color from velocity + channel */
function noteColor(event) {
  if (event.channel !== undefined && CHANNEL_COLORS[event.channel]) {
    return CHANNEL_COLORS[event.channel];
  }
  const hue = 180 + (event.note || 0) * PSI * 30;
  const lightness = 40 + ((event.velocity || 64) / 127) * 25;
  return `hsl(${hue % 360}, 70%, ${lightness}%)`;
}

/** Check if a MIDI note is a black key */
function isBlackKey(note) {
  const n = note % 12;
  return n === 1 || n === 3 || n === 6 || n === 8 || n === 10;
}

const containerStyle = {
  position: 'relative',
  background: BG_COLOR,
  borderRadius: `${FIB[6]}px`,
  overflow: 'hidden',
  border: '1px solid hsla(220, 40%, 25%, 0.4)',
};

/**
 * Scrolling piano roll visualization with canvas rendering.
 * @param {Object} props
 * @param {Array<{type: string, note: number, velocity: number, channel: number, time: number, endTime?: number}>} props.events
 * @param {number} [props.width=800] - Canvas width in pixels
 * @param {number} [props.height=400] - Canvas height in pixels
 * @returns {React.ReactElement}
 */
function PianoRoll({ events = [], width = 800, height = 400 }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const eventsRef = useRef(events);

  // Keep events ref in sync without triggering re-renders
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const yMap = useMemo(() => buildNoteYMap(height), [height]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const now = Date.now();
    const timeStart = now - TIME_WINDOW_MS;
    const timeScale = (width - KEYBOARD_WIDTH) / TIME_WINDOW_MS;

    // Clear
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, width, height);

    // Draw octave grid lines
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    for (let oct = 0; oct <= OCTAVES; oct++) {
      const note = oct * 12;
      if (note > TOTAL_NOTES) break;
      const y = yMap[note];
      ctx.beginPath();
      ctx.moveTo(KEYBOARD_WIDTH, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw mini piano keyboard on the left
    for (let n = 0; n < TOTAL_NOTES; n++) {
      const y = yMap[n];
      const h = yMap[n + 1] - y;
      if (h < 0.5) continue;
      ctx.fillStyle = isBlackKey(n)
        ? 'hsl(220, 15%, 15%)'
        : 'hsl(220, 10%, 25%)';
      ctx.fillRect(0, y, KEYBOARD_WIDTH - 1, Math.max(h - 0.5, 0.5));
    }

    // Divider line between keyboard and roll
    ctx.strokeStyle = 'hsla(220, 40%, 40%, 0.5)';
    ctx.beginPath();
    ctx.moveTo(KEYBOARD_WIDTH, 0);
    ctx.lineTo(KEYBOARD_WIDTH, height);
    ctx.stroke();

    // Draw notes
    const currentEvents = eventsRef.current;
    for (let i = 0; i < currentEvents.length; i++) {
      const evt = currentEvents[i];
      if (evt.type !== 'note_on' && evt.type !== 'noteOn') continue;
      if (evt.note === undefined || evt.note < 0 || evt.note >= TOTAL_NOTES) continue;

      const startTime = evt.time || 0;
      const endTime = evt.endTime || (evt.type === 'note_on' || evt.type === 'noteOn' ? now : startTime + 200);
      const isActive = !evt.endTime;

      // Skip notes outside visible range (with fade buffer)
      if (endTime < timeStart - NOTE_FADE_MS) continue;
      if (startTime > now) continue;

      const x1 = KEYBOARD_WIDTH + Math.max(0, (startTime - timeStart) * timeScale);
      const x2 = KEYBOARD_WIDTH + Math.min(width - KEYBOARD_WIDTH, (Math.min(endTime, now) - timeStart) * timeScale);
      const noteWidth = Math.max(2, x2 - x1);

      const y = yMap[TOTAL_NOTES - 1 - evt.note]; // Invert: low notes at bottom
      const h = Math.max(1.5, yMap[TOTAL_NOTES - evt.note] - y);

      // Fade for completed notes
      let alpha = 1;
      if (!isActive && evt.endTime) {
        const fadeElapsed = now - evt.endTime;
        if (fadeElapsed > 0) {
          alpha = Math.max(0, 1 - fadeElapsed / NOTE_FADE_MS);
        }
      }
      if (alpha <= 0) continue;

      const color = noteColor(evt);

      // Note rectangle
      ctx.globalAlpha = alpha * 0.85;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x1, y, noteWidth, h, FIB[2]);
      ctx.fill();

      // Active glow
      if (isActive) {
        ctx.globalAlpha = alpha * 0.4;
        ctx.shadowColor = ACTIVE_GLOW_COLOR;
        ctx.shadowBlur = FIB[6];
        ctx.fillStyle = ACTIVE_GLOW_COLOR;
        ctx.beginPath();
        ctx.roundRect(x1, y, noteWidth, h, FIB[2]);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.globalAlpha = 1;
    }

    // Draw playhead (right edge)
    ctx.strokeStyle = 'hsla(180, 80%, 60%, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width - 2, 0);
    ctx.lineTo(width - 2, height);
    ctx.stroke();

    animRef.current = requestAnimationFrame(draw);
  }, [width, height, yMap]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [draw]);

  // Handle high-DPI displays
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
  }, [width, height]);

  return (
    <div style={{ ...containerStyle, width, height }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}

export default PianoRoll;
