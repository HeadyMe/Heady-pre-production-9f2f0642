export class HeadyBuddyAgent extends BaseAgent {
    constructor(config?: {});
    config: {};
    outputFormats: {
        raw: {
            id: string;
            label: string;
            icon: string;
            desc: string;
        };
        text: {
            id: string;
            label: string;
            icon: string;
            desc: string;
        };
        markdown: {
            id: string;
            label: string;
            icon: string;
            desc: string;
        };
        pretty: {
            id: string;
            label: string;
            icon: string;
            desc: string;
        };
        branded: {
            id: string;
            label: string;
            icon: string;
            desc: string;
        };
        infographic: {
            id: string;
            label: string;
            icon: string;
            desc: string;
        };
        animated: {
            id: string;
            label: string;
            icon: string;
            desc: string;
        };
        dashboard: {
            id: string;
            label: string;
            icon: string;
            desc: string;
        };
        presentation: {
            id: string;
            label: string;
            icon: string;
            desc: string;
        };
        report: {
            id: string;
            label: string;
            icon: string;
            desc: string;
        };
        conversational: {
            id: string;
            label: string;
            icon: string;
            desc: string;
        };
        technical: {
            id: string;
            label: string;
            icon: string;
            desc: string;
        };
        audience: {
            id: string;
            label: string;
            icon: string;
            desc: string;
        };
        csv: {
            id: string;
            label: string;
            icon: string;
            desc: string;
        };
        api: {
            id: string;
            label: string;
            icon: string;
            desc: string;
        };
    };
    /**
     * Get all available output formats for client rendering.
     */
    getOutputFormats(): ({
        id: string;
        label: string;
        icon: string;
        desc: string;
    } | {
        id: string;
        label: string;
        icon: string;
        desc: string;
    } | {
        id: string;
        label: string;
        icon: string;
        desc: string;
    } | {
        id: string;
        label: string;
        icon: string;
        desc: string;
    } | {
        id: string;
        label: string;
        icon: string;
        desc: string;
    } | {
        id: string;
        label: string;
        icon: string;
        desc: string;
    } | {
        id: string;
        label: string;
        icon: string;
        desc: string;
    } | {
        id: string;
        label: string;
        icon: string;
        desc: string;
    } | {
        id: string;
        label: string;
        icon: string;
        desc: string;
    } | {
        id: string;
        label: string;
        icon: string;
        desc: string;
    } | {
        id: string;
        label: string;
        icon: string;
        desc: string;
    } | {
        id: string;
        label: string;
        icon: string;
        desc: string;
    } | {
        id: string;
        label: string;
        icon: string;
        desc: string;
    } | {
        id: string;
        label: string;
        icon: string;
        desc: string;
    } | {
        id: string;
        label: string;
        icon: string;
        desc: string;
    })[];
    _execute(input: any): Promise<{
        agentId: any;
        taskType: any;
        modeApplied: string;
        outputFormat: any;
        availableFormats: string[];
        status: string;
        output: string;
        timestamp: string;
    }>;
    /**
     * Auto-detect best output format from user's natural language.
     */
    _detectFormat(prompt: any): "text" | "raw" | "markdown" | "pretty" | "branded" | "infographic" | "animated" | "dashboard" | "presentation" | "report" | "technical" | "audience" | "csv" | "api";
    getStatus(): {
        id: any;
        skills: any;
        skillCount: any;
        outputFormats: string[];
        formatCount: number;
        invocations: number;
        successRate: number;
    };
}
export const HEADY_BUDDY_PERSONA: string;
export namespace OUTPUT_FORMATS {
    namespace raw {
        let id: string;
        let label: string;
        let icon: string;
        let desc: string;
    }
    namespace text {
        let id_1: string;
        export { id_1 as id };
        let label_1: string;
        export { label_1 as label };
        let icon_1: string;
        export { icon_1 as icon };
        let desc_1: string;
        export { desc_1 as desc };
    }
    namespace markdown {
        let id_2: string;
        export { id_2 as id };
        let label_2: string;
        export { label_2 as label };
        let icon_2: string;
        export { icon_2 as icon };
        let desc_2: string;
        export { desc_2 as desc };
    }
    namespace pretty {
        let id_3: string;
        export { id_3 as id };
        let label_3: string;
        export { label_3 as label };
        let icon_3: string;
        export { icon_3 as icon };
        let desc_3: string;
        export { desc_3 as desc };
    }
    namespace branded {
        let id_4: string;
        export { id_4 as id };
        let label_4: string;
        export { label_4 as label };
        let icon_4: string;
        export { icon_4 as icon };
        let desc_4: string;
        export { desc_4 as desc };
    }
    namespace infographic {
        let id_5: string;
        export { id_5 as id };
        let label_5: string;
        export { label_5 as label };
        let icon_5: string;
        export { icon_5 as icon };
        let desc_5: string;
        export { desc_5 as desc };
    }
    namespace animated {
        let id_6: string;
        export { id_6 as id };
        let label_6: string;
        export { label_6 as label };
        let icon_6: string;
        export { icon_6 as icon };
        let desc_6: string;
        export { desc_6 as desc };
    }
    namespace dashboard {
        let id_7: string;
        export { id_7 as id };
        let label_7: string;
        export { label_7 as label };
        let icon_7: string;
        export { icon_7 as icon };
        let desc_7: string;
        export { desc_7 as desc };
    }
    namespace presentation {
        let id_8: string;
        export { id_8 as id };
        let label_8: string;
        export { label_8 as label };
        let icon_8: string;
        export { icon_8 as icon };
        let desc_8: string;
        export { desc_8 as desc };
    }
    namespace report {
        let id_9: string;
        export { id_9 as id };
        let label_9: string;
        export { label_9 as label };
        let icon_9: string;
        export { icon_9 as icon };
        let desc_9: string;
        export { desc_9 as desc };
    }
    namespace conversational {
        let id_10: string;
        export { id_10 as id };
        let label_10: string;
        export { label_10 as label };
        let icon_10: string;
        export { icon_10 as icon };
        let desc_10: string;
        export { desc_10 as desc };
    }
    namespace technical {
        let id_11: string;
        export { id_11 as id };
        let label_11: string;
        export { label_11 as label };
        let icon_11: string;
        export { icon_11 as icon };
        let desc_11: string;
        export { desc_11 as desc };
    }
    namespace audience {
        let id_12: string;
        export { id_12 as id };
        let label_12: string;
        export { label_12 as label };
        let icon_12: string;
        export { icon_12 as icon };
        let desc_12: string;
        export { desc_12 as desc };
    }
    namespace csv {
        let id_13: string;
        export { id_13 as id };
        let label_13: string;
        export { label_13 as label };
        let icon_13: string;
        export { icon_13 as icon };
        let desc_13: string;
        export { desc_13 as desc };
    }
    namespace api {
        let id_14: string;
        export { id_14 as id };
        let label_14: string;
        export { label_14 as label };
        let icon_14: string;
        export { icon_14 as icon };
        let desc_14: string;
        export { desc_14 as desc };
    }
}
import { BaseAgent } from "./index";
//# sourceMappingURL=heady-buddy-agent.d.ts.map