export default HolographicOrderBook;
declare class HolographicOrderBook {
    constructor(canvasElement: any);
    canvas: any;
    gl: any;
    PHI: number | undefined;
    COLORS: {
        bid: number[];
        ask: number[];
        agent: number[];
    } | undefined;
    initShaders(): void;
    renderTick(ternaryMatrixBuffer: any): void;
}
//# sourceMappingURL=webgl-orderbook.d.ts.map