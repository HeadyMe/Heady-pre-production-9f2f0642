/**
 * ═══════════════════════════════════════════════════════════════════
 * Heady Phi Scale Engine
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Replace ALL fixed numeric constants with continuously adjusting
 * phi-bounded dynamic scales. The golden ratio (φ = 1.618...) provides
 * mathematically optimal partitioning of continuous ranges.
 * 
 * φ = 1.618033988749895
 * 1/φ = 0.618033988749895
 * 
 * The phi-point (0.618) is the natural balance point, creating an
 * inherently asymmetric scale that favors action over inaction.
 * ═══════════════════════════════════════════════════════════════════
 */

const logger = require('../utils/logger');

// Golden ratio constants
const PHI = 1.618033988749895;
const PHI_INVERSE = 0.618033988749895;
const SQRT_PHI = Math.sqrt(PHI);
const PHI_SQUARED = PHI * PHI;

/**
 * PhiRange - Represents a phi-bounded continuous range
 */
class PhiRange {
    constructor(baseMin, baseMax, phiNormalized = true) {
        if (phiNormalized) {
            // Use phi-normalized coordinates
            this.min = PHI_INVERSE * baseMin;
            this.max = PHI_INVERSE * baseMax;
            this.phiPoint = PHI_INVERSE;
        } else {
            // Use absolute coordinates
            this.min = baseMin;
            this.max = baseMax;
            this.phiPoint = this.min + (this.max - this.min) * PHI_INVERSE;
        }
        this.span = this.max - this.min;
    }

    normalize(value) {
        return (value - this.min) / this.span;
    }

    denormalize(normalized) {
        return this.min + (normalized * this.span);
    }

    atPhiPoint() {
        return this.phiPoint;
    }

    abovePhiPoint(value) {
        return value > this.phiPoint;
    }

    belowPhiPoint(value) {
        return value < this.phiPoint;
    }

    distanceFromPhi(value) {
        return Math.abs(value - this.phiPoint);
    }
}

/**
 * PhiScale - A continuously adjusting value bounded by phi coordinates
 */
class PhiScale {
    constructor(options = {}) {
        this.name = options.name || 'unnamed';
        this.baseValue = options.baseValue || 1.0;
        this.min = options.min || 0;
        this.max = options.max || PHI_SQUARED;
        this.phiNormalized = options.phiNormalized !== false;

        this.range = new PhiRange(this.min, this.max, this.phiNormalized);
        this.current = this.baseValue;

        // Adjustment parameters
        this.sensitivity = options.sensitivity || 0.1;
        this.momentum = 0;
        this.momentumDecay = options.momentumDecay || 0.9;

        // Telemetry hooks
        this.telemetryFeed = options.telemetryFeed || null;
        this.adjustmentHistory = [];
        this.maxHistorySize = options.maxHistorySize || 1000;

        // Bounds enforcement
        this.enforceBounds = options.enforceBounds !== false;

        logger.debug(`PhiScale initialized: ${this.name} = ${this.current} [${this.min}, ${this.max}]`);
    }

    /**
     * Get current value
     */
    get value() {
        return this.current;
    }

    /**
     * Get as integer
     */
    asInt() {
        return Math.round(this.current);
    }

    /**
     * Get as milliseconds (for timeouts)
     */
    asMs() {
        return Math.floor(this.current);
    }

    /**
     * Adjust the scale based on telemetry
     */
    adjust(metrics = {}) {
        if (!this.telemetryFeed) {
            return this.current;
        }

        try {
            const adjustment = this.telemetryFeed(metrics, this);

            // Apply momentum for smooth transitions
            this.momentum = this.momentumDecay * this.momentum + (1 - this.momentumDecay) * adjustment;

            const delta = this.sensitivity * this.momentum;
            this.current += delta;

            // Enforce phi bounds
            if (this.enforceBounds) {
                this.current = Math.max(this.min, Math.min(this.max, this.current));
            }

            // Record history
            this.adjustmentHistory.push({
                timestamp: Date.now(),
                value: this.current,
                delta,
                metrics: { ...metrics }
            });

            if (this.adjustmentHistory.length > this.maxHistorySize) {
                this.adjustmentHistory.shift();
            }

            logger.logSystem(`PhiScale ${this.name} adjusted: ${this.current.toFixed(3)} (Δ${delta.toFixed(4)})`);

            return this.current;
        } catch (err) {
            logger.error(`PhiScale adjustment failed for ${this.name}:`, err);
            return this.current;
        }
    }

