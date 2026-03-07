export const headyCoin: HeadyCoinEngine;
export class HeadyCoinEngine extends EventEmitter<[never]> {
    constructor();
    initialized: boolean;
    totalMinted: number;
    totalBurned: number;
    /**
     * Initialize the HeadyCoin engine.
     * Creates system wallets and performs genesis mint if needed.
     */
    initialize(): object;
    /**
     * Get current token information.
     * @returns {object}
     */
    getTokenInfo(): object;
    /**
     * Calculate current halving multiplier.
     * Reward halves every 2.1M tokens minted.
     * @returns {number}
     */
    _getHalvingMultiplier(): number;
    /**
     * Mint new HDY tokens. Respects supply cap.
     *
     * @param {string} toAddress - Destination wallet
     * @param {number} amount - HDY to mint
     * @param {object} metadata - Context (reason, actionType, etc.)
     * @returns {object} Transaction entry
     */
    mint(toAddress: string, amount: number, metadata?: object): object;
    /**
     * Burn HDY tokens — permanently remove from circulation.
     *
     * @param {string} fromAddress - Source wallet
     * @param {number} amount - HDY to burn
     * @param {object} metadata
     * @returns {object} Transaction entry
     */
    burn(fromAddress: string, amount: number, metadata?: object): object;
    /**
     * Transfer HDY between wallets.
     *
     * @param {string} from - Source wallet address
     * @param {string} to - Destination wallet address
     * @param {number} amount - HDY to transfer
     * @param {object} metadata
     * @returns {object} Transaction entry
     */
    transfer(from: string, to: string, amount: number, metadata?: object): object;
    /**
     * Mine HDY via Proof-of-Inference.
     * Called when cognitive-telemetry records a verified AI action.
     *
     * @param {string} toAddress - Miner's wallet
     * @param {string} actionType - One of ACTION_TYPES from cognitive-telemetry
     * @param {string} auditHash - SHA-256 hash from cognitive-telemetry
     * @returns {object|null} Transaction entry, or null if reward is 0
     */
    mineProofOfInference(toAddress: string, actionType: string, auditHash: string): object | null;
    /**
     * Get the mining reward for a given action type at current halving era.
     * @param {string} actionType
     * @returns {number}
     */
    getMiningReward(actionType: string): number;
    _ensureInitialized(): void;
}
export const TOKEN: Readonly<{
    name: "HeadyCoin";
    symbol: "HDY";
    decimals: 8;
    maxSupply: 21000000;
    genesisAllocation: 2100000;
    miningRewardBase: 0.1;
    halvingInterval: 2100000;
    version: "1.0.0";
}>;
export const MINING_REWARDS: Readonly<{
    CHAT_COMPLETION: 0.01;
    BATTLE_VALIDATE: 0.5;
    BATTLE_ARENA: 1;
    BATTLE_EVALUATE: 0.25;
    CREATIVE_GENERATE: 0.1;
    CREATIVE_REMIX: 0.05;
    SIMS_SIMULATE: 0.5;
    MCP_CALL: 0.02;
    MODEL_GENERATION: 0.05;
    TRADE_THESIS: 0.75;
    ARCHITECTURE_UPDATE: 0.2;
    TASK_DECOMPOSITION: 0.03;
    PIPELINE_EXECUTION: 0.15;
}>;
import EventEmitter = require("events");
//# sourceMappingURL=headycoin-core.d.ts.map