import { MCPServer, MCPRequest } from '@heady/mcp-server';

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    if (request.method === 'POST') {
      const server = new MCPServer();
      const mcpRequest: MCPRequest = await request.json();
      const response = await server.handleRequest(mcpRequest);

      return new Response(JSON.stringify(response), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (request.method === 'GET' && request.headers.get('Accept') === 'text/event-stream') {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      (async () => {
        await writer.write(encoder.encode('event: ping\ndata: {"status":"connected"}\n\n'));

        const interval = setInterval(async () => {
          await writer.write(encoder.encode('event: heartbeat\ndata: {"timestamp":' + Date.now() + '}\n\n'));
        }, 30000);

        request.signal.addEventListener('abort', () => {
          clearInterval(interval);
          writer.close();
        });
      })();

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response('Method not allowed', { status: 405 });
  }
};
