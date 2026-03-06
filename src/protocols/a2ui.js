/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Agent-to-User Interface (A2UI) Protocol — Declarative JSON UI Streaming
 *
 * Agents stream declarative JSON blueprints instead of raw markdown text.
 * The client renders native React/Shadcn/WebGL components dynamically.
 *
 * Key concepts:
 * - Agents push A2UI payloads describing UI *intent* (not markup)
 * - Client-side renderer interprets payloads into native components
 * - Supports: cards, charts, forms, tables, alerts, live data, WebGL canvases
 */

'use strict';

const logger = require('../utils/logger');

// ─── A2UI Component Types ────────────────────────────────────────────────────
const COMPONENT_TYPES = Object.freeze({
    CARD: 'card',
    CHART: 'chart',
    FORM: 'form',
    TABLE: 'table',
    ALERT: 'alert',
    METRIC: 'metric',
    LIVE_STREAM: 'live_stream',
    WEBGL_CANVAS: 'webgl_canvas',
    CODE_BLOCK: 'code_block',
    MARKDOWN: 'markdown',
    ACTION_BUTTON: 'action_button',
    PROGRESS: 'progress',
    DAG: 'dag',
    ORDER_BOOK: 'order_book',
});

// ─── A2UI Payload Builder ────────────────────────────────────────────────────
class A2UIPayloadBuilder {
    constructor() {
        this._components = [];
        this._meta = { version: '1.0.0', protocol: 'a2ui', theme: 'auto' };
    }

    /**
     * Set the OKLCH theme palette.
     * @param {string} mode - 'analytical' (cyan) | 'creative' (violet) | 'alert' (amber)
     */
    setTheme(mode) {
        const themes = {
            analytical: { primary: 'oklch(0.7 0.15 200)', accent: 'oklch(0.8 0.1 210)', mode: 'analytical' },
            creative: { primary: 'oklch(0.6 0.2 300)', accent: 'oklch(0.7 0.15 310)', mode: 'creative' },
            alert: { primary: 'oklch(0.7 0.2 60)', accent: 'oklch(0.8 0.15 50)', mode: 'alert' },
            financial: { primary: 'oklch(0.65 0.18 145)', accent: 'oklch(0.5 0.2 25)', mode: 'financial' },
        };
        this._meta.theme = themes[mode] || themes.analytical;
        return this;
    }

    /**
     * Add a metric card.
     */
    addMetric(label, value, opts = {}) {
        this._components.push({
            type: COMPONENT_TYPES.METRIC,
            label,
            value,
            unit: opts.unit || '',
            trend: opts.trend || null,    // 'up' | 'down' | 'flat'
            sparkline: opts.sparkline || null,
            priority: opts.priority || 'normal',
        });
        return this;
    }

    /**
     * Add a chart component.
     */
    addChart(chartType, data, opts = {}) {
        this._components.push({
            type: COMPONENT_TYPES.CHART,
            chartType,  // 'line', 'bar', 'candlestick', 'heatmap', 'scatter3d'
            data,
            title: opts.title || '',
            axes: opts.axes || {},
            interactive: opts.interactive !== false,
            refreshInterval: opts.refreshInterval || null,
        });
        return this;
    }

    /**
     * Add a form for parameter elicitation.
     */
    addForm(fields, opts = {}) {
        this._components.push({
            type: COMPONENT_TYPES.FORM,
            fields: fields.map(f => ({
                name: f.name,
                label: f.label || f.name,
                inputType: f.type || 'text', // 'text', 'number', 'slider', 'dropdown', 'toggle', 'date'
                options: f.options || null,
                default: f.default || null,
                min: f.min, max: f.max, step: f.step,
                required: f.required !== false,
                validation: f.validation || null,
            })),
            submitLabel: opts.submitLabel || 'Submit',
            submitAction: opts.submitAction || 'a2a.task.create',
            cancelable: opts.cancelable !== false,
        });
        return this;
    }

    /**
     * Add a data table.
     */
    addTable(columns, rows, opts = {}) {
        this._components.push({
            type: COMPONENT_TYPES.TABLE,
            columns,
            rows,
            sortable: opts.sortable !== false,
            filterable: opts.filterable || false,
            pagination: opts.pagination || null,
            title: opts.title || '',
        });
        return this;
    }

    /**
     * Add an alert/notification.
     */
    addAlert(severity, message, opts = {}) {
        this._components.push({
            type: COMPONENT_TYPES.ALERT,
            severity, // 'info', 'warning', 'error', 'success'
            message,
            dismissible: opts.dismissible !== false,
            action: opts.action || null,
        });
        return this;
    }

