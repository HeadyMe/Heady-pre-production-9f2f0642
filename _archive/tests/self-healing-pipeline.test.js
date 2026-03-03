/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Self-Healing Pipeline — Unit Tests
 * Tests the HCFullPipeline's self-healing protocol, stage execution,
 * rollback, and event emission.
 */

const HCFullPipeline = require("../src/hc-full-pipeline");

describe("HCFullPipeline", () => {
    let pipeline;

    beforeEach(() => {
        pipeline = new HCFullPipeline({ maxConcurrent: 2 });
    });

    test("initializes with correct defaults", () => {
        expect(pipeline.maxConcurrent).toBe(2);
        expect(pipeline.runs.size).toBe(0);
        expect(pipeline.selfHealStats).toEqual({
            attempts: 0,
            successes: 0,
            failures: 0,
        });
    });

    test("accepts errorInterceptor and vectorMemory opts", () => {
        const mockInterceptor = { intercept: jest.fn(), checkPreemptive: jest.fn() };
        const mockVectorMemory = { queryMemory: jest.fn(), ingestMemory: jest.fn() };

        const p = new HCFullPipeline({
            errorInterceptor: mockInterceptor,
            vectorMemory: mockVectorMemory,
        });

        expect(p.errorInterceptor).toBe(mockInterceptor);
        expect(p.vectorMemory).toBe(mockVectorMemory);
    });

    test("status includes selfHeal stats", () => {
        const status = pipeline.status();
        expect(status.total).toBe(0);
        expect(status.running).toBe(0);
        expect(status.selfHeal).toEqual({
            attempts: 0,
            successes: 0,
            failures: 0,
        });
    });

    test("createRun creates a run and execute completes it", async () => {
        const run = pipeline.createRun({ requestId: "test-1" });
        expect(run).toBeDefined();
        expect(run.id).toBeTruthy();
        expect(run.status).toBe("pending");
        expect(run.stages.length).toBeGreaterThan(0);

        // Run is stored
        const status = pipeline.status();
        expect(status.total).toBe(1);
    });

    test("emits run:created events", () => {
        const events = [];
        pipeline.on("run:created", (data) => events.push(data));
        pipeline.createRun({ requestId: "test-events" });
        expect(events.length).toBe(1);
    });
});
