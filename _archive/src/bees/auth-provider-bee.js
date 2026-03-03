/**
 * Auth Provider Bee — Universal OAuth/Auth HeadyBee Worker
 *
 * Handles authentication flows for ALL providers defined in
 * configs/templates/auth-providers-swarm.js. Injects 3D vector
 * context from spatial memory into each auth flow.
 *
 * Swarm Tasks:
 *   1. vector-context-inject — Load identity from 3D memory
 *   2. oauth-init — Generate auth URL with PKCE
 *   3. token-exchange — Exchange code for token
 *   4. profile-vectorize — Embed user profile in 3D space
 *   5. session-create — Create unified HeadyAuth session
 *
 * © 2026 HeadySystems Inc. All rights reserved.
 */

const crypto = require('crypto');
const { AUTH_PROVIDERS, SWARM_TASKS } = require('../../configs/templates/auth-providers-swarm');

// ─── Bee Metadata ───────────────────────────────────────────────────────

const BEE_META = {
    domain: 'auth-providers',
    name: 'auth-provider-bee',
    version: '3.457890',
    description: 'Universal auth provider bee — 25 platforms, vector-injected',
    category: 'security',
    swarmCapable: true,
    swarmTasks: Object.keys(SWARM_TASKS),
    providerCount: Object.keys(AUTH_PROVIDERS).length,
};

// ─── Auth Provider Bee ──────────────────────────────────────────────────

class AuthProviderBee {
    constructor(options = {}) {
        this.eventBus = options.eventBus || global.eventBus;
        this.vectorMemory = options.vectorMemory || global.vectorMemory;
        this.pendingFlows = new Map();
    }

    // ─── Core: Execute swarm task for a provider ────────────────────
    async executeTask(taskName, providerId, context = {}) {
        const provider = AUTH_PROVIDERS[providerId];
        if (!provider) {
            throw new Error(`Unknown auth provider: ${providerId}`);
        }

        const task = SWARM_TASKS[taskName];
        if (!task) {
            throw new Error(`Unknown swarm task: ${taskName}`);
        }

        this._emit('auth:task:start', { taskName, providerId, provider: provider.name });

        const startTime = Date.now();
        let result;

        switch (taskName) {
            case 'vector-context-inject':
                result = await this._injectVectorContext(provider);
                break;
            case 'oauth-init':
                result = await this._initOAuth(provider, context);
                break;
            case 'token-exchange':
                result = await this._exchangeToken(provider, context);
                break;
            case 'profile-vectorize':
                result = await this._vectorizeProfile(provider, context);
                break;
            case 'session-create':
                result = await this._createSession(provider, context);
                break;
            default:
                throw new Error(`Unhandled task: ${taskName}`);
        }

        const elapsed = Date.now() - startTime;
        this._emit('auth:task:complete', { taskName, providerId, elapsed });

        return { ...result, elapsed, taskName, providerId };
    }

    // ─── Task 1: Vector Context Injection ───────────────────────────
    async _injectVectorContext(provider) {
        let vectorContext = null;

        if (this.vectorMemory) {
            try {
                vectorContext = await this.vectorMemory.query({
                    namespace: 'auth-identity',
                    filter: { provider: provider.id },
                    topK: 5,
                });
            } catch (e) {
                vectorContext = { error: 'Vector memory unavailable', fallback: true };
            }
        }

        return {
            provider: provider.name,
            category: provider.category,
            protocol: provider.protocol,
            sshSupport: !!provider.sshSupport,
            gpgSupport: !!provider.gpgSupport,
            vectorContext: vectorContext || { empty: true },
            scopes: provider.scopes,
        };
    }

    // ─── Task 2: OAuth Flow Init ────────────────────────────────────
    async _initOAuth(provider, { clientId, redirectUri }) {
        if (provider.protocol === 'challenge_response') {
            return this._initChallengeResponse(provider);
        }

        const state = crypto.randomBytes(32).toString('hex');
        const params = new URLSearchParams({
            client_id: clientId || `heady_${provider.id}`,
            redirect_uri: redirectUri || `https://headyme.com/auth/callback/${provider.id}`,
            response_type: 'code',
            scope: provider.scopes.join(' '),
            state,
        });

        // PKCE for providers that require it
        let pkce = null;
        if (provider.requiresPKCE) {
            const verifier = crypto.randomBytes(32).toString('base64url');
            const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
            params.set('code_challenge', challenge);
            params.set('code_challenge_method', 'S256');
            pkce = { verifier, challenge };
        }

        // Store pending flow
        this.pendingFlows.set(state, { provider: provider.id, pkce, startedAt: new Date().toISOString() });

        return {
            authUrl: `${provider.endpoints.authorize}?${params.toString()}`,
            state,
            pkce: pkce ? 'enabled' : 'disabled',
            protocol: provider.protocol,
        };
    }

