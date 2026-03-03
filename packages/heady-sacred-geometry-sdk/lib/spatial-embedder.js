/**
 * Spatial Embedder — 3D Coordinate Embedding for Agent Memory
 *
 * Maps any data payload to a 3D coordinate:
 *   X = Semantic Domain (content category hash → [0,1])
 *   Y = Temporal State (timestamp normalized → [0,1])
 *   Z = Hierarchy Level (agent depth in Sacred Geometry tree)
 *
 * © 2026 Heady Systems LLC. All rights reserved.
 */

'use strict';

const crypto = require('crypto');
const { PHI, PHI_INV, goldenSplit, BASE } = require('./principles');

class SpatialEmbedder {
    constructor(options = {}) {
        this.temporalWindow = options.temporalWindow || 86400000 * 30; // 30 days default
        this.temporalOrigin = options.temporalOrigin || Date.now() - this.temporalWindow;
        this.maxDepth = options.maxDepth || BASE; // 13 hierarchy levels
        this.domainMap = new Map();
        this.nextDomainSlot = 0;
    }

    /**
     * Embed a payload into 3D coordinates
     * @param {object} payload - { content, domain, timestamp, depth }
     * @returns {{ x: number, y: number, z: number, metadata: object }}
     */
    embed(payload) {
        const { content = '', domain = 'general', timestamp = Date.now(), depth = 0 } = payload;

        const x = this._semanticX(domain, content);
        const y = this._temporalY(timestamp);
        const z = this._hierarchyZ(depth);

        return {
            x: Number(x.toFixed(8)),
            y: Number(y.toFixed(8)),
            z: Number(z.toFixed(8)),
            metadata: {
                domain,
                timestamp,
                depth,
                contentHash: this._hash(content).slice(0, 16),
                embeddedAt: Date.now(),
            },
        };
    }

    /**
     * Semantic X-axis: domain → golden-ratio-distributed [0,1]
     * Uses golden angle distribution for maximally distinct positioning
     */
    _semanticX(domain, content) {
        if (!this.domainMap.has(domain)) {
            this.domainMap.set(domain, this.nextDomainSlot++);
        }
        const domainIndex = this.domainMap.get(domain);
        // Golden angle distribution → maximally distinct
        const goldenAngle = PHI_INV;
        const base = (domainIndex * goldenAngle) % 1.0;
        // Add content hash perturbation for within-domain spread
        const hashNum = parseInt(this._hash(content).slice(0, 8), 16);
        const perturbation = (hashNum / 0xFFFFFFFF) * 0.05; // ±5% within domain zone
        return Math.max(0, Math.min(1, base + perturbation));
    }

    /**
     * Temporal Y-axis: timestamp → normalized [0,1]
     * Recent = high Y, old = low Y
     */
    _temporalY(timestamp) {
        const elapsed = timestamp - this.temporalOrigin;
        return Math.max(0, Math.min(1, elapsed / this.temporalWindow));
    }

    /**
     * Hierarchy Z-axis: depth → φ-normalized [0,1]
     * Root agents are at Z=1, deeper agents at lower Z
     * Uses inverse φ power for natural golden ratio spacing
     */
    _hierarchyZ(depth) {
        return Math.pow(PHI_INV, depth);
    }

    /**
     * Calculate distance between two 3D points
     * @param {object} a - { x, y, z }
     * @param {object} b - { x, y, z }
     * @returns {number} Euclidean distance
     */
    distance(a, b) {
        return Math.sqrt(
            (a.x - b.x) ** 2 +
            (a.y - b.y) ** 2 +
            (a.z - b.z) ** 2
        );
    }

    /**
     * Find semantically related region using golden split
     * @param {number} x - semantic position
     * @returns {{ major: number, minor: number }}
     */
    semanticRegion(x) {
        return goldenSplit(Math.max(0, x - 0.1), Math.min(1, x + 0.1));
    }

    _hash(content) {
        return crypto.createHash('sha256').update(String(content)).digest('hex');
    }

    /**
     * Get embedding stats
     */
    getStats() {
        return {
            domainsRegistered: this.domainMap.size,
            temporalWindow: this.temporalWindow,
            maxDepth: this.maxDepth,
            domains: Object.fromEntries(this.domainMap),
        };
    }
}

module.exports = { SpatialEmbedder };
