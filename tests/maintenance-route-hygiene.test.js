const express = require("express");
const request = require("supertest");

const maintenanceRouter = require("../src/routes/maintenance");

describe("maintenance hygiene routes", () => {
    function buildApp() {
        const app = express();
        app.use(express.json());
        app.use("/api/maintenance", maintenanceRouter);
        return app;
    }

    test("audits cleanup candidates", async () => {
        const app = buildApp();
        const response = await request(app).get("/api/maintenance/audit").expect(200);

        expect(response.body.ok).toBe(true);
        expect(response.body.summary).toHaveProperty("ruleCoverage");
        expect(Array.isArray(response.body.candidates)).toBe(true);
    });

    test("cleanup defaults to dry run", async () => {
        const app = buildApp();
        const response = await request(app).post("/api/maintenance/cleanup").send({}).expect(200);

        expect(response.body.ok).toBe(true);
        expect(response.body.dryRun).toBe(true);
        expect(Array.isArray(response.body.deleted)).toBe(true);
    });
});
