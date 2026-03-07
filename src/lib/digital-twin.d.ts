export = DigitalTwin;
declare class DigitalTwin {
    constructor(opts?: {});
    name: any;
    scenarios: any[];
    _results: any[];
    addScenario(name: any, config: any): this;
    simulate(baseUrl: any): Promise<{
        twin: any;
        results: {
            scenario: any;
            total: number;
            successes: number;
            failures: number;
            avgLatency: number;
            errorRate: number;
            passLatency: boolean;
            passErrorRate: boolean;
            pass: boolean;
        }[];
        timestamp: string;
    }>;
    _runScenario(scenario: any, baseUrl: any): Promise<{
        scenario: any;
        total: number;
        successes: number;
        failures: number;
        avgLatency: number;
        errorRate: number;
        passLatency: boolean;
        passErrorRate: boolean;
        pass: boolean;
    }>;
    getSummary(): {
        twin: any;
        scenarios: number;
        allPass: boolean;
        results: any[];
    };
}
//# sourceMappingURL=digital-twin.d.ts.map