export function init(): void;
export function getProjectionMap(): {
    architecture: string;
    principle: string;
    totalTargets: number;
    lastGlobalProjection: null;
    tiers: {
        1: string;
        2: string;
        3: string;
    };
    targets: {};
};
export function probeProjection(targetId: any): Promise<any>;
export function probeAll(): Promise<{}>;
export function isStale(targetId: any, maxAgeMs?: number): boolean;
export function getStaleProjections(maxAgeMs?: number): {
    id: string;
    name: string;
    lastProjected: any;
    age: number | null;
}[];
export function markProjected(targetId: any, commitHash?: null): boolean;
export function registerRoutes(app: any): void;
export const PROJECTION_TARGETS: ({
    id: string;
    name: string;
    type: string;
    url: string;
    tier: number;
    autonomous: boolean;
    healthEndpoint?: undefined;
    org?: undefined;
    repo?: undefined;
} | {
    id: string;
    name: string;
    type: string;
    url: string;
    healthEndpoint: string;
    tier: number;
    autonomous: boolean;
    org?: undefined;
    repo?: undefined;
} | {
    id: string;
    name: string;
    type: string;
    url: string;
    org: string;
    repo: string;
    tier: number;
    autonomous: boolean;
    healthEndpoint?: undefined;
})[];
//# sourceMappingURL=vector-projection-engine.d.ts.map