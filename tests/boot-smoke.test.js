/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Boot Smoke Tests — verifies critical modules load without crash.
 * These tests validate that heady-manager.js wire-ups are syntactically valid
 * and all major subsystems can be instantiated.
 */

describe("Boot Smoke Tests", () => {
    test("vector-memory loads and inits", () => {
        const vm = require("../src/vector-memory");
        expect(vm.init).toBeDefined();
        expect(vm.queryMemory).toBeDefined();
        expect(vm.ingestMemory).toBeDefined();
        expect(vm.queryWithRelationships).toBeDefined();
        expect(vm.addRelationship).toBeDefined();
        expect(vm.getRelationships).toBeDefined();
        vm.init();
    });

    test("buddy-core loads and has expected exports", () => {
        const { getBuddy, DeterministicErrorInterceptor } = require("../src/orchestration/buddy-core");
        expect(getBuddy).toBeDefined();
        expect(DeterministicErrorInterceptor).toBeDefined();
        const buddy = getBuddy();
        expect(buddy.identity).toBeDefined();
        expect(buddy.errorInterceptor).toBeDefined();
    });

    test("hc-full-pipeline loads with expected interface", () => {
        const HCFullPipeline = require("../src/hc-full-pipeline");
        expect(HCFullPipeline).toBeDefined();
        const pipeline = new HCFullPipeline({ maxConcurrent: 2 });
        expect(pipeline.execute).toBeDefined();
        expect(pipeline.status).toBeDefined();
        expect(pipeline._selfHeal).toBeDefined();
        const status = pipeline.status();
        expect(status.selfHeal).toBeDefined();
        expect(status.selfHeal.attempts).toBe(0);
    });

    test("buddy-watchdog loads", () => {
        const { BuddyWatchdog } = require("../src/orchestration/buddy-watchdog");
        expect(BuddyWatchdog).toBeDefined();
    });

    test("config/errors loads", () => {
        const { trackError, getErrorSummary } = require("../src/config/errors");
        expect(trackError).toBeDefined();
        expect(getErrorSummary).toBeDefined();
    });

    test("utils/logger loads", () => {
        const logger = require("../src/utils/logger");
        expect(logger.logSystem).toBeDefined();
        expect(logger.logNodeActivity).toBeDefined();
        expect(logger.logError).toBeDefined();
    });

    test("drift-detector loads", () => {
        const dd = require("../src/drift-detector");
        expect(dd).toBeDefined();
    });

    test("middleware modules load", () => {
        expect(require("../src/middleware/cors-config")).toBeDefined();
        expect(require("../src/middleware/request-id")).toBeDefined();
        expect(require("../src/middleware/security-headers")).toBeDefined();
        expect(require("../src/middleware/error-handler")).toBeDefined();
    });

    test("resilience modules load", () => {
        const resilience = require("../src/resilience");
        expect(resilience).toBeDefined();
    });
});
