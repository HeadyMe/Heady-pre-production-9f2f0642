export class HCStoryDriver {
    _events: any[];
    _stories: any[];
    _maxEvents: number;
    ingestSystemEvent(event: any): void;
    getRecentStories(limit?: number): any[];
    getHealth(): {
        ok: boolean;
        service: string;
        events: number;
        stories: number;
    };
}
export function registerStoryRoutes(app: any, driver: any): void;
//# sourceMappingURL=hc_story_driver.d.ts.map