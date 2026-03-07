export const app: any;
import logger = require("../utils/logger");
export const eventBus: EventEmitter<[never]>;
import redisPool = require("../utils/redis-pool");
export namespace remoteConfig {
    let services: {};
}
export let secretsManager: null;
export let cfManager: null;
export let imaginationRoutes: null;
import { midiBus } from "../engines/midi-event-bus";
import { EventEmitter } from "events";
export { logger, redisPool, midiBus };
//# sourceMappingURL=config-globals.d.ts.map