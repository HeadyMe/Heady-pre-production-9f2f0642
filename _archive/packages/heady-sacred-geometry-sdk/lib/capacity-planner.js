/**
 * Capacity Planner — φ-Derived Resource Allocation for Agent Systems
 *
 * Plans resource allocation using Golden Ratio proportional scaling.
 * All parameters derive from: BASE^tier × PHI^level.
 *
 * © 2026 Heady Systems LLC. All rights reserved.
 */

'use strict';

const {
    PHI, PHI_INV, PHI_SQ, PHI_CUBE,
    BASE, LOG_BASE, HEADY_CYCLE,
    phiScale, goldenSplit, phiBackoff, phiThresholds, phiHarmonics,
    capacityParams, toTier
} = require('./principles');

class CapacityPlanner {
    constructor(tier = 'medium') {
        this.tier = tier;
        this.params = capacityParams(tier);
        this._allocations = new Map();
    }

    /**
     * Allocate resources between two competing agents using golden split
     * @param {string} primaryId - primary agent
     * @param {string} secondaryId - secondary agent
     * @param {number} totalBudget - total resource units
     * @returns {{ primary: number, secondary: number }}
     */
    allocate(primaryId, secondaryId, totalBudget) {
        const split = goldenSplit(0, totalBudget);
        const allocation = {
            primary: { id: primaryId, budget: Math.round(split.major) },
            secondary: { id: secondaryId, budget: Math.round(totalBudget - split.major) },
            ratio: `${split.majorPct.toFixed(1)}% / ${split.minorPct.toFixed(1)}%`,
        };
        this._allocations.set(`${primaryId}:${secondaryId}`, allocation);
        return allocation;
    }

    /**
     * Compute retry delay for a given attempt using φ-backoff
     * @param {number} attempt - attempt number (0-based)
     * @returns {number} delay in ms
     */
    retryDelay(attempt) {
        return phiBackoff(attempt, 1000, this.params.timeoutMs);
    }

    /**
     * Generate alert thresholds for monitoring
     * @param {number} count - number of threshold levels
     * @returns {number[]} percentage thresholds
     */
    alertThresholds(count = 5) {
        return phiThresholds(count);
    }

    /**
     * Scale agent capacity for a given hierarchy level
     * @param {number} level - hierarchy depth
     * @returns {object} scaled capacity parameters
     */
    scaleForLevel(level) {
        return {
            connections: Math.round(phiScale(this.params.maxConnections, -level)),
            vectors: Math.round(phiScale(this.params.maxVectors, -level)),
            cache: Math.round(phiScale(this.params.cacheEntries, -level)),
            timeout: Math.round(phiScale(this.params.timeoutMs, level * 0.5)),
        };
    }

    /**
     * Generate a harmonic capacity series for scaling
     * @param {number} baseCapacity
     * @param {number} levels
     * @returns {number[]}
     */
    harmonicSeries(baseCapacity, levels = 8) {
        return phiHarmonics(baseCapacity, levels);
    }

    /**
     * Classify a metric into a Sacred Geometry tier
     * @param {number} normalizedValue - 0 to 1
     * @returns {{ tier: number, label: string, base13: string }}
     */
    classify(normalizedValue) {
        return toTier(normalizedValue);
    }

    /**
     * Get current planner state
     */
    getState() {
        return {
            tier: this.tier,
            params: this.params,
            activeAllocations: this._allocations.size,
            backoffCurve: Array.from({ length: BASE }, (_, i) => ({
                attempt: i,
                delayMs: Math.round(this.retryDelay(i)),
            })),
        };
    }
}

module.exports = { CapacityPlanner };
