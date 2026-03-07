/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Session Bee Templates ═══
 * 
 * Templates generated from the Unified Rebuild session (March 3, 2026).
 * Every task creates reusable bees. Every multi-bee operation creates swarms.
 */

const { createBee } = require('./bee-factory');
const logger = require('../utils/logger').child('session-templates');

// ═══════════════════════════════════════════════════════════════
// HeadyBee: cloud-run-deployer
// Deploys any service to Google Cloud Run from source
// ═══════════════════════════════════════════════════════════════
const cloudRunDeployer = createBee('cloud-run-deployer', {
    description: 'Deploy a service to Google Cloud Run from source directory',
    category: 'ops',
    priority: 0.9,
    workers: [{
        name: 'deploy',
        fn: async (ctx = {}) => {
            const { execSync } = require('child_process');
            const service = ctx.service || 'heady-manager';
            const region = ctx.region || 'us-central1';
            const source = ctx.source || '.';
            const memory = ctx.memory || '512Mi';
            const project = ctx.project || process.env.GCP_PROJECT || 'gen-lang-client-0920560496';

            logger.info(`cloud-run-deployer: deploying ${service} from ${source}`);
            const cmd = `gcloud run deploy ${service} --source=${source} --region=${region} --allow-unauthenticated --memory=${memory} --project=${project} --quiet`;
            const result = execSync(cmd, { encoding: 'utf8', timeout: 300000 });

            // Extract service URL from output
            const urlMatch = result.match(/Service URL: (https:\/\/[^\s]+)/);
            return { service, url: urlMatch?.[1], output: result };
        }
    }],
    persist: true,
});

// ═══════════════════════════════════════════════════════════════
// HeadyBee: landing-page-builder
// Creates and deploys premium landing pages
// ═══════════════════════════════════════════════════════════════
const landingPageBuilder = createBee('landing-page-builder', {
    description: 'Build and deploy a premium landing page with dark glassmorphism design',
    category: 'creative',
    priority: 0.7,
    workers: [{
        name: 'build',
        fn: async (ctx = {}) => {
            const fs = require('fs');
            const path = require('path');
            const title = ctx.title || 'Heady';
            const outputDir = ctx.outputDir || path.join(process.cwd(), 'src/landing');

            logger.info(`landing-page-builder: building ${title} landing page`);

            // Use template-bee for real page generation
            try {
                const templateBee = require('./template-bee');
                const hostname = ctx.hostname || 'headyme.com';
                const siteData = templateBee.renderSite(hostname);
                if (siteData) {
                    return { dir: outputDir, site: siteData.name, hostname, rendered: true };
                }
                return { dir: outputDir, rendered: false, reason: `No site config for ${hostname}` };
            } catch (err) {
                // Fallback: list existing files
                try {
                    return { dir: outputDir, files: fs.readdirSync(outputDir), rendered: false, error: err.message };
                } catch {
                    return { dir: outputDir, rendered: false, error: err.message };
                }
            }
        }
    }, {
        name: 'deploy',
        fn: async (ctx = {}) => {
            // Delegates to cloud-run-deployer bee
            const deployer = require('./bee-factory').dynamicRegistry.get('cloud-run-deployer');
            if (deployer) return deployer.getWork(ctx)[0].fn({
                service: ctx.service || 'headyme-site',
                source: ctx.source || 'src/landing',
                memory: '128Mi'
            });
        }
    }],
    persist: true,
});

// ═══════════════════════════════════════════════════════════════
// HeadyBee: valuation-analyzer
// Runs market comparable analysis and valuation estimates
// ═══════════════════════════════════════════════════════════════
const valuationAnalyzer = createBee('valuation-analyzer', {
    description: 'Research market comparables and estimate startup valuation using web data',
    category: 'research',
    priority: 0.8,
    workers: [{
        name: 'research-comps',
        fn: async (ctx = {}) => {
            logger.info('valuation-analyzer: researching market comparables');
            // Pattern: search web for comparable valuations, seed-stage benchmarks
            // Key data points: company, valuation, stage, key metric
            return { comparables: ctx.comparables || [] };
        }
    }, {
        name: 'estimate-value',
        fn: async (ctx = {}) => {
            logger.info('valuation-analyzer: estimating valuation');
            // Pattern: blended estimate from asset-based, comparable, replacement cost
            const ip = ctx.ipValue || 0;
            const tech = ctx.techValue || 0;
            const market = ctx.marketMultiplier || 1;
            return {
                lowEstimate: (ip + tech) * 0.8,
                midEstimate: (ip + tech) * market,
                highEstimate: (ip + tech) * market * 1.5,
            };
        }
    }],
    persist: true,
});

