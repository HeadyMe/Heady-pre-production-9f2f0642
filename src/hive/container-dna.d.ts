export class ContainerDNA {
    role: string;
    modules: any;
    bootedAt: number | null;
    activeModules: any[];
    /**
     * Boot the container in the configured role.
     */
    boot(): this;
    /**
     * Hot-swap role at runtime without restart.
     */
    morph(newRole: any): {
        ok: boolean;
        error: string;
        previousRole?: undefined;
        newRole?: undefined;
        modules?: undefined;
    } | {
        ok: boolean;
        previousRole: string;
        newRole: any;
        modules: any;
        error?: undefined;
    };
    getStatus(): {
        ok: boolean;
        role: string;
        modules: any;
        activeModules: any[];
        uptime: number;
        availableRoles: string[];
    };
}
export function getContainerDNA(): any;
export namespace ROLE_MODULES {
    let brain: string[];
    let conductor: string[];
    let worker: string[];
    let edge: string[];
    let gateway: string[];
    let monitor: string[];
    let full: string[];
}
//# sourceMappingURL=container-dna.d.ts.map