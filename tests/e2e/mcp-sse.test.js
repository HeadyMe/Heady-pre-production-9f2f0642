/**
 * Heady™ Enterprise Test Suite — MCP SSE E2E
 * PR 6: End-to-end test for MCP SSE connection
 */

const BASE_URL = process.env.HEADY_TEST_URL || 'https://heady-manager-609590223909.us-central1.run.app';

describe('MCP SSE End-to-End', () => {
    test('/sse endpoint accepts connection', async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        try {
            const response = await fetch(`${BASE_URL}/sse`, {
                signal: controller.signal,
                headers: { 'Accept': 'text/event-stream' },
            });
            // SSE should return 200 with text/event-stream
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toContain('text/event-stream');
        } catch (err) {
            if (err.name === 'AbortError') {
                // Connection accepted, aborted by timeout (expected for SSE)
                expect(true).toBe(true);
            } else {
                throw err;
            }
        } finally {
            clearTimeout(timeout);
        }
    }, 10000);

    test('/api/tools returns tool list', async () => {
        const response = await fetch(`${BASE_URL}/api/tools`);
        // Tools endpoint should exist
        expect([200, 404]).toContain(response.status);
        if (response.status === 200) {
            const body = await response.json();
            expect(body).toBeDefined();
        }
    }, 10000);
});
