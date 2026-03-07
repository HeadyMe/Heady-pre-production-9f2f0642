/**
 * @fileoverview CCMeterBank — 8 horizontal meters showing real-time CC values.
 * Color-coded by φ-derived severity thresholds: green (0-48), yellow (48-78), red (78-127).
 * Thresholds derive from ψ² × 127 ≈ 48 and ψ × 127 ≈ 78.
 *
 * @module client/components/midi/CCMeterBank
 * @version 2.0.0
 * @author HeadySystems™
 * @license Proprietary — HeadySystems™ & HeadyConnection™
 *
 * ⚡ Made with 💜 by HeadySystems™ & HeadyConnection™
 * Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

import React from 'react';
import { PSI, PSI2, FIB, CC_LABELS } from '../../shared/midi-constants.js';
import '../../styles/midi-dashboard.css';

const THRESHOLD_LOW = Math.round(PSI2 * 127);   // ≈ 48
const THRESHOLD_MED = Math.round(PSI * 127);     // ≈ 78

/** Determine bar color by φ-derived thresholds */
function severityColor(value) {
  if (value < THRESHOLD_LOW) return 'hsl(142, 70%, 45%)';  // green
  if (value < THRESHOLD_MED) return 'hsl(42, 85%, 55%)';   // yellow/gold
  return 'hsl(0, 75%, 55%)';                                // red
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: `${FIB[5]}px`, // 5px — Fibonacci spacing
    padding: `${FIB[7]}px`, // 13px
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: `${FIB[6]}px`, // 8px
    background: 'hsla(220, 20%, 12%, 0.55)',
    backdropFilter: 'blur(13px)',
    WebkitBackdropFilter: 'blur(13px)',
    border: '1px solid hsla(220, 40%, 30%, 0.3)',
    borderRadius: `${FIB[5]}px`,
    padding: `${FIB[5]}px ${FIB[6]}px`,
  },
  label: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: `${FIB[7] - 2}px`,
    color: 'hsl(220, 15%, 68%)',
    width: 120,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  trackOuter: {
    flex: 1,
    height: `${FIB[7]}px`, // 13px
    background: 'hsla(220, 15%, 18%, 0.7)',
    borderRadius: `${FIB[4]}px`,
    overflow: 'hidden',
    position: 'relative',
  },
  trackFill: (pct, color) => ({
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    width: `${pct}%`,
    background: `linear-gradient(90deg, ${color}88, ${color})`,
    borderRadius: `${FIB[4]}px`,
    transition: 'width 180ms ease-out',
    boxShadow: pct > 60 ? `0 0 ${FIB[5]}px ${color}66` : 'none',
  }),
  value: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: `${FIB[7] - 1}px`,
    fontWeight: 600,
    color: 'hsl(220, 15%, 88%)',
    width: 34,
    textAlign: 'right',
    flexShrink: 0,
  },
};

/**
 * Bank of 8 horizontal CC meters with φ-threshold color coding.
 * @param {Object} props
 * @param {Object<number, number>} props.ccValues - CC number → current value (0-127)
 * @param {Object<number, string>} [props.labels] - CC number → human label (defaults to CC_LABELS)
 * @returns {React.ReactElement}
 */
function CCMeterBank({ ccValues = {}, labels = CC_LABELS }) {
  const entries = Object.entries(ccValues).slice(0, FIB[6]); // max 8

  return (
    <div style={styles.container}>
      {entries.map(([ccNum, rawValue]) => {
        const value = Math.max(0, Math.min(127, rawValue));
        const pct = (value / 127) * 100;
        const color = severityColor(value);
        const labelText = labels[ccNum] || `CC ${ccNum}`;

        return (
          <div key={ccNum} className="glass" style={styles.row}>
            <span style={styles.label} title={labelText}>{labelText}</span>
            <div style={styles.trackOuter}>
              <div style={styles.trackFill(pct, color)} />
            </div>
            <span style={styles.value}>{value}</span>
          </div>
        );
      })}
    </div>
  );
}

export default CCMeterBank;
