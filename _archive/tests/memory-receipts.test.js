const MemoryReceipts = require("../src/memory-receipts");

describe("MemoryReceipts deterministic task lifecycle", () => {
    test("records attempts and detects repeated equivalent failures", () => {
        const receipts = new MemoryReceipts({ repeatThreshold: 3, repeatWindowMs: 60_000 });

        const a1 = receipts.recordAttempt({
            taskId: "task-1",
            inputHash: "in-1",
            constraintsHash: "c-1",
            verdict: "failed",
            errorClass: "E_TIMEOUT",
        });
        expect(a1.repeat.detected).toBe(false);
        expect(a1.repeat.count).toBe(1);

        const a2 = receipts.recordAttempt({
            taskId: "task-1",
            inputHash: "in-1",
            constraintsHash: "c-1",
            verdict: "failed",
            errorClass: "E_TIMEOUT",
        });
        expect(a2.repeat.detected).toBe(false);
        expect(a2.repeat.count).toBe(2);

        const a3 = receipts.recordAttempt({
            taskId: "task-1",
            inputHash: "in-1",
            constraintsHash: "c-1",
            verdict: "failed",
            errorClass: "E_TIMEOUT",
        });
        expect(a3.repeat.detected).toBe(true);
        expect(a3.repeat.count).toBe(3);
        expect(a3.repeat.fingerprint).toContain("task-1");

        const open = receipts.listOpenTasks();
        expect(open).toHaveLength(1);
        expect(open[0].attempts).toBe(3);
    });

    test("enforces explicit terminal states and closes tasks with evidence", () => {
        const receipts = new MemoryReceipts();

        receipts.recordAttempt({ taskId: "task-2", verdict: "success" });

        const closed = receipts.closeTask(
            "task-2",
            "completed",
            "all steps validated",
            { receiptId: "r-1", checks: ["schema", "latency"] }
        );

        expect(closed.closed).toBe(true);
        expect(closed.terminalState).toBe("completed");
        expect(closed.evidence.receiptId).toBe("r-1");

        const state = receipts.getTaskState("task-2");
        expect(state.closed).toBe(true);
        expect(state.terminalReason).toBe("all steps validated");

        const stats = receipts.getStats();
        expect(stats.activeTasks).toBe(0);
    });

    test("rejects invalid terminal state", () => {
        const receipts = new MemoryReceipts();

        expect(() => receipts.closeTask("task-x", "unknown", "bad state")).toThrow(
            "invalid terminal state"
        );
    });

    test("normalizes unsupported verdicts and exposes operational health", () => {
        const receipts = new MemoryReceipts();

        const result = receipts.recordAttempt({ taskId: "task-3", verdict: "RANDOM_VERDICT" });
        expect(result.attempt.verdict).toBe("unknown");

        const health = receipts.getOperationalStatus();
        expect(health.status).toBe("healthy");
        expect(health.terminalStates).toContain("completed");
        expect(health.allowedVerdicts).toContain("failed");
    });

    test("task closure is idempotent after first terminal receipt", () => {
        const receipts = new MemoryReceipts();
        receipts.recordAttempt({ taskId: "task-4", verdict: "failed" });

        const first = receipts.closeTask("task-4", "failed_closed", "manual closure", { trace: "t1" });
        const second = receipts.closeTask("task-4", "failed_closed", "manual closure", { trace: "t1" });

        expect(first.closed).toBe(true);
        expect(second.closed).toBe(true);
        expect(second.idempotent).toBe(true);
        expect(second.terminalState).toBe("failed_closed");
    });

});
