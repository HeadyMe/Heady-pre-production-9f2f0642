import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  res.json({
    service: 'heady-conductor',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});
