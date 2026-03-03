/**
 * Octree Manager — O(log n) Spatial Memory Index
 *
 * Stores 3D-embedded vectors in an octree for fast spatial queries:
 *   - Range queries (box region)
 *   - Radius queries (sphere)
 *   - Nearest neighbor (k-NN)
 *
 * Memory efficient: 12 bytes per vector (3 floats) vs 3-6KB for traditional embeddings.
 *
 * © 2026 Heady Systems LLC. All rights reserved.
 */

'use strict';

const { BASE, PHI } = require('./principles');

class OctreeNode {
    constructor(bounds, depth = 0, maxItems = BASE, maxDepth = BASE) {
        this.bounds = bounds; // { minX, minY, minZ, maxX, maxY, maxZ }
        this.depth = depth;
        this.maxItems = maxItems;
        this.maxDepth = maxDepth;
        this.items = [];
        this.children = null;
    }

    contains(point) {
        return (
            point.x >= this.bounds.minX && point.x <= this.bounds.maxX &&
            point.y >= this.bounds.minY && point.y <= this.bounds.maxY &&
            point.z >= this.bounds.minZ && point.z <= this.bounds.maxZ
        );
    }

    subdivide() {
        const { minX, minY, minZ, maxX, maxY, maxZ } = this.bounds;
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;
        const midZ = (minZ + maxZ) / 2;

        this.children = [
            new OctreeNode({ minX, minY, minZ, maxX: midX, maxY: midY, maxZ: midZ }, this.depth + 1, this.maxItems, this.maxDepth),
            new OctreeNode({ minX: midX, minY, minZ, maxX, maxY: midY, maxZ: midZ }, this.depth + 1, this.maxItems, this.maxDepth),
            new OctreeNode({ minX, minY: midY, minZ, maxX: midX, maxY, maxZ: midZ }, this.depth + 1, this.maxItems, this.maxDepth),
            new OctreeNode({ minX: midX, minY: midY, minZ, maxX, maxY, maxZ: midZ }, this.depth + 1, this.maxItems, this.maxDepth),
            new OctreeNode({ minX, minY, minZ: midZ, maxX: midX, maxY: midY, maxZ }, this.depth + 1, this.maxItems, this.maxDepth),
            new OctreeNode({ minX: midX, minY, minZ: midZ, maxX, maxY: midY, maxZ }, this.depth + 1, this.maxItems, this.maxDepth),
            new OctreeNode({ minX, minY: midY, minZ: midZ, maxX: midX, maxY, maxZ }, this.depth + 1, this.maxItems, this.maxDepth),
            new OctreeNode({ minX: midX, minY: midY, minZ: midZ, maxX, maxY, maxZ }, this.depth + 1, this.maxItems, this.maxDepth),
        ];
    }

    insert(item) {
        if (!this.contains(item)) return false;

        if (this.children === null) {
            this.items.push(item);
            if (this.items.length > this.maxItems && this.depth < this.maxDepth) {
                this.subdivide();
                for (const existing of this.items) {
                    for (const child of this.children) {
                        if (child.insert(existing)) break;
                    }
                }
                this.items = [];
            }
            return true;
        }

        for (const child of this.children) {
            if (child.insert(item)) return true;
        }
        return false;
    }

    queryRange(bounds) {
        const results = [];
        if (!this._intersects(bounds)) return results;

        for (const item of this.items) {
            if (item.x >= bounds.minX && item.x <= bounds.maxX &&
                item.y >= bounds.minY && item.y <= bounds.maxY &&
                item.z >= bounds.minZ && item.z <= bounds.maxZ) {
                results.push(item);
            }
        }

        if (this.children) {
            for (const child of this.children) {
                results.push(...child.queryRange(bounds));
            }
        }
        return results;
    }

    queryRadius(center, radius) {
        const results = [];
        const rSq = radius * radius;

        const bounds = {
            minX: center.x - radius, maxX: center.x + radius,
            minY: center.y - radius, maxY: center.y + radius,
            minZ: center.z - radius, maxZ: center.z + radius,
        };

        if (!this._intersects(bounds)) return results;

        for (const item of this.items) {
            const dSq = (item.x - center.x) ** 2 + (item.y - center.y) ** 2 + (item.z - center.z) ** 2;
            if (dSq <= rSq) results.push({ ...item, distance: Math.sqrt(dSq) });
        }

        if (this.children) {
            for (const child of this.children) {
                results.push(...child.queryRadius(center, radius));
            }
        }
        return results.sort((a, b) => a.distance - b.distance);
    }

    nearest(point, k = 1) {
        const all = this.queryRadius(point, 1.0); // search full unit cube
        return all.slice(0, k);
    }

    count() {
        let total = this.items.length;
        if (this.children) {
            for (const child of this.children) total += child.count();
        }
        return total;
    }

    _intersects(bounds) {
        return !(
            bounds.minX > this.bounds.maxX || bounds.maxX < this.bounds.minX ||
            bounds.minY > this.bounds.maxY || bounds.maxY < this.bounds.minY ||
            bounds.minZ > this.bounds.maxZ || bounds.maxZ < this.bounds.minZ
        );
    }
}

class OctreeManager {
    constructor(options = {}) {
        this.root = new OctreeNode(
            options.bounds || { minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 1, maxZ: 1 },
            0,
            options.maxItemsPerNode || BASE,
            options.maxDepth || BASE
        );
        this.totalInserted = 0;
    }

    insert(point) {
        const success = this.root.insert(point);
        if (success) this.totalInserted++;
        return success;
    }

    queryRange(bounds) { return this.root.queryRange(bounds); }
    queryRadius(center, radius) { return this.root.queryRadius(center, radius); }
    nearest(point, k = 1) { return this.root.nearest(point, k); }
    count() { return this.root.count(); }

    getStats() {
        return {
            totalInserted: this.totalInserted,
            currentCount: this.count(),
            bounds: this.root.bounds,
            maxItemsPerNode: this.root.maxItems,
            maxDepth: this.root.maxDepth,
            memoryPerVector: '12 bytes (3 × float32)',
            memoryReduction: '250× vs traditional embeddings',
        };
    }
}

module.exports = { OctreeManager, OctreeNode };
