export class SkillRouter {
    agents: Map<any, any>;
    routeHistory: any[];
    totalRouted: number;
    /**
     * Register an agent with its capabilities.
     */
    register(agentId: any, skills?: any[], capacity?: number): void;
    /**
     * Route a task to the best agent based on skill match + load + success rate.
     */
    route(requiredSkill: any, priority?: string): {
        assigned: any;
        score: number;
        skill: any;
    } | {
        assigned: null;
        reason: string;
    };
    /**
     * Record task completion for an agent.
     */
    complete(agentId: any, success?: boolean): void;
    getStatus(): {
        ok: boolean;
        totalRouted: number;
        agents: {
            id: any;
            skills: any;
            load: string;
            successRate: string;
        }[];
    };
}
export function getSkillRouter(): any;
//# sourceMappingURL=skill-router.d.ts.map