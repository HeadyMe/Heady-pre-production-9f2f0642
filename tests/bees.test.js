/**
 * © 2026 HeadySystems Inc..
 * Tests for HeadyBee templates — validates the bee ecosystem after optimization.
 */

// Suppress console output during tests
const originalLog = console.log;
const originalWarn = console.warn;
beforeAll(() => {
    console.log = jest.fn();
    console.warn = jest.fn();
});
afterAll(() => {
    console.log = originalLog;
    console.warn = originalWarn;
});

describe('bee-factory', () => {
    const factory = require('../src/bees/bee-factory');

    test('createBee produces a valid entry with domain and getWork', () => {
        const bee = factory.createBee('test-bee-factory', {
            description: 'Unit test bee',
            workers: [{ name: 'ping', fn: async () => ({ pong: true }) }],
        });
        expect(bee.domain).toBe('test-bee-factory');
        expect(typeof bee.getWork).toBe('function');
        expect(bee.validated).toBe(true);
        expect(bee.dynamic).toBe(true);
    });

    test('createBee marks invalid workers as not validated', () => {
        const bee = factory.createBee('test-bad-worker', {
            workers: [{ name: 'broken', fn: 'not a function' }],
        });
        expect(bee.validated).toBe(false);
    });

    test('getWork returns callable functions', async () => {
        const bee = factory.createBee('test-callable', {
            workers: [{ name: 'work', fn: async (ctx) => ({ done: true, ctx }) }],
        });
        const work = bee.getWork({ test: 1 });
        expect(work.length).toBe(1);
        const result = await work[0]();
        expect(result.bee).toBe('test-callable');
        expect(result.done).toBe(true);
    });

    test('worker errors are caught and returned as error objects', async () => {
        const bee = factory.createBee('test-error-handling', {
            workers: [{ name: 'fail', fn: async () => { throw new Error('intentional'); } }],
        });
        const work = bee.getWork();
        const result = await work[0]();
        expect(result.error).toBe('intentional');
        expect(result.bee).toBe('test-error-handling');
    });

    test('spawnBee creates ephemeral bee with priority', () => {
        const bee = factory.spawnBee('ephemeral-test', async () => ({ ok: true }), 0.9);
        expect(bee.domain).toBe('ephemeral-test');
        expect(bee.priority).toBe(0.9);
    });

    describe('createFromTemplate', () => {
        test('health-check template produces functional bee', async () => {
            const bee = factory.createFromTemplate('health-check', { target: 'test-service', url: 'https://httpbin.org/status/200' });
            expect(bee.domain).toContain('health');
            const work = bee.getWork();
            expect(work.length).toBeGreaterThan(0);
        });

        test('monitor template produces metrics and uptime workers', async () => {
            const bee = factory.createFromTemplate('monitor', { target: 'test-monitor' });
            const work = bee.getWork();
            expect(work.length).toBe(2); // metrics + uptime
        });

        test('scanner template produces scan and report workers', () => {
            const bee = factory.createFromTemplate('scanner', { target: 'test-scanner', scanPath: '/tmp' });
            const work = bee.getWork();
            expect(work.length).toBe(2); // scan + report
        });

        test('alerter template checks thresholds', async () => {
            const bee = factory.createFromTemplate('alerter', { target: 'test-alerter' });
            const work = bee.getWork();
            expect(work.length).toBe(1);
            const result = await work[0]();
            expect(result).toHaveProperty('alertCount');
            expect(result.target).toBe('test-alerter');
        });

        test('unknown template throws descriptive error', () => {
            expect(() => factory.createFromTemplate('nonexistent', {})).toThrow('Unknown bee template');
        });
    });
});

describe('credential-bee', () => {
    const credBee = require('../src/bees/credential-bee');

    test('exports domain for registry auto-discovery', () => {
        expect(credBee.domain).toBe('credential-bee');
    });

    test('exports getWork as a function', () => {
        expect(typeof credBee.getWork).toBe('function');
    });

    test('getWork returns array of callable functions', () => {
        const work = credBee.getWork();
        expect(Array.isArray(work)).toBe(true);
        expect(work.length).toBeGreaterThan(0);
        work.forEach(fn => expect(typeof fn).toBe('function'));
    });

    test('preserves legacy workers export', () => {
        expect(credBee.id).toBe('credential-bee');
        expect(credBee.name).toBe('Credential Bee');
        expect(Array.isArray(credBee.workers)).toBe(true);
    });
});

describe('input-task-extractor-bee stub deleted', () => {
    test('stub file no longer exists', () => {
        const fs = require('fs');
        const path = require('path');
        const stubPath = path.join(__dirname, '..', 'src', 'bees', 'input-task-extractor-bee.js');
        expect(fs.existsSync(stubPath)).toBe(false);
    });

    test('real input-task-extractor.js still works', () => {
        const extractor = require('../src/bees/input-task-extractor');
        expect(extractor.inputTaskExtractor).toBeDefined();
        expect(extractor.classifyPriority).toBeDefined();
        expect(typeof extractor.classifyPriority).toBe('function');
    });

    test('extracting tasks from text produces valid results', async () => {
        const extractor = require('../src/bees/input-task-extractor');
        const bee = extractor.inputTaskExtractor;
        const work = bee.getWork({ input: 'Deploy the new landing page to production' });
        expect(work.length).toBeGreaterThan(0);
    });
});

describe('hf-auth-3d-bees', () => {
    const hfBees = require('../src/bees/hf-auth-3d-bees');

    test('apply-fix validates missing spaceId', async () => {
        const work = hfBees.hfSpaceFixer.getWork({});
        // Second worker is apply-fix
        const result = await work[1]();
        expect(result.status).toBe('failed');
        expect(result.error).toMatch(/spaceId/);
    });

    test('apply-fix validates missing fixType', async () => {
        const work = hfBees.hfSpaceFixer.getWork({ spaceId: 'test-space' });
        const result = await work[1]();
        expect(result.status).toBe('failed');
        expect(result.error).toMatch(/fixType/);
    });

    test('inject-single validates empty content', async () => {
        const work = hfBees.dataInjector3D.getWork({});
        const result = await work[0]();
        expect(result.injected).toBe(false);
        expect(result.error).toBeDefined();
    });
});

describe('registry', () => {
    // Clear require cache to get fresh registry
    beforeAll(() => {
        // Registry may already have discovered when modules loaded
    });

    const registry = require('../src/bees/registry');

    test('getHealth returns discovery stats', () => {
        const health = registry.getHealth();
        expect(health).toHaveProperty('registered');
        expect(health).toHaveProperty('loaded');
        expect(health).toHaveProperty('failed');
        expect(health).toHaveProperty('domains');
        expect(Array.isArray(health.domains)).toBe(true);
    });

    test('discover finds bee modules', () => {
        const count = registry.discover();
        expect(count).toBeGreaterThan(0);
    });

    test('credential-bee is discoverable after fix', () => {
        registry.discover();
        const domains = registry.listDomains().map(d => d.domain);
        expect(domains).toContain('credential-bee');
    });
});
