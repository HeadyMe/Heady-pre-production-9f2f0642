/**
 * HeadySwarm Auth Provider Template Configuration
 *
 * Defines swarm tasks for ALL popular auth platforms.
 * Each provider bee receives 3D vector context from the spatial memory
 * before executing OAuth/auth flows — enabling phi-optimized routing
 * and context-aware session creation.
 *
 * Architecture:
 *   3D Vector Memory → Auth Swarm Orchestrator → Provider Bees → User Session
 *
 * © 2026 HeadySystems Inc. All rights reserved.
 */

const { PHI } = require('../../packages/heady-sacred-geometry-sdk');

// ─── Auth Provider Definitions ──────────────────────────────────────────

const AUTH_PROVIDERS = {
    // ─── Code Platforms ───
    github: {
        id: 'github',
        name: 'GitHub',
        category: 'code',
        protocol: 'oauth2',
        scopes: ['user', 'repo', 'read:org'],
        endpoints: {
            authorize: 'https://github.com/login/oauth/authorize',
            token: 'https://github.com/login/oauth/access_token',
            userinfo: 'https://api.github.com/user',
        },
        color: '#333333',
        icon: '🐙',
        sshSupport: true,
        gpgSupport: true,
    },
    gitlab: {
        id: 'gitlab',
        name: 'GitLab',
        category: 'code',
        protocol: 'oauth2',
        scopes: ['read_user', 'api'],
        endpoints: {
            authorize: 'https://gitlab.com/oauth/authorize',
            token: 'https://gitlab.com/oauth/token',
            userinfo: 'https://gitlab.com/api/v4/user',
        },
        color: '#FC6D26',
        icon: '🦊',
        sshSupport: true,
        gpgSupport: true,
    },
    bitbucket: {
        id: 'bitbucket',
        name: 'Bitbucket',
        category: 'code',
        protocol: 'oauth2',
        scopes: ['account', 'repository'],
        endpoints: {
            authorize: 'https://bitbucket.org/site/oauth2/authorize',
            token: 'https://bitbucket.org/site/oauth2/access_token',
            userinfo: 'https://api.bitbucket.org/2.0/user',
        },
        color: '#0052CC',
        icon: '🪣',
        sshSupport: true,
    },

    // ─── Cloud / Enterprise ───
    google: {
        id: 'google',
        name: 'Google',
        category: 'cloud',
        protocol: 'oauth2',
        scopes: ['openid', 'profile', 'email'],
        endpoints: {
            authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
            token: 'https://oauth2.googleapis.com/token',
            userinfo: 'https://www.googleapis.com/oauth2/v3/userinfo',
        },
        color: '#4285F4',
        icon: '🔵',
    },
    microsoft: {
        id: 'microsoft',
        name: 'Microsoft',
        category: 'cloud',
        protocol: 'oauth2',
        scopes: ['openid', 'profile', 'email', 'User.Read'],
        endpoints: {
            authorize: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
            token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
            userinfo: 'https://graph.microsoft.com/v1.0/me',
        },
        color: '#00A4EF',
        icon: '🪟',
    },
    amazon: {
        id: 'amazon',
        name: 'Amazon',
        category: 'cloud',
        protocol: 'oauth2',
        scopes: ['profile'],
        endpoints: {
            authorize: 'https://www.amazon.com/ap/oa',
            token: 'https://api.amazon.com/auth/o2/token',
            userinfo: 'https://api.amazon.com/user/profile',
        },
        color: '#FF9900',
        icon: '📦',
    },
    apple: {
        id: 'apple',
        name: 'Apple',
        category: 'cloud',
        protocol: 'oauth2',
        scopes: ['name', 'email'],
        endpoints: {
            authorize: 'https://appleid.apple.com/auth/authorize',
            token: 'https://appleid.apple.com/auth/token',
            userinfo: null, // ID token contains user info
        },
        color: '#000000',
        icon: '🍎',
        usesIdToken: true,
    },

    // ─── Social Media ───
    facebook: {
        id: 'facebook',
        name: 'Facebook / Meta',
        category: 'social',
        protocol: 'oauth2',
        scopes: ['public_profile', 'email'],
        endpoints: {
            authorize: 'https://www.facebook.com/v19.0/dialog/oauth',
            token: 'https://graph.facebook.com/v19.0/oauth/access_token',
            userinfo: 'https://graph.facebook.com/me?fields=id,name,email,picture',
        },
        color: '#1877F2',
        icon: '📘',
    },
    instagram: {
        id: 'instagram',
        name: 'Instagram',
        category: 'social',
        protocol: 'oauth2',
        scopes: ['instagram_business_basic'],
        endpoints: {
            authorize: 'https://www.instagram.com/oauth/authorize',
            token: 'https://api.instagram.com/oauth/access_token',
            userinfo: 'https://graph.instagram.com/me?fields=id,username,account_type',
        },
        color: '#E4405F',
        icon: '📸',
    },
    tiktok: {
        id: 'tiktok',
        name: 'TikTok',
        category: 'social',
        protocol: 'oauth2',
        scopes: ['user.info.basic'],
        endpoints: {
            authorize: 'https://www.tiktok.com/v2/auth/authorize/',
            token: 'https://open.tiktokapis.com/v2/oauth/token/',
            userinfo: 'https://open.tiktokapis.com/v2/user/info/',
        },
        color: '#000000',
        icon: '🎵',
    },
    twitter: {
        id: 'twitter',
        name: 'X (Twitter)',
        category: 'social',
        protocol: 'oauth2_pkce',
        scopes: ['tweet.read', 'users.read'],
        endpoints: {
            authorize: 'https://twitter.com/i/oauth2/authorize',
            token: 'https://api.twitter.com/2/oauth2/token',
            userinfo: 'https://api.twitter.com/2/users/me',
        },
        color: '#000000',
        icon: '𝕏',
        requiresPKCE: true,
    },
    snapchat: {
        id: 'snapchat',
        name: 'Snapchat',
        category: 'social',
        protocol: 'oauth2',
        scopes: ['https://auth.snapchat.com/oauth2/api/user.display_name'],
        endpoints: {
            authorize: 'https://accounts.snapchat.com/login/oauth2/authorize',
            token: 'https://accounts.snapchat.com/login/oauth2/access_token',
            userinfo: 'https://kit.snapchat.com/v1/me',
        },
        color: '#FFFC00',
        icon: '👻',
    },
    linkedin: {
        id: 'linkedin',
        name: 'LinkedIn',
        category: 'social',
        protocol: 'oauth2',
        scopes: ['openid', 'profile', 'email'],
        endpoints: {
            authorize: 'https://www.linkedin.com/oauth/v2/authorization',
            token: 'https://www.linkedin.com/oauth/v2/accessToken',
            userinfo: 'https://api.linkedin.com/v2/userinfo',
        },
        color: '#0A66C2',
        icon: '💼',
    },
    reddit: {
        id: 'reddit',
        name: 'Reddit',
        category: 'social',
        protocol: 'oauth2',
        scopes: ['identity'],
        endpoints: {
            authorize: 'https://www.reddit.com/api/v1/authorize',
            token: 'https://www.reddit.com/api/v1/access_token',
            userinfo: 'https://oauth.reddit.com/api/v1/me',
        },
        color: '#FF4500',
        icon: '🤖',
    },
    pinterest: {
        id: 'pinterest',
        name: 'Pinterest',
        category: 'social',
        protocol: 'oauth2',
        scopes: ['user_accounts:read'],
        endpoints: {
            authorize: 'https://www.pinterest.com/oauth/',
            token: 'https://api.pinterest.com/v5/oauth/token',
            userinfo: 'https://api.pinterest.com/v5/user_account',
        },
        color: '#E60023',
        icon: '📌',
    },

    // ─── Entertainment / Music ───
    discord: {
        id: 'discord',
        name: 'Discord',
        category: 'entertainment',
        protocol: 'oauth2',
        scopes: ['identify', 'email'],
        endpoints: {
            authorize: 'https://discord.com/oauth2/authorize',
            token: 'https://discord.com/api/oauth2/token',
            userinfo: 'https://discord.com/api/users/@me',
        },
        color: '#5865F2',
        icon: '🎮',
    },
    spotify: {
        id: 'spotify',
        name: 'Spotify',
        category: 'entertainment',
        protocol: 'oauth2',
        scopes: ['user-read-email', 'user-read-private'],
        endpoints: {
            authorize: 'https://accounts.spotify.com/authorize',
            token: 'https://accounts.spotify.com/api/token',
            userinfo: 'https://api.spotify.com/v1/me',
        },
        color: '#1DB954',
        icon: '🎧',
    },
    twitch: {
        id: 'twitch',
        name: 'Twitch',
        category: 'entertainment',
        protocol: 'oauth2',
        scopes: ['user:read:email'],
        endpoints: {
            authorize: 'https://id.twitch.tv/oauth2/authorize',
            token: 'https://id.twitch.tv/oauth2/token',
            userinfo: 'https://api.twitch.tv/helix/users',
        },
        color: '#9146FF',
        icon: '📺',
    },
    youtube: {
        id: 'youtube',
        name: 'YouTube',
        category: 'entertainment',
        protocol: 'oauth2',
        scopes: ['https://www.googleapis.com/auth/youtube.readonly'],
        endpoints: {
            authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
            token: 'https://oauth2.googleapis.com/token',
            userinfo: 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        },
        color: '#FF0000',
        icon: '▶️',
    },

    // ─── Developer / AI ───
    huggingface: {
        id: 'huggingface',
        name: 'Hugging Face',
        category: 'developer',
        protocol: 'oauth2',
        scopes: ['openid', 'profile', 'email'],
        endpoints: {
            authorize: 'https://huggingface.co/oauth/authorize',
            token: 'https://huggingface.co/oauth/token',
            userinfo: 'https://huggingface.co/oauth/userinfo',
        },
        color: '#FFD21E',
        icon: '🤗',
        sshSupport: true,
    },
    openai: {
        id: 'openai',
        name: 'OpenAI',
        category: 'developer',
        protocol: 'api_key',
        scopes: [],
        endpoints: {
            userinfo: 'https://api.openai.com/v1/me',
        },
        color: '#10A37F',
        icon: '🧠',
    },
    firebase: {
        id: 'firebase',
        name: 'Firebase',
        category: 'developer',
        protocol: 'oauth2',
        scopes: ['openid', 'profile', 'email'],
        endpoints: {
            authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
            token: 'https://oauth2.googleapis.com/token',
            userinfo: 'https://www.googleapis.com/oauth2/v3/userinfo',
        },
        color: '#FFCA28',
        icon: '🔥',
    },

    // ─── Crypto / Security ───
    ssh_key: {
        id: 'ssh_key',
        name: 'SSH Key',
        category: 'crypto',
        protocol: 'challenge_response',
        scopes: [],
        endpoints: {},
        color: '#00FF41',
        icon: '🔑',
        sshSupport: true,
    },
    gpg_signature: {
        id: 'gpg_signature',
        name: 'GPG Signature',
        category: 'crypto',
        protocol: 'challenge_response',
        scopes: [],
        endpoints: {},
        color: '#7B68EE',
        icon: '🔏',
        gpgSupport: true,
    },
    webauthn: {
        id: 'webauthn',
        name: 'WebAuthn / FIDO2',
        category: 'crypto',
        protocol: 'webauthn',
        scopes: [],
        endpoints: {},
        color: '#0066FF',
        icon: '🛡️',
    },
    ethereum: {
        id: 'ethereum',
        name: 'Ethereum (Web3)',
        category: 'crypto',
        protocol: 'siwe',
        scopes: [],
        endpoints: {},
        color: '#627EEA',
        icon: '⟠',
    },
};

