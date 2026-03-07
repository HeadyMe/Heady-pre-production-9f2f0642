export class LiquidDeploy extends EventEmitter<[never]> {
    /**
     * @param {object} opts
     * @param {object}  [opts.kv]              - HeadyKV for deployment state
     * @param {object}  [opts.governance]      - Governance module for approval gates
     * @param {boolean} [opts.requireApproval] - Require governance sign-off
     * @param {number}  [opts.timeoutMs=60000] - Max deploy time
     */
    constructor(opts?: {
        kv?: object | undefined;
        governance?: object | undefined;
        requireApproval?: boolean | undefined;
        timeoutMs?: number | undefined;
    });
    _kv: any;
    _governance: object | null;
    requireApproval: boolean;
    timeoutMs: number;
    /**
     * Project latent-space source repo to a physical target repo.
     *
     * @param {string|object} sourceRepo  - Source repo spec (url or { url, branch, path })
     * @param {string|object} targetRepo  - Target repo spec (url or { url, branch, path })
     * @param {object} [opts]
     * @param {string}   [opts.commitMessage]
     * @param {object}   [opts.env]              - Environment variables to inject
     * @param {boolean}  [opts.dryRun=false]
     * @returns {Promise<DeployRecord>}
     */
    project(sourceRepo: string | object, targetRepo: string | object, opts?: {
        commitMessage?: string | undefined;
        env?: object | undefined;
        dryRun?: boolean | undefined;
    }): Promise<DeployRecord>;
    /**
     * Validate that a target deployment matches the expected source.
     * @param {string|object} target
     * @param {object} [opts]  - { deployId, expectedSha }
     * @returns {Promise<{ valid, reason, details }>}
     */
    validateProjection(target: string | object, opts?: object): Promise<{
        valid: any;
        reason: any;
        details: any;
    }>;
    /**
     * Rollback a deployment to the previous state.
     * @param {string} deployId
     * @returns {Promise<DeployRecord>}
     */
    rollback(deployId: string): Promise<DeployRecord>;
    getDeployment(deployId: any): Promise<any>;
    listDeployments(filter?: {}): Promise<any>;
    _validateSource(src: any): Promise<{
        valid: boolean;
        reason: string;
    } | {
        valid: boolean;
        reason?: undefined;
    }>;
    _executeProjection(src: any, tgt: any, opts: any): Promise<{
        sha: string;
        dryRun: boolean;
    } | {
        sha: string;
        dryRun?: undefined;
    }>;
    _checkReachable(url: any): Promise<any>;
    _getRepoHead(repo: any): Promise<string>;
    _requestApproval(record: any): Promise<any>;
    _findPreviousSuccessful(target: any, excludeDeployId: any): Promise<any>;
    _persistRecord(record: any): Promise<void>;
    _loadRecord(deployId: any): Promise<any>;
}
export const DEPLOY_STATUS: Readonly<{
    PENDING: "pending";
    VALIDATING: "validating";
    PROJECTING: "projecting";
    DEPLOYED: "deployed";
    ROLLED_BACK: "rolled-back";
    FAILED: "failed";
    APPROVED: "approved";
    AWAITING_APPROVAL: "awaiting-approval";
}>;
import { EventEmitter } from "events";
//# sourceMappingURL=liquid-deploy.d.ts.map