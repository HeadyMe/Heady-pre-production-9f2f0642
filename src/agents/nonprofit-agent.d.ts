/**
 * NonprofitConsultantAgent
 *
 * Extends the system's BaseAgent pattern. To stay decoupled from the
 * specific BaseAgent import path (which may vary across Heady builds),
 * we implement the same interface: { id, skills, describe(), handle(), getStatus() }
 * and delegate to BaseAgent when available.
 */
export class NonprofitConsultantAgent {
    constructor(BaseAgentClass: any);
    id: string;
    skills: string[];
    _description: string;
    history: any[];
    _BaseAgentClass: any;
    _delegate: any;
    describe(): string;
    /**
     * Handle a nonprofit template execution request.
     *
     * @param {object} input - { request: { templateId: "np-001", inputs: { ... } } }
     * @returns {object} Structured output with template results
     */
    handle(input: object): object;
    /**
     * Core execution: resolve template, validate inputs, produce structured output.
     */
    _execute(input: any): Promise<{
        agentId: string;
        taskType: string;
        status: string;
        error: string;
        timestamp: string;
        template?: undefined;
        inputs_received?: undefined;
        inputs_missing?: undefined;
        output_sections?: undefined;
        constraints?: undefined;
        vertical?: undefined;
        guidance?: undefined;
    } | {
        agentId: string;
        taskType: string;
        status: string;
        template: {
            id: any;
            name: any;
            category: any;
            complexity: any;
            role: any;
        };
        inputs_received: string[];
        inputs_missing: any;
        output_sections: any;
        constraints: any;
        vertical: string;
        guidance: string;
        timestamp: string;
        error?: undefined;
    }>;
    /**
     * List all available templates with metadata.
     */
    listTemplates(): {
        id: any;
        name: any;
        category: any;
        complexity: any;
        role: any;
        inputs: any;
        output_section_count: any;
    }[];
    /**
     * Get a single template by ID.
     */
    getTemplate(id: any): any;
    /**
     * Get agent status (matches BaseAgent interface).
     */
    getStatus(): {
        id: string;
        skills: string[];
        template_count: number;
        invocations: number;
        successRate: number;
        vertical: string;
    };
}
export namespace TEMPLATE_CATALOG {
    let templates: never[];
}
export const TEMPLATE_INDEX: Map<any, any>;
//# sourceMappingURL=nonprofit-agent.d.ts.map