    /**
     * Get normalized position in range [0, 1]
     */
    normalized() {
        return this.range.normalize(this.current);
    }

    /**
     * Check if current value is above phi point
     */
    isAbovePhi() {
        return this.range.abovePhiPoint(this.current);
    }

    /**
     * Check if current value is below phi point
     */
    isBelowPhi() {
        return this.range.belowPhiPoint(this.current);
    }

    /**
     * Get distance from phi equilibrium
     */
    phiDeviation() {
        return this.range.distanceFromPhi(this.current);
    }

    /**
     * Reset to base value
     */
    reset() {
        this.current = this.baseValue;
        this.momentum = 0;
        this.adjustmentHistory = [];
        logger.debug(`PhiScale ${this.name} reset to ${this.current}`);
    }

    /**
     * Get statistics
     */
    stats() {
        if (this.adjustmentHistory.length === 0) {
            return {
                current: this.current,
                min: this.min,
                max: this.max,
                samples: 0
            };
        }

        const values = this.adjustmentHistory.map(h => h.value);
        const sum = values.reduce((a, b) => a + b, 0);
        const mean = sum / values.length;
        const variance = values.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / values.length;

        return {
            current: this.current,
            min: this.min,
            max: this.max,
            mean,
            stddev: Math.sqrt(variance),
            samples: this.adjustmentHistory.length,
            range: Math.max(...values) - Math.min(...values)
        };
    }
}

/**
 * PhiBackoff - Phi-exponential backoff intervals
 */
class PhiBackoff {
    constructor(baseInterval = 1000, maxAttempts = 10) {
        this.baseInterval = baseInterval;
        this.maxAttempts = maxAttempts;
        this.attempts = 0;
    }

    /**
     * Get next backoff interval
     * Each attempt multiplies by φ instead of 2
     */
    next() {
        if (this.attempts >= this.maxAttempts) {
            return null; // Max attempts reached
        }

        const interval = this.baseInterval * Math.pow(PHI, this.attempts);
        this.attempts++;

        return Math.floor(interval);
    }

    /**
     * Get Fibonacci-like sequence: 1, φ, φ², φ³...
     */
    sequence() {
        const seq = [];
        for (let i = 0; i < this.maxAttempts; i++) {
            seq.push(Math.floor(this.baseInterval * Math.pow(PHI, i)));
        }
        return seq;
    }

    reset() {
        this.attempts = 0;
    }

    toString() {
        return `PhiBackoff(base=${this.baseInterval}ms, attempts=${this.attempts}/${this.maxAttempts})`;
    }
}

/**
 * PhiDecay - Golden spiral decay function
 */
class PhiDecay {
    constructor(halfLife = 3600000) { // 1 hour default
        this.halfLife = halfLife;
        this.k = Math.log(2) / halfLife; // Decay constant
    }

    /**
     * Compute decay factor at time t
     * r = φ^(θ/90°) where θ = kt
     */
    decay(elapsedTime) {
        const theta = this.k * elapsedTime;
        const thetaDegrees = (theta * 180) / Math.PI;
        return Math.pow(PHI, -thetaDegrees / 90);
    }

    /**
     * Apply decay to a value
     */
    apply(value, elapsedTime) {
        return value * this.decay(elapsedTime);
    }

