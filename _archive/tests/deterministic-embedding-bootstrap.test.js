const {
    buildChunkPlan,
    buildQueueAssignments,
} = require('../scripts/autonomous/deterministic-embedding-bootstrap');

describe('deterministic embedding bootstrap', () => {
    test('buildChunkPlan obeys overlap and max chunks', () => {
        const text = 'x'.repeat(5000);
        const chunks = buildChunkPlan(text, 1000, 100, 3);

        expect(chunks).toHaveLength(3);
        expect(chunks[0]).toHaveLength(1000);
        expect(chunks[1].length).toBeGreaterThan(0);
    });

    test('buildQueueAssignments selects highest score worker', () => {
        const plan = {
            scheduling: {
                queue_weights: {
                    'user-interaction': 1,
                    'background-indexing': 0.5,
                },
            },
            workers: [
                { id: 'colab-a', max_concurrency: 4, queues: ['user-interaction'] },
                { id: 'colab-b', max_concurrency: 8, queues: ['background-indexing'] },
                { id: 'colab-c', max_concurrency: 2, queues: ['user-interaction', 'background-indexing'] },
            ],
        };

        const assignments = buildQueueAssignments(plan, { 'background-indexing': 0.1 });
        const user = assignments.find((item) => item.queue === 'user-interaction');
        const background = assignments.find((item) => item.queue === 'background-indexing');

        expect(user.selectedWorker).toBe('colab-a');
        expect(background.selectedWorker).toBe('colab-b');
    });
});
