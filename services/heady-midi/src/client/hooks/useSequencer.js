/**
 * @fileoverview useSequencer — React hook for sequencer transport & pattern control.
 * Fetches initial state from REST, subscribes to real-time position via WebSocket,
 * and provides φ-swing display as golden ratio percentage.
 *
 * @module client/hooks/useSequencer
 * @version 2.0.0
 * @author HeadySystems™
 * @license Proprietary — HeadySystems™ & HeadyConnection™
 *
 * ⚡ Made with 💜 by HeadySystems™ & HeadyConnection™
 * Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  PHI, PSI, FIB,
  DEFAULT_BPM, DEFAULT_PPQ, PHI_SWING,
} from '../../shared/midi-constants.js';

// ─── Constants ────────────────────────────────────────────────────
/** API base for sequencer endpoints */
const SEQ_API = '/api/midi/sequencer';

/** Minimum BPM — Fibonacci(5) = 5 */
const MIN_BPM = FIB[5]; // 8

/** Maximum BPM — Fibonacci(14) = 610 */
const MAX_BPM = FIB[14]; // 610

/** Position poll fallback interval (ms) — used if WS drops, φ-derived */
const POLL_INTERVAL_MS = Math.round(FIB[6] * 100 * PSI); // ≈ 494ms

/**
 * Create a default position object.
 * @returns {{ bar: number, beat: number, tick: number }}
 */
function defaultPosition() {
  return { bar: 1, beat: 1, tick: 0 };
}

/**
 * Custom React hook for sequencer transport and pattern control.
 *
 * On mount the hook fetches the current sequencer state from the REST API and
 * then subscribes to real-time position updates via the WebSocket event stream.
 * Exposes play/stop/setTempo/setSwing/addPattern actions and a φ-swing display
 * value showing the current swing as a percentage of the golden ratio offset.
 *
 * @param {Object} params
 * @param {Object[]} params.events    - Live event array from useMidiWebSocket
 * @param {boolean}  params.connected - WebSocket connection state
 * @param {Function} params.sendSysEx - SysEx sender from useMidiWebSocket
 * @returns {{
 *   playing: boolean,
 *   bpm: number,
 *   position: { bar: number, beat: number, tick: number },
 *   swing: number,
 *   swingDisplay: string,
 *   patterns: Object[],
 *   play: () => Promise<void>,
 *   stop: () => Promise<void>,
 *   setTempo: (bpm: number) => Promise<void>,
 *   setSwing: (amount: number) => Promise<void>,
 *   addPattern: (pattern: Object) => Promise<void>
 * }}
 */
