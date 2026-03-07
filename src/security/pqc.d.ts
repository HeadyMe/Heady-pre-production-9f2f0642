export class HeadyPQCKeyStore {
    _keys: Map<any, any>;
    _rotationTimers: Map<any, any>;
    _auditLog: any[];
    /**
     * Generate a hybrid key pair (PQC + classical)
     * @param {string} serviceId - The Heady service identifier
     * @returns {Object} { publicKey, privateKey, algorithm, created, fingerprint }
     */
    generateHybridKeyPair(serviceId: string): Object;
    /**
     * Sign a message using hybrid PQC + classical signature
     * @param {string} serviceId - Service whose key to use
     * @param {Buffer|string} message - Message to sign
     * @returns {Object} { signature, algorithm, fingerprint, timestamp }
     */
    signMessage(serviceId: string, message: Buffer | string): Object;
    /**
     * Verify a hybrid signature
     * @param {string} serviceId - Service whose key to verify against
     * @param {Buffer|string} message - Original message
     * @param {string} signatureB64 - Base64-encoded hybrid signature
     * @param {number} timestamp - Timestamp from signature
     * @returns {Object} { valid, classicalValid, pqcValid, algorithm }
     */
    verifySignature(serviceId: string, message: Buffer | string, signatureB64: string, timestamp: number): Object;
    /**
     * Generate a quantum-resistant API key
     * @param {string} scope - Permission scope (e.g., 'brain:chat', 'gateway:race')
     * @param {Object} options - { expiresIn, rateLimit }
     * @returns {Object} { apiKey, keyId, fingerprint, scope, expires }
     */
    generateAPIKey(scope: string, options?: Object): Object;
    /**
     * Quantum-resistant encapsulation (hybrid KEM)
     * For service-to-service key exchange
     * @param {string} recipientServiceId
     * @returns {Object} { sharedSecret, ciphertext }
     */
    encapsulate(recipientServiceId: string): Object;
    /**
     * Get PQC system status
     */
    getStatus(): {
        status: string;
        version: string;
        algorithms: {
            kem: string;
            signature: string;
            hash: string;
        };
        hybridMode: boolean;
        nistCompliance: string[];
        keysManaged: number;
        auditEvents: number;
        lastRotation: any;
        keyRotationInterval: string;
    };
    _derivePQCPublicKey(seed: any): NonSharedBuffer;
    _scheduleRotation(serviceId: any): void;
    _getLastRotation(): any;
}
export const headyPQC: HeadyPQCKeyStore;
export namespace PQC_CONFIG {
    namespace kem {
        let algorithm: string;
        let fallback: string;
    }
    namespace signature {
        let algorithm_1: string;
        export { algorithm_1 as algorithm };
        let fallback_1: string;
        export { fallback_1 as fallback };
    }
    namespace hash {
        let algorithm_2: string;
        export { algorithm_2 as algorithm };
        export let hmac: string;
    }
    let hybridMode: boolean;
    let keyRotationIntervalMs: number;
}
import { Buffer } from "buffer";
export declare function generateKeyPair(serviceId: any): Object;
export declare function sign(serviceId: any, message: any): Object;
export declare function verify(serviceId: any, message: any, signature: any, timestamp: any): Object;
export declare function generateAPIKey(scope: any, opts: any): Object;
export declare function encapsulate(recipientId: any): Object;
export declare function getStatus(): {
    status: string;
    version: string;
    algorithms: {
        kem: string;
        signature: string;
        hash: string;
    };
    hybridMode: boolean;
    nistCompliance: string[];
    keysManaged: number;
    auditEvents: number;
    lastRotation: any;
    keyRotationInterval: string;
};
//# sourceMappingURL=pqc.d.ts.map