import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'os';
import { join } from 'path';

async function loadEngine(tmpDir) {
    process.env.AUTONOMY_DATA_DIR = tmpDir;
    process.env.AUTONOMY_TICK_INTERVAL_MS = '700';
    const mod = await import(`../services/autonomy-engine.js?ts=${Date.now()}`);
    return mod;
}

test('ingest + tick produces audit and connectors', async () => {
    const tmp = await fs.mkdtemp(join(os.tmpdir(), 'heady-autonomy-'));
    const engine = await loadEngine(tmp);

    const ingested = await engine.ingestConcept({ text: 'enterprise-grade connector', priority: 'critical' });
    assert.equal(ingested.concept.priority, 'critical');

    const tick = await engine.runAutonomyTick('test');
    assert.ok(!tick.skipped);
    assert.ok(tick.processed >= 1);

    const audit = await engine.getAuditEvents(5);
    assert.ok(audit.length >= 2);
    assert.ok(audit[0].hash);

    const runtime = await engine.getAutonomyRuntimeStatus();
    assert.equal(runtime.alive, true);
});

test('loop lifecycle toggles correctly', async () => {
    const tmp = await fs.mkdtemp(join(os.tmpdir(), 'heady-autonomy-'));
    const engine = await loadEngine(tmp);

    const started = engine.startAutonomyLoop();
    assert.equal(started, true);
    const startedAgain = engine.startAutonomyLoop();
    assert.equal(startedAgain, false);

    await new Promise(r => setTimeout(r, 750));
    const runtime = await engine.getAutonomyRuntimeStatus();
    assert.equal(runtime.loopActive, true);

    const stopped = engine.stopAutonomyLoop();
    assert.equal(stopped, true);
    const stoppedAgain = engine.stopAutonomyLoop();
    assert.equal(stoppedAgain, false);
});
