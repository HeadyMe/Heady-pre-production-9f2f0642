export class TemplateEngine {
    constructor(options?: {});
    weights: any;
    limits: any;
    templates: any[];
    /**
     * Load templates from an array or registry object
     */
    loadTemplates(input: any): this;
    /**
     * Score a single template using 6-dimensional weighted evaluation
     * @param {object} template
     * @returns {number} score (0-1)
     */
    score(template: object): number;
    /**
     * Select optimal templates for a given situation
     * @param {string} situation - predicted situation name
     * @param {number} limit - max templates to return
     * @returns {Array} sorted templates with scores
     */
    select(situation: string, limit?: number): any[];
    /**
     * Get coverage report — which situations have templates
     */
    coverageReport(situations?: any[]): {};
    /**
     * Rank all templates by score
     */
    rankAll(): {
        id: any;
        name: any;
        score: number;
    }[];
}
//# sourceMappingURL=template-engine.d.ts.map