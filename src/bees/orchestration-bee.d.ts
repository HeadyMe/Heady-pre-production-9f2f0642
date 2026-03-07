export const domain: "orchestration";
export const description: "Agent orchestration, buddy core, cloud routing, conductor, spatial mapping";
export const priority: 0.95;
export function getWork(ctx?: {}): ((() => Promise<{
    bee: string;
    action: string;
    supervisors: any;
    completed: any;
    status?: undefined;
} | {
    bee: string;
    action: string;
    status: string;
    supervisors?: undefined;
    completed?: undefined;
}>) | (() => Promise<{
    bee: string;
    action: string;
    loaded: boolean;
}>) | (() => Promise<{
    bee: string;
    action: string;
    routes: any;
    loaded?: undefined;
} | {
    bee: string;
    action: string;
    loaded: boolean;
    routes?: undefined;
}>))[];
//# sourceMappingURL=orchestration-bee.d.ts.map