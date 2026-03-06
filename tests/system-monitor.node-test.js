/*
 * © 2026 Heady Systems LLC.
 * Tests for src/system-monitor.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
    getStatus,
    runScan,
    CONFIG,
    _internals: {
        isSafe,
        checkMemory,
        checkDisk,
        state,
    },
} = require("../src/system-monitor");

describe("SystemMonitor", () => {

    describe("isSafe()", () => {
        it("protects kernel PIDs", () => {
            assert.equal(isSafe("anything", "1"), true);
            assert.equal(isSafe("anything", "0"), true);
        });

        it("protects safelisted processes", () => {
            assert.equal(isSafe("heady-manager.js --port 3301", "999"), true);
            assert.equal(isSafe("/usr/lib/xorg/Xorg :0", "888"), true);
            assert.equal(isSafe("pm2 start ecosystem", "777"), true);
            assert.equal(isSafe("/usr/share/antigravity/antigravity", "666"), true);
            assert.equal(isSafe("sshd: user@pts/0", "555"), true);
        });

        it("allows killing non-safelisted processes", () => {
            assert.equal(isSafe("git add -A", "12345"), false);
            assert.equal(isSafe("yes > /dev/null", "12346"), false);
            assert.equal(isSafe("rg --files --hidden", "12347"), false);
            assert.equal(isSafe("node some-random-script.js", "12348"), false);
        });

        it("protects own PID", () => {
            assert.equal(isSafe("node test.js", String(process.pid)), true);
        });
    });

    describe("checkMemory()", () => {
        it("returns memory info with ok field", () => {
            const result = checkMemory();
            assert.equal(typeof result.ok, "boolean");
            if (result.totalMB) {
                assert.equal(typeof result.totalMB, "number");
                assert.equal(typeof result.availableMB, "number");
            }
        });
    });

    describe("checkDisk()", () => {
        it("returns disk usage percentages for configured mount points", () => {
            const result = checkDisk();
            assert.equal(typeof result, "object");
            if (result["/"]) {
                assert.ok(result["/"] > 0 && result["/"] <= 100);
            }
        });
    });

    describe("runScan()", () => {
        it("executes all checks and returns a report", () => {
            const report = runScan();
            assert.ok(report.ts);
            assert.ok(report.checks);
            assert.ok(report.checks.cpu);
            assert.ok(report.checks.git);
            assert.ok(report.checks.ripgrep);
            assert.ok(report.checks.memory);
            assert.ok(report.checks.swap);
            assert.ok(report.checks.disk);
            assert.ok(report.checks.coreDumps);
            assert.equal(typeof report.durationMs, "number");
        });

        it("increments scan count", () => {
            const before = state.scanCount;
            runScan();
            assert.equal(state.scanCount, before + 1);
        });
    });

    describe("getStatus()", () => {
        it("returns complete status object", () => {
            const status = getStatus();
            assert.equal(typeof status.running, "boolean");
            assert.ok(status.startedAt);
            assert.equal(typeof status.scanCount, "number");
            assert.ok(status.config);
            assert.equal(status.config.cpuThreshold, CONFIG.cpu.threshold);
            assert.equal(status.config.minFreeMB, CONFIG.memory.minFreeMB);
        });
    });

    describe("CONFIG", () => {
        it("has sane defaults", () => {
            assert.equal(CONFIG.intervalMs, 30_000);
            assert.equal(CONFIG.cpu.threshold, 95);
            assert.equal(CONFIG.cpu.graceSeconds, 300);
            assert.equal(CONFIG.git.maxRuntimeSeconds, 600);
            assert.equal(CONFIG.memory.minFreeMB, 500);
            assert.equal(CONFIG.disk.usageThreshold, 90);
        });
    });
});
