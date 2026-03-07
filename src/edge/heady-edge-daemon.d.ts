#!/usr/bin/env node
export function boot(): void;
/**
 * Send a MIDI-triggered SysEx command back to the MIDI output.
 */
export function sendSysEx(commandByte: any, payload: any): void;
export function sendToCloud(event: any): Promise<void>;
export namespace state {
    let running: boolean;
    let startedAt: null;
    let cloudConnected: boolean;
    let midiConnected: boolean;
    let fileWatcherActive: boolean;
    let eventsProcessed: number;
    let errors: never[];
}
//# sourceMappingURL=heady-edge-daemon.d.ts.map