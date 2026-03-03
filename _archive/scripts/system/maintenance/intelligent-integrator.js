/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🧠 HC INTELLIGENT INTEGRATOR - Smart Data Consolidation');
console.log('====================================================\n');

// Load consolidation plan
const consolidationPlan = JSON.parse(fs.readFileSync('/home/headyme/consolidation-plan.json', 'utf8'));

console.log('📋 LOADED CONSOLIDATION PLAN:');
console.log(`   Timestamp: ${consolidationPlan.timestamp}`);
console.log(`   Primary Repo: ${consolidationPlan.consolidationPlan.primaryRepo}`);
console.log(`   Actions: ${consolidationPlan.consolidationPlan.actions.length}`);
console.log(`   Conflicts: ${consolidationPlan.consolidationPlan.conflicts.length}\n`);

// Smart integration strategies
const INTEGRATION_STRATEGIES = {
  // Priority-based file merging
  PRIORITY_MERGE: {
    config: ['.env', 'package.json', 'docker-compose.yml'],
    strategy: 'LARGEST_MOST_RECENT'
  },
  
  // Code integration with conflict resolution
  CODE_INTEGRATION: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.py', '.php'],
    strategy: 'MERGE_WITH_MARKERS'
  },
  
  // Documentation consolidation
  DOCS_CONSOLIDATION: {
    extensions: ['.md', '.txt', '.rst'],
    strategy: 'COMBINE_WITH_TOC'
  },
  
  // Asset management
  ASSET_MANAGEMENT: {
    extensions: ['.png', '.jpg', '.svg', '.css', '.scss'],
    strategy: 'UNIQUE_RENAME'
  }
};

// Function to determine file category
function categorizeFile(filePath) {
  const ext = path.extname(filePath);
  const base = path.basename(filePath);
  
  for (const [category, config] of Object.entries(INTEGRATION_STRATEGIES)) {
    if (config && config.extensions && config.extensions.includes(ext)) {
      return category;
    }
    if (config && config.config && config.config.includes(base)) {
      return category;
    }
  }
  
  return 'GENERIC';
}

// Function to safely copy files with conflict resolution
function smartCopy(sourcePath, targetPath, strategy = 'OVERWRITE') {
  try {
    // Ensure target directory exists
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Handle existing files
    if (fs.existsSync(targetPath)) {
      switch (strategy) {
        case 'MERGE_WITH_MARKERS':
          return mergeWithMarkers(sourcePath, targetPath);
          
        case 'COMBINE_WITH_TOC':
          return combineWithTOC(sourcePath, targetPath);
          
        case 'UNIQUE_RENAME':
          const timestamp = Date.now();
          const ext = path.extname(targetPath);
          const base = path.basename(targetPath, ext);
          const newPath = path.join(targetDir, `${base}_${timestamp}${ext}`);
          fs.copyFileSync(sourcePath, newPath);
          return { action: 'RENAMED', path: newPath };
          
        case 'LARGEST_MOST_RECENT':
          const sourceStats = fs.statSync(sourcePath);
          const targetStats = fs.statSync(targetPath);
          
          if (sourceStats.size > targetStats.size || sourceStats.mtime > targetStats.mtime) {
            fs.copyFileSync(sourcePath, targetPath);
            return { action: 'REPLACED', path: targetPath, reason: 'LARGER_OR_NEWER' };
          }
          return { action: 'KEPT_EXISTING', path: targetPath };
          
        default:
          fs.copyFileSync(sourcePath, targetPath);
          return { action: 'OVERWRITTEN', path: targetPath };
      }
    } else {
      // Simple copy for new files
      fs.copyFileSync(sourcePath, targetPath);
      return { action: 'COPIED', path: targetPath };
    }
  } catch (error) {
    return { action: 'ERROR', error: error.message };
  }
}

// Function to merge code files with markers
function mergeWithMarkers(sourcePath, targetPath) {
  try {
    const sourceContent = fs.readFileSync(sourcePath, 'utf8');
    const targetContent = fs.readFileSync(targetPath, 'utf8');
    
    const sourceName = path.basename(path.dirname(sourcePath));
    const targetName = path.basename(path.dirname(targetPath));
    
    const mergedContent = `// MERGED FROM ${sourceName.toUpperCase()}\n${sourceContent}\n\n// ORIGINAL ${targetName.toUpperCase()}\n${targetContent}\n`;
    
    fs.writeFileSync(targetPath, mergedContent);
    return { action: 'MERGED_WITH_MARKERS', path: targetPath };
  } catch (error) {
    return { action: 'ERROR', error: error.message };
  }
}

// Function to combine documentation with TOC
function combineWithTOC(sourcePath, targetPath) {
  try {
    const sourceContent = fs.readFileSync(sourcePath, 'utf8');
    const targetContent = fs.readFileSync(targetPath, 'utf8');
    
    const sourceName = path.basename(path.dirname(sourcePath));
    const targetName = path.basename(path.dirname(targetPath));
    
    const toc = `# Combined Documentation\n\n## Table of Contents\n- [${targetName}](#${targetName.toLowerCase()})\n- [${sourceName}](#${sourceName.toLowerCase()})\n\n`;
    
    const combinedContent = `${toc}## ${targetName}\n\n${targetContent}\n\n---\n\n## ${sourceName}\n\n${sourceContent}\n`;
    
    fs.writeFileSync(targetPath, combinedContent);
    return { action: 'COMBINED_WITH_TOC', path: targetPath };
  } catch (error) {
    return { action: 'ERROR', error: error.message };
  }
}

