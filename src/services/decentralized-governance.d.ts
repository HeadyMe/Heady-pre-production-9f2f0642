export class DecentralizedGovernance {
    constructor({ quorumPercent, votingPeriodMs, maxProposals }?: {
        quorumPercent?: number | undefined;
        votingPeriodMs?: number | undefined;
        maxProposals?: number | undefined;
    });
    quorumPercent: number;
    votingPeriodMs: number;
    maxProposals: number;
    proposals: Map<any, any>;
    members: Map<any, any>;
    executors: Map<any, any>;
    auditLog: any[];
    _expiryTimer: NodeJS.Timeout;
    addMember(memberId: any, { role, votingPower }?: {
        role?: string | undefined;
        votingPower?: number | undefined;
    }): void;
    removeMember(memberId: any): void;
    createProposal(authorId: any, { title, description, type, payload, requiredQuorum }?: {}): {
        id: `${string}-${string}-${string}-${string}-${string}`;
        authorId: any;
        title: any;
        description: any;
        type: any;
        payload: any;
        state: string;
        votes: Map<any, any>;
        requiredQuorum: any;
        createdAt: string;
        votingStartedAt: null;
        resolvedAt: null;
    };
    startVoting(proposalId: any): any;
    castVote(proposalId: any, memberId: any, { approve, reason }?: {}): any;
    executeProposal(proposalId: any): Promise<{
        success: boolean;
        result: any;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        result?: undefined;
    }>;
    registerExecutor(proposalType: any, fn: any): void;
    _getProposal(id: any): any;
    _checkQuorum(proposalId: any): void;
    _checkExpiry(): void;
    _audit(action: any, data: any): void;
    getHealth(): {
        members: number;
        totalProposals: number;
        proposalsByState: {};
        registeredExecutors: number;
        auditLogSize: number;
    };
    shutdown(): void;
}
export namespace PROPOSAL_STATES {
    let DRAFT: string;
    let VOTING: string;
    let APPROVED: string;
    let REJECTED: string;
    let EXECUTED: string;
    let EXPIRED: string;
}
export function registerGovernanceRoutes(app: any): DecentralizedGovernance;
//# sourceMappingURL=decentralized-governance.d.ts.map