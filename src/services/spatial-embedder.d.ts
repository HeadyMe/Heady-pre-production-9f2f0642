/**
 * Compute 3D spatial coordinates for a text payload.
 * @param {string} text - raw content
 * @param {object} [meta] - optional { filePath, mtime, birthtime, isRealtime }
 * @returns {{ x: number, y: number, z: number, receipt: string }}
 */
export function embed(text: string, meta?: object): {
    x: number;
    y: number;
    z: number;
    receipt: string;
};
/**
 * Batch embed multiple payloads.
 * @param {Array<{ text: string, meta?: object }>} items
 * @returns {Array<{ x, y, z, receipt }>}
 */
export function batchEmbed(items: Array<{
    text: string;
    meta?: object;
}>): Array<{
    x: any;
    y: any;
    z: any;
    receipt: any;
}>;
/**
 * Score text against a keyword dictionary.
 * Returns weighted average of matched categories.
 */
export function scoreByKeywords(text: any, keywordMap: any): number;
/**
 * Score temporal state from file metadata + content signals.
 * @param {object} meta - { mtime, birthtime, isRealtime }
 * @param {string} text
 * @returns {number} 0..1
 */
export function scoreTemporalState(text: string, meta?: object): number;
/**
 * Score structural hierarchy (abstraction level).
 */
export function scoreAbstraction(text: any): number;
export function deterministicReceipt(data: any): string;
export function getConfig(): any;
export function registerRoutes(app: any): void;
export namespace DOMAIN_KEYWORDS {
    namespace deepInfra {
        let score: number;
        let terms: string[];
    }
    namespace backend {
        let score_1: number;
        export { score_1 as score };
        let terms_1: string[];
        export { terms_1 as terms };
    }
    namespace shared {
        let score_2: number;
        export { score_2 as score };
        let terms_2: string[];
        export { terms_2 as terms };
    }
    namespace frontend {
        let score_3: number;
        export { score_3 as score };
        let terms_3: string[];
        export { terms_3 as terms };
    }
    namespace ui {
        let score_4: number;
        export { score_4 as score };
        let terms_4: string[];
        export { terms_4 as terms };
    }
}
export namespace ABSTRACTION_KEYWORDS {
    namespace literal {
        let score_5: number;
        export { score_5 as score };
        let terms_5: string[];
        export { terms_5 as terms };
    }
    namespace modular {
        let score_6: number;
        export { score_6 as score };
        let terms_6: string[];
        export { terms_6 as terms };
    }
    namespace architectural {
        let score_7: number;
        export { score_7 as score };
        let terms_7: string[];
        export { terms_7 as terms };
    }
}
//# sourceMappingURL=spatial-embedder.d.ts.map