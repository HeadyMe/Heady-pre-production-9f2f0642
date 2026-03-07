declare const _exports: HeadyVinciCache;
export = _exports;
/**
 * HeadyVinci Predictive Edge Cache
 * Learns route transitions and pre-caches AI payload metadata
 * to achieve instant page transitions in HeadyOS/HeadyBuddy.
 */
declare class HeadyVinciCache {
    redis: any;
    markovModel: Map<any, any>;
    recordTransition(src: any, dest: any): Promise<void>;
    predictNext(src: any): Promise<any>;
    predictivePreWarm(srcUserId: any, currentRoute: any): Promise<any>;
}
//# sourceMappingURL=predictive-cache.d.ts.map