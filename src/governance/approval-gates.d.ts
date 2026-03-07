export class HumanApprovalGates {
    pendingApprovals: Map<any, any>;
    /**
     * Agent requests an action to be executed, but execution is halted pending human approval.
     */
    requestApproval(intent: any, modelDecision: any, toolsExecuted: any, projectedROI?: null): `${string}-${string}-${string}-${string}-${string}`;
    /**
     * Fetches all pending approval gates.
     */
    getPending(): any[];
    /**
     * Human operator approves or denies the action cryptographically.
     */
    resolveApproval(id: any, approved: any, operatorId: any, signature: any): any;
    /**
     * "Proof View UI" Receipt Generation
     * The immutable, visual receipt detailing intent, routing, tools, validation, and ROI.
     */
    _generateReceipt(requestData: any): void;
}
export function getApprovalGates(): any;
//# sourceMappingURL=approval-gates.d.ts.map