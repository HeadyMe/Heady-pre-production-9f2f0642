import assert from 'assert';
import fs from 'fs-extra';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
    getAutonomyState,
    ingestConcept,
    runAutonomyTick,
    getAuditEvents,
    getAutonomyRuntimeStatus,
    startAutonomyLoop,
    stopAutonomyLoop,
} from '../services/autonomy-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataDir = join(__dirname, '..', 'data');

async function resetFiles() {
    await fs.remove(join(dataDir, 'autonomy-state.json'));
    await fs.remove(join(dataDir, 'autonomy-audit.jsonl'));
    await fs.remove(join(dataDir, 'monorepo-projection.json'));
}

async function main() {
    stopAutonomyLoop();
    await resetFiles();

    const initial = await getAutonomyState();
    assert.equal(initial.resources.colabProPlusMemberships, 3);
    assert.equal(initial.system.vectorSpace, '3d');

    await ingestConcept({ text: 'Critical orchestration hardening', priority: 'critical' });
    await ingestConcept({ text: 'Low priority cleanup', priority: 'low' });

    const tick = await runAutonomyTick('test');
    assert.ok(!tick.skipped);
    assert.ok(tick.processed >= 1);

    const runtime = await getAutonomyRuntimeStatus();
    assert.ok(runtime.tickCounter >= 1);

    const audit = await getAuditEvents(10);
    assert.ok(audit.length >= 2);
    assert.ok(audit.every(evt => Boolean(evt.hash)));

    const started = startAutonomyLoop();
    assert.equal(started, true);
    const startedAgain = startAutonomyLoop();
    assert.equal(startedAgain, false);
    const stopped = stopAutonomyLoop();
    assert.equal(stopped, true);

    console.log('autonomy-engine tests passed');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
