"""
🐝 Heady GPU Embedding Server
Runs on Colab GPU — serves embeddings via HTTP for the Node.js Heady system.
Uses sentence-transformers with CUDA acceleration.

Start: python3 gpu_embedding_server.py
"""

import torch
import numpy as np
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import threading
import time

# ── GPU Detection ──
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
PORT = 9384  # 384-dim embeddings, port = 9+384

print(f"🧠 Device: {DEVICE}")
if DEVICE == "cuda":
    gpu = torch.cuda.get_device_properties(0)
    print(f"🧠 GPU: {gpu.name} ({gpu.total_mem / 1024**3:.1f} GB)")

# ── Load Model to GPU ──
print(f"🧠 Loading {MODEL_NAME}...")
from sentence_transformers import SentenceTransformer
model = SentenceTransformer(MODEL_NAME, device=DEVICE)
print(f"🧠 Model loaded on {DEVICE} ✓")

# Stats
stats = {"requests": 0, "total_texts": 0, "avg_latency_ms": 0, "gpu_mem_mb": 0}

class EmbeddingHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/embed":
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length))
            texts = body.get("texts", [])
            if isinstance(texts, str):
                texts = [texts]

            start = time.time()

            # Compute embeddings on GPU
            with torch.no_grad():
                embeddings = model.encode(
                    texts,
                    batch_size=64,
                    show_progress_bar=False,
                    convert_to_numpy=True,
                    normalize_embeddings=True,
                )

            latency_ms = (time.time() - start) * 1000

            # Update stats
            stats["requests"] += 1
            stats["total_texts"] += len(texts)
            stats["avg_latency_ms"] = round(
                (stats["avg_latency_ms"] * 0.8) + (latency_ms * 0.2), 2
            )
            if DEVICE == "cuda":
                stats["gpu_mem_mb"] = round(
                    torch.cuda.memory_allocated() / 1024**2, 2
                )

            response = {
                "ok": True,
                "embeddings": embeddings.tolist(),
                "dimensions": embeddings.shape[1],
                "count": len(texts),
                "latency_ms": round(latency_ms, 2),
                "device": DEVICE,
            }

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())
            return

        if self.path == "/embed/batch":
            # High-throughput batch endpoint for vector memory ingestion
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length))
            texts = body.get("texts", [])

            start = time.time()
            with torch.no_grad():
                embeddings = model.encode(
                    texts,
                    batch_size=128,  # Larger batch for throughput
                    show_progress_bar=False,
                    convert_to_numpy=True,
                    normalize_embeddings=True,
                )
            latency_ms = (time.time() - start) * 1000

            response = {
                "ok": True,
                "embeddings": embeddings.tolist(),
                "count": len(texts),
                "latency_ms": round(latency_ms, 2),
                "throughput": round(len(texts) / (latency_ms / 1000), 1) if latency_ms > 0 else 0,
            }

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())
            return

        self.send_response(404)
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            health = {
                "ok": True,
                "model": MODEL_NAME,
                "device": DEVICE,
                "dimensions": 384,
                **stats,
            }
            if DEVICE == "cuda":
                health["gpu_name"] = torch.cuda.get_device_name(0)
                health["gpu_total_mem_mb"] = round(
                    torch.cuda.get_device_properties(0).total_mem / 1024**2, 2
                )
                health["gpu_used_mem_mb"] = round(
                    torch.cuda.memory_allocated() / 1024**2, 2
                )

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(health).encode())
            return

        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        pass  # Suppress default logging


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), EmbeddingHandler)
    print(f"🧠 GPU Embedding Server listening on port {PORT}")
    print(f"   POST /embed        — single/multi text embedding")
    print(f"   POST /embed/batch  — high-throughput batch embedding")
    print(f"   GET  /health       — server + GPU status")
    server.serve_forever()
