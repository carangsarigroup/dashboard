from http.server import BaseHTTPRequestHandler
import json
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

try:
    from api.postpaidInquiries import postpaidInquiries
except ImportError:
    # Fallback jika module belum ada
    postpaidInquiries = None

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
            
            # Check if postpaidInquiries module is available
            if postpaidInquiries is None:
                response = {
                    'status': False,
                    'message': 'API PLN belum dikonfigurasi. Silakan upload file postpaidInquiries.py'
                }
                self.wfile.write(json.dumps(response).encode())
                return
            
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
                'message': 'Error: ' + str(e)
            }
            self.wfile.write(json.dumps(response).encode())
    
    def do_OPTIONS(self):
        # Handle preflight CORS
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_GET(self):
        # Handle GET requests with info
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        response = {
            'status': 'OK',
            'message': 'PLN Inquiry API is running. Use POST method to check PLN bill.',
            'endpoint': '/api/pln-inquiry',
            'method': 'POST',
            'body': {
                'customer_number': '123456789012 (12 digits)'
            }
        }
        self.wfile.write(json.dumps(response).encode())
