// ============================================================
// ARENA MODE API ENDPOINTS
// ============================================================

const HeadyArenaMode = require('../arena/heady-arena-mode');
const express = require('express');
const router = express.Router();

/**
 * Start Arena Mode competition
 */
router.post('/start', async (req, res) => {
  try {
    const { task, strategies, scoring, cleanup } = req.body;
    
    if (!task || !task.description) {
      return res.status(400).json({
        error: 'Task description is required',
        required: ['task.description', 'task.complexity']
      });
    }
    
    const arena = new HeadyArenaMode();
    const result = await arena.run(task, { strategies, scoring, cleanup });
    
    res.json({
      status: 'success',
      arena: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Arena Mode start error:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get Arena Mode status
 */
router.get('/status', async (req, res) => {
  try {
    // Check if arena is currently running
    const isRunning = global.arenaInstance && global.arenaInstance.results;
    
    if (!isRunning) {
      return res.json({
        status: 'idle',
        message: 'No Arena Mode currently running',
        timestamp: new Date().toISOString()
      });
    }
    
    const arena = global.arenaInstance;
    const completedCount = Object.values(arena.results)
      .filter(r => r.status === 'completed').length;
    
    res.json({
      status: 'running',
      arenaId: arena.arenaId,
      progress: {
        total: Object.keys(arena.repos).length,
        completed: completedCount,
        failed: Object.values(arena.results)
          .filter(r => r.status === 'failed').length
      },
      results: arena.results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Arena status error:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Synchronize repositories (Phase 1 only)
 */
router.post('/sync', async (req, res) => {
  try {
    const arena = new HeadyArenaMode();
    const mainSHA = await arena.synchronize();
    
    res.json({
      status: 'success',
      mainSHA,
      message: 'All repositories synchronized',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Arena sync error:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Create arena branches (Phase 2 only)
 */
router.post('/branch', async (req, res) => {
  try {
    const arena = new HeadyArenaMode();
    await arena.synchronize(); // Ensure sync first
    await arena.branch();
    
    res.json({
      status: 'success',
      arenaId: arena.arenaId,
      branches: Object.entries(arena.repos).map(([repo, config]) => ({
        repo,
        branch: config.branch
      })),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Arena branch error:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Evaluate completed arena branches
 */
router.post('/evaluate', async (req, res) => {
  try {
    const { arenaId, criteria } = req.body;
    
    if (!global.arenaInstance) {
      return res.status(400).json({
        error: 'No Arena Mode instance found'
      });
    }
    
    const evaluation = await global.arenaInstance.evaluate(criteria);
    
    res.json({
      status: 'success',
      evaluation,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Arena evaluation error:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
