import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';

async function loadEngine() {
    const tmp = await mkdtemp(join(os.tmpdir(), 'autonomy-engine-'));
    process.env.AUTONOMY_DATA_DIR = tmp;
    process.env.AUTONOMY_TICK_INTERVAL_MS = '1000';
    const mod = await import(`../autonomy-engine.js?test=${Date.now()}${Math.random()}`);
    return { mod, tmp };
}

test('ingest -> tick -> runtime health flow works', async () => {
    const { mod, tmp } = await loadEngine();
    try {
        const ingest = await mod.ingestConcept({ text: 'enterprise orchestration concept', priority: 'critical' });
        assert.equal(ingest.concept.priority, 'critical');

        const tick = await mod.runAutonomyTick('test');
        assert.ok(!tick.skipped);
        assert.ok(tick.state.system.tickCounter >= 1);

        const health = await mod.getAutonomyHealth();
        assert.equal(typeof health.ok, 'boolean');
        assert.ok(health.runtime.tickCounter >= 1);
    } finally {
        mod.stopAutonomyLoop?.();
        await rm(tmp, { recursive: true, force: true });
        delete process.env.AUTONOMY_DATA_DIR;
        delete process.env.AUTONOMY_TICK_INTERVAL_MS;
    }
});

test('duplicate ingest is rejected inside dedupe window', async () => {
    const { mod, tmp } = await loadEngine();
    try {
        await mod.ingestConcept({ text: 'same concept', priority: 'high' });
        await assert.rejects(() => mod.ingestConcept({ text: 'same concept', priority: 'high' }), /duplicate concept recently ingested/);
    } finally {
        mod.stopAutonomyLoop?.();
        await rm(tmp, { recursive: true, force: true });
        delete process.env.AUTONOMY_DATA_DIR;
        delete process.env.AUTONOMY_TICK_INTERVAL_MS;
    }
});
