/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
const Redis = (()=>{try{return require('ioredis')}catch(e){return class{constructor(){};on(){};defineCommand(){};get(){};set(){};pipeline(){return{exec:async()=>[]}}}}})();
const crypto = require('crypto');

/**
 * HeadyBrain Unified Context
 * Seamlessly syncs conversation state between HeadyBuddy (desktop)
 * and HeadyWeb (browser) via Redis PubSub and fast-path storage.
 */
class UnifiedContextManager {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
    }

    generateSessionId(userId) {
        return `sess_${crypto.randomBytes(16).toString('hex')}_${userId}`;
    }

    async saveContext(sessionId, contextPayload) {
        const key = `heady:context:${sessionId}`;
        await this.redis.set(key, JSON.stringify(contextPayload), 'EX', 86400); // 24hr TTL
        // Broadcast for real-time app handoff
        await this.redis.publish('context_sync_channel', JSON.stringify({ sessionId, contextPayload }));
    }

    async fetchContext(sessionId) {
        const data = await this.redis.get(`heady:context:${sessionId}`);
        return data ? JSON.parse(data) : null;
    }
}

module.exports = new UnifiedContextManager();
