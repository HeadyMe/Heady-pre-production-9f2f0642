// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Heady Systems - HCFP Full Auto Mode        ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: health-checks.js                              ║
// ║  UPDATED: 20260219-162200                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * Health Check API Routes
 * Provides comprehensive monitoring for all production domains
 */

const express = require('express');
const { getHealthCheckSystem } = require('../health-checks');
const router = express.Router();

// Get singleton health check instance
const healthCheck = getHealthCheckSystem({
  interval: 30000, // 30 seconds
  timeout: 5000    // 5 seconds
});

// Middleware to ensure health checks are running
router.use((req, res, next) => {
  if (!healthCheck.isRunning) {
    healthCheck.start();
  }
  next();
});

/**
 * GET /api/health-checks
 * Run all health checks and return comprehensive results
 */
router.get('/', async (req, res) => {
  try {
    const results = await healthCheck.runAllChecks();
    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/health-checks/status
 * Get health check system status
 */
router.get('/status', (req, res) => {
  try {
    const status = healthCheck.getSystemStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/health-checks/history/:domain
 * Get health check history for a specific domain
 */
router.get('/history/:domain', (req, res) => {
  try {
    const { domain } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const history = healthCheck.getHistory(domain, limit);
    
    res.json({
      success: true,
      data: {
        domain,
        history,
        count: history.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/health-checks/alerts
 * Get all alerts or filtered by level
 */
router.get('/alerts', (req, res) => {
  try {
    const { level } = req.query;
    const alerts = healthCheck.getAlerts(level);
    
    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length,
        level: level || 'all'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/health-checks/start
 * Start health check monitoring
 */
router.post('/start', (req, res) => {
  try {
    healthCheck.start();
    res.json({
      success: true,
      message: 'Health checks started',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/health-checks/stop
 * Stop health check monitoring
 */
router.post('/stop', (req, res) => {
  try {
    healthCheck.stop();
    res.json({
      success: true,
      message: 'Health checks stopped',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/health-checks/test
 * Test a specific endpoint
 */
router.post('/test', async (req, res) => {
  try {
    const { url, expectedStatus = 200, expectedContent = [], timeout = 5000 } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    const result = await healthCheck.checkEndpoint(url, {
      url,
      expectedStatus,
      expectedContent,
      timeout
    });

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/health-checks/summary
 * Get a summary of system health
 */
router.get('/summary', async (req, res) => {
  try {
    const results = await healthCheck.runAllChecks();
    const summary = {
      overall: results.overall,
      domains: Object.keys(results.results).map(domain => ({
        domain,
        healthy: results.results[domain].healthy,
        status: results.results[domain].status,
        responseTime: results.results[domain].responseTime,
        critical: healthCheck.endpoints[domain]?.critical || false
      })),
      alerts: results.alerts,
      timestamp: results.timestamp
    };

    res.json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * WebSocket endpoint for real-time health updates
 * This would be integrated with a WebSocket server
 */
router.get('/stream', (req, res) => {
  // Set up Server-Sent Events for real-time updates
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Send initial status
  res.write(`data: ${JSON.stringify({
    type: 'initial',
    data: healthCheck.getSystemStatus()
  })}\n\n`);

  // Listen for health check events
  const onCheckResult = (result) => {
    res.write(`data: ${JSON.stringify({
      type: 'checkResult',
      data: result
    })}\n\n`);
  };

  const onAlert = (alert) => {
    res.write(`data: ${JSON.stringify({
      type: 'alert',
      data: alert
    })}\n\n`);
  };

  const onOverallHealth = (health) => {
    res.write(`data: ${JSON.stringify({
      type: 'overallHealth',
      data: health
    })}\n\n`);
  };

  // Subscribe to events
  healthCheck.on('checkResult', onCheckResult);
  healthCheck.on('alert', onAlert);
  healthCheck.on('overallHealth', onOverallHealth);

  // Clean up on disconnect
  req.on('close', () => {
    healthCheck.removeListener('checkResult', onCheckResult);
    healthCheck.removeListener('alert', onAlert);
    healthCheck.removeListener('overallHealth', onOverallHealth);
  });
});

module.exports = router;
