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
// ║  FILE: server.js                                   ║
// ║  UPDATED: 20260219-162200                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * Heady Systems Main Server
 * Express.js server with health checks, error reporting, and AI routing
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Import routes and middleware
const healthCheckRoutes = require('./routes/health-checks');
const { getHealthCheckSystem } = require('./health-checks');
const { getAiRouter } = require('./ai-router/hc-ai-router-simple');
const { decomposeAndExecute, startBattle, loadBattleConfig } = require('./hcmontecarlo');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3300;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.headyme.com", "https://api.headysystems.com", "https://api.headyconnection.org", "https://api.headymcp.com", "https://api.headybuddy.org", "https://api.headyio.com", "https://headyio.com"]
    }
  }
}));

// CORS configuration - allow production domains only
const corsOptions = {
  origin: [
    'https://headyme.com',
    'https://www.headyme.com',
    'https://admin.headyme.com',
    'https://api.headyme.com',
    'https://headysystems.com',
    'https://app.headysystems.com',
    'https://api.headysystems.com',
    'https://admin.headysystems.com',
    'https://manager.headysystems.com',
    'https://headymcp.com',
    'https://api.headymcp.com',
    'https://headybuddy.org',
    'https://api.headybuddy.org',
    'https://headyio.com',
    'https://api.headyio.com',
    'https://headyconnection.org',
    'https://app.headyconnection.org',
    'https://api.headyconnection.org',
    'https://headybot.com'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Performance middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health Check System Integration
const healthCheck = getHealthCheckSystem({
  interval: 30000, // 30 seconds
  timeout: 5000    // 5 seconds
});

// Start health check monitoring
healthCheck.start();

// Log health check events
healthCheck.on('alert', (alert) => {
  console.warn(`🚨 Health Alert [${alert.level}]: ${alert.message}`);
});

healthCheck.on('overallHealth', (health) => {
  if (health.status === 'critical') {
    console.error(`🚨 CRITICAL SYSTEM HEALTH: ${health.score}% (${health.healthyDomains}/${health.totalDomains} healthy)`);
  } else if (health.status === 'degraded') {
    console.warn(`⚠️ System Health Degraded: ${health.score}%`);
  } else {
    console.log(`✅ System Health: ${health.status} (${health.score}%)`);
  }
});

// AI Router Integration
let aiRouter = null;

async function initializeAiRouter() {
  try {
    aiRouter = getAiRouter();
    console.log('🧠 AI Router initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize AI Router:', error);
  }
}

// API Routes
app.use('/api/health-checks', healthCheckRoutes);

/**
 * GET /api/health
 * Basic health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * GET /api/status
 * Comprehensive system status
 */
app.get('/api/status', async (req, res) => {
  try {
    const healthStatus = healthCheck.getSystemStatus();
    const aiRouterHealth = aiRouter ? await aiRouter.getHealth() : null;
    
    res.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      healthChecks: healthStatus,
      aiRouter: aiRouterHealth,
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/frontend-errors
 * Frontend error reporting endpoint
 */
app.post('/api/frontend-errors', (req, res) => {
  try {
    const errorReport = {
      ...req.body,
      receivedAt: new Date().toISOString(),
      serverEnvironment: process.env.NODE_ENV || 'development'
    };
    
    // Log the error
    console.error('🚨 Frontend Error Report:', {
      message: errorReport.error?.message || errorReport.message,
      url: errorReport.url,
      userId: errorReport.userId,
      timestamp: errorReport.timestamp
    });
    
    // Store error for analysis (in production, this would go to a database)
    // For now, we'll just acknowledge receipt
    
    res.json({
      status: 'received',
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error processing frontend error report:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process error report'
    });
  }
});

/**
 * POST /api/ai-router/route
 * AI Router task execution endpoint
 */
app.post('/api/ai-router/route', async (req, res) => {
  try {
    if (!aiRouter) {
      return res.status(503).json({
        status: 'error',
        message: 'AI Router not available'
      });
    }

    const { task, prompt, options } = req.body;
    
    if (!task || !prompt) {
      return res.status(400).json({
        status: 'error',
        message: 'Task and prompt are required'
      });
    }

    const result = await aiRouter.runTask(task, prompt, options);
    
    res.json({
      status: 'success',
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI Router error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * GET /api/ai-router/health
 * AI Router health status
 */
app.get('/api/ai-router/health', async (req, res) => {
  try {
    if (!aiRouter) {
      return res.status(503).json({
        status: 'error',
        message: 'AI Router not initialized'
      });
    }

    const health = await aiRouter.getHealth();
    res.json({
      status: 'success',
      data: health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * POST /api/HeadySims/decompose
 * Decompose a task into subtasks using HeadyMC ultra-fast decomposition
 */
app.post('/api/HeadySims/decompose', async (req, res) => {
  try {
    const { task, options } = req.body;
    
    if (!task || !task.id) {
      return res.status(400).json({
        status: 'error',
        message: 'Task with ID is required'
      });
    }

    const result = await decomposeAndExecute(task, options || {});
    
    res.json({
      status: 'success',
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('MC decompose error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * POST /api/HeadySims/battle/start
 * Start HeadyBattle mode for large coding tasks
 */
app.post('/api/HeadySims/battle/start', async (req, res) => {
  try {
    const { task, options } = req.body;
    
    if (!task || !task.id) {
      return res.status(400).json({
        status: 'error',
        message: 'Task with ID is required'
      });
    }

    const battleConfig = loadBattleConfig();
    const result = await startBattle(task, battleConfig, options || {});
    
    res.json({
      status: 'success',
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('HeadyBattle start error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * GET /api/HeadySims/battle/:battleId/status
 * Get HeadyBattle status
 */
app.get('/api/HeadySims/battle/:battleId/status', (req, res) => {
  const { battleId } = req.params;
  
  const battleStatus = activeBattles?.get(battleId) || {
    battleId,
    status: 'not_found',
    phase: 'idle',
    progress: 0
  };
  
  res.json({
    status: 'success',
    data: battleStatus,
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/HeadySims/battle/:battleId/finalize
 * Finalize HeadyBattle (merge staging to main)
 */
app.post('/api/HeadySims/battle/:battleId/finalize', async (req, res) => {
  try {
    const { battleId } = req.params;
    const { targetBranch = 'main' } = req.body;
    
    // Finalize the battle by merging results
    res.json({
      status: 'success',
      data: {
        battleId,
        targetBranch,
        message: 'Battle finalization not yet implemented'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Battle finalize error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});
app.get('/api/ai-router/metrics', async (req, res) => {
  try {
    if (!aiRouter) {
      return res.status(503).json({
        status: 'error',
        message: 'AI Router not initialized'
      });
    }

    const metrics = aiRouter.getMetrics();
    res.json({
      status: 'success',
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * Serve static files for frontend
 */
app.use(express.static('public'));

/**
 * SPA fallback - serve index.html for all non-API routes
 */
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      status: 'error',
      message: 'API endpoint not found'
    });
  }
  
  res.sendFile('index.html', { root: 'public' });
});

/**
 * Global error handler
 */
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  res.status(error.status || 500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    timestamp: new Date().toISOString()
  });
});

/**
 * Graceful shutdown handler
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  // Stop health checks
  healthCheck.stop();
  
  // Close server
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  
  // Stop health checks
  healthCheck.stop();
  
  // Close server
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server
const server = app.listen(PORT, async () => {
  console.log(`🚀 Heady Systems Server started on port ${PORT}`);
  console.log(`📊 Health checks monitoring: https://api.headyme.com/api/health-checks`);
  console.log(`🧠 AI Router status: https://api.headyme.com/api/ai-router/health`);
  
  // Initialize AI Router
  await initializeAiRouter();
  
  // Run initial health check
  setTimeout(async () => {
    try {
      const results = await healthCheck.runAllChecks();
      console.log(`🏥 Initial health check complete: ${results.overall.status} (${results.overall.score}%)`);
    } catch (error) {
      console.error('Initial health check failed:', error);
    }
  }, 1000);
});

module.exports = app;
