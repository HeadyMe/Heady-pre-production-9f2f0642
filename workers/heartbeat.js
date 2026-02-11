// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: workers/heartbeat.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
// Heartbeat Worker for Monastery Model v2
// Handles token validation and revocation checks

export default {
  async fetch(request, env) {
    const { HEARTBEAT_KV } = env;
    const url = new URL(request.url);
    
    // Handle token validation
    if (request.method === 'POST' && url.pathname === '/validate') {
      try {
        const { token } = await request.json();
        
        // Check token status in KV store
        const status = await HEARTBEAT_KV.get(token);
        
        if (status === 'ACTIVE') {
          return new Response(JSON.stringify({ status: 'active' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({ 
          status: 'revoked', 
          message: 'Kill Command'
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: 'Invalid request format'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Handle token revocation
    if (request.method === 'POST' && url.pathname === '/revoke') {
      try {
        const { token } = await request.json();
        
        // Mark token as revoked in KV
        await HEARTBEAT_KV.put(token, 'REVOKED');
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: 'Invalid request format'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    return new Response('Not found', { status: 404 });
  }
}
