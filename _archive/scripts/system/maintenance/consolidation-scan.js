/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 HC CONSOLIDATION SCANNER - Full Project Data Analysis');
console.log('=====================================================\n');

// Project repositories found
const repositories = [
  {
    name: 'CascadeProjects',
    path: '/home/headyme/CascadeProjects',
    remote: 'https://github.com/HeadyMe/CascadeProjects-bca7372c.git',
    branch: 'master'
  },
  {
    name: 'Heady (CascadeProjects)',
    path: '/home/headyme/CascadeProjects/Heady',
    remote: 'git@github.com:HeadyMe/Heady.git',
    branch: 'master'
  },
  {
    name: 'Heady (Root)',
    path: '/home/headyme/Heady',
    remote: 'https://github.com/HeadyMe/Heady.git',
    branch: 'main'
  },
  {
    name: 'HeadyConnection',
    path: '/home/headyme/CascadeProjects/Heady/headyconnection-web',
    remote: 'https://github.com/HeadyMe/HeadyConnection.git',
    branch: 'main'
  }
];

// Function to safely execute git commands
function safeGit(repoPath, command) {
  try {
    const result = execSync(command, { 
      cwd: repoPath, 
      encoding: 'utf8',
      timeout: 10000 
    });
    return result.trim();
  } catch (error) {
    return `ERROR: ${error.message}`;
  }
}

// Function to get repository status
function getRepoStatus(repo) {
  console.log(`\n📁 Repository: ${repo.name}`);
  console.log(`   Path: ${repo.path}`);
  console.log(`   Remote: ${repo.remote}`);
  console.log(`   Branch: ${repo.branch}`);
  
  const status = safeGit(repo.path, 'git status --porcelain');
  const branch = safeGit(repo.path, 'git branch --show-current');
  const lastCommit = safeGit(repo.path, 'git log -1 --format="%h %s"');
  const untrackedCount = status.split('\n').filter(line => line.startsWith('??')).length;
  const modifiedCount = status.split('\n').filter(line => line.match(/^\s*M/)).length;
  const stagedCount = status.split('\n').filter(line => line.match(/^[A-Z]/)).length;
  
  console.log(`   Current Branch: ${branch}`);
  console.log(`   Last Commit: ${lastCommit}`);
  console.log(`   Modified Files: ${modifiedCount}`);
  console.log(`   Staged Files: ${stagedCount}`);
  console.log(`   Untracked Files: ${untrackedCount}`);
  
  if (status && status !== 'ERROR') {
    console.log(`   Status Details:`);
    status.split('\n').forEach(line => {
      if (line.trim()) {
        console.log(`     ${line}`);
      }
    });
  }
  
  return {
    name: repo.name,
    path: repo.path,
    remote: repo.remote,
    branch: repo.branch,
    currentBranch: branch,
    lastCommit,
    modifiedCount,
    stagedCount,
    untrackedCount,
    status
  };
}