// Function to integrate files from source to target
function integrateFiles(sourceRepo, targetRepo, files) {
  console.log(`\n🔄 INTEGRATING: ${sourceRepo.name} → ${targetRepo.name}`);
  
  const results = {
    successful: [],
    failed: [],
    skipped: []
  };
  
  files.forEach(file => {
    const category = categorizeFile(file.path);
    const strategy = INTEGRATION_STRATEGIES[category]?.strategy || 'OVERWRITE';
    
    // Construct target path
    const relativePath = file.path.replace(sourceRepo.path, '');
    const targetPath = path.join(targetRepo.path, relativePath);
    
    console.log(`   📄 ${file.path} (${category})`);
    
    const result = smartCopy(file.path, targetPath, strategy);
    
    if (result.action === 'ERROR') {
      results.failed.push({ file: file.path, error: result.error });
      console.log(`     ❌ ERROR: ${result.error}`);
    } else {
      results.successful.push({ file: file.path, result });
      console.log(`     ✅ ${result.action}`);
    }
  });
  
  return results;
}

// Function to resolve conflicts
function resolveConflicts(conflicts, targetRepo) {
  console.log(`\n⚠️  RESOLVING CONFLICTS`);
  
  const results = {
    resolved: [],
    failed: []
  };
  
  conflicts.forEach(conflict => {
    console.log(`   🔀 ${conflict.path}`);
    
    // Select the largest/most recent file as winner
    const winner = conflict.instances.reduce((best, current) => {
      if (current.size > best.size) return current;
      if (current.size === best.size && current.modified > best.modified) return current;
      return best;
    });
    
    const targetPath = path.join(targetRepo.path, conflict.path);
    const result = smartCopy(winner.path, targetPath, 'OVERWRITE');
    
    if (result.action === 'ERROR') {
      results.failed.push({ conflict: conflict.path, error: result.error });
      console.log(`     ❌ ERROR: ${result.error}`);
    } else {
      results.resolved.push({ conflict: conflict.path, winner: winner.repo, result });
      console.log(`     ✅ RESOLVED: ${winner.repo} wins`);
    }
  });
  
  return results;
}

// Function to generate integration report
function generateIntegrationReport(integrationResults, conflictResults) {
  console.log('\n📊 INTEGRATION REPORT');
  console.log('===================\n');
  
  const totalSuccessful = integrationResults.reduce((sum, result) => sum + result.successful.length, 0);
  const totalFailed = integrationResults.reduce((sum, result) => sum + result.failed.length, 0);
  const totalConflictsResolved = conflictResults.resolved.length;
  const totalConflictsFailed = conflictResults.failed.length;
  
  console.log(`📈 SUMMARY:`);
  console.log(`   Files Integrated: ${totalSuccessful}`);
  console.log(`   Integration Failures: ${totalFailed}`);
  console.log(`   Conflicts Resolved: ${totalConflictsResolved}`);
  console.log(`   Conflict Resolution Failures: ${totalConflictsFailed}`);
  
  const successRate = totalSuccessful > 0 ? ((totalSuccessful / (totalSuccessful + totalFailed)) * 100).toFixed(2) : 0;
  console.log(`   Success Rate: ${successRate}%`);
  
  return {
    totalSuccessful,
    totalFailed,
    totalConflictsResolved,
    totalConflictsFailed,
    successRate: parseFloat(successRate),
    timestamp: new Date().toISOString()
  };
}

// Main integration function
function main() {
  console.log('🚀 Starting Intelligent Data Integration...\n');
  
  // Determine target repository (most active)
  const targetRepo = consolidationPlan.repositories.find(repo => 
    repo.name === consolidationPlan.consolidationPlan.primaryRepo
  );
  
  console.log(`🎯 Target Repository: ${targetRepo.name}`);
  console.log(`   Path: ${targetRepo.path}`);
  console.log(`   Activity Score: ${targetRepo.modifiedCount + targetRepo.stagedCount + targetRepo.untrackedCount}\n`);
  
  // Group unique files by source repository
  const filesByRepo = {};
  consolidationPlan.consolidationPlan.actions.forEach(action => {
    if (!filesByRepo[action.source]) {
      filesByRepo[action.source] = [];
    }
    filesByRepo[action.source].push({
      path: action.sourcePath,
      size: action.size
    });
  });
  
  // Integrate files from each source repository
  const integrationResults = [];
  Object.entries(filesByRepo).forEach(([sourceName, files]) => {
    const sourceRepo = consolidationPlan.repositories.find(repo => repo.name === sourceName);
    if (sourceRepo && sourceRepo.name !== targetRepo.name) {
      const result = integrateFiles(sourceRepo, targetRepo, files);
      integrationResults.push(result);
    }
  });
  
  // Resolve conflicts
  const conflictResults = resolveConflicts(consolidationPlan.consolidationPlan.conflicts, targetRepo);
  
  // Generate report
  const report = generateIntegrationReport(integrationResults, conflictResults);
  
  // Save integration report
  const reportPath = '/home/headyme/integration-report.json';
  fs.writeFileSync(reportPath, JSON.stringify({
    report,
    integrationResults,
    conflictResults,
    targetRepo: targetRepo.name
  }, null, 2));
  
  console.log(`\n💾 Integration report saved to: ${reportPath}`);
  console.log('\n✅ Intelligent Integration Complete!');
  
  return report;
}

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = { main, smartCopy, integrateFiles, resolveConflicts };
