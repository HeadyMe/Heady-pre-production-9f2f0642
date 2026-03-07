export class SecureKeyVault {
    credentials: Map<any, any>;
    indexLoaded: boolean;
    /**
     * Derive master encryption key from user passphrase.
     * The passphrase never leaves this process.
     */
    unlock(passphrase: any): Promise<{
        credentialCount: number;
    }>;
    lock(): void;
    isUnlocked(): boolean;
    _resetLockTimer(): void;
    _requireUnlocked(): void;
    _encrypt(plaintext: any): {
        encrypted: string;
        iv: string;
        authTag: string;
    };
    _decrypt(encryptedData: any): string;
    /**
     * Store a credential securely in vector memory.
     * @param {string} name - Human-readable name (e.g., 'github-headyme-pat')
     * @param {string} domain - One of DOMAINS keys
     * @param {string} value - The actual secret value
     * @param {object} meta - Additional metadata (label, expires, scopes, etc.)
     */
    store(name: string, domain: string, value: string, meta?: object): Promise<{
        credentialId: string;
        domain: string;
        name: string;
    }>;
    /**
     * Retrieve a decrypted credential by name and domain.
     */
    get(name: any, domain: any): Promise<any>;
    /**
     * List all credentials (without values).
     */
    list(domain?: null): Promise<any>;
    /**
     * Delete a credential from vector memory.
     */
    remove(name: any, domain: any): Promise<{
        credentialId: string;
        removed: boolean;
    }>;
    /**
     * Get a credential ready for use in API calls.
     * Returns the value formatted for the target platform.
     */
    getForAPI(name: any, domain: any): Promise<{
        headers: {
            Authorization: string;
            'x-api-key'?: undefined;
            'anthropic-version'?: undefined;
        };
        token?: undefined;
        value?: undefined;
    } | {
        headers: {
            'x-api-key': any;
            'anthropic-version': string;
            Authorization?: undefined;
        };
        token?: undefined;
        value?: undefined;
    } | {
        token: any;
        headers?: undefined;
        value?: undefined;
    } | {
        value: any;
        headers?: undefined;
        token?: undefined;
    } | null>;
    /**
     * Get all credentials for a specific domain.
     */
    getByDomain(domain: any): Promise<{}>;
    _loadIndex(): Promise<void>;
    getHealth(): {
        unlocked: boolean;
        totalCredentials: number;
        expiredCredentials: number;
        domainCoverage: {};
        ownershipBreakdown: {
            personal: number;
            system: number;
            shared: number;
        };
        domainsAvailable: string[];
        ownersAvailable: string[];
    };
}
export const vault: SecureKeyVault;
export function registerVaultRoutes(app: any): void;
export namespace DOMAINS {
    namespace github {
        let label: string;
        let zone: number;
    }
    namespace cloudflare {
        let label_1: string;
        export { label_1 as label };
        let zone_1: number;
        export { zone_1 as zone };
    }
    namespace gcloud {
        let label_2: string;
        export { label_2 as label };
        let zone_2: number;
        export { zone_2 as zone };
    }
    namespace workspace {
        let label_3: string;
        export { label_3 as label };
        let zone_3: number;
        export { zone_3 as zone };
    }
    namespace googleai {
        let label_4: string;
        export { label_4 as label };
        let zone_4: number;
        export { zone_4 as zone };
    }
    namespace huggingface {
        let label_5: string;
        export { label_5 as label };
        let zone_5: number;
        export { zone_5 as zone };
    }
    namespace openai {
        let label_6: string;
        export { label_6 as label };
        let zone_6: number;
        export { zone_6 as zone };
    }
    namespace claude {
        let label_7: string;
        export { label_7 as label };
        let zone_7: number;
        export { zone_7 as zone };
    }
    namespace groq {
        let label_8: string;
        export { label_8 as label };
        let zone_8: number;
        export { zone_8 as zone };
    }
    namespace perplexity {
        let label_9: string;
        export { label_9 as label };
        let zone_9: number;
        export { zone_9 as zone };
    }
    namespace upstash {
        let label_10: string;
        export { label_10 as label };
        let zone_10: number;
        export { zone_10 as zone };
    }
    namespace neon {
        let label_11: string;
        export { label_11 as label };
        let zone_11: number;
        export { zone_11 as zone };
    }
    namespace pinecone {
        let label_12: string;
        export { label_12 as label };
        let zone_12: number;
        export { zone_12 as zone };
    }
    namespace sentry {
        let label_13: string;
        export { label_13 as label };
        let zone_13: number;
        export { zone_13 as zone };
    }
    namespace stripe {
        let label_14: string;
        export { label_14 as label };
        let zone_14: number;
        export { zone_14 as zone };
    }
    namespace onepassword {
        let label_15: string;
        export { label_15 as label };
        let zone_15: number;
        export { zone_15 as zone };
    }
    namespace heady {
        let label_16: string;
        export { label_16 as label };
        let zone_16: number;
        export { zone_16 as zone };
    }
    namespace email {
        let label_17: string;
        export { label_17 as label };
        let zone_17: number;
        export { zone_17 as zone };
    }
    namespace ssh {
        let label_18: string;
        export { label_18 as label };
        let zone_18: number;
        export { zone_18 as zone };
    }
    namespace gpg {
        let label_19: string;
        export { label_19 as label };
        let zone_19: number;
        export { zone_19 as zone };
    }
    namespace custom {
        let label_20: string;
        export { label_20 as label };
        let zone_20: number;
        export { zone_20 as zone };
    }
}
export const OWNERS: string[];
//# sourceMappingURL=secure-key-vault.d.ts.map