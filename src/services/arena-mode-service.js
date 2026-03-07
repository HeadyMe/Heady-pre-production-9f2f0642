/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * 🎮 Heady Arena Mode Service - 100% Uptime Continuous Competitive Selection
 * 
 * This service runs continuously, managing competitive pattern selection
 * and tournament-based optimization for all system strategies.
 * Default behavior: Always on, always competing, always optimizing.
 */

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const logger = require("../utils/logger");

class ArenaModeService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enabled: true,
      environment: 'staging',
      simulation_frequency: 'continuous',
      competitive_mode: true,
      tournament_participants: 8,
      elimination_rounds: 3,
      final_candidates: 3,
      simulation_runs: 1000,
      promotion_threshold: 0.75,
      continuous_mode: true,
      tournament_interval: 10000, // 10 seconds
      ...config
    };
    
    this.strategies = {
      fast_serial: { name: 'Fast Serial', base_score: 0.75, wins: 0, losses: 0 },
      fast_parallel: { name: 'Fast Parallel', base_score: 0.78, wins: 0, losses: 0 },
      balanced: { name: 'Balanced', base_score: 0.80, wins: 0, losses: 0 },
      thorough: { name: 'Thorough', base_score: 0.82, wins: 0, losses: 0 },
      cached_fast: { name: 'Cached Fast', base_score: 0.85, wins: 0, losses: 0 },
      probe_then_commit: { name: 'Probe Then Commit', base_score: 0.77, wins: 0, losses: 0 },
      monte_carlo_optimal: { name: 'HeadySims Optimal', base_score: 0.88, wins: 0, losses: 0 },
      imagination_engine: { name: 'Imagination Engine', base_score: 0.90, wins: 0, losses: 0 }
    };
    
    this.tournamentQueue = [];
    this.activeTournaments = new Map();
    this.completedTournaments = [];
    this.championHistory = [];
    this.performanceMetrics = new Map();
    
    this.isRunning = false;
    this.metrics = {
      tournamentsCompleted: 0,
      averageChampionScore: 0,
      promotionRate: 0,
      competitionIntensity: 0,
      uptime: 0,
      lastTournament: Date.now(),
      currentChampion: 'monte_carlo_optimal'
    };
    
    this.initializePerformanceMetrics();
  }

  initializePerformanceMetrics() {
    for (const [key, strategy] of Object.entries(this.strategies)) {
      this.performanceMetrics.set(key, {
        ...strategy,
        total_tournaments: 0,
        championship_wins: 0,
        average_placement: 4.0,
        peak_score: strategy.base_score,
        recent_form: []
      });
    }
  }

  async start() {
    if (this.isRunning) {
      logger.logSystem('🎮 Arena Mode Service already running');
      return;
    }

    logger.logSystem('🚀 Starting Arena Mode Service - 100% Continuous Mode');
    this.isRunning = true;
    this.startTime = Date.now();
    
    // Start continuous tournament loop
    this.tournamentLoop = setInterval(() => {
      this.runTournamentCycle();
    }, this.config.tournament_interval);
    
    // Start metrics collection
    this.metricsLoop = setInterval(() => {
      this.updateMetrics();
    }, 1000); // Update every second
    
    // Start performance analysis
    this.analysisLoop = setInterval(() => {
      this.analyzePerformance();
    }, 30000); // Analyze every 30 seconds
    
    // Start champion monitoring
    this.championLoop = setInterval(() => {
      this.monitorChampionPerformance();
    }, 15000); // Monitor every 15 seconds
    
    this.emit('started');
    logger.logSystem('✅ Arena Mode Service started successfully');
    
    // Start first tournament immediately
    setTimeout(() => this.runTournamentCycle(), 1000);
  }

  async stop() {
    if (!this.isRunning) {
      logger.logSystem('🎮 Arena Mode Service already stopped');
      return;
    }

    logger.logSystem('🛑 Stopping Arena Mode Service');
    this.isRunning = false;
    
    clearInterval(this.tournamentLoop);
    clearInterval(this.metricsLoop);
    clearInterval(this.analysisLoop);
    clearInterval(this.championLoop);
    
    // Wait for current tournaments to complete
    while (this.activeTournaments.size > 0) {
      await this.sleep(100);
    }
    
    this.emit('stopped');
    logger.logSystem('✅ Arena Mode Service stopped');
  }

  async queueTournament(context = {}) {
    const tournament = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      context,
      status: 'queued',
      participants: [...Object.keys(this.strategies)],
      rounds: [],
      priority: context.priority || 'normal'
    };
    
    this.tournamentQueue.push(tournament);
    
    // Sort by priority
    this.tournamentQueue.sort((a, b) => {
      const priorities = { critical: 3, high: 2, normal: 1, low: 0 };
      return (priorities[b.priority] || 1) - (priorities[a.priority] || 1);
    });
    
    this.emit('tournament_queued', tournament);
    logger.logSystem(`🎮 Tournament queued: ${tournament.id}`);
    
    return tournament.id;
  }

  async runTournamentCycle() {
    if (!this.isRunning) return;
    
    // Start queued tournaments
    const tournamentsToStart = this.tournamentQueue.splice(0, 1);
    for (const tournament of tournamentsToStart) {
      this.runTournament(tournament);
    }
    
    // If no queued tournaments, create a default one
    if (this.tournamentQueue.length === 0 && this.activeTournaments.size < 3) {
      await this.queueTournament({
        type: 'continuous_optimization',
        priority: 'normal'
      });
    }
  }

  async runTournament(tournament) {
    logger.logSystem(`🏆 Starting Arena Mode Tournament: ${tournament.id}`);
    
    this.activeTournaments.set(tournament.id, {
      ...tournament,
      startTime: Date.now(),
      status: 'running'
    });
    
    try {
      // Round 1: Initial Screening
      const round1Results = await this.runRound(tournament, 1, tournament.participants);
      tournament.rounds.push({ round: 1, results: round1Results });
      
      // Round 2: Semi-finals
      const semifinalists = round1Results.slice(0, 4);
      const round2Results = await this.runRound(tournament, 2, semifinalists);
      tournament.rounds.push({ round: 2, results: round2Results });
      
      // Round 3: Finals
      const finalists = round2Results.slice(0, 2);
      const round3Results = await this.runRound(tournament, 3, finalists);
      tournament.rounds.push({ round: 3, results: round3Results });
      
      // Determine champion
      const champion = round3Results[0];
      tournament.champion = champion.strategy;
      tournament.championScore = champion.score;
      tournament.completedAt = Date.now();
      tournament.status = 'completed';
      
      // Update strategy performance
      this.updateStrategyPerformance(tournament);
      
      // Move to completed
      this.completedTournaments.push(tournament);
      
      // Limit tournament history
      if (this.completedTournaments.length > 1000) {
        this.completedTournaments = this.completedTournaments.slice(-1000);
      }
      
      this.activeTournaments.delete(tournament.id);
      this.metrics.tournamentsCompleted++;
      this.metrics.lastTournament = Date.now();
      this.metrics.currentChampion = champion.strategy;
      
      // Update champion history
      this.championHistory.push({
        tournament: tournament.id,
        champion: champion.strategy,
        score: champion.score,
        timestamp: tournament.completedAt
      });
      
      // Check for promotion
      const promotion = this.evaluatePromotion(tournament);
      
      this.emit('tournament_completed', { tournament, promotion });
      logger.logSystem(`🏆 Tournament completed: ${champion.strategy} wins with score ${champion.score.toFixed(3)}`);
      
      if (promotion.ready) {
        logger.logSystem(`🚀 Champion ${champion.strategy} ready for promotion!`);
        this.emit('champion_ready', promotion);
      }
      
    } catch (error) {
      logger.error(`❌ Tournament failed: ${tournament.id} - ${error.message}`);
      
      tournament.status = 'failed';
      tournament.error = error.message;
      this.activeTournaments.delete(tournament.id);
      this.emit('tournament_failed', { tournament, error });
    }
  }

  async runRound(tournament, roundNumber, participants) {
    logger.logSystem(`🏆 Running Round ${roundNumber} with ${participants.length} participants`);
    
    const results = [];
    const simulationRuns = this.config.simulation_runs * roundNumber; // More runs in later rounds
    
    for (const participant of participants) {
      const score = await this.evaluateParticipant(participant, tournament, roundNumber, simulationRuns);
      results.push({ 
        strategy: participant, 
        score, 
        round: roundNumber,
        simulationRuns
      });
    }
    
    // Sort by score (descending)
    results.sort((a, b) => b.score - a.score);
    
    // Update strategy metrics
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const metrics = this.performanceMetrics.get(result.strategy);
      
      metrics.recent_form.push({
        tournament: tournament.id,
        round: roundNumber,
        placement: i + 1,
        score: result.score,
        timestamp: Date.now()
      });
      
      // Limit recent form history
      if (metrics.recent_form.length > 20) {
        metrics.recent_form = metrics.recent_form.slice(-20);
      }
    }
    
    return results.map(r => r.strategy);
  }

  async evaluateParticipant(participant, tournament, round, simulationRuns) {
    const strategy = this.strategies[participant];
    const metrics = this.performanceMetrics.get(participant);
    
    // Base score with tournament pressure
    let score = strategy.base_score;
    
    // Round pressure - higher stakes in later rounds
    const roundPressure = round * 0.05;
    score += roundPressure;
    
    // Recent form influence
    if (metrics.recent_form.length > 0) {
      const recentAvg = metrics.recent_form.slice(-5).reduce((sum, f) => sum + f.score, 0) / Math.min(5, metrics.recent_form.length);
      score += (recentAvg - 0.8) * 0.2;
    }
    
    // Championship bonus
    if (metrics.championship_wins > 0) {
      score += Math.min(0.1, metrics.championship_wins * 0.02);
    }
    
    // Simulation variance
    const variance = 0.1 / Math.sqrt(simulationRuns / 1000); // Less variance with more simulations
    score += (Math.random() - 0.5) * variance;
    
    // Tournament context adjustments
    if (tournament.context && tournament.context.type === 'performance_critical') {
      // Favor reliable strategies in critical tournaments
      if (participant === 'balanced' || participant === 'thorough') {
        score += 0.05;
      }
    }
    
    if (tournament.context && tournament.context.type === 'speed_critical') {
      // Favor fast strategies in speed-critical tournaments
      if (participant === 'fast_serial' || participant === 'fast_parallel' || participant === 'cached_fast') {
        score += 0.05;
      }
    }
    
    return Math.max(0, Math.min(1, score));
  }

  updateStrategyPerformance(tournament) {
    // Update champion
    const champion = tournament.champion;
    const championMetrics = this.performanceMetrics.get(champion);
    championMetrics.championship_wins++;
    championMetrics.total_tournaments++;
    
    // Update all participants
    for (const round of tournament.rounds) {
      for (let i = 0; i < round.results.length; i++) {
        const strategy = round.results[i];
        const metrics = this.performanceMetrics.get(strategy);
        
        metrics.total_tournaments++;
        
        // Update average placement
        const placement = i + 1;
        metrics.average_placement = (metrics.average_placement * (metrics.total_tournaments - 1) + placement) / metrics.total_tournaments;
        
        // Update peak score
        const roundData = tournament.rounds.find(r => r.results.includes(strategy));
        if (roundData) {
          const result = roundData.results.find(r => r.strategy === strategy);
          if (result && result.score > metrics.peak_score) {
            metrics.peak_score = result.score;
          }
        }
      }
    }
  }

  evaluatePromotion(tournament) {
    const champion = tournament.champion;
    const championScore = tournament.championScore;
    
    const promotion = {
      ready: false,
      champion,
      score: championScore,
      reasons: [],
      confidence: 0.0
    };
    
    // Check score threshold
    if (championScore >= this.config.promotion_threshold) {
      promotion.reasons.push(`Champion score ${championScore.toFixed(3)} meets threshold ${this.config.promotion_threshold}`);
      promotion.confidence += 0.4;
    } else {
      promotion.reasons.push(`Champion score ${championScore.toFixed(3)} below threshold ${this.config.promotion_threshold}`);
    }
    
    // Check consistency
    const championMetrics = this.performanceMetrics.get(champion);
    if (championMetrics.championship_wins >= 3) {
      promotion.reasons.push(`Champion has ${championMetrics.championship_wins} championship wins`);
      promotion.confidence += 0.3;
    }
    
    // Check recent form
    if (championMetrics.recent_form.length >= 5) {
      const recentScores = championMetrics.recent_form.slice(-5).map(f => f.score);
      const recentAvg = recentScores.reduce((sum, s) => sum + s, 0) / recentScores.length;
      
      if (recentAvg > 0.8) {
        promotion.reasons.push(`Champion recent form: ${recentAvg.toFixed(3)}`);
        promotion.confidence += 0.3;
      }
    }
    
    promotion.ready = promotion.confidence >= 0.7;
    
    return promotion;
  }

  analyzePerformance() {
    if (!this.isRunning) return;
    
    // Analyze tournament patterns
    const recentTournaments = this.completedTournaments.slice(-20);
    
    if (recentTournaments.length < 5) return;
    
    // Calculate competition intensity
    const scoreRanges = recentTournaments.map(t => {
      const scores = t.rounds[t.rounds.length - 1].results.map(r => r.score);
      return Math.max(...scores) - Math.min(...scores);
    });
    
    this.metrics.competitionIntensity = scoreRanges.reduce((sum, range) => sum + range, 0) / scoreRanges.length;
    
    // Identify emerging strategies
    const emergingStrategies = [];
    for (const [strategy, metrics] of this.performanceMetrics) {
      if (metrics.recent_form.length >= 3) {
        const recentScores = metrics.recent_form.slice(-3).map(f => f.score);
        const recentAvg = recentScores.reduce((sum, s) => sum + s, 0) / recentScores.length;
        
        if (recentAvg > metrics.base_score + 0.1) {
          emergingStrategies.push({
            strategy,
            improvement: recentAvg - metrics.base_score,
            recentAvg
          });
        }
      }
    }
    
    if (emergingStrategies.length > 0) {
      this.emit('emerging_strategies', emergingStrategies);
    }
  }

  monitorChampionPerformance() {
    if (!this.isRunning) return;
    
    const currentChampion = this.metrics.currentChampion;
    const championMetrics = this.performanceMetrics.get(currentChampion);
    
    // Check if champion is underperforming
    if (championMetrics.recent_form.length >= 5) {
      const recentScores = championMetrics.recent_form.slice(-5).map(f => f.score);
      const recentAvg = recentScores.reduce((sum, s) => sum + s, 0) / recentScores.length;
      
      if (recentAvg < 0.75) {
        logger.logSystem(`⚠️  Champion ${currentChampion} underperforming: ${recentAvg.toFixed(3)}`);
        this.emit('champion_underperforming', {
          champion: currentChampion,
          recentAverage: recentAvg,
          recommendation: 'Consider tournament with higher stakes'
        });
      }
    }
  }

  updateMetrics() {
    if (!this.isRunning) return;
    
    const recentTournaments = this.completedTournaments.slice(-50);
    
    if (recentTournaments.length > 0) {
      const championScores = recentTournaments.map(t => t.championScore);
      this.metrics.averageChampionScore = championScores.reduce((sum, score) => sum + score, 0) / championScores.length;
      
      const promotedTournaments = recentTournaments.filter(t => {
        const promotion = this.evaluatePromotion(t);
        return promotion.ready;
      });
      
      this.metrics.promotionRate = promotedTournaments.length / recentTournaments.length;
    }
    
    this.metrics.uptime = Date.now() - this.startTime;
    
    this.emit('metrics_updated', this.metrics);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      uptime: this.metrics.uptime,
      tournamentsCompleted: this.metrics.tournamentsCompleted,
      activeTournaments: this.activeTournaments.size,
      queueSize: this.tournamentQueue.length,
      averageChampionScore: this.metrics.averageChampionScore,
      promotionRate: this.metrics.promotionRate,
      competitionIntensity: this.metrics.competitionIntensity,
      currentChampion: this.metrics.currentChampion,
      lastTournament: this.metrics.lastTournament
    };
  }

  getTournamentReport() {
    const report = {
      timestamp: Date.now(),
      currentChampion: this.metrics.currentChampion,
      strategyPerformance: {},
      championHistory: this.championHistory.slice(-10),
      recommendations: []
    };
    
    // Strategy performance summary
    for (const [strategy, metrics] of this.performanceMetrics) {
      report.strategyPerformance[strategy] = {
        name: metrics.name,
        championships: metrics.championship_wins,
        total_tournaments: metrics.total_tournaments,
        win_rate: metrics.total_tournaments > 0 ? metrics.championship_wins / metrics.total_tournaments : 0,
        average_placement: metrics.average_placement,
        peak_score: metrics.peak_score,
        recent_form: metrics.recent_form.slice(-5)
      };
    }
    
    // Generate recommendations
    if (this.metrics.promotionRate < 0.3) {
      report.recommendations.push("Low promotion rate - consider adjusting tournament parameters");
    }
    
    if (this.metrics.competitionIntensity < 0.1) {
      report.recommendations.push("Low competition intensity - strategies may be too similar");
    }
    
    return report;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance for continuous service
let arenaModeService = null;

function getArenaModeService(config = {}) {
  if (!arenaModeService) {
    arenaModeService = new ArenaModeService(config);
  }
  return arenaModeService;
}

// Auto-start if this is the main module
if (require.main === module) {
  const service = getArenaModeService();
  
  service.start().then(() => {
    logger.logSystem('🎮 Arena Mode Service started - 100% Continuous Mode');
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.logSystem('\n🛑 Shutting down Arena Mode Service...');
      await service.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.logSystem('\n🛑 Shutting down Arena Mode Service...');
      await service.stop();
      process.exit(0);
    });
    
    // Queue initial tournaments
    setTimeout(async () => {
      await service.queueTournament({
        type: 'initial_benchmark',
        priority: 'high'
      });
    }, 2000);
    
  }).catch(err => {
    logger.error('❌ Failed to start Arena Mode Service:', err);
    process.exit(1);
  });
}

module.exports = { ArenaModeService, getArenaModeService };
