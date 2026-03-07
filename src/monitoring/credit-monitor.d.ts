export class CreditMonitor extends EventEmitter<[never]> {
    constructor(options?: {});
    checkInterval: any;
    lowCreditThreshold: any;
    criticalThreshold: any;
    lastCheck: string | null;
    providerStatus: {};
    alertsSent: Set<any>;
    timer: NodeJS.Timeout | null;
    start(): this;
    stop(): void;
    checkAll(): Promise<{
        results: {};
        alerts: ({
            provider: string;
            name: string;
            level: string;
            balance: any;
            message: string;
        } | {
            provider: string;
            name: string;
            level: string;
            message: string;
            balance?: undefined;
        })[];
    }>;
    getStatus(): {
        lastCheck: string | null;
        providers: {};
        monitoring: boolean;
        checkInterval: string;
        thresholds: {
            low: string;
            critical: string;
        };
    };
}
export function registerCreditRoutes(app: any, monitor: any): void;
export namespace PROVIDERS {
    namespace anthropic {
        let name: string;
        let envKey: string;
        function checkBalance(apiKey: any): Promise<{
            available: boolean;
            balance: any;
            usage: unknown;
            status?: undefined;
        } | {
            available: boolean;
            balance: string;
            status: string;
            usage?: undefined;
        } | {
            available: boolean;
            balance: number;
            status: string;
            usage?: undefined;
        } | {
            available: boolean;
            balance: null;
            status: any;
            usage?: undefined;
        }>;
    }
    namespace openai {
        let name_1: string;
        export { name_1 as name };
        let envKey_1: string;
        export { envKey_1 as envKey };
        export function checkBalance(apiKey: any): Promise<{
            available: boolean;
            models: any;
            status: string;
            balance?: undefined;
        } | {
            available: boolean;
            balance: string;
            status: string;
            models?: undefined;
        } | {
            available: boolean;
            balance: number;
            status: string;
            models?: undefined;
        } | {
            available: boolean;
            status: any;
            models?: undefined;
            balance?: undefined;
        }>;
    }
    namespace groq {
        let name_2: string;
        export { name_2 as name };
        let envKey_2: string;
        export { envKey_2 as envKey };
        export function checkBalance(apiKey: any): Promise<{
            available: boolean;
            status: any;
        }>;
    }
    namespace google {
        let name_3: string;
        export { name_3 as name };
        let envKey_3: string;
        export { envKey_3 as envKey };
        export function checkBalance(apiKey: any): Promise<{
            available: boolean;
            models: any;
            status: string;
        } | {
            available: boolean;
            status: any;
            models?: undefined;
        }>;
    }
}
import EventEmitter = require("events");
//# sourceMappingURL=credit-monitor.d.ts.map