declare const _exports: KeyRotationManager;
export = _exports;
declare class KeyRotationManager {
    _keys: Map<any, any>;
    _schedules: any[];
    generateKey(prefix?: string): string;
    registerKey(name: any, currentValue: any): any;
    rotate(name: any): any;
    validate(name: any, token: any): boolean;
    getStatus(): {};
    startAutoRotation(name: any, intervalMs?: number): NodeJS.Timeout;
    stopAll(): void;
}
//# sourceMappingURL=key-rotation.d.ts.map