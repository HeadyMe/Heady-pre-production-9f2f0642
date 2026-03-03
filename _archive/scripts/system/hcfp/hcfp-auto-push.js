/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 HCFP AUTO-PUSH - Full Auto Consolidation Deployment');
console.log('====================================================\n');

// Load integration report
const integrationReport = JSON.parse(fs.readFileSync('/home/headyme/integration-report.json', 'utf8'));

console.log('📋 INTEGRATION SUMMARY:');
console.log(`   Files Integrated: ${integrationReport.report.totalSuccessful}`);
console.log(`   Success Rate: ${integrationReport.report.successRate}%`);
console.log(`   Target Repo: ${integrationReport.targetRepo}`);
console.log(`   Timestamp: ${integrationReport.report.timestamp}\n`);

// Find target repository path
const targetRepoPath = integrationReport.targetRepo === 'Heady (CascadeProjects)' 
  ? '/home/headyme/CascadeProjects/Heady'
  : '/home/headyme/Heady';

console.log(`🎯 TARGET REPOSITORY: ${integrationReport.targetRepo}`);
console.log(`   Path: ${targetRepoPath}\n`);

// Function to execute git commands safely
function safeGit(repoPath, command, description) {
  try {
    console.log(`🔄 ${description}...`);
    const result = execSync(command, { 
      cwd: repoPath, 
      encoding: 'utf8',
      timeout: 30000 
    });
    console.log(`   ✅ ${description} completed`);
    return result.trim();
  } catch (error) {
    console.log(`   ❌ ${description} failed: ${error.message}`);
    return null;
  }
}

// Function to stage all changes intelligently
function stageChanges(repoPath) {
  console.log('\n📋 STAGING CHANGES');
  
  try {
    // Get current status
    const status = execSync('git status --porcelain', { 
      cwd: repoPath, 
      encoding: 'utf8' 
    });
    
    if (!status.trim()) {
      console.log('   ℹ️  No changes to stage');
      return [];
    }
    
    const statusLines = status.trim().split('\n');
    const stagedFiles = [];
    
    statusLines.forEach(line => {
      const statusCode = line.substring(0, 2);
      const filePath = line.substring(3);
      
      let action = '';
      switch (statusCode[0]) {
        case '?':
          action = 'add';
          break;
        case 'M':
        case 'A':
        case 'D':
          action = 'add';
          break;
        case 'R':
          action = 'add'; // Renamed files
          break;
        case 'C':
          action = 'add'; // Copied files
          break;
        default:
          action = 'add';
      }
      
      if (action && filePath && !filePath.includes('.git/') && !filePath.includes('node_modules/')) {
        try {
          execSync(`git ${action} "${filePath}"`, { cwd: repoPath });
          stagedFiles.push({ file: filePath, action, status: statusCode });
          console.log(`   ✅ Staged: ${filePath} (${statusCode})`);
        } catch (error) {
          console.log(`   ❌ Failed to stage ${filePath}: ${error.message}`);
        }
      }
    });
    
    console.log(`   📊 Staged ${stagedFiles.length} files`);
    return stagedFiles;
    
  } catch (error) {
    console.log(`   ❌ Error staging changes: ${error.message}`);
    return [];
  }
}

// Function to create intelligent commit message
function createCommitMessage(stagedFiles, integrationReport) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  let message = `🚀 HCFP-FULL-AUTO: 🔄 Project Consolidation Complete\n\n`;
  
  message += `📊 Integration Summary:\n`;
  message += `- Files Integrated: ${integrationReport.report.totalSuccessful}\n`;
  message += `- Success Rate: ${integrationReport.report.successRate}%\n`;
  message += `- Target Repository: ${integrationReport.targetRepo}\n\n`;
  
  // Categorize changes
  const categories = {
    code: [],
    config: [],
    docs: [],
    assets: [],
    other: []
  };
  
  stagedFiles.forEach(file => {
    const ext = path.extname(file.file);
    const base = path.basename(file.file);
    
    if (['.js', '.jsx', '.ts', '.tsx', '.py', '.php'].includes(ext)) {
      categories.code.push(file);
    } else if (['.json', '.yaml', '.yml', '.env', '.config'].includes(ext) || 
               ['package.json', 'docker-compose.yml'].includes(base)) {
      categories.config.push(file);
    } else if (['.md', '.txt', '.rst'].includes(ext)) {
      categories.docs.push(file);
    } else if (['.png', '.jpg', '.svg', '.css', '.scss', '.woff', '.woff2'].includes(ext)) {
      categories.assets.push(file);
    } else {
      categories.other.push(file);
    }
  });
  
  message += `📁 Changes by Category:\n`;
  Object.entries(categories).forEach(([category, files]) => {
    if (files.length > 0) {
      message += `- ${category.toUpperCase()}: ${files.length} files\n`;
    }
  });
  
  message += `\n🔧 Auto-generated commit via HCFP Full Auto Pipeline`;
  message += `\n📅 ${timestamp}\n`;
  
  return message;
}

