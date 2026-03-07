/**
 * Generate a cryptographic receipt for an action.
 * @param {object} params
 * @param {string} params.intent - What was requested
 * @param {string} params.actor - Who/what initiated (user, node, pipeline)
 * @param {object} params.routing - Routing decisions (provider, model, tier)
 * @param {string[]} params.toolsExecuted - List of tools/actions taken
 * @param {object} params.cost - { tokensUsed, costUSD, provider }
 * @param {object} [params.result] - Outcome summary
 * @returns {object} The immutable receipt
 */
export function generateReceipt(params: {
    intent: string;
    actor: string;
    routing: object;
    toolsExecuted: string[];
    cost: object;
    result?: object | undefined;
}): object;
/**
 * Verify a receipt's integrity using its hash.
 * @param {object} receipt - A receipt object
 * @returns {{ valid: boolean, reason: string }}
 */
export function verifyReceipt(receipt: object): {
    valid: boolean;
    reason: string;
};
/**
 * Verify an entire chain of receipts from a JSONL file.
 * @param {string} date - YYYY-MM-DD
 * @returns {{ valid: boolean, receiptsChecked: number, errors: string[] }}
 */
export function verifyChain(date: string): {
    valid: boolean;
    receiptsChecked: number;
    errors: string[];
};
/**
 * Get today's receipt summary.
 */
export function getTodaySummary(): {
    date: string;
    totalReceipts: number;
    totalCostUSD: number;
    providers: {};
} | {
    date: string;
    totalReceipts: number;
    totalCostUSD: string;
    providers: {};
};
//# sourceMappingURL=proof-view-receipts.d.ts.map