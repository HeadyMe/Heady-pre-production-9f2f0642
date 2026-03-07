/**
 * Anchor a Proof-of-Inference hash to the blockchain.
 * @param {string} sha256Hash The locally simulated hash from the agent output.
 * @param {object} metadata Additional JSON metadata (e.g. agentId, action_type).
 * @returns {Promise<string>} The transaction hash on the blockchain.
 */
export function anchorToLedger(sha256Hash: string, metadata?: object): Promise<string>;
//# sourceMappingURL=web3-ledger-anchor.d.ts.map