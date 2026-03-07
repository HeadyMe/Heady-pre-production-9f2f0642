/**
 * Heady Auth Service — Cloudflare Worker
 * Cross-domain authentication for all Heady sites.
 */

export interface Env {
    JWT_SECRET: string;
    SESSION_KV: KVNamespace;
    ALLOWED_ORIGINS: string;
}

const HEADY_DOMAINS = [
    'headyme.com', 'headysystems.com', 'headyconnection.org',
    'headybuddy.org', 'headymcp.com', 'headyio.com',
    'headybot.com', 'headyapi.com', 'headyai.com',
];

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const origin = request.headers.get('Origin') || '';

        // CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders(origin) });
        }

        if (url.pathname === '/auth/verify') {
            return handleVerify(request, env);
        }

        if (url.pathname === '/auth/session') {
            return handleSession(request, env);
        }

        if (url.pathname === '/health') {
            return Response.json({ ok: true, service: 'auth', domains: HEADY_DOMAINS.length });
        }

        return Response.json({ error: 'Not found' }, { status: 404 });
    },
};

async function handleVerify(req: Request, env: Env): Promise<Response> {
    const auth = req.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

    if (!token) {
        return Response.json({ ok: false, error: 'No token' }, { status: 401 });
    }

    // Simple HMAC verification (production would use proper JWT)
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', encoder.encode(env.JWT_SECRET),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );

    try {
        const [headerB64, payloadB64, sigB64] = token.split('.');
        const data = encoder.encode(`${headerB64}.${payloadB64}`);
        const sig = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
        const valid = await crypto.subtle.verify('HMAC', key, sig, data);

        if (!valid) return Response.json({ ok: false, error: 'Invalid token' }, { status: 401 });

        const payload = JSON.parse(atob(payloadB64));
        return Response.json({ ok: true, user: payload });
    } catch {
        return Response.json({ ok: false, error: 'Token decode error' }, { status: 401 });
    }
}

async function handleSession(req: Request, env: Env): Promise<Response> {
    if (req.method === 'POST') {
        const body = await req.json() as Record<string, string>;
        const sessionId = crypto.randomUUID();
        await env.SESSION_KV.put(`session:${sessionId}`, JSON.stringify(body), { expirationTtl: 86400 });
        return Response.json({ ok: true, sessionId });
    }

    const sessionId = new URL(req.url).searchParams.get('id');
    if (!sessionId) return Response.json({ ok: false, error: 'No session ID' }, { status: 400 });

    const data = await env.SESSION_KV.get(`session:${sessionId}`);
    if (!data) return Response.json({ ok: false, error: 'Session expired' }, { status: 404 });

    return Response.json({ ok: true, session: JSON.parse(data) });
}

function corsHeaders(origin: string): HeadersInit {
    const allowed = HEADY_DOMAINS.some(d => origin.includes(d));
    return {
        'Access-Control-Allow-Origin': allowed ? origin : '',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
    };
}
