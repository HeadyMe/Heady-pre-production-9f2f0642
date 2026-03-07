export const domain: "security";
export const description: "Patent lock, credential scan, gitignore audit, auth, governance, PQC, RBAC, secret rotation";
export const priority: 1;
export function getWork(ctx?: {}): ((() => Promise<{
    bee: string;
    action: string;
    ok: any;
    files: any;
    composite: string;
    error?: undefined;
} | {
    bee: string;
    action: string;
    ok: boolean;
    error: any;
    files?: undefined;
    composite?: undefined;
}>) | (() => Promise<{
    bee: string;
    action: string;
    ok: boolean;
    claims: number;
    violations: {
        file: any;
        claim: any;
        issue: string;
    }[];
    error?: undefined;
} | {
    bee: string;
    action: string;
    ok: boolean;
    error: any;
    claims?: undefined;
    violations?: undefined;
}>) | (() => Promise<{
    bee: string;
    action: string;
    ok: boolean;
    exposed: string[];
}>) | (() => Promise<{
    bee: string;
    action: string;
    ok: boolean;
    missing: string[];
    totalLines: number;
    error?: undefined;
} | {
    bee: string;
    action: string;
    ok: boolean;
    error: any;
    missing?: undefined;
    totalLines?: undefined;
}>) | (() => Promise<{
    bee: string;
    action: string;
    loaded: boolean;
}>))[];
//# sourceMappingURL=security-bee.d.ts.map