// Function to scan for unique files across all repos
function scanUniqueFiles(repos) {
  console.log('\n🔍 SCANNING FOR UNIQUE FILES ACROSS ALL REPOSITORIES');
  console.log('=====================================================\n');
  
  const allFiles = new Map();
  
  repos.forEach(repo => {
    console.log(`\n📁 Scanning: ${repo.name}`);
    try {
      const files = execSync('find . -type f -not -path "./.git/*" -not -path "./node_modules/*" -not -path "./.npm/*"', {
        cwd: repo.path,
        encoding: 'utf8',
        timeout: 15000
      }).trim().split('\n');
      
      files.forEach(file => {
        const relativePath = file.replace(/^\.\//, '');
        const fullPath = path.join(repo.path, relativePath);
        
        if (!allFiles.has(relativePath)) {
          allFiles.set(relativePath, []);
        }
        
        try {
          const stats = fs.statSync(fullPath);
          allFiles.get(relativePath).push({
            repo: repo.name,
            path: fullPath,
            size: stats.size,
            modified: stats.mtime
          });
        } catch (error) {
          // File might be inaccessible
        }
      });
      
      console.log(`   Found ${files.length} files`);
    } catch (error) {
      console.log(`   ERROR scanning files: ${error.message}`);
    }
  });
  
  // Analyze file distribution
  console.log('\n📊 FILE DISTRIBUTION ANALYSIS');
  console.log('=============================\n');
  
  const uniqueFiles = [];
  const conflictingFiles = [];
  const commonFiles = [];
  
  allFiles.forEach((instances, filePath) => {
    if (instances.length === 1) {
      uniqueFiles.push({ path: filePath, ...instances[0] });
    } else if (instances.length > 1) {
      // Check if files are identical or conflicting
      const sizes = [...new Set(instances.map(i => i.size))];
      if (sizes.length === 1) {
        commonFiles.push({ path: filePath, instances });
      } else {
        conflictingFiles.push({ path: filePath, instances });
      }
    }
  });
  
  console.log(`📈 SUMMARY:`);
  console.log(`   Total unique file paths: ${allFiles.size}`);
  console.log(`   Unique to single repo: ${uniqueFiles.length}`);
  console.log(`   Common across repos: ${commonFiles.length}`);
  console.log(`   Conflicting versions: ${conflictingFiles.length}`);
  
  // Show top conflicting files
  if (conflictingFiles.length > 0) {
    console.log(`\n⚠️  TOP CONFLICTING FILES:`);
    conflictingFiles.slice(0, 10).forEach(conflict => {
      console.log(`   ${conflict.path}`);
      conflict.instances.forEach(instance => {
        console.log(`     ${instance.repo}: ${instance.size} bytes`);
      });
    });
  }
  
  return { uniqueFiles, commonFiles, conflictingFiles };
}

// Function to generate consolidation plan
function generateConsolidationPlan(repos, fileAnalysis) {
  console.log('\n🎯 CONSOLIDATION PLAN GENERATION');
  console.log('===============================\n');
  
  const plan = {
    primaryRepo: 'CascadeProjects/Heady',
    actions: [],
    conflicts: [],
    integrations: []
  };
  
  // Determine primary repository (most active)
  const repoActivity = repos.map(repo => ({
    name: repo.name,
    activity: repo.modifiedCount + repo.stagedCount + repo.untrackedCount,
    lastCommit: repo.lastCommit
  })).sort((a, b) => b.activity - a.activity);
  
  if (repoActivity.length > 0) {
    plan.primaryRepo = repoActivity[0].name;
    console.log(`🎯 Primary Repository: ${plan.primaryRepo}`);
    console.log(`   Activity Score: ${repoActivity[0].activity}`);
    console.log(`   Last Commit: ${repoActivity[0].lastCommit}`);
  }
  
  // Generate integration actions
  fileAnalysis.uniqueFiles.forEach(file => {
    if (!file.path.includes('.git/') && !file.path.includes('node_modules/')) {
      plan.actions.push({
        type: 'UNIQUE_INTEGRATION',
        source: file.repo,
        sourcePath: file.path,
        targetPath: file.path,
        size: file.size
      });
    }
  });
  
  // Generate conflict resolution actions
  fileAnalysis.conflictingFiles.forEach(conflict => {
    const largest = conflict.instances.reduce((max, current) => 
      current.size > max.size ? current : max
    );
    
    plan.conflicts.push({
      type: 'SIZE_CONFLICT',
      path: conflict.path,
      instances: conflict.instances,
      resolution: 'LARGEST_WINS',
      selected: largest.repo
    });
  });
  
  console.log(`\n📋 CONSOLIDATION ACTIONS:`);
  console.log(`   Unique files to integrate: ${plan.actions.length}`);
  console.log(`   Conflicts to resolve: ${plan.conflicts.length}`);
  
  return plan;
}

// Main execution
function main() {
  console.log('🚀 Starting HC Full Project Consolidation Analysis...\n');
  
  // Step 1: Get repository status
  const repoStatuses = repositories.map(getRepoStatus);
  
  // Step 2: Scan for unique files
  const fileAnalysis = scanUniqueFiles(repositories);
  
  // Step 3: Generate consolidation plan
  const consolidationPlan = generateConsolidationPlan(repoStatuses, fileAnalysis);
  
  // Step 4: Output final report
  console.log('\n📊 FINAL CONSOLIDATION REPORT');
  console.log('============================\n');
  
  const totalModified = repoStatuses.reduce((sum, repo) => sum + repo.modifiedCount, 0);
  const totalStaged = repoStatuses.reduce((sum, repo) => sum + repo.stagedCount, 0);
  const totalUntracked = repoStatuses.reduce((sum, repo) => sum + repo.untrackedCount, 0);
  
  console.log(`📈 REPOSITORY SUMMARY:`);
  console.log(`   Total Repositories: ${repositories.length}`);
  console.log(`   Total Modified Files: ${totalModified}`);
  console.log(`   Total Staged Files: ${totalStaged}`);
  console.log(`   Total Untracked Files: ${totalUntracked}`);
  console.log(`   Total Unique Files: ${fileAnalysis.uniqueFiles.length}`);
  console.log(`   Total Conflicts: ${fileAnalysis.conflictingFiles.length}`);
  
  console.log(`\n🎯 RECOMMENDED ACTIONS:`);
  console.log(`   1. Use ${consolidationPlan.primaryRepo} as primary consolidation target`);
  console.log(`   2. Integrate ${consolidationPlan.actions.length} unique files`);
  console.log(`   3. Resolve ${consolidationPlan.conflicts.length} conflicts`);
  console.log(`   4. Execute auto-push with hcfp --full-auto`);
  
  // Save consolidation plan
  const planPath = '/home/headyme/consolidation-plan.json';
  fs.writeFileSync(planPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    repositories: repoStatuses,
    fileAnalysis,
    consolidationPlan
  }, null, 2));
  
  console.log(`\n💾 Consolidation plan saved to: ${planPath}`);
  console.log('\n✅ HC Consolidation Analysis Complete!');
}

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = { main, getRepoStatus, scanUniqueFiles, generateConsolidationPlan };
