import assert from 'node:assert/strict';
import fs from 'fs-extra';
import { join } from 'path';
import {
    getAutonomyState,
    ingestConcept,
    runAutonomyTick,
    getAutonomyRuntimeStatus,
    getAuditEvents,
} from './autonomy-engine.js';

const DATA_DIR = join(process.cwd(), 'server', 'data');
const ARTIFACTS = [
    join(DATA_DIR, 'autonomy-state.json'),
    join(DATA_DIR, 'autonomy-audit.jsonl'),
    join(DATA_DIR, 'monorepo-projection.json'),
];

async function cleanup() {
    for (const path of ARTIFACTS) {
        if (await fs.pathExists(path)) {
            await fs.remove(path);
        }
    }
}

async function run() {
    await cleanup();

    const state = await getAutonomyState();
    assert.equal(state.system.alive, true, 'system should be alive by default');
    assert.equal(state.resources.colabProPlusMemberships, 3, 'must model 3 colab pro+ memberships');

    const conceptPayload = await ingestConcept({ text: 'Enterprise-grade self-healing connector orchestration', priority: 'critical' });
    assert.equal(conceptPayload.concept.priority, 'critical');

    const tick = await runAutonomyTick('test');
    assert.equal(tick.state.system.vectorSpace, '3d');
    assert.ok(tick.processed >= 1, 'tick should process at least one concept');

    const runtime = await getAutonomyRuntimeStatus();
    assert.equal(runtime.alive, true);
    assert.ok(runtime.lastTickMs >= 0);

    const audit = await getAuditEvents(10);
    assert.ok(audit.length > 0, 'audit events should be produced');
    assert.ok(audit[0].hash, 'audit entries should include hash for integrity');

    console.log('autonomy-engine tests passed');
    await cleanup();
}

run().catch(async (e) => {
    console.error(e);
    await cleanup();
    process.exit(1);
});