export function useSequencer({ events, connected, sendSysEx }) {
  // ── State ────────────────────────────────────────────────────────
  const [playing, setPlaying]     = useState(false);
  const [bpm, setBpm]             = useState(DEFAULT_BPM);
  const [position, setPosition]   = useState(defaultPosition);
  const [swing, setSwingState]    = useState(PHI_SWING);
  const [patterns, setPatterns]   = useState(/** @type {Object[]} */ ([]));

  // ── Refs ─────────────────────────────────────────────────────────
  const pollTimer     = useRef(null);
  const mountedRef    = useRef(true);
  const lastEventIdx  = useRef(0);

  // ── φ-swing display: percentage of golden ratio offset ──────────
  const swingDisplay = useMemo(() => {
    // Straight = 0.5, full φ = PSI ≈ 0.618
    // Display as percentage: (swing - 0.5) / (PSI - 0.5) × 100
    const range = PSI - 0.5; // ≈ 0.118
    const offset = Math.max(0, swing - 0.5);
    const pct = Math.min(100, (offset / range) * 100);
    return `${pct.toFixed(1)}% φ`;
  }, [swing]);

  // ── Fetch initial state from REST ────────────────────────────────
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`${SEQ_API}/state`);
      if (!res.ok || !mountedRef.current) return;
      const data = await res.json();
      if (data.playing != null) setPlaying(data.playing);
      if (data.bpm != null) setBpm(data.bpm);
      if (data.position) setPosition(data.position);
      if (data.swing != null) setSwingState(data.swing);
      if (data.patterns) setPatterns(data.patterns);
    } catch {
      // Server not available — use defaults
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchState();
    return () => { mountedRef.current = false; };
  }, [fetchState]);

  // ── Subscribe to WS events for real-time position ────────────────
  useEffect(() => {
    if (!events || events.length === 0) return;

    // Process only new events since last check
    const startIdx = Math.max(0, lastEventIdx.current);
    const newEvents = events.slice(startIdx);
    lastEventIdx.current = events.length;

    for (const evt of newEvents) {
      if (evt.type === 'position' || evt.type === 'seq:position') {
        setPosition({
          bar:  evt.bar  ?? evt.position?.bar  ?? position.bar,
          beat: evt.beat ?? evt.position?.beat ?? position.beat,
          tick: evt.tick ?? evt.position?.tick ?? position.tick,
        });
      }

      if (evt.type === 'seq:state' || evt.type === 'sequencer') {
        if (evt.playing != null) setPlaying(evt.playing);
        if (evt.bpm != null) setBpm(evt.bpm);
        if (evt.swing != null) setSwingState(evt.swing);
        if (evt.patterns) setPatterns(evt.patterns);
      }

      if (evt.type === 'transport') {
        if (evt.action === 'play')  setPlaying(true);
        if (evt.action === 'stop')  { setPlaying(false); setPosition(defaultPosition()); }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // ── Fallback poll when WS is disconnected ────────────────────────
  useEffect(() => {
    if (connected) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
      return;
    }
    pollTimer.current = setInterval(fetchState, POLL_INTERVAL_MS);
    return () => clearInterval(pollTimer.current);
  }, [connected, fetchState]);

  // ── Transport actions ────────────────────────────────────────────

  /** Start playback via REST + SysEx broadcast. */
  const play = useCallback(async () => {
    try {
      await fetch(`${SEQ_API}/play`, { method: 'POST' });
      setPlaying(true);
    } catch { /* silent */ }
    if (sendSysEx) sendSysEx(0x05, 0x01); // TRANSPORT PLAY
  }, [sendSysEx]);

  /** Stop playback via REST + SysEx broadcast. */
  const stop = useCallback(async () => {
    try {
      await fetch(`${SEQ_API}/stop`, { method: 'POST' });
      setPlaying(false);
      setPosition(defaultPosition());
    } catch { /* silent */ }
    if (sendSysEx) sendSysEx(0x05, 0x00); // TRANSPORT STOP
  }, [sendSysEx]);

  /**
   * Set sequencer tempo. Clamped to [MIN_BPM, MAX_BPM].
   * @param {number} newBpm - Desired BPM
   */
  const setTempo = useCallback(async (newBpm) => {
    const clamped = Math.max(MIN_BPM, Math.min(MAX_BPM, newBpm));
    try {
      await fetch(`${SEQ_API}/tempo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bpm: clamped }),
      });
      setBpm(clamped);
    } catch { /* silent */ }
    // SysEx SET_TEMPO: BPM × 10 encoded as 14-bit (handled server-side)
    if (sendSysEx) sendSysEx(0x01, Math.round(clamped * 10));
  }, [sendSysEx]);

  /**
   * Set swing amount. Value is clamped to [0.5, PSI] where PSI ≈ 0.618.
   * @param {number} amount - Swing offset (0.5 = straight, PSI = full golden ratio)
   */
  const setSwing = useCallback(async (amount) => {
    const clamped = Math.max(0.5, Math.min(PSI, amount));
    try {
      await fetch(`${SEQ_API}/swing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swing: clamped }),
      });
      setSwingState(clamped);
    } catch { /* silent */ }
  }, []);

  /**
   * Add a pattern to the sequencer.
   * @param {Object} pattern - Pattern definition { name, steps, channel, ... }
   */
  const addPattern = useCallback(async (pattern) => {
    try {
      const res = await fetch(`${SEQ_API}/patterns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pattern),
      });
      if (res.ok && mountedRef.current) {
        const data = await res.json();
        setPatterns((prev) => [...prev, data.pattern || pattern]);
      }
    } catch { /* silent */ }
  }, []);

  // ── Cleanup ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearInterval(pollTimer.current);
    };
  }, []);

  return {
    playing,
    bpm,
    position,
    swing,
    swingDisplay,
    patterns,
    play,
    stop,
    setTempo,
    setSwing,
    addPattern,
  };
}
