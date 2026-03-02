const DEFAULT_VECTOR_AXES = ['compute', 'memory', 'latency'];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function buildDynamicAppCreationPlan(payload = {}) {
    const {
        appName = 'Heady Dynamic App',
        target = 'heady-project + HeadyMe',
        constraints = {},
        vectorSpace = {},
        liquidArchitecture = {},
    } = payload;

    const colabMemberships = clamp(Number(constraints.colabMemberships || 3), 1, 3);
    const gpuCount = clamp(Number(constraints.gpuCount || colabMemberships), 1, 3);
    const gpuRamGb = clamp(Number(constraints.gpuRamGb || 40), 16, 320);

    const axes = Array.isArray(vectorSpace.axes) && vectorSpace.axes.length === 3
        ? vectorSpace.axes
        : DEFAULT_VECTOR_AXES;

    const normalizedVector = {
        [axes[0]]: clamp(Number(vectorSpace[axes[0]] ?? 0.92), 0, 1),
        [axes[1]]: clamp(Number(vectorSpace[axes[1]] ?? 0.9), 0, 1),
        [axes[2]]: clamp(Number(vectorSpace[axes[2]] ?? 0.95), 0, 1),
    };

    const averageVector = Object.values(normalizedVector).reduce((a, b) => a + b, 0) / 3;
    const responseLatencyTargetMs = Math.round(90 - (averageVector * 45));
    const throughputTargetRps = Math.round(120 + (gpuCount * 55) + (gpuRamGb / 4));

    const layers = [
        {
            id: 'alive-orchestrator',
            title: 'Autonomous Alive Orchestrator',
            capabilities: ['self-healing loops', 'policy re-planning', 'agent memory graph'],
            mode: 'bidirectional',
        },
        {
            id: 'vector-runtime',
            title: '3D Vector Runtime',
            capabilities: ['3-axis embeddings', 'vector-native routing', 'context interpolation'],
            mode: 'instantaneous',
        },
        {
            id: 'liquid-fabric',
            title: 'Liquid Architecture Fabric',
            capabilities: ['elastic model swap', 'hot state migration', 'adaptive GPU packing'],
            mode: liquidArchitecture.mode || 'adaptive-liquid',
        },
    ];

    const deployment = {
        colabProPlus: {
            memberships: colabMemberships,
            strategy: 'triad-active-active-active',
            regions: ['primary', 'secondary', 'burst'],
        },
        gpu: {
            count: gpuCount,
            ramGbTotal: gpuRamGb,
            partitionPlan: [
                { pool: 'realtime-inference', share: 0.5 },
                { pool: 'vector-indexing', share: 0.3 },
                { pool: 'autonomous-planning', share: 0.2 },
            ],
        },
    };

    const phases = [
        'Ingest Heady + HeadyMe schemas into vector graph',
        'Synthesize dynamic app blueprints from intent + telemetry',
        'Continuously compile app slices to liquid runtime containers',
        'Run bidirectional feedback between user actions and orchestrator updates',
    ];

    return {
        appName,
        target,
        constraints: { colabMemberships, gpuCount, gpuRamGb },
        vectorSpace: { axes, normalizedVector },
        objectives: {
            responseLatencyTargetMs,
            throughputTargetRps,
            autonomyScore: Number(averageVector.toFixed(2)),
        },
        layers,
        deployment,
        phases,
        createdAt: new Date().toISOString(),
    };
}
