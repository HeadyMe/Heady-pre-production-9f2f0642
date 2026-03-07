export const domain: "audio-overview-generator";
export const description: "Generate audio overview scripts with Google Cloud TTS or NotebookLM";
export const priority: 0.6;
export function getWork(ctx?: {}): (() => Promise<{
    bee: string;
    action: string;
    status: string;
    ts: number;
}>)[];
//# sourceMappingURL=audio-overview-generator-bee.d.ts.map