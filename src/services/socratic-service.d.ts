export class HeadyBattleService extends EventEmitter<[never]> {
    constructor(config?: {});
    config: {
        interrogation_depth: number;
        validation_required: boolean;
        critical_mode: boolean;
        minimum_score: number;
        continuous_mode: boolean;
        validation_interval: number;
        learning_integration: boolean;
    };
    questionCategories: {
        purpose: {
            weight: number;
            questions: {
                id: string;
                text: string;
                critical: boolean;
                follow_up: string[];
            }[];
        };
        consequences: {
            weight: number;
            questions: {
                id: string;
                text: string;
                critical: boolean;
                follow_up: string[];
            }[];
        };
        optimization: {
            weight: number;
            questions: {
                id: string;
                text: string;
                critical: boolean;
                follow_up: string[];
            }[];
        };
        ethics: {
            weight: number;
            questions: {
                id: string;
                text: string;
                critical: boolean;
                follow_up: string[];
            }[];
        };
    };
    validationQueue: any[];
    processingValidations: Map<any, any>;
    completedValidations: any[];
    learningData: {
        questionEffectiveness: Map<any, any>;
        validationPatterns: Map<any, any>;
        ethicalConcerns: never[];
        successfulValidations: never[];
    };
    isRunning: boolean;
    metrics: {
        validationsProcessed: number;
        averageScore: number;
        approvalRate: number;
        criticalQuestionsPassed: number;
        ethicalViolations: number;
        uptime: number;
        lastValidation: number;
    };
    initializeQuestionEffectiveness(): void;
    start(): Promise<void>;
    startTime: number | undefined;
    validationLoop: NodeJS.Timeout | undefined;
    metricsLoop: NodeJS.Timeout | undefined;
    learningLoop: NodeJS.Timeout | undefined;
    ethicalLoop: NodeJS.Timeout | undefined;
    stop(): Promise<void>;
    validate(subject: any, context?: {}): Promise<number>;
    processValidationQueue(): Promise<void>;
    processValidation(validation: any): Promise<void>;
    interrogate(validation: any): Promise<{
        categories: {};
        totalScore: number;
        approved: boolean;
        criticalIssues: never[];
        ethicalConcerns: never[];
        recommendations: never[];
    }>;
    interrogateCategory(categoryName: any, category: any, validation: any): Promise<{
        score: number;
        questions: never[];
        criticalIssues: never[];
        ethicalConcerns: never[];
        recommendations: never[];
    }>;
    askQuestion(question: any, validation: any): Promise<{
        score: number;
        response: string;
        confidence: number;
        timestamp: number;
    }>;
    updateQuestionEffectiveness(questionId: any, score: any): void;
    learningIntegration(): void;
    ethicalMonitoring(): void;
    categorizeSubject(subject: any): "general" | "deployment" | "code_change" | "configuration" | "user_management";
    updateMetrics(): void;
    getStatus(): {
        isRunning: boolean;
        uptime: number;
        validationsProcessed: number;
        queueSize: number;
        processingValidations: number;
        averageScore: number;
        approvalRate: number;
        ethicalViolations: number;
        lastValidation: number;
    };
    getValidationReport(): {
        timestamp: number;
        categories: {};
        questionEffectiveness: {};
        recommendations: never[];
    };
    sleep(ms: any): Promise<any>;
}
export function getHeadyBattleService(config?: {}): typeof HeadyBattleService;
import EventEmitter = require("events");
//# sourceMappingURL=socratic-service.d.ts.map