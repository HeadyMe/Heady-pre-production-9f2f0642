/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const logger = require('../utils/logger');

const DEFAULT_CLOUD_PROVIDERS = [
    { id: 'gcp-colab-pro-plus-a', gpu: 'A100', gpuRamGb: 80 },
    { id: 'gcp-colab-pro-plus-b', gpu: 'L4', gpuRamGb: 24 },
    { id: 'gcp-colab-pro-plus-c', gpu: 'T4', gpuRamGb: 16 },
];

const STRAY_FILE_PATTERNS = [
    /\.bak$/i,
    /server\.pid$/i,
    /\.log$/i,
    /\.jsonl$/i,
    /deploy[-_].*\.log$/i,
    /service-worker\.js$/i,
    /sw\.js$/i,
];

const PROTECTED_WORKER_MARKERS = [
    'cloudflare/heady-edge-proxy/',
    'cloudflare/heady-edge-node/',
    'cloudflare/heady-manager-proxy/',
    'cloudflare/heady-cloudrun-failover/',
    'configs/cloudflare-workers/',
];

class LiquidUnifiedRuntime {
    constructor(config = {}) {
        this.config = {
            targetLatencyMs: 120,
            maxMicroservices: 12,
            projectionMode: 'cloud-only',
            cloudProviders: DEFAULT_CLOUD_PROVIDERS,
            repoRoot: process.cwd(),
            ...config,
        };

        this.capabilityMesh = new Map();
        this.templateReceipts = [];
        this.lastProjectionSnapshotAt = null;
        this.registerDefaultCapabilities();
    }

    registerDefaultCapabilities() {
        this.registerCapability('heady-conductor', {
            domain: 'orchestration',
            healthPath: '/api/heady-conductor/health',
            dependencies: ['headycloud-conductor', 'headyswarm', 'headybees'],
        });

        this.registerCapability('headycloud-conductor', {
            domain: 'projection',
            healthPath: '/api/headycloud-conductor/health',
            dependencies: ['vector-workspace', 'resource-scheduler', 'monorepo-projection'],
        });

        this.registerCapability('headyswarm', {
            domain: 'collective-intelligence',
            healthPath: '/api/headyswarm/health',
            dependencies: ['template-injection', 'ableton-live-bridge'],
        });

        this.registerCapability('headybees', {
            domain: 'worker-fabric',
            healthPath: '/api/headybees/health',
            dependencies: ['template-injection', 'headyswarm'],
        });

        this.registerCapability('template-injection', {
            domain: 'vector-fabric',
            healthPath: '/api/template-injection/health',
            dependencies: ['vector-workspace', 'headybees', 'headyswarm'],
        });

        this.registerCapability('ableton-live-bridge', {
            domain: 'realtime-media',
            healthPath: '/api/ableton-live-bridge/health',
            dependencies: ['midi-event-fabric'],
        });
    }

    registerCapability(name, descriptor) {
        this.capabilityMesh.set(name, {
            name,
            status: 'ready',
            updatedAt: new Date().toISOString(),
            ...descriptor,
        });
    }

    getCapabilityHealth(name) {
        const capability = this.capabilityMesh.get(name);
        if (!capability) {
            return { ok: false, module: name, status: 'not-found' };
        }
        return {
            ok: true,
            module: name,
            domain: capability.domain,
            status: capability.status,
            dependencies: capability.dependencies || [],
            updatedAt: capability.updatedAt,
        };
    }

    optimizeMicroserviceFootprint() {
        const capabilities = Array.from(this.capabilityMesh.values());
        const byDomain = capabilities.reduce((acc, capability) => {
            acc[capability.domain] = (acc[capability.domain] || 0) + 1;
            return acc;
        }, {});

        const recommendedCount = Math.min(
            Math.max(Object.keys(byDomain).length + 2, 6),
            this.config.maxMicroservices,
        );

        return {
            strategy: 'liquid-unified-capability-mesh',
            currentCapabilityCount: capabilities.length,
            recommendedMicroserviceCount: recommendedCount,
            decomposedByDomain: byDomain,
            unifiedPlane: true,
            paradigm: {
                frontendBackendSplit: false,
                interfaceDelivery: 'projected-ui-runtime',
                serviceDelivery: 'dynamic-connectors-and-services',
            },
        };
    }

    injectTemplateFrom3DWorkspace(payload) {
        const receipt = {
            id: `tpl_${Date.now()}`,
            workspaceVectorId: payload.workspaceVectorId,
            target: payload.target,
            templateName: payload.templateName,
            projectedAt: new Date().toISOString(),
            status: 'applied',
            orchestration: {
                source: '3d-vector-workspace',
                destination: payload.target,
                path: ['vector-workspace', 'headybees', 'headyswarm', 'heady-conductor'],
            },
        };

        this.templateReceipts.push(receipt);
        logger.logNodeActivity('CONDUCTOR', '3D template injected into autonomous fabric', {
            templateName: payload.templateName,
            target: payload.target,
        });

        return {
            ok: true,
            receipt,
            orchestrationPath: receipt.orchestration.path,
        };
    }

