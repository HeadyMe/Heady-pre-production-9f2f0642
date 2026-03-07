/**
 * @fileoverview ChannelMonitor — 8-channel LED activity monitor for Heady MIDI dashboard.
 * Displays real-time channel activity with pulsing LED indicators, event counts,
 * and mini CC value bars. LED brightness decays using φ-ratio timing.
 *
 * @module client/components/midi/ChannelMonitor
 * @version 2.0.0
 * @author HeadySystems™
 * @license Proprietary — HeadySystems™ & HeadyConnection™
 *
 * ⚡ Made with 💜 by HeadySystems™ & HeadyConnection™
 * Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

import React, { useState, useEffect, useCallback } from 'react';
import { CHANNEL_COLORS, PSI, FIB } from '../../shared/midi-constants.js';
import '../../styles/midi-dashboard.css';

const PHI_DECAY_MS = 500;

const styles = {
  strip: {
    display: 'flex',
    gap: `${FIB[7]}px`, // 13px
    padding: `${FIB[7]}px`,
    overflowX: 'auto',
  },
  cell: {
    flex: '1 1 0',
    minWidth: 110,
    background: 'hsla(220, 20%, 12%, 0.55)',
    backdropFilter: 'blur(13px)',
    WebkitBackdropFilter: 'blur(13px)',
    border: '1px solid hsla(220, 40%, 30%, 0.35)',
    borderRadius: `${FIB[6]}px`, // 8px
    padding: `${FIB[6]}px`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: `${FIB[5]}px`, // 5px
  },
  ledRow: {
    display: 'flex',
    alignItems: 'center',
    gap: `${FIB[5]}px`,
    width: '100%',
  },
  led: (color, brightness) => ({
    width: `${FIB[7]}px`,
    height: `${FIB[7]}px`,
    borderRadius: '50%',
    background: color,
    opacity: 0.25 + 0.75 * brightness,
    boxShadow: brightness > 0.1
      ? `0 0 ${Math.round(FIB[6] * brightness)}px ${color}, 0 0 ${Math.round(FIB[8] * brightness)}px ${color}`
      : 'none',
    transition: `opacity ${Math.round(PHI_DECAY_MS * PSI)}ms ease-out, box-shadow ${Math.round(PHI_DECAY_MS * PSI)}ms ease-out`,
    flexShrink: 0,
  }),
  label: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: `${FIB[7] - 2}px`,
    color: 'hsl(220, 15%, 72%)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  eventCount: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: `${FIB[6] + 2}px`,
    fontWeight: 600,
    color: 'hsl(220, 15%, 85%)',
    letterSpacing: '0.5px',
  },
  ccBarsContainer: {
    width: '100%',
    display: 'flex',
    gap: `${FIB[2]}px`, // 2px
    height: `${FIB[8]}px`, // 21px
    alignItems: 'flex-end',
  },
  ccBar: (color, pct) => ({
    flex: 1,
    background: color,
    opacity: 0.7,
    height: `${Math.max(1, pct)}%`,
    borderRadius: `${FIB[1]}px`,
    transition: 'height 200ms ease-out',
    minHeight: 1,
  }),
};

/**
 * 8-channel activity monitor with LED indicators, event counts, and CC mini-bars.
 * @param {Object} props
 * @param {Array<{id: number, label: string, color: string, lastActivity: number, eventCount: number, ccValues: Object}>} props.channels
 * @returns {React.ReactElement}
 */
function ChannelMonitor({ channels = [] }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let raf;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const getBrightness = useCallback((lastActivity) => {
    if (!lastActivity) return 0;
    const elapsed = now - lastActivity;
    if (elapsed <= 0) return 1;
    if (elapsed >= PHI_DECAY_MS * 3) return 0;
    // φ-decay: brightness = ψ^(elapsed / PHI_DECAY_MS)
    return Math.pow(PSI, elapsed / PHI_DECAY_MS);
  }, [now]);

  return (
    <div style={styles.strip}>
      {channels.map((ch) => {
        const color = CHANNEL_COLORS[ch.id] || ch.color || 'hsl(220, 50%, 50%)';
        const brightness = getBrightness(ch.lastActivity);
        const ccEntries = ch.ccValues ? Object.values(ch.ccValues) : [];

        return (
          <div key={ch.id} className="glass" style={styles.cell}>
            <div style={styles.ledRow}>
              <div style={styles.led(color, brightness)} />
              <span style={styles.label}>{ch.label}</span>
            </div>
            <span style={styles.eventCount}>
              {(ch.eventCount || 0).toLocaleString()}
            </span>
            <div style={styles.ccBarsContainer}>
              {ccEntries.length > 0
                ? ccEntries.slice(0, FIB[6]).map((val, i) => (
                    <div
                      key={i}
                      style={styles.ccBar(color, (val / 127) * 100)}
                    />
                  ))
                : Array.from({ length: FIB[6] }, (_, i) => (
                    <div key={i} style={styles.ccBar(color, 0)} />
                  ))
              }
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ChannelMonitor;
