export const domain: "brain";
export const description: "Brain API chat/analyze/embed/search orchestration";
export const priority: 1;
export function getWork(ctx?: {}): ((() => Promise<{
    bee: string;
    action: string;
    status: string;
    routes: string[];
}>) | (() => Promise<{
    bee: string;
    action: string;
    providers: number;
}>) | (() => Promise<{
    bee: string;
    action: string;
    models: any;
}>))[];
//# sourceMappingURL=brain-bee.d.ts.map