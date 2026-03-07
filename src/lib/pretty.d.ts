export function pp(data: any, opts?: {}): void;
export function ppTable(rows: any, opts?: {}): void;
export function fmtValue(val: any, key?: string): string;
export function humanKey(key: any): any;
export function formatTimestamp(ts: any): any;
export function formatBytes(bytes: any): string;
export function prettyJsonMiddleware(): (req: any, res: any, next: any) => void;
export function prettyHTML(data: any, opts?: {}): string;
export function formatForBrowser(data: any): any;
export function transformDeep(obj: any): any;
export namespace C {
    let reset: string;
    let bold: string;
    let dim: string;
    let cyan: string;
    let green: string;
    let yellow: string;
    let magenta: string;
    let red: string;
    let blue: string;
    let gray: string;
    let white: string;
    let bgDim: string;
}
export namespace ICONS {
    export let success: string;
    export let error: string;
    export let warning: string;
    export let info: string;
    export let running: string;
    export let paused: string;
    export let completed: string;
    export let failed: string;
    export let healthy: string;
    export let degraded: string;
    export let down: string;
    export let GREEN: string;
    export let YELLOW: string;
    export let ORANGE: string;
    export let RED: string;
    let _true: string;
    export { _true as true };
    let _false: string;
    export { _false as false };
}
/**
 * Branded ASCII banner with Sacred Geometry motif
 * @param {string} title - Main banner text
 * @param {string} [subtitle] - Optional subtitle
 */
export function banner(title: string, subtitle?: string): void;
/**
 * Horizontal bar chart for terminal
 * @param {Array<{label: string, value: number, max?: number}>} items
 * @param {Object} [opts]
 */
export function barChart(items: Array<{
    label: string;
    value: number;
    max?: number;
}>, opts?: Object): void;
/**
 * Progress bar with label
 * @param {string} label
 * @param {number} current
 * @param {number} total
 * @param {Object} [opts]
 */
export function progressBar(label: string, current: number, total: number, opts?: Object): void;
/**
 * Sparkline for compact trend visualization
 * @param {number[]} values
 * @returns {string} sparkline string
 */
export function sparkline(values: number[]): string;
/**
 * Status indicator with icon and color
 * @param {string} label
 * @param {string} status - "active"|"healthy"|"warning"|"error"|"down"
 * @param {string} [detail]
 */
export function statusLine(label: string, status: string, detail?: string): void;
/**
 * Section divider with label
 * @param {string} label
 */
export function section(label: string): void;
/**
 * Key-value summary box
 * @param {Object} data
 * @param {string} [title]
 */
export function kvBox(data: Object, title?: string): void;
//# sourceMappingURL=pretty.d.ts.map