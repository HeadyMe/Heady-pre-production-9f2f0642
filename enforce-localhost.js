/**
 * 🚫 LOCALHOST ELIMINATION ENFORCEMENT SCRIPT
 * Scans and fixes ALL manager.headyme.com references
 */

const { LocalhostEliminator } = require('./src/manager.headyme.com-eliminator');
const fs = require('fs').promises;
const path = require('path');

async function enforceLocalhost() {
  console.log('🚫 Starting manager.headyme.com elimination enforcement...');
  
  const eliminator = new LocalhostEliminator();
  
  // Scan entire codebase
  await eliminator.enforceAtStartup(__dirname);
  
  // Generate report
  const report = eliminator.getReport();
  
  console.log('📊 Localhost Elimination Report:');
  console.log(`  Total Violations: ${report.totalViolations}`);
  console.log(`  Auto Fixed: ${report.autoFixed}`);
  console.log(`  Status: ${report.status}`);
  
  if (report.totalViolations > 0) {
    console.log('\n🔧 Recent Violations:');
    report.recentViolations.slice(-5).forEach(v => {
      console.log(`  - ${v.context}: ${v.pattern}`);
    });
  }
  
  return report;
}

enforceLocalhost().catch(console.error);
