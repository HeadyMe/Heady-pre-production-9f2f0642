const express = require("express");
const request = require("supertest");

const liquidAutonomyRouter = require("../src/routes/liquid-autonomy");

describe("liquid autonomy routes", () => {
    function buildApp() {
        const app = express();
        app.use(express.json());
        app.use("/api/liquid-autonomy", liquidAutonomyRouter);
        return app;
    }

    test("returns blueprint with dual-pipeline configuration", async () => {
        const app = buildApp();
        const response = await request(app).get("/api/liquid-autonomy/blueprint").expect(200);

        expect(response.body.ok).toBe(true);
        expect(response.body.blueprint.dualPipelines).toHaveProperty("adminGodMode");
        expect(response.body.blueprint.dualPipelines).toHaveProperty("backgroundHeartbeat");
    });

    test("queues admin trigger in full-throttle lane", async () => {
        const app = buildApp();
        const response = await request(app)
            .post("/api/liquid-autonomy/admin-trigger")
            .send({ source: "heady-web-shell", command: "ship projection" })
            .expect(202);

        expect(response.body.ok).toBe(true);
        expect(response.body.trigger).toHaveProperty("lane", "full-throttle-auto-success");
        expect(response.body.trigger).toHaveProperty("topic", "heady-admin-triggers");
    });

    test("dispatches known heartbeat jobs and rejects unknown jobs", async () => {
        const app = buildApp();

        const ok = await request(app)
            .post("/api/liquid-autonomy/heartbeat/run")
            .send({ jobId: "nightly-prunerbee" })
            .expect(202);

        expect(ok.body.ok).toBe(true);
        expect(ok.body.run).toHaveProperty("task", "prune_unused_projections");

        await request(app)
            .post("/api/liquid-autonomy/heartbeat/run")
            .send({ jobId: "not-real" })
            .expect(404);
    });
});
