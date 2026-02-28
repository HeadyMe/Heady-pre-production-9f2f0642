/**
 * ════════════════════════════════════════════════════════════════════
 * 🛡️ BIOMETRIC HITL (HUMAN-IN-THE-LOOP) GATES
 * Swipe-to-execute confirmation relying on device-native WebAuthn
 * (FaceID, TouchID, YubiKey) to authorize high-risk transactions.
 * ════════════════════════════════════════════════════════════════════
 */

class BiometricHITL {
    constructor(apiEndpoint = '/api/auth/webauthn') {
        this.apiEndpoint = apiEndpoint;
        this.isSupported = !!(navigator.credentials && navigator.credentials.create);
    }

    /**
     * Initializes a robust swipe-to-execute check using an Assertion Challenge
     * returned by the central Heady Manager.
     */
    async requireSwipeValidation(tradeContext) {
        if (!this.isSupported) {
            throw new Error('Biometric HITL requires a WebAuthn compatible device.');
        }

        console.log(`[BIOMETRIC] Requesting challenge for transaction: ${tradeContext.id}`);

        try {
            // 1. Fetch challenge from Manager
            const challengeRes = await fetch(`${this.apiEndpoint}/challenge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tradeContext)
            });
            const options = await challengeRes.json();

            // 2. Format challenge buffers
            options.publicKey.challenge = this._base64UrlToBuffer(options.publicKey.challenge);
            options.publicKey.allowCredentials.forEach(cred => {
                cred.id = this._base64UrlToBuffer(cred.id);
            });

            // 3. Prompt user geometry (Touch/Face)
            const credential = await navigator.credentials.get({
                publicKey: options.publicKey
            });

            // 4. Verify assertion back onto Heady Manager
            const verificationPayload = {
                id: credential.id,
                rawId: this._bufferToBase64Url(credential.rawId),
                type: credential.type,
                response: {
                    authenticatorData: this._bufferToBase64Url(credential.response.authenticatorData),
                    clientDataJSON: this._bufferToBase64Url(credential.response.clientDataJSON),
                    signature: this._bufferToBase64Url(credential.response.signature),
                    userHandle: credential.response.userHandle ? this._bufferToBase64Url(credential.response.userHandle) : null
                }
            };

            const finalizeRes = await fetch(`${this.apiEndpoint}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(verificationPayload)
            });

            if (!finalizeRes.ok) {
                throw new Error('Biometric validation failed cryptographic check.');
            }

            console.log(`[BIOMETRIC] HitL validation approved for trade ${tradeContext.id}.`);
            return true;

        } catch (err) {
            console.error(`[BIOMETRIC] Flow aborted: ${err.message}`);
            return false;
        }
    }

    _base64UrlToBuffer(base64url) {
        const padding = '='.repeat((4 - base64url.length % 4) % 4);
        const base64 = (base64url + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    _bufferToBase64Url(buffer) {
        const bytes = new Uint8Array(buffer);
        let str = '';
        for (let charCode of bytes) {
            str += String.fromCharCode(charCode);
        }
        return window.btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }
}

export default BiometricHITL;
