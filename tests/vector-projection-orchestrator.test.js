const {
    calculateAxisWeights,
    projectWithDynamicAxes,
    buildProjectionEntries,
    toBarycentric,
} = require('../scripts/autonomous/vector-projection-orchestrator');

describe('vector projection orchestrator', () => {
    test('calculateAxisWeights returns normalized weights', () => {
        const weights = calculateAxisWeights([
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
        ]);

        const total = weights.reduce((sum, current) => sum + current, 0);
        expect(total).toBeCloseTo(1, 6);
        expect(weights.every((item) => item >= 0)).toBe(true);
    });

    test('projectWithDynamicAxes keeps vectors normalized', () => {
        const projected = projectWithDynamicAxes([0.5, 0.4, 0.1], [0.2, 0.3, 0.5]);
        const magnitude = Math.sqrt(projected[0] ** 2 + projected[1] ** 2 + projected[2] ** 2);
        expect(magnitude).toBeCloseTo(1, 6);
    });

    test('buildProjectionEntries publishes github channel metadata', () => {
        const { entries, axisWeights } = buildProjectionEntries([
            { name: 'HeadySystems', url: 'https://github.com/HeadySystems/Heady', description: 'main' },
            { name: 'HeadyWeb', url: 'https://github.com/HeadySystems/HeadyWeb', description: 'web' },
        ]);

        expect(entries).toHaveLength(2);
        expect(entries[0].outwardManifest.channels).toContain('github');
        expect(entries[0].projection.vector3).toHaveLength(3);
        expect(axisWeights.reduce((sum, item) => sum + item, 0)).toBeCloseTo(1, 6);
    });

    test('barycentric representation sums to 1', () => {
        const bary = toBarycentric([0.4, 0.2, 0.6]);
        expect(bary.a + bary.b + bary.c).toBeCloseTo(1, 6);
    });
});
