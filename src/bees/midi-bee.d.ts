export const domain: "midi";
export const description: "Network MIDI, MIDI event bus, UMP UDP transport, DAW MCP bridge, Ableton Remote Script";
export const priority: 0.5;
export function getWork(ctx?: {}): (() => Promise<{
    bee: string;
    action: string;
    loaded: boolean;
}>)[];
//# sourceMappingURL=midi-bee.d.ts.map