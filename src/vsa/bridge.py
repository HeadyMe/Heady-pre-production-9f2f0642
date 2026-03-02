"""
src/vsa/bridge.py — VSA ↔ Node.js Bridge
HTTP bridge allowing the existing JS system to query the VSA engine.
Run as: python -m src.vsa.bridge --port 9200

The JS system can POST to /transition, /query, /store, /recall
to use the VSA engine without rewriting existing Node.js logic.
This enables gradual migration from JS conditional branching to
tensor-native VSA operations.

© 2026 Heady Systems LLC. Proprietary and Confidential.
"""
import json
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

try:
    from aiohttp import web
    HAS_AIOHTTP = True
except ImportError:
    HAS_AIOHTTP = False

from .engine import VSAStateMachine
from .memory import AssociativeMemory


class VSABridge:
    """HTTP bridge between Node.js and the VSA engine.

    Endpoints:
        POST /transition  — execute a VSA state transition
        POST /query       — nearest-neighbor concept lookup
        POST /store       — store a memory entry
        POST /recall      — semantic recall from memory
        GET  /status      — engine status
        GET  /health      — health check
    """

    def __init__(self, dims=10000):
        self.vsa = VSAStateMachine(dims=dims)
        self.memory = AssociativeMemory(dims=dims)
        print(f'VSA Bridge initialized | dims={dims} | codebook={len(self.vsa.codebook)}')

    async def handle_transition(self, request):
        """POST /transition — {agent, action, target, context?}"""
        try:
            body = await request.json()
            result = self.vsa.transition(
                body['agent'], body['action'], body['target'],
                body.get('context')
            )
            # Convert tuples for JSON
            result['nearest_concepts'] = [
                {'name': n, 'similarity': s}
                for n, s in result['nearest_concepts']
            ]
            return web.json_response({'ok': True, **result})
        except Exception as e:
            return web.json_response({'ok': False, 'error': str(e)}, status=400)

    async def handle_query(self, request):
        """POST /query — {concept, top_k?}"""
        try:
            body = await request.json()
            matches = self.vsa.query(body['concept'], top_k=body.get('top_k', 5))
            return web.json_response({
                'ok': True,
                'matches': [{'name': n, 'similarity': s} for n, s in matches],
            })
        except Exception as e:
            return web.json_response({'ok': False, 'error': str(e)}, status=400)

    async def handle_store(self, request):
        """POST /store — {text, tags?, metadata?}"""
        try:
            body = await request.json()
            idx = self.memory.store(
                body['text'],
                tags=body.get('tags'),
                metadata=body.get('metadata')
            )
            return web.json_response({'ok': True, 'index': idx})
        except Exception as e:
            return web.json_response({'ok': False, 'error': str(e)}, status=400)

    async def handle_recall(self, request):
        """POST /recall — {query, top_k?}"""
        try:
            body = await request.json()
            results = self.memory.recall(body['query'], top_k=body.get('top_k', 5))
            return web.json_response({
                'ok': True,
                'results': [
                    {'entry': e, 'similarity': s}
                    for e, s in results
                ],
            })
        except Exception as e:
            return web.json_response({'ok': False, 'error': str(e)}, status=400)

    async def handle_status(self, request):
        """GET /status"""
        return web.json_response({
            'ok': True,
            'vsa': self.vsa.get_status(),
            'memory': self.memory.get_stats(),
        })

    async def handle_health(self, request):
        """GET /health"""
        return web.json_response({
            'status': 'ok',
            'engine': 'vsa',
            'codebook_size': len(self.vsa.codebook),
        })

    def create_app(self):
        """Create the aiohttp web application."""
        if not HAS_AIOHTTP:
            raise RuntimeError("aiohttp required. pip install aiohttp")

        app = web.Application()
        app.router.add_post('/transition', self.handle_transition)
        app.router.add_post('/query', self.handle_query)
        app.router.add_post('/store', self.handle_store)
        app.router.add_post('/recall', self.handle_recall)
        app.router.add_get('/status', self.handle_status)
        app.router.add_get('/health', self.handle_health)
        return app

    def run(self, port=9200):
        """Start the bridge server."""
        app = self.create_app()
        print(f'VSA Bridge listening on http://0.0.0.0:{port}')
        print(f'  POST /transition  — state transition')
        print(f'  POST /query       — concept lookup')
        print(f'  POST /store       — memory store')
        print(f'  POST /recall      — semantic recall')
        print(f'  GET  /status      — engine status')
        print(f'  GET  /health      — health check')
        web.run_app(app, port=port, print=None)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='VSA Bridge Server')
    parser.add_argument('--port', type=int, default=9200)
    parser.add_argument('--dims', type=int, default=10000)
    args = parser.parse_args()

    bridge = VSABridge(dims=args.dims)
    bridge.run(port=args.port)
