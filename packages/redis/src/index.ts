import Redis, { Cluster } from 'ioredis';
import { HeadyLogger } from '@headysystems/core';

export interface RedisPoolConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  cluster?: boolean;
  clusterNodes?: { host: string; port: number }[];
  maxRetries?: number;
  connectTimeout?: number;
  commandTimeout?: number;
}

export class HeadyRedisPool {
  private pool: Redis | Cluster;
  private logger: HeadyLogger;

  constructor(config: RedisPoolConfig) {
    this.logger = new HeadyLogger('redis-pool');

    const poolConfig = {
      maxRetriesPerRequest: config.maxRetries || 3,
      enableReadyCheck: true,
      enableOfflineQueue: false,
      connectTimeout: config.connectTimeout || 2000,
      commandTimeout: config.commandTimeout || 10000,
      keepAlive: 30000,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    };

    if (config.cluster && config.clusterNodes) {
      this.pool = new Cluster(config.clusterNodes, {
        redisOptions: { ...poolConfig, password: config.password },
        clusterRetryStrategy: (times) => Math.min(100 * times, 2000)
      });
      this.logger.info('Redis Cluster pool initialized');
    } else {
      this.pool = new Redis({
        host: config.host || 'localhost',
        port: config.port || 6379,
        password: config.password,
        db: config.db || 0,
        ...poolConfig
      });
      this.logger.info('Redis standalone pool initialized');
    }

    this.setupMonitoring();
  }

  private setupMonitoring(): void {
    this.pool.on('connect', () => {
      this.logger.info('Connected to Redis');
    });

    this.pool.on('error', (err) => {
      this.logger.error('Redis error', err);
    });

    // Health check every 30s
    setInterval(() => {
      this.pool.ping((err) => {
        if (err) {
          this.logger.error('Redis health check failed', err);
        }
      });
    }, 30000);
  }

  async getConnection(): Promise<Redis | Cluster> {
    return this.pool;
  }

  async close(): Promise<void> {
    await this.pool.quit();
    this.logger.info('Redis pool closed');
  }

  /**
   * Calculate optimal pool size based on workload
   * Formula from redis.io best practices
   */
  static calculatePoolSize(
    concurrentRequests: number,
    redisOpsPerRequest: number,
    redisOpLatencyMs: number,
    requestDurationMs: number
  ): number {
    const redisTimePerRequest = redisOpsPerRequest * redisOpLatencyMs;
    const redisFraction = redisTimePerRequest / requestDurationMs;
    const estimated = concurrentRequests * redisFraction;

    // Add 20% buffer for burst traffic
    return Math.ceil(estimated * 1.2);
  }
}
