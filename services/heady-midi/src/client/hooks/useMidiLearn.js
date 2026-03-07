/**
 * @fileoverview useMidiLearn — React hook for MIDI Learn hardware mapping.
 * Listens for incoming CC events to auto-map physical controllers to parameters.
 * Timeout at MIDI_LEARN_TIMEOUT_MS (~13s) with live countdown.
 *
 * @module client/hooks/useMidiLearn
 * @version 2.0.0
 * @author HeadySystems™
 * @license Proprietary — HeadySystems™ & HeadyConnection™
 *
 * ⚡ Made with 💜 by HeadySystems™ & HeadyConnection™
 * Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  STATUS, MIDI_LEARN_TIMEOUT_MS, FIB, PSI,
} from '../../shared/midi-constants.js';

// ─── Constants ────────────────────────────────────────────────────
/** Countdown tick interval (ms) — φ-derived from FIB[4] × 100 = 500ms */
const COUNTDOWN_TICK_MS = FIB[4] * 100; // 500ms

/** API endpoint for persisting MIDI mappings */
const MAPPINGS_ENDPOINT = '/api/midi/mappings';

/**
 * Custom React hook for MIDI Learn — hardware CC mapping.
 *
 * When learning is active, the hook monitors all incoming MIDI events from the
 * provided WebSocket event stream. On detecting a CC message it records the
 * mapping and POSTs it to the server. A φ-derived timeout (~13s) auto-cancels
 * stale learn sessions, with a live countdown exposed for UI display.
 *
 * @param {Object} params
 * @param {Object[]} params.events   - Live event array from useMidiWebSocket
 * @param {boolean}  params.connected - WebSocket connection state
 * @returns {{
 *   learning: boolean,
 *   targetParam: string|null,
 *   lastDetected: { channel: number, cc: number, value: number }|null,
 *   timeRemaining: number,
 *   startLearn: (targetParam: string) => void,
 *   cancelLearn: () => void,
 *   mappings: Object.<string, { channel: number, cc: number }>
 * }}
 */
export function useMidiLearn({ events, connected }) {
  // ── State ────────────────────────────────────────────────────────
  const [learning, setLearning]           = useState(false);
  const [targetParam, setTargetParam]     = useState(/** @type {string|null} */ (null));
  const [lastDetected, setLastDetected]   = useState(/** @type {{ channel: number, cc: number, value: number }|null} */ (null));
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [mappings, setMappings]           = useState(/** @type {Object.<string, { channel: number, cc: number }>} */ ({}));

  // ── Refs for timers and snapshot values ──────────────────────────
  const timeoutRef    = useRef(null);
  const countdownRef  = useRef(null);
  const startedAtRef  = useRef(0);
  const learningRef   = useRef(false); // avoid stale closures
  const targetRef     = useRef(/** @type {string|null} */ (null));

  // ── Fetch existing mappings on mount ─────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function fetchMappings() {
      try {
        const res = await fetch(MAPPINGS_ENDPOINT);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setMappings(data.mappings || data || {});
        }
      } catch {
        // Endpoint may not be available yet — silent fail
      }
    }
    fetchMappings();
    return () => { cancelled = true; };
  }, []);

  // ── Internal: clean up timers ────────────────────────────────────
  const clearTimers = useCallback(() => {
    clearTimeout(timeoutRef.current);
    clearInterval(countdownRef.current);
    timeoutRef.current = null;
    countdownRef.current = null;
  }, []);

  // ── cancelLearn ──────────────────────────────────────────────────
  const cancelLearn = useCallback(() => {
    clearTimers();
    setLearning(false);
    setTargetParam(null);
    setTimeRemaining(0);
    learningRef.current = false;
    targetRef.current = null;
  }, [clearTimers]);

  // ── startLearn ───────────────────────────────────────────────────
  const startLearn = useCallback((param) => {
    if (!connected) return;

    // Cancel any active session first
    cancelLearn();

    setLearning(true);
    setTargetParam(param);
    setLastDetected(null);
    setTimeRemaining(MIDI_LEARN_TIMEOUT_MS);
    learningRef.current = true;
    targetRef.current = param;
    startedAtRef.current = Date.now();

    // Timeout → auto-cancel after MIDI_LEARN_TIMEOUT_MS
    timeoutRef.current = setTimeout(() => {
      cancelLearn();
    }, MIDI_LEARN_TIMEOUT_MS);

    // Countdown tick for UI
    countdownRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      const remaining = Math.max(0, MIDI_LEARN_TIMEOUT_MS - elapsed);
      setTimeRemaining(remaining);
      if (remaining <= 0) clearInterval(countdownRef.current);
    }, COUNTDOWN_TICK_MS);
  }, [connected, cancelLearn]);

  // ── Persist mapping to server ────────────────────────────────────
  const saveMapping = useCallback(async (param, channel, cc) => {
    const mapping = { param, channel, cc };
    try {
      const res = await fetch(MAPPINGS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mapping),
      });
      if (res.ok) {
        const data = await res.json();
        setMappings((prev) => ({
          ...prev,
          [param]: { channel, cc },
          ...(data.mappings || {}),
        }));
      }
    } catch {
      // Optimistic update even if server fails
      setMappings((prev) => ({ ...prev, [param]: { channel, cc } }));
    }
  }, []);

  // ── Monitor events for CC while learning ─────────────────────────
  useEffect(() => {
    if (!learningRef.current || !events || events.length === 0) return;

    // Check the most recent event
    const latest = events[events.length - 1];
    if (!latest) return;

    // Only react to CC messages
    const isCC = latest.status === STATUS.CC || latest.type === 'cc';
    if (!isCC) return;
    if (latest.channel == null || latest.data1 == null || latest.data2 == null) return;

    const detected = {
      channel: latest.channel,
      cc: latest.data1,
      value: latest.data2,
    };

    setLastDetected(detected);

    // Save and finish learn
    const param = targetRef.current;
    if (param) {
      saveMapping(param, detected.channel, detected.cc);
    }
    cancelLearn();
  }, [events, cancelLearn, saveMapping]);

  // ── Clean up on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  return {
    learning,
    targetParam,
    lastDetected,
    timeRemaining,
    startLearn,
    cancelLearn,
    mappings,
  };
}
