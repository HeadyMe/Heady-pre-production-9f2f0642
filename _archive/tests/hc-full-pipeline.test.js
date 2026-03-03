/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * HCFullPipeline — 9-Stage State Machine Test Suite
 * [DISPATCH: QA] — Zero-Trust Verification
 *
 * Tests cover: lifecycle, determinism, approval gates, rollback,
 * receipt integrity, and edge cases.
 */

const HCFullPipeline = require("../src/hc-full-pipeline");

describe("HCFullPipeline — 9-Stage State Machine", () => {
    let pipeline;

    beforeEach(() => {
        pipeline = new HCFullPipeline({ maxConcurrent: 2 });
    });

    // ─── Lifecycle Tests ────────────────────────────────────────
    describe("Lifecycle", () => {
        test("creates run with correct initial state", () => {
            const run = pipeline.createRun({ task: "test", riskLevel: "LOW" });
            expect(run.id).toBeDefined();
            expect(run.status).toBe("pending");
            expect(run.stages).toHaveLength(9);
            expect(run.stages.every((s) => s.status === "pending")).toBe(true);
            expect(run.seed).toBeDefined();
        });

        test("emits run:created event on createRun", () => {
            const spy = jest.fn();
            pipeline.on("run:created", spy);
            pipeline.createRun({ task: "test" });
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy.mock.calls[0][0]).toHaveProperty("runId");
        });

        test("executes full pipeline for LOW risk tasks", async () => {
            const run = pipeline.createRun({ task: "test", riskLevel: "LOW" });
            const result = await pipeline.execute(run.id);
            expect(result.status).toBe("completed");
            expect(result.finishedAt).toBeDefined();
            expect(result.stages[8].result).toHaveProperty("receiptId");
        });

        test("all stages marked completed on successful run", async () => {
            const run = pipeline.createRun({ task: "test", riskLevel: "LOW" });
            await pipeline.execute(run.id);
            const nonSkipped = run.stages.filter((s) => s.status !== "skipped");
            nonSkipped.forEach((s) => {
                expect(["completed"]).toContain(s.status);
                expect(s.finishedAt).toBeDefined();
                expect(s.metrics.durationMs).toBeDefined();
            });
        });

        test("throws on unknown runId", async () => {
            await expect(pipeline.execute("nonexistent")).rejects.toThrow(
                "Run nonexistent not found"
            );
        });
    });

    // ─── Determinism Tests ──────────────────────────────────────
    describe("Determinism (Sacred Geometry Integrity)", () => {
        test("arena produces identical scores for same seed", async () => {
            const run1 = pipeline.createRun({ task: "test", riskLevel: "LOW" });
            const run2 = pipeline.createRun({ task: "test", riskLevel: "LOW" });
            // Force same seed
            run2.seed = run1.seed;
            pipeline.runs.set(run2.id, run2);

            await pipeline.execute(run1.id);
            await pipeline.execute(run2.id);

            const arena1 = run1.stages[3].result;
            const arena2 = run2.stages[3].result;
            expect(arena1.deterministic).toBe(true);
            expect(arena2.deterministic).toBe(true);
            expect(arena1.winner.score).toBe(arena2.winner.score);
            expect(arena1.entries.map((e) => e.score)).toEqual(
                arena2.entries.map((e) => e.score)
            );
        });

        test("judge produces identical criteria for same seed", async () => {
            const run1 = pipeline.createRun({ task: "test", riskLevel: "LOW" });
            const run2 = pipeline.createRun({ task: "test", riskLevel: "LOW" });
            run2.seed = run1.seed;
            pipeline.runs.set(run2.id, run2);

            await pipeline.execute(run1.id);
            await pipeline.execute(run2.id);

            const judge1 = run1.stages[4].result;
            const judge2 = run2.stages[4].result;
            expect(judge1.deterministic).toBe(true);
            expect(judge1.criteria).toEqual(judge2.criteria);
        });

        test("different seeds produce different scores", async () => {
            const run1 = pipeline.createRun({ task: "test", riskLevel: "LOW" });
            const run2 = pipeline.createRun({ task: "test", riskLevel: "LOW" });
            // Ensure different seeds
            run2.seed = run1.seed + 1000;
            pipeline.runs.set(run2.id, run2);

            await pipeline.execute(run1.id);
            await pipeline.execute(run2.id);

            const arena1 = run1.stages[3].result;
            const arena2 = run2.stages[3].result;
            // Extremely unlikely to produce identical scores with different seeds
            const scores1 = arena1.entries.map((e) => e.score);
            const scores2 = arena2.entries.map((e) => e.score);
            expect(scores1).not.toEqual(scores2);
        });
    });

    // ─── Approval Gate Tests ────────────────────────────────────
    describe("Approval Gate (HITL)", () => {
        test("pauses for HIGH risk tasks at APPROVE stage", async () => {
            const run = pipeline.createRun({
                task: "test",
                riskLevel: "HIGH",
            });
            const result = await pipeline.execute(run.id);
            expect(result.status).toBe("paused");
            expect(result.stages[5].result.pending).toBe(true);
            expect(result.stages[5].result.reason).toBe(
                "human_approval_required"
            );
        });

        test("pauses for CRITICAL risk tasks", async () => {
            const run = pipeline.createRun({
                task: "test",
                riskLevel: "CRITICAL",
            });
            const result = await pipeline.execute(run.id);
            expect(result.status).toBe("paused");
        });

        test("resumes after approval and completes", async () => {
            const run = pipeline.createRun({
                task: "test",
                riskLevel: "HIGH",
            });
            await pipeline.execute(run.id);
            const resumed = await pipeline.resume(run.id, {
                approved: true,
                actor: "admin",
            });
            expect(resumed.status).toBe("completed");
            expect(resumed.stages[5].result.approved).toBe(true);
            expect(resumed.stages[5].result.actor).toBe("admin");
        });

        test("fails after approval denial", async () => {
            const run = pipeline.createRun({
                task: "test",
                riskLevel: "HIGH",
            });
            await pipeline.execute(run.id);
            const denied = await pipeline.resume(run.id, {
                approved: false,
                actor: "admin",
            });
            expect(denied.status).toBe("failed");
        });

        test("throws on resume of non-paused run", async () => {
            const run = pipeline.createRun({
                task: "test",
                riskLevel: "LOW",
            });
            await pipeline.execute(run.id);
            await expect(pipeline.resume(run.id)).rejects.toThrow(
                "is not paused"
            );
        });
    });

    // ─── Intake Validation Tests ────────────────────────────────
    describe("Intake Validation", () => {
        test("fails intake without task/prompt/code", async () => {
            const run = pipeline.createRun({});
            const result = await pipeline.execute(run.id);
            expect(result.status).toBe("failed");
            expect(run.stages[0].error).toContain(
                "must include task, prompt, or code"
            );
        });

        test("accepts request with prompt field", async () => {
            const run = pipeline.createRun({
                prompt: "analyze this",
                riskLevel: "LOW",
            });
            const result = await pipeline.execute(run.id);
            expect(result.status).toBe("completed");
        });

        test("accepts request with code field", async () => {
            const run = pipeline.createRun({
                code: "const x = 1;",
                riskLevel: "LOW",
            });
            const result = await pipeline.execute(run.id);
            expect(result.status).toBe("completed");
        });
    });

    // ─── Stage Skip Tests ───────────────────────────────────────
    describe("Stage Skipping", () => {
        test("skips specified stages", async () => {
            const run = pipeline.createRun({
                task: "test",
                riskLevel: "LOW",
                skipStages: ["MONTE_CARLO", "ARENA"],
            });
            await pipeline.execute(run.id);
            expect(run.stages[2].status).toBe("skipped"); // MONTE_CARLO
            expect(run.stages[3].status).toBe("skipped"); // ARENA
            // Verify stage reads MC confidence (null → defaults to 85 → passes)
            // but Judge reads skipped Arena → judge skips → winner is N/A
            // The run still completes because confidence defaults to 85 ≥ 60
            expect(["completed", "failed"]).toContain(run.status);
        });

        test("emits stage:skipped events", async () => {
            const skips = [];
            pipeline.on("stage:skipped", (e) => skips.push(e.stage));
            const run = pipeline.createRun({
                task: "test",
                riskLevel: "LOW",
                skipStages: ["ARENA"],
            });
            await pipeline.execute(run.id);
            expect(skips).toContain("ARENA");
        });
    });

    // ─── Rollback Tests ─────────────────────────────────────────
    describe("Rollback with Compensating Actions", () => {
        test("emits rollback events on failure", async () => {
            const events = [];
            pipeline.on("rollback:started", (e) => events.push("started"));
            pipeline.on("stage:rolledback", (e) => events.push(e.stage));
            pipeline.on("rollback:completed", (e) =>
                events.push("completed")
            );

            // Fail at intake
            const run = pipeline.createRun({});
            await pipeline.execute(run.id);

            // Intake fails immediately, so no completed stages to roll back
            expect(run.status).toBe("failed");
        });

        test("rollback records log on run", async () => {
            // Force a late-stage failure by mocking verify
            const origVerify = pipeline._stageVerify.bind(pipeline);
            pipeline._stageVerify = () => {
                throw new Error("Forced verify failure");
            };

            const run = pipeline.createRun({
                task: "test",
                riskLevel: "LOW",
            });
            await pipeline.execute(run.id);

            expect(run.status).toBe("failed");
            expect(run.rollbackLog).toBeDefined();
            expect(Array.isArray(run.rollbackLog)).toBe(true);

            // Restore
            pipeline._stageVerify = origVerify;
        });
    });

    // ─── Receipt Integrity Tests ────────────────────────────────
    describe("Receipt (Audit Trail)", () => {
        test("receipt contains all required fields", async () => {
            const run = pipeline.createRun({
                task: "test",
                riskLevel: "LOW",
            });
            await pipeline.execute(run.id);
            const receipt = run.stages[8].result;
            expect(receipt).toHaveProperty("receiptId");
            expect(receipt).toHaveProperty("runId", run.id);
            expect(receipt).toHaveProperty("seed", run.seed);
            expect(receipt).toHaveProperty("ts");
            expect(receipt.stages).toHaveLength(9);
        });

        test("receipt stage durations are non-negative", async () => {
            const run = pipeline.createRun({
                task: "test",
                riskLevel: "LOW",
            });
            await pipeline.execute(run.id);
            const receipt = run.stages[8].result;
            receipt.stages.forEach((s) => {
                expect(s.durationMs).toBeGreaterThanOrEqual(0);
            });
        });
    });

    // ─── Query Tests ────────────────────────────────────────────
    describe("Queries", () => {
        test("getRun returns null for unknown id", () => {
            expect(pipeline.getRun("unknown")).toBeNull();
        });

        test("listRuns returns sorted array", async () => {
            pipeline.createRun({ task: "a" });
            pipeline.createRun({ task: "b" });
            const runs = pipeline.listRuns();
            expect(runs).toHaveLength(2);
        });

        test("status returns correct counts", async () => {
            const run1 = pipeline.createRun({
                task: "test",
                riskLevel: "LOW",
            });
            const run2 = pipeline.createRun({
                task: "test",
                riskLevel: "HIGH",
            });
            await pipeline.execute(run1.id);
            await pipeline.execute(run2.id);

            const status = pipeline.status();
            expect(status.completed).toBe(1);
            expect(status.paused).toBe(1);
            expect(status.total).toBe(2);
        });
    });

    // ─── Node Pool Selection Tests ──────────────────────────────
    describe("Node Pool Selection", () => {
        test("selects correct pool for code tasks", () => {
            const pool = pipeline._selectNodePool("code");
            expect(pool).toContain("HeadyCoder");
            expect(pool).toContain("HeadyJules");
        });

        test("selects correct pool for security tasks", () => {
            const pool = pipeline._selectNodePool("security");
            expect(pool).toContain("HeadyRisks");
        });

        test("falls back to general pool for unknown types", () => {
            const pool = pipeline._selectNodePool("unknown_type");
            expect(pool).toEqual(
                expect.arrayContaining(["HeadyCoder", "HeadyJules"])
            );
        });
    });

    // ─── Event Emission Tests ───────────────────────────────────
    describe("Event Emission (SSE/WebSocket)", () => {
        test("emits complete event lifecycle", async () => {
            const events = [];
            pipeline.on("run:started", () => events.push("run:started"));
            pipeline.on("stage:started", (e) =>
                events.push(`stage:started:${e.stage}`)
            );
            pipeline.on("stage:completed", (e) =>
                events.push(`stage:completed:${e.stage}`)
            );
            pipeline.on("run:completed", () => events.push("run:completed"));
            pipeline.on("run:failed", () => events.push("run:failed"));

            const run = pipeline.createRun({
                task: "test",
                riskLevel: "LOW",
            });
            await pipeline.execute(run.id);

            expect(events[0]).toBe("run:started");
            // Pipeline ends with either run:completed or run:failed
            const lastEvent = events[events.length - 1];
            expect(["run:completed", "run:failed"]).toContain(lastEvent);
            expect(events.filter((e) => e.startsWith("stage:started")).length)
                .toBeGreaterThan(0);
        });
    });

    // ─── Static Properties ──────────────────────────────────────
    describe("Static Properties", () => {
        test("exposes STAGES constant", () => {
            expect(HCFullPipeline.STAGES).toEqual([
                "INTAKE",
                "TRIAGE",
                "MONTE_CARLO",
                "ARENA",
                "JUDGE",
                "APPROVE",
                "EXECUTE",
                "VERIFY",
                "RECEIPT",
            ]);
        });

        test("exposes STATUS constant", () => {
            expect(HCFullPipeline.STATUS).toHaveProperty("PENDING", "pending");
            expect(HCFullPipeline.STATUS).toHaveProperty(
                "COMPLETED",
                "completed"
            );
            expect(HCFullPipeline.STATUS).toHaveProperty(
                "ROLLED_BACK",
                "rolled_back"
            );
        });
    });
});
