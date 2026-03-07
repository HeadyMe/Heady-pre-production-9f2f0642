import { Router } from 'express';
import { TaskOrchestrator } from '../orchestrator';
import { validateRequest, HeadyLogger } from '@headysystems/core';
import { z } from 'zod';

const logger = new HeadyLogger('tasks-router');

const TaskSchema = z.object({
  type: z.string(),
  priority: z.number().min(0).max(1),
  metadata: z.record(z.any()).optional()
});

export function tasksRouter(orchestrator: TaskOrchestrator): Router {
  const router = Router();

  router.post('/', async (req, res, next) => {
    try {
      const data = validateRequest(TaskSchema, req.body);

      const task = {
        id: \`task-\${Date.now()}\`,
        ...data,
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const assignment = await orchestrator.assignTask(task);

      res.json({
        task,
        assignment,
        latency: assignment.latency
      });

    } catch (error) {
      next(error);
    }
  });

  return router;
}
