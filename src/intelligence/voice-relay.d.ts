declare const _exports: VoiceRelay;
export = _exports;
/**
 * HeadyBuddy Voice Relay
 * Captures Web Speech API text from mobile and routes it directly
 * into the desktop IDE/Mini-PC via WebSockets and Redis PubSub.
 */
declare class VoiceRelay {
    redis: any;
    sub: any;
    transmitDictation(userId: any, payloadText: any): Promise<void>;
    listenForDesktop(userId: any, uiCallback: any): void;
}
//# sourceMappingURL=voice-relay.d.ts.map