    /**
     * Add a WebGL canvas for hardware-accelerated rendering.
     */
    addWebGLCanvas(canvasType, dataSource, opts = {}) {
        this._components.push({
            type: COMPONENT_TYPES.WEBGL_CANVAS,
            canvasType,  // 'order_book_3d', 'vector_space', 'network_graph', 'heatmap_3d'
            dataSource,  // WebSocket URL or API endpoint for live data
            fps: opts.fps || 60,
            dimensions: opts.dimensions || { width: '100%', height: 400 },
            overlays: opts.overlays || [],
            interactive: opts.interactive !== false,
        });
        return this;
    }

    /**
     * Add a real-time order book display.
     */
    addOrderBook(symbol, opts = {}) {
        this._components.push({
            type: COMPONENT_TYPES.ORDER_BOOK,
            symbol,
            depth: opts.depth || 20,
            dataSource: opts.dataSource || `/api/v2/trader/orderbook/${symbol}`,
            refreshMs: opts.refreshMs || 100,
            showSpread: opts.showSpread !== false,
            volumeProfile: opts.volumeProfile || false,
        });
        return this;
    }

    /**
     * Add a DAG visualization node.
     */
    addDAG(nodes, edges, opts = {}) {
        this._components.push({
            type: COMPONENT_TYPES.DAG,
            nodes: nodes.map(n => ({
                id: n.id,
                label: n.label,
                status: n.status || 'idle', // 'idle', 'running', 'success', 'error', 'hallucinating'
                metrics: n.metrics || {},
            })),
            edges: edges.map(e => ({
                source: e.source,
                target: e.target,
                label: e.label || '',
                weight: e.weight || 1,
            })),
            layout: opts.layout || 'dagre',
            animated: opts.animated !== false,
        });
        return this;
    }

    /**
     * Add an action button.
     */
    addAction(label, action, opts = {}) {
        this._components.push({
            type: COMPONENT_TYPES.ACTION_BUTTON,
            label,
            action,
            variant: opts.variant || 'default', // 'default', 'primary', 'destructive', 'outline'
            requireConfirm: opts.requireConfirm || false,
            requireBiometric: opts.requireBiometric || false,
        });
        return this;
    }

    /**
     * Build the final A2UI payload.
     */
    build() {
        return {
            ...this._meta,
            components: this._components,
            generatedAt: new Date().toISOString(),
            componentCount: this._components.length,
        };
    }

    /**
     * Static factory: create a payload from raw components.
     */
    static fromComponents(components, opts = {}) {
        return {
            version: '1.0.0',
            protocol: 'a2ui',
            theme: opts.theme || 'auto',
            components,
            generatedAt: new Date().toISOString(),
            componentCount: components.length,
        };
    }
}

// ─── A2UI Route Registration ─────────────────────────────────────────────────
function registerA2UIRoutes(app) {
    // Serve the A2UI protocol spec
    app.get('/api/v2/a2ui/spec', (req, res) => {
        res.json({
            ok: true,
            version: '1.0.0',
            componentTypes: Object.values(COMPONENT_TYPES),
            themes: ['analytical', 'creative', 'alert', 'financial'],
        });
    });

    // Preview: generate a sample A2UI payload
    app.get('/api/v2/a2ui/preview', (req, res) => {
        const builder = new A2UIPayloadBuilder();
        const payload = builder
            .setTheme('analytical')
            .addMetric('System Confidence', '87%', { trend: 'up', sparkline: [72, 78, 81, 85, 87] })
            .addMetric('Active Agents', 26, { unit: 'bees' })
            .addMetric('Vector Memory', '4,231', { unit: 'vectors' })
            .addAlert('info', 'All systems operational — Sacred Geometry mesh stable')
            .addChart('line', { labels: ['1m', '5m', '15m', '1h'], values: [0.82, 0.85, 0.87, 0.89] }, { title: 'Confidence Trend' })
            .addAction('Run Pipeline', 'pipeline.run', { variant: 'primary' })
            .build();
        res.json({ ok: true, payload });
    });

    // Render an A2UI form dynamically (for parameter elicitation)
    app.post('/api/v2/a2ui/form', (req, res) => {
        const { fields, submitAction, submitLabel } = req.body;
        if (!fields || !Array.isArray(fields)) return res.status(400).json({ error: 'fields array required' });
        const builder = new A2UIPayloadBuilder();
        const payload = builder.addForm(fields, { submitAction, submitLabel }).build();
        res.json({ ok: true, payload });
    });
}

module.exports = { A2UIPayloadBuilder, COMPONENT_TYPES, registerA2UIRoutes };
