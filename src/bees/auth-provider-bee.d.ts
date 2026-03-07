export class AuthProviderBee {
    static getMeta(): {
        domain: string;
        name: string;
        version: string;
        description: string;
        category: string;
        swarmCapable: boolean;
        swarmTasks: string[];
        providerCount: number;
    };
    constructor(options?: {});
    eventBus: any;
    vectorMemory: any;
    pendingFlows: Map<any, any>;
    executeTask(taskName: any, providerId: any, context?: {}): Promise<{
        elapsed: number;
        taskName: any;
        providerId: any;
        provider: any;
        category: any;
        protocol: any;
        sshSupport: boolean;
        gpgSupport: boolean;
        vectorContext: any;
        scopes: any;
    } | {
        elapsed: number;
        taskName: any;
        providerId: any;
        method: any;
        challenge: string;
        nonce: string;
        instructions: string;
        expiresIn: string;
    } | {
        elapsed: number;
        taskName: any;
        providerId: any;
        authUrl: string;
        state: string;
        pkce: string;
        protocol: any;
    } | {
        elapsed: number;
        taskName: any;
        providerId: any;
        method: any;
        challenge: any;
        signatureReceived: boolean;
        verified: boolean;
        provider: any;
    } | {
        elapsed: number;
        taskName: any;
        providerId: any;
        provider: any;
        tokenEndpoint: any;
        exchangeBody: {
            grant_type: string;
            code: any;
            redirect_uri: string;
            client_id: string;
        };
        protocol: any;
    } | {
        elapsed: number;
        taskName: any;
        providerId: any;
        id: string;
        namespace: string;
        metadata: {
            provider: any;
            category: any;
            username: any;
            email: any;
            icon: any;
            color: any;
            authedAt: string;
        };
    } | {
        elapsed: number;
        taskName: any;
        providerId: any;
        sessionId: `${string}-${string}-${string}-${string}-${string}`;
        provider: any;
        providerName: any;
        category: any;
        icon: any;
        userId: any;
        username: any;
        tier: string;
        createdAt: string;
        expiresAt: string;
        vectorEmbedded: boolean;
    }>;
    _injectVectorContext(provider: any): Promise<{
        provider: any;
        category: any;
        protocol: any;
        sshSupport: boolean;
        gpgSupport: boolean;
        vectorContext: any;
        scopes: any;
    }>;
    _initOAuth(provider: any, { clientId, redirectUri }: {
        clientId: any;
        redirectUri: any;
    }): Promise<{
        method: any;
        challenge: string;
        nonce: string;
        instructions: string;
        expiresIn: string;
    } | {
        authUrl: string;
        state: string;
        pkce: string;
        protocol: any;
    }>;
    _initChallengeResponse(provider: any): {
        method: any;
        challenge: string;
        nonce: string;
        instructions: string;
        expiresIn: string;
    };
    _exchangeToken(provider: any, { code, state, signature }: {
        code: any;
        state: any;
        signature: any;
    }): Promise<{
        method: any;
        challenge: any;
        signatureReceived: boolean;
        verified: boolean;
        provider: any;
    } | {
        provider: any;
        tokenEndpoint: any;
        exchangeBody: {
            grant_type: string;
            code: any;
            redirect_uri: string;
            client_id: string;
        };
        protocol: any;
    }>;
    _verifyChallengeResponse(provider: any, { state, signature }: {
        state: any;
        signature: any;
    }): {
        method: any;
        challenge: any;
        signatureReceived: boolean;
        verified: boolean;
        provider: any;
    };
    _vectorizeProfile(provider: any, { userProfile }: {
        userProfile: any;
    }): Promise<{
        id: string;
        namespace: string;
        metadata: {
            provider: any;
            category: any;
            username: any;
            email: any;
            icon: any;
            color: any;
            authedAt: string;
        };
    }>;
    _createSession(provider: any, { userProfile, token }: {
        userProfile: any;
        token: any;
    }): Promise<{
        sessionId: `${string}-${string}-${string}-${string}-${string}`;
        provider: any;
        providerName: any;
        category: any;
        icon: any;
        userId: any;
        username: any;
        tier: string;
        createdAt: string;
        expiresAt: string;
        vectorEmbedded: boolean;
    }>;
    blastAll(taskName: any, context?: {}): Promise<{
        totalProviders: number;
        succeeded: number;
        failed: number;
        results: {
            provider: string;
            status: "rejected" | "fulfilled";
            value: any;
        }[];
    }>;
    _emit(event: any, data: any): void;
    getWork(): {
        domain: string;
        name: string;
        version: string;
        description: string;
        category: string;
        swarmCapable: boolean;
        swarmTasks: string[];
        providerCount: number;
    };
}
export namespace BEE_META {
    let domain: string;
    let name: string;
    let version: string;
    let description: string;
    let category: string;
    let swarmCapable: boolean;
    let swarmTasks: string[];
    let providerCount: number;
}
import { AUTH_PROVIDERS } from "../../configs/templates/auth-providers-swarm";
export { AUTH_PROVIDERS };
//# sourceMappingURL=auth-provider-bee.d.ts.map