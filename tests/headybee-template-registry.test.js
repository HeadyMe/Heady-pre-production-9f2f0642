const express = require("express");
const request = require("supertest");

const templateRegistryRouter = require("../src/routes/template-registry");

describe("headybee template registry routes", () => {
    function buildApp() {
        const app = express();
        app.use(express.json());
        app.use("/api/template-registry", templateRegistryRouter);
        return app;
    }

    test("returns templates with readiness metadata", async () => {
        const app = buildApp();
        const response = await request(app).get("/api/template-registry/templates").expect(200);

        expect(response.body.ok).toBe(true);
        expect(response.body.total).toBeGreaterThan(0);
        expect(response.body.templates[0]).toHaveProperty("readinessScore");
        expect(response.body.templates[0]).toHaveProperty("confidence");
    });

    test("runs optimization sweep and returns projection status", async () => {
        const app = buildApp();
        const response = await request(app)
            .post("/api/template-registry/optimize")
            .send({ targetProjection: "github-source-of-truth" })
            .expect(200);

        expect(response.body.ok).toBe(true);
        expect(response.body.sweep).toHaveProperty("autopilotProjection");
        expect(response.body.sweep.autopilotProjection).toHaveProperty("sourceOfTruth", "github");
    });
});
