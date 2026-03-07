export class Kernel {
    _modules: Map<any, any>;
    _bootTime: number;
    /**
     * Boot all kernel modules in dependency order.
     */
    boot(config?: {}): Promise<this>;
    get(name: any): any;
    getStatus(): {
        ok: boolean;
        uptime: number;
        modules: any;
        totalModules: number;
    };
}
export function getKernel(): any;
//# sourceMappingURL=index.d.ts.map