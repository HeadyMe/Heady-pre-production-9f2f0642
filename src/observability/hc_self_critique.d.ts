export class SelfCritiqueEngine extends EventEmitter<[never]> {
    constructor();
    _critiques: any[];
    _improvements: any[];
    recordCritique(critique: any): any;
    recordImprovement(improvement: any): any;
    getCritiques(limit?: number): any[];
    getImprovements(limit?: number): any[];
    getHealth(): {
        ok: boolean;
        service: string;
        critiques: number;
        improvements: number;
    };
}
export const selfCritique: SelfCritiqueEngine;
export function registerSelfCritiqueRoutes(app: any, engine: any): void;
import { EventEmitter } from "events";
//# sourceMappingURL=hc_self_critique.d.ts.map