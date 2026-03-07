export class ConnectorVault {
    /**
     * @param {{ encryptionKey?: string, maxConnectorsPerUser?: number }} opts
     */
    constructor(opts?: {
        encryptionKey?: string;
        maxConnectorsPerUser?: number;
    });
    key: Buffer<ArrayBuffer>;
    maxPerUser: number;
    connectors: Map<any, any>;
    metrics: {
        stored: number;
        revoked: number;
        refreshed: number;
        decryptFailures: number;
    };
    _encrypt(plaintext: any): string;
    _decrypt(packed: any): string;
    /**
     * Store or update a connector for a user.
     * @param {string} userId
     * @param {{ providerId: string, accessToken: string, refreshToken?: string, expiresAt?: number, grantedServices: string[], scopes: string[], providerUid?: string, email?: string }} data
     */
    storeConnector(userId: string, data: {
        providerId: string;
        accessToken: string;
        refreshToken?: string;
        expiresAt?: number;
        grantedServices: string[];
        scopes: string[];
        providerUid?: string;
        email?: string;
    }): {
        ok: boolean;
        userId: string;
        providerId: string;
        grantedServices: string[];
        connectedAt: string;
    };
    /**
     * Retrieve the decrypted access token for a connector.
     * Updates lastUsedAt.
     * @param {string} userId
     * @param {string} providerId
     * @returns {{ accessToken: string, refreshToken?: string, expiresAt?: number, grantedServices: string[] }}
     */
    getToken(userId: string, providerId: string): {
        accessToken: string;
        refreshToken?: string;
        expiresAt?: number;
        grantedServices: string[];
    };
    /**
     * Update the access token after a refresh.
     * @param {string} userId
     * @param {string} providerId
     * @param {{ accessToken: string, expiresAt?: number }} data
     */
    refreshToken(userId: string, providerId: string, data: {
        accessToken: string;
        expiresAt?: number;
    }): {
        ok: boolean;
        providerId: string;
        expiresAt: any;
    };
    /**
     * Revoke and remove a connector for a user.
     * @param {string} userId
     * @param {string} providerId
     */
    revokeConnector(userId: string, providerId: string): {
        ok: boolean;
        userId: string;
        providerId: string;
        revoked: boolean;
    };
    /**
     * Add or remove granted services for a connector.
     * @param {string} userId
     * @param {string} providerId
     * @param {{ add?: string[], remove?: string[] }} changes
     */
    updateServices(userId: string, providerId: string, changes?: {
        add?: string[];
        remove?: string[];
    }): {
        ok: boolean;
        providerId: string;
        grantedServices: any;
    };
    /**
     * List all connectors for a user (without decrypted tokens).
     * @param {string} userId
     * @returns {Array<{ providerId, grantedServices, status, connectedAt, lastUsedAt, hasRefreshToken, expiresAt }>}
     */
    listConnectors(userId: string): Array<{
        providerId: any;
        grantedServices: any;
        status: any;
        connectedAt: any;
        lastUsedAt: any;
        hasRefreshToken: any;
        expiresAt: any;
    }>;
    getHealth(): {
        status: string;
        users: number;
        totalConnectors: number;
        activeConnectors: number;
        expiredConnectors: number;
        metrics: {
            stored: number;
            revoked: number;
            refreshed: number;
            decryptFailures: number;
        };
        ts: string;
    };
    _getRecord(userId: any, providerId: any): any;
}
//# sourceMappingURL=connector-vault.d.ts.map