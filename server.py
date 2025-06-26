import http.server
import socketserver
import os

PORT = 8000
DIRECTORY = os.path.dirname(__file__) # Serve from the script's directory

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Add headers to prevent caching during development
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

# Ensure the server binds to localhost only for security unless specified otherwise
# Use 0.0.0.0 to allow access from other devices on the network if needed,
# but localhost is safer for typical local development.
ADDRESS = "localhost"
# ADDRESS = "0.0.0.0" # Uncomment to allow network access

# Create the server
httpd = socketserver.TCPServer((ADDRESS, PORT), Handler)

print(f"Serving HTTP on http://{ADDRESS}:{PORT}/ from directory '{DIRECTORY}'...")
print("Press Ctrl+C to stop the server.")

try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\nServer stopped.")
    httpd.shutdown()
    httpd.server_close()