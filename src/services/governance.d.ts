export class GovernanceModule {
    proposals: Map<any, any>;
    voters: Map<any, any>;
    chain: any[];
    registerVoter(voterId: any, publicKey: any, weight?: number): {
        voterId: any;
        registered: boolean;
    };
    createProposal(title: any, description: any, author: any, options?: {}): {
        proposalId: string;
        state: string;
    };
    openProposal(proposalId: any): {
        proposalId: any;
        state: any;
        closesAt: any;
    };
    vote(proposalId: any, voterId: any, choice: any, signature?: null): {
        proposalId: any;
        voterId: any;
        choice: any;
        tally: any;
    };
    finalize(proposalId: any): {
        proposalId: any;
        state: any;
        tally: any;
        quorumMet: boolean;
        hash: any;
    };
    listProposals(state?: null): {
        id: any;
        title: any;
        state: any;
        tally: any;
        author: any;
        closesAt: any;
    }[];
    getHealth(): {
        totalVoters: number;
        totalProposals: number;
        openProposals: number;
        chainLength: number;
        latestHash: any;
    };
}
export const governance: GovernanceModule;
export function registerGovernanceRoutes(app: any): void;
export namespace PROPOSAL_STATES {
    let DRAFT: string;
    let OPEN: string;
    let PASSED: string;
    let REJECTED: string;
    let EXECUTED: string;
}
//# sourceMappingURL=governance.d.ts.map