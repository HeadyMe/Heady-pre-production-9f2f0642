export function isEnabled(flagName: any, userId: any): boolean;
export function setFlag(flagName: any, enabled: any, rollout: any): void;
export function getAllFlags(): {
    'agent-v2': {
        enabled: boolean;
        rollout: number;
        description: string;
    };
    'canary-deploy': {
        enabled: boolean;
        rollout: number;
        description: string;
    };
    'mcp-gateway-v2': {
        enabled: boolean;
        rollout: number;
        description: string;
    };
    'otel-traces': {
        enabled: boolean;
        rollout: number;
        description: string;
    };
    'audit-logging': {
        enabled: boolean;
        rollout: number;
        description: string;
    };
    'prompt-guard': {
        enabled: boolean;
        rollout: number;
        description: string;
    };
    'eval-pipeline': {
        enabled: boolean;
        rollout: number;
        description: string;
    };
    'swarm-dashboard': {
        enabled: boolean;
        rollout: number;
        description: string;
    };
    'edge-runtime': {
        enabled: boolean;
        rollout: number;
        description: string;
    };
    'worker-threads': {
        enabled: boolean;
        rollout: number;
        description: string;
    };
};
export function flagMiddleware(flagName: any): (req: any, res: any, next: any) => void;
export const FLAGS: {
    'agent-v2': {
        enabled: boolean;
        rollout: number;
        description: string;
    };
    'canary-deploy': {
        enabled: boolean;
        rollout: number;
        description: string;
    };
    'mcp-gateway-v2': {
        enabled: boolean;
        rollout: number;
        description: string;
    };
    'otel-traces': {
        enabled: boolean;
        rollout: number;
        description: string;
    };
    'audit-logging': {
        enabled: boolean;
        rollout: number;
        description: string;
    };
    'prompt-guard': {
        enabled: boolean;
        rollout: number;
        description: string;
    };
    'eval-pipeline': {
        enabled: boolean;
        rollout: number;
        description: string;
    };
    'swarm-dashboard': {
        enabled: boolean;
        rollout: number;
        description: string;
    };
    'edge-runtime': {
        enabled: boolean;
        rollout: number;
        description: string;
    };
    'worker-threads': {
        enabled: boolean;
        rollout: number;
        description: string;
    };
};
//# sourceMappingURL=feature-flags.d.ts.map