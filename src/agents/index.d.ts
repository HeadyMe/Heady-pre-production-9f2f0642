/**
 * Create all agents and return them ready for Supervisor registration.
 */
export function createAllAgents(options?: {}): (ClaudeCodeAgent | HeadyFinTechAgent | NonprofitConsultantAgent | BuilderAgent | ResearcherAgent | DeployerAgent | AuditorAgent | ObserverAgent)[];
/**
 * Create and configure a Supervisor with all agents registered.
 */
export function createConfiguredSupervisor(Supervisor: any, options?: {}): any;
import { ClaudeCodeAgent } from "./claude-code-agent";
import { HeadyFinTechAgent } from "./heady-fintech-agent";
export class BuilderAgent extends BaseAgent {
    constructor();
    _execute(input: any): Promise<{
        agentId: any;
        taskType: any;
        status: string;
        output: string;
        timestamp: string;
    }>;
}
export class ResearcherAgent extends BaseAgent {
    constructor();
    _execute(input: any): Promise<{
        agentId: any;
        taskType: any;
        status: string;
        output: string;
        timestamp: string;
    }>;
}
export class DeployerAgent extends BaseAgent {
    constructor();
    _execute(input: any): Promise<{
        agentId: any;
        taskType: any;
        status: string;
        output: string;
        timestamp: string;
    }>;
}
export class AuditorAgent extends BaseAgent {
    constructor();
    _execute(input: any): Promise<{
        agentId: any;
        taskType: any;
        status: string;
        output: string;
        timestamp: string;
    }>;
}
export class ObserverAgent extends BaseAgent {
    constructor();
    _execute(input: any): Promise<{
        agentId: any;
        taskType: any;
        status: string;
        output: string;
        timestamp: string;
    }>;
}
import { NonprofitConsultantAgent } from "./nonprofit-agent";
export class BaseAgent {
    constructor(id: any, skills: any, description: any);
    id: any;
    skills: any;
    _description: any;
    history: any[];
    describe(): any;
    handle(input: any): Promise<{
        Cognitive_Telemetry_Payload: {
            agentId: any;
            schema_version: string;
            intent_hash: string;
            context_inputs: any;
            tool_selection: any;
            operational_output: {
                agentId: any;
                status: string;
                output: string;
            } | {
                raw: never;
            };
            permission_scope: {
                authenticated: boolean;
                bounds_check: string;
                enforced_policy: string;
            };
            duration_ms: number;
        };
        SECURITY_AUDIT: {
            heady_timestamp: string;
            action_type: string;
            confidence_score: string;
            simulated_sha256_hash: string;
            pqc_ml_kem_768_signature: string;
        };
        agentId: any;
        status: string;
        output: string;
    } | {
        Cognitive_Telemetry_Payload: {
            agentId: any;
            schema_version: string;
            intent_hash: string;
            context_inputs: any;
            tool_selection: any;
            operational_output: {
                agentId: any;
                status: string;
                output: string;
            } | {
                raw: never;
            };
            permission_scope: {
                authenticated: boolean;
                bounds_check: string;
                enforced_policy: string;
            };
            duration_ms: number;
        };
        SECURITY_AUDIT: {
            heady_timestamp: string;
            action_type: string;
            confidence_score: string;
            simulated_sha256_hash: string;
            pqc_ml_kem_768_signature: string;
        };
        rawOutput: never;
    }>;
    _execute(_input: any): Promise<{
        agentId: any;
        status: string;
        output: string;
    }>;
    getStatus(): {
        id: any;
        skills: any;
        invocations: number;
        successRate: number;
    };
}
export { ClaudeCodeAgent, HeadyFinTechAgent, NonprofitConsultantAgent };
//# sourceMappingURL=index.d.ts.map