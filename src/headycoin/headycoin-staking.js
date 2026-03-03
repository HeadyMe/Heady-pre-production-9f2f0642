/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ HeadyCoin Staking Engine ═══
 *
 * Lock HDY tokens for time-based APY rewards.
 * Proof-of-Inference rewards are distributed to stakers
 * proportionally based on their stake weight.
 *
 * Staking Tiers:
 *   30 days  →  5% APY
 *   90 days  → 10% APY
 *   365 days → 15% APY
 *
 * Heady AI Node: CONDUCTOR
 */

const fs = require("fs");
const path = require("path");
const wallet = require("./headycoin-wallet");
const ledger = require("./headycoin-ledger");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const STAKES_FILE = path.join(DATA_DIR, "headycoin-stakes.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ─── STAKING TIERS ──────────────────────────────────────────────────
const STAKING_TIERS = Object.freeze({
    SHORT: { days: 30, apy: 0.05, label: "30-Day Lock", minStake: 10 },
    MEDIUM: { days: 90, apy: 0.10, label: "90-Day Lock", minStake: 50 },
    LONG: { days: 365, apy: 0.15, label: "365-Day Lock", minStake: 100 },
});

/**
 * Load stakes from disk.
 * @returns {object[]}
 */
function loadStakes() {
    try {
        if (!fs.existsSync(STAKES_FILE)) return [];
        return JSON.parse(fs.readFileSync(STAKES_FILE, "utf8"));
    } catch {
        return [];
    }
}

/**
 * Save stakes to disk.
 * @param {object[]} stakes
 */
function saveStakes(stakes) {
    fs.writeFileSync(STAKES_FILE, JSON.stringify(stakes, null, 2));
}

/**
 * Stake HDY tokens.
 *
 * @param {string} walletAddress - Staker's wallet
 * @param {number} amount - HDY to stake
 * @param {string} tierKey - 'SHORT', 'MEDIUM', or 'LONG'
 * @returns {object} The created stake record
 */
function stake(walletAddress, amount, tierKey = "SHORT") {
    const tier = STAKING_TIERS[tierKey];
    if (!tier) throw new Error(`Invalid staking tier: ${tierKey}`);
    if (amount < tier.minStake) throw new Error(`Minimum stake for ${tier.label}: ${tier.minStake} HDY`);

    const balance = wallet.getBalance(walletAddress);
    if (balance < amount) {
        throw new Error(`Insufficient balance. Have: ${balance}, need: ${amount}`);
    }

    // Move tokens from user wallet to staking pool
    wallet.updateBalance(walletAddress, -amount);
    wallet.updateBalance(wallet.SYSTEM_WALLETS.STAKING_POOL, amount);

    const now = new Date();
    const unlockDate = new Date(now.getTime() + tier.days * 24 * 60 * 60 * 1000);

    const stakeRecord = {
        id: `stake_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        walletAddress,
        amount,
        tier: tierKey,
        apy: tier.apy,
        stakedAt: now.toISOString(),
        unlocksAt: unlockDate.toISOString(),
        status: "active",
        rewardsClaimed: 0,
        lastRewardCheck: now.toISOString(),
    };

    const stakes = loadStakes();
    stakes.push(stakeRecord);
    saveStakes(stakes);

    // Record on ledger
    ledger.recordTransaction(ledger.TX_TYPES.STAKE, walletAddress, wallet.SYSTEM_WALLETS.STAKING_POOL, amount, {
        stakeId: stakeRecord.id,
        tier: tierKey,
        apy: tier.apy,
        unlocksAt: stakeRecord.unlocksAt,
    });

    return stakeRecord;
}

/**
 * Unstake tokens (only after lock period expires).
 *
 * @param {string} stakeId - The stake record ID
 * @returns {object} Updated stake record
 */
function unstake(stakeId) {
    const stakes = loadStakes();
    const idx = stakes.findIndex((s) => s.id === stakeId);
    if (idx === -1) throw new Error(`Stake not found: ${stakeId}`);

    const stakeRecord = stakes[idx];
    if (stakeRecord.status !== "active") throw new Error(`Stake is not active: ${stakeRecord.status}`);

    const now = new Date();
    const unlockDate = new Date(stakeRecord.unlocksAt);
    if (now < unlockDate) {
        const remaining = Math.ceil((unlockDate - now) / (24 * 60 * 60 * 1000));
        throw new Error(`Stake locked for ${remaining} more day(s). Unlocks: ${stakeRecord.unlocksAt}`);
    }

    // Return tokens from staking pool to user
    wallet.updateBalance(wallet.SYSTEM_WALLETS.STAKING_POOL, -stakeRecord.amount);
    wallet.updateBalance(stakeRecord.walletAddress, stakeRecord.amount);

    stakeRecord.status = "completed";
    stakeRecord.unstakedAt = now.toISOString();
    stakes[idx] = stakeRecord;
    saveStakes(stakes);

    // Record on ledger
    ledger.recordTransaction(ledger.TX_TYPES.UNSTAKE, wallet.SYSTEM_WALLETS.STAKING_POOL, stakeRecord.walletAddress, stakeRecord.amount, {
        stakeId,
    });

    return stakeRecord;
}

/**
 * Calculate pending rewards for a stake.
 *
 * @param {object} stakeRecord
 * @returns {number} Pending HDY reward
 */
function calculateReward(stakeRecord) {
    if (stakeRecord.status !== "active") return 0;

    const now = new Date();
    const lastCheck = new Date(stakeRecord.lastRewardCheck);
    const elapsedMs = now - lastCheck;
    const elapsedYears = elapsedMs / (365.25 * 24 * 60 * 60 * 1000);

    const reward = stakeRecord.amount * stakeRecord.apy * elapsedYears;
    return parseFloat(reward.toFixed(8));
}

/**
 * Get all active stakes for a wallet.
 *
 * @param {string} walletAddress
 * @returns {object[]} Active stakes with pending rewards
 */
function getStakes(walletAddress) {
    const stakes = loadStakes();
    return stakes
        .filter((s) => s.walletAddress === walletAddress)
        .map((s) => ({
            ...s,
            pendingReward: calculateReward(s),
        }));
}

/**
 * Get staking pool statistics.
 * @returns {object}
 */
function getStakingStats() {
    const stakes = loadStakes();
    const active = stakes.filter((s) => s.status === "active");
    const pool = wallet.getBalance(wallet.SYSTEM_WALLETS.STAKING_POOL);

    const byTier = {};
    for (const s of active) {
        byTier[s.tier] = (byTier[s.tier] || 0) + s.amount;
    }

    return {
        totalStaked: pool,
        activeStakes: active.length,
        totalStakes: stakes.length,
        byTier,
        tiers: STAKING_TIERS,
        ts: new Date().toISOString(),
    };
}

module.exports = {
    STAKING_TIERS,
    STAKES_FILE,
    stake,
    unstake,
    calculateReward,
    getStakes,
    getStakingStats,
};
