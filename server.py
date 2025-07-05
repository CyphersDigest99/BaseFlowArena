#!/usr/bin/env python3
"""
Development HTTP Server for BaseFlowArena

This module provides a simple HTTP server for local development of the BaseFlowArena
application. It serves static files from the current directory and includes
development-friendly features like cache prevention headers.

Features:
- Serves files from the script's directory
- Prevents browser caching during development
- Configurable network access (localhost vs network)
- Graceful shutdown on Ctrl+C
- Security-focused defaults (localhost-only by default)

Usage:
    python server.py
    
    The server will start on http://localhost:8000/ and serve all files
    in the current directory, making the BaseFlowArena application accessible
    for development and testing.

Dependencies:
    - Python 3.x standard library (http.server, socketserver, os)
    - No external dependencies required

Security Notes:
    - Default configuration binds to localhost only for security
    - Change ADDRESS to "0.0.0.0" only if network access is needed
    - Intended for development use only, not production deployment
"""

import http.server
import socketserver
import os

# --- SERVER CONFIGURATION ---
PORT = 8000  # Standard development port
DIRECTORY = os.path.dirname(__file__)  # Serve from the script's directory

# --- CUSTOM HTTP REQUEST HANDLER ---
class Handler(http.server.SimpleHTTPRequestHandler):
    """
    Custom HTTP request handler that extends SimpleHTTPRequestHandler
    to add development-friendly headers and serve from a specific directory.
    """
    
    def __init__(self, *args, **kwargs):
        """Initialize handler with the specified directory."""
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        """
        Override end_headers to add cache prevention headers.
        This ensures fresh content during development by preventing
        browser caching of static files.
        """
        # Add headers to prevent caching during development
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

# --- NETWORK CONFIGURATION ---
# Ensure the server binds to localhost only for security unless specified otherwise
# Use 0.0.0.0 to allow access from other devices on the network if needed,
# but localhost is safer for typical local development.
ADDRESS = "localhost"  # Default: localhost only (secure)
# ADDRESS = "0.0.0.0"  # Uncomment to allow network access (less secure)

# --- SERVER INITIALIZATION ---
# Create the TCP server with our custom handler
httpd = socketserver.TCPServer((ADDRESS, PORT), Handler)

# --- SERVER STARTUP ---
print(f"Serving HTTP on http://{ADDRESS}:{PORT}/ from directory '{DIRECTORY}'...")
print("Press Ctrl+C to stop the server.")

# --- SERVER EXECUTION ---
try:
    # Start the server and keep it running
    httpd.serve_forever()
except KeyboardInterrupt:
    # Graceful shutdown on Ctrl+C
    print("\nServer stopped.")
    httpd.shutdown()
    httpd.server_close()