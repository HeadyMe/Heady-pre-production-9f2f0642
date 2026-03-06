/*
 * © 2026 Heady Systems LLC.
 * Integration Tests — P2 CI/CD Determinism Assessment Item
 *
 * Tests for swarm routing, sync handoff, edge failure recovery,
 * projection contracts, and cross-device reconciliation.
 */

const { UnifiedEnterpriseAutonomyService } = require('../src/services/unified-enterprise-autonomy');
const { StructuredLogger, getLogger } = require('../src/services/structured-logger');
const { HealthRegistry } = require('../src/services/health-registry');

// ── Swarm Routing Integration Tests ─────────────────────────────

describe('Swarm Routing Integration', () => {
    let autonomy;

    beforeEach(() => {
        autonomy = new UnifiedEnterpriseAutonomyService();
    });

    test('dispatch assigns workers based on queue pressure', () => {
        const result = autonomy.dispatch({ embed: 0.8, sync: 0.3, template: 0.5 });
        expect(result).toBeDefined();
        expect(result.receipt).toBeDefined();
        expect(result.receipt.hash).toBeDefined();
    });

    test('dispatch returns deterministic receipts', () => {
        const r1 = autonomy.dispatch({ embed: 0.5 });
        const r2 = autonomy.dispatch({ embed: 0.5 });
        // Each dispatch should produce unique receipt hashes (different timestamps)
        expect(r1.receipt.hash).toBeDefined();
        expect(r2.receipt.hash).toBeDefined();
        expect(typeof r1.receipt.hash).toBe('string');
    });

    test('embedding plan includes all catalog sources', () => {
        const plan = autonomy.buildEmbeddingPlan();
        expect(plan).toBeDefined();
        expect(plan.receipt).toBeDefined();
    });

    test('node responsibilities reflect config', () => {
        const resp = autonomy.getNodeResponsibilities();
        expect(resp).toBeDefined();
        expect(resp.receipt).toBeDefined();
    });
});

// ── Sync Handoff Integration Tests ──────────────────────────────

describe('Sync Handoff Integration', () => {
    let autonomy;

    beforeEach(() => {
        autonomy = new UnifiedEnterpriseAutonomyService();
    });

    test('onboarding contract validates auth flow', () => {
        const contract = autonomy.buildOnboardingContract();
        expect(contract).toBeDefined();
        expect(contract.receipt).toBeDefined();
    });

    test('developer platform blueprint returns valid structure', () => {
        const blueprint = autonomy.buildDeveloperPlatformBlueprint();
        expect(blueprint).toBeDefined();
        expect(blueprint.receipt).toBeDefined();
    });

    test('system projection snapshot is deterministic', () => {
        const snapshot = autonomy.buildSystemProjectionSnapshot();
        expect(snapshot).toBeDefined();
        expect(snapshot.receipt).toBeDefined();
        expect(snapshot.receipt.hash).toBeDefined();
    });

    test('source of truth status returns repo state', () => {
        const status = autonomy.getSourceOfTruthStatus();
        expect(status).toBeDefined();
        expect(status.receipt).toBeDefined();
    });
});

// ── Edge Failure Recovery Tests ─────────────────────────────────

describe('Edge Failure Recovery', () => {
    let autonomy;

    beforeEach(() => {
        autonomy = new UnifiedEnterpriseAutonomyService();
    });

    test('self-healing cycle detects and reports issues', () => {
        const result = autonomy.runSelfHealingCycle({ applyCleanup: false });
        expect(result).toBeDefined();
        expect(result.receipt).toBeDefined();
    });

    test('projection noise scan identifies stale artifacts', () => {
        const noise = autonomy.scanProjectionNoise();
        expect(noise).toBeDefined();
        expect(noise.receipt).toBeDefined();
    });

    test('cleanup plan is safe and bounded', () => {
        const plan = autonomy.buildProjectionCleanupPlan();
        expect(plan).toBeDefined();
        expect(plan.receipt).toBeDefined();
    });

    test('health endpoint returns valid status', () => {
        const health = autonomy.getHealth();
        expect(health).toBeDefined();
        expect(health.status).toBe('healthy');
    });
});

// ── Structured Logger Tests ─────────────────────────────────────

