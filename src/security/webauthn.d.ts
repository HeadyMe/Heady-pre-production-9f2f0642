export class WebAuthnService {
    constructor(opts?: {});
    _rpName: any;
    _rpId: any;
    _origin: any;
    _challenges: Map<any, any>;
    _credentials: Map<any, any>;
    _signedPayloads: any[];
    _stats: {
        challengesIssued: number;
        verificationsAttempted: number;
        verified: number;
        rejected: number;
    };
    _challengeTTL: any;
    _cleanupTimer: NodeJS.Timeout;
    /**
     * Generate a registration challenge (for enrolling a biometric credential).
     */
    generateRegistrationChallenge(userId: any, userName: any): {
        sessionId: string;
        options: {
            challenge: string;
            rp: {
                name: any;
                id: any;
            };
            user: {
                id: string;
                name: any;
                displayName: any;
            };
            pubKeyCredParams: {
                alg: number;
                type: string;
            }[];
            authenticatorSelection: {
                authenticatorAttachment: string;
                userVerification: string;
                residentKey: string;
            };
            timeout: any;
            attestation: string;
        };
    };
    /**
     * Generate an authentication challenge (for signing a payload).
     */
    generateAuthenticationChallenge(userId: any, payload: any): {
        sessionId: string;
        options: {
            challenge: string;
            rpId: any;
            allowCredentials: any;
            userVerification: string;
            timeout: any;
        };
        payloadHash: string;
    };
    /**
     * Verify a registration response.
     */
    verifyRegistration(sessionId: any, credential: any): {
        verified: boolean;
        error: string;
        userId?: undefined;
    } | {
        verified: boolean;
        userId: any;
        error?: undefined;
    };
    /**
     * Verify an authentication response and sign the payload.
     */
    verifyAuthentication(sessionId: any, assertion: any): {
        verified: boolean;
        error: string;
        signedPayload?: undefined;
    } | {
        verified: boolean;
        signedPayload: {
            payload: any;
            payloadHash: any;
            signature: {
                credentialId: any;
                userId: any;
                timestamp: string;
                nonce: string;
                verified: boolean;
            };
        };
        error?: undefined;
    };
    /**
     * Check if a payload requires biometric signing.
     */
    requiresSignature(payload: any): boolean;
    _cleanupExpired(): void;
    getStats(): {
        activeChallenges: number;
        registeredCredentials: number;
        signedPayloadsAuditSize: number;
        challengesIssued: number;
        verificationsAttempted: number;
        verified: number;
        rejected: number;
    };
    /**
     * Register HTTP routes.
     */
    registerRoutes(app: any): void;
    destroy(): void;
}
//# sourceMappingURL=webauthn.d.ts.map