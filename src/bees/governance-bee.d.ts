export const domain: "governance";
export const description: "Protected path audit, version sync, root hygiene, approval gates, policy engine, principles";
export const priority: 0.9;
export function getWork(ctx?: {}): ((() => Promise<{
    bee: string;
    action: string;
    ok: boolean;
    protectedPaths: any;
    hasCodeowners: boolean;
    patentClaims: any;
    error?: undefined;
} | {
    bee: string;
    action: string;
    ok: boolean;
    error: any;
    protectedPaths?: undefined;
    hasCodeowners?: undefined;
    patentClaims?: undefined;
}>) | (() => Promise<{
    bee: string;
    action: string;
    ok: boolean;
    packageVersion: any;
    readmeVersion: string;
    drift: string | null;
    error?: undefined;
} | {
    bee: string;
    action: string;
    ok: boolean;
    error: any;
    packageVersion?: undefined;
    readmeVersion?: undefined;
    drift?: undefined;
}>) | (() => Promise<{
    bee: string;
    action: string;
    ok: boolean;
    rootFileCount: number;
    threshold: number;
    warning: string | null;
    error?: undefined;
} | {
    bee: string;
    action: string;
    ok: boolean;
    error: any;
    rootFileCount?: undefined;
    threshold?: undefined;
    warning?: undefined;
}>) | (() => Promise<{
    bee: string;
    action: string;
    ok: boolean;
    managers: (string | false)[];
    conflict: string | null;
    error?: undefined;
} | {
    bee: string;
    action: string;
    ok: boolean;
    error: any;
    managers?: undefined;
    conflict?: undefined;
}>) | (() => Promise<{
    bee: string;
    action: string;
    loaded: boolean;
}>))[];
//# sourceMappingURL=governance-bee.d.ts.map