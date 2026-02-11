#!/usr/bin/env node
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
// ║  FILE: scripts/claude-scan-cli.js                                                  ║
// ║  LAYER: cli                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const { program } = require('commander');
const scanner = require('../src/services/file-scanner');
const mcpBridge = require('../src/services/scanner-mcp-bridge');
const fs = require('fs').promises;
const path = require('path');

program
  .name('heady-scan')
  .description('Heady Socratic File Scanner using Claude')
  .version('1.0.0');

program.command('scan <path>')
  .description('Scan a file or directory')
  .option('--strategy <type>', 'Scan strategy (fast_serial, fast_parallel, balanced, thorough)', 'balanced')
  .action(async (filePath, options) => {
    try {
      const stat = await fs.stat(filePath);
      
      if (stat.isDirectory()) {
        console.log(`Starting project scan (${options.strategy} strategy)`);
        const results = await mcpBridge.scanProject(filePath);
        console.log(`Scan complete. ${results.length} files processed.`);
      } else {
        console.log(`Scanning file: ${path.basename(filePath)}`);
        const result = await scanner.scanFile(filePath, await fs.readFile(filePath, 'utf8'));
        console.log(`Found ${result.improvements.length} improvements`);
      }
    } catch (err) {
      console.error('Scan failed:', err.message);
      process.exit(1);
    }
  });

program.command('patterns')
  .description('View improvement patterns found')
  .action(async () => {
    // Would integrate with pattern engine
    console.log('Pattern analysis coming soon');
  });

program.parseAsync(process.argv).catch(console.error);
