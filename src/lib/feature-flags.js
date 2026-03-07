/**
 * E7: Feature Flags for Agent Routing
 * Lightweight feature flag system for agent version routing, canary deploys, and A/B testing.
 * @module src/lib/feature-flags
 */
'use strict';

const FLAGS = {
    'agent-v2': { enabled: false, rollout: 0, description: 'Route to v2 agent orchestrator' },
    'canary-deploy': { enabled: false, rollout: 5, description: 'Canary deployment (5% traffic)' },
    'mcp-gateway-v2': { enabled: false, rollout: 0, description: 'MCP gateway v2 with circuit breakers' },
    'otel-traces': { enabled: true, rollout: 100, description: 'OpenTelemetry tracing' },
    'audit-logging': { enabled: true, rollout: 100, description: 'Immutable audit log' },
    'prompt-guard': { enabled: true, rollout: 100, description: 'Prompt injection defense' },
    'eval-pipeline': { enabled: false, rollout: 0, description: 'LLM-as-judge eval pipeline in CI' },
    'swarm-dashboard': { enabled: false, rollout: 0, description: 'Swarm optimization dashboard' },
    'edge-runtime': { enabled: false, rollout: 0, description: 'Edge agent runtime (Durable Objects)' },
    'worker-threads': { enabled: false, rollout: 0, description: 'Piscina worker threads for embeddings' },
};

// Override from env: HEADY_FLAG_AGENT_V2=true
Object.keys(FLAGS).forEach(key => {
    const envKey = `HEADY_FLAG_${key.toUpperCase().replace(/-/g, '_')}`;
    if (process.env[envKey] !== undefined) {
        FLAGS[key].enabled = process.env[envKey] === 'true';
        FLAGS[key].rollout = FLAGS[key].enabled ? 100 : 0;
    }
});

function isEnabled(flagName, userId) {
    const flag = FLAGS[flagName];
    if (!flag) return false;
    if (!flag.enabled) return false;
    if (flag.rollout >= 100) return true;
    if (!userId) return false;
    // Deterministic hash-based rollout
    const hash = Array.from(String(userId)).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
    return (Math.abs(hash) % 100) < flag.rollout;
}

function setFlag(flagName, enabled, rollout) {
    if (FLAGS[flagName]) {
        FLAGS[flagName].enabled = enabled;
        if (rollout !== undefined) FLAGS[flagName].rollout = rollout;
    }
}

function getAllFlags() { return { ...FLAGS }; }

function flagMiddleware(flagName) {
    return (req, res, next) => {
        req.featureFlags = req.featureFlags || {};
        req.featureFlags[flagName] = isEnabled(flagName, req.user?.id || req.headers['x-user-id']);
        next();
    };
}

module.exports = { isEnabled, setFlag, getAllFlags, flagMiddleware, FLAGS };
