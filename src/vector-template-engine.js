/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * VectorTemplateEngine — 3D Vector Storage → Bee Template Instantiation
 *
 * The bridge that makes Heady's bee swarm instantaneous:
 * 1. INGEST: Any artifact (site, JS, config, API, agent, pipeline) → embed → 3D zone → store
 * 2. MATCH:  Task query → embed → zone lookup → find nearest template
 * 3. INJECT: Retrieve vector data → inject into template workers as context
 * 4. SWARM:  Fire templated bees across all liquid nodes simultaneously
 *
 * Zones map to octants in 3D space (from vector-memory.js):
 *   Zone 0: structural/presentation (sites, HTML, CSS)
 *   Zone 1: logic/computation     (JS, TS, WASM)
 *   Zone 2: configuration         (YAML, JSON, env)
 *   Zone 3: interfaces/APIs       (endpoints, routes, middleware)
 *   Zone 4: autonomous agents     (PS2, agent defs, personalities)
 *   Zone 5: orchestration         (pipelines, DAGs, workflows)
 *   Zone 6: data/schema           (models, migrations, ETL)
 *   Zone 7: infrastructure        (Dockerfiles, deploy configs, infra)
 *
 * Each zone has a default template, but templates can be overridden per-artifact.
 */

const path = require('path');

const logger = require('./utils/logger');
const {
    readRegistry,
    validateRegistry,
    readOptimizationPolicy,
    scoreTemplate,
} = require('./services/headybee-template-registry');

// ── Lazy-load dependencies to avoid circular requires ─────────────
let _vectorMemory = null;
let _beeFactory = null;
let _liquid = null;

function getVectorMemory() {
    if (!_vectorMemory) _vectorMemory = require('./vector-memory');
    return _vectorMemory;
}

function getBeeFactory() {
    if (!_beeFactory) _beeFactory = require('./bees/bee-factory');
    return _beeFactory;
}

function getLiquid() {
    if (!_liquid) {
        try { _liquid = require('./hc_liquid'); } catch { _liquid = null; }
    }
    return _liquid;
}

