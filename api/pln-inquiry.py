# ====================
# FILE: api/pln-inquiry.py
# ====================

from http.server import BaseHTTPRequestHandler
import json
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

# Import your class
from api.postpaidInquiries import postpaidInquiries

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # CORS Headers
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
            
            # Read request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            customer_number = data.get('customer_number')
            
            # Validasi
            if not customer_number:
                response = {
                    'status': False,
                    'message': 'Nomor pelanggan harus diisi'
                }
                self.wfile.write(json.dumps(response).encode())
                return
            
            if len(customer_number) != 12:
                response = {
                    'status': False,
                    'message': 'Nomor pelanggan harus 12 digit'
                }
                self.wfile.write(json.dumps(response).encode())
                return
            
            # Call your class
            inquiry = postpaidInquiries(customer_number)
            result = inquiry._get_data()
            
            if result is None:
                response = {
                    'status': False,
                    'message': 'Koneksi timeout atau error network'
                }
                self.wfile.write(json.dumps(response).encode())
                return
            
            # Return result
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            response = {
                'status': False,
                'message': str(e)
            }
            self.wfile.write(json.dumps(response).encode())
    
    def do_OPTIONS(self):
        # Handle preflight CORS
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()


# ====================
# FILE: api/requirements.txt
# ====================
# requests==2.31.0


# ====================
# FILE: vercel.json (di root folder)
# ====================
# {
#   "version": 2,
#   "builds": [
#     {
#       "src": "api/pln-inquiry.py",
#       "use": "@vercel/python"
#     }
#   ],
#   "routes": [
#     {
#       "src": "/api/(.*)",
#       "dest": "/api/$1"
#     }
#   ]
# }
