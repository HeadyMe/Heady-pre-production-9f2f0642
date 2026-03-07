export function projectDomain(domain: any, options?: {}): Promise<{
    domain: any;
    repo: any;
    fileCount: number;
    files: string[];
    dryRun: boolean;
} | {
    projectedAt: string;
    repo: any;
    commitSha: any;
    filesCount: number;
    treeItems: number;
    domain: any;
    fileCount?: undefined;
    files?: undefined;
    dryRun?: undefined;
}>;
export function projectAll(options?: {}): Promise<{
    domains: {};
    startedAt: string;
    completedAt: null;
    totalFiles: number;
    totalRepos: number;
    errors: never[];
}>;
export function registerRoutes(app: any): void;
import { REPO_MAP } from "./domain-slicer";
export { REPO_MAP };
//# sourceMappingURL=public-projection-pipeline.d.ts.map