declare const _exports: WasmSandbox;
export = _exports;
/**
 * HeadyAPI WASM Sandbox Controller
 * Isolates user-submitted Javascript in the live API playground
 * inside a secure WebAssembly container to prevent prototype pollution
 * or RCE attacks against the HeadyConductor node.
 */
declare class WasmSandbox {
    isolateConfig: {
        memoryLimitMB: number;
        cpuTimeLimitMs: number;
        networkAccess: boolean;
    };
    executeUntrustedCode(userCode: any, injectedContext: any): Promise<{
        success: boolean;
        result: any;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        result?: undefined;
    }>;
}
//# sourceMappingURL=wasm-sandbox.d.ts.map