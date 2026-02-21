// ============================================================
// HEADY ARENA MODE - TRI-REPO BRANCHING SYSTEM
// ============================================================
// Three identical repos: HeadySystems, HeadyConnection, HeadyMe
// Each gets same task, different approach, winner takes all
// ============================================================

const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class HeadyArenaMode {
  constructor() {
    this.repos = {
      headysystems: {
        remote: 'origin',
        url: 'https://github.com/HeadySystems',
        branch: 'arena/dev-sys',
        slug: 'sys'
      },
      headyconnection: {
        remote: 'connection',
        url: 'https://github.com/HeadyConnection',
        branch: 'arena/dev-conn',
        slug: 'conn'
      },
      headyme: {
        remote: 'heady-me',
        url: 'https://github.com/HeadyMe',
        branch: 'arena/dev-me',
        slug: 'me'
      }
    };
    
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.arenaId = `arena-${this.timestamp}`;
    this.scoringCriteria = {};
    this.results = {};
  }

  /**
   * Phase 1: SYNCHRONIZE
   * Ensure all three repo main branches are identical
   */
  async synchronize() {
    console.log('🔗 PHASE 1: SYNCHRONIZING REPOS');
    
    const mainBranchSHAs = {};
    
    for (const [repo, config] of Object.entries(this.repos)) {
      console.log(`  📡 Fetching ${repo}...`);
      
      try {
        // Fetch all remotes
        execSync(`git fetch ${config.remote} --all --prune`, { stdio: 'pipe' });
        
        // Get main branch SHA
        const mainSHA = execSync(`git rev-parse ${config.remote}/main`, { 
          encoding: 'utf8',
          stdio: 'pipe'
        }).trim();
        
        mainBranchSHAs[repo] = mainSHA;
        console.log(`  ✅ ${repo}: ${mainSHA.slice(0, 8)}`);
        
      } catch (error) {
        console.error(`  ❌ Failed to sync ${repo}:`, error.message);
        throw new Error(`Repository synchronization failed for ${repo}`);
      }
    }
    
    // Verify all main branches are identical
    const uniqueSHAs = [...new Set(Object.values(mainBranchSHAs))];
    if (uniqueSHAs.length !== 1) {
      console.error('🚨 MAIN BRANCHES DIVERGED:');
      for (const [repo, sha] of Object.entries(mainBranchSHAs)) {
        console.error(`  ${repo}: ${sha.slice(0, 8)}`);
      }
      
      console.log('🔧 Running Heady-Sync.ps1 to reconcile...');
      try {
        execSync('./scripts/Heady-Sync.ps1', { stdio: 'inherit' });
        return this.synchronize(); // Retry after sync
      } catch (syncError) {
        throw new Error('Failed to synchronize repositories. Manual intervention required.');
      }
    }
    
    console.log('✅ All main branches synchronized');
    return uniqueSHAs[0];
  }

  /**
   * Phase 2: BRANCH
   * Create arena branches on all three repos
   */
  async branch() {
    console.log('🌿 PHASE 2: CREATING ARENA BRANCHES');
    
    for (const [repo, config] of Object.entries(this.repos)) {
      const branchName = `${config.branch}-${this.timestamp}`;
      
      try {
        console.log(`  🌿 Creating ${branchName} on ${repo}...`);
        
        // Checkout main
        execSync(`git checkout ${config.remote}/main`, { stdio: 'pipe' });
        
        // Create and checkout arena branch
        execSync(`git checkout -b ${branchName}`, { stdio: 'pipe' });
        
        // Push to remote
        execSync(`git push ${config.remote} ${branchName}`, { stdio: 'pipe' });
        
        // Update config
        this.repos[repo].branch = branchName;
        
        console.log(`  ✅ ${repo}: ${branchName}`);
        
      } catch (error) {
        console.error(`  ❌ Failed to create branch for ${repo}:`, error.message);
        throw new Error(`Branch creation failed for ${repo}`);
      }
    }
    
    console.log('✅ All arena branches created');
  }

  /**
   * Phase 3: COMPETE
   * Execute task on all three branches with different strategies
   */
  async compete(taskDefinition, strategies = {}) {
    console.log('⚔️ PHASE 3: ARENA COMPETITION');
    
    const defaultStrategies = {
      headysystems: 'aggressive-innovation',
      headyconnection: 'community-driven',
      headyme: 'personal-optimization'
    };
    
    const competitionStrategies = { ...defaultStrategies, ...strategies };
    
    // Initialize results tracking
    for (const repo of Object.keys(this.repos)) {
      this.results[repo] = {
        strategy: competitionStrategies[repo],
        startTime: Date.now(),
        endTime: null,
        status: 'running',
        metrics: {},
        artifacts: [],
        errors: []
      };
    }
    
    // Execute on all branches in parallel
    const competitionPromises = Object.entries(this.repos).map(async ([repo, config]) => {
      try {
        console.log(`  ⚔️ ${repo} executing with strategy: ${competitionStrategies[repo]}`);
        
        // Switch to arena branch
        execSync(`git checkout ${config.branch}`, { stdio: 'pipe' });
        
        // Execute strategy-specific implementation
        const result = await this.executeStrategy(repo, taskDefinition, competitionStrategies[repo]);
        
        this.results[repo].endTime = Date.now();
        this.results[repo].status = 'completed';
        this.results[repo].metrics = result.metrics;
        this.results[repo].artifacts = result.artifacts;
        
        console.log(`  ✅ ${repo} completed in ${Date.now() - this.results[repo].startTime}ms`);
        
      } catch (error) {
        this.results[repo].endTime = Date.now();
        this.results[repo].status = 'failed';
        this.results[repo].errors.push(error.message);
        
        console.error(`  ❌ ${repo} failed:`, error.message);
      }
    });
    
    await Promise.all(competitionPromises);
    console.log('✅ Arena competition completed');
  }

  /**
   * Execute strategy-specific implementation
   */
  async executeStrategy(repo, taskDefinition, strategy) {
    const strategyPath = path.join(__dirname, 'arena-strategies', `${strategy}.js`);
    
    try {
      // Dynamic strategy loading
      const StrategyClass = require(strategyPath);
      const strategy = new StrategyClass();
      
      return await strategy.execute(taskDefinition, {
        repo,
        branch: this.repos[repo].branch,
        arenaId: this.arenaId
      });
      
    } catch (error) {
      // Fallback to default implementation
      console.warn(`Strategy ${strategy} not found, using default implementation`);
      return this.defaultStrategy(repo, taskDefinition);
    }
  }

  /**
   * Default strategy implementation
   */
  async defaultStrategy(repo, taskDefinition) {
    const startTime = Date.now();
    
    // Simulate work based on task complexity
    const complexity = taskDefinition.complexity || 'medium';
    const delays = { simple: 2000, medium: 5000, complex: 10000 };
    await new Promise(resolve => setTimeout(resolve, delays[complexity] || 5000));
    
    // Generate mock artifacts
    const artifacts = [
      `implementation-${repo}.js`,
      `tests-${repo}.js`,
      `docs-${repo}.md`
    ];
    
    // Mock metrics
    const metrics = {
      codeQuality: Math.random() * 40 + 60, // 60-100
      performance: Math.random() * 30 + 70,  // 70-100
      innovation: Math.random() * 50 + 50,   // 50-100
      completeness: Math.random() * 20 + 80, // 80-100
      executionTime: Date.now() - startTime
    };
    
    return { artifacts, metrics };
  }

  /**
   * Phase 4: EVALUATE & SQUASH-MERGE
   * Compare all three solutions and select winner
   */
  async evaluate(criteria = {}) {
    console.log('🏆 PHASE 4: EVALUATION & SELECTION');
    
    // Default scoring criteria
    this.scoringCriteria = {
      codeQuality: 0.3,
      performance: 0.25,
      innovation: 0.2,
      completeness: 0.15,
      executionTime: 0.1,
      ...criteria
    };
    
    // Calculate scores
    const scores = {};
    for (const [repo, result] of Object.entries(this.results)) {
      if (result.status !== 'completed') {
        scores[repo] = 0;
        continue;
      }
      
      let score = 0;
      for (const [metric, weight] of Object.entries(this.scoringCriteria)) {
        const value = result.metrics[metric] || 0;
        
        // Normalize execution time (lower is better)
        const normalizedValue = metric === 'executionTime' 
          ? Math.max(0, 100 - (value / 1000)) // Convert ms to seconds, invert
          : value;
        
        score += normalizedValue * weight;
      }
      
      scores[repo] = score;
    }
    
    // Find winner
    const winner = Object.entries(scores).reduce((a, b) => 
      scores[a[0]] > scores[b[0]] ? a : b
    );
    
    console.log('🏆 ARENA RESULTS:');
    for (const [repo, score] of Object.entries(scores)) {
      const status = this.results[repo].status;
      const emoji = repo === winner[0] ? '🏆' : status === 'completed' ? '✅' : '❌';
      console.log(`  ${emoji} ${repo}: ${score.toFixed(2)} (${status})`);
    }
    
    return {
      winner: winner[0],
      winningBranch: this.repos[winner[0]].branch,
      scores,
      criteria: this.scoringCriteria,
      results: this.results
    };
  }

  /**
   * Squash merge winner to all main branches
   */
  async squashMerge(winner) {
    console.log(`🎯 PHASE 5: SQUASH-MERGING WINNER: ${winner}`);
    
    const winnerConfig = this.repos[winner];
    
    for (const [repo, config] of Object.entries(this.repos)) {
      try {
        console.log(`  🔄 Merging to ${repo} main...`);
        
        // Checkout main branch
        execSync(`git checkout ${config.remote}/main`, { stdio: 'pipe' });
        
        // Merge winner branch
        execSync(`git merge --squash ${winnerConfig.branch}`, { stdio: 'pipe' });
        
        // Commit with arena metadata
        const commitMessage = `🏆 Arena Winner: ${winner}

Arena ID: ${this.arenaId}
Winning Branch: ${winnerConfig.branch}
Strategy: ${this.results[winner].strategy}
Score: ${this.scores[winner].toFixed(2)}

Auto-generated by Heady Arena Mode`;
        
        execSync(`git commit -m "${commitMessage}"`, { stdio: 'pipe' });
        
        // Push to remote
        execSync(`git push ${config.remote} main`, { stdio: 'pipe' });
        
        console.log(`  ✅ ${repo} main updated`);
        
      } catch (error) {
        console.error(`  ❌ Failed to merge to ${repo}:`, error.message);
        throw new Error(`Squash merge failed for ${repo}`);
      }
    }
    
    console.log('✅ All main branches updated with winner');
  }

  /**
   * Cleanup arena branches
   */
  async cleanup() {
    console.log('🧹 PHASE 6: CLEANUP');
    
    for (const [repo, config] of Object.entries(this.repos)) {
      try {
        // Delete local branch
        execSync(`git branch -D ${config.branch}`, { stdio: 'pipe' });
        
        // Delete remote branch
        execSync(`git push ${config.remote} --delete ${config.branch}`, { stdio: 'pipe' });
        
        console.log(`  🗑️  Cleaned ${repo} arena branch`);
        
      } catch (error) {
        console.warn(`  ⚠️  Could not cleanup ${repo}: ${error.message}`);
      }
    }
    
    console.log('✅ Arena cleanup completed');
  }

  /**
   * Run complete Arena Mode workflow
   */
  async run(taskDefinition, options = {}) {
    console.log(`🚀 STARTING ARENA MODE: ${this.arenaId}`);
    
    try {
      // Phase 1: Synchronize
      await this.synchronize();
      
      // Phase 2: Branch
      await this.branch();
      
      // Phase 3: Compete
      await this.compete(taskDefinition, options.strategies);
      
      // Phase 4: Evaluate
      const evaluation = await this.evaluate(options.scoring);
      this.scores = evaluation.scores;
      
      // Phase 5: Squash Merge
      await this.squashMerge(evaluation.winner);
      
      // Phase 6: Cleanup
      if (options.cleanup !== false) {
        await this.cleanup();
      }
      
      console.log(`🎉 ARENA MODE COMPLETED: Winner is ${evaluation.winner}`);
      
      return {
        arenaId: this.arenaId,
        winner: evaluation.winner,
        scores: evaluation.scores,
        results: this.results,
        duration: Date.now() - this.startTime
      };
      
    } catch (error) {
      console.error('🚨 ARENA MODE FAILED:', error.message);
      throw error;
    }
  }
}

module.exports = HeadyArenaMode;
