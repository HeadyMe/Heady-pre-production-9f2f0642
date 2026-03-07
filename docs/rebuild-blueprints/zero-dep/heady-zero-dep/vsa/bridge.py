"""
NodeJSBridge - Bridge between Python VSA engine and Node.js Heady services.
Enables the Python 3D vector space to communicate with the Node.js orchestration layer.
"""
import json
import subprocess
import threading
import sys
import os
import http.server
import socketserver
from typing import Dict, Any, Optional, Callable
from .engine import VectorSpaceEngine, Vector384, PHI


class NodeJSBridge:
    """
    Bidirectional bridge between Python VSA and Node.js Heady services.
    
    Operates via:
    1. HTTP API: Python hosts an HTTP server that Node.js can call
    2. Subprocess: Python can invoke Node.js scripts for operations
    3. Shared filesystem: Both sides read/write JSON exchange files
    """
    
    def __init__(self, engine: VectorSpaceEngine, port: int = 9200,
                 node_url: Optional[str] = None):
        self.engine = engine
        self.port = port
        self.node_url = node_url or 'http://localhost:3001'
        self._server = None
        self._thread = None
        self._handlers: Dict[str, Callable] = {}
        
        # Register default handlers
        self._register_defaults()
    
    def _register_defaults(self):
        """Register default RPC handlers."""
        self._handlers['embed'] = self._handle_embed
        self._handlers['search'] = self._handle_search
        self._handlers['register'] = self._handle_register
        self._handlers['coherence'] = self._handle_coherence
        self._handlers['spatial_map'] = self._handle_spatial_map
        self._handlers['drift_check'] = self._handle_drift_check
        self._handlers['stats'] = self._handle_stats
        self._handlers['traverse'] = self._handle_traverse
        self._handlers['octant_partition'] = self._handle_octant_partition
        self._handlers['phi_layout'] = self._handle_phi_layout
    
    def register_handler(self, method: str, handler: Callable):
        """Register a custom RPC handler."""
        self._handlers[method] = handler
    
    def _handle_embed(self, params: dict) -> dict:
        text = params.get('text', '')
        vec = Vector384.from_text(text)
        return {'vector_3d': vec.projection_3d, 'dim': len(vec.data)}
    
    def _handle_search(self, params: dict) -> dict:
        text = params.get('text', '')
        k = params.get('k', 10)
        query = Vector384.from_text(text)
        results = self.engine.nearest_neighbors(query, k)
        return {'results': [{'id': eid, 'similarity': sim} for eid, sim in results]}
    
    def _handle_register(self, params: dict) -> dict:
        entity_id = params['id']
        text = params.get('text', entity_id)
        meta = params.get('meta', {})
        self.engine.register_from_text(entity_id, text, meta)
        vec = self.engine.get(entity_id)
        return {'id': entity_id, '3d': vec.projection_3d if vec else None}
    
    def _handle_coherence(self, params: dict) -> dict:
        score = self.engine.compute_coherence()
        return {'coherence': score, 'threshold': 0.75, 'healthy': score >= 0.75}
    
    def _handle_spatial_map(self, params: dict) -> dict:
        return {'map': self.engine.get_spatial_map()}
    
    def _handle_drift_check(self, params: dict) -> dict:
        entity_id = params['id']
        new_text = params.get('text', entity_id)
        new_vec = Vector384.from_text(new_text)
        drifted, similarity = self.engine.detect_drift(entity_id, new_vec)
        return {'drifted': drifted, 'similarity': similarity, 'threshold': 0.75}
    
    def _handle_stats(self, params: dict) -> dict:
        return self.engine.stats()
    
    def _handle_traverse(self, params: dict) -> dict:
        start = params['start']
        hops = params.get('max_hops', 3)
        min_w = params.get('min_weight', 0.5)
        result = self.engine.traverse(start, hops, min_w)
        return {'graph': {k: v for k, v in result.items()}}
    
    def _handle_octant_partition(self, params: dict) -> dict:
        partitions = self.engine.octant_partition()
        return {'octants': {str(k): v for k, v in partitions.items()}}
    
    def _handle_phi_layout(self, params: dict) -> dict:
        n = params.get('count', 10)
        points = self.engine.phi_spiral_layout(n)
        return {'points': [{'x': x, 'y': y, 'z': z} for x, y, z in points]}
    
    def start(self):
        """Start the HTTP bridge server."""
        bridge = self
        
        class BridgeHandler(http.server.BaseHTTPRequestHandler):
            def do_POST(self):
                content_len = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_len)
                
                try:
                    request = json.loads(body)
                    method = request.get('method', '')
                    params = request.get('params', {})
                    req_id = request.get('id', None)
                    
                    handler = bridge._handlers.get(method)
                    if handler:
                        result = handler(params)
                        response = {
                            'jsonrpc': '2.0',
                            'result': result,
                            'id': req_id
                        }
                    else:
                        response = {
                            'jsonrpc': '2.0',
                            'error': {'code': -32601, 'message': f'Method not found: {method}'},
                            'id': req_id
                        }
                except Exception as e:
                    response = {
                        'jsonrpc': '2.0',
                        'error': {'code': -32603, 'message': str(e)},
                        'id': None
                    }
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(response).encode())
            
            def do_GET(self):
                if self.path == '/health':
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'status': 'ok',
                        'service': 'heady-vsa-bridge',
                        'entities': len(bridge.engine.vectors),
                        'port': bridge.port
                    }).encode())
                else:
                    self.send_response(404)
                    self.end_headers()
            
            def log_message(self, format, *args):
                pass  # Suppress default logging
        
        self._server = socketserver.TCPServer(('0.0.0.0', self.port), BridgeHandler)
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()
        print(f"[VSA Bridge] Listening on port {self.port}")
    
    def stop(self):
        if self._server:
            self._server.shutdown()
    
    def call_node(self, method: str, params: dict) -> dict:
        """Call a method on the Node.js side via HTTP."""
        import urllib.request
        payload = json.dumps({
            'jsonrpc': '2.0',
            'method': method,
            'params': params,
            'id': 1
        }).encode()
        
        req = urllib.request.Request(
            f"{self.node_url}/rpc",
            data=payload,
            headers={'Content-Type': 'application/json'}
        )
        
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode())
        except Exception as e:
            return {'error': str(e)}
    
    def sync_to_node(self):
        """Push the current vector space state to the Node.js side."""
        spatial_map = self.engine.get_spatial_map()
        return self.call_node('vsa_sync', {'spatial_map': spatial_map})
    
    def sync_from_node(self):
        """Pull state from the Node.js side into the Python engine."""
        result = self.call_node('vsa_export', {})
        if 'result' in result and 'entities' in result['result']:
            for entity in result['result']['entities']:
                if 'id' in entity and 'embedding' in entity:
                    vec = Vector384(entity['embedding'])
                    self.engine.register(entity['id'], vec, entity.get('meta', {}))
