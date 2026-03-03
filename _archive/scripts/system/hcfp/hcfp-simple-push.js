/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 HCFP SIMPLE PUSH - Streamlined Auto Deployment');
console.log('===============================================\n');

const targetRepoPath = '/home/headyme/CascadeProjects/Heady';

console.log(`🎯 TARGET: ${targetRepoPath}`);

// Simple git operations
try {
  console.log('\n📋 Checking repository status...');
  
  // Add all changes
  console.log('📥 Adding all changes...');
  execSync('git add .', { cwd: targetRepoPath, stdio: 'inherit' });
  
  // Commit with simple message
  console.log('📝 Creating commit...');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const commitMessage = `🚀 HCFP-FULL-AUTO: 🔄 Complete project consolidation - ${timestamp}`;
  
  execSync(`git commit -m "${commitMessage}"`, { 
    cwd: targetRepoPath, 
    stdio: 'inherit' 
  });
  
  // Push changes
  console.log('📤 Pushing to remote...');
  execSync('git push origin master', { 
    cwd: targetRepoPath, 
    stdio: 'inherit',
    timeout: 60000 
  });
  
  console.log('\n✅ HCFP SIMPLE PUSH COMPLETE!');
  console.log('🎉 All changes successfully pushed to remote repository');
  
} catch (error) {
  console.log('\n❌ ERROR during push operation:');
  console.log(error.message);
  
  // Try to get status for debugging
  try {
    console.log('\n📋 Repository status:');
    const status = execSync('git status --short', { 
      cwd: targetRepoPath, 
      encoding: 'utf8' 
    });
    console.log(status);
  } catch (statusError) {
    console.log('Could not get repository status');
  }
}

console.log('\n🏁 HCFP Full Auto Pipeline Complete!');
