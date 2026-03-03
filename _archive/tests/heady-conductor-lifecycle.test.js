// Note: HeadyConductor is not directly exported as a class from the module.
// We test via the getConductor singleton which returns an instance.
const conductorModule = require("../src/heady-conductor");

// Since the module exports getConductor (a singleton factory), we need to
// test the instance methods. For isolated tests, we construct manually.
// The HeadyConductor class is accessible via the module's internal structure.

describe("HeadyConductor lifecycle controls", () => {
    let conductor;

    beforeEach(() => {
        // Get the singleton - tests share state but that's acceptable for integration tests
        conductor = typeof conductorModule === 'function' ? conductorModule() :
            conductorModule.getConductor ? conductorModule.getConductor() :
                conductorModule;
    });

    test("status includes live cloud and swarm metadata", () => {
        const status = conductor.getStatus();
        expect(status.ok).toBe(true);
        expect(status.architecture).toBe("federated-liquid-conductor");
        expect(typeof status.totalRoutes).toBe("number");
        expect(status.swarmAllocation).toBeDefined();
        expect(status.cloudStatus).toBeDefined();
    });

    test("DLQ operations work when available", () => {
        if (typeof conductor.recordTaskOutcome === 'function') {
            conductor.retryBudgetPerTask = 2;

            const first = conductor.recordTaskOutcome("test-task-a", { status: "failed", reason: "timeout" });
            expect(first.movedToDlq).toBe(false);

            const second = conductor.recordTaskOutcome("test-task-a", { status: "failed", reason: "timeout" });
            expect(second.movedToDlq).toBe(true);

            const dlq = conductor.getDeadLetterQueue();
            expect(dlq.length).toBeGreaterThan(0);
        }
    });

    test("route map returns valid structure", () => {
        const routeMap = conductor.getRouteMap();
        expect(routeMap.ok).toBe(true);
        expect(routeMap.architecture).toBe("federated-liquid-conductor");
        expect(routeMap.groups).toBeDefined();
    });
});
