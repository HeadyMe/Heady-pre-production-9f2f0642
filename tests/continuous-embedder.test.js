const embedder = require('../src/services/continuous-embedder');

let passed = 0;
let failed = 0;
const assert = (cond, msg) => {
    if (cond) {
        passed += 1;
        console.log(`  ✅ ${msg}`);
    } else {
        failed += 1;
        console.log(`  ❌ ${msg}`);
    }
};

async function run() {
    console.log('─── Continuous Embedder Enterprise Capture ───');

    const before = embedder.getStats().queueLength;
    const queueResult = embedder.queueForEmbed('hello world', { domain: 'manual' });
    assert(queueResult === true, 'queueForEmbed accepts valid content');
    assert(embedder.getStats().queueLength === before + 1, 'queue length increments');

    const emptyResult = embedder.queueForEmbed('', { domain: 'manual' });
    assert(emptyResult === false, 'queueForEmbed rejects empty content');

    embedder.onAnalystAction({ analystId: 'a1', action: 'triage', artifact: 'issue-41', note: 'Root cause mapped' });
    embedder.onSystemAction({ actor: 'orchestrator', action: 'reroute', target: 'edge-proxy', outcome: 'success' });
    embedder.onUserInteraction({ message: 'ship this', response: 'done', userId: 'u1', sessionId: 's1' });

    const afterEvents = embedder.getStats().queueLength;
    assert(afterEvents >= before + 4, 'analyst/system/user events are queued for embedding');

    const vmMock = {
        calls: [],
        async queryMemory(query, topK, filter) {
            this.calls.push({ query, topK, filter });
            return [{ id: 'v1' }];
        },
        async smartIngest() {
            return 'mem_1';
        },
        buildOutboundRepresentation({ channel, topK }) {
            return {
                profile: channel === 'public-api' ? 'spherical' : 'cartesian',
                sample: Array.from({ length: Number(topK || 1) }).map((_, i) => ({ id: `vec_${i}`, zone: i % 2, type: 'widget', representation: { x: i, y: i, z: i } })),
            };
        },
    };

    await embedder.start(vmMock);
    embedder.onDeployment({ target: 'cloud-run', status: 'completed' });
    await embedder.syncProjections();
    embedder.stop();

    assert(vmMock.calls.length > 0, 'syncProjections queries vector memory');
    assert(vmMock.calls[0] && typeof vmMock.calls[0].query === 'string', 'syncProjections passes query string to queryMemory');
    assert(vmMock.calls[0].topK === 5, 'syncProjections passes topK=5');
    assert(typeof vmMock.calls[0].filter === 'object', 'syncProjections passes filter object');

    const stats = embedder.getStats();
    assert(typeof stats.projections === 'object', 'stats exposes projection state');

    const context = await embedder.buildLiveContextSnapshot();
    assert(context.ok === true, 'live context snapshot returns ok');
    assert(context.counts && typeof context.counts === 'object', 'live context snapshot includes counts');

    const templates = await embedder.buildInjectableTemplates({ topK: 3, channel: 'public-api' });
    assert(templates.ok === true, 'injectable templates returns ok');
    assert(templates.templateCount === 3, 'injectable templates count respects topK');

    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
