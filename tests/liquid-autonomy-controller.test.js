const controller = require("../src/services/liquid-autonomy-controller");

describe("Liquid Autonomy Controller", () => {
    test("health returns ACTIVE status with correct topics", () => {
        const health = controller.health();
        expect(health.status).toBe("ACTIVE");
        expect(health.topics.standard).toBe("heady-swarm-tasks");
        expect(health.topics.admin).toBe("heady-admin-triggers");
        expect(health.heartbeatsConfigured).toBe(2);
    });

    test("enqueues admin trigger in full-throttle lane", () => {
        const trigger = controller.enqueueAdminTrigger({
            source: "test-suite",
            command: "deploy projection",
            requestedBy: "unit-test",
        });

        expect(trigger.id).toMatch(/^admin-/);
        expect(trigger.lane).toBe("full-throttle-auto-success");
        expect(trigger.topic).toBe("heady-admin-triggers");
        expect(trigger.source).toBe("test-suite");
        expect(trigger.command).toBe("deploy projection");
        expect(trigger.constraints.removeStandardResourceLimits).toBe(true);
        expect(trigger.projection.destination).toBe("github-monorepo");
    });

    test("dispatches known heartbeat job (nightly-prunerbee)", () => {
        const run = controller.runHeartbeatJob("nightly-prunerbee");
        expect(run).not.toBeNull();
        expect(run.jobId).toBe("nightly-prunerbee");
        expect(run.task).toBe("prune_unused_projections");
        expect(run.status).toBe("dispatched");
        expect(run.topic).toBe("heady-swarm-tasks");
    });

    test("dispatches known heartbeat job (hourly-testerbee)", () => {
        const run = controller.runHeartbeatJob("hourly-testerbee");
        expect(run).not.toBeNull();
        expect(run.task).toBe("simulate_module_federation_traffic");
    });

    test("returns null for unknown heartbeat job", () => {
        const run = controller.runHeartbeatJob("nonexistent-bee");
        expect(run).toBeNull();
    });

    test("getBlueprint returns dual pipeline configuration", () => {
        const blueprint = controller.getBlueprint();
        expect(blueprint.dualPipelines.adminGodMode.lane).toBe("full-throttle-auto-success");
        expect(blueprint.dualPipelines.backgroundHeartbeat.jobs.length).toBe(2);
        expect(blueprint.integrations.terraformPath).toBe("infrastructure/terraform/main.tf");
        expect(blueprint.integrations.maxForLiveReceiverPath).toContain("heady_sysex_receiver");
    });

    test("trigger history is bounded", () => {
        // Fire many triggers
        for (let i = 0; i < 10; i++) {
            controller.enqueueAdminTrigger({ source: `stress-${i}` });
        }

        const health = controller.health();
        expect(health.recentAdminTriggers.length).toBeLessThanOrEqual(5);
    });
});
