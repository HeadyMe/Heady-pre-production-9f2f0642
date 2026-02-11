// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: src/services/scanner-mcp-bridge.js                                                  ║
// ║  LAYER: services                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const fileScanner = require('./file-scanner');
const { taskScheduler } = require('../hc_task_scheduler');
const { mcPlanScheduler } = require('../hc_monte_carlo');

class ScannerMCPBridge {
  constructor() {
    this.taskType = 'file_scan';
    this.registerMCPHandlers();
  }

  registerMCPHandlers() {
    // Register with task scheduler
    taskScheduler.registerHandler(this.taskType, async (task) => {
      const { filePath } = task.payload;
      return await this.scanFile(filePath);
    });

    // Register optimization strategies with Monte Carlo
    mcPlanScheduler.registerTaskType(this.taskType, {
      fast_serial: { concurrency: 1, priority: 'normal' },
      fast_parallel: { concurrency: 8, priority: 'normal' },
      balanced: { concurrency: 4, priority: 'normal' },
      thorough: { concurrency: 2, priority: 'high' }
    });
  }

  async scanFile(filePath) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const result = await fileScanner.scanFile(filePath, content);
      return {
        success: true,
        improvements: result.improvements.length,
        file: filePath
      };
    } catch (err) {
      return {
        success: false,
        error: err.message,
        file: filePath
      };
    }
  }

  async scanProject(rootPath) {
    return await taskScheduler.enqueueBatch({
      type: this.taskType,
      items: (await fileScanner._getCodeFiles(rootPath)).map(filePath => ({
        payload: { filePath }
      }))
    });
  }
}

module.exports = new ScannerMCPBridge();
