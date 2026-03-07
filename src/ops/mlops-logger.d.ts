export class MLOpsLogger extends EventEmitter<[never]> {
    constructor();
    tokenConsumption: number;
    records: any[];
    /**
     * @param {Object} entry
     * @param {string} entry.model e.g. 'gpt-4o'
     * @param {number} entry.latencyMs
     * @param {number} entry.promptTokens
     * @param {number} entry.completionTokens
     * @param {string} entry.prompt
     * @param {string} entry.completion
     * @param {boolean} entry.hallucinated boolean flag (scored via self-reflection)
     */
    logInteraction(entry: {
        model: string;
        latencyMs: number;
        promptTokens: number;
        completionTokens: number;
        prompt: string;
        completion: string;
        hallucinated: boolean;
    }): void;
    /**
     * Statistical drift detection
     * Alerts if latency spikes by >2x rolling average,
     * or token limits per response become systematically uncharacteristic.
     */
    _detectDrift(targetModel: any): void;
}
export function getMLOpsLogger(): any;
import EventEmitter = require("events");
//# sourceMappingURL=mlops-logger.d.ts.map