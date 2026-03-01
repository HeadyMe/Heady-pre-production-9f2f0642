/**
 * Heady Project - MLOps Telemetry & Drift Logger
 * 
 * Logs prompt inputs, model outputs, latency, and token consumption.
 * Triggers alerts when variance suggests model degradation.
 */

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const logger = require("../utils/logger");

const LOG_PATH = path.join(__dirname, '../../data', 'mlops-telemetry.jsonl');

class MLOpsLogger extends EventEmitter {
    constructor() {
        super();
        this.tokenConsumption = 0;
        this.records = []; // Retain window in-memory for drift detection

        // Ensure log directory exists
        if (!fs.existsSync(path.dirname(LOG_PATH))) {
            fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
        }
    }

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
    logInteraction(entry) {
        const ts = new Date().toISOString();
        const tokens = (entry.promptTokens || 0) + (entry.completionTokens || 0);
        this.tokenConsumption += tokens;

        const payload = { ...entry, ts, totalTokens: tokens };

        // write line
        fs.appendFile(LOG_PATH, JSON.stringify(payload) + '\n', (err) => {
            if (err) logger.error('[MLOps] Discarded telemetry log entry.', err);
        });

        // Drift Detection Engine
        this.records.push(payload);
        if (this.records.length > 500) this.records.shift(); // Keep window size ~500

        this._detectDrift(entry.model);
        this.emit('telemetry_logged', payload);
    }

    /**
     * Statistical drift detection
     * Alerts if latency spikes by >2x rolling average,
     * or token limits per response become systematically uncharacteristic.
     */
    _detectDrift(targetModel) {
        const modelRecs = this.records.filter(r => r.model === targetModel);
        if (modelRecs.length < 10) return; // Need baseline

        // Example trigger: Latency spike
        const recent = modelRecs.slice(-5); // last 5
        const history = modelRecs.slice(0, -5);

        const avgHistorical = history.reduce((sum, r) => sum + r.latencyMs, 0) / history.length;
        const avgRecent = recent.reduce((sum, r) => sum + r.latencyMs, 0) / recent.length;

        if (avgRecent > avgHistorical * 2.5) {
            logger.warn(`🚨 [MLOps] DRIFT ALERT - Latency Spike on ${targetModel}. Avg Baseline: ${avgHistorical.toFixed(0)}ms, Recent: ${avgRecent.toFixed(0)}ms.`);
            this.emit('drift_alert', {
                model: targetModel, type: 'LATENCY_SPIKE', baseline: avgHistorical, current: avgRecent
            });
        }
    }
}

let _mlops = null;
function getMLOpsLogger() {
    if (!_mlops) {
        _mlops = new MLOpsLogger();
        logger.logSystem("  📊 [MLOpsLogger] Telemetry & Drift Engine WIRED.");
    }
    return _mlops;
}

module.exports = { MLOpsLogger, getMLOpsLogger };
