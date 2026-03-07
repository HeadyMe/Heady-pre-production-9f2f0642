declare const _exports: RuleZGatekeeper;
export = _exports;
declare class RuleZGatekeeper {
    constructor(rulesDir?: string);
    rules: Map<any, any>;
    /**
     * Verifies that the proposed agent payload strictly adheres to the
     * deterministic schema definitions before entering the next pipeline phase.
     */
    validate(domain: any, payload: any): boolean;
    _checkSchemaMatch(schema: any, payload: any): boolean;
}
//# sourceMappingURL=rulez-gatekeeper.d.ts.map