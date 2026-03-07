export class HeadyAuth extends EventEmitter<[never]> {
    constructor(opts?: {});
    dataDir: any;
    sessionsPath: string;
    auditPath: string;
    adminKey: any;
    googleClientId: any;
    googleClientSecret: any;
    googleRedirectUri: any;
    baseUrl: any;
    deepIntel: any;
    sessions: any;
    wireDeepIntel(engine: any): void;
    generateToken(payload?: {}): {
        tokenId: string;
        token: string;
        userId: any;
        method: any;
        tier: any;
        email: any;
        deviceId: any;
        warp: any;
        googleId: any;
        createdAt: string;
        expiresAt: string;
        expiresMs: any;
        lastActive: string;
        userAgent: any;
        ip: any;
    };
    loginManual(username: any, password: any, meta?: {}): {
        tokenId: string;
        token: string;
        userId: any;
        method: any;
        tier: any;
        email: any;
        deviceId: any;
        warp: any;
        googleId: any;
        createdAt: string;
        expiresAt: string;
        expiresMs: any;
        lastActive: string;
        userAgent: any;
        ip: any;
    } | null;
    loginDevice(deviceId: any, meta?: {}): any;
    loginWarp(deviceId: any, meta?: {}): any;
    getGoogleAuthUrl(state?: string): string;
    handleGoogleCallback(code: any, meta?: {}): Promise<{
        tokenId: string;
        token: string;
        userId: any;
        method: any;
        tier: any;
        email: any;
        deviceId: any;
        warp: any;
        googleId: any;
        createdAt: string;
        expiresAt: string;
        expiresMs: any;
        lastActive: string;
        userAgent: any;
        ip: any;
    }>;
    loginSSHChallenge(): {
        nonce: string;
        challenge: string;
        method: string;
        instructions: string;
        command: string;
        expiresIn: string;
    };
    loginSSHVerify(nonce: any, signature: any, publicKey: any, meta?: {}): {
        tokenId: string;
        token: string;
        userId: any;
        method: any;
        tier: any;
        email: any;
        deviceId: any;
        warp: any;
        googleId: any;
        createdAt: string;
        expiresAt: string;
        expiresMs: any;
        lastActive: string;
        userAgent: any;
        ip: any;
    } | null;
    loginGPGChallenge(): {
        nonce: string;
        challenge: string;
        method: string;
        instructions: string;
        command: string;
        expiresIn: string;
    };
    loginGPGVerify(nonce: any, signedPayload: any, keyId: any, meta?: {}): {
        tokenId: string;
        token: string;
        userId: any;
        method: any;
        tier: any;
        email: any;
        deviceId: any;
        warp: any;
        googleId: any;
        createdAt: string;
        expiresAt: string;
        expiresMs: any;
        lastActive: string;
        userAgent: any;
        ip: any;
    } | null;
    verify(token: any): {
        valid: boolean;
        tier: string;
        userId: string;
        method: string;
        features: string[];
        tokenId?: undefined;
        email?: undefined;
        warp?: undefined;
        deviceId?: undefined;
        expiresAt?: undefined;
    } | {
        valid: boolean;
        tokenId: any;
        userId: any;
        tier: any;
        method: any;
        email: any;
        warp: any;
        deviceId: any;
        expiresAt: any;
        features: any;
    } | null;
    refresh(token: any): {
        tokenId: string;
        token: string;
        userId: any;
        method: any;
        tier: any;
        email: any;
        deviceId: any;
        warp: any;
        googleId: any;
        createdAt: string;
        expiresAt: string;
        expiresMs: any;
        lastActive: string;
        userAgent: any;
        ip: any;
    } | null;
    vectorPrereqScan(session: any): Promise<{
        scanned: boolean;
        vectorCount: any;
        chainValid: boolean;
        lastScanTs: string;
        userId: any;
    } | {
        scanned: boolean;
        reason: string;
    }>;
    getSessions(adminToken: any): {
        tokenId: any;
        userId: any;
        tier: any;
        method: any;
        email: any;
        warp: any;
        createdAt: any;
        expiresAt: any;
        lastActive: any;
    }[] | null;
    revokeSession(adminToken: any, tokenId: any): boolean;
    middleware(requireTier?: null): (req: any, res: any, next: any) => Promise<any>;
    getStatus(): {
        status: string;
        totalSessions: number;
        byMethod: {};
        byTier: {};
        googleOAuthConfigured: boolean;
        sshAuthEnabled: boolean;
        gpgAuthEnabled: boolean;
        vectorPrereqEnabled: boolean;
        pendingChallenges: number;
        tokenLengths: {
            warp: string;
            device: string;
            standard: string;
            google: string;
            ssh: string;
            gpg: string;
        };
        tiers: string[];
        authMethods: string[];
    };
    _loadSessions(): any;
    _saveSessions(): void;
    _cleanupExpired(): void;
    _audit(action: any, details?: {}): void;
    _httpPost(hostname: any, path: any, data: any): Promise<any>;
    _httpGet(hostname: any, path: any, bearerToken: any): Promise<any>;
}
export function registerAuthRoutes(app: any, authEngine: any): any;
export namespace TIERS {
    namespace admin {
        let label: string;
        let features: string[];
        let rateLimit: number;
    }
    namespace premium {
        let label_1: string;
        export { label_1 as label };
        let features_1: string[];
        export { features_1 as features };
        let rateLimit_1: number;
        export { rateLimit_1 as rateLimit };
    }
    namespace core {
        let label_2: string;
        export { label_2 as label };
        let features_2: string[];
        export { features_2 as features };
        let rateLimit_2: number;
        export { rateLimit_2 as rateLimit };
    }
    namespace guest {
        let label_3: string;
        export { label_3 as label };
        let features_3: string[];
        export { features_3 as features };
        let rateLimit_3: number;
        export { rateLimit_3 as rateLimit };
    }
}
export namespace TOKEN_LENGTHS {
    let warp: number;
    let device: number;
    let standard: number;
    let google: number;
    let ssh: number;
    let gpg: number;
}
import EventEmitter = require("events");
//# sourceMappingURL=hc_auth.d.ts.map