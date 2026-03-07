export class ArenaModeService extends EventEmitter<[never]> {
    constructor(config?: {});
    config: {
        enabled: boolean;
        environment: string;
        simulation_frequency: string;
        competitive_mode: boolean;
        tournament_participants: number;
        elimination_rounds: number;
        final_candidates: number;
        simulation_runs: number;
        promotion_threshold: number;
        continuous_mode: boolean;
        tournament_interval: number;
    };
    strategies: {
        fast_serial: {
            name: string;
            base_score: number;
            wins: number;
            losses: number;
        };
        fast_parallel: {
            name: string;
            base_score: number;
            wins: number;
            losses: number;
        };
        balanced: {
            name: string;
            base_score: number;
            wins: number;
            losses: number;
        };
        thorough: {
            name: string;
            base_score: number;
            wins: number;
            losses: number;
        };
        cached_fast: {
            name: string;
            base_score: number;
            wins: number;
            losses: number;
        };
        probe_then_commit: {
            name: string;
            base_score: number;
            wins: number;
            losses: number;
        };
        monte_carlo_optimal: {
            name: string;
            base_score: number;
            wins: number;
            losses: number;
        };
        imagination_engine: {
            name: string;
            base_score: number;
            wins: number;
            losses: number;
        };
    };
    tournamentQueue: any[];
    activeTournaments: Map<any, any>;
    completedTournaments: any[];
    championHistory: any[];
    performanceMetrics: Map<any, any>;
    isRunning: boolean;
    metrics: {
        tournamentsCompleted: number;
        averageChampionScore: number;
        promotionRate: number;
        competitionIntensity: number;
        uptime: number;
        lastTournament: number;
        currentChampion: string;
    };
    initializePerformanceMetrics(): void;
    start(): Promise<void>;
    startTime: number | undefined;
    tournamentLoop: NodeJS.Timeout | undefined;
    metricsLoop: NodeJS.Timeout | undefined;
    analysisLoop: NodeJS.Timeout | undefined;
    championLoop: NodeJS.Timeout | undefined;
    stop(): Promise<void>;
    queueTournament(context?: {}): Promise<number>;
    runTournamentCycle(): Promise<void>;
    runTournament(tournament: any): Promise<void>;
    runRound(tournament: any, roundNumber: any, participants: any): Promise<any[]>;
    evaluateParticipant(participant: any, tournament: any, round: any, simulationRuns: any): Promise<number>;
    updateStrategyPerformance(tournament: any): void;
    evaluatePromotion(tournament: any): {
        ready: boolean;
        champion: any;
        score: any;
        reasons: never[];
        confidence: number;
    };
    analyzePerformance(): void;
    monitorChampionPerformance(): void;
    updateMetrics(): void;
    getStatus(): {
        isRunning: boolean;
        uptime: number;
        tournamentsCompleted: number;
        activeTournaments: number;
        queueSize: number;
        averageChampionScore: number;
        promotionRate: number;
        competitionIntensity: number;
        currentChampion: string;
        lastTournament: number;
    };
    getTournamentReport(): {
        timestamp: number;
        currentChampion: string;
        strategyPerformance: {};
        championHistory: any[];
        recommendations: never[];
    };
    sleep(ms: any): Promise<any>;
}
export function getArenaModeService(config?: {}): any;
import EventEmitter = require("events");
//# sourceMappingURL=arena-mode-service.d.ts.map