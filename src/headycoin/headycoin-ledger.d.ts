/**
 * Transaction types in the HeadyCoin system.
 */
export const TX_TYPES: Readonly<{
    MINT: "MINT";
    BURN: "BURN";
    TRANSFER: "TRANSFER";
    STAKE: "STAKE";
    UNSTAKE: "UNSTAKE";
    REWARD: "REWARD";
    GENESIS: "GENESIS";
}>;
export const GENESIS_HASH: string;
export const LEDGER_FILE: string;
/**
 * Generate SHA-256 hash for a transaction payload.
 * @param {object} payload
 * @returns {string} 64-char hex hash
 */
export function hashTransaction(payload: object): string;
/**
 * Get the hash of the last transaction in the ledger.
 * Returns GENESIS_HASH if ledger is empty.
 * @returns {string}
 */
export function getLastHash(): string;
/**
 * Record a transaction to the immutable ledger.
 *
 * @param {string} type - One of TX_TYPES
 * @param {string} from - Source wallet address
 * @param {string} to - Destination wallet address
 * @param {number} amount - Amount of HDY
 * @param {object} metadata - Additional context
 * @returns {object} The complete ledger entry with hash
 */
export function recordTransaction(type: string, from: string, to: string, amount: number, metadata?: object): object;
/**
 * Read recent ledger entries.
 * @param {number} limit - Max entries to return (default 50)
 * @returns {object[]} Array of ledger entries, newest first
 */
export function readLedger(limit?: number): object[];
/**
 * Read ALL ledger entries in order (for chain verification).
 * @returns {object[]}
 */
export function readFullLedger(): object[];
/**
 * Verify chain integrity — ensure every transaction's prevHash
 * matches the hash of the prior entry.
 *
 * @returns {{ valid: boolean, entries: number, errors: string[] }}
 */
export function verifyChain(): {
    valid: boolean;
    entries: number;
    errors: string[];
};
/**
 * Get ledger statistics.
 * @returns {object}
 */
export function getLedgerStats(): object;
//# sourceMappingURL=headycoin-ledger.d.ts.map