export const domain: "vector-ops";
export const description: "Vector space internal operations + deployment gate \u2014 anti-sprawl, security, maintenance, deploy";
export const priority: 1;
export function getWork(ctx?: {}): ((() => Promise<{
    bee: string;
    action: string;
    healthy: any;
    totalVectors: any;
    zones: any;
    status: string;
}>) | (() => Promise<{
    bee: string;
    action: string;
    sprawlDetected: any;
    alerts: any;
    details: any;
}>) | (() => Promise<{
    bee: string;
    action: string;
    healthy: any;
    threats: any;
    details: any;
}>) | (() => Promise<{
    bee: string;
    action: string;
    compacted: any;
    pruned: any;
    zonesRebalanced: any;
}>) | (() => Promise<{
    bee: string;
    action: string;
    started: any;
    cycles: any;
    sprawlAlerts: any;
    securityThreats: any;
}>) | (() => Promise<{
    bee: string;
    action: string;
    deploymentAllowed: any;
    blockers: any;
    warnings: any;
    message: string;
}>) | (() => Promise<{
    bee: string;
    action: string;
    totalVectors: any;
    shards: any;
    graphEdges: any;
    zones: any;
    ingestRate: any;
    queryRate: any;
}>) | (() => Promise<{
    bee: string;
    action: string;
    domain: string;
    reachable: boolean;
    status: string | number;
}>))[];
//# sourceMappingURL=vector-ops-bee.d.ts.map