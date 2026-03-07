export class AuthManager {
    /**
     * @param {object} opts
     * @param {string}  [opts.jwtSecret]
     * @param {object}  [opts.kv]         - HeadyKV instance
     * @param {number}  [opts.sessionTtlMs]
     */
    constructor(opts?: {
        jwtSecret?: string | undefined;
        kv?: object | undefined;
        sessionTtlMs?: number | undefined;
    });
    _jwt: any;
    _kv: any;
    sessionTtlMs: number;
    /**
     * Create a signed JWT access token and persist a session.
     * @param {object} user  - { id, email, role, ... }
     * @returns {{ accessToken, refreshToken, expiresIn, sessionId }}
     */
    createToken(user: object): {
        accessToken: any;
        refreshToken: any;
        expiresIn: any;
        sessionId: any;
    };
    /**
     * Verify an access token.
     * @param {string} token
     * @returns {{ valid, payload, error }}
     */
    verifyToken(token: string): {
        valid: any;
        payload: any;
        error: any;
    };
    /**
     * Refresh an access token using a refresh token.
     * @param {string} refreshToken
     * @returns {{ accessToken, refreshToken, expiresIn, sessionId }}
     */
    refreshToken(refreshToken: string): {
        accessToken: any;
        refreshToken: any;
        expiresIn: any;
        sessionId: any;
    };
    /**
     * Revoke a session immediately.
     * @param {string} sessionId
     */
    revokeSession(sessionId: string): Promise<boolean>;
    /**
     * Generate a new API key for a user.
     * @param {string} userId
     * @param {object} opts  - { role, description, ttlMs }
     * @returns {{ apiKey, keyId }}
     */
    createApiKey(userId: string, opts?: object): {
        apiKey: any;
        keyId: any;
    };
    /**
     * Validate an API key.
     * @param {string} apiKey
     * @returns {{ valid, record }}
     */
    validateApiKey(apiKey: string): {
        valid: any;
        record: any;
    };
    /**
     * Revoke an API key.
     * @param {string} keyId
     */
    revokeApiKey(keyId: string): Promise<boolean>;
    /**
     * Check if a role meets a required minimum role.
     * @param {string} userRole
     * @param {string} requiredRole
     * @returns {boolean}
     */
    hasRole(userRole: string, requiredRole: string): boolean;
    /**
     * Express-compatible middleware factory.
     * @param {string} requiredRole
     */
    requireRole(requiredRole: string): (req: any, res: any, next: any) => Promise<any>;
    /**
     * Begin OAuth2 authorization code flow.
     * @param {object} opts - { provider, redirectUri, scope, state }
     * @returns {{ authUrl, state }}
     */
    beginOAuth2Flow(opts?: object): {
        authUrl: any;
        state: any;
    };
    /**
     * Exchange OAuth2 authorization code for tokens.
     * @param {object} opts - { code, state, redirectUri }
     * @returns {{ accessToken, refreshToken, expiresIn, sessionId }}
     */
    handleOAuth2Callback(opts?: object): {
        accessToken: any;
        refreshToken: any;
        expiresIn: any;
        sessionId: any;
    };
    /**
     * Get session details.
     * @param {string} sessionId
     */
    getSession(sessionId: string): Promise<any>;
}
export const ROLES: Readonly<{
    ADMIN: "admin";
    OPERATOR: "operator";
    USER: "user";
    GUEST: "guest";
}>;
export namespace ROLE_HIERARCHY {
    let admin: number;
    let operator: number;
    let user: number;
    let guest: number;
}
//# sourceMappingURL=auth-manager.d.ts.map