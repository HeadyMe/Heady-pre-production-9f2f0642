// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██╗██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Heady Systems - HCFP Full Auto Mode        ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: heady-manager-extensions.js                              ║
// ║  UPDATED: 20260219-154500                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * HeadyManager Extensions
 * Adds MC/Battle endpoints and integrates Headypromoter routing
 */

const express = require('express');
const Headypromoter = require('../hc/Headypromoter-simple');
const { decomposeAndExecute, startBattle } = require('../hc/hcmontecarlo');
const { loadConfig } = require('../core/resource-manager');

class HeadyManagerExtensions {
  constructor(managerInstance) {
    this.manager = managerInstance;
    this.promoter = new Headypromoter();
    this.battleConfig = null;
    this.activeBattles = new Map();
    
    this.initialize();
  }

  async initialize() {
    console.log('[HeadyManagerExtensions] Initializing...');
    
    try {
      await this.promoter.initialize();
      this.battleConfig = loadConfig('heady-battle.yaml');
      console.log('[HeadyManagerExtensions] Initialization complete');
    } catch (error) {
      console.error('[HeadyManagerExtensions] Initialization failed:', error);
    }
  }

  /**
   * Create Express router extensions
   */
  createExtensionsRouter() {
    const router = express.Router();
    
    // MC Decompose endpoint
    router.post('/HeadySims/decompose', async (req, res) => {
      try {
        const { task, options } = req.body;
        
        if (!task || !task.id) {
          return res.status(400).json({
            error: 'invalid_request',
            message: 'Task with ID is required'
          });
        }
        
        console.log(`[HeadyManager] Decomposing task ${task.id}`);
        
        const result = await decomposeAndExecute(task, options || {});
        
        res.json({
          success: true,
          result,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('[HeadyManager] MC decompose error:', error);
        res.status(500).json({
          error: 'mc_decompose_failed',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // HeadyBattle start endpoint
    router.post('/HeadySims/battle/start', async (req, res) => {
      try {
        const { task, options } = req.body;
        
        if (!task || !task.id) {
          return res.status(400).json({
            error: 'invalid_request',
            message: 'Task with ID is required'
          });
        }
        
        console.log(`[HeadyManager] Starting HeadyBattle for task ${task.id}`);
        
        const battleResult = await startBattle(task, this.battleConfig, options || {});
        
        // Track active battle
        this.activeBattles.set(battleResult.battleId, {
          task,
          battleResult,
          startTime: new Date().toISOString(),
          status: 'running'
        });
        
        res.json({
          success: true,
          battle: battleResult,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('[HeadyManager] HeadyBattle start error:', error);
        res.status(500).json({
          error: 'heady_battle_start_failed',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // HeadyBattle status endpoint
    router.get('/HeadySims/battle/:battleId/status', async (req, res) => {
      try {
        const { battleId } = req.params;
        const battle = this.activeBattles.get(battleId);
        
        if (!battle) {
          return res.status(404).json({
            error: 'battle_not_found',
            battleId,
            timestamp: new Date().toISOString()
          });
        }
        
        // Get detailed status from orchestrator
        const detailedStatus = battle.battleResult.orchestrator.getBattleStatus(battle.task.id);
        
        res.json({
          success: true,
          battleId,
          status: detailedStatus,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('[HeadyManager] Battle status error:', error);
        res.status(500).json({
          error: 'battle_status_failed',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // HeadyBattle promote endpoint
    router.post('/HeadySims/battle/:battleId/promote', async (req, res) => {
      try {
        const { battleId } = req.params;
        const { devBranch, targetStagingBranch } = req.body;
        
        const battle = this.activeBattles.get(battleId);
        if (!battle) {
          return res.status(404).json({
            error: 'battle_not_found',
            battleId
          });
        }
        
        console.log(`[HeadyManager] Promoting ${devBranch} to ${targetStagingBranch}`);
        
        const success = await battle.battleResult.orchestrator.promoteDevToStaging(
          devBranch,
          targetStagingBranch,
          true // require tests
        );
        
        res.json({
          success,
          devBranch,
          targetStagingBranch,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('[HeadyManager] Battle promote error:', error);
        res.status(500).json({
          error: 'battle_promote_failed',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // HeadyBattle finalize endpoint
    router.post('/HeadySims/battle/:battleId/finalize', async (req, res) => {
      try {
        const { battleId } = req.params;
        const { targetBranch = 'main' } = req.body;
        
        const battle = this.activeBattles.get(battleId);
        if (!battle) {
          return res.status(404).json({
            error: 'battle_not_found',
            battleId
          });
        }
        
        console.log(`[HeadyManager] Finalizing battle ${battleId} to ${targetBranch}`);
        
        const finalizeResult = await battle.battleResult.orchestrator.finalizeBattle(
          battle.task.id,
          targetBranch
        );
        
        // Update battle status
        battle.status = finalizeResult.success ? 'completed' : 'failed';
        battle.endTime = new Date().toISOString();
        
        res.json({
          success: true,
          finalizeResult,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('[HeadyManager] Battle finalize error:', error);
        res.status(500).json({
          error: 'battle_finalize_failed',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // List active battles
    router.get('/HeadySims/battles', (req, res) => {
      const battles = Array.from(this.activeBattles.entries()).map(([id, battle]) => ({
        battleId: id,
        taskId: battle.task.id,
        taskType: battle.task.type,
        status: battle.status,
        startTime: battle.startTime,
        subtaskCount: battle.battleResult.subtaskCount,
        devBranches: battle.battleResult.devBranches.length,
        stagingBranches: battle.battleResult.stagingBranches.length
      }));
      
      res.json({
        success: true,
        battles,
        timestamp: new Date().toISOString()
      });
    });
    
    // promoter routing endpoint
    router.post('/promoter/route', async (req, res) => {
      try {
        const result = await this.promoter.routeEvent(req.body, req.body.options);
        res.json(result);
      } catch (error) {
        console.error('[HeadyManager] promoter routing error:', error);
        res.status(500).json({
          error: 'promoter_routing_failed',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // promoter status endpoint
    router.get('/promoter/status', (req, res) => {
      res.json(this.promoter.getSystemStatus());
    });
    
    // promoter routing history
    router.get('/promoter/history', (req, res) => {
      const limit = parseInt(req.query.limit) || 50;
      res.json(this.promoter.getRoutingHistory(limit));
    });
    
    // promoter workflow status
    router.get('/promoter/workflow/:id', (req, res) => {
      const status = this.promoter.getWorkflowStatus(req.params.id);
      if (!status) {
        return res.status(404).json({
          error: 'workflow_not_found',
          workflowId: req.params.id
        });
      }
      res.json(status);
    });
    
    // Refresh promoter cache
    router.post('/promoter/refresh', async (req, res) => {
      try {
        await this.promoter.refreshCache();
        res.json({
          success: true,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          error: 'refresh_failed',
          message: error.message
        });
      }
    });
    
    return router;
  }

  /**
   * Integration method to wire extensions into existing manager
   */
  integrateWithManager(app) {
    // Mount the extensions router
    app.use('/api', this.createExtensionsRouter());
    
    // Add middleware to track requests
    app.use((req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        console.log(`[HeadyManager] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
      });
      
      next();
    });
    
    console.log('[HeadyManagerExtensions] Integrated with HeadyManager');
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus() {
    const promoterStatus = this.promoter.getSystemStatus();
    const battleStatus = {
      activeBattles: this.activeBattles.size,
      totalSubtasks: Array.from(this.activeBattles.values())
        .reduce((sum, battle) => sum + (battle.battleResult.subtaskCount || 0), 0),
      totalBranches: Array.from(this.activeBattles.values())
        .reduce((sum, battle) => sum + battle.battleResult.devBranches.length + battle.battleResult.stagingBranches.length, 0)
    };
    
    return {
      promoter: promoterStatus,
      battles: battleStatus,
      extensions: {
        status: 'active',
        version: '1.0.0',
        endpoints: [
          'POST /api/HeadySims/decompose',
          'POST /api/HeadySims/battle/start',
          'GET /api/HeadySims/battle/:id/status',
          'POST /api/HeadySims/battle/:id/promote',
          'POST /api/HeadySims/battle/:id/finalize',
          'GET /api/HeadySims/battles',
          'POST /api/promoter/route',
          'GET /api/promoter/status',
          'GET /api/promoter/history',
          'GET /api/promoter/workflow/:id',
          'POST /api/promoter/refresh'
        ]
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = HeadyManagerExtensions;
