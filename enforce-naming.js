/**
 * 🏷️ NAMING STANDARDS ENFORCEMENT SCRIPT
 * Ensures all names follow Heady conventions
 */

const { HeadyNamingEnforcer } = require('./src/naming-enforcer');
const fs = require('fs').promises;
const path = require('path');

async function enforceNaming() {
  console.log('🏷️ Starting naming standards enforcement...');
  
  const enforcer = new HeadyNamingEnforcer();
  
  // Scan source directories
  const scanDirs = ['src', 'scripts', 'admin-ui/src'];
  
  for (const dir of scanDirs) {
    try {
      await enforcer.scanDirectory(dir);
    } catch (err) {
      console.log(`⚠️ Could not scan ${dir}: ${err.message}`);
    }
  }
  
  // Generate report
  const report = enforcer.getReport();
  
  console.log('📊 Naming Standards Report:');
  console.log(`  Total Violations: ${report.totalViolations}`);
  console.log(`  Auto Fixed: ${report.autoFixed}`);
  console.log(`  Status: ${report.status}`);
  
  if (report.totalViolations > 0) {
    console.log('\n🔧 Recent Violations:');
    report.violations.slice(-5).forEach(v => {
      console.log(`  - ${v.type}: ${v.name} (${v.reason})`);
    });
  }
  
  return report;
}

enforceNaming().catch(console.error);
