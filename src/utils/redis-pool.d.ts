export const client: any;
import { getPoolHealth } from "../services/upstash-redis";
import { isConfigured } from "../services/upstash-redis";
export declare function getClient(): any;
export declare function get(key: any): any;
export declare function set(key: any, value: any, opts: any): any;
export declare function del(...keys: any[]): any;
export declare function incr(key: any): any;
export declare function keys(pattern: any): any;
export declare function ping(): any;
export declare function hset(key: any, field: any, value: any): any;
export declare function hget(key: any, field: any): any;
export declare function hgetall(key: any): any;
export declare function lpush(key: any, ...values: any[]): any;
export declare function lrange(key: any, start: any, stop: any): any;
export declare function init(): Promise<void>;
export declare function close(): void;
export { getPoolHealth, isConfigured };
//# sourceMappingURL=redis-pool.d.ts.map