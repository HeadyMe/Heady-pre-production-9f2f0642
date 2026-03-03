/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * OAuth Provider Registry — Data-driven, dynamic connector generation.
 * Add a provider here and it auto-wires routes + frontend buttons.
 *
 * Two provider types:
 *   "oauth"  — Standard OAuth 2.0 redirect flow (popup window)
 *   "apikey" — API key validation (inline prompt)
 */

module.exports = {
    // ─── OAuth Providers ──────────────────────────────────────────
    google: {
        type: 'oauth',
        name: 'Google',
        icon: '<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>',
        color: '#fff',
        bg: '#4285F4',
        envKey: 'GOOGLE_CLIENT_ID',
        envSecret: 'GOOGLE_CLIENT_SECRET',
        authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        profileUrl: null, // uses id_token
        scope: 'openid email profile',
        extraParams: { access_type: 'offline' },
        tokenPrefix: 'hdy_g_',
        extractUser: (tokens, _profile) => {
            const payload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString());
            return { email: payload.email, name: payload.name, photo: payload.picture };
        },
    },

    github: {
        type: 'oauth',
        name: 'GitHub',
        icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>',
        color: '#fff',
        bg: '#24292e',
        envKey: 'GITHUB_CLIENT_ID',
        envSecret: 'GITHUB_CLIENT_SECRET',
        authorizeUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        profileUrl: 'https://api.github.com/user',
        scope: 'read:user user:email',
        tokenPrefix: 'hdy_gh_',
        profileHeaders: (token) => ({ 'Authorization': `Bearer ${token}`, 'User-Agent': 'HeadyMe/1.0', 'Accept': 'application/json' }),
        extractUser: async (_tokens, profile, accessToken) => {
            let email = profile.email;
            if (!email) {
                const emailRes = await fetch('https://api.github.com/user/emails', {
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'User-Agent': 'HeadyMe/1.0', 'Accept': 'application/json' },
                });
                const emails = await emailRes.json();
                const primary = Array.isArray(emails) ? (emails.find(e => e.primary) || emails[0]) : null;
                email = primary ? primary.email : `${profile.login}@github.noreply`;
            }
            return { email, name: profile.name || profile.login, photo: profile.avatar_url };
        },
    },

    microsoft: {
        type: 'oauth',
        name: 'Microsoft',
        icon: '<svg width="18" height="18" viewBox="0 0 23 23"><path fill="#f35325" d="M1 1h10v10H1z"/><path fill="#81bc06" d="M12 1h10v10H12z"/><path fill="#05a6f0" d="M1 12h10v10H1z"/><path fill="#ffba08" d="M12 12h10v10H12z"/></svg>',
        color: '#fff',
        bg: '#2f2f2f',
        envKey: 'MICROSOFT_CLIENT_ID',
        envSecret: 'MICROSOFT_CLIENT_SECRET',
        authorizeUrl: () => `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0/authorize`,
        tokenUrl: () => `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0/token`,
        profileUrl: 'https://graph.microsoft.com/v1.0/me',
        scope: 'openid email profile User.Read',
        extraParams: { response_mode: 'query' },
        tokenPrefix: 'hdy_ms_',
        extractUser: (_tokens, profile) => ({
            email: profile.mail || profile.userPrincipalName,
            name: profile.displayName,
            photo: null,
        }),
    },

    facebook: {
        type: 'oauth',
        name: 'Facebook',
        icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
        color: '#fff',
        bg: '#1877F2',
        envKey: 'FACEBOOK_APP_ID',
        envSecret: 'FACEBOOK_APP_SECRET',
        authorizeUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
        tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
        profileUrl: 'https://graph.facebook.com/v19.0/me?fields=id,name,email,picture.type(large)',
        scope: 'email,public_profile',
        tokenPrefix: 'hdy_fb_',
        extractUser: (_tokens, profile) => ({
            email: profile.email || `${profile.id}@facebook.noreply`,
            name: profile.name,
            photo: profile.picture?.data?.url || null,
        }),
    },

    amazon: {
        type: 'oauth',
        name: 'Amazon',
        icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#FF9900"><path d="M13.958 10.09c0 1.232.029 2.256-.591 3.351-.502.891-1.301 1.44-2.186 1.44-1.214 0-1.922-.924-1.922-2.292 0-2.692 2.415-3.182 4.7-3.182v.683zm3.186 7.705a.66.66 0 01-.753.077c-1.06-.878-1.25-1.284-1.828-2.119-1.748 1.783-2.986 2.317-5.249 2.317-2.681 0-4.764-1.655-4.764-4.967 0-2.585 1.401-4.345 3.394-5.205 1.728-.758 4.142-.892 5.986-1.102v-.41c0-.756.059-1.65-.385-2.302-.386-.58-1.124-.82-1.775-.82-1.205 0-2.277.618-2.54 1.897-.054.285-.261.566-.547.58l-3.063-.33c-.258-.057-.543-.266-.471-.66C6.03 1.564 9.132 0 11.93 0c1.39 0 3.208.372 4.303 1.43 1.39 1.296 1.258 3.025 1.258 4.908v4.445c0 1.338.555 1.924 1.077 2.644.183.258.224.567-.008.757-.578.486-1.607 1.387-2.172 1.892z"/></svg>',
        color: '#111',
        bg: '#FF9900',
        envKey: 'AMAZON_CLIENT_ID',
        envSecret: 'AMAZON_CLIENT_SECRET',
        authorizeUrl: 'https://www.amazon.com/ap/oa',
        tokenUrl: 'https://api.amazon.com/auth/o2/token',
        profileUrl: 'https://api.amazon.com/user/profile',
        scope: 'profile',
        tokenPrefix: 'hdy_az_',
        extractUser: (_tokens, profile) => ({
            email: profile.email,
            name: profile.name,
            photo: null,
        }),
    },

    apple: {
        type: 'oauth',
        name: 'Apple',
        icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>',
        color: '#fff',
        bg: '#000',
        envKey: 'APPLE_CLIENT_ID',
        envSecret: 'APPLE_CLIENT_SECRET',
        authorizeUrl: 'https://appleid.apple.com/auth/authorize',
        tokenUrl: 'https://appleid.apple.com/auth/token',
        profileUrl: null,
        scope: 'name email',
        extraParams: { response_mode: 'form_post' },
        tokenPrefix: 'hdy_ap_',
        extractUser: (tokens) => {
            const payload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString());
            return { email: payload.email, name: payload.email?.split('@')[0] || 'Apple User', photo: null };
        },
    },

    discord: {
        type: 'oauth',
        name: 'Discord',
        icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M20.317 4.369a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.369a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.056 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.009c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.028z"/></svg>',
        color: '#fff',
        bg: '#5865F2',
        envKey: 'DISCORD_CLIENT_ID',
        envSecret: 'DISCORD_CLIENT_SECRET',
        authorizeUrl: 'https://discord.com/api/oauth2/authorize',
        tokenUrl: 'https://discord.com/api/oauth2/token',
        profileUrl: 'https://discord.com/api/users/@me',
        scope: 'identify email',
        tokenPrefix: 'hdy_dc_',
        tokenContentType: 'application/x-www-form-urlencoded',
        extractUser: (_tokens, profile) => ({
            email: profile.email || `${profile.username}@discord.noreply`,
            name: profile.global_name || profile.username,
            photo: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : null,
        }),
    },

    slack: {
        type: 'oauth',
        name: 'Slack',
        icon: '<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313z"/><path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312z"/><path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.163 0a2.528 2.528 0 012.523 2.522v6.312z"/><path fill="#ECB22E" d="M15.163 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.163 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.315A2.528 2.528 0 0124 15.163a2.528 2.528 0 01-2.522 2.523h-6.315z"/></svg>',
        color: '#fff',
        bg: '#4A154B',
        envKey: 'SLACK_CLIENT_ID',
        envSecret: 'SLACK_CLIENT_SECRET',
        authorizeUrl: 'https://slack.com/openid/connect/authorize',
        tokenUrl: 'https://slack.com/api/openid.connect.token',
        profileUrl: 'https://slack.com/api/openid.connect.userInfo',
        scope: 'openid email profile',
        tokenPrefix: 'hdy_sl_',
        tokenContentType: 'application/x-www-form-urlencoded',
        extractUser: (_tokens, profile) => ({
            email: profile.email,
            name: profile.name,
            photo: profile.picture || null,
        }),
    },

    linkedin: {
        type: 'oauth',
        name: 'LinkedIn',
        icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
        color: '#fff',
        bg: '#0077B5',
        envKey: 'LINKEDIN_CLIENT_ID',
        envSecret: 'LINKEDIN_CLIENT_SECRET',
        authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
        tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
        profileUrl: 'https://api.linkedin.com/v2/userinfo',
        scope: 'openid profile email',
        tokenPrefix: 'hdy_li_',
        tokenContentType: 'application/x-www-form-urlencoded',
        extractUser: (_tokens, profile) => ({
            email: profile.email,
            name: profile.name,
            photo: profile.picture || null,
        }),
    },

    twitter: {
        type: 'oauth',
        name: 'X (Twitter)',
        icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
        color: '#fff',
        bg: '#000',
        envKey: 'TWITTER_CLIENT_ID',
        envSecret: 'TWITTER_CLIENT_SECRET',
        authorizeUrl: 'https://twitter.com/i/oauth2/authorize',
        tokenUrl: 'https://api.twitter.com/2/oauth2/token',
        profileUrl: 'https://api.twitter.com/2/users/me?user.fields=profile_image_url',
        scope: 'users.read tweet.read',
        extraParams: { code_challenge: 'challenge', code_challenge_method: 'plain' },
        tokenPrefix: 'hdy_tw_',
        tokenContentType: 'application/x-www-form-urlencoded',
        tokenAuth: 'basic', // uses Basic auth for token exchange
        extractUser: (_tokens, profile) => ({
            email: null,
            name: profile.data?.name || profile.data?.username,
            photo: profile.data?.profile_image_url || null,
        }),
    },

    spotify: {
        type: 'oauth',
        name: 'Spotify',
        icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>',
        color: '#fff',
        bg: '#191414',
        envKey: 'SPOTIFY_CLIENT_ID',
        envSecret: 'SPOTIFY_CLIENT_SECRET',
        authorizeUrl: 'https://accounts.spotify.com/authorize',
        tokenUrl: 'https://accounts.spotify.com/api/token',
        profileUrl: 'https://api.spotify.com/v1/me',
        scope: 'user-read-email user-read-private',
        tokenPrefix: 'hdy_sp_',
        tokenContentType: 'application/x-www-form-urlencoded',
        tokenAuth: 'basic',
        extractUser: (_tokens, profile) => ({
            email: profile.email,
            name: profile.display_name,
            photo: profile.images?.[0]?.url || null,
        }),
    },

    // ─── API Key Providers ────────────────────────────────────────
    openai: {
        type: 'apikey',
        name: 'OpenAI',
        icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#10a37f"><path d="M22.282 9.821a5.985 5.985 0 00-.516-4.91 6.046 6.046 0 00-6.51-2.9A6.065 6.065 0 0011.6 0 6.018 6.018 0 005.29 4.179a6.015 6.015 0 00-4.025 2.913 6.042 6.042 0 00.74 7.087 5.986 5.986 0 00.516 4.91 6.046 6.046 0 006.51 2.9A5.999 5.999 0 0012.4 24a6.018 6.018 0 006.31-4.179 6.015 6.015 0 004.024-2.913 6.042 6.042 0 00-.74-7.087z"/></svg>',
        color: '#fff',
        bg: '#10a37f',
        validateUrl: 'https://api.openai.com/v1/models',
        validateMethod: 'GET',
        validateHeaders: (key) => ({ 'Authorization': `Bearer ${key}` }),
        tokenPrefix: 'hdy_oai_',
        keyPlaceholder: 'sk-...',
    },

    claude: {
        type: 'apikey',
        name: 'Claude',
        icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#d4a574"><circle cx="12" cy="12" r="10"/></svg>',
        color: '#fff',
        bg: '#d4a574',
        validateUrl: 'https://api.anthropic.com/v1/messages',
        validateMethod: 'POST',
        validateHeaders: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }),
        validateBody: { model: 'claude-3-haiku-20240307', max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] },
        tokenPrefix: 'hdy_cl_',
        keyPlaceholder: 'sk-ant-...',
    },

    perplexity: {
        type: 'apikey',
        name: 'Perplexity',
        icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#20808d"><circle cx="12" cy="12" r="10"/></svg>',
        color: '#fff',
        bg: '#20808d',
        validateUrl: 'https://api.perplexity.ai/chat/completions',
        validateMethod: 'POST',
        validateHeaders: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
        validateBody: { model: 'llama-3.1-sonar-small-128k-online', messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 },
        tokenPrefix: 'hdy_pp_',
        keyPlaceholder: 'pplx-...',
    },

    gemini: {
        type: 'apikey',
        name: 'Gemini',
        icon: '<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M12 0L2 6v12l10 6 10-6V6z"/></svg>',
        color: '#fff',
        bg: '#4285F4',
        validateUrl: (key) => `https://generativelanguage.googleapis.com/v1/models?key=${key}`,
        validateMethod: 'GET',
        validateHeaders: () => ({}),
        tokenPrefix: 'hdy_gm_',
        keyPlaceholder: 'AIza...',
    },

    huggingface: {
        type: 'apikey',
        name: 'Hugging Face',
        icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#FFD21E"><circle cx="12" cy="12" r="10"/></svg>',
        color: '#000',
        bg: '#FFD21E',
        validateUrl: 'https://huggingface.co/api/whoami-v2',
        validateMethod: 'GET',
        validateHeaders: (key) => ({ 'Authorization': `Bearer ${key}` }),
        tokenPrefix: 'hdy_hf_',
        keyPlaceholder: 'hf_...',
    },

    replicate: {
        type: 'apikey',
        name: 'Replicate',
        icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><rect x="2" y="2" width="20" height="20" rx="4"/></svg>',
        color: '#fff',
        bg: '#1a1a2e',
        validateUrl: 'https://api.replicate.com/v1/models',
        validateMethod: 'GET',
        validateHeaders: (key) => ({ 'Authorization': `Bearer ${key}` }),
        tokenPrefix: 'hdy_rp_',
        keyPlaceholder: 'r8_...',
    },

    mistral: {
        type: 'apikey',
        name: 'Mistral',
        icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#F7931E"><rect x="2" y="2" width="20" height="20" rx="3"/></svg>',
        color: '#fff',
        bg: '#F7931E',
        validateUrl: 'https://api.mistral.ai/v1/models',
        validateMethod: 'GET',
        validateHeaders: (key) => ({ 'Authorization': `Bearer ${key}` }),
        tokenPrefix: 'hdy_mi_',
        keyPlaceholder: 'Key...',
    },

    cohere: {
        type: 'apikey',
        name: 'Cohere',
        icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#39594D"><circle cx="12" cy="12" r="10"/></svg>',
        color: '#fff',
        bg: '#39594D',
        validateUrl: 'https://api.cohere.ai/v1/models',
        validateMethod: 'GET',
        validateHeaders: (key) => ({ 'Authorization': `Bearer ${key}` }),
        tokenPrefix: 'hdy_co_',
        keyPlaceholder: 'Key...',
    },

    groq: {
        type: 'apikey',
        name: 'Groq',
        icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#F55036"><circle cx="12" cy="12" r="10"/></svg>',
        color: '#fff',
        bg: '#F55036',
        validateUrl: 'https://api.groq.com/openai/v1/models',
        validateMethod: 'GET',
        validateHeaders: (key) => ({ 'Authorization': `Bearer ${key}` }),
        tokenPrefix: 'hdy_gq_',
        keyPlaceholder: 'gsk_...',
    },
};
