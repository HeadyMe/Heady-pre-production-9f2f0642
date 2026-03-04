/**
 * ─── Patent Bee ────────────────────────────────────────────────
 * Swarm worker for IP compliance monitoring.
 * 
 * On every swarm cycle, this bee:
 *   1. Reports patent coverage stats
 *   2. Verifies patent vectors exist in memory
 *   3. Checks for code changes that may affect patented systems
 *   4. Emits telemetry for IP health
 * 
 * Domain: patents
 * ────────────────────────────────────────────────────────────────
 */

const domain = 'patents';
const description = 'IP compliance monitoring — tracks patent concept coverage and vector memory presence';
const priority = 0.7;

function getWork(ctx = {}) {
    const work = [];

    // ── Worker 1: Coverage Report ──
    work.push(async () => {
        try {
            const registry = require('../patent-concept-registry');
            const coverage = registry.getCoverage();

            // Emit telemetry
            if (global.eventBus) {
                global.eventBus.emit('telemetry:ingested', {
                    metric: 'patent_coverage',
                    value: coverage,
                    component: 'patent-bee',
                    confidence: 1.0,
                });
            }

            return {
                bee: domain,
                action: 'coverage-report',
                total: coverage.total,
                active: coverage.active,
                embedded: coverage.archived + coverage.active,
                coveragePercent: coverage.coveragePercent,
                embeddedPercent: coverage.embeddedPercent,
            };
        } catch (err) {
            return { bee: domain, action: 'coverage-report', error: err.message };
        }
    });

    // ── Worker 2: Vector Presence Check ──
    work.push(async () => {
        try {
            const registry = require('../patent-concept-registry');
            const vm = global.__vectorMemory || require('../vector-memory');

            if (!vm || !vm.queryMemory) {
                return { bee: domain, action: 'vector-check', skipped: true, reason: 'no vector memory' };
            }

            const presence = await registry.verifyVectorPresence(vm);

            if (global.eventBus) {
                global.eventBus.emit('telemetry:ingested', {
                    metric: 'patent_vector_presence',
                    value: { embedded: presence.embedded, missing: presence.missing },
                    component: 'patent-bee',
                    confidence: 1.0,
                });
            }

            return {
                bee: domain,
                action: 'vector-check',
                embedded: presence.embedded,
                missing: presence.missing,
                missingPatents: (presence.missingPatents || []).slice(0, 5),
            };
        } catch (err) {
            return { bee: domain, action: 'vector-check', error: err.message };
        }
    });

    // ── Worker 3: Domain Health ──
    work.push(async () => {
        try {
            const registry = require('../patent-concept-registry');
            const coverage = registry.getCoverage();

            // Find domains with zero active implementations
            const gaps = [];
            for (const [domainName, info] of Object.entries(coverage.domains)) {
                if (info.active === 0 && info.total > 1) {
                    gaps.push({ domain: domainName, total: info.total, archived: info.archived });
                }
            }

            return {
                bee: domain,
                action: 'domain-health',
                totalDomains: Object.keys(coverage.domains).length,
                gaps,
                gapCount: gaps.length,
            };
        } catch (err) {
            return { bee: domain, action: 'domain-health', error: err.message };
        }
    });

    return work;
}

module.exports = { domain, description, priority, getWork };
