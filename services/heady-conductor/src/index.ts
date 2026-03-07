import express from 'express';
import { HeadyLogger, loadConfig, BaseServiceConfigSchema } from '@headysystems/core';
import { HeadyRedisPool } from '@headysystems/redis';
import { TaskOrchestrator } from './orchestrator';
import { healthRouter } from './routes/health';
import { tasksRouter } from './routes/tasks';

const config = loadConfig(BaseServiceConfigSchema);
const logger = new HeadyLogger('heady-conductor');
const app = express();

// Initialize Redis pool
const redisPool = new HeadyRedisPool({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  db: config.REDIS_DB
});

// Initialize task orchestrator
const orchestrator = new TaskOrchestrator(redisPool);

app.use(express.json());
app.use('/health', healthRouter);
app.use('/tasks', tasksRouter(orchestrator));

const PORT = config.PORT || 3002;

app.listen(PORT, () => {
  logger.info(\`HeadyConductor listening on port \${PORT}\`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await redisPool.close();
  process.exit(0);
});
