export class Saga {
    constructor(name: any);
    name: any;
    steps: any[];
    completedSteps: any[];
    status: string;
    /**
     * Add a saga step with execute and compensate functions.
     */
    step(name: any, execute: any, compensate: any): this;
    /**
     * Execute the saga. If any step fails, compensate all completed steps in reverse.
     */
    run(context?: {}): Promise<{}>;
    getStatus(): {
        name: any;
        status: string;
        totalSteps: number;
        completedSteps: any[];
    };
}
export function createSaga(name: any): Saga;
//# sourceMappingURL=saga.d.ts.map