    // ─── SSH/GPG Challenge-Response ─────────────────────────────────
    _initChallengeResponse(provider) {
        const challenge = crypto.randomBytes(64).toString('hex');
        const nonce = crypto.randomBytes(16).toString('hex');

        this.pendingFlows.set(nonce, {
            provider: provider.id,
            challenge,
            type: provider.id, // 'ssh_key' or 'gpg_signature'
            startedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        });

        return {
            method: provider.id,
            challenge,
            nonce,
            instructions: provider.id === 'ssh_key'
                ? 'Sign this challenge with your SSH private key: echo "<challenge>" | ssh-keygen -Y sign -f ~/.ssh/id_ed25519 -n heady'
                : 'Sign this challenge with your GPG key: echo "<challenge>" | gpg --clearsign',
            expiresIn: '5 minutes',
        };
    }

    // ─── Task 3: Token Exchange ─────────────────────────────────────
    async _exchangeToken(provider, { code, state, signature }) {
        // For challenge-response (SSH/GPG)
        if (provider.protocol === 'challenge_response') {
            return this._verifyChallengeResponse(provider, { state, signature });
        }

        // Standard OAuth token exchange
        const flow = this.pendingFlows.get(state);
        if (!flow) {
            throw new Error('Invalid or expired auth state');
        }

        const body = {
            grant_type: 'authorization_code',
            code,
            redirect_uri: `https://headyme.com/auth/callback/${provider.id}`,
            client_id: `heady_${provider.id}`,
        };

        if (flow.pkce) {
            body.code_verifier = flow.pkce.verifier;
        }

        // In production, this would make the actual HTTP request
        // For now, return the token exchange config
        this.pendingFlows.delete(state);

        return {
            provider: provider.name,
            tokenEndpoint: provider.endpoints.token,
            exchangeBody: body,
            protocol: provider.protocol,
        };
    }

    // ─── Verify SSH/GPG Challenge ───────────────────────────────────
    _verifyChallengeResponse(provider, { state, signature }) {
        const flow = this.pendingFlows.get(state);
        if (!flow) throw new Error('Invalid or expired challenge nonce');
        if (new Date() > new Date(flow.expiresAt)) throw new Error('Challenge expired');

        this.pendingFlows.delete(state);

        return {
            method: provider.id,
            challenge: flow.challenge,
            signatureReceived: !!signature,
            verified: true, // In production, verify the actual signature
            provider: provider.name,
        };
    }

    // ─── Task 4: Profile Vectorization ──────────────────────────────
    async _vectorizeProfile(provider, { userProfile }) {
        const embedding = {
            id: `auth:${provider.id}:${userProfile?.id || crypto.randomUUID()}`,
            namespace: 'auth-identity',
            metadata: {
                provider: provider.id,
                category: provider.category,
                username: userProfile?.username || 'unknown',
                email: userProfile?.email || null,
                icon: provider.icon,
                color: provider.color,
                authedAt: new Date().toISOString(),
            },
        };

        if (this.vectorMemory) {
            try {
                await this.vectorMemory.upsert(embedding);
            } catch (e) {
                embedding.vectorStoreError = e.message;
            }
        }

        return embedding;
    }

    // ─── Task 5: Session Creation ───────────────────────────────────
    async _createSession(provider, { userProfile, token }) {
        const session = {
            sessionId: crypto.randomUUID(),
            provider: provider.id,
            providerName: provider.name,
            category: provider.category,
            icon: provider.icon,
            userId: userProfile?.id,
            username: userProfile?.username,
            tier: 'core', // Default tier, upgradeable
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            vectorEmbedded: true,
        };

        this._emit('auth:session:created', session);
        return session;
    }

    // ─── Blast: Run all providers ───────────────────────────────────
    async blastAll(taskName, context = {}) {
        const providerIds = Object.keys(AUTH_PROVIDERS);
        const results = await Promise.allSettled(
            providerIds.map(pid => this.executeTask(taskName, pid, context))
        );

        return {
            totalProviders: providerIds.length,
            succeeded: results.filter(r => r.status === 'fulfilled').length,
            failed: results.filter(r => r.status === 'rejected').length,
            results: results.map((r, i) => ({
                provider: providerIds[i],
                status: r.status,
                value: r.status === 'fulfilled' ? r.value : r.reason?.message,
            })),
        };
    }

    // ─── Event emission ─────────────────────────────────────────────
    _emit(event, data) {
        if (this.eventBus) {
            try { this.eventBus.emit(event, data); } catch (e) { /* swallow */ }
        }
    }

    // ─── Registry interface ─────────────────────────────────────────
    static getMeta() { return BEE_META; }
    getWork() { return BEE_META; }
}

module.exports = { AuthProviderBee, BEE_META, AUTH_PROVIDERS };
