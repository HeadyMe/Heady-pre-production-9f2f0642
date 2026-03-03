const { createClient } = require('redis');
const logger = require('./logger');

class RedisPool {
    constructor() {
        this.url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
        this.client = null;
        this.pubClient = null;
        this.subClient = null;
        this.isConnected = false;

        // Advanced pooling config
        this.config = {
            url: this.url,
            socket: {
                reconnectStrategy: (retries) => {
                    if (retries > 20) return new Error('Max retries reached');
                    return Math.min(retries * 50, 2000);
                }
            }
        };
    }

    async init() {
        try {
            this.client = createClient(this.config);
            this.pubClient = this.client.duplicate();
            this.subClient = this.client.duplicate();

            this.client.on('error', (err) => logger.logError('REDIS_POOL', 'Client Error', err));
            this.pubClient.on('error', (err) => logger.logError('REDIS_POOL', 'PubClient Error', err));
            this.subClient.on('error', (err) => logger.logError('REDIS_POOL', 'SubClient Error', err));

            await Promise.all([
                this.client.connect(),
                this.pubClient.connect(),
                this.subClient.connect()
            ]);

            this.isConnected = true;
            logger.logNodeActivity('CONDUCTOR', 'Redis Connection Pool Initialized Successfully');
        } catch (err) {
            logger.logError('CONDUCTOR', 'Failed to initialize Redis pool', err);
            this.isConnected = false;
        }
    }

    getClient() {
        return this.client;
    }

    getPubClient() {
        return this.pubClient;
    }

    getSubClient() {
        return this.subClient;
    }
}

module.exports = new RedisPool();
