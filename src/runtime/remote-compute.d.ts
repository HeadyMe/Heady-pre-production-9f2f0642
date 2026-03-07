export function dispatch(action: any, payload: any, vectorMem: any): Promise<any>;
export function dispatchRace(action: any, payload: any, vectorMem: any): Promise<any>;
export function registerRoutes(app: any, vectorMem: any): void;
export namespace stats {
    let totalDispatched: number;
    let totalVectorStored: number;
    let byProvider: {};
    let byAction: {};
    let errors: number;
    let started: number;
}
//# sourceMappingURL=remote-compute.d.ts.map