// Function to push changes with retry logic
function pushChanges(repoPath, branch = 'master') {
  console.log('\n🚀 PUSHING CHANGES');
  
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    attempt++;
    console.log(`   📡 Attempt ${attempt}/${maxRetries}...`);
    
    try {
      // Pull latest changes first
      console.log('   📥 Pulling latest changes...');
      execSync(`git pull origin ${branch}`, { 
        cwd: repoPath, 
        encoding: 'utf8',
        timeout: 60000 
      });
      
      // Push changes
      console.log('   📤 Pushing consolidated changes...');
      const pushResult = execSync(`git push origin ${branch}`, { 
        cwd: repoPath, 
        encoding: 'utf8',
        timeout: 60000 
      });
      
      console.log('   ✅ Push successful!');
      return true;
      
    } catch (error) {
      console.log(`   ❌ Push attempt ${attempt} failed: ${error.message}`);
      
      if (attempt < maxRetries) {
        console.log('   ⏳ Waiting 5 seconds before retry...');
        // Wait 5 seconds before retry
        const start = Date.now();
        while (Date.now() - start < 5000) {
          // Busy wait
        }
      }
    }
  }
  
  console.log(`   ❌ All ${maxRetries} push attempts failed`);
  return false;
}

// Function to generate final report
function generateFinalReport(stagedFiles, commitResult, pushResult) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalStaged: stagedFiles.length,
      commitSuccessful: !!commitResult,
      pushSuccessful: pushResult,
      integrationReport: integrationReport.report
    },
    categories: {},
    files: stagedFiles,
    commitHash: commitResult ? commitResult.substring(0, 8) : null
  };
  
  // Categorize files for final report
  const categories = {
    code: [],
    config: [],
    docs: [],
    assets: [],
    other: []
  };
  
  stagedFiles.forEach(file => {
    const ext = path.extname(file.file);
    const base = path.basename(file.file);
    
    if (['.js', '.jsx', '.ts', '.tsx', '.py', '.php'].includes(ext)) {
      categories.code.push(file);
    } else if (['.json', '.yaml', '.yml', '.env', '.config'].includes(ext) || 
               ['package.json', 'docker-compose.yml'].includes(base)) {
      categories.config.push(file);
    } else if (['.md', '.txt', '.rst'].includes(ext)) {
      categories.docs.push(file);
    } else if (['.png', '.jpg', '.svg', '.css', '.scss', '.woff', '.woff2'].includes(ext)) {
      categories.assets.push(file);
    } else {
      categories.other.push(file);
    }
  });
  
  Object.entries(categories).forEach(([category, files]) => {
    report.categories[category] = files.length;
  });
  
  return report;
}

// Main execution function
function main() {
  console.log('🚀 Starting HCFP Full Auto Push...\n');
  
  // Step 1: Check repository status
  const currentBranch = safeGit(targetRepoPath, 'git branch --show-current', 'Getting current branch');
  if (!currentBranch) {
    console.log('❌ Failed to get current branch. Aborting.');
    return;
  }
  
  console.log(`📍 Current branch: ${currentBranch}`);
  
  // Step 2: Stage all changes
  const stagedFiles = stageChanges(targetRepoPath);
  
  if (stagedFiles.length === 0) {
    console.log('ℹ️  No changes to commit. Skipping push.');
    return;
  }
  
  // Step 3: Create commit
  const commitMessage = createCommitMessage(stagedFiles, integrationReport);
  console.log('\n📝 COMMIT MESSAGE:');
  console.log('================');
  console.log(commitMessage);
  
  const commitResult = safeGit(targetRepoPath, `git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, 'Creating commit');
  
  if (!commitResult) {
    console.log('❌ Failed to create commit. Aborting.');
    return;
  }
  
  console.log(`   ✅ Commit created: ${commitResult.substring(0, 8)}`);
  
  // Step 4: Push changes
  const pushSuccess = pushChanges(targetRepoPath, currentBranch);
  
  // Step 5: Generate final report
  const finalReport = generateFinalReport(stagedFiles, commitResult, pushSuccess);
  
  // Save final report
  const reportPath = '/home/headyme/hcfp-final-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));
  
  console.log('\n📊 FINAL PUSH REPORT');
  console.log('===================');
  console.log(`📈 SUMMARY:`);
  console.log(`   Files Staged: ${finalReport.summary.totalStaged}`);
  console.log(`   Commit: ${finalReport.summary.commitSuccessful ? 'SUCCESS' : 'FAILED'}`);
  console.log(`   Push: ${finalReport.summary.pushSuccessful ? 'SUCCESS' : 'FAILED'}`);
  console.log(`   Commit Hash: ${finalReport.commitHash || 'N/A'}`);
  
  console.log(`\n📁 CATEGORIES:`);
  Object.entries(finalReport.categories).forEach(([category, count]) => {
    if (count > 0) {
      console.log(`   ${category.toUpperCase()}: ${count} files`);
    }
  });
  
  console.log(`\n💾 Final report saved to: ${reportPath}`);
  
  if (finalReport.summary.pushSuccessful) {
    console.log('\n🎉 HCFP FULL AUTO PUSH COMPLETE!');
    console.log('✅ All changes successfully pushed to remote repository');
  } else {
    console.log('\n⚠️  HCFP PUSH COMPLETED WITH ISSUES');
    console.log('❌ Some operations may have failed - check the report');
  }
  
  return finalReport;
}

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = { main, stageChanges, createCommitMessage, pushChanges };
