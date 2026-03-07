/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 */

const express = require("express");
const request = require("supertest");
const { BuddyCore } = require("../src/orchestration/buddy-core");

describe("BuddyCore realtime orchestration", () => {
    test("exposes live health endpoint when realtime engine is wired", async () => {
        const buddy = new BuddyCore();
        buddy.setRealtimeEngine({
            getStatus: () => ({ running: true, queueDepth: 0, metrics: { delivered: 10 } }),
            ingestExternalEvent: () => ({ ok: true }),
            flush: async () => ({ ok: true, queueDepth: 0 }),
        });

        const app = express();
        app.use(express.json());
        buddy.registerRoutes(app);

        const res = await request(app).get("/api/buddy/live/health");
        expect(res.statusCode).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.realtimeWired).toBe(true);
    });

    test("orchestrates live event and forces immediate flush", async () => {
        const ingestExternalEvent = jest.fn(() => ({ ok: true, queued: 1 }));
        const flush = jest.fn(async () => ({ ok: true, queueDepth: 0 }));

        const buddy = new BuddyCore();
        buddy.setRealtimeEngine({
            getStatus: () => ({ running: true, queueDepth: 0 }),
            ingestExternalEvent,
            flush,
        });

        const app = express();
        app.use(express.json());
        buddy.registerRoutes(app);

        const res = await request(app)
            .post("/api/buddy/live/orchestrate")
            .send({ action: "ableton-live", channel: 2, note: 67, velocity: 99, source: "antigravity" });

        expect(res.statusCode).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(ingestExternalEvent).toHaveBeenCalledWith(expect.objectContaining({
            source: "antigravity",
            eventType: "ableton-live",
            channel: 2,
        }), { highPriority: true });
        expect(flush).toHaveBeenCalledTimes(1);
    });

    test("decide includes live orchestration result when realtime mode requested", async () => {
        const buddy = new BuddyCore();
        buddy.setRealtimeEngine({
            getStatus: () => ({ running: true, queueDepth: 0 }),
            ingestExternalEvent: () => ({ ok: true, queued: 1 }),
            flush: async () => ({ ok: true, queueDepth: 0 }),
        });

        const decision = await buddy.decide({ action: "jam", live: true, payload: { note: 70, velocity: 120 } });
        expect(decision.ok).toBe(true);
        expect(decision.live).toBeDefined();
        expect(decision.live.ok).toBe(true);
    });

    test("awaits async ingest and clamps midi payload bounds", async () => {
        const callOrder = [];
        const ingestExternalEvent = jest.fn(async () => {
            callOrder.push("ingest");
            return { ok: true };
        });
        const flush = jest.fn(async () => {
            callOrder.push("flush");
            return { ok: true, queueDepth: 0 };
        });

        const buddy = new BuddyCore();
        buddy.setRealtimeEngine({
            ingestExternalEvent,
            flush,
            getStatus: () => ({ running: true, queueDepth: 0 }),
        });

        const result = await buddy.orchestrateLive({
            action: "bounded-midi",
            channel: 42,
            note: -10,
            velocity: 999,
        });

        expect(result.ok).toBe(true);
        expect(callOrder).toEqual(["ingest", "flush"]);
        expect(ingestExternalEvent).toHaveBeenCalledWith(expect.objectContaining({
            channel: 15,
            data1: 0,
            data2: 127,
        }), { highPriority: true });
    });

});