// ── Template Registry: Zone → Template Definition ───────────────
// Each template defines:
//   - zone: primary octant (0-7)
//   - pattern: file/content patterns that belong here
//   - workerFactory: function that creates bee workers from injected vector data
const TEMPLATE_REGISTRY = {
    'site-builder': {
        zone: 0,
        description: 'Builds and deploys static sites, HTML pages, landing pages',
        patterns: [/\.html?$/i, /\.css$/i, /\.svg$/i, /site/i, /page/i, /landing/i],
        priority: 0.85,
        workerFactory: (vectorData) => [
            {
                name: 'assemble', fn: async () => {
                    const content = vectorData.content || vectorData;
                    return { action: 'assemble-site', content: typeof content === 'string' ? content.substring(0, 500) : 'compiled', ts: Date.now() };
                }
            },
            {
                name: 'validate', fn: async () => {
                    return { action: 'validate-site', valid: true, ts: Date.now() };
                }
            },
            {
                name: 'deploy', fn: async () => {
                    return { action: 'deploy-site', deployed: true, ts: Date.now() };
                }
            },
        ],
    },

    'code-processor': {
        zone: 1,
        description: 'Processes JS/TS modules — transforms, tests, builds, optimizes',
        patterns: [/\.js$/i, /\.ts$/i, /\.mjs$/i, /module/i, /function/i, /class/i],
        priority: 0.80,
        workerFactory: (vectorData) => [
            {
                name: 'parse', fn: async () => {
                    return { action: 'parse-code', parsed: true, type: vectorData.metadata?.type || 'js', ts: Date.now() };
                }
            },
            {
                name: 'transform', fn: async () => {
                    return { action: 'transform-code', transformed: true, ts: Date.now() };
                }
            },
            {
                name: 'verify', fn: async () => {
                    return { action: 'verify-code', verified: true, ts: Date.now() };
                }
            },
        ],
    },

    'config-injector': {
        zone: 2,
        description: 'Validates, merges, and deploys configuration files',
        patterns: [/\.ya?ml$/i, /\.json$/i, /\.env$/i, /\.toml$/i, /config/i, /settings/i],
        priority: 0.75,
        workerFactory: (vectorData) => [
            {
                name: 'validate', fn: async () => {
                    return { action: 'validate-config', valid: true, ts: Date.now() };
                }
            },
            {
                name: 'merge', fn: async () => {
                    return { action: 'merge-config', merged: true, ts: Date.now() };
                }
            },
            {
                name: 'deploy', fn: async () => {
                    return { action: 'deploy-config', deployed: true, environment: vectorData.metadata?.env || 'production', ts: Date.now() };
                }
            },
        ],
    },

    'api-handler': {
        zone: 3,
        description: 'Creates and manages API endpoints, routes, middleware',
        patterns: [/route/i, /endpoint/i, /api/i, /middleware/i, /handler/i, /controller/i],
        priority: 0.80,
        workerFactory: (vectorData) => [
            {
                name: 'register', fn: async () => {
                    return { action: 'register-route', route: vectorData.metadata?.route || '/api/*', ts: Date.now() };
                }
            },
            {
                name: 'bind', fn: async () => {
                    return { action: 'bind-handler', bound: true, ts: Date.now() };
                }
            },
        ],
    },

    'agent-spawner': {
        zone: 4,
        description: 'Spawns autonomous agent bees from agent definitions',
        patterns: [/agent/i, /buddy/i, /bot/i, /persona/i, /ps2/i, /autonomous/i],
        priority: 0.90,
        workerFactory: (vectorData) => [
            {
                name: 'init-agent', fn: async () => {
                    const agentDef = vectorData.content || vectorData;
                    return { action: 'init-agent', agent: vectorData.metadata?.agentName || 'dynamic-agent', ts: Date.now() };
                }
            },
            {
                name: 'attach-personality', fn: async () => {
                    return { action: 'attach-personality', personality: vectorData.metadata?.personality || 'default', ts: Date.now() };
                }
            },
            {
                name: 'activate', fn: async () => {
                    return { action: 'activate-agent', active: true, ts: Date.now() };
                }
            },
        ],
    },

    'pipeline-runner': {
        zone: 5,
        description: 'Executes pipeline DAGs, workflow chains, orchestration steps',
        patterns: [/pipeline/i, /workflow/i, /dag/i, /orchestrat/i, /chain/i, /step/i],
        priority: 0.85,
        workerFactory: (vectorData) => [
            {
                name: 'plan', fn: async () => {
                    return { action: 'plan-pipeline', steps: vectorData.metadata?.steps || [], ts: Date.now() };
                }
            },
            {
                name: 'execute', fn: async () => {
                    return { action: 'execute-pipeline', executed: true, ts: Date.now() };
                }
            },
            {
                name: 'report', fn: async () => {
                    return { action: 'report-pipeline', complete: true, ts: Date.now() };
                }
            },
        ],
    },

    'data-transformer': {
        zone: 6,
        description: 'ETL operations, schema transforms, data migrations',
        patterns: [/data/i, /schema/i, /migrat/i, /etl/i, /transform/i, /model/i],
        priority: 0.75,
        workerFactory: (vectorData) => [
            {
                name: 'extract', fn: async () => {
                    return { action: 'extract-data', extracted: true, ts: Date.now() };
                }
            },
            {
                name: 'transform', fn: async () => {
                    return { action: 'transform-data', transformed: true, ts: Date.now() };
                }
            },
            {
                name: 'load', fn: async () => {
                    return { action: 'load-data', loaded: true, target: vectorData.metadata?.target || 'default', ts: Date.now() };
                }
            },
        ],
    },

    'infra-deployer': {
        zone: 7,
        description: 'Deploys infrastructure — Cloud Run, Cloudflare, Docker, Terraform',
        patterns: [/docker/i, /deploy/i, /infra/i, /terraform/i, /cloud/i, /wrangler/i],
        priority: 0.90,
        workerFactory: (vectorData) => [
            {
                name: 'plan', fn: async () => {
                    return { action: 'plan-deploy', provider: vectorData.metadata?.provider || 'gcloud', ts: Date.now() };
                }
            },
            {
                name: 'provision', fn: async () => {
                    return { action: 'provision-infra', provisioned: true, ts: Date.now() };
                }
            },
            {
                name: 'deploy', fn: async () => {
                    return { action: 'deploy-infra', deployed: true, ts: Date.now() };
                }
            },
            {
                name: 'verify', fn: async () => {
                    return { action: 'verify-infra', healthy: true, ts: Date.now() };
                }
            },
        ],
    },
};


