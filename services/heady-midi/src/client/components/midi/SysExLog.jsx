/**
 * @fileoverview SysExLog — Scrolling terminal-style log of decoded SysEx messages.
 * Color-coded by command category: blue (queries), green (set/create),
 * orange (AI), red (delete). Max 233 entries (FIB[12]).
 *
 * @module client/components/midi/SysExLog
 * @version 2.0.0
 * @author HeadySystems™
 * @license Proprietary — HeadySystems™ & HeadyConnection™
 *
 * ⚡ Made with 💜 by HeadySystems™ & HeadyConnection™
 * Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

import React, { useRef, useEffect } from 'react';
import { SYSEX_CMD, SYSEX_CMD_NAMES, FIB } from '../../shared/midi-constants.js';
import '../../styles/midi-dashboard.css';

const MAX_ENTRIES = FIB[12]; // 233
const mono = "'JetBrains Mono', 'Fira Code', monospace";

/** Command sets for category coloring */
const QUERY_CMDS = new Set([
  SYSEX_CMD.STATUS_REQUEST, SYSEX_CMD.GET_TRACK_NAMES,
  SYSEX_CMD.GET_DEVICE_CHAIN, SYSEX_CMD.VERSION_NEGOTIATE,
]);
const DELETE_CMDS = new Set([SYSEX_CMD.DELETE_CLIP, SYSEX_CMD.UNDO]);
const AI_CMDS = new Set([SYSEX_CMD.AI_ARRANGEMENT, SYSEX_CMD.AI_GENERATE_PATTERN]);

/**
 * Resolve category color from SysEx command byte.
 * @param {number} cmd - SysEx command byte
 * @returns {string} HSL color
 */
function categoryColor(cmd) {
  if (QUERY_CMDS.has(cmd))  return 'hsl(210, 70%, 60%)';  // blue — queries
  if (DELETE_CMDS.has(cmd)) return 'hsl(0, 75%, 55%)';     // red — destructive
  if (AI_CMDS.has(cmd))     return 'hsl(30, 85%, 55%)';    // orange — AI
  return 'hsl(142, 70%, 50%)';                              // green — set/create
}

/** Format epoch timestamp to HH:MM:SS.mmm */
function formatTimestamp(ts) {
  if (!ts) return '--:--:--.---';
  return new Date(ts).toLocaleTimeString('en-US', {
    hour12: false, hour: '2-digit', minute: '2-digit',
    second: '2-digit', fractionalSecondDigits: 3,
  });
}

/** Format params object to key=value pairs */
function formatParams(params) {
  if (!params || typeof params !== 'object') return '';
  return Object.entries(params)
    .map(([k, v]) => `${k}=${typeof v === 'number' ? '0x' + v.toString(16).toUpperCase() : v}`)
    .join(' ');
}

const styles = {
  container: {
    background: 'hsla(220, 25%, 6%, 0.85)',
    backdropFilter: 'blur(13px)',
    WebkitBackdropFilter: 'blur(13px)',
    border: '1px solid hsla(220, 40%, 20%, 0.4)',
    borderRadius: `${FIB[6]}px`,
    padding: `${FIB[5]}px`,
    fontFamily: mono,
    fontSize: `${FIB[7] - 2}px`,
    lineHeight: 1.6,
    maxHeight: 340,
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  header: {
    display: 'flex', gap: `${FIB[6]}px`, padding: `${FIB[3]}px 0`,
    borderBottom: '1px solid hsla(220, 30%, 30%, 0.35)',
    marginBottom: `${FIB[4]}px`, color: 'hsl(220, 12%, 42%)',
    fontSize: `${FIB[7] - 3}px`, textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  headerTs: { flexShrink: 0, width: 90 },
  headerCmd: { flexShrink: 0, minWidth: 140 },
  entry: {
    display: 'flex', gap: `${FIB[6]}px`, padding: `${FIB[2]}px 0`,
    borderBottom: '1px solid hsla(220, 20%, 20%, 0.2)', alignItems: 'baseline',
  },
  timestamp: { color: 'hsl(220, 12%, 48%)', flexShrink: 0, fontSize: `${FIB[7] - 3}px`, width: 90 },
  cmdName: (color) => ({ color, fontWeight: 600, flexShrink: 0, minWidth: 140 }),
  params: { color: 'hsl(220, 12%, 62%)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  empty: { color: 'hsl(220, 12%, 38%)', textAlign: 'center', padding: `${FIB[8]}px`, fontStyle: 'italic' },
  count: {
    fontFamily: mono, fontSize: `${FIB[7] - 3}px`, color: 'hsl(220, 12%, 38%)',
    textAlign: 'right', padding: `${FIB[3]}px 0`,
  },
};

/**
 * Scrolling SysEx message log with command categorization and auto-scroll.
 * @param {Object} props
 * @param {Array<{timestamp: number, command: number, params: Object}>} props.events
 * @returns {React.ReactElement}
 */
function SysExLog({ events = [] }) {
  const scrollRef = useRef(null);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  const visible = events.slice(-MAX_ENTRIES);

  return (
    <div ref={scrollRef} className="glass" style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerTs}>time</span>
        <span style={styles.headerCmd}>command</span>
        <span>parameters</span>
      </div>
      {visible.length === 0 ? (
        <div style={styles.empty}>Awaiting SysEx messages…</div>
      ) : (
        visible.map((evt, i) => {
          const cmdByte = evt.command;
          const cmdName = SYSEX_CMD_NAMES[cmdByte] || `0x${(cmdByte || 0).toString(16).toUpperCase()}`;
          const color = categoryColor(cmdByte);
          return (
            <div key={`${evt.timestamp}-${i}`} style={styles.entry}>
              <span style={styles.timestamp}>{formatTimestamp(evt.timestamp)}</span>
              <span style={styles.cmdName(color)}>{cmdName}</span>
              <span style={styles.params} title={formatParams(evt.params)}>
                {formatParams(evt.params)}
              </span>
            </div>
          );
        })
      )}
      {visible.length > 0 && (
        <div style={styles.count}>{visible.length} / {MAX_ENTRIES}</div>
      )}
    </div>
  );
}

export default SysExLog;
