export const domain: "device-provisioner";
export const description: "Cross-platform device provisioning, filesystem auth, and mod installation via swarm";
export const priority: 0.85;
export function getWork(ctx?: {}): ((() => Promise<{
    bee: string;
    action: string;
    device: {
        platform: NodeJS.Platform;
        arch: NodeJS.Architecture;
        release: string;
        hostname: string;
        homedir: string;
        deviceType: string;
        memory: {
            total: number;
            free: number;
            usagePercent: string;
        };
        cpus: number;
        timestamp: string;
    };
}>) | (() => Promise<{
    bee: string;
    action: string;
    scope: string;
    code: string;
}>) | (() => Promise<{
    bee: string;
    action: string;
    manifest: {
        version: string;
        components: {
            name: string;
            path: string;
            status: string;
        }[];
        installedAt: string;
        device: string;
    };
}>) | (() => Promise<{
    bee: string;
    action: string;
    autoEnabled: string[];
    available: string[];
    totalMods: number;
}>) | (() => Promise<{
    bee: string;
    action: string;
    health: {
        version: string;
        device: string;
        platform: NodeJS.Platform;
        arch: NodeJS.Architecture;
        memory: {
            total: number;
            free: number;
            usagePercent: string;
        };
        cpus: number;
        buddyReady: boolean;
        fsAuthReady: boolean;
        modsReady: boolean;
        swarmConnected: boolean;
        vectorMemoryReady: boolean;
        timestamp: string;
    };
}>))[];
export function detectPlatform(): {
    platform: NodeJS.Platform;
    arch: NodeJS.Architecture;
    release: string;
    hostname: string;
    homedir: string;
    deviceType: string;
    memory: {
        total: number;
        free: number;
        usagePercent: string;
    };
    cpus: number;
    timestamp: string;
};
export function generateFsAuthToken(device: any, scope?: string): {
    tokenHash: string;
    authorizationCode: string;
    deviceId: string;
    scope: string;
    grantedPaths: string[];
    permissions: string[];
    issuedAt: string;
    expiresAt: string;
    version: string;
    phiEntropy: number;
};
export const BUILT_IN_MODS: ({
    id: string;
    name: string;
    version: string;
    type: string;
    description: string;
    size: string;
    installPath: string;
    autoEnable: boolean;
    platformFilter?: undefined;
} | {
    id: string;
    name: string;
    version: string;
    type: string;
    description: string;
    size: string;
    installPath: string;
    autoEnable: boolean;
    platformFilter: string[];
})[];
//# sourceMappingURL=device-provisioner-bee.d.ts.map