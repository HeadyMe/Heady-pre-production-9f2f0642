export class CreativeEngine {
    /**
     * @param {object} opts
     * @param {object}  [opts.llmRouter]    - LLMRouter instance
     * @param {object}  [opts.templates]    - Additional custom templates (merged with built-ins)
     * @param {number}  [opts.maxTokens]    - Default max tokens for generation
     * @param {boolean} [opts.streaming]    - Enable streaming responses
     */
    constructor(opts?: {
        llmRouter?: object | undefined;
        templates?: object | undefined;
        maxTokens?: number | undefined;
        streaming?: boolean | undefined;
    });
    _router: any;
    _templates: {
        readme: {
            style: "technical";
            template: string;
        };
        'commit-message': {
            style: "code";
            template: string;
        };
        'blog-post': {
            style: "prose";
            template: string;
        };
        'api-doc': {
            style: "technical";
            template: string;
        };
        'code-review': {
            style: "technical";
            template: string;
        };
        pitch: {
            style: "marketing";
            template: string;
        };
    };
    _maxTokens: number;
    _streaming: boolean;
    /**
     * Generate creative content.
     * @param {string|object} prompt  - Prompt string or { text, context, constraints }
     * @param {string}        style   - One of STYLES values (default: STYLES.PROSE)
     * @param {object}        opts
     * @param {string}   [opts.model]       - Force specific model
     * @param {number}   [opts.temperature] - Override temperature
     * @param {number}   [opts.maxTokens]   - Override max tokens
     * @param {string}   [opts.format]      - 'text'|'markdown'|'json' (default: text)
     * @param {string[]} [opts.stopWords]   - Stop sequences
     * @returns {Promise<GenerationResult>}
     */
    generate(prompt: string | object, style?: string, opts?: {
        model?: string | undefined;
        temperature?: number | undefined;
        maxTokens?: number | undefined;
        format?: string | undefined;
        stopWords?: string[] | undefined;
    }): Promise<GenerationResult>;
    /**
     * Generate content using a named template with variable substitution.
     * @param {string} templateName
     * @param {object} variables     - Values for {{variable}} placeholders
     * @param {object} opts          - Same as generate() opts
     * @returns {Promise<GenerationResult>}
     */
    generateFromTemplate(templateName: string, variables?: object, opts?: object): Promise<GenerationResult>;
    /**
     * Register a custom template.
     * @param {string} name
     * @param {object} template - { template: string, style?: string, description?: string }
     */
    registerTemplate(name: string, template: object): this;
    /**
     * List available templates.
     * @returns {object[]}
     */
    listTemplates(): object[];
    /**
     * Generate multiple variations and optionally rank them.
     * @param {string} prompt
     * @param {string} style
     * @param {object} opts  - { count, rankBy, ...generateOpts }
     * @returns {Promise<GenerationResult[]>}
     */
    generateVariations(prompt: string, style?: string, opts?: object): Promise<GenerationResult[]>;
    /**
     * Refine existing content with instructions.
     * @param {string} content     - Original content
     * @param {string} instruction - Refinement instruction (e.g., "make it shorter", "add more examples")
     * @param {string} style
     * @param {object} opts
     */
    refine(content: string, instruction: string, style?: string, opts?: object): Promise<GenerationResult>;
    listStyles(): ("code" | "conversational" | "technical" | "marketing" | "prose" | "poetry" | "structured")[];
    getStyleConfig(style: any): {
        style: any;
        systemPrompt: any;
        modelPrefs: any;
    };
}
export const STYLES: Readonly<{
    CODE: "code";
    PROSE: "prose";
    POETRY: "poetry";
    TECHNICAL: "technical";
    CONVERSATIONAL: "conversational";
    STRUCTURED: "structured";
    MARKETING: "marketing";
}>;
export namespace STYLE_PROMPTS {
    let code: string;
    let prose: string;
    let poetry: string;
    let technical: string;
    let conversational: string;
    let structured: string;
    let marketing: string;
}
export const BUILT_IN_TEMPLATES: {
    readme: {
        style: "technical";
        template: string;
    };
    'commit-message': {
        style: "code";
        template: string;
    };
    'blog-post': {
        style: "prose";
        template: string;
    };
    'api-doc': {
        style: "technical";
        template: string;
    };
    'code-review': {
        style: "technical";
        template: string;
    };
    pitch: {
        style: "marketing";
        template: string;
    };
};
//# sourceMappingURL=creative-engine.d.ts.map