// ═══════════════════════════════════════════════════════════════
// HeadyBee: audio-overview-generator
// Creates narration scripts and generates audio via TTS
// ═══════════════════════════════════════════════════════════════
const audioOverviewGenerator = createBee('audio-overview-generator', {
    description: 'Generate audio overview scripts with Google Cloud TTS or NotebookLM',
    category: 'creative',
    priority: 0.6,
    workers: [{
        name: 'generate-script',
        fn: async (ctx = {}) => {
            logger.info('audio-overview-generator: generating narration script');
            try {
                const { generateOverviewScript } = require('../core/audio-overview');
                return { script: generateOverviewScript(), source: 'audio-overview-module' };
            } catch {
                // Module not available — generate a basic script from context
                const topic = ctx.topic || 'Heady AI Platform';
                const fallbackScript = `Welcome to ${topic}. This is an overview generated by HeadyBees.`;
                return { script: fallbackScript, source: 'fallback', note: 'audio-overview module not available' };
            }
        }
    }, {
        name: 'synthesize-audio',
        fn: async (ctx = {}) => {
            logger.info('audio-overview-generator: synthesizing audio via TTS');
            try {
                const { textToSpeech } = require('../core/audio-overview');
                return textToSpeech(ctx.script, ctx.outputPath || 'data/audio/overview.mp3');
            } catch (err) {
                return { synthesized: false, error: err.message, note: 'TTS module not available — use NotebookLM or external TTS' };
            }
        }
    }],
    persist: true,
});

