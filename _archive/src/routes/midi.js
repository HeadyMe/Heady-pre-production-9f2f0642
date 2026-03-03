/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * ═══ MIDI Event Bus API Routes ═══
 * Phase 2: Expose the MIDI internal event bus via HTTP for monitoring, telemetry,
 *          and HeadyBuddy protocol bridging (MIDI→UDP/TCP/MCP/API).
 *
 * The MIDI bus is the ultra-low-latency internal nervous system.
 * These routes provide observability and manual trigger capabilities.
 */

const express = require('express');
const router = express.Router();
const { midiBus, CHANNELS, MSG, METRICS, NOTES } = require('../engines/midi-event-bus');

// ─── MIDI Bus Health & Metrics ──────────────────────────────────────
router.get('/health', (req, res) => {
    const metrics = midiBus.getMetrics();
    res.json({
        ok: true,
        service: 'midi-event-bus',
        totalMessages: metrics.totalMessages,
        messagesPerSecond: metrics.messagesPerSecond,
        avgLatencyMs: metrics.avgLatencyMs,
        uptimeSeconds: metrics.uptimeSeconds,
        activeChannels: metrics.channels.length,
        listenerCount: metrics.listenerCount,
        ts: new Date().toISOString(),
    });
});

router.get('/metrics', (req, res) => {
    res.json({ ok: true, ...midiBus.getMetrics() });
});

// ─── Channel Reference ─────────────────────────────────────────────
router.get('/channels', (req, res) => {
    res.json({ ok: true, channels: CHANNELS, notes: NOTES, metrics: METRICS, messageTypes: MSG });
});

// ─── Send Message (for testing and manual triggers) ─────────────────
router.post('/send', (req, res) => {
    const { statusByte, channel, data1, data2, meta } = req.body;
    if (statusByte === undefined || channel === undefined || data1 === undefined) {
        return res.status(400).json({ ok: false, error: 'statusByte, channel, and data1 are required' });
    }
    const msg = midiBus.send(statusByte, channel, data1, data2 || 127, meta || {});
    res.json({ ok: true, message: msg });
});

// ─── Convenience: Fire Task Events ──────────────────────────────────
router.post('/task/start', (req, res) => {
    const { taskName, channel } = req.body;
    if (!taskName) return res.status(400).json({ ok: false, error: 'taskName required' });
    const msg = midiBus.taskStarted(taskName, channel);
    res.json({ ok: true, event: 'task_started', taskName, msg });
});

router.post('/task/complete', (req, res) => {
    const { taskName, channel } = req.body;
    if (!taskName) return res.status(400).json({ ok: false, error: 'taskName required' });
    const msg = midiBus.taskCompleted(taskName, channel);
    res.json({ ok: true, event: 'task_completed', taskName, msg });
});

router.post('/task/fail', (req, res) => {
    const { taskName, error, channel } = req.body;
    if (!taskName) return res.status(400).json({ ok: false, error: 'taskName required' });
    const msg = midiBus.taskFailed(taskName, error || 'unknown', channel);
    res.json({ ok: true, event: 'task_failed', taskName, msg });
});

// ─── Convenience: System CC Metrics ─────────────────────────────────
router.post('/metric', (req, res) => {
    const { channel, metricId, value, meta } = req.body;
    if (metricId === undefined || value === undefined) {
        return res.status(400).json({ ok: false, error: 'metricId and value are required' });
    }
    const msg = midiBus.cc(channel || CHANNELS.TELEMETRY, metricId, value, meta || {});
    res.json({ ok: true, event: 'cc_metric', msg });
});

// ─── Regime Shift (mode change broadcast) ───────────────────────────
router.post('/regime', (req, res) => {
    const { regime, channel } = req.body;
    if (!regime) return res.status(400).json({ ok: false, error: 'regime is required' });
    const msg = midiBus.regimeShift(regime, channel);
    res.json({ ok: true, event: 'regime_shift', regime, msg });
});

// ─── SysEx Broadcast ────────────────────────────────────────────────
router.post('/sysex', (req, res) => {
    const { data1, data2, meta } = req.body;
    const msg = midiBus.sysex(data1 || 0, data2 || 0, meta || {});
    res.json({ ok: true, event: 'sysex_broadcast', msg });
});

module.exports = router;
