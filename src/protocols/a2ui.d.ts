export class A2UIPayloadBuilder {
    /**
     * Static factory: create a payload from raw components.
     */
    static fromComponents(components: any, opts?: {}): {
        version: string;
        protocol: string;
        theme: any;
        components: any;
        generatedAt: string;
        componentCount: any;
    };
    _components: any[];
    _meta: {
        version: string;
        protocol: string;
        theme: string;
    };
    /**
     * Set the OKLCH theme palette.
     * @param {string} mode - 'analytical' (cyan) | 'creative' (violet) | 'alert' (amber)
     */
    setTheme(mode: string): this;
    /**
     * Add a metric card.
     */
    addMetric(label: any, value: any, opts?: {}): this;
    /**
     * Add a chart component.
     */
    addChart(chartType: any, data: any, opts?: {}): this;
    /**
     * Add a form for parameter elicitation.
     */
    addForm(fields: any, opts?: {}): this;
    /**
     * Add a data table.
     */
    addTable(columns: any, rows: any, opts?: {}): this;
    /**
     * Add an alert/notification.
     */
    addAlert(severity: any, message: any, opts?: {}): this;
    /**
     * Add a WebGL canvas for hardware-accelerated rendering.
     */
    addWebGLCanvas(canvasType: any, dataSource: any, opts?: {}): this;
    /**
     * Add a real-time order book display.
     */
    addOrderBook(symbol: any, opts?: {}): this;
    /**
     * Add a DAG visualization node.
     */
    addDAG(nodes: any, edges: any, opts?: {}): this;
    /**
     * Add an action button.
     */
    addAction(label: any, action: any, opts?: {}): this;
    /**
     * Build the final A2UI payload.
     */
    build(): {
        components: any[];
        generatedAt: string;
        componentCount: number;
        version: string;
        protocol: string;
        theme: string;
    };
}
export const COMPONENT_TYPES: Readonly<{
    CARD: "card";
    CHART: "chart";
    FORM: "form";
    TABLE: "table";
    ALERT: "alert";
    METRIC: "metric";
    LIVE_STREAM: "live_stream";
    WEBGL_CANVAS: "webgl_canvas";
    CODE_BLOCK: "code_block";
    MARKDOWN: "markdown";
    ACTION_BUTTON: "action_button";
    PROGRESS: "progress";
    DAG: "dag";
    ORDER_BOOK: "order_book";
}>;
export function registerA2UIRoutes(app: any): void;
//# sourceMappingURL=a2ui.d.ts.map