// ─── Swarm Task Templates ───────────────────────────────────────────────

const SWARM_TASKS = {
    // Task 1: Inject 3D vector context into auth flow
    'vector-context-inject': {
        name: 'Vector Context Injection',
        description: 'Load user identity vectors from 3D spatial memory before auth',
        priority: 1,
        phiWeight: PHI,
        execute: async (providerId, vectorMemory) => {
            const provider = AUTH_PROVIDERS[providerId];
            if (!provider) throw new Error(`Unknown provider: ${providerId}`);

            // Query vector space for existing user context
            const contextVector = await vectorMemory.query({
                namespace: 'auth-identity',
                filter: { provider: providerId },
                topK: 5,
                phiDecay: true,
            });

            return {
                provider: provider.name,
                category: provider.category,
                vectorContext: contextVector,
                phiWeight: PHI,
                injectedAt: new Date().toISOString(),
            };
        },
    },

    // Task 2: Initialize OAuth flow for the provider
    'oauth-init': {
        name: 'OAuth Flow Initialization',
        description: 'Generate auth URL with provider-specific scopes and PKCE',
        priority: 2,
        phiWeight: PHI ** 2,
        execute: async (providerId, config) => {
            const provider = AUTH_PROVIDERS[providerId];
            if (!provider) throw new Error(`Unknown provider: ${providerId}`);

            const state = require('crypto').randomBytes(32).toString('hex');
            const params = {
                client_id: config.clientId,
                redirect_uri: config.redirectUri,
                response_type: 'code',
                scope: provider.scopes.join(' '),
                state,
            };

            // PKCE support (Twitter/X, etc.)
            if (provider.requiresPKCE) {
                const verifier = require('crypto').randomBytes(32).toString('base64url');
                const challenge = require('crypto')
                    .createHash('sha256')
                    .update(verifier)
                    .digest('base64url');
                params.code_challenge = challenge;
                params.code_challenge_method = 'S256';
            }

            return {
                provider: provider.name,
                authUrl: provider.endpoints.authorize,
                params,
                protocol: provider.protocol,
                state,
            };
        },
    },

    // Task 3: Exchange auth code for token
    'token-exchange': {
        name: 'Token Exchange',
        description: 'Exchange authorization code for access token',
        priority: 3,
        phiWeight: PHI ** 3,
    },

    // Task 4: Fetch user profile and embed in 3D vector space
    'profile-vectorize': {
        name: 'Profile Vectorization',
        description: 'Fetch user profile from provider and embed in 3D vector memory',
        priority: 4,
        phiWeight: PHI ** 4,
        execute: async (userProfile, vectorMemory) => {
            const embedding = {
                id: `auth:${userProfile.provider}:${userProfile.id}`,
                namespace: 'auth-identity',
                metadata: {
                    provider: userProfile.provider,
                    username: userProfile.username,
                    email: userProfile.email,
                    category: AUTH_PROVIDERS[userProfile.provider]?.category,
                    authedAt: new Date().toISOString(),
                },
            };

            await vectorMemory.upsert(embedding);
            return embedding;
        },
    },

    // Task 5: Create unified Heady session
    'session-create': {
        name: 'Session Creation',
        description: 'Create unified HeadyAuth session from provider identity',
        priority: 5,
        phiWeight: PHI ** 5,
    },
};

