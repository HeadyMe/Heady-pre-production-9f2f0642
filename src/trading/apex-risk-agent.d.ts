export class ApexRiskAgent extends EventEmitter<[never]> {
    constructor(accountTier?: string);
    tier: string;
    rules: any;
    sessionState: {
        startOfDayBalance: any;
        highestEquity: any;
        currentEquity: any;
        openPnL: number;
        dailyPnL: number;
        tradingDays: number;
        profitableDays: number;
        totalProfit: number;
        dailyProfits: never[];
        signals: never[];
        violations: never[];
        lastCheckTs: null;
    };
    started: boolean;
    checkInterval: any;
    /**
     * Check if current state violates any Apex 3.0 rules.
     * Returns { safe: boolean, violations: string[], signal: -1|0|+1 }
     */
    checkRisk(equity: any, openPnL: any): {
        safe: boolean;
        violations: string[];
        signal: 0 | 1 | -1;
    };
    /**
     * Calculate safety net for payout requests.
     * $Safety_Net = Starting_Balance + Trailing_Threshold + 100
     */
    getSafetyNet(): any;
    canRequestPayout(requestAmount: any): {
        allowed: boolean;
        safetyNet: any;
        balanceAfter: number;
        tradingDays: number;
        profitableDays: number;
        reasons: (string | null)[];
    };
    startSession(balance: any): void;
    endSession(): void;
    getStatus(): {
        node: string;
        tier: string;
        rules: any;
        universalRules: {
            consistencyRule: string;
            maeRule: string;
            minTradingDays: 8;
            minProfitableDays: 5;
        };
        session: {
            active: boolean;
            currentEquity: any;
            highestEquity: any;
            openPnL: number;
            dailyPnL: number;
            totalProfit: number;
            tradingDays: number;
            profitableDays: number;
        };
        safetyNet: any;
        drawdownFloor: number;
        recentSignals: never[];
        recentViolations: never[];
        ts: string;
    };
}
export function registerApexRoutes(app: any, agent: any): void;
export const APEX_RULES: Readonly<{
    accounts: {
        '25K': {
            balance: number;
            trailingDrawdown: number;
            initialMAE: number;
            safetyNetBuffer: number;
        };
        '50K': {
            balance: number;
            trailingDrawdown: number;
            initialMAE: number;
            safetyNetBuffer: number;
        };
        '75K': {
            balance: number;
            trailingDrawdown: number;
            initialMAE: number;
            safetyNetBuffer: number;
        };
        '100K': {
            balance: number;
            trailingDrawdown: number;
            initialMAE: number;
            safetyNetBuffer: number;
        };
        '150K': {
            balance: number;
            trailingDrawdown: number;
            initialMAE: number;
            safetyNetBuffer: number;
        };
        '250K': {
            balance: number;
            trailingDrawdown: number;
            initialMAE: number;
            safetyNetBuffer: number;
        };
        '300K': {
            balance: number;
            trailingDrawdown: number;
            initialMAE: number;
            safetyNetBuffer: number;
        };
    };
    consistencyRule: 0.3;
    maeRule: 0.3;
    minTradingDaysBetweenPayouts: 8;
    minProfitableDays: 5;
    minProfitPerDay: 100;
    safetyNetPayouts: 3;
    maxPositionHoldOvernight: false;
    tradingHoursUTC: {
        start: string;
        end: string;
    };
    newsBlackoutMinutes: 5;
}>;
export const SIGNAL: Readonly<{
    REPEL: -1;
    HOLD: 0;
    ENGAGE: 1;
}>;
import EventEmitter = require("events");
//# sourceMappingURL=apex-risk-agent.d.ts.map