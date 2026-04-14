#!/usr/bin/env python3
"""
Development HTTP Server for BaseFlowArena / RhymeNexus

Serves static files and proxies API routes that Vercel handles in production.
Proxy routes mirror vercel.json rewrites so local dev matches production behavior.

Usage:
    python server.py            # port 8000 (discord branch)
    PORT=8001 python server.py  # port 8001 (main branch)
"""

import http.server
import socketserver
import os
import urllib.request
import urllib.parse

PORT = int(os.environ.get('PORT', 8000))
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# Mirrors vercel.json rewrites — prefix -> target base URL
API_PROXIES = {
    '/datamuse/': 'https://api.datamuse.com/',
    '/dictapi/':  'https://api.dictionaryapi.dev/',
}

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        # Check if this path should be proxied to an external API
        for prefix, target_base in API_PROXIES.items():
            if self.path.startswith(prefix):
                remainder = self.path[len(prefix):]
                upstream_url = target_base + remainder
                try:
                    req = urllib.request.Request(
                        upstream_url,
                        headers={'User-Agent': 'RhymeNexus-DevServer/1.0'}
                    )
                    with urllib.request.urlopen(req, timeout=5) as resp:
                        body = resp.read()
                        self.send_response(resp.status)
                        self.send_header('Content-Type', resp.headers.get('Content-Type', 'application/json'))
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.end_headers()
                        self.wfile.write(body)
                except Exception as e:
                    self.send_error(502, f'Proxy error: {e}')
                return

        # Fall through to normal static file serving
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        # Suppress noisy static file logs, keep proxy logs
        path = args[0] if args else ''
        is_proxy = any(path.startswith(p) for p in API_PROXIES)
        if is_proxy or (args and '404' in str(args)):
            super().log_message(format, *args)

socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(('localhost', PORT), Handler)

print(f"Dev server: http://localhost:{PORT}/  (proxying /datamuse/ and /dictapi/)")
print("Press Ctrl+C to stop.")

try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\nServer stopped.")
    httpd.shutdown()
    httpd.server_close()
