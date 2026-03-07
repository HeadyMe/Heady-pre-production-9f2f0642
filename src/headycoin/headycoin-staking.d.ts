export const STAKING_TIERS: Readonly<{
    SHORT: {
        days: number;
        apy: number;
        label: string;
        minStake: number;
    };
    MEDIUM: {
        days: number;
        apy: number;
        label: string;
        minStake: number;
    };
    LONG: {
        days: number;
        apy: number;
        label: string;
        minStake: number;
    };
}>;
export const STAKES_FILE: string;
/**
 * Stake HDY tokens.
 *
 * @param {string} walletAddress - Staker's wallet
 * @param {number} amount - HDY to stake
 * @param {string} tierKey - 'SHORT', 'MEDIUM', or 'LONG'
 * @returns {object} The created stake record
 */
export function stake(walletAddress: string, amount: number, tierKey?: string): object;
/**
 * Unstake tokens (only after lock period expires).
 *
 * @param {string} stakeId - The stake record ID
 * @returns {object} Updated stake record
 */
export function unstake(stakeId: string): object;
/**
 * Calculate pending rewards for a stake.
 *
 * @param {object} stakeRecord
 * @returns {number} Pending HDY reward
 */
export function calculateReward(stakeRecord: object): number;
/**
 * Get all active stakes for a wallet.
 *
 * @param {string} walletAddress
 * @returns {object[]} Active stakes with pending rewards
 */
export function getStakes(walletAddress: string): object[];
/**
 * Get staking pool statistics.
 * @returns {object}
 */
export function getStakingStats(): object;
//# sourceMappingURL=headycoin-staking.d.ts.map