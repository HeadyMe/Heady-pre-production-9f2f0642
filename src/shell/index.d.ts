/**
 * Boot the HeadyWeb shell:
 *   • Resolve which UI to show based on hostname
 *   • Load the corresponding micro-frontend
 *   • Mount into #heady-root
 */
export function bootShell(): Promise<void>;
export const REMOTE_REGISTRY: {
    antigravity: {
        url: string;
        scope: string;
        module: string;
    };
    landing: {
        url: string;
        scope: string;
        module: string;
    };
    'heady-ide': {
        url: string;
        scope: string;
        module: string;
    };
    'swarm-dashboard': {
        url: string;
        scope: string;
        module: string;
    };
    'governance-panel': {
        url: string;
        scope: string;
        module: string;
    };
    'projection-monitor': {
        url: string;
        scope: string;
        module: string;
    };
    'vector-explorer': {
        url: string;
        scope: string;
        module: string;
    };
};
export const SHELL_VERSION: "3.0.1";
//# sourceMappingURL=index.d.ts.map