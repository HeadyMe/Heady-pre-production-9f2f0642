const {
    computeSwarmAllocation,
    evaluateLiveCloudStatus,
} = require("../src/orchestration/swarm-intelligence");

describe("swarm intelligence allocator", () => {
    test("scales bees and swarms under high load with bounded concurrency", () => {
        const result = computeSwarmAllocation({
            loadScore: 0.95,
            pendingTasks: 240,
            p95LatencyMs: 420,
            errorRate: 0.01,
        });

        expect(result.targetBees).toBeGreaterThan(20);
        expect(result.targetBees).toBeLessThanOrEqual(64);
        expect(result.targetSwarms).toBeGreaterThanOrEqual(2);
        expect(result.asyncConcurrency).toBeLessThanOrEqual(180);
        expect(result.strategy).toBe("throughput-first");
    });

    test("downshifts strategy toward stability on elevated error rate", () => {
        const result = computeSwarmAllocation({
            loadScore: 0.8,
            pendingTasks: 50,
            p95LatencyMs: 900,
            errorRate: 0.15,
        });

        expect(result.strategy).toBe("stability-first");
        expect(result.targetBees).toBeGreaterThanOrEqual(6);
        expect(result.targetSwarms).toBeLessThanOrEqual(12);
    });

    test("reports live-ready only when cloud url, heartbeat, and service health are all healthy", () => {
        const healthy = evaluateLiveCloudStatus({
            cloudUrl: "https://control.headysystems.com",
            heartbeatAgeMs: 1000,
            serviceHealth: 0.99,
        });
        expect(healthy.liveReady).toBe(true);

        const unhealthy = evaluateLiveCloudStatus({
            cloudUrl: "",
            heartbeatAgeMs: 40000,
            serviceHealth: 0.5,
        });
        expect(unhealthy.liveReady).toBe(false);
    });
});
