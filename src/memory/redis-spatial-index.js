/**
 * Redis Spatial Indexing — Geospatial coordinate tracking for
 * high-frequency agent/projection position updates using Redis GEO commands.
 *
 * Uses GEOADD/GEOPOS/GEORADIUS for O(log(N)) spatial queries,
 * enabling sub-millisecond nearest-neighbor lookups for collision
 * detection and proximity-based agent coordination.
 *
 * @module src/memory/redis-spatial-index
 * @version 1.0.0
 * @author HeadySystems™
 * @license Proprietary — HeadySystems™ & HeadyConnection™
 */

'use strict';

const { EventEmitter } = require('events');

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377];

// Redis GEO uses lng/lat mapping. We map 3D → 2D+height.
// X → longitude (-180..180), Z → latitude (-85..85), Y → stored as hash field

const COORD_SCALE = 180 / 55; // Map [-55, 55] vector space → [-180, 180] geo range
const LAT_SCALE = 85 / 55;

/**
 * RedisSpatialIndex — manages agent and projection positions
 * in Redis geospatial indexes for O(log N) proximity queries.
 */
class RedisSpatialIndex {
    /**
     * @param {Object} redisClient — ioredis or node-redis client
     * @param {Object} opts
     * @param {string} opts.prefix — Redis key prefix
     * @param {number} opts.collisionRadius — min distance for collision detection (vector units)
     * @param {number} opts.maxHistory — max position history entries per entity
     */
    constructor(redisClient, opts = {}) {
        this.redis = redisClient;
        this.prefix = opts.prefix || 'heady:spatial';
        this.collisionRadius = opts.collisionRadius || PHI; // ~1.618 units
        this.maxHistory = opts.maxHistory || FIB[10]; // 55 entries
        this.events = new EventEmitter();

        // Keys
        this.geoKey = `${this.prefix}:geo`;           // GEOADD positions
        this.heightKey = `${this.prefix}:height`;      // HSET Y coordinates
        this.historyPrefix = `${this.prefix}:trail`;   // LIST per entity
        this.metaKey = `${this.prefix}:meta`;           // HSET entity metadata
        this.statsKey = `${this.prefix}:stats`;         // HSET global stats
    }

    // ─── Coordinate Mapping ─────────────────────────────────────────

    /** Convert vector X to Redis GEO longitude */
    _xToLng(x) { return Math.max(-180, Math.min(180, x * COORD_SCALE)); }

    /** Convert vector Z to Redis GEO latitude */
    _zToLat(z) { return Math.max(-85.05, Math.min(85.05, z * LAT_SCALE)); }

    /** Convert Redis GEO longitude back to vector X */
    _lngToX(lng) { return lng / COORD_SCALE; }

    /** Convert Redis GEO latitude back to vector Z */
    _latToZ(lat) { return lat / LAT_SCALE; }

    /** Convert collision radius from vector units to meters (approx for Redis) */
    _radiusToMeters(r) { return r * 111320 * COORD_SCALE; }

    // ─── Core Operations ───────────────────────────────────────────

    /**
     * Update entity position in the spatial index.
     * @param {string} entityId — agent or projection ID
     * @param {number} x — X coordinate in 3D vector space
     * @param {number} y — Y coordinate (height)
     * @param {number} z — Z coordinate
     * @param {Object} meta — optional metadata (type, status, etc.)
     */
    async updatePosition(entityId, x, y, z, meta = {}) {
        const lng = this._xToLng(x);
        const lat = this._zToLat(z);
        const pipeline = this.redis.pipeline();

        // 1. Store 2D position in GEO index
        pipeline.geoadd(this.geoKey, lng, lat, entityId);

        // 2. Store Y (height) separately
        pipeline.hset(this.heightKey, entityId, y.toString());

        // 3. Append to position history (ring buffer via LPUSH + LTRIM)
        const historyKey = `${this.historyPrefix}:${entityId}`;
        const entry = JSON.stringify({ x, y, z, t: Date.now() });
        pipeline.lpush(historyKey, entry);
        pipeline.ltrim(historyKey, 0, this.maxHistory - 1);

        // 4. Store metadata
        if (Object.keys(meta).length > 0) {
            pipeline.hset(this.metaKey, entityId, JSON.stringify(meta));
        }

        // 5. Increment update counter
        pipeline.hincrby(this.statsKey, 'total_updates', 1);

        await pipeline.exec();

        // 6. Check for collisions in vicinity
        await this._checkCollisions(entityId, x, y, z);
    }

