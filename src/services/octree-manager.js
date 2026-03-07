'use strict';
/**
 * Octree Manager
 * ════════════════════════════════════════════════════════════
 * In-memory Octree spatial index for O(log n) 3D bounding-box
 * and spherical-radius queries over the Buddy System's
 * coordinate space.
 *
 * API:
 *   insert(id, x, y, z, payload)
 *   remove(id)
 *   rangeQuery(minX, minY, minZ, maxX, maxY, maxZ) → items[]
 *   radiusQuery(cx, cy, cz, r) → items[]
 *   nearest(cx, cy, cz, k) → items[]
 *   size() → count
 * ════════════════════════════════════════════════════════════
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const yaml = require('../core/heady-yaml');

const CONFIG_PATH = path.resolve(__dirname, '../../configs/services/buddy-system-config.yaml');

function loadOctreeConfig() {
    try {
        const cfg = yaml.load(fs.readFileSync(CONFIG_PATH, 'utf8'));
        return cfg.octree || {};
    } catch {
        return { max_depth: 8, min_node_size: 0.01, max_items_per_leaf: 16, bounds: { min: [-1, 0, 0], max: [1, 1, 1] } };
    }
}

// ── Octree Node ─────────────────────────────────────────────
class OctreeNode {
    constructor(minX, minY, minZ, maxX, maxY, maxZ, depth, maxDepth, maxItems) {
        this.minX = minX; this.minY = minY; this.minZ = minZ;
        this.maxX = maxX; this.maxY = maxY; this.maxZ = maxZ;
        this.depth = depth;
        this.maxDepth = maxDepth;
        this.maxItems = maxItems;
        this.items = [];
        this.children = null; // null = leaf, array[8] = internal
    }

    get midX() { return (this.minX + this.maxX) / 2; }
    get midY() { return (this.minY + this.maxY) / 2; }
    get midZ() { return (this.minZ + this.maxZ) / 2; }

    contains(x, y, z) {
        return x >= this.minX && x <= this.maxX &&
            y >= this.minY && y <= this.maxY &&
            z >= this.minZ && z <= this.maxZ;
    }

    intersectsBox(bMinX, bMinY, bMinZ, bMaxX, bMaxY, bMaxZ) {
        return !(bMinX > this.maxX || bMaxX < this.minX ||
            bMinY > this.maxY || bMaxY < this.minY ||
            bMinZ > this.maxZ || bMaxZ < this.minZ);
    }

    subdivide() {
        const { minX, minY, minZ, maxX, maxY, maxZ, midX, midY, midZ, depth, maxDepth, maxItems } = this;
        const d = depth + 1;
        this.children = [
            new OctreeNode(minX, minY, minZ, midX, midY, midZ, d, maxDepth, maxItems),
            new OctreeNode(midX, minY, minZ, maxX, midY, midZ, d, maxDepth, maxItems),
            new OctreeNode(minX, midY, minZ, midX, maxY, midZ, d, maxDepth, maxItems),
            new OctreeNode(midX, midY, minZ, maxX, maxY, midZ, d, maxDepth, maxItems),
            new OctreeNode(minX, minY, midZ, midX, midY, maxZ, d, maxDepth, maxItems),
            new OctreeNode(midX, minY, midZ, maxX, midY, maxZ, d, maxDepth, maxItems),
            new OctreeNode(minX, midY, midZ, midX, maxY, maxZ, d, maxDepth, maxItems),
            new OctreeNode(midX, midY, midZ, maxX, maxY, maxZ, d, maxDepth, maxItems),
        ];
        // Re-insert existing items into children
        for (const item of this.items) {
            this._insertIntoChildren(item);
        }
        this.items = [];
    }

    _insertIntoChildren(item) {
        for (const child of this.children) {
            if (child.contains(item.x, item.y, item.z)) {
                child.insert(item);
                return;
            }
        }
        // Edge case: item exactly on boundary — put in first matching child
        this.children[0].items.push(item);
    }

    insert(item) {
        if (!this.contains(item.x, item.y, item.z)) return false;

        if (this.children) {
            this._insertIntoChildren(item);
            return true;
        }

        this.items.push(item);
        if (this.items.length > this.maxItems && this.depth < this.maxDepth) {
            this.subdivide();
        }
        return true;
    }

    remove(id) {
        if (this.children) {
            for (const child of this.children) {
                if (child.remove(id)) return true;
            }
            return false;
        }
        const idx = this.items.findIndex(i => i.id === id);
        if (idx !== -1) { this.items.splice(idx, 1); return true; }
        return false;
    }

    queryBox(bMinX, bMinY, bMinZ, bMaxX, bMaxY, bMaxZ, results) {
        if (!this.intersectsBox(bMinX, bMinY, bMinZ, bMaxX, bMaxY, bMaxZ)) return;

        if (this.children) {
            for (const child of this.children) {
                child.queryBox(bMinX, bMinY, bMinZ, bMaxX, bMaxY, bMaxZ, results);
            }
            return;
        }

        for (const item of this.items) {
            if (item.x >= bMinX && item.x <= bMaxX &&
                item.y >= bMinY && item.y <= bMaxY &&
                item.z >= bMinZ && item.z <= bMaxZ) {
                results.push(item);
            }
        }
    }

    countAll() {
        if (this.children) {
            return this.children.reduce((s, c) => s + c.countAll(), 0);
        }
        return this.items.length;
    }

    allItems(results) {
        if (this.children) {
            for (const child of this.children) child.allItems(results);
            return;
        }
        results.push(...this.items);
    }
}

// ── Octree Manager (public API) ─────────────────────────────
class OctreeManager {
    constructor(config) {
        const cfg = config || loadOctreeConfig();
        const bounds = cfg.bounds || { min: [-1, 0, 0], max: [1, 1, 1] };
        this.maxDepth = cfg.max_depth || 8;
        this.maxItems = cfg.max_items_per_leaf || 16;
        this.root = new OctreeNode(
            bounds.min[0], bounds.min[1], bounds.min[2],
            bounds.max[0], bounds.max[1], bounds.max[2],
            0, this.maxDepth, this.maxItems,
        );
        this._index = new Map(); // id → { x, y, z, payload }
    }

    /**
     * Insert a spatial item.
     * @param {string} id
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {*} payload
     * @returns {boolean}
     */
    insert(id, x, y, z, payload) {
        if (this._index.has(id)) this.remove(id);
        const item = { id, x, y, z, payload };
        const ok = this.root.insert(item);
        if (ok) this._index.set(id, item);
        return ok;
    }

    /**
     * Remove by id.
     */
    remove(id) {
        if (!this._index.has(id)) return false;
        this.root.remove(id);
        this._index.delete(id);
        return true;
    }

    /**
     * Axis-aligned bounding box query.
     * @returns {Array<{ id, x, y, z, payload }>}
     */
    rangeQuery(minX, minY, minZ, maxX, maxY, maxZ) {
        const results = [];
        this.root.queryBox(minX, minY, minZ, maxX, maxY, maxZ, results);
        return results;
    }

    /**
     * Spherical radius query.
     * @param {number} cx center X
     * @param {number} cy center Y
     * @param {number} cz center Z
     * @param {number} r radius
     * @returns {Array<{ id, x, y, z, payload, distance }>}
     */
    radiusQuery(cx, cy, cz, r) {
        // Bounding box pre-filter
        const box = this.rangeQuery(cx - r, cy - r, cz - r, cx + r, cy + r, cz + r);
        const r2 = r * r;
        return box
            .map(item => {
                const d2 = (item.x - cx) ** 2 + (item.y - cy) ** 2 + (item.z - cz) ** 2;
                return d2 <= r2 ? { ...item, distance: Math.sqrt(d2) } : null;
            })
            .filter(Boolean)
            .sort((a, b) => a.distance - b.distance);
    }

    /**
     * K-nearest neighbors.
     */
    nearest(cx, cy, cz, k = 5) {
        // Start with expanding radius search
        let radius = 0.1;
        let results = [];
        for (let attempt = 0; attempt < 10 && results.length < k; attempt++) {
            results = this.radiusQuery(cx, cy, cz, radius);
            radius *= 2;
        }
        return results.slice(0, k);
    }

    /** Total items in the tree. */
    size() { return this._index.size; }

    /** Check if id exists. */
    has(id) { return this._index.has(id); }

    /** Get item by id. */
    get(id) { return this._index.get(id) || null; }

    /** Get all items. */
    all() {
        const results = [];
        this.root.allItems(results);
        return results;
    }

    /** Clear the entire tree. */
    clear() {
        const cfg = loadOctreeConfig();
        const bounds = cfg.bounds || { min: [-1, 0, 0], max: [1, 1, 1] };
        this.root = new OctreeNode(
            bounds.min[0], bounds.min[1], bounds.min[2],
            bounds.max[0], bounds.max[1], bounds.max[2],
            0, this.maxDepth, this.maxItems,
        );
        this._index.clear();
    }

    /** Stats about tree structure. */
    stats() {
        return {
            totalItems: this.size(),
            maxDepth: this.maxDepth,
            maxItemsPerLeaf: this.maxItems,
            bounds: {
                min: [this.root.minX, this.root.minY, this.root.minZ],
                max: [this.root.maxX, this.root.maxY, this.root.maxZ],
            },
        };
    }
}

