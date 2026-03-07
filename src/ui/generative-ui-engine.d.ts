export class GenerativeUI {
    cache: Map<any, any>;
    renderCount: number;
    templates: {
        card: {
            wrapper: string;
            class: string;
            slots: string[];
        };
        list: {
            wrapper: string;
            class: string;
            slots: string[];
        };
        form: {
            wrapper: string;
            class: string;
            slots: string[];
        };
        dashboard: {
            wrapper: string;
            class: string;
            slots: string[];
        };
        chat: {
            wrapper: string;
            class: string;
            slots: string[];
        };
    };
    /**
     * Generate a UI component from a semantic description.
     * @param {string} description - e.g., "Show a dashboard with 3 cards for memory, CPU, latency"
     * @param {Object} data - Dynamic data to inject
     * @returns {Object} - { html, css, type, metadata }
     */
    generate(description: string, data?: Object): Object;
    _inferType(desc: any): "chat" | "dashboard" | "card" | "form" | "list";
    _render(template: any, type: any, data: any, description: any): string;
    _generateCSS(type: any): string;
    /**
     * Sandboxed component wrapper.
     */
    sandbox(component: any, permissions?: string[]): any;
    getStatus(): {
        ok: boolean;
        renderCount: number;
        cacheSize: number;
        templates: string[];
    };
}
export function getGenerativeUI(): any;
//# sourceMappingURL=generative-ui-engine.d.ts.map