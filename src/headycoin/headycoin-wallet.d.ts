export const SYSTEM_WALLETS: Readonly<{
    TREASURY: "hdy_treasury_0000000000000000";
    STAKING_POOL: "hdy_staking_0000000000000000";
    BURN_ADDRESS: "hdy_burn_000000000000000000";
}>;
export const WALLETS_FILE: string;
/**
 * Load wallets from disk.
 * @returns {object} Map of address → wallet data
 */
export function loadWallets(): object;
/**
 * Persist wallets to disk.
 * @param {object} wallets
 */
export function saveWallets(wallets: object): void;
/**
 * Initialize system wallets if they don't exist.
 * @returns {object} wallets map
 */
export function initSystemWallets(): object;
/**
 * Generate a unique wallet address.
 * @param {string} prefix - Optional prefix after 'hdy_'
 * @returns {string} Address like hdy_usr_a1b2c3d4e5f6g7h8
 */
export function generateAddress(prefix?: string): string;
/**
 * Create a new wallet.
 * @param {object} options
 * @param {string} options.label - Human-readable label
 * @param {string} options.owner - Owner identifier (userId, email, etc.)
 * @param {string} options.prefix - Address prefix (default: 'usr')
 * @returns {object} The created wallet
 */
export function createWallet({ label, owner, prefix }?: {
    label: string;
    owner: string;
    prefix: string;
}): object;
/**
 * Get wallet by address.
 * @param {string} address
 * @returns {object|null}
 */
export function getWallet(address: string): object | null;
/**
 * Update a wallet's balance.
 * @param {string} address
 * @param {number} delta - Amount to add (positive) or subtract (negative)
 * @returns {object} Updated wallet
 */
export function updateBalance(address: string, delta: number): object;
/**
 * Get balance for a wallet.
 * @param {string} address
 * @returns {number}
 */
export function getBalance(address: string): number;
/**
 * List all wallets.
 * @param {object} filter - Optional filter { type: 'user'|'system' }
 * @returns {object[]}
 */
export function listWallets(filter?: object): object[];
/**
 * Check if wallet exists.
 * @param {string} address
 * @returns {boolean}
 */
export function walletExists(address: string): boolean;
//# sourceMappingURL=headycoin-wallet.d.ts.map