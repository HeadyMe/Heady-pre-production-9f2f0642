/**
 * ═══════════════════════════════════════════════════════════════
 * ORCH-002: Kubernetes HeadyApp CRD + Operator
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * ═══════════════════════════════════════════════════════════════
 *
 * Custom Resource Definition for HeadyApp workloads and a simple
 * operator that reconciles desired state.
 */

'use strict';

/**
 * HeadyApp CRD Schema
 */
const CRDSchema = {
    apiVersion: 'heady.systems/v1alpha1',
    kind: 'HeadyApp',
    metadata: {
        name: 'heady-app-crd',
        labels: {
            'app.kubernetes.io/part-of': 'heady-os',
            'app.kubernetes.io/managed-by': 'heady-operator',
        },
    },
    spec: {
        group: 'heady.systems',
        versions: [{
            name: 'v1alpha1',
            served: true,
            storage: true,
            schema: {
                openAPIV3Schema: {
                    type: 'object',
                    properties: {
                        spec: {
                            type: 'object',
                            properties: {
                                role: { type: 'string', enum: ['manager', 'worker', 'mcp', 'probe', 'gateway', 'buddy', 'web'] },
                                replicas: { type: 'integer', minimum: 1, maximum: 50 },
                                image: { type: 'string' },
                                resources: {
                                    type: 'object',
                                    properties: {
                                        cpu: { type: 'string', default: '1' },
                                        memory: { type: 'string', default: '512Mi' },
                                        gpu: { type: 'boolean', default: false },
                                    },
                                },
                                autoScale: {
                                    type: 'object',
                                    properties: {
                                        enabled: { type: 'boolean', default: true },
                                        minReplicas: { type: 'integer', default: 1 },
                                        maxReplicas: { type: 'integer', default: 10 },
                                        targetCPU: { type: 'integer', default: 70 },
                                    },
                                },
                                morphable: { type: 'boolean', default: true },
                                healthProbe: {
                                    type: 'object',
                                    properties: {
                                        path: { type: 'string', default: '/health/live' },
                                        interval: { type: 'integer', default: 10 },
                                        timeout: { type: 'integer', default: 5 },
                                    },
                                },
                            },
                            required: ['role', 'image'],
                        },
                        status: {
                            type: 'object',
                            properties: {
                                phase: { type: 'string' },
                                readyReplicas: { type: 'integer' },
                                lastReconciled: { type: 'string' },
                                conditions: { type: 'array', items: { type: 'object' } },
                            },
                        },
                    },
                },
            },
        }],
        scope: 'Namespaced',
        names: {
            plural: 'headyapps',
            singular: 'headyapp',
            kind: 'HeadyApp',
            shortNames: ['ha'],
        },
    },
};

/**
 * Simple Operator — reconciles HeadyApp CRDs
 */
class HeadyOperator {
    constructor(options = {}) {
        this.namespace = options.namespace || 'heady';
        this.reconcileInterval = options.reconcileInterval || 30000;
        this.managedApps = new Map();
    }

    /**
     * Reconcile a HeadyApp resource
     */
    async reconcile(resource) {
        const { metadata, spec } = resource;
        const name = metadata.name;

        console.log(`[Operator] Reconciling: ${name} (role=${spec.role}, replicas=${spec.replicas || 1})`);

        const current = this.managedApps.get(name);
        const desired = {
            role: spec.role,
            replicas: spec.replicas || 1,
            image: spec.image,
            resources: spec.resources || { cpu: '1', memory: '512Mi' },
            autoScale: spec.autoScale || { enabled: true, minReplicas: 1, maxReplicas: 10 },
        };

        if (!current) {
            // Create new deployment
            await this._createDeployment(name, desired);
        } else if (this._hasChanged(current, desired)) {
            // Update existing deployment
            await this._updateDeployment(name, current, desired);
        } else {
            console.log(`[Operator] ${name}: No changes needed`);
        }

        // Update managed state
        this.managedApps.set(name, {
            ...desired,
            status: 'Running',
            lastReconciled: new Date().toISOString(),
        });

        return {
            name,
            status: 'Reconciled',
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Generate K8s YAML for a HeadyApp
     */
    generateYAML(appConfig) {
        return `apiVersion: heady.systems/v1alpha1
kind: HeadyApp
metadata:
  name: ${appConfig.name}
  namespace: ${this.namespace}
  labels:
    heady.systems/role: ${appConfig.role}
spec:
  role: ${appConfig.role}
  replicas: ${appConfig.replicas || 1}
  image: ${appConfig.image || 'gcr.io/heady-production/heady-universal:latest'}
  resources:
    cpu: "${appConfig.cpu || '2'}"
    memory: "${appConfig.memory || '1Gi'}"
    gpu: ${appConfig.gpu || false}
  autoScale:
    enabled: true
    minReplicas: ${appConfig.minReplicas || 1}
    maxReplicas: ${appConfig.maxReplicas || 10}
    targetCPU: 70
  morphable: true
  healthProbe:
    path: /health/live
    interval: 10
    timeout: 5
`;
    }

    async _createDeployment(name, desired) {
        console.log(`[Operator] Creating deployment: ${name}`);
        // In production: kubectl apply
    }

    async _updateDeployment(name, current, desired) {
        console.log(`[Operator] Updating deployment: ${name}`);
        // In production: kubectl apply --strategic-merge-patch
    }

    _hasChanged(current, desired) {
        return JSON.stringify(current) !== JSON.stringify(desired);
    }

    /**
     * Get status of all managed apps
     */
    status() {
        return Array.from(this.managedApps.entries()).map(([name, app]) => ({
            name,
            role: app.role,
            replicas: app.replicas,
            status: app.status,
            lastReconciled: app.lastReconciled,
        }));
    }
}

if (require.main === module) {
    const operator = new HeadyOperator();

    console.log('═══ Heady K8s Operator ═══\n');

    // Demo: reconcile sample apps
    const apps = [
        { apiVersion: 'heady.systems/v1alpha1', kind: 'HeadyApp', metadata: { name: 'heady-manager' }, spec: { role: 'manager', replicas: 2, image: 'gcr.io/heady-production/heady-universal:latest' } },
        { apiVersion: 'heady.systems/v1alpha1', kind: 'HeadyApp', metadata: { name: 'heady-mcp' }, spec: { role: 'mcp', replicas: 3, image: 'gcr.io/heady-production/heady-universal:latest' } },
        { apiVersion: 'heady.systems/v1alpha1', kind: 'HeadyApp', metadata: { name: 'heady-worker' }, spec: { role: 'worker', replicas: 5, image: 'gcr.io/heady-production/heady-universal:latest' } },
    ];

    Promise.all(apps.map(a => operator.reconcile(a))).then(() => {
        console.log('\nYAML Example:');
        console.log(operator.generateYAML({ name: 'heady-manager', role: 'manager', replicas: 2 }));
        console.log('Status:', operator.status());
        console.log('✅ K8s Operator operational');
    });
}

module.exports = { HeadyOperator, CRDSchema };
