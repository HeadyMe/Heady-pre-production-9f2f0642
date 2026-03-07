export function sanitizeText(value: any): string;
export function buildUserWorkspaceId({ userId, deviceId, site }: {
    userId: any;
    deviceId: any;
    site: any;
}): string;
export function buildChatRequest({ message, userId, token, deviceId, site, history, context, }: {
    message: any;
    userId: any;
    token: any;
    deviceId: any;
    site: any;
    history?: never[] | undefined;
    context?: {} | undefined;
}): {
    headers: {
        'X-Heady-Workspace': string;
        'X-Heady-Device'?: any;
        Authorization?: string | undefined;
        'Content-Type': string;
    };
    body: {
        message: string;
        history: any[];
        context: {
            site: any;
            workspaceId: string;
            userId: any;
            channel: string;
            vector3d: boolean;
        };
    };
    workspaceId: string;
};
export function parseBuddyResponse(payload: any): {
    text: string;
    confirmed: boolean;
    status: any;
};
export function assertConfirmedCompletion(parsed: any, mode?: string): boolean;
//# sourceMappingURL=buddy-chat-contract.d.ts.map