// ── Express Route Registration ──────────────────────────────
function registerRoutes(app, octreeInstance) {
    const prefix = '/api/octree';
    const tree = octreeInstance || new OctreeManager();

    app.get(`${prefix}/health`, (_req, res) => {
        res.json({ status: 'ok', service: 'octree-manager', stats: tree.stats() });
    });

    app.post(`${prefix}/insert`, (req, res) => {
        try {
            const { id, x, y, z, payload } = req.body || {};
            if (!id) return res.status(400).json({ error: 'id required' });
            const ok = tree.insert(id, x, y, z, payload);
            res.json({ ok, size: tree.size() });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post(`${prefix}/query/radius`, (req, res) => {
        try {
            const { cx, cy, cz, radius } = req.body || {};
            const results = tree.radiusQuery(cx || 0, cy || 0, cz || 0, radius || 0.2);
            res.json({ ok: true, count: results.length, results });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post(`${prefix}/query/nearest`, (req, res) => {
        try {
            const { cx, cy, cz, k } = req.body || {};
            const results = tree.nearest(cx || 0, cy || 0, cz || 0, k || 5);
            res.json({ ok: true, count: results.length, results });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.get(`${prefix}/stats`, (_req, res) => {
        res.json({ ok: true, stats: tree.stats() });
    });

    return tree;
}

module.exports = { OctreeNode, OctreeManager, registerRoutes, loadOctreeConfig };
