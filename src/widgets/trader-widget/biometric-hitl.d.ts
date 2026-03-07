export default BiometricHITL;
declare class BiometricHITL {
    constructor(apiEndpoint?: string);
    apiEndpoint: string;
    isSupported: boolean;
    /**
     * Initializes a robust swipe-to-execute check using an Assertion Challenge
     * returned by the central Heady Manager.
     */
    requireSwipeValidation(tradeContext: any): Promise<boolean>;
    _base64UrlToBuffer(base64url: any): Uint8Array<any>;
    _bufferToBase64Url(buffer: any): any;
}
//# sourceMappingURL=biometric-hitl.d.ts.map