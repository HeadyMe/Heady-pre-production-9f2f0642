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
// ║  FILE: scripts/setup-error-logging.js                                                    ║
// ║  LAYER: automation                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '..', '.windsurf');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Create daily error log
const now = new Date();
const logFile = path.join(logDir, `error-${now.toISOString().split('T')[0]}.log`);

// Initialize log with timestamp
if (!fs.existsSync(logFile)) {
  fs.writeFileSync(logFile, `[${now.toISOString()}] Error logging initialized\n`);
}

// Error handling function
module.exports = {
  logError: (error) => {
    const timestamp = new Date().toISOString();
    const errorMessage = `[${timestamp}] ${error.stack || error}\n`;
    fs.appendFileSync(logFile, errorMessage);
    
    // Also log to console for immediate visibility
    console.error(`[Windsurf Error] ${errorMessage}`);
  },
  getRecentErrors: () => {
    return fs.readFileSync(logFile, 'utf-8');
  }
};
