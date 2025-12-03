from http.server import BaseHTTPRequestHandler
import json
import sys
import os

# Add current directory to path
sys.path.append(os.path.dirname(__file__))

# Try to import the PLN inquiry class
try:
    from postpaidInquiries import postpaidInquiries
except ImportError:
    postpaidInquiries = None

class handler(BaseHTTPRequestHandler):
    
    def send_json_response(self, status_code, data):
        """Helper to send JSON responses"""
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def do_OPTIONS(self):
        """Handle preflight CORS requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_GET(self):
        """Handle GET requests - API info"""
        response = {
            'status': 'OK',
            'message': 'PLN Inquiry API is running',
            'endpoint': '/api/pln-inquiry',
            'method': 'POST',
            'body_format': {
                'customer_number': '123456789012 (12 digits)'
            },
            'module_loaded': postpaidInquiries is not None
        }
        self.send_json_response(200, response)
    
    def do_POST(self):
        """Handle POST requests - Check PLN bill"""
        try:
            # Check if module is available
            if postpaidInquiries is None:
                response = {
                    'status': False,
                    'message': 'API PLN belum dikonfigurasi. File postpaidInquiries.py tidak ditemukan.'
                }
                self.send_json_response(500, response)
                return
            
            # Read request body
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                response = {
                    'status': False,
                    'message': 'Request body kosong'
                }
                self.send_json_response(400, response)
                return
            
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            customer_number = data.get('customer_number', '').strip()
            
            # Validation
            if not customer_number:
                response = {
                    'status': False,
                    'message': 'Nomor pelanggan harus diisi'
                }
                self.send_json_response(400, response)
                return
            
            if len(customer_number) != 12:
                response = {
                    'status': False,
                    'message': f'Nomor pelanggan harus 12 digit (Anda memasukkan {len(customer_number)} digit)'
                }
                self.send_json_response(400, response)
                return
            
            if not customer_number.isdigit():
                response = {
                    'status': False,
                    'message': 'Nomor pelanggan hanya boleh berisi angka'
                }
                self.send_json_response(400, response)
                return
            
            # Call PLN API
            inquiry = postpaidInquiries(customer_number)
            result = inquiry._get_data()
            
            if result is None:
                response = {
                    'status': False,
                    'message': 'Koneksi timeout atau error saat menghubungi server PLN'
                }
                self.send_json_response(500, response)
                return
            
            # Return result
            self.send_json_response(200, result)
            
        except json.JSONDecodeError as e:
            response = {
                'status': False,
                'message': f'Invalid JSON format: {str(e)}'
            }
            self.send_json_response(400, response)
            
        except Exception as e:
            response = {
                'status': False,
                'message': f'Server error: {str(e)}'
            }
            self.send_json_response(500, response)
