/**
 * @fileoverview LatencyGraph — Real-time SVG line chart for latency monitoring.
 * Rolling window of 89 data points (FIB[10]). Threshold lines at
 * ψ² × 1000 ≈ 382ms (warning) and ψ × 1000 ≈ 618ms (danger).
 *
 * @module client/components/midi/LatencyGraph
 * @version 2.0.0
 * @author HeadySystems™
 * @license Proprietary — HeadySystems™ & HeadyConnection™
 *
 * ⚡ Made with 💜 by HeadySystems™ & HeadyConnection™
 * Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

import React, { useMemo } from 'react';
import { PSI, PSI2, FIB } from '../../shared/midi-constants.js';
import '../../styles/midi-dashboard.css';

const MAX_PTS = FIB[10];              // 89
const Y_MAX = 1000;                   // ms
const WARN = PSI2 * Y_MAX;            // ≈ 382ms
const DANGER = PSI * Y_MAX;           // ≈ 618ms
const PAD = { t: FIB[8], r: FIB[8], b: FIB[8], l: FIB[9] }; // 21,21,21,34
const SVG_W = 500;
const SVG_H = 220;
const PW = SVG_W - PAD.l - PAD.r;
const PH = SVG_H - PAD.t - PAD.b;
const Y_TICKS = [0, 200, 400, 600, 800, 1000];
const mono = "'JetBrains Mono', monospace";

/**
 * Determine color from latency value using φ-thresholds.
 * @param {number} ms - Latency in milliseconds
 * @returns {string} HSL color string
 */
function latColor(ms) {
  if (ms < WARN) return 'hsl(142, 70%, 50%)';   // green — healthy
  if (ms < DANGER) return 'hsl(42, 85%, 55%)';   // gold — warning
  return 'hsl(0, 75%, 55%)';                      // red — danger
}

const styles = {
  container: {
    background: 'hsla(220, 20%, 10%, 0.6)',
    backdropFilter: 'blur(13px)',
    WebkitBackdropFilter: 'blur(13px)',
    border: '1px solid hsla(220, 40%, 25%, 0.35)',
    borderRadius: `${FIB[6]}px`,
    padding: `${FIB[7]}px`,
    position: 'relative',
  },
  currentValue: (color) => ({
    position: 'absolute',
    top: `${FIB[6]}px`,
    right: `${FIB[7]}px`,
    fontFamily: mono,
    fontSize: `${FIB[8]}px`,
    fontWeight: 700,
    color,
    letterSpacing: '-0.5px',
  }),
  label: {
    fontFamily: mono,
    fontSize: `${FIB[7] - 3}px`,
    color: 'hsl(220, 12%, 48%)',
    marginBottom: `${FIB[4]}px`,
  },
  stats: {
    display: 'flex',
    gap: `${FIB[7]}px`,
    marginTop: `${FIB[5]}px`,
    fontFamily: mono,
    fontSize: `${FIB[7] - 3}px`,
    color: 'hsl(220, 12%, 52%)',
  },
  statVal: {
    fontWeight: 600,
    color: 'hsl(220, 15%, 72%)',
  },
  svg: { display: 'block', width: '100%', overflow: 'visible' },
};

/** Map ms value to SVG Y coordinate */
const toY = (ms) => PAD.t + PH - (Math.min(ms, Y_MAX) / Y_MAX) * PH;
/** Map index to SVG X coordinate */
const toX = (i) => PAD.l + (i / (MAX_PTS - 1)) * PW;

/**
 * Real-time SVG latency graph with φ-derived threshold lines.
 * @param {Object} props
 * @param {Array<{timestamp: number, ms: number}>} props.latencyHistory
 * @returns {React.ReactElement}
 */
function LatencyGraph({ latencyHistory = [] }) {
  const data = latencyHistory.slice(-MAX_PTS);
  const currentMs = data.length > 0 ? data[data.length - 1].ms : 0;
  const currentColor = latColor(currentMs);

  // Build SVG line path
  const pathD = useMemo(() => {
    if (data.length < 2) return '';
    return data
      .map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.ms).toFixed(1)}`)
      .join(' ');
  }, [data]);

  // Build filled area path (closes line to baseline)
  const areaD = useMemo(() => {
    if (data.length < 2 || !pathD) return '';
    const baseline = PAD.t + PH;
    return `${pathD} L${toX(data.length - 1).toFixed(1)},${baseline} L${toX(0).toFixed(1)},${baseline} Z`;
  }, [data, pathD]);

  // Compute summary statistics
  const stats = useMemo(() => {
    if (data.length === 0) return { avg: 0, min: 0, max: 0 };
    const vals = data.map((d) => d.ms);
    return {
      avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
      min: Math.round(Math.min(...vals)),
      max: Math.round(Math.max(...vals)),
    };
  }, [data]);

  return (
    <div className="glass" style={styles.container}>
      <div style={styles.label}>Latency (ms)</div>
      <div style={styles.currentValue(currentColor)}>
        {Math.round(currentMs)}ms
      </div>

      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={styles.svg} preserveAspectRatio="xMidYMid meet">
        {/* Y-axis ticks and labels */}
        {Y_TICKS.map((tick) => (
          <g key={tick}>
            <line x1={PAD.l} y1={toY(tick)} x2={PAD.l + PW} y2={toY(tick)}
              stroke="hsla(220, 15%, 30%, 0.3)" strokeWidth={0.5} />
            <text x={PAD.l - FIB[4]} y={toY(tick) + 3} textAnchor="end"
              fill="hsl(220, 12%, 42%)" fontSize={FIB[7] - 4} fontFamily={mono}>
              {tick}
            </text>
          </g>
        ))}

        {/* Warning threshold: ψ² × 1000 ≈ 382ms */}
        <line x1={PAD.l} y1={toY(WARN)} x2={PAD.l + PW} y2={toY(WARN)}
          stroke="hsl(42, 85%, 55%)" strokeWidth={1} strokeDasharray="5,3" opacity={0.6} />

        {/* Danger threshold: ψ × 1000 ≈ 618ms */}
        <line x1={PAD.l} y1={toY(DANGER)} x2={PAD.l + PW} y2={toY(DANGER)}
          stroke="hsl(0, 75%, 55%)" strokeWidth={1} strokeDasharray="5,3" opacity={0.6} />

        {/* Gradient area fill under the curve */}
        {areaD && <path d={areaD} fill="url(#latencyGradient)" opacity={0.25} />}

        {/* Main data line */}
        {pathD && (
          <path d={pathD} fill="none" stroke={currentColor}
            strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        )}

        {/* Current value indicator dot */}
        {data.length > 0 && (
          <circle
            cx={toX(data.length - 1)} cy={toY(data[data.length - 1].ms)}
            r={FIB[4]} fill={currentColor} stroke="hsl(220, 15%, 10%)" strokeWidth={1.5}
          />
        )}

        <defs>
          <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(180, 70%, 50%)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="hsl(180, 70%, 50%)" stopOpacity={0} />
          </linearGradient>
        </defs>
      </svg>

      {/* Summary stats row */}
      <div style={styles.stats}>
        <span>avg <span style={styles.statVal}>{stats.avg}ms</span></span>
        <span>min <span style={styles.statVal}>{stats.min}ms</span></span>
        <span>max <span style={styles.statVal}>{stats.max}ms</span></span>
      </div>
    </div>
  );
}

export default LatencyGraph;
