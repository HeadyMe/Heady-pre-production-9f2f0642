export class ProjectHistoryIngestor {
    constructor(learner: any);
    learner: any;
    stats: {
        commits: number;
        files: number;
        docs: number;
        patterns: number;
    };
    /**
     * Ingest everything — called once on bridge startup.
     */
    ingestAll(): Promise<{
        commits: number;
        files: number;
        docs: number;
        patterns: number;
    }>;
    /**
     * Embed all git commits as vectors.
     */
    _ingestCommits(): void;
    /**
     * Embed file structure with role annotations.
     */
    _ingestFileStructure(): void;
    /**
     * Embed key architecture docs.
     */
    _ingestArchitectureDocs(): void;
    /**
     * Embed known architectural patterns and relationships.
     */
    _ingestPatterns(): void;
    /**
     * Embed branch history.
     */
    _ingestBranches(): void;
}
//# sourceMappingURL=project-history-ingestor.d.ts.map