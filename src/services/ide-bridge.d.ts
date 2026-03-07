/**
 * Submit a code modification proposal.
 * This is the primary entry point for HeadyAI-IDE interactions.
 *
 * @param {Object} proposal
 * @param {string} proposal.intent - Natural language description of the change
 * @param {string} proposal.targetFile - File path relative to repo root
 * @param {string} proposal.proposedDiff - The diff or new content
 * @param {string} proposal.submittedBy - User or agent identifier
 * @param {string} proposal.priority - 'low', 'normal', 'high', 'critical'
 * @returns {Object} Submission result with proposalId
 */
export function submitProposal(proposal?: {
    intent: string;
    targetFile: string;
    proposedDiff: string;
    submittedBy: string;
    priority: string;
}): Object;
/**
 * Evaluate a submitted proposal.
 * Runs validation checks and routes to governance if passing.
 *
 * @param {string} proposalId
 * @returns {Object} Evaluation result
 */
export function evaluateProposal(proposalId: string): Object;
/**
 * Approve a proposal (governance decision).
 */
export function approveProposal(proposalId: any): {
    success: boolean;
    error: string;
    proposalId?: undefined;
    state?: undefined;
    traceId?: undefined;
    nextStep?: undefined;
} | {
    success: boolean;
    proposalId: any;
    state: any;
    traceId: any;
    nextStep: string;
    error?: undefined;
};
/**
 * Reject a proposal.
 */
export function rejectProposal(proposalId: any, reason: any): {
    success: boolean;
    error: string;
    proposalId?: undefined;
    state?: undefined;
    reason?: undefined;
} | {
    success: boolean;
    proposalId: any;
    state: any;
    reason: any;
    error?: undefined;
};
/**
 * Apply an approved proposal — writes the diff to the filesystem.
 * Creates a backup of the original file before writing.
 *
 * @param {string} proposalId
 * @returns {Object} Application result with backup path
 */
export function applyProposal(proposalId: string): Object;
/**
 * Rollback a previously applied proposal using its backup.
 *
 * @param {string} proposalId
 * @returns {Object} Rollback result
 */
export function rollbackProposal(proposalId: string): Object;
/**
 * Get proposal status by ID.
 */
export function getProposalStatus(proposalId: any): {
    proposalId: any;
    intent: any;
    targetFile: any;
    diffHash: any;
    submittedBy: any;
    priority: any;
    state: any;
    submittedAt: any;
    validationResult: any;
    governanceResult: any;
    traceId: any;
    appliedAt: any;
} | null;
/**
 * List all proposals with optional filtering.
 */
export function listProposals(options?: {}): {
    proposalId: any;
    intent: any;
    targetFile: any;
    state: any;
    priority: any;
    submittedAt: any;
}[];
export function ideBridgeRoutes(app: any): void;
export namespace PROPOSAL_STATES {
    let SUBMITTED: string;
    let VALIDATING: string;
    let VALIDATED: string;
    let VALIDATION_FAILED: string;
    let AUTO_CORRECTING: string;
    let GOVERNANCE_PENDING: string;
    let APPROVED: string;
    let REJECTED: string;
    let APPLIED: string;
    let ROLLED_BACK: string;
}
export const AUTO_CORRECTION_STRATEGIES: string[];
//# sourceMappingURL=ide-bridge.d.ts.map