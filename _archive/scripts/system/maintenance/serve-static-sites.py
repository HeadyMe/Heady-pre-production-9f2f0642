# © 2026 Heady Systems LLC.
# PROPRIETARY AND CONFIDENTIAL.
# Unauthorized copying, modification, or distribution is strictly prohibited.
#!/usr/bin/env python3
"""Serve multiple static site directories on different ports."""
import os
import sys
import threading
import http.server
import socketserver

SITES = [
    (9000, "/home/headyme/headybuddy/dist"),
    (9001, "/home/headyme/headysystems/dist"),
    (9002, "/home/headyme/headyconnection/dist"),
    (9003, "/home/headyme/headymcp/dist"),
    (9004, "/home/headyme/headyio/dist"),
    (9005, "/home/headyme/headyme/dist"),
]

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, directory=None, **kwargs):
        super().__init__(*args, directory=directory, **kwargs)
    def log_message(self, format, *args):
        pass  # suppress logs

def serve(port, directory):
    if not os.path.isdir(directory):
        print(f"WARN: {directory} does not exist, skipping port {port}")
        return
    handler = lambda *a, **kw: QuietHandler(*a, directory=directory, **kw)
    with socketserver.TCPServer(("0.0.0.0", port), handler) as httpd:
        print(f"Serving {directory} on port {port}")
        httpd.serve_forever()

if __name__ == "__main__":
    threads = []
    for port, directory in SITES:
        t = threading.Thread(target=serve, args=(port, directory), daemon=True)
        t.start()
        threads.append(t)
    print(f"All {len(threads)} static servers started.")
    # Block forever
    try:
        for t in threads:
            t.join()
    except KeyboardInterrupt:
        print("Shutting down.")
        sys.exit(0)