    /**
     * Get time when value decays to target percentage
     */
    timeToDecay(targetPercent) {
        const theta = -90 * Math.log(targetPercent) / Math.log(PHI);
        const thetaRadians = (theta * Math.PI) / 180;
        return thetaRadians / this.k;
    }
}

/**
 * PhiPartitioner - Fibonacci-based work partitioning
 */
class PhiPartitioner {
    constructor() {
        // Pre-compute first 20 Fibonacci numbers
        this.fibSeq = [1, 1];
        for (let i = 2; i < 20; i++) {
            this.fibSeq.push(this.fibSeq[i - 1] + this.fibSeq[i - 2]);
        }
    }

    /**
     * Get optimal partition size for given work count
     */
    partition(totalWork, availableResources = 1) {
        if (totalWork <= 0) return 1;

        // Find Fibonacci number closest to totalWork / availableResources
        const target = totalWork / availableResources;

        let closest = this.fibSeq[0];
        let minDiff = Math.abs(target - closest);

        for (const fib of this.fibSeq) {
            const diff = Math.abs(target - fib);
            if (diff < minDiff) {
                minDiff = diff;
                closest = fib;
            }
            if (fib > target) break;
        }

        return closest;
    }

    /**
     * Split work into Fibonacci-sized chunks
     */
    split(totalWork, maxChunkSize = null) {
        const chunks = [];
        let remaining = totalWork;

        // Use largest Fibonacci numbers first
        const fibReversed = [...this.fibSeq].reverse();

        for (const fib of fibReversed) {
            if (maxChunkSize && fib > maxChunkSize) continue;

            while (remaining >= fib) {
                chunks.push(fib);
                remaining -= fib;
            }

            if (remaining === 0) break;
        }

        // Add remainder if any
        if (remaining > 0) {
            chunks.push(remaining);
        }

        return chunks;
    }

    /**
     * Get nth Fibonacci number
     */
    fibonacci(n) {
        if (n < this.fibSeq.length) {
            return this.fibSeq[n];
        }

        // Compute if needed
        let a = this.fibSeq[this.fibSeq.length - 2];
        let b = this.fibSeq[this.fibSeq.length - 1];

        for (let i = this.fibSeq.length; i <= n; i++) {
            const next = a + b;
            a = b;
            b = next;
        }

        return b;
    }
}

/**
 * PhiNormalizer - Convert arbitrary scales to phi-normalized coordinates
 */
class PhiNormalizer {
    /**
     * Normalize a 0-N scale to phi coordinates
     */
    static normalize(value, min, max) {
        if (max === min) return PHI_INVERSE;

        const normalized = (value - min) / (max - min);
        return normalized * (1 / PHI_INVERSE); // Scale to phi range
    }

    /**
     * Denormalize from phi coordinates to 0-N scale
     */
    static denormalize(phiValue, min, max) {
        const normalized = phiValue * PHI_INVERSE;
        return min + (normalized * (max - min));
    }

    /**
     * Convert percentage (0-100) to phi-normalized value
     */
    static fromPercent(percent) {
        return (percent / 100) * (1 / PHI_INVERSE);
    }

    /**
     * Convert phi-normalized value to percentage
     */
    static toPercent(phiValue) {
        return (phiValue * PHI_INVERSE) * 100;
    }

    /**
     * Map arbitrary discrete scale to phi partitions
     * e.g., 1-5 priority → phi-partitioned continuous range
     */
    static mapDiscrete(discreteValue, discreteMin, discreteMax) {
        const steps = discreteMax - discreteMin + 1;
        const position = (discreteValue - discreteMin) / (steps - 1);

        // Map to phi spiral
        const phiPosition = Math.pow(PHI, position * 2 - 1);
        return phiPosition;
    }
}

// Export all classes and constants
module.exports = {
    PHI,
    PHI_INVERSE,
    SQRT_PHI,
    PHI_SQUARED,
    PhiRange,
    PhiScale,
    PhiBackoff,
    PhiDecay,
    PhiPartitioner,
    PhiNormalizer
};
