export class TraderWidgetService extends EventEmitter<[never]> {
    constructor(opts?: {});
    _symbols: Map<any, any>;
    _patternWeaver: PatternWeaver;
    _trades: any[];
    _riskLimits: {
        maxPositionSize: any;
        maxTradeSize: any;
        requireBiometric: boolean;
        biometricThreshold: any;
    };
    _stats: {
        ticksIngested: number;
        tradesExecuted: number;
        tradesBlocked: number;
    };
    /**
     * Initialize a symbol for tracking.
     */
    addSymbol(symbol: any): void;
    /**
     * Ingest a market tick.
     */
    ingestTick(symbol: any, tick: any): void;
    /**
     * Update order book.
     */
    updateOrderBook(symbol: any, side: any, price: any, size: any): void;
    /**
     * Execute a trade (with risk checks).
     */
    executeTrade(params: any): {
        executed: boolean;
        reason: string;
        requiresBiometric: boolean;
        notional: number;
        limit: any;
        trade?: undefined;
    } | {
        executed: boolean;
        trade: {
            tradeId: string;
            symbol: any;
            side: any;
            quantity: any;
            price: any;
            notional: number;
            mode: any;
            userId: any;
            executedAt: string;
            status: string;
        };
        reason?: undefined;
        requiresBiometric?: undefined;
        notional?: undefined;
        limit?: undefined;
    };
    /**
     * Get market overview for a symbol.
     */
    getSymbolOverview(symbol: any): {
        symbol: any;
        stats: any;
        orderBook: any;
        analysis: {
            signal: number;
            momentum: number;
            confidence: number;
            pattern: string;
            ternaryDistribution: {
                positive: number;
                negative: number;
                noise: number;
            };
            maxConsecutive: number;
            sparse: {
                computed: number;
                ignored: number;
                efficiency: string;
            };
        } | {
            signal: number;
            confidence: number;
            pattern: string;
        };
        recentPatterns: any[];
    } | null;
    getStats(): {
        symbolsTracked: number;
        patternStats: {
            scanned: number;
            breakoutsDetected: number;
            reversalsDetected: number;
        };
        tradesTotal: number;
        ticksIngested: number;
        tradesExecuted: number;
        tradesBlocked: number;
    };
    /**
     * Register HTTP routes.
     */
    registerRoutes(app: any): void;
}
export class TickBuffer {
    constructor(maxSize?: number);
    _buffer: Float64Array<ArrayBuffer>;
    _head: number;
    _maxSize: number;
    _count: number;
    push(tick: any): void;
    getRecent(n?: number): {
        ts: number;
        price: number;
        volume: number;
        side: string;
    }[];
    getStats(): {
        count: number;
        latest?: undefined;
        high?: undefined;
        low?: undefined;
        vwap?: undefined;
    } | {
        count: number;
        latest: number;
        high: number;
        low: number;
        vwap: number;
    };
}
export class OrderBook {
    constructor(symbol: any);
    symbol: any;
    bids: Map<any, any>;
    asks: Map<any, any>;
    _lastUpdate: number;
    update(side: any, price: any, size: any): void;
    getDepth(levels?: number): {
        symbol: any;
        bids: any[];
        asks: any[];
        spread: number;
        spreadBps: string;
        midPrice: number;
        lastUpdate: number;
    };
}
export class PatternWeaver {
    _patterns: any[];
    _stats: {
        scanned: number;
        breakoutsDetected: number;
        reversalsDetected: number;
    };
    /**
     * Analyze tick buffer using ternary matrix {-1, 0, +1}.
     * Identifies momentum shifts, fractal breakouts, and mean-reversion zones.
     */
    analyze(ticks: any): {
        signal: number;
        momentum: number;
        confidence: number;
        pattern: string;
        ternaryDistribution: {
            positive: number;
            negative: number;
            noise: number;
        };
        maxConsecutive: number;
        sparse: {
            computed: number;
            ignored: number;
            efficiency: string;
        };
    } | {
        signal: number;
        confidence: number;
        pattern: string;
    };
    getStats(): {
        scanned: number;
        breakoutsDetected: number;
        reversalsDetected: number;
    };
    getRecentPatterns(n?: number): any[];
}
import EventEmitter = require("events");
//# sourceMappingURL=trader-widget.d.ts.map