/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

const _logger = require("../utils/logger");

// Safe wrapper — service-routes.js uses logNodeActivity but standalone logger uses .info
const logger = {
    logNodeActivity: _logger.logNodeActivity || ((_node, msg, meta) => _logger.info(`[${_node}] ${msg}`, meta || {})),
};

const DEFAULT_TOPICS = {
    standard: process.env.HEADY_SWARM_TASK_TOPIC || "heady-swarm-tasks",
    admin: process.env.HEADY_ADMIN_TRIGGER_TOPIC || "heady-admin-triggers",
};

const DEFAULT_GODBEE_PROFILE = {
    cpu: "4000m",
    memory: "4Gi",
    timeoutSec: 1200,
    retries: 2,
};

const DEFAULT_HEARTBEAT_JOBS = [
    {
        id: "hourly-testerbee",
        schedule: "0 * * * *",
        lane: "standard",
        task: "simulate_module_federation_traffic",
        remediationMode: "ast-auto-patch",
    },
    {
        id: "nightly-prunerbee",
        schedule: "0 2 * * *",
        lane: "standard",
        task: "prune_unused_projections",
        remediationMode: "safe-prune",
    },
];

class LiquidAutonomyController {
    constructor() {
        this.startedAt = Date.now();
        this.triggerHistory = [];
        this.heartbeatHistory = [];
        this.topicConfig = DEFAULT_TOPICS;
    }

    enqueueAdminTrigger(payload = {}) {
        const trigger = {
            id: `admin-${Date.now()}`,
            lane: "full-throttle-auto-success",
            topic: this.topicConfig.admin,
            requestedBy: payload.requestedBy || "owner",
            source: payload.source || "heady-ide",
            command: payload.command || "unspecified",
            constraints: {
                removeStandardResourceLimits: true,
                godBeeProfile: { ...DEFAULT_GODBEE_PROFILE },
                governanceResolutionMode: "recursive-ast-rewrite-until-green",
            },
            projection: {
                destination: "github-monorepo",
                strategy: "master-agent-forced-success",
            },
            ts: new Date().toISOString(),
        };

        this.triggerHistory.push(trigger);
        if (this.triggerHistory.length > 500) {
            this.triggerHistory.splice(0, this.triggerHistory.length - 500);
        }

        logger.logNodeActivity("CONDUCTOR", "Admin trigger queued in full-throttle lane", {
            id: trigger.id,
            topic: trigger.topic,
            source: trigger.source,
            command: trigger.command,
        });

        return trigger;
    }

    runHeartbeatJob(jobId) {
        const job = DEFAULT_HEARTBEAT_JOBS.find((item) => item.id === jobId);
        if (!job) return null;

        const execution = {
            id: `hb-${Date.now()}`,
            jobId: job.id,
            topic: this.topicConfig.standard,
            task: job.task,
            lane: job.lane,
            remediationMode: job.remediationMode,
            status: "dispatched",
            ts: new Date().toISOString(),
        };

        this.heartbeatHistory.push(execution);
        if (this.heartbeatHistory.length > 500) {
            this.heartbeatHistory.splice(0, this.heartbeatHistory.length - 500);
        }

        logger.logNodeActivity("CONDUCTOR", "Autonomous heartbeat job dispatched", {
            jobId: execution.jobId,
            task: execution.task,
            topic: execution.topic,
        });

        return execution;
    }

    getBlueprint() {
        return {
            dualPipelines: {
                adminGodMode: {
                    topic: this.topicConfig.admin,
                    lane: "full-throttle-auto-success",
                    orchestratorResourceProfile: DEFAULT_GODBEE_PROFILE,
                    autoSuccessResolver: "master-agent-recursive-ast-rewrite",
                },
                backgroundHeartbeat: {
                    topic: this.topicConfig.standard,
                    jobs: DEFAULT_HEARTBEAT_JOBS,
                    scheduler: "google-cloud-scheduler",
                },
            },
            integrations: {
                terraformPath: "infrastructure/terraform/main.tf",
                maxForLiveReceiverPath: "integrations/max-for-live/heady_sysex_receiver.js",
                maxForLiveManufacturerId: "0x7D",
            },
            ts: new Date().toISOString(),
        };
    }

    health() {
        return {
            status: "ACTIVE",
            service: "liquid-autonomy-controller",
            uptimeSec: Math.floor((Date.now() - this.startedAt) / 1000),
            topics: this.topicConfig,
            heartbeatsConfigured: DEFAULT_HEARTBEAT_JOBS.length,
            recentAdminTriggers: this.triggerHistory.slice(-5),
            recentHeartbeats: this.heartbeatHistory.slice(-5),
            ts: new Date().toISOString(),
        };
    }
}

module.exports = new LiquidAutonomyController();
