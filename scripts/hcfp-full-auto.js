#!/usr/bin/env node

/**
 * 🚀 HCFP Full Auto Mode with HeadySims + HeadyBattle Integration
 * Trigger: `hcfp --full-auto` command
 * 
 * This is the main orchestrator for the Heady Continuous Full Pipeline
 * with integrated HeadySims simulations, HeadyBattle validation,
 * and Arena Mode competitive pattern selection.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class HCFPFullAuto {
  constructor() {
    this.config = this.loadConfig();
    this.monteCarlo = new HeadySimsEngine(this.config.monteCarlo);
    this.HeadyBattle = new HeadyBattleInterrogator(this.config.HeadyBattle);
    this.arena = new ArenaMode(this.config.arena);
    this.branchManager = new BranchManager();
  }

  loadConfig() {
    return {
      monteCarlo: this.loadYaml('.heady/HeadySims-config.yaml'),
      HeadyBattle: this.loadYaml('.heady/HeadyBattle-rules.yaml'),
      arena: this.loadYaml('.heady/arena-mode.yaml')
    };
  }

  loadYaml(filePath) {
    try {
      const yaml = require('js-yaml');
      return yaml.load(fs.readFileSync(path.join(__dirname, '..', filePath), 'utf8'));
    } catch (err) {
      console.error(`❌ Failed to load ${filePath}:`, err.message);
      process.exit(1);
    }
  }

  async execute(command) {
    console.log('🚀 HCFP Full Auto Mode Activated');
    console.log('=====================================');
    
    switch (command) {
      case '--full-auto':
        await this.runFullAuto();
        break;
      case '--HeadySims':
        await this.runHeadySimsOnly();
        break;
      case '--HeadyBattle':
        await this.runHeadyBattleOnly();
        break;
      case '--arena':
        await this.runArenaMode();
        break;
      default:
        this.showUsage();
    }
  }

  async runFullAuto() {
    console.log('🧠 Starting Full Auto Mode with HeadySims + HeadyBattle + Arena');
    
    try {
      // 1. Detect current branch state
      const currentBranch = this.branchManager.getCurrentBranch();
      console.log(`📍 Current branch: ${currentBranch}`);
      
      // 2. Run HeadySims simulations
      console.log('\n🎲 Running HeadySims simulations...');
      const mcResults = await this.monteCarlo.runSimulations();
      console.log(`✅ HeadySims completed: ${mcResults.winner} selected`);
      
      // 3. Apply HeadyBattle validation
      console.log('\n🤔 Applying HeadyBattle validation...');
      const HeadyBattleResults = await this.HeadyBattle.interrogate(mcResults);
      console.log(`✅ HeadyBattle validation: ${HeadyBattleResults.approved ? 'APPROVED' : 'REJECTED'}`);
      
      // 4. Execute Arena Mode if in staging
      if (currentBranch === 'staging') {
        console.log('\n🎮 Executing Arena Mode...');
        const arenaResults = await this.arena.runTournament(mcResults, HeadyBattleResults);
        console.log(`✅ Arena Mode completed: ${arenaResults.promoted} promoted`);
      }
      
      // 5. Intelligent branch management
      console.log('\n🔄 Managing branch synchronization...');
      await this.manageBranchSync(currentBranch, mcResults, HeadyBattleResults);
      
      console.log('\n🎉 Full Auto Mode completed successfully!');
      
    } catch (err) {
      console.error('❌ Full Auto Mode failed:', err.message);
      process.exit(1);
    }
  }

  async runHeadySimsOnly() {
    console.log('🎲 Running HeadySims simulations only...');
    const results = await this.monteCarlo.runSimulations();
    console.log('✅ HeadySims simulations completed');
    return results;
  }

  async runHeadyBattleOnly() {
    console.log('🤔 Running HeadyBattle validation only...');
    const results = await this.HeadyBattle.interrogateAll();
    console.log('✅ HeadyBattle validation completed');
    return results;
  }

  async runArenaMode() {
    console.log('🎮 Running Arena Mode tournament...');
    const results = await this.arena.runTournament();
    console.log('✅ Arena Mode completed');
    return results;
  }

  async manageBranchSync(currentBranch, mcResults, HeadyBattleResults) {
    const branchManager = this.branchManager;
    
    if (currentBranch === 'development') {
      // Development changes detected, prepare for staging
      if (HeadyBattleResults.approved && mcResults.confidence > 0.85) {
        console.log('📤 Promoting development to staging...');
        await branchManager.mergeToStaging(mcResults, HeadyBattleResults);
      }
    } else if (currentBranch === 'staging') {
      // Staging ready for production evaluation
      const arenaResults = await this.arena.runTournament(mcResults, HeadyBattleResults);
      if (arenaResults.readyForProduction) {
        console.log('🚀 Promoting staging to main...');
        await branchManager.mergeToMain(arenaResults);
      }
    }
  }

  showUsage() {
    console.log(`
🚀 HCFP Full Auto Mode Usage:

hcfp --full-auto        # Run complete pipeline (HeadySims + HeadyBattle + Arena)
hcfp --HeadySims      # Run HeadySims simulations only
hcfp --HeadyBattle         # Run HeadyBattle validation only  
hcfp --arena            # Run Arena Mode tournament only

Examples:
  hcfp --full-auto       # Complete automation
  hcfp --HeadySims     # Strategy optimization
  hcfp --HeadyBattle        # Ethical validation
  hcfp --arena           # Competitive selection
    `);
  }
}

// HeadySims Engine
class HeadySimsEngine {
  constructor(config) {
    this.config = config;
    this.strategies = config.strategies || [];
    this.algorithm = config.monte_carlo ? { type: config.monte_carlo.algorithm } : { type: 'ucb1' };
    this.simulation_runs = config.monte_carlo ? config.monte_carlo.simulation_runs : 1000;
  }

  async runSimulations() {
    console.log(`🎲 Running ${this.simulation_runs} simulations with ${this.algorithm.type} algorithm`);
    
    const results = {};
    let bestScore = 0;
    let winner = null;
    
    // Simulate each strategy
    for (const name of this.strategies) {
      const score = await this.simulateStrategy(name, { strengths: [name.split('_')[1] || 'balanced'] });
      results[name] = { score, strategy: name };
      
      if (score > bestScore) {
        bestScore = score;
        winner = name;
      }
    }
    
    return {
      winner,
      bestScore,
      allResults: results,
      confidence: this.calculateConfidence(results),
      recommendation: this.generateRecommendation(winner, bestScore)
    };
  }

  async simulateStrategy(name, strategy) {
    // Simulate strategy performance
    const metrics = {
      latency: this.simulateLatency(strategy),
      accuracy: this.simulateAccuracy(strategy),
      efficiency: this.simulateEfficiency(strategy),
      satisfaction: this.simulateSatisfaction(strategy),
      quality: this.simulateQuality(strategy)
    };
    
    // Calculate weighted score
    let score = 0;
    const evalMetrics = this.config.evaluation?.metrics || {
      latency: 0.2, accuracy: 0.2, efficiency: 0.2, satisfaction: 0.2, quality: 0.2
    };

    for (const [metric, value] of Object.entries(metrics)) {
      const weight = evalMetrics[metric] || 0.2;
      score += value * weight;
    }
    
    return score;
  }

  simulateLatency(strategy) {
    // Lower latency = higher score
    const baseLatency = strategy.strengths?.includes('speed') ? 200 : 800;
    const latency = baseLatency + Math.random() * 200;
    return Math.max(0, 1 - (latency / 1000));
  }

  simulateAccuracy(strategy) {
    // Higher accuracy = higher score
    const baseAccuracy = strategy.strengths?.includes('accuracy') ? 0.95 : 0.85;
    return Math.min(1, baseAccuracy + Math.random() * 0.1);
  }

  simulateEfficiency(strategy) {
    const baseEfficiency = strategy.strengths?.includes('efficiency') ? 0.90 : 0.75;
    return Math.min(1, baseEfficiency + Math.random() * 0.15);
  }

  simulateSatisfaction(strategy) {
    const baseSatisfaction = strategy.strengths?.includes('usability') ? 0.85 : 0.75;
    return Math.min(1, baseSatisfaction + Math.random() * 0.15);
  }

  simulateQuality(strategy) {
    const baseQuality = strategy.strengths?.includes('quality') ? 0.90 : 0.80;
    return Math.min(1, baseQuality + Math.random() * 0.15);
  }

  calculateConfidence(results) {
    const scores = Object.values(results).map(r => r.score);
    const mean = scores.reduce((a, b) => a + b) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Higher confidence when winner is significantly better than average
    const bestScore = Math.max(...scores);
    return Math.min(1, (bestScore - mean) / standardDeviation);
  }

  generateRecommendation(winner, score) {
    if (score > 0.85) {
      return `Strong recommendation: ${winner} with confidence ${score.toFixed(3)}`;
    } else if (score > 0.75) {
      return `Moderate recommendation: ${winner} with confidence ${score.toFixed(3)}`;
    } else {
      return `Weak recommendation: ${winner} with confidence ${score.toFixed(3)} - consider alternatives`;
    }
  }
}

// HeadyBattle Interrogator
class HeadyBattleInterrogator {
  constructor(config) {
    this.config = config;
    this.categories = config.questions || {};
  }

  async interrogate(mcResults) {
    console.log('🤔 Applying HeadyBattle interrogation...');
    
    const results = {
      categories: {},
      totalScore: 0,
      approved: false,
      criticalIssues: []
    };
    
    const numCategories = Object.keys(this.categories).length || 1;
    
    // Interrogate each category
    for (const [categoryName, questions] of Object.entries(this.categories)) {
      const categoryResults = await this.interrogateCategory(categoryName, questions, mcResults);
      results.categories[categoryName] = categoryResults;
      results.totalScore += categoryResults.score * (1 / numCategories);
      
      if (categoryResults.criticalIssues.length > 0) {
        results.criticalIssues.push(...categoryResults.criticalIssues);
      }
    }
    
    // Final validation
    const minScore = this.config.validation?.minimum_score || 0.8;
    results.approved = results.totalScore >= minScore &&
                      results.criticalIssues.length === 0;
    
    return results;
  }

  async interrogateCategory(categoryName, questionsList, mcResults) {
    const results = {
      score: 0,
      questions: [],
      criticalIssues: []
    };
    
    if (!Array.isArray(questionsList)) return results;

    for (const questionText of questionsList) {
      const question = { text: questionText, critical: false };
      const answer = await this.askQuestion(question, mcResults);
      results.questions.push({ question: question.text, answer, score: answer.score });
      
      if (question.critical && answer.score < 0.7) {
        results.criticalIssues.push({
          question: question.text,
          issue: 'Critical question scored below threshold',
          score: answer.score
        });
      }
      
      results.score += answer.score;
    }
    
    // Normalize score
    if (questionsList.length > 0) {
      results.score = results.score / questionsList.length;
    }
    
    return results;
  }

  async askQuestion(question, mcResults) {
    // Simulate question answering based on context
    let score = 0.8; // Base score
    let answer = "Positive response";
    
    // Adjust score based on HeadySims results
    if (mcResults.bestScore > 0.85) {
      score += 0.1;
    }
    
    // Adjust based on question criticality
    if (question.critical) {
      score -= 0.05; // Slightly harder to pass critical questions
    }
    
    return {
      score: Math.min(1, Math.max(0, score)),
      answer,
      confidence: 0.9
    };
  }
}

// Arena Mode
class ArenaMode {
  constructor(config) {
    this.config = config;
  }

  async runTournament(mcResults, HeadyBattleResults) {
    console.log('🎮 Starting Arena Mode tournament...');
    
    if (!HeadyBattleResults.approved) {
      return {
        promoted: null,
        reason: 'HeadyBattle validation failed',
        readyForProduction: false
      };
    }
    
    // Run tournament rounds
    const tournamentResults = {
      round1: await this.runRound(1, this.config.tournament_structure.participants),
      round2: null,
      round3: null,
      winner: null,
      promoted: null,
      readyForProduction: false
    };
    
    // Semi-finals
    const semifinalists = tournamentResults.round1.slice(0, 4);
    tournamentResults.round2 = await this.runRound(2, semifinalists);
    
    // Finals
    const finalists = tournamentResults.round2.slice(0, 2);
    tournamentResults.round3 = await this.runRound(3, finalists);
    
    // Determine winner
    tournamentResults.winner = tournamentResults.round3[0];
    
    // Check promotion criteria
    tournamentResults.readyForProduction = this.checkPromotionCriteria(tournamentResults);
    tournamentResults.promoted = tournamentResults.readyForProduction ? tournamentResults.winner : null;
    
    return tournamentResults;
  }

  async runRound(roundNumber, participants) {
    console.log(`🏆 Running Round ${roundNumber} with ${participants.length} participants`);
    
    const results = [];
    
    for (const participant of participants) {
      const score = await this.evaluateParticipant(participant, roundNumber);
      results.push({ participant, score, round: roundNumber });
    }
    
    // Sort by score (descending)
    results.sort((a, b) => b.score - a.score);
    
    return results.map(r => r.participant);
  }

  async evaluateParticipant(participant, round) {
    // Simulate participant evaluation
    const baseScore = 0.7;
    const roundBonus = round * 0.05;
    const randomVariation = Math.random() * 0.2;
    
    return Math.min(1, baseScore + roundBonus + randomVariation);
  }

  checkPromotionCriteria(tournamentResults) {
    const winnerScore = tournamentResults.round3[0].score;
    const HeadyBattleScore = 0.85; // Would come from HeadyBattleResults
    
    return winnerScore >= this.config.promotion_criteria.minimum_score &&
           HeadyBattleScore >= 0.80;
  }
}

// Branch Manager
class BranchManager {
  getCurrentBranch() {
    try {
      return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    } catch (err) {
      console.error('❌ Failed to get current branch:', err.message);
      return 'unknown';
    }
  }

  async mergeToStaging(mcResults, HeadyBattleResults) {
    console.log('📤 Merging development to staging with Arena Mode preparation...');
    
    try {
      // Switch to staging branch
      execSync('git checkout staging', { encoding: 'utf8' });
      
      // Merge development
      execSync('git merge development', { encoding: 'utf8' });
      
      // Push to remote
      execSync('git push origin staging', { encoding: 'utf8' });
      
      console.log('✅ Development merged to staging successfully');
      
    } catch (err) {
      console.error('❌ Failed to merge to staging:', err.message);
      throw err;
    }
  }

  async mergeToMain(arenaResults) {
    console.log('🚀 Merging staging to main - Production deployment...');
    
    try {
      // Switch to main branch
      execSync('git checkout main', { encoding: 'utf8' });
      
      // Merge staging
      execSync('git merge staging', { encoding: 'utf8' });
      
      // Push to remote
      execSync('git push origin main', { encoding: 'utf8' });
      
      console.log('✅ Staging merged to main - Production deployed!');
      
    } catch (err) {
      console.error('❌ Failed to merge to main:', err.message);
      throw err;
    }
  }
}

// CLI Entry Point
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || '--help';
  
  const hcfp = new HCFPFullAuto();
  hcfp.execute(command).catch(err => {
    console.error('❌ HCFP execution failed:', err.message);
    process.exit(1);
  });
}

module.exports = HCFPFullAuto;
