/**
 * RealtimeIntelligenceEngine Tests
 * Tests core event ingestion, Ableton session management, and flush pipeline.
 */

const { RealtimeIntelligenceEngine } = require("../src/hc_realtime_intelligence");

describe("RealtimeIntelligenceEngine", () => {
    let engine;

    beforeEach(() => {
        engine = new RealtimeIntelligenceEngine({ flushIntervalMs: 60000 });
    });

    afterEach(() => {
        if (engine._timer) { clearInterval(engine._timer); engine._timer = null; }
    });

    test("ingests events and increments metrics", () => {
        const ok = engine.ingest({ type: "midi", note: 60, channel: 1 });
        expect(ok).toBe(true);
        expect(engine.metrics.queued).toBe(1);
        expect(engine.queue.length).toBe(1);
    });

    test("drops events when queue is full", () => {
        engine.cfg.maxQueueDepth = 2;
        engine.ingest({ type: "midi", note: 60 });
        engine.ingest({ type: "midi", note: 61 });
        const ok = engine.ingest({ type: "midi", note: 62 });
        expect(ok).toBe(false);
        expect(engine.metrics.dropped).toBe(1);
    });

    test("ingestExternalEvent queues and sets external metadata", () => {
        const result = engine.ingestExternalEvent({ type: "webhook", source: "test-source", priority: "normal" });
        expect(result.ok).toBe(true);
        expect(result.queued).toBe(true);
        expect(result.immediateFlush).toBe(false);
        expect(engine.metrics.externalIngested).toBe(1);
    });

    test("ingestExternalEvent with high priority triggers immediate flush", () => {
        const result = engine.ingestExternalEvent({ type: "alert", source: "test", priority: "high" });
        expect(result.ok).toBe(true);
        expect(result.immediateFlush).toBe(true);
    });

    test("routeAbletonMidi returns error without active session", () => {
        const result = engine.routeAbletonMidi({ note: 60, channel: 1 });
        expect(result.ok).toBe(false);
    });

    test("startAbletonSession creates session, routeAbletonMidi tracks events", () => {
        const session = engine.startAbletonSession({ bpm: 140 });
        expect(session.bpm).toBe(140);
        expect(session.midiEvents).toBe(0);

        const result = engine.routeAbletonMidi({ note: 60, velocity: 100, channel: 1 });
        expect(result.ok).toBe(true);
        expect(result.sessionMidiCount).toBe(1);
        expect(typeof result.latencyMs).toBe("number");
    });

    test("stopAbletonSession clears session", () => {
        engine.startAbletonSession();
        const stopped = engine.stopAbletonSession();
        expect(stopped.endedAt).toBeDefined();
        expect(engine.abletonSession).toBeNull();
    });

    test("getStatus reports accurate state", () => {
        const status = engine.getStatus();
        expect(status.running).toBe(false);
        expect(status.metrics).toBeDefined();
        expect(status.abletonSession).toBeNull();
    });

    test("flush drains queue and updates metrics", async () => {
        engine.ingest({ type: "midi", note: 60 });
        engine.ingest({ type: "midi", note: 61 });
        await engine._flush();
        expect(engine.queue.length).toBe(0);
        expect(engine.metrics.flushes).toBe(1);
        expect(engine.metrics.delivered).toBe(2);
    });
});
