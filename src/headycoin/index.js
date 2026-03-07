/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ HeadyCoin Module Index ═══
 *
 * Barrel file re-exporting all HeadyCoin subsystems.
 */

const { headyCoin, HeadyCoinEngine, TOKEN, MINING_REWARDS } = require("./headycoin-core");
const wallet = require("./headycoin-wallet");
const ledger = require("./headycoin-ledger");
const staking = require("./headycoin-staking");
const merkle = require("./headycoin-merkle");

module.exports = {
    // Core engine (singleton)
    headyCoin,
    HeadyCoinEngine,
    TOKEN,
    MINING_REWARDS,

    // Subsystems
    wallet,
    ledger,
    staking,
    merkle,
};
