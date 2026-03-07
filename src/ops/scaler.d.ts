declare const _exports: ServiceGroupScaler;
export = _exports;
declare class ServiceGroupScaler {
    groups: string[];
    utilizationThresholds: {
        scaleUp: number;
        scaleDown: number;
    };
    evaluateGroupHealth(groupName: any, currentCpuLoad: any): Promise<{
        status: string;
        group: any;
    }>;
    dispatchScaleEvent(groupName: any, direction: any): {
        status: string;
        group: any;
    };
}
//# sourceMappingURL=scaler.d.ts.map