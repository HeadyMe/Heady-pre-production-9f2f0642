const {
    buildSnapshot,
    validateCloudOnlyEndpoints,
    validateNoFrontendBackendNaming,
    validateRequiredIds,
    validateColabTriple,
} = require('../scripts/autonomous/unified-runtime-orchestrator');

describe('unified runtime orchestrator', () => {
    test('validates cloud-only endpoints', () => {
        expect(validateCloudOnlyEndpoints(['https://api.headysystems.com/health'])).toBe(true);
        expect(validateCloudOnlyEndpoints(['http://localhost:3000/health'])).toBe(false);
    });

    test('enforces no frontend/backend split language', () => {
        expect(validateNoFrontendBackendNaming({ role: 'capability-service' })).toBe(true);
        expect(validateNoFrontendBackendNaming({ role: 'frontend' })).toBe(false);
    });

    test('detects missing required IDs', () => {
        const check = validateRequiredIds(['HeadyConductor']);
        expect(check.ok).toBe(false);
        expect(check.missing.length).toBeGreaterThan(0);
    });

    test('validates triple colab profile', () => {
        const pass = validateColabTriple({ workers: [{ gpu_profile: 'a' }, { gpu_profile: 'b' }, { gpu_profile: 'c' }] });
        expect(pass.ok).toBe(true);

        const fail = validateColabTriple({ workers: [{ gpu_profile: 'a' }] });
        expect(fail.ok).toBe(false);
    });

    test('buildSnapshot computes passing state for complete topology', () => {
        const runtimeConfig = {
            mode: 'test',
            objective: 'test',
            controlPlane: {
                orchestrators: [
                    { id: 'HeadyConductor', healthEndpoint: 'https://api.headysystems.com/api/conductor/health' },
                    { id: 'HeadyCloudConductor', healthEndpoint: 'https://api.headysystems.com/api/cloud-conductor/health' },
                ],
                swarm: [
                    { id: 'HeadySwarm', healthEndpoint: 'https://api.headysystems.com/api/swarm/health' },
                    { id: 'headybees', healthEndpoint: 'https://api.headysystems.com/api/headybees/health' },
                ],
            },
            dataPlane: {
                vectorWorkspace: {
                    id: 'workspace-3d-vector',
                    healthEndpoint: 'https://api.headysystems.com/api/vector-workspace/health',
                },
                templateInjection: {
                    id: 'template-injection-bridge',
                    healthEndpoint: 'https://api.headysystems.com/api/template-injection/health',
                },
            },
            performancePlane: {
                liveMusic: {
                    id: 'ableton-live-bridge',
                    healthEndpoint: 'https://api.headysystems.com/api/midi/health',
                },
            },
            projectionPlane: {
                healthEndpoint: 'https://api.headysystems.com/api/projection/health',
            },
            serviceCaps: {
                minMicroservices: 12,
                maxMicroservices: 24,
                targetMicroservices: 18,
            },
        };

        const colabConfig = {
            workers: [
                { id: 'colab-a', gpu_profile: 'high-vram' },
                { id: 'colab-b', gpu_profile: 'balanced' },
                { id: 'colab-c', gpu_profile: 'throughput' },
            ],
        };

        const snapshot = buildSnapshot(runtimeConfig, colabConfig);
        expect(snapshot.allChecksPass).toBe(true);
    });
});
