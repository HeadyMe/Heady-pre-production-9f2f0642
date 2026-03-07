export const secretsManager: SecretsManager;
/**
 * Register Express routes for secrets management.
 */
export function registerSecretsRoutes(app: any): void;
export class SecretsManager {
    _secrets: Map<any, any>;
    _rotationLog: any[];
    /**
     * Register a secret for tracking.
     */
    register({ id, name, envVar, source, tags, dependents }: {
        id: any;
        name: any;
        envVar: any;
        source?: string | undefined;
        tags?: never[] | undefined;
        dependents?: never[] | undefined;
    }): void;
    /**
     * Get all tracked secrets.
     */
    getAll(): any[];
    /**
     * Get a summary for dashboards.
     */
    getSummary(): {
        total: number;
        present: number;
        missing: number;
        sources: any[];
    };
    /**
     * Get a specific secret's metadata (never the raw value).
     */
    get(id: any): any;
    /**
     * Mark a secret as rotated.
     */
    rotate(id: any): boolean;
    /**
     * Audit all secrets for expiration/warnings.
     */
    audit(): {
        total: number;
        expired: any[];
        warning: any[];
        healthy: number;
        score: number;
    };
    /**
     * Persist state to disk.
     */
    saveState(): void;
    /**
     * Restore state from disk.
     */
    restoreState(): void;
}
//# sourceMappingURL=hc_secrets_manager.d.ts.map