// ─── Swarm Template ─────────────────────────────────────────────────────

const AUTH_SWARM_TEMPLATE = {
    name: 'auth-providers',
    version: '3.457890',
    description: 'Universal auth provider swarm — all platforms, vector-injected',
    parallelism: 'phi-optimized',
    phiBase: PHI,

    providers: AUTH_PROVIDERS,
    providerCount: Object.keys(AUTH_PROVIDERS).length,

    categories: {
        code: Object.values(AUTH_PROVIDERS).filter(p => p.category === 'code').map(p => p.id),
        cloud: Object.values(AUTH_PROVIDERS).filter(p => p.category === 'cloud').map(p => p.id),
        social: Object.values(AUTH_PROVIDERS).filter(p => p.category === 'social').map(p => p.id),
        entertainment: Object.values(AUTH_PROVIDERS).filter(p => p.category === 'entertainment').map(p => p.id),
        developer: Object.values(AUTH_PROVIDERS).filter(p => p.category === 'developer').map(p => p.id),
        crypto: Object.values(AUTH_PROVIDERS).filter(p => p.category === 'crypto').map(p => p.id),
    },

    swarmTasks: SWARM_TASKS,

    // Blast all providers — returns swarm execution plan
    createBlastPlan: () => {
        const providers = Object.keys(AUTH_PROVIDERS);
        const taskNames = Object.keys(SWARM_TASKS);

        return {
            totalBees: providers.length,
            tasksPerBee: taskNames.length,
            totalTasks: providers.length * taskNames.length,
            parallelism: `φ-optimized (${PHI.toFixed(6)})`,
            plan: providers.map((pid, i) => ({
                beeId: `auth-${pid}`,
                provider: AUTH_PROVIDERS[pid].name,
                icon: AUTH_PROVIDERS[pid].icon,
                category: AUTH_PROVIDERS[pid].category,
                tasks: taskNames,
                phiPriority: Math.round(PHI ** (i % 6) * 100) / 100,
            })),
        };
    },
};

module.exports = {
    AUTH_PROVIDERS,
    AUTH_SWARM_TEMPLATE,
    SWARM_TASKS,
};