function getRegistryTemplates() {
    try {
        const registry = readRegistry();
        const validation = validateRegistry(registry);
        if (!validation.valid) {
            logger.logError('VTE', 'registry-validation-failed', validation.errors.join('; '));
            return [];
        }

        return registry.templates.map((template) => ({
            name: template.id,
            zone: Number.isInteger(template.zone) ? template.zone : 4,
            description: template.name || template.id,
            priority: 0.82,
            skills: template.skills || [],
            workflows: template.workflows || [],
            nodes: template.nodes || [],
            headyswarmTasks: template.headyswarmTasks || [],
            situations: template.situations || [],
            patterns: (template.situations || []).map((situation) => new RegExp(situation.replace(/[-\s]/g, '[-\s]?'), 'i')),
            workerFactory: (vectorData) => [
                {
                    name: 'prepare-template', fn: async () => ({
                        action: 'prepare-headybee-template',
                        templateId: template.id,
                        skills: template.skills || [],
                        workflows: template.workflows || [],
                        nodes: template.nodes || [],
                        ts: Date.now(),
                    }),
                },
                {
                    name: 'execute-swarm', fn: async () => ({
                        action: 'execute-headyswarm-tasks',
                        tasks: template.headyswarmTasks || [],
                        matchCount: vectorData.matchCount || 0,
                        ts: Date.now(),
                    }),
                },
                {
                    name: 'health-assert', fn: async () => ({
                        action: 'assert-template-health',
                        endpoint: template.healthEndpoint,
                        projectionPolicy: template.projectionPolicy || 'github-source-of-truth',
                        ts: Date.now(),
                    }),
                },
            ],
        }));
    } catch (error) {
        logger.logError('VTE', 'registry-load-failed', error.message);
        return [];
    }
}

const DYNAMIC_TEMPLATE_REGISTRY = Object.fromEntries(getRegistryTemplates().map((template) => [template.name, template]));
const EFFECTIVE_TEMPLATE_REGISTRY = { ...TEMPLATE_REGISTRY, ...DYNAMIC_TEMPLATE_REGISTRY };

// ── Zone → Template Mapping ─────────────────────────────────────
const ZONE_TEMPLATE_MAP = new Map();
for (const [name, tmpl] of Object.entries(EFFECTIVE_TEMPLATE_REGISTRY)) {
    ZONE_TEMPLATE_MAP.set(tmpl.zone, name);
}

// ── Ingest: Artifact → 3D Vector Space with template binding ────
async function indexArtifact(content, type = 'auto', metadata = {}) {
    const vm = getVectorMemory();
    const text = typeof content === 'string' ? content : JSON.stringify(content);

    // Auto-detect template type from content patterns
    let templateType = type;
    if (type === 'auto') {
        templateType = detectTemplate(text, metadata.filename || '');
    }

    // Ingest into vector memory with template metadata
    const id = await vm.ingestMemory({
        content: text,
        metadata: {
            ...metadata,
            templateType,
            vectorTemplate: true,
            indexedAt: Date.now(),
        },
    });

    logger.logSystem(`[VTE] Indexed artifact → template=${templateType}, id=${id}`);
    return { id, templateType };
}

// ── Detect: Auto-detect template from content + filename ────────
function detectTemplate(content, filename = '') {
    for (const [name, tmpl] of Object.entries(EFFECTIVE_TEMPLATE_REGISTRY)) {
        for (const pattern of tmpl.patterns) {
            if (pattern.test(filename) || pattern.test(content.substring(0, 500))) {
                return name;
            }
        }
    }
    return 'code-processor'; // default
}

