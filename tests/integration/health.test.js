/**
 * Heady™ Enterprise Test Suite — Health Endpoint
 * PR 6: Integration test for /health endpoint
 */

const http = require('http');

const BASE_URL = process.env.HEADY_TEST_URL || 'https://heady-manager-609590223909.us-central1.run.app';

describe('Health Endpoint Integration', () => {
    test('/health returns 200 with valid JSON', async () => {
        const response = await fetch(`${BASE_URL}/health`);
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toHaveProperty('status');
    }, 15000);

    test('/health/live returns 200', async () => {
        const response = await fetch(`${BASE_URL}/health/live`);
        expect(response.status).toBe(200);
    }, 10000);

    test('/health response contains version info', async () => {
        const response = await fetch(`${BASE_URL}/health`);
        const body = await response.json();
        expect(body).toHaveProperty('version');
    }, 10000);
});
