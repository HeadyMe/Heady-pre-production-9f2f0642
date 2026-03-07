export const domain: "health";
export const description: "Multi-domain health checks, service liveness probes, branding integrity, edge latency monitoring";
export const priority: 0.95;
export function getWork(ctx?: {}): (() => Promise<{
    bee: string;
    action: string;
    status: number;
    healthy: boolean;
    error?: undefined;
} | {
    bee: string;
    action: string;
    status: number;
    healthy: boolean;
    error: any;
}>)[];
export const HEADY_DOMAINS: string[];
export const INTERNAL_ENDPOINTS: {
    name: string;
    url: string;
}[];
//# sourceMappingURL=health-bee.d.ts.map