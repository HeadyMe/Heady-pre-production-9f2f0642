/**
 * Full authorization gate for a code change request.
 * @param {object} opts
 * @param {string} opts.email - Git committer email
 * @param {string} [opts.agentId] - Agent identifier (if agent-initiated)
 * @param {string[]} [opts.files] - Files being changed
 * @param {string} [opts.devToken] - HEADY_DEV_TOKEN for agent auth
 * @returns {{ authorized: boolean, reason: string, protectedFiles: string[] }}
 */
export function authorize(opts?: {
    email: string;
    agentId?: string | undefined;
    files?: string[] | undefined;
    devToken?: string | undefined;
}): {
    authorized: boolean;
    reason: string;
    protectedFiles: string[];
};
/**
 * Check if a developer email is approved.
 * @param {string} email - Git committer email
 * @returns {{ approved: boolean, identity: object|null, reason: string }}
 */
export function checkDeveloper(email: string): {
    approved: boolean;
    identity: object | null;
    reason: string;
};
/**
 * Check if an agent/gateway is approved.
 * @param {string} agentId - Agent identifier (e.g., "antigravity", "heady-brain")
 * @returns {{ approved: boolean, identity: object|null, reason: string }}
 */
export function checkAgent(agentId: string): {
    approved: boolean;
    identity: object | null;
    reason: string;
};
/**
 * Check if a file path is in the protected paths list.
 * @param {string} filePath - Relative file path
 * @returns {boolean}
 */
export function isProtectedPath(filePath: string): boolean;
/**
 * Check if a file is in a Patent Lock zone (RTP or new inventive step).
 * Patent Lock zones require owner-only access — even approved agents are blocked.
 * @param {string} filePath - Relative file path
 * @returns {{ locked: boolean, claim: object|null, reason: string }}
 */
export function isPatentLocked(filePath: string): {
    locked: boolean;
    claim: object | null;
    reason: string;
};
/**
 * Generate a SHA-384 evidence snapshot of all patent-critical files.
 * Creates a hash manifest for RTP verification.
 * Can be called locally or from CI.
 * @returns {object} Evidence snapshot with per-file and composite hashes
 */
export function generateEvidenceSnapshot(): object;
/**
 * Approve a third-party agent (moves from blocked to approved).
 * Only callable by owner.
 * @param {string} agentId - Agent to approve
 * @param {string} approverEmail - Must be owner
 * @param {string[]} permissions - Granted permissions
 */
export function approveAgent(agentId: string, approverEmail: string, permissions?: string[]): {
    ok: boolean;
    reason: string;
    agent?: undefined;
} | {
    ok: boolean;
    agent: {
        id: string;
        type: string;
        description: string;
        permissions: string[];
        approved_by: string;
        approved_at: string;
    };
    reason?: undefined;
};
/**
 * Revoke an agent's approval.
 * @param {string} agentId - Agent to revoke
 * @param {string} revokerEmail - Must be owner
 */
export function revokeAgent(agentId: string, revokerEmail: string): {
    ok: boolean;
    reason: string;
    revoked?: undefined;
} | {
    ok: boolean;
    revoked: any;
    reason?: undefined;
};
export function registerRoutes(router: any): void;
export function loadConfig(): any;
//# sourceMappingURL=code-governance.d.ts.map