const { CognitiveRuntimeGovernor } = require("../src/orchestration/cognitive-runtime-governor");

describe("CognitiveRuntimeGovernor", () => {
    test("tracks ingress, execution, and valid terminal completions", () => {
        const governor = new CognitiveRuntimeGovernor();

        governor.recordIngress({ taskId: "t-1", action: "analyze" });
        governor.recordPrefetch({ hits: 8, misses: 2, retrievalMs: 240 });
        governor.recordExecution({ repeatIntercepted: true });

        const completion = governor.recordCompletion({ terminalState: "completed" });
        expect(completion.ok).toBe(true);

        const status = governor.getStatus();
        expect(status.metrics.ingressCount).toBe(1);
        expect(status.metrics.executionCount).toBe(1);
        expect(status.metrics.completionCount).toBe(1);
        expect(status.metrics.repeatInterceptions).toBe(1);
        expect(status.metrics.firstPassPrefetchHitRate).toBeCloseTo(0.8);
    });

    test("rejects invalid terminal state and tracks violations", () => {
        const governor = new CognitiveRuntimeGovernor();
        const completion = governor.recordCompletion({ terminalState: "unknown" });
        expect(completion.ok).toBe(false);

        const status = governor.getStatus();
        expect(status.metrics.terminalStateViolations).toBe(1);
    });

    test("evaluates migration phases with deterministic criteria", () => {
        const governor = new CognitiveRuntimeGovernor();

        const a = governor.evaluateMigrationPhase("A", {
            structuredTraces: true,
            explicitTerminalStates: true,
        });
        expect(a.ok).toBe(true);
        expect(a.ready).toBe(true);

        const d = governor.evaluateMigrationPhase("D", {
            zoneCache: true,
            p95RetrievalMs: 900,
        });
        expect(d.ready).toBe(true);

        const e = governor.evaluateMigrationPhase("E", {
            repeatDetectorGate: true,
            loopBreakIterations: 4,
        });
        expect(e.ready).toBe(false);
    });
});
