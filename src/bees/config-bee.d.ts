export const domain: "config";
export const description: "Global config, errors, logger, redis pool, structured logging, pretty print, site renderer";
export const priority: 0.6;
export function getWork(ctx?: {}): (() => Promise<{
    bee: string;
    action: string;
    loaded: boolean;
}>)[];
//# sourceMappingURL=config-bee.d.ts.map