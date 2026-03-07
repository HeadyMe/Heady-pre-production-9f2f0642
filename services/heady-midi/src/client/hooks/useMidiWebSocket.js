/**
 * @fileoverview useMidiWebSocket — React hook for MIDI WebSocket connection.
 * Connects to /ws/midi (JSON) and optionally /ws/midi/ump (binary UMP).
 * φ-exponential backoff reconnection, ring buffer, per-channel state, ping/pong latency.
 *
 * @module client/hooks/useMidiWebSocket
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
  STATUS, CHANNEL, CC,
  BACKOFF_BASE_MS, BACKOFF_MAX_MS, EVENT_BUFFER_SIZE,
} from '../../shared/midi-constants.js';

// ─── Constants ────────────────────────────────────────────────────
const PING_INTERVAL_MS = FIB[5] * 1000;          // 5s
const NUM_CHANNELS     = Object.keys(CHANNEL).length; // 8
const WS_JSON_PATH     = '/ws/midi';
const WS_UMP_PATH      = '/ws/midi/ump';

/**
 * Compute φ-exponential backoff delay for a given attempt.
 * delay = BACKOFF_BASE_MS × PHI^attempt, clamped to BACKOFF_MAX_MS.
 * @param {number} attempt - Reconnection attempt (0-indexed)
 * @returns {number} Delay in milliseconds
 */
function phiBackoff(attempt) {
  return Math.min(BACKOFF_BASE_MS * Math.pow(PHI, attempt), BACKOFF_MAX_MS);
}

/**
 * Create an empty channel state object.
 * @returns {Object} Channel state with lastActivity, eventCount, and cc map
 */
function createChannelState() {
  return { lastActivity: 0, eventCount: 0, cc: {} };
}

/**
 * Build the initial channels map — one entry per Heady channel (0-7).
 * @returns {Object.<number, Object>}
 */
function buildInitialChannels() {
  const map = {};
  for (let i = 0; i < NUM_CHANNELS; i++) {
    map[i] = createChannelState();
  }
  return map;
}

/**
 * Custom React hook for MIDI WebSocket connectivity.
 *
 * Maintains a persistent WebSocket connection to the Heady MIDI event bus,
 * with φ-exponential reconnection backoff, a Fibonacci-sized ring buffer for
 * incoming events, per-channel CC tracking, and periodic ping/pong latency
 * measurements.
 *
 * @param {Object} [options]
 * @param {string} [options.host]       - WebSocket host (default: window.location.host)
 * @param {boolean} [options.enableUmp] - Also open a binary UMP socket (default: false)
 * @returns {{
 *   connected: boolean,
 *   reconnecting: boolean,
 *   latencyMs: number,
 *   peerCount: number,
 *   events: Object[],
 *   channels: Object.<number, Object>,
 *   sendMidi: (status: number, channel: number, data1: number, data2: number) => void,
 *   sendSysEx: (cmd: number, ...params: number[]) => void,
 *   ccValues: Object.<string, number>
 * }}
 */
export function useMidiWebSocket(options = {}) {
  const { host = typeof window !== 'undefined' ? window.location.host : 'localhost:8089', enableUmp = false } = options;

  // ── Connection state ─────────────────────────────────────────────
  const [connected, setConnected]       = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [latencyMs, setLatencyMs]       = useState(0);
  const [peerCount, setPeerCount]       = useState(0);

  // ── Ring buffer & channel state ─────────────────────────────────
  const eventsRef   = useRef(/** @type {Object[]} */ ([]));
  const writeIdx    = useRef(0);
  const [eventTick, setEventTick] = useState(0); // force re-render on new events
  const channelsRef = useRef(buildInitialChannels());
  const [channelTick, setChannelTick] = useState(0);

  // ── Refs for WS instances and timers ─────────────────────────────
  const wsRef        = useRef(/** @type {WebSocket|null} */ (null));
  const umpWsRef     = useRef(/** @type {WebSocket|null} */ (null));
  const attemptRef   = useRef(0);
  const pingTimer    = useRef(null);
  const pingSentAt   = useRef(0);
  const reconnectTimer = useRef(null);
  const unmountedRef = useRef(false);

  // ── Derived: flat CC values map { "ch:cc": value } ──────────────
  const ccValues = useMemo(() => {
    const flat = {};
    const chs = channelsRef.current;
    for (const ch of Object.keys(chs)) {
      for (const [ccNum, val] of Object.entries(chs[ch].cc)) {
        flat[`${ch}:${ccNum}`] = val;
      }
    }
    return flat;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelTick]);

  // ── Push an event into the ring buffer ───────────────────────────
  const pushEvent = useCallback((evt) => {
    const buf = eventsRef.current;
    if (buf.length < EVENT_BUFFER_SIZE) {
      buf.push(evt);
    } else {
      buf[writeIdx.current % EVENT_BUFFER_SIZE] = evt;
    }
    writeIdx.current++;
    setEventTick((t) => t + 1);
  }, []);

  // ── Update channel state from an incoming MIDI message ──────────
  const updateChannel = useCallback((msg) => {
    const ch = msg.channel;
    if (ch == null || ch < 0 || ch >= NUM_CHANNELS) return;
    const state = channelsRef.current[ch];
    state.lastActivity = Date.now();
    state.eventCount++;
    if (msg.status === STATUS.CC && msg.data1 != null && msg.data2 != null) {
      state.cc[msg.data1] = msg.data2;
    }
    setChannelTick((t) => t + 1);
  }, []);

  // ── sendMidi: transmit a 3-byte MIDI message via JSON WS ────────
  const sendMidi = useCallback((status, channel, data1, data2) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'midi', status, channel, data1, data2, ts: Date.now() }));
  }, []);

  // ── sendSysEx: transmit a SysEx command via JSON WS ─────────────
  const sendSysEx = useCallback((cmd, ...params) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'sysex', cmd, params, ts: Date.now() }));
  }, []);

  // ── Connect / reconnect logic ────────────────────────────────────
  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${protocol}://${host}${WS_JSON_PATH}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setReconnecting(false);
      attemptRef.current = 0;

      // Start ping interval
      pingTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          pingSentAt.current = Date.now();
          ws.send(JSON.stringify({ type: 'ping', ts: pingSentAt.current }));
        }
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);

        // Pong response → update latency
        if (msg.type === 'pong') {
          setLatencyMs(Date.now() - (msg.ts || pingSentAt.current));
          return;
        }

        // Peer count broadcast
        if (msg.type === 'peers') {
          setPeerCount(msg.count ?? 0);
          return;
        }

        // Sequencer & system events are pushed but don't update channel state
        if (msg.type === 'midi' || msg.type === 'cc' || msg.type === 'note') {
          pushEvent(msg);
          updateChannel(msg);
          return;
        }

        // Any other event still goes into the buffer
        pushEvent(msg);
      } catch {
        // Non-JSON — ignore on the JSON socket
      }
    };

    ws.onclose = () => {
      setConnected(false);
      clearInterval(pingTimer.current);
      if (unmountedRef.current) return;
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };

    // Optional UMP binary socket
    if (enableUmp) {
      const umpUrl = `${protocol}://${host}${WS_UMP_PATH}`;
      const umpWs = new WebSocket(umpUrl);
      umpWs.binaryType = 'arraybuffer';
      umpWsRef.current = umpWs;

      umpWs.onmessage = (e) => {
        if (e.data instanceof ArrayBuffer) {
          pushEvent({ type: 'ump', data: new Uint8Array(e.data), ts: Date.now() });
        }
      };

      umpWs.onerror = () => umpWs.close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, enableUmp, pushEvent, updateChannel]);

  // ── Schedule reconnect with φ-exponential backoff ────────────────
  const scheduleReconnect = useCallback(() => {
    if (unmountedRef.current) return;
    setReconnecting(true);
    const delay = phiBackoff(attemptRef.current);
    attemptRef.current++;
    reconnectTimer.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect]);

  // ── Lifecycle: connect on mount, clean up on unmount ─────────────
  useEffect(() => {
    unmountedRef.current = false;
    connect();

    return () => {
      unmountedRef.current = true;
      clearInterval(pingTimer.current);
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
      if (umpWsRef.current) umpWsRef.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect]);

  // ── Exposed events snapshot (most recent from ring buffer) ──────
  const events = useMemo(() => {
    const buf = eventsRef.current;
    if (buf.length < EVENT_BUFFER_SIZE) return [...buf];
    // Ring buffer — return in chronological order
    const idx = writeIdx.current % EVENT_BUFFER_SIZE;
    return [...buf.slice(idx), ...buf.slice(0, idx)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventTick]);

  return {
    connected,
    reconnecting,
    latencyMs,
    peerCount,
    events,
    channels: channelsRef.current,
    sendMidi,
    sendSysEx,
    ccValues,
  };
}
