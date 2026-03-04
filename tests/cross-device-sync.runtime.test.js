const fs = require('fs');
const path = require('path');
const { CrossDeviceSyncHub } = require('../src/cross-device-sync');

let passed = 0;
let failed = 0;
function assert(cond, msg) {
    if (cond) { passed += 1; console.log(`  ✅ ${msg}`); }
    else { failed += 1; console.log(`  ❌ ${msg}`); }
}

async function run() {
    console.log('─── CrossDeviceSync Runtime Test ───');

    const storePath = path.join(__dirname, '..', 'tmp', 'sync-runtime-store.json');
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    if (fs.existsSync(storePath)) fs.unlinkSync(storePath);

    const ingestEvents = [];
    const hub = new CrossDeviceSyncHub({
        storePath,
        vectorMemory: {
            smartIngest: async ({ metadata }) => {
                ingestEvents.push(metadata.eventType);
                return 'mem_sync';
            },
        },
    });

    const wsAMessages = [];
    const wsBMessages = [];
    const wsA = { readyState: 1, send(payload) { wsAMessages.push(payload); }, close() { } };
    const wsB = { readyState: 1, send(payload) { wsBMessages.push(payload); }, close() { } };

    hub._registerDevice('deviceA001', wsA, { name: 'A', platform: 'desktop', userId: 'user-1' });
    hub._registerDevice('deviceB001', wsB, { name: 'B', platform: 'mobile', userId: 'user-1' });

    hub._handleMessage('deviceA001', { type: 'context_update', key: 'task', value: 'ship' });
    hub._handleMessage('deviceA001', { type: 'widget_state_update', state: { panel: 'tasks', expanded: true } });
    hub._handleMessage('deviceB001', {
        type: 'workspace_sync',
        snapshot: {
            vectorWorkspaceId: 'vw-1',
            templates: ['t1', 't2'],
        },
    });
    hub._handleMessage('deviceA001', {
        type: 'template_injection_request',
        request: { requestId: 'req-1' },
    });

    await new Promise((r) => setTimeout(r, 400));

    const status = hub.getStatus();
    assert(status.persistentUsers >= 1, 'status reports persistent users');
    assert(fs.existsSync(storePath), 'persistent store is written to disk');

    const persisted = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    assert(persisted.users['user-1'].widget.panel === 'tasks', 'widget state persisted for user');
    assert(persisted.workspaces['user-1'].vectorWorkspaceId === 'vw-1', 'workspace snapshot persisted for user');
    assert(ingestEvents.includes('workspace_sync'), 'workspace sync event ingested into vector memory');
    assert(ingestEvents.includes('template_injection_request'), 'template injection event ingested into vector memory');
    assert(wsAMessages.some((payload) => String(payload).includes('template_injection_response')), 'template injection response sent to requesting device');

    hub.shutdown();

    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