    buildDynamicExperience(request = {}) {
        const deploymentPlan = {
            appId: request.appId || `app_${Date.now()}`,
            capabilities: request.capabilities || ['ui-composer', 'connector-fabric', 'service-autobuilder'],
            provisionMode: this.config.projectionMode,
            localResourceUsage: 'minimal',
            delivery: {
                rendering: 'cloud-projected',
                dataPlane: 'instantaneous-event-fabric',
                sourceOfTruth: 'github-monorepo-projection',
            },
            cloudExecution: {
                providers: this.config.cloudProviders,
                allocation: this.allocateGpuResources(request.gpuIntensity || 'balanced'),
            },
        };

        return {
            ok: true,
            deploymentPlan,
            topology: this.optimizeMicroserviceFootprint(),
        };
    }

    allocateGpuResources(gpuIntensity) {
        const factorByIntensity = {
            low: 0.35,
            balanced: 0.65,
            max: 0.9,
        };

        const factor = factorByIntensity[gpuIntensity] || factorByIntensity.balanced;
        return this.config.cloudProviders.map((provider) => ({
            provider: provider.id,
            gpu: provider.gpu,
            gpuRamGb: provider.gpuRamGb,
            reservedGpuRamGb: Math.max(4, Math.round(provider.gpuRamGb * factor)),
        }));
    }

    health() {
        return {
            ok: true,
            module: 'liquid-runtime',
            timestamp: new Date().toISOString(),
            projectionMode: this.config.projectionMode,
            capabilityCount: this.capabilityMesh.size,
            lastProjectionSnapshotAt: this.lastProjectionSnapshotAt,
        };
    }

    getUnifiedProjectionSnapshot() {
        this.lastProjectionSnapshotAt = new Date().toISOString();
        return {
            ok: true,
            snapshotAt: this.lastProjectionSnapshotAt,
            monorepoSourceOfTruth: true,
            topology: this.optimizeMicroserviceFootprint(),
            runtime: this.runtimeStatus(),
        };
    }

    reconcileRepositoryProjection({ apply = false } = {}) {
        const untracked = this.getUntrackedFiles();
        const candidates = untracked.filter((file) => this.isStrayFile(file));
        const cleaned = [];

        if (apply) {
            for (const file of candidates) {
                const fullPath = path.join(this.config.repoRoot, file);
                if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                    fs.unlinkSync(fullPath);
                    cleaned.push(file);
                }
            }
        }

        return {
            ok: true,
            apply,
            candidates,
            cleaned,
            guidance: 'Tracked files are preserved. Use this reconciliation for untracked runtime artifacts only.',
        };
    }

    getUntrackedFiles() {
        try {
            const output = execSync('git ls-files --others --exclude-standard', {
                cwd: this.config.repoRoot,
                encoding: 'utf8',
            });
            return output.split('\n').map((v) => v.trim()).filter(Boolean);
        } catch (_error) {
            return [];
        }
    }

    isStrayFile(filePath) {
        if (PROTECTED_WORKER_MARKERS.some((marker) => filePath.includes(marker))) {
            return false;
        }
        return STRAY_FILE_PATTERNS.some((pattern) => pattern.test(filePath));
    }

    runtimeStatus() {
        return {
            mode: 'unified-autonomous-liquid-runtime',
            projectionMode: this.config.projectionMode,
            targetLatencyMs: this.config.targetLatencyMs,
            capabilities: Array.from(this.capabilityMesh.values()),
            templateReceipts: this.templateReceipts.slice(-5),
            microserviceOptimization: this.optimizeMicroserviceFootprint(),
        };
    }
}

let singleton = null;

function getLiquidUnifiedRuntime(config) {
    if (!singleton) {
        singleton = new LiquidUnifiedRuntime(config);
    }
    return singleton;
}

function registerLiquidUnifiedRuntimeRoutes(app) {
    const runtime = getLiquidUnifiedRuntime();

    app.get('/api/liquid-runtime/health', (_req, res) => {
        res.json(runtime.health());
    });

    app.get('/api/liquid-runtime/status', (_req, res) => {
        res.json({ ok: true, runtime: runtime.runtimeStatus() });
    });

    app.get('/api/liquid-runtime/projection-snapshot', (_req, res) => {
        res.json(runtime.getUnifiedProjectionSnapshot());
    });

    app.post('/api/liquid-runtime/template-injection', (req, res) => {
        const { workspaceVectorId, templateName, target } = req.body || {};
        if (!workspaceVectorId || !templateName || !target) {
            return res.status(400).json({
                ok: false,
                error: 'workspaceVectorId, templateName, and target are required',
            });
        }
        return res.json(runtime.injectTemplateFrom3DWorkspace({ workspaceVectorId, templateName, target }));
    });

    app.post('/api/liquid-runtime/dynamic-experience', (req, res) => {
        res.json(runtime.buildDynamicExperience(req.body || {}));
    });

    app.post('/api/liquid-runtime/reconcile-projection', (req, res) => {
        const apply = Boolean(req.body?.apply);
        res.json(runtime.reconcileRepositoryProjection({ apply }));
    });

    logger.logNodeActivity('CONDUCTOR', '    → Endpoints: /api/liquid-runtime/health, /status, /projection-snapshot, /template-injection, /dynamic-experience, /reconcile-projection');

    return runtime;
}

module.exports = {
    LiquidUnifiedRuntime,
    getLiquidUnifiedRuntime,
    registerLiquidUnifiedRuntimeRoutes,
};
