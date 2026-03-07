export = SandboxExecutor;
declare class SandboxExecutor {
    constructor(opts?: {});
    baseTmpDir: any;
    defaultTimeout: any;
    defaultMemoryMB: any;
    maxOutputBytes: any;
    allowNetwork: any;
    executions: any[];
    maxExecutions: any;
    execute(code: any, opts?: {}): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        status: string;
        stdout: string;
        stderr: string;
        exitCode: null;
        error: null;
        metrics: {};
    }>;
    _prepareExecution(language: any, code: any, sandboxDir: any, memoryMB: any): {
        cmd: string;
        args: string[];
        scriptFile: string;
    };
    _runProcess(cmd: any, args: any, opts: any): Promise<any>;
    getExecution(id: any): any;
    getExecutions(limit?: number): any[];
    status(): {
        total: number;
        completed: number;
        failed: number;
        allowNetwork: any;
        defaultTimeoutMs: any;
        defaultMemoryMB: any;
    };
}
//# sourceMappingURL=sandbox-executor.d.ts.map