// ═══════════════════════════════════════════════════════════════
// HeadyBee: colab-gpu-runtime
// Manages Colab GPU notebook for vector embedding
// ═══════════════════════════════════════════════════════════════
const colabGpuRuntime = createBee('colab-gpu-runtime', {
    description: 'Manage Colab GPU runtime for 384D embedding generation and 3D vector ops',
    category: 'ops',
    priority: 0.9,
    workers: [{
        name: 'check-health',
        fn: async (ctx = {}) => {
            const url = ctx.embeddingUrl || process.env.HEADY_EMBEDDING_URL;
            if (!url) return { status: 'offline', reason: 'No embedding URL configured' };

            try {
                const res = await fetch(`${url}/health`);
                const data = await res.json();
                logger.info(`colab-gpu-runtime: ${data.device} | ${data.stats?.embeddings || 0} embeddings`);
                return { status: 'online', ...data };
            } catch (e) {
                return { status: 'offline', reason: e.message };
            }
        }
    }, {
        name: 'embed',
        fn: async (ctx = {}) => {
            const url = ctx.embeddingUrl || process.env.HEADY_EMBEDDING_URL;
            if (!url) throw new Error('No HEADY_EMBEDDING_URL');

            const res = await fetch(`${url}/embed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texts: ctx.texts }),
            });
            return res.json();
        }
    }],
    persist: true,
});

// ═══════════════════════════════════════════════════════════════
// HeadyBee: gcloud-auth-automator
// Handles GCP authentication with service account keys
// ═══════════════════════════════════════════════════════════════
const gcloudAuthAutomator = createBee('gcloud-auth-automator', {
    description: 'Automate GCP auth using service account keys — no manual browser login needed',
    category: 'ops',
    priority: 1.0,
    workers: [{
        name: 'auth-service-account',
        fn: async (ctx = {}) => {
            const { execSync } = require('child_process');
            const keyFile = ctx.keyFile || process.env.GOOGLE_APPLICATION_CREDENTIALS;
            if (!keyFile) {
                logger.info('gcloud-auth-automator: no service account key, creating one...');
                const project = ctx.project || 'gen-lang-client-0920560496';
                const saName = 'heady-deployer';
                const saEmail = `${saName}@${project}.iam.gserviceaccount.com`;

                try {
                    // Check if SA already exists before creating
                    try {
                        execSync(`gcloud iam service-accounts describe ${saEmail} --project=${project} 2>/dev/null`, { encoding: 'utf8' });
                        logger.info(`gcloud-auth-automator: SA ${saEmail} already exists`);
                    } catch {
                        execSync(`gcloud iam service-accounts create ${saName} --display-name="Heady Auto Deployer" --project=${project} --quiet`, { encoding: 'utf8' });
                    }

                    execSync(`gcloud projects add-iam-policy-binding ${project} --member="serviceAccount:${saEmail}" --role="roles/run.admin" --quiet 2>/dev/null`, { encoding: 'utf8' });

                    const keyPath = '/home/headyme/.heady/gcp-key.json';
                    const fs = require('fs');
                    const path = require('path');
                    fs.mkdirSync(path.dirname(keyPath), { recursive: true });
                    execSync(`gcloud iam service-accounts keys create ${keyPath} --iam-account=${saEmail} --quiet`, { encoding: 'utf8' });

                    return { keyFile: keyPath, sa: saEmail };
                } catch (err) {
                    return { authenticated: false, error: err.message };
                }
            }

            try {
                execSync(`gcloud auth activate-service-account --key-file=${keyFile}`, { encoding: 'utf8' });
                return { authenticated: true, keyFile };
            } catch (err) {
                return { authenticated: false, keyFile, error: err.message };
            }
        }
    }],
    persist: true,
});

// ═══════════════════════════════════════════════════════════════
// HeadyBee: service-connection-racer
// Race connections to all services — use whichever responds first
// ═══════════════════════════════════════════════════════════════
const serviceConnectionRacer = createBee('service-connection-racer', {
    description: 'Race connections to multiple service endpoints, use fastest responder',
    category: 'ops',
    priority: 1.0,
    workers: [{
        name: 'race',
        fn: async (ctx = {}) => {
            const endpoints = ctx.endpoints || [
                { name: 'cloud-run', url: 'https://heady-manager-609590223909.us-central1.run.app/health' },
                { name: 'local', url: 'http://localhost:8420/health' },
                { name: 'colab', url: process.env.HEADY_EMBEDDING_URL ? `${process.env.HEADY_EMBEDDING_URL}/health` : null },
            ].filter(e => e.url);

            logger.info(`service-connection-racer: racing ${endpoints.length} endpoints`);

            const results = await Promise.allSettled(
                endpoints.map(async (ep) => {
                    const start = Date.now();
                    const res = await fetch(ep.url, { signal: AbortSignal.timeout(5000) });
                    const data = await res.json();
                    return { ...ep, data, latency: Date.now() - start };
                })
            );

            const winners = results
                .filter(r => r.status === 'fulfilled')
                .map(r => r.value)
                .sort((a, b) => a.latency - b.latency);

            return {
                winner: winners[0] || null,
                all: winners,
                failed: results.filter(r => r.status === 'rejected').length
            };
        }
    }],
    persist: true,
});

// ═══════════════════════════════════════════════════════════════
// HeadySwarm: full-cloud-deploy
// Coordinates all cloud deployment bees in sequence
// ═══════════════════════════════════════════════════════════════
const fullCloudDeploySwarm = createBee('full-cloud-deploy-swarm', {
    description: 'Swarm: Deploy all services to all cloud pillars in parallel',
    category: 'ops',
    priority: 1.0,
    isSwarm: true,
    workers: [{
        name: 'orchestrate',
        fn: async (ctx = {}) => {
            logger.info('full-cloud-deploy-swarm: deploying all pillars');
            const results = {};

            // Phase 1: Auth (if needed)
            const auth = require('./bee-factory').dynamicRegistry.get('gcloud-auth-automator');
            if (auth) results.auth = await auth.getWork()[0].fn(ctx);

            // Phase 2: Deploy in parallel (racing!)
            const [manager, site] = await Promise.allSettled([
                // Deploy heady-manager
                (async () => {
                    const deployer = require('./bee-factory').dynamicRegistry.get('cloud-run-deployer');
                    return deployer?.getWork()[0].fn({ service: 'heady-manager', source: '.', memory: '512Mi' });
                })(),
                // Deploy headyme-site
                (async () => {
                    const deployer = require('./bee-factory').dynamicRegistry.get('cloud-run-deployer');
                    return deployer?.getWork()[0].fn({ service: 'headyme-site', source: 'src/landing', memory: '128Mi' });
                })(),
            ]);

            results.manager = manager.status === 'fulfilled' ? manager.value : { error: manager.reason?.message };
            results.site = site.status === 'fulfilled' ? site.value : { error: site.reason?.message };

            // Phase 3: Verify with racing
            const racer = require('./bee-factory').dynamicRegistry.get('service-connection-racer');
            if (racer) results.verification = await racer.getWork()[0].fn();

            return results;
        }
    }],
    persist: true,
});

// ═══════════════════════════════════════════════════════════════
// HeadySwarm: valuation-report-swarm 
// Research → Analyze → Generate Audio → Produce Report
// ═══════════════════════════════════════════════════════════════
const valuationReportSwarm = createBee('valuation-report-swarm', {
    description: 'Swarm: Full valuation report with research, analysis, and audio overview',
    category: 'research',
    priority: 0.8,
    isSwarm: true,
    workers: [{
        name: 'orchestrate',
        fn: async (ctx = {}) => {
            logger.info('valuation-report-swarm: full pipeline');
            const results = {};

            // Step 1: Research comparables
            const analyzer = require('./bee-factory').dynamicRegistry.get('valuation-analyzer');
            if (analyzer) {
                const workers = analyzer.getWork();
                results.comps = await workers[0].fn(ctx);
                results.valuation = await workers[1].fn({ ...ctx, ...results.comps });
            }

            // Step 2: Generate audio overview
            const audio = require('./bee-factory').dynamicRegistry.get('audio-overview-generator');
            if (audio) {
                const workers = audio.getWork();
                results.script = await workers[0].fn(ctx);
                try { results.audio = await workers[1].fn({ script: results.script.script }); }
                catch (e) { results.audio = { error: e.message }; }
            }

            return results;
        }
    }],
    persist: true,
});

// ═══════════════════════════════════════════════════════════════
// HeadyBee: pruner-bee
// Scans for orphaned projections, stale branches, unused artifacts
// ═══════════════════════════════════════════════════════════════
const prunerBee = createBee('pruner-bee', {
    description: 'Scan for orphaned projections, stale branches, and unused artifacts',
    category: 'maintenance',
    priority: 0.7,
    workers: [{
        name: 'scan-orphans',
        fn: async (ctx = {}) => {
            const fs = require('fs');
            const path = require('path');
            const rootDir = ctx.rootDir || process.cwd();
            const orphans = [];
            const stalePatterns = ['*.bak', '*.log', '*.tmp', 'server.pid', '*.old'];

            logger.info('pruner-bee: scanning for orphaned files');
            const scanDir = (dir, depth = 0) => {
                if (depth > 4) return;
                try {
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        if (['node_modules', '.git', '_archive'].includes(entry.name)) continue;
                        const fullPath = path.join(dir, entry.name);
                        if (entry.isDirectory()) {
                            scanDir(fullPath, depth + 1);
                        } else if (stalePatterns.some(p => {
                            const ext = p.startsWith('*.') ? p.slice(1) : p;
                            return entry.name.endsWith(ext) || entry.name === p;
                        })) {
                            const stat = fs.statSync(fullPath);
                            orphans.push({
                                file: path.relative(rootDir, fullPath),
                                size: stat.size,
                                ageMs: Date.now() - stat.mtimeMs,
                                pattern: stalePatterns.find(p => entry.name.includes(p.replace('*', ''))),
                            });
                        }
                    }
                } catch { /* permission denied */ }
            };
            scanDir(rootDir);

            return {
                scanned: rootDir,
                orphanCount: orphans.length,
                totalOrphanBytes: orphans.reduce((s, o) => s + o.size, 0),
                orphans: orphans.slice(0, 50), // Cap at 50
                recommendation: orphans.length > 10 ? 'RUN_CLEANUP' : 'OK',
            };
        },
    }],
    persist: true,
});

// ═══════════════════════════════════════════════════════════════
// HeadyBee: tester-bee
// Runs health checks and latency tests against all projection endpoints
// ═══════════════════════════════════════════════════════════════
const testerBee = createBee('tester-bee', {
    description: 'Run health checks and latency tests against all projection endpoints',
    category: 'ops',
    priority: 0.8,
    workers: [{
        name: 'health-sweep',
        fn: async (ctx = {}) => {
            const endpoints = ctx.endpoints || [
                { name: 'cloud-run', url: 'https://heady-manager-609590223909.us-central1.run.app/health' },
                { name: 'edge', url: 'https://heady.headyme.com/health' },
                { name: 'local', url: 'http://localhost:8420/health' },
            ];

            logger.info(`tester-bee: sweeping ${endpoints.length} endpoints`);
            const results = await Promise.allSettled(
                endpoints.map(async (ep) => {
                    const start = Date.now();
                    try {
                        const res = await fetch(ep.url, { signal: AbortSignal.timeout(10000) });
                        const latency = Date.now() - start;
                        const body = res.headers.get('content-type')?.includes('json')
                            ? await res.json().catch(() => null)
                            : null;
                        return { ...ep, status: res.ok ? 'healthy' : 'degraded', statusCode: res.status, latency, body };
                    } catch (err) {
                        return { ...ep, status: 'down', error: err.message, latency: Date.now() - start };
                    }
                })
            );

            const healthResults = results.map(r => r.status === 'fulfilled' ? r.value : r.reason);
            const healthy = healthResults.filter(r => r.status === 'healthy').length;

            return {
                totalEndpoints: endpoints.length,
                healthy,
                degraded: healthResults.filter(r => r.status === 'degraded').length,
                down: healthResults.filter(r => r.status === 'down').length,
                avgLatencyMs: Math.round(healthResults.reduce((s, r) => s + (r.latency || 0), 0) / healthResults.length),
                results: healthResults,
                overallStatus: healthy === endpoints.length ? 'ALL_HEALTHY' : healthy > 0 ? 'PARTIAL' : 'ALL_DOWN',
            };
        },
    }],
    persist: true,
});

// ═══════════════════════════════════════════════════════════════
// HeadyBee: embedder-bee
// Processes text chunks through embedding pipeline on demand
// ═══════════════════════════════════════════════════════════════
const embedderBee = createBee('embedder-bee', {
    description: 'Process text chunks through embedding pipeline on demand',
    category: 'ops',
    priority: 0.9,
    workers: [{
        name: 'embed-chunks',
        fn: async (ctx = {}) => {
            const chunks = ctx.chunks || [];
            if (chunks.length === 0) return { embedded: 0, note: 'No chunks provided' };

            logger.info(`embedder-bee: embedding ${chunks.length} chunks`);

            let embedded = 0;
            let errors = 0;

            try {
                const embedder = require('../services/continuous-embedder');
                for (const chunk of chunks) {
                    const content = typeof chunk === 'string' ? chunk : chunk.content;
                    const metadata = typeof chunk === 'object' ? chunk.metadata : {};
                    const result = await embedder.ingest(content, {
                        ...metadata,
                        source: 'embedder-bee',
                        batchId: ctx.batchId || `batch-${Date.now()}`,
                    });
                    if (result.ok) embedded++;
                    else errors++;
                }
            } catch (err) {
                return { embedded, errors: errors + 1, error: err.message };
            }

            return { embedded, errors, total: chunks.length, batchId: ctx.batchId };
        },
    }, {
        name: 'get-health',
        fn: async () => {
            try {
                const embedder = require('../services/continuous-embedder');
                return embedder.getStats();
            } catch (err) {
                return { error: err.message };
            }
        },
    }],
    persist: true,
});

// ── Export all templates ─────────────────────────────────────
module.exports = {
    cloudRunDeployer,
    landingPageBuilder,
    valuationAnalyzer,
    audioOverviewGenerator,
    colabGpuRuntime,
    gcloudAuthAutomator,
    serviceConnectionRacer,
    fullCloudDeploySwarm,
    valuationReportSwarm,
    prunerBee,
    testerBee,
    embedderBee,
};

logger.info('Loaded 10 bee templates + 2 swarms from session-templates');
