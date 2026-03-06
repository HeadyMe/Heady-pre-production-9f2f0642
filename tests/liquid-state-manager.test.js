const liquidState = require("../src/services/liquid-state-manager");

describe("Liquid State Lifecycle Manager", () => {
    beforeAll(() => {
        liquidState.boot();
    });

    test("boot registers default targets in LATENT state", () => {
        const dashboard = liquidState.getDashboard();
        expect(dashboard.totalTargets).toBe(6);
        expect(dashboard.stateCounts.LATENT).toBe(6);
    });

    test("full projection lifecycle: LATENT → MATERIALIZING → PROJECTED", () => {
        const result = liquidState.projectFull("cloud-run", { sha: "abc123" });
        expect(result.ok).toBe(true);
        expect(result.to).toBe("PROJECTED");

        const map = liquidState.getLifecycleMap();
        expect(map["cloud-run"].state).toBe("PROJECTED");
        expect(map["cloud-run"].projectionCount).toBe(1);
    });

    test("marks target as STALE and prunes it", () => {
        // First project it
        liquidState.projectFull("huggingface-spaces");

        const stale = liquidState.markStale("huggingface-spaces", "test");
        expect(stale.ok).toBe(true);
        expect(stale.to).toBe("STALE");

        const prune = liquidState.prune("huggingface-spaces", "cleanup");
        expect(prune.ok).toBe(true);
        expect(prune.to).toBe("PRUNED");
    });

    test("reactivates pruned target back to LATENT", () => {
        const result = liquidState.reactivate("huggingface-spaces");
        expect(result.ok).toBe(true);
        expect(result.to).toBe("LATENT");
    });

    test("rejects invalid state transitions", () => {
        // LATENT → PROJECTED is not allowed (must go through MATERIALIZING)
        const result = liquidState.markProjected("local-dev");
        expect(result.ok).toBe(false);
        expect(result.error).toContain("Invalid transition");
    });

    test("transition log records all state changes", () => {
        const log = liquidState.getTransitionLog(50);
        expect(log.length).toBeGreaterThan(0);
        expect(log[0]).toHaveProperty("targetId");
        expect(log[0]).toHaveProperty("from");
        expect(log[0]).toHaveProperty("to");
    });

    test("getByState returns targets filtered by state", () => {
        const latent = liquidState.getByState("LATENT");
        expect(Array.isArray(latent)).toBe(true);
        expect(latent.every((t) => t.state === "LATENT")).toBe(true);
    });
});