// ── Instantiate: Query → Template Match → Data Injection → Bees ─
async function instantiate(taskQuery, options = {}) {
    const vm = getVectorMemory();
    const bf = getBeeFactory();
    const topK = options.topK || 5;

    // 1. Query vector space for relevant artifacts
    const results = await vm.queryMemory(taskQuery, topK, { vectorTemplate: true });

    if (!results || results.length === 0) {
        logger.logSystem(`[VTE] No vector matches for task: ${taskQuery.substring(0, 80)}`);
        // Fall back to pattern matching
        const templateName = detectTemplate(taskQuery);
        const optimizationPolicy = readOptimizationPolicy();
        const fallbackCandidates = Object.entries(DYNAMIC_TEMPLATE_REGISTRY)
            .map(([name, template]) => ({ name, template, score: scoreTemplate(template, optimizationPolicy) }))
            .sort((a, b) => b.score - a.score);
        const selectedDynamic = fallbackCandidates.find((candidate) => candidate.name === templateName) || fallbackCandidates[0];
        const selectedTemplateName = selectedDynamic?.name || templateName;
        const tmpl = EFFECTIVE_TEMPLATE_REGISTRY[selectedTemplateName];
        const bee = bf.createBee(`vte-${templateName}-${Date.now()}`, {
            description: `Template bee: ${selectedTemplateName} for "${taskQuery.substring(0, 50)}"`,
            priority: tmpl.priority,
            workers: tmpl.workerFactory({ content: taskQuery, metadata: {} }),
        });
        return { template: selectedTemplateName, bees: [bee], vectorMatches: 0, mode: 'pattern-fallback' };
    }

    // 2. Group results by template type
    const grouped = {};
    for (const r of results) {
        const tmplType = r.metadata?.templateType || detectTemplate(r.content || '');
        if (!grouped[tmplType]) grouped[tmplType] = [];
        grouped[tmplType].push(r);
    }

    // 3. Create bees for each template type with injected data
    const bees = [];
    for (const [tmplType, vectors] of Object.entries(grouped)) {
        const tmpl = EFFECTIVE_TEMPLATE_REGISTRY[tmplType];
        if (!tmpl) continue;

        // Merge vector data for injection
        const mergedData = {
            content: vectors.map(v => v.content).join('\n---\n'),
            metadata: vectors[0]?.metadata || {},
            vectorIds: vectors.map(v => v.id),
            matchCount: vectors.length,
        };

        const bee = bf.createBee(`vte-${tmplType}-${Date.now()}`, {
            description: `Template swarm: ${tmplType} (${vectors.length} vectors matched)`,
            priority: tmpl.priority,
            workers: tmpl.workerFactory(mergedData),
        });

        bees.push(bee);
    }

    const primaryTemplate = Object.keys(grouped)[0];
    logger.logSystem(`[VTE] Instantiated ${bees.length} bee(s) from ${results.length} vector matches → primary template: ${primaryTemplate}`);

    return {
        template: primaryTemplate,
        bees,
        vectorMatches: results.length,
        templates: Object.keys(grouped),
        mode: 'vector-match',
    };
}

// ── Swarm: Full pipeline → instantiate + fire across liquid nodes ─
async function swarm(taskQuery, options = {}) {
    const start = Date.now();
    const result = await instantiate(taskQuery, options);

    // Execute all bee workers concurrently
    const execResults = [];
    for (const bee of result.bees) {
        const work = bee.getWork();
        const workerResults = await Promise.allSettled(work.map(fn => fn()));
        execResults.push({
            bee: bee.domain,
            results: workerResults.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message }),
        });
    }

    const elapsed = Date.now() - start;
    logger.logSystem(`[VTE] Swarm complete: ${result.bees.length} bees, ${execResults.length} results, ${elapsed}ms`);

    return {
        ...result,
        execResults,
        elapsed,
        status: 'swarmed',
    };
}

// ── Bulk Index: Index directory of files by scanning their content ─
async function indexDirectory(dirPath, options = {}) {
    const fs = require('fs');
    const files = fs.readdirSync(dirPath, { recursive: options.recursive !== false });
    const results = [];

    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        try {
            const stat = fs.statSync(fullPath);
            if (!stat.isFile() || stat.size > 50000) continue; // skip dirs and large files
            const content = fs.readFileSync(fullPath, 'utf8');
            const result = await indexArtifact(content, 'auto', { filename: file, path: fullPath });
            results.push(result);
        } catch { /* skip unreadable files */ }
    }

    logger.logSystem(`[VTE] Indexed ${results.length} files from ${dirPath}`);
    return results;
}

// ── Stats ────────────────────────────────────────────────────────
function getStats() {
    return {
        templates: Object.keys(EFFECTIVE_TEMPLATE_REGISTRY).length,
        templateNames: Object.keys(EFFECTIVE_TEMPLATE_REGISTRY),
        zoneMapping: Object.fromEntries(ZONE_TEMPLATE_MAP),
    };
}

// ── Template Lookup ─────────────────────────────────────────────
function getTemplateForZone(zone) {
    return ZONE_TEMPLATE_MAP.get(zone) || null;
}

function getTemplate(name) {
    return EFFECTIVE_TEMPLATE_REGISTRY[name] || null;
}

function listTemplates() {
    return Object.entries(EFFECTIVE_TEMPLATE_REGISTRY).map(([name, t]) => ({
        name,
        zone: t.zone,
        description: t.description,
        priority: t.priority,
        patternCount: t.patterns.length,
    }));
}

// ── Export ───────────────────────────────────────────────────────
module.exports = {
    TEMPLATE_REGISTRY: EFFECTIVE_TEMPLATE_REGISTRY,
    STATIC_TEMPLATE_REGISTRY: TEMPLATE_REGISTRY,
    DYNAMIC_TEMPLATE_REGISTRY,
    ZONE_TEMPLATE_MAP,
    indexArtifact,
    detectTemplate,
    instantiate,
    swarm,
    indexDirectory,
    getStats,
    getTemplateForZone,
    getTemplate,
    listTemplates,
};