    /**
     * Get entity's current 3D position.
     * @returns {{ x: number, y: number, z: number } | null}
     */
    async getPosition(entityId) {
        const [geoPos, yStr] = await Promise.all([
            this.redis.geopos(this.geoKey, entityId),
            this.redis.hget(this.heightKey, entityId),
        ]);

        if (!geoPos || !geoPos[0]) return null;
        const [lng, lat] = geoPos[0];

        return {
            x: this._lngToX(parseFloat(lng)),
            y: parseFloat(yStr || '0'),
            z: this._latToZ(parseFloat(lat)),
        };
    }

    /**
     * Find all entities within radius of a 3D point.
     * @param {number} x, y, z — center point
     * @param {number} radius — search radius in vector units
     * @returns {Array<{ id: string, x: number, y: number, z: number, distance: number }>}
     */
    async findNearby(x, y, z, radius = 5) {
        const lng = this._xToLng(x);
        const lat = this._zToLat(z);
        const meters = this._radiusToMeters(radius);

        // Redis GEORADIUS for 2D proximity
        const results = await this.redis.georadius(
            this.geoKey, lng, lat, meters, 'm',
            'WITHCOORD', 'WITHDIST', 'ASC', 'COUNT', FIB[10]
        );

        if (!results || results.length === 0) return [];

        // Enrich with Y coordinate and compute true 3D distance
        const enriched = [];
        for (const [id, distStr, [rLng, rLat]] of results) {
            const ry = parseFloat(await this.redis.hget(this.heightKey, id) || '0');
            const rx = this._lngToX(parseFloat(rLng));
            const rz = this._latToZ(parseFloat(rLat));
            const dist3d = Math.sqrt((x - rx) ** 2 + (y - ry) ** 2 + (z - rz) ** 2);

            if (dist3d <= radius) {
                enriched.push({ id, x: rx, y: ry, z: rz, distance: dist3d });
            }
        }

        return enriched;
    }

    /**
     * Get movement trail for an entity.
     * @returns {Array<{ x, y, z, t }>}
     */
    async getTrail(entityId, count = 50) {
        const historyKey = `${this.historyPrefix}:${entityId}`;
        const entries = await this.redis.lrange(historyKey, 0, count - 1);
        return entries.map(e => JSON.parse(e));
    }

    /**
     * Remove entity from spatial index.
     */
    async removeEntity(entityId) {
        const pipeline = this.redis.pipeline();
        pipeline.zrem(this.geoKey, entityId);
        pipeline.hdel(this.heightKey, entityId);
        pipeline.del(`${this.historyPrefix}:${entityId}`);
        pipeline.hdel(this.metaKey, entityId);
        await pipeline.exec();
    }

    /**
     * List all tracked entities with positions.
     * @returns {Array<{ id, x, y, z }>}
     */
    async listAll() {
        const members = await this.redis.zrangebyscore(this.geoKey, '-inf', '+inf');
        if (!members.length) return [];

        const positions = await this.redis.geopos(this.geoKey, ...members);
        const heights = await this.redis.hmget(this.heightKey, ...members);

        return members.map((id, i) => {
            const [lng, lat] = positions[i] || [0, 0];
            return {
                id,
                x: this._lngToX(parseFloat(lng)),
                y: parseFloat(heights[i] || '0'),
                z: this._latToZ(parseFloat(lat)),
            };
        });
    }

    /**
     * Compute drift — how far entity has moved from its φ-anchor.
     */
    async computeDrift(entityId, anchorX, anchorY, anchorZ) {
        const pos = await this.getPosition(entityId);
        if (!pos) return null;
        return Math.sqrt(
            (pos.x - anchorX) ** 2 + (pos.y - anchorY) ** 2 + (pos.z - anchorZ) ** 2
        );
    }

    /**
     * Get global stats.
     */
    async getStats() {
        const stats = await this.redis.hgetall(this.statsKey);
        const entityCount = (await this.redis.zcard(this.geoKey)) || 0;
        return {
            totalUpdates: parseInt(stats?.total_updates || '0'),
            totalCollisions: parseInt(stats?.total_collisions || '0'),
            entityCount,
        };
    }

    // ─── Collision Detection ────────────────────────────────────────

    async _checkCollisions(entityId, x, y, z) {
        const nearby = await this.findNearby(x, y, z, this.collisionRadius);
        for (const other of nearby) {
            if (other.id === entityId) continue;
            if (other.distance < this.collisionRadius * PSI) {
                await this.redis.hincrby(this.statsKey, 'total_collisions', 1);
                this.events.emit('collision', {
                    entityA: entityId,
                    entityB: other.id,
                    distance: other.distance,
                    timestamp: Date.now(),
                });
            }
        }
    }
}

module.exports = { RedisSpatialIndex };
