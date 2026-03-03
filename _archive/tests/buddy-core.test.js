/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Buddy Core — Unit Tests
 * Tests the DeterministicErrorInterceptor, MetacognitionEngine,
 * and BuddyCore decision loop.
 */

const { getBuddy, DeterministicErrorInterceptor } = require("../src/orchestration/buddy-core");

describe("BuddyCore", () => {
    let buddy;

    beforeAll(() => {
        buddy = getBuddy();
    });

    test("has valid identity", () => {
        expect(buddy.identity).toBeDefined();
        expect(buddy.identity.id).toBeTruthy();
        expect(typeof buddy.identity.id).toBe("string");
        expect(buddy.identity.id.length).toBeGreaterThan(0);
    });

    test("getStatus returns valid structure", () => {
        const status = buddy.getStatus();
        expect(status.ok).toBe(true);
        expect(status.identity).toBeDefined();
        expect(status.metacognition).toBeDefined();
        expect(typeof status.metacognition.confidence).toBe("number");
    });

    test("lists MCP tools", () => {
        const tools = buddy.listMCPTools();
        expect(Array.isArray(tools)).toBe(true);
    });

    test("has error interceptor", () => {
        expect(buddy.errorInterceptor).toBeDefined();
        expect(buddy.errorInterceptor).toBeInstanceOf(DeterministicErrorInterceptor);
    });

    test("error interceptor has stats", () => {
        const stats = buddy.errorInterceptor.getStats();
        expect(stats).toBeDefined();
        expect(typeof stats.totalInterceptions).toBe("number");
    });
});

describe("DeterministicErrorInterceptor", () => {
    let interceptor;

    beforeAll(() => {
        interceptor = new DeterministicErrorInterceptor();
    });

    test("intercept processes a basic error", async () => {
        const error = new Error("test-error: connection refused");
        error.name = "ConnectionError";

        const result = await interceptor.intercept(error, {
            source: "test",
            runId: "test-run-123",
        });

        expect(result).toBeDefined();
        // Result should contain error info
        expect(typeof result).toBe("object");
    });

    test("classifies timeout errors", async () => {
        const timeoutError = new Error("ETIMEDOUT: operation timed out");
        const result = await interceptor.intercept(timeoutError, { source: "test" });
        expect(result).toBeDefined();
    });

    test("classifies auth errors", async () => {
        const authError = new Error("Unauthorized: invalid API key");
        const result = await interceptor.intercept(authError, { source: "test" });
        expect(result).toBeDefined();
    });

    test("getStats returns valid object", () => {
        const stats = interceptor.getStats();
        expect(stats).toBeDefined();
        expect(typeof stats.totalInterceptions).toBe("number");
        expect(stats.totalInterceptions).toBeGreaterThan(0);
    });

    test("checkPreemptive returns null for unknown errors", () => {
        const result = interceptor.checkPreemptive("unknown:error:key");
        // Should return null or undefined for unknown patterns
        expect(result).toBeFalsy();
    });
});

describe("MetacognitionEngine", () => {
    let buddy;

    beforeAll(() => {
        buddy = getBuddy();
    });

    test("assessConfidence returns valid range", () => {
        const assessment = buddy.metacognition.assessConfidence();
        expect(typeof assessment.confidence).toBe("number");
        expect(assessment.confidence).toBeGreaterThanOrEqual(0);
        expect(assessment.confidence).toBeLessThanOrEqual(1);
    });

    test("has decision log", () => {
        expect(Array.isArray(buddy.metacognition.decisionLog)).toBe(true);
    });

    test("getRecentDecisions returns array", () => {
        const recent = buddy.metacognition.getRecentDecisions(5);
        expect(Array.isArray(recent)).toBe(true);
    });
});
