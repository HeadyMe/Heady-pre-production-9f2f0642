export = EventStream;
declare class EventStream {
    clients: Map<any, any>;
    eventHistory: any[];
    maxHistory: number;
    registerRoute(app: any): void;
    connectPipeline(pipeline: any): void;
    broadcast(type: any, data: any): void;
    _matchesFilter(filters: any, data: any): boolean;
    _getFilteredHistory(filters: any): any[];
    status(): {
        connectedClients: number;
        eventsInHistory: number;
        lastEvent: any;
    };
}
//# sourceMappingURL=event-stream.d.ts.map