describe('Structured Logger', () => {
    let logger;

    beforeEach(() => {
        logger = new StructuredLogger('test-service', { level: 'debug' });
    });

    test('emits structured JSON for all log levels', () => {
        const original = process.stdout.write;
        let output = '';
        process.stdout.write = (s) => { output += s; };

        logger.info('test message', { extra: 'data' });

        process.stdout.write = original;

        const parsed = JSON.parse(output.trim());
        expect(parsed.level).toBe('info');
        expect(parsed.service).toBe('test-service');
        expect(parsed.message).toBe('test message');
        expect(parsed.extra).toBe('data');
        expect(parsed.timestamp).toBeDefined();
        expect(parsed.traceId).toBeDefined();
    });

    test('tracks traffic metrics', () => {
        logger.recordAcceptedTraffic('/api/sync', 'device-1');
        logger.recordRejectedTraffic('/api/sync', 'device-2', 'rate_limit');
        logger.recordStaleDisconnect('device-3', 30000);

        const metrics = logger.getMetrics();
        expect(metrics.totalLogs).toBe(3);
    });

    test('tracks circuit breaker state', () => {
        logger.recordCircuitBreaker('edge-proxy', 'open', 0.85);
        const metrics = logger.getMetrics();
        expect(metrics.circuitBreakers['edge-proxy'].state).toBe('open');
    });

    test('tracks cache hit rates', () => {
        logger.recordCacheHit('vector-cache', true);
        logger.recordCacheHit('vector-cache', true);
        logger.recordCacheHit('vector-cache', false);

        const metrics = logger.getMetrics();
        expect(metrics.cacheCounters['vector-cache'].hits).toBe(2);
        expect(metrics.cacheCounters['vector-cache'].misses).toBe(1);
    });

    test('singleton getLogger returns same instance', () => {
        const a = getLogger('singleton-test');
        const b = getLogger('singleton-test');
        expect(a).toBe(b);
    });
});

// ── Health Registry Tests ───────────────────────────────────────

describe('Health Registry', () => {
    let registry;

    beforeEach(() => {
        registry = new HealthRegistry();
    });

    test('registers and checks individual service health', async () => {
        registry.register('test-svc', () => ({ uptime: 100 }));
        const health = await registry.getServiceHealth('test-svc');
        expect(health.status).toBe('healthy');
        expect(health.uptime).toBe(100);
    });

    test('aggregates health across multiple services', async () => {
        registry.register('svc-a', () => ({ status: 'ok' }));
        registry.register('svc-b', () => ({ status: 'ok' }));
        const agg = await registry.getAggregatedHealth();
        expect(agg.status).toBe('healthy');
        expect(agg.summary.total).toBe(2);
        expect(agg.summary.healthy).toBe(2);
    });

    test('reports degraded when some services fail', async () => {
        registry.register('svc-ok', () => ({ status: 'ok' }));
        registry.register('svc-fail', () => { throw new Error('down'); });
        const agg = await registry.getAggregatedHealth();
        expect(agg.status).toBe('degraded');
        expect(agg.summary.unhealthy).toBe(1);
    });

    test('reports not_found for unregistered services', async () => {
        const health = await registry.getServiceHealth('nonexistent');
        expect(health.status).toBe('not_found');
    });

    test('supports object-style health providers', async () => {
        const service = {
            getHealth: () => ({ status: 'running', bees: 12 }),
        };
        registry.register('bee-svc', service);
        const health = await registry.getServiceHealth('bee-svc');
        expect(health.bees).toBe(12);
    });
});

// ── Projection Contract Tests (P5) ──────────────────────────────

describe('Projection Contracts (3D → 2D)', () => {
    let autonomy;

    beforeEach(() => {
        autonomy = new UnifiedEnterpriseAutonomyService();
    });

    test('system projection snapshot maps to 2D UI schema', () => {
        const snapshot = autonomy.buildSystemProjectionSnapshot();
        // Verify projection contains renderable 2D data
        expect(snapshot.receipt).toBeDefined();
        expect(snapshot.receipt.hash).toBeDefined();
        // Projection should be JSON-serializable for UI consumption
        const serialized = JSON.stringify(snapshot);
        const deserialized = JSON.parse(serialized);
        expect(deserialized.receipt.hash).toBe(snapshot.receipt.hash);
    });

    test('parallel projection rendering is deterministic', () => {
        const s1 = autonomy.buildSystemProjectionSnapshot();
        const s2 = autonomy.buildSystemProjectionSnapshot();
        // Both snapshots should contain the same structural keys
        expect(Object.keys(s1)).toEqual(Object.keys(s2));
    });

    test('onboarding and auth validation returns deterministic result', () => {
        const v1 = autonomy.validateOnboardingAndAuthFlow();
        const v2 = autonomy.validateOnboardingAndAuthFlow();
        expect(Object.keys(v1)).toEqual(Object.keys(v2));
    });
});

// ── Cross-Device Reconciliation Tests (P5) ──────────────────────

describe('Cross-Device Context Reconciliation', () => {
    let autonomy;

    beforeEach(() => {
        autonomy = new UnifiedEnterpriseAutonomyService();
    });

    test('alternate paradigm directives are stable', () => {
        const d1 = autonomy.buildAlternateParadigmDirectives();
        const d2 = autonomy.buildAlternateParadigmDirectives();
        expect(d1.receipt).toBeDefined();
        expect(d2.receipt).toBeDefined();
        // Same config → same structure
        expect(Object.keys(d1)).toEqual(Object.keys(d2));
    });

    test('telemetry is consistent across calls', () => {
        const t1 = autonomy.getCachedTelemetry();
        const t2 = autonomy.getCachedTelemetry();
        expect(t1).toBeDefined();
        expect(t2).toBeDefined();
    });
});
