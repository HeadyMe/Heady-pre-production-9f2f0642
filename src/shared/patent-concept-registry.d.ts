export const PATENT_CONCEPTS: ({
    ppa: number;
    name: string;
    appNum: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef: string;
} | {
    ppa: number;
    name: string;
    appNum: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef?: undefined;
} | {
    ppa: string;
    name: string;
    appNum: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef: string;
} | {
    ppa: number;
    name: string;
    domain: string;
    filed: boolean;
    status: string;
    appNum?: undefined;
    codeRef?: undefined;
} | {
    ppa: number;
    name: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef: string;
    appNum?: undefined;
})[];
export function getAll(): ({
    ppa: number;
    name: string;
    appNum: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef: string;
} | {
    ppa: number;
    name: string;
    appNum: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef?: undefined;
} | {
    ppa: string;
    name: string;
    appNum: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef: string;
} | {
    ppa: number;
    name: string;
    domain: string;
    filed: boolean;
    status: string;
    appNum?: undefined;
    codeRef?: undefined;
} | {
    ppa: number;
    name: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef: string;
    appNum?: undefined;
})[];
export function getByPPA(ppa: any): {
    ppa: number;
    name: string;
    appNum: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef: string;
} | {
    ppa: number;
    name: string;
    appNum: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef?: undefined;
} | {
    ppa: string;
    name: string;
    appNum: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef: string;
} | {
    ppa: number;
    name: string;
    domain: string;
    filed: boolean;
    status: string;
    appNum?: undefined;
    codeRef?: undefined;
} | {
    ppa: number;
    name: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef: string;
    appNum?: undefined;
} | undefined;
export function findByDomain(domain: any): ({
    ppa: number;
    name: string;
    appNum: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef: string;
} | {
    ppa: number;
    name: string;
    appNum: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef?: undefined;
} | {
    ppa: string;
    name: string;
    appNum: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef: string;
} | {
    ppa: number;
    name: string;
    domain: string;
    filed: boolean;
    status: string;
    appNum?: undefined;
    codeRef?: undefined;
} | {
    ppa: number;
    name: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef: string;
    appNum?: undefined;
})[];
export function findByStatus(status: any): ({
    ppa: number;
    name: string;
    appNum: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef: string;
} | {
    ppa: number;
    name: string;
    appNum: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef?: undefined;
} | {
    ppa: string;
    name: string;
    appNum: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef: string;
} | {
    ppa: number;
    name: string;
    domain: string;
    filed: boolean;
    status: string;
    appNum?: undefined;
    codeRef?: undefined;
} | {
    ppa: number;
    name: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef: string;
    appNum?: undefined;
})[];
export function findByName(keyword: any): ({
    ppa: number;
    name: string;
    appNum: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef: string;
} | {
    ppa: number;
    name: string;
    appNum: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef?: undefined;
} | {
    ppa: string;
    name: string;
    appNum: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef: string;
} | {
    ppa: number;
    name: string;
    domain: string;
    filed: boolean;
    status: string;
    appNum?: undefined;
    codeRef?: undefined;
} | {
    ppa: number;
    name: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef: string;
    appNum?: undefined;
})[];
export function getFiled(): ({
    ppa: number;
    name: string;
    appNum: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef: string;
} | {
    ppa: number;
    name: string;
    appNum: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef?: undefined;
} | {
    ppa: string;
    name: string;
    appNum: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef: string;
} | {
    ppa: number;
    name: string;
    domain: string;
    filed: boolean;
    status: string;
    appNum?: undefined;
    codeRef?: undefined;
} | {
    ppa: number;
    name: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef: string;
    appNum?: undefined;
})[];
export function getUnfiled(): ({
    ppa: number;
    name: string;
    appNum: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef: string;
} | {
    ppa: number;
    name: string;
    appNum: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef?: undefined;
} | {
    ppa: string;
    name: string;
    appNum: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef: string;
} | {
    ppa: number;
    name: string;
    domain: string;
    filed: boolean;
    status: string;
    appNum?: undefined;
    codeRef?: undefined;
} | {
    ppa: number;
    name: string;
    domain: string;
    filed: boolean;
    status: string;
    codeRef: string;
    appNum?: undefined;
})[];
export function getCoverage(): {
    total: number;
    filed: number;
    unfiled: number;
    active: number;
    archived: number;
    partial: number;
    missing: number;
    coveragePercent: number;
    embeddedPercent: number;
    domains: any;
};
/**
 * Verify all patents are embedded in vector memory.
 * Returns { embedded, missing } counts.
 */
export function verifyVectorPresence(vectorMemory: any): Promise<{
    embedded: number;
    missing: number;
    error: string;
    missingPatents?: undefined;
} | {
    embedded: number;
    missing: number;
    missingPatents: string[];
    error?: undefined;
}>;
export function registerRoutes(app: any): void;
//# sourceMappingURL=patent-concept-registry.d.ts.map