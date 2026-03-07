export const MERKLE_FILE: string;
/**
 * Hash two nodes together (Merkle internal node).
 * @param {string} left
 * @param {string} right
 * @returns {string}
 */
export function hashPair(left: string, right: string): string;
/**
 * Build a Merkle tree from an array of leaf hashes.
 *
 * @param {string[]} leaves - Array of hex hash strings
 * @returns {{ root: string, layers: string[][], leaves: string[] }}
 */
export function buildTree(leaves: string[]): {
    root: string;
    layers: string[][];
    leaves: string[];
};
/**
 * Generate an inclusion proof for a leaf at a given index.
 *
 * @param {string[][]} layers - Merkle tree layers
 * @param {number} leafIndex - Index of the leaf to prove
 * @returns {object[]} Array of { hash, direction } pairs
 */
export function generateProof(layers: string[][], leafIndex: number): object[];
/**
 * Verify an inclusion proof.
 *
 * @param {string} leaf - The leaf hash to verify
 * @param {object[]} proof - Array of { hash, direction } pairs
 * @param {string} root - Expected Merkle root
 * @returns {boolean}
 */
export function verifyProof(leaf: string, proof: object[], root: string): boolean;
/**
 * Build Merkle tree from recent unanchored ledger transactions.
 *
 * @param {number} maxLeaves - Max transactions to include (default: 256)
 * @returns {object} Tree with root, proof-ready layers, and tx metadata
 */
export function buildFromLedger(maxLeaves?: number): object;
/**
 * Record a Merkle root anchoring event.
 *
 * @param {string} merkleRoot
 * @param {string[]} txIds - Transaction IDs included
 * @param {string} evmTxHash - Blockchain transaction hash
 * @returns {object} Anchoring record
 */
export function recordAnchoring(merkleRoot: string, txIds: string[], evmTxHash: string): object;
/**
 * Load anchored Merkle roots.
 * @returns {object[]}
 */
export function loadAnchoredRoots(): object[];
/**
 * Get Merkle anchoring statistics.
 * @returns {object}
 */
export function getMerkleStats(): object;
//# sourceMappingURL=headycoin-merkle.d.ts.map