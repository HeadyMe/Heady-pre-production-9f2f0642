export function start(opts?: {}): {
    lastScan: null;
    scanCount: number;
    kills: never[];
    warnings: never[];
    incidents: never[];
    cpuOffenders: Map<any, any>;
    startedAt: string;
};
export function stop(): void;
export function runScan(): {
    ts: string;
    checks: {};
};
export function getStatus(): {
    running: boolean;
    startedAt: string;
    scanCount: number;
    lastScan: null;
    totalKills: number;
    recentKills: never[];
    recentWarnings: never[];
    cpuTracked: number;
    config: {
        intervalMs: number;
        cpuThreshold: number;
        cpuGraceSeconds: number;
        gitMaxRuntime: number;
        minFreeMB: number;
        diskThreshold: number;
    };
};
export function registerRoutes(app: any): void;
export namespace CONFIG {
    let intervalMs: number;
    namespace cpu {
        let threshold: number;
        let graceSeconds: number;
    }
    namespace git {
        let maxRuntimeSeconds: number;
        let commands: string[];
    }
    namespace memory {
        let minFreeMB: number;
    }
    namespace swap {
        let kswapCpuThreshold: number;
    }
    namespace disk {
        let usageThreshold: number;
        let mountPoints: string[];
    }
    namespace ripgrep {
        let maxRuntimeSeconds_1: number;
        export { maxRuntimeSeconds_1 as maxRuntimeSeconds };
    }
    let coreDumpDir: string;
    let logFile: string;
}
declare function checkRunawayCPU(): {
    killed: number;
    tracked: number;
};
declare function checkHungGit(): {
    killed: number;
    found: number;
};
declare function checkRunawayRipgrep(): {
    killed: number;
    found: number;
};
declare function checkMemory(): {
    totalMB: number;
    availableMB: number;
    ok: boolean;
} | {
    ok: boolean;
};
declare function checkSwap(): {
    thrashing: boolean;
    cpu?: undefined;
} | {
    thrashing: boolean;
    cpu: number;
};
declare function checkDisk(): {};
declare function cleanCoreDumps(): {
    deleted: number;
    freedBytes: number;
};
declare function isSafe(cmd: any, pid: any): boolean;
declare namespace state {
    let lastScan: null;
    let scanCount: number;
    let kills: never[];
    let warnings: never[];
    let incidents: never[];
    let cpuOffenders: Map<any, any>;
    let startedAt: string;
}
export declare namespace _internals {
    export { checkRunawayCPU };
    export { checkHungGit };
    export { checkRunawayRipgrep };
    export { checkMemory };
    export { checkSwap };
    export { checkDisk };
    export { cleanCoreDumps };
    export { isSafe };
    export { state };
}
export {};
//# sourceMappingURL=system-monitor.d.ts.map