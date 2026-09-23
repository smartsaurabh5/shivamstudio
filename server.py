import os
import sys
import json
import sqlite3
import hashlib
import uuid
import base64
import re
from datetime import datetime, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database.db")
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public", "uploads")
PUBLIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")

# Create directories if they do not exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PUBLIC_DIR, exist_ok=True)

# Helper function to get database connection
def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

# Helper function to hash password
def hash_password(password, salt=None):
    if not salt:
        salt = uuid.uuid4().hex
    hashed = hashlib.sha256((password + salt).encode('utf-8')).hexdigest()
    return f"{salt}${hashed}"

# Helper function to verify password
def verify_password(stored_password, provided_password):
    try:
        salt, hashed = stored_password.split('$')
        rehashed = hashlib.sha256((provided_password + salt).encode('utf-8')).hexdigest()
        return hashed == rehashed
    except Exception:
        return False

# Database Initialization
def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'customer',
        phone TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )""")
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )""")
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        service_name TEXT NOT NULL,
        event_date TEXT NOT NULL,
        event_time TEXT NOT NULL,
        package_name TEXT NOT NULL,
        client_name TEXT NOT NULL,
        client_email TEXT NOT NULL,
        client_phone TEXT NOT NULL,
        special_requirements TEXT,
        reference_image TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        price REAL NOT NULL DEFAULT 0.0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )""")
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS enquiries (
        id TEXT PRIMARY KEY,
        client_name TEXT NOT NULL,
        client_email TEXT NOT NULL,
        client_phone TEXT NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'unread',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )""")
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS portfolio (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        media_type TEXT NOT NULL, -- 'image' or 'video'
        url TEXT NOT NULL,
        thumbnail TEXT,
        is_featured INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )""")
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS offers (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        discount_percent INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )""")
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS testimonials (
        id TEXT PRIMARY KEY,
        client_name TEXT NOT NULL,
        rating INTEGER NOT NULL,
        comment TEXT NOT NULL,
        service TEXT NOT NULL,
        avatar TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )""")
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )""")

    conn.commit()

    # Seed Default Data if table users is empty
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        print("Seeding database with default parameters...")
        # Add admin
        admin_id = str(uuid.uuid4())
        admin_pass = hash_password("admin@123")
        cursor.execute("INSERT INTO users (id, name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?, ?)",
                       (admin_id, "Akhilesh Kumar Pal", "admin@shivamstudio.com", admin_pass, "admin", "+917307245252"))
        
        # Add default client
        client_id = str(uuid.uuid4())
        client_pass = hash_password("client123")
        cursor.execute("INSERT INTO users (id, name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?, ?)",
                       (client_id, "Rahul Sharma", "client@gmail.com", client_pass, "customer", "+919876543211"))

        # Add default Settings
        cursor.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ("studio_name", "Shivam Studio and Photostate"))
        cursor.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ("contact_email", "admin@shivamstudio.com"))
        cursor.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ("contact_phone", "7307245252"))
        cursor.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ("whatsapp", "917307245252"))
        cursor.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ("address", "Near TD COLLEGE SOUTH, beside CYBER CRIME THANA POLICE LINE, Wazidpur, Jaunpur, Uttar Pradesh 222001"))
        cursor.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ("name", "Akhilesh Kumar Pal"))
        cursor.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ("owner_name", "Akhilesh Kumar Pal"))
        default_marquee_images = [
            "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1519225495810-7517c24a2ed7?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1532712938310-34cb3982ef74?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1507504038482-762143725f82?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=600&q=80"
        ]
        cursor.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ("hero_marquee_images", json.dumps(default_marquee_images)))
        cursor.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ("business_hours", json.dumps({
            "Monday - Friday": "10:00 AM - 08:00 PM",
            "Saturday - Sunday": "09:00 AM - 09:00 PM"
        })))
        cursor.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ("faqs", json.dumps([
            {"question": "How long in advance should we book your services?", "answer": "For weddings and major events, we recommend booking 3 to 6 months in advance. For portrait shoots, 2-3 weeks notice is usually sufficient."},
            {"question": "Do you travel for shoots outside the city?", "answer": "Yes, we cover destination weddings and commercial shoots worldwide. Travel and accommodation costs are borne by the client."},
            {"question": "When can we expect the final photos and videos?", "answer": "High-quality edited digital photos are typically delivered within 3-4 weeks. Cinematic wedding films take about 6-8 weeks for post-production."},
            {"question": "Can we customize the photography packages?", "answer": "Absolutely! We offer customized quotes based on your specific requirements, duration, and deliverables."}
        ])))
        
        default_packages = {
            "Wedding Photography": [
                { "name": "Silver", "price": 80000, "features": ["1 Photographer", "1 Day coverage", "100 Edited digital photos", "Online delivery"] },
                { "name": "Gold", "price": 150000, "features": ["2 Photographers", "2 Days coverage", "250 Edited digital photos", "Bespoke Printed Album (40 pages)", "Drone photography included"] },
                { "name": "Platinum", "price": 250000, "features": ["Lead Photographer + 2 assistants", "Full wedding coverage (up to 4 days)", "Unlimited photos edited", "Premium leather album & gift cases", "Drone + candid sessions"] }
            ],
            "Wedding Videography": [
                { "name": "Silver", "price": 90000, "features": ["1 Videographer", "1 Day coverage", "30-min Edited video summary", "Full HD quality"] },
                { "name": "Gold", "price": 160000, "features": ["2 Videographers", "2 Days coverage", "5-min Cinematic Trailer", "60-min Edited film", "Drone videography included"] },
                { "name": "Platinum", "price": 280000, "features": ["3 Videographers (incl. candid specialist)", "Up to 4 days coverage", "10-min Cinematic Film Trailer", "2-hour Wedding Movie", "4K HDR & drone coverage"] }
            ],
            "Pre-Wedding Shoot": [
                { "name": "Silver", "price": 30000, "features": ["4-hour session", "1 Location", "30 Edited photos", "1 Outfit change"] },
                { "name": "Gold", "price": 55000, "features": ["Full-day session (8 hours)", "2 Locations", "60 Edited photos", "2-min Cinematic teaser video", "3 Outfit changes"] },
                { "name": "Platinum", "price": 90000, "features": ["2 Days shoot", "Multiple locations", "100 Edited photos", "5-min Cinematic pre-wedding video", "Unlimited outfits", "Drone visual captures"] }
            ],
            "Maternity Shoot": [
                { "name": "Silver", "price": 15000, "features": ["2-hour session", "Studio backdrop", "15 Edited photos"] },
                { "name": "Gold", "price": 25000, "features": ["3-hour session", "Studio + Outdoor garden", "35 Edited photos", "Props provided"] },
                { "name": "Platinum", "price": 40000, "features": ["Full-day shoot", "Luxury milk-bath or custom setups", "60 Edited photos", "Gowns and makeup artist included"] }
            ],
            "Baby Shoot": [
                { "name": "Silver", "price": 12000, "features": ["2-hour session", "2 Prop themes", "15 Edited photos"] },
                { "name": "Gold", "price": 20000, "features": ["3-hour session", "4 Prop themes", "30 Edited photos", "Family portrait session included"] },
                { "name": "Platinum", "price": 35000, "features": ["Home/Studio setup", "Unlimited props", "50 Edited photos", "1-min mini video film"] }
            ],
            "Birthday Events": [
                { "name": "Silver", "price": 15000, "features": ["3-hour coverage", "1 candid photographer", "100 digital files"] },
                { "name": "Gold", "price": 28000, "features": ["5-hour coverage", "1 Photographer + 1 Videographer", "Full event video edit", "200 Edited photos"] },
                { "name": "Platinum", "price": 45000, "features": ["Full event coverage", "2 Photographers + 1 Videographer", "Cinematic birthday movie", "Photobooth setup included"] }
            ],
            "Corporate Events": [
                { "name": "Silver", "price": 35000, "features": ["4-hour coverage", "1 Photographer", "High-res business headshots included"] },
                { "name": "Gold", "price": 65000, "features": ["Full-day coverage", "2 Photographers", "Highlight event summary video"] },
                { "name": "Platinum", "price": 110000, "features": ["Multi-day coverage", "3 Crew members", "Promotional marketing video wrap", "Full panel interviews documented"] }
            ],
            "Product Photography": [
                { "name": "Silver", "price": 20000, "features": ["15 Studio product catalog shots", "White background", "High-end retouching"] },
                { "name": "Gold", "price": 45000, "features": ["40 Creative lifestyle product shots", "Prop styling & custom lighting", "Commercial use license"] },
                { "name": "Platinum", "price": 80000, "features": ["100 Product catalog + lifestyle shots", "Infographic overlays", "15-second product commercial video"] }
            ],
            "Drone Shoots": [
                { "name": "Silver", "price": 25000, "features": ["2 hours aerial coverage", "Raw footage delivery", "4K Resolution"] },
                { "name": "Gold", "price": 40000, "features": ["Half-day coverage (4 hours)", "Edited 3-min highlight visual compilation"] },
                { "name": "Platinum", "price": 70000, "features": ["Full-day visual flight mapping", "Raw files + Edited promotional movie", "8K capabilities"] }
            ],
            "Cinematic Video Production": [
                { "name": "Silver", "price": 50000, "features": ["1 Videographer", "Half-day shoot", "1-min promotional advertisement film"] },
                { "name": "Gold", "price": 95000, "features": ["Full-day shoot", "Director + camera operator", "3-min Corporate profile/commercial film"] },
                { "name": "Platinum", "price": 180000, "features": ["2 Days cinema camera package", "Storyboard direction, actors casting support", "Custom color grading & licensed audio"] }
            ],
            "Video Editing & Mixing": [
                { "name": "Silver", "price": 15000, "features": ["Editing up to 30 mins footage", "Titles and standard transitions"] },
                { "name": "Gold", "price": 30000, "features": ["Editing up to 2 hours raw footage", "Custom audio mixing & standard color grading"] },
                { "name": "Platinum", "price": 60000, "features": ["Full feature cinema documentary edit", "VFX, advanced color grading, multirig sync"] }
            ],
            "Album Designing": [
                { "name": "Silver", "price": 10000, "features": ["Standard design layout", "30 Pages", "Hardcover print"] },
                { "name": "Gold", "price": 18000, "features": ["Bespoke design theme", "50 Pages", "Premium leather wrap cover"] },
                { "name": "Platinum", "price": 30000, "features": ["Custom box case", "80 pages luxury metallic print paper", "Digital interactive replica copy"] }
            ],
            "Live Streaming Services": [
                { "name": "Silver", "price": 25000, "features": ["Single camera setup", "YouTube/FB private link stream", "Raw capture file"] },
                { "name": "Gold", "price": 45000, "features": ["Dual camera switcher setup", "Overlay designs, logos & titles", "High fidelity audio stream"] },
                { "name": "Platinum", "price": 80000, "features": ["3-camera rig layout", "Local cellular bonded backup router", "Simulcast to multiple platforms", "Live chat support display"] }
            ]
        }
        cursor.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ("booking_packages", json.dumps(default_packages)))
        
        # Add default Testimonials
        cursor.execute("INSERT INTO testimonials (id, client_name, rating, comment, service, avatar) VALUES (?, ?, ?, ?, ?, ?)",
                       (str(uuid.uuid4()), "Priya & Amit", 5, "Shivam Studio and Photostate made our wedding look like a fairy tale. The cinematic trailer was incredibly shot, and the team was extremely professional!", "Wedding Shoot", ""))
        cursor.execute("INSERT INTO testimonials (id, client_name, rating, comment, service, avatar) VALUES (?, ?, ?, ?, ?, ?)",
                       (str(uuid.uuid4()), "Vikram Rathore", 5, "Extremely impressed by their product photography. They captured our brand aesthetics perfectly. Our sales have increased since using their visuals.", "Product Photography", ""))
        cursor.execute("INSERT INTO testimonials (id, client_name, rating, comment, service, avatar) VALUES (?, ?, ?, ?, ?, ?)",
                       (str(uuid.uuid4()), "Sarah D'Souza", 5, "The drone footage for our resort event was spectacular. Highly recommend their professional team for corporate events.", "Drone Shoot & Event Coverage", ""))

        # Add default Offers
        cursor.execute("INSERT INTO offers (id, title, description, code, discount_percent, start_date, expiry_date, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                       (str(uuid.uuid4()), "Monsoon Wedding Special", "Get a flat 20% discount on Premium Wedding Shoot packages", "WEDMON20", 20, "2026-07-01", "2026-08-31", 1))
        cursor.execute("INSERT INTO offers (id, title, description, code, discount_percent, start_date, expiry_date, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                       (str(uuid.uuid4()), "Early Bird Pre-Wedding", "Book your pre-wedding shoot 3 months in advance and get 15% off", "PREWED15", 15, "2026-07-01", "2026-12-31", 1))

        # Add default Portfolio items
        portfolio_items = [
            ("Wedding Bells", "wedding", "image", "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80", "", 1),
            ("Pre-Wedding Sunset Glow", "pre-wedding", "image", "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80", "", 1),
            ("Gourmet Burger Commercial", "product", "image", "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80", "", 0),
            ("Corporate Gala Event", "event", "image", "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80", "", 0),
            ("Coastal Highway Drone", "drone", "image", "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80", "", 1),
            ("Baby Portrait", "baby", "image", "https://images.unsplash.com/photo-1519689680058-324335c77ebe?auto=format&fit=crop&w=800&q=80", "", 0),
            ("Luxury Perfume Bottle", "product", "image", "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=800&q=80", "", 1),
            ("Maternity Magic", "maternity", "image", "https://images.unsplash.com/photo-1551244072-5d12893278ab?auto=format&fit=crop&w=800&q=80", "", 0),
            
            # Simulated local dummy video paths or stock video links
            ("Cinematic Wedding Film Trailer", "wedding", "video", "https://assets.mixkit.co/videos/preview/mixkit-bride-and-groom-kissing-under-the-veil-44365-large.mp4", "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=400&q=80", 1),
            ("Pre-Wedding Romantic Teaser", "pre-wedding", "video", "https://assets.mixkit.co/videos/preview/mixkit-young-couple-walking-in-a-forest-43223-large.mp4", "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80", 1),
            ("Aerial Beach Resort Drone Shoot", "drone", "video", "https://assets.mixkit.co/videos/preview/mixkit-top-aerial-view-of-a-sandy-beach-with-sea-waves-44161-large.mp4", "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80", 1)
        ]
        
        for title, cat, mtype, url, thumb, feat in portfolio_items:
            cursor.execute("INSERT INTO portfolio (id, title, category, media_type, url, thumbnail, is_featured) VALUES (?, ?, ?, ?, ?, ?, ?)",
                           (str(uuid.uuid4()), title, cat, mtype, url, thumb, feat))

        # Done seeding
        conn.commit()

    # Always ensure admin user and Shivam Studio settings exist
    admin_pass = hash_password("admin@123")
    cursor.execute("SELECT id FROM users WHERE email = ?", ("admin@shivamstudio.com",))
    existing_admin = cursor.fetchone()
    if existing_admin:
        cursor.execute("UPDATE users SET password_hash = ?, role = 'admin', name = 'Akhilesh Kumar Pal', phone = '7307245252' WHERE email = ?",
                       (admin_pass, "admin@shivamstudio.com"))
    else:
        cursor.execute("INSERT INTO users (id, name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?, ?)",
                       (str(uuid.uuid4()), "Akhilesh Kumar Pal", "admin@shivamstudio.com", admin_pass, "admin", "7307245252"))

    studio_settings = {
        "studio_name": "Shivam Studio and Photostate",
        "contact_email": "admin@shivamstudio.com",
        "contact_phone": "7307245252",
        "phone": "7307245252",
        "whatsapp": "917307245252",
        "address": "Near TD COLLEGE SOUTH, beside CYBER CRIME THANA POLICE LINE, Wazidpur, Jaunpur, Uttar Pradesh 222001",
        "name": "Akhilesh Kumar Pal",
        "owner_name": "Akhilesh Kumar Pal"
    }
    for k, v in studio_settings.items():
        cursor.execute("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP", (k, v))
    conn.commit()
    conn.close()

# Start database setup
init_db()

# Request Handler Class
class APIRequestHandler(BaseHTTPRequestHandler):
    
    # Enable CORS
    def end_headers(self):
        origin = self.headers.get('Origin', '')
        allowed_origins = [
            'https://shivamstudio-app.vercel.app',
            'https://shivamstudio.vercel.app',
            'https://shivam-studio.vercel.app',
            'https://shivamstudio-official.vercel.app',
            'https://shivamstudio-live.vercel.app',
            'https://bhumi-studio-app.vercel.app',
            'http://localhost:8000',
            'http://127.0.0.1:8000',
        ]
        if origin in allowed_origins or ('shivamstudio' in origin and origin.endswith('.vercel.app')):
            self.send_header('Access-Control-Allow-Origin', origin)
        else:
            # Fallback: allow all (also handles Vercel preview URLs)
            self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Allow-Credentials', 'true')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    # Parse auth token
    def get_auth_user(self):
        auth_header = self.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None
        token = auth_header.split(' ')[1]
        
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT u.* FROM users u 
            JOIN sessions s ON u.id = s.user_id 
            WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')
        """, (token,))
        user = cursor.fetchone()
        conn.close()
        return dict(user) if user else None

    # Handle standard error JSON response
    def send_error_json(self, status_code, message):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"error": message}).encode('utf-8'))

    # Handle success JSON response
    def send_success_json(self, data, status_code=200):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_GET(self):
        url_parsed = urlparse(self.path)
        path = url_parsed.path
        query = parse_qs(url_parsed.query)

        # Route APIs
        if path.startswith("/api/"):
            self.handle_api_get(path, query)
        else:
            self.handle_static_files(path)

    def do_POST(self):
        url_parsed = urlparse(self.path)
        path = url_parsed.path
        
        if path.startswith("/api/"):
            # Read JSON body
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else "{}"
            try:
                body = json.loads(post_data) if post_data else {}
            except ValueError:
                self.send_error_json(400, "Invalid JSON body")
                return

            self.handle_api_post(path, body)
        else:
            self.send_error_json(404, "Not Found")

    def do_PUT(self):
        url_parsed = urlparse(self.path)
        path = url_parsed.path
        
        if path.startswith("/api/"):
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else "{}"
            try:
                body = json.loads(post_data) if post_data else {}
            except ValueError:
                self.send_error_json(400, "Invalid JSON body")
                return

            self.handle_api_put(path, body)
        else:
            self.send_error_json(404, "Not Found")

    def do_DELETE(self):
        url_parsed = urlparse(self.path)
        path = url_parsed.path
        
        if path.startswith("/api/"):
            self.handle_api_delete(path)
        else:
            self.send_error_json(404, "Not Found")

    # API Routing: GET methods
    def handle_api_get(self, path, query):
        current_user = self.get_auth_user()

        # Auth verify token
        if path == "/api/auth/me":
            if not current_user:
                self.send_error_json(401, "Unauthorized or session expired")
                return
            # Remove password hash for security
            user_data = current_user.copy()
            del user_data['password_hash']
            self.send_success_json(user_data)
            return

        # Settings endpoint
        elif path == "/api/settings":
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT key, value FROM settings")
            rows = cursor.fetchall()
            conn.close()
            settings_dict = {}
            for r in rows:
                val = r['value']
                try:
                    settings_dict[r['key']] = json.loads(val)
                except ValueError:
                    settings_dict[r['key']] = val
            self.send_success_json(settings_dict)
            return

        # Offers endpoint
        elif path == "/api/offers":
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM offers ORDER BY created_at DESC")
            offers = [dict(r) for r in cursor.fetchall()]
            conn.close()
            self.send_success_json(offers)
            return

        # Testimonials endpoint
        elif path == "/api/testimonials":
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM testimonials ORDER BY created_at DESC")
            testimonials = [dict(r) for r in cursor.fetchall()]
            conn.close()
            self.send_success_json(testimonials)
            return

        # Portfolio endpoint
        elif path == "/api/portfolio":
            category = query.get('category', [None])[0]
            featured = query.get('featured', [None])[0]
            
            conn = get_db()
            cursor = conn.cursor()
            if featured == "1" or featured == "true":
                cursor.execute("SELECT * FROM portfolio WHERE is_featured = 1 ORDER BY created_at DESC")
            elif category:
                cursor.execute("SELECT * FROM portfolio WHERE category = ? ORDER BY created_at DESC", (category,))
            else:
                cursor.execute("SELECT * FROM portfolio ORDER BY created_at DESC")
                
            items = [dict(r) for r in cursor.fetchall()]
            conn.close()
            self.send_success_json(items)
            return

        # Bookings endpoints
        elif path == "/api/bookings":
            if not current_user:
                self.send_error_json(401, "Unauthorized")
                return
            
            conn = get_db()
            cursor = conn.cursor()
            if current_user['role'] == 'admin':
                cursor.execute("SELECT * FROM bookings ORDER BY event_date DESC, created_at DESC")
            else:
                cursor.execute("SELECT * FROM bookings WHERE user_id = ? ORDER BY event_date DESC, created_at DESC", (current_user['id'],))
            
            bookings = [dict(r) for r in cursor.fetchall()]
            conn.close()
            self.send_success_json(bookings)
            return

        elif path.startswith("/api/bookings/track/"):
            # Booking tracking without registration (anonymous check via ID)
            booking_id = path.replace("/api/bookings/track/", "")
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,))
            booking = cursor.fetchone()
            conn.close()
            if not booking:
                self.send_error_json(404, "Booking not found")
                return
            self.send_success_json(dict(booking))
            return

        # Enquiries endpoint (Admin only)
        elif path == "/api/enquiries":
            if not current_user or current_user['role'] != 'admin':
                self.send_error_json(403, "Forbidden")
                return
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM enquiries ORDER BY created_at DESC")
            enquiries = [dict(r) for r in cursor.fetchall()]
            conn.close()
            self.send_success_json(enquiries)
            return

        # Analytics endpoint (Admin only)
        elif path == "/api/analytics":
            if not current_user or current_user['role'] != 'admin':
                self.send_error_json(403, "Forbidden")
                return
            
            conn = get_db()
            cursor = conn.cursor()
            
            # 1. Totals
            cursor.execute("SELECT COUNT(*) FROM bookings")
            total_bookings = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM enquiries")
            total_enquiries = cursor.fetchone()[0]
            
            cursor.execute("SELECT SUM(price) FROM bookings WHERE status IN ('confirmed', 'completed')")
            total_revenue = cursor.fetchone()[0] or 0.0
            
            # 2. Status counts
            cursor.execute("SELECT status, COUNT(*) as count FROM bookings GROUP BY status")
            booking_status_counts = {r['status']: r['count'] for r in cursor.fetchall()}
            
            # 3. Popular services
            cursor.execute("SELECT service_name, COUNT(*) as count, SUM(price) as revenue FROM bookings GROUP BY service_name ORDER BY count DESC")
            popular_services = [dict(r) for r in cursor.fetchall()]
            
            # 4. Monthly trends (last 6 months)
            # SQLite query to group by month
            cursor.execute("""
                SELECT strftime('%Y-%m', event_date) as month, COUNT(*) as count, SUM(price) as revenue 
                FROM bookings 
                WHERE event_date >= date('now', '-6 month')
                GROUP BY month 
                ORDER BY month ASC
            """)
            monthly_trends = [dict(r) for r in cursor.fetchall()]
            
            conn.close()
            
            self.send_success_json({
                "totals": {
                    "bookings": total_bookings,
                    "enquiries": total_enquiries,
                    "revenue": total_revenue
                },
                "booking_status": booking_status_counts,
                "popular_services": popular_services,
                "monthly_trends": monthly_trends
            })
            return

        else:
            self.send_error_json(404, "API endpoint not found")

    # API Routing: POST methods
    def handle_api_post(self, path, body):
        current_user = self.get_auth_user()

        # Auth Register
        if path == "/api/auth/register":
            name = body.get('name')
            email = body.get('email')
            password = body.get('password')
            phone = body.get('phone', '')
            role = body.get('role', 'customer') # Can restrict, but let's default to customer
            
            if not name or not email or not password:
                self.send_error_json(400, "Name, email, and password are required")
                return
            
            conn = get_db()
            cursor = conn.cursor()
            
            # Check if email exists
            cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
            if cursor.fetchone():
                conn.close()
                self.send_error_json(400, "Email already registered")
                return
            
            user_id = str(uuid.uuid4())
            pass_hash = hash_password(password)
            
            try:
                cursor.execute("""
                    INSERT INTO users (id, name, email, password_hash, role, phone) 
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (user_id, name, email, pass_hash, role, phone))
                
                # Generate session
                token = uuid.uuid4().hex
                expires = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d %H:%M:%S')
                cursor.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", (token, user_id, expires))
                
                conn.commit()
                self.send_success_json({
                    "user": {"id": user_id, "name": name, "email": email, "role": role, "phone": phone},
                    "token": token
                }, 201)
            except Exception as e:
                self.send_error_json(500, f"Database error: {str(e)}")
            finally:
                conn.close()
            return

        # Auth Login
        elif path == "/api/auth/login":
            email = body.get('email')
            password = body.get('password')
            
            if not email or not password:
                self.send_error_json(400, "Email and password are required")
                return
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
            user = cursor.fetchone()
            
            if not user or not verify_password(user['password_hash'], password):
                conn.close()
                self.send_error_json(400, "Invalid email or password")
                return
            
            user_id = user['id']
            token = uuid.uuid4().hex
            expires = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d %H:%M:%S')
            cursor.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", (token, user_id, expires))
            conn.commit()
            
            user_data = dict(user)
            del user_data['password_hash']
            
            conn.close()
            self.send_success_json({
                "user": user_data,
                "token": token
            })
            return

        # Upload base64 files
        elif path == "/api/upload":
            filename = body.get('filename')
            content = body.get('content') # Data URL format: "data:image/png;base64,iVBORw0K..."
            
            if not filename or not content:
                self.send_error_json(400, "Filename and content base64 string are required")
                return
            
            try:
                # Parse base64 content
                header, encoded = content.split(",", 1)
                data = base64.b64decode(encoded)
                
                # Create secure filename: prepend timestamp + uuid hash to prevent collisions
                file_ext = os.path.splitext(filename)[1].lower()
                if file_ext not in ['.png', '.jpg', '.jpeg', '.gif', '.mp4', '.mov', '.pdf']:
                    self.send_error_json(400, "Invalid file format. Upload photos/videos only.")
                    return
                
                secure_name = f"{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}{file_ext}"
                filepath = os.path.join(UPLOAD_DIR, secure_name)
                
                with open(filepath, "wb") as f:
                    f.write(data)
                
                self.send_success_json({"url": f"/uploads/{secure_name}"})
            except Exception as e:
                self.send_error_json(500, f"Failed to upload: {str(e)}")
            return

        # Create Booking
        elif path == "/api/bookings":
            service_name = body.get('service_name')
            event_date = body.get('event_date')
            event_time = body.get('event_time')
            package_name = body.get('package_name', 'Standard')
            client_name = body.get('client_name')
            client_email = body.get('client_email')
            client_phone = body.get('client_phone')
            special_requirements = body.get('special_requirements', '')
            reference_image = body.get('reference_image', '')
            price = body.get('price', 0.0)
            
            if not service_name or not event_date or not client_name or not client_email or not client_phone:
                self.send_error_json(400, "Missing required booking details")
                return
            
            booking_id = str(uuid.uuid4())
            user_id = current_user['id'] if current_user else None
            
            conn = get_db()
            cursor = conn.cursor()
            try:
                cursor.execute("""
                    INSERT INTO bookings (id, user_id, service_name, event_date, event_time, package_name, client_name, client_email, client_phone, special_requirements, reference_image, price, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
                """, (booking_id, user_id, service_name, event_date, event_time, package_name, client_name, client_email, client_phone, special_requirements, reference_image, price))
                conn.commit()
                self.send_success_json({
                    "message": "Booking submitted successfully!",
                    "booking_id": booking_id
                })
            except Exception as e:
                self.send_error_json(500, f"Database error: {str(e)}")
            finally:
                conn.close()
            return

        # Create Enquiry
        elif path == "/api/enquiries":
            client_name = body.get('client_name')
            client_email = body.get('client_email')
            client_phone = body.get('client_phone')
            subject = body.get('subject')
            message = body.get('message')
            
            if not client_name or not client_email or not subject or not message:
                self.send_error_json(400, "Missing required field values for Enquiry")
                return
            
            enquiry_id = str(uuid.uuid4())
            conn = get_db()
            cursor = conn.cursor()
            try:
                cursor.execute("""
                    INSERT INTO enquiries (id, client_name, client_email, client_phone, subject, message, status)
                    VALUES (?, ?, ?, ?, ?, ?, 'unread')
                """, (enquiry_id, client_name, client_email, client_phone, subject, message))
                conn.commit()
                self.send_success_json({
                    "message": "Enquiry submitted successfully!",
                    "enquiry_id": enquiry_id
                })
            except Exception as e:
                self.send_error_json(500, f"Database error: {str(e)}")
            finally:
                conn.close()
            return

        # Add Testimonial (Admin only)
        elif path == "/api/testimonials":
            if not current_user or current_user['role'] != 'admin':
                self.send_error_json(403, "Forbidden")
                return
            
            client_name = body.get('client_name')
            rating = body.get('rating', 5)
            comment = body.get('comment')
            service = body.get('service', '')
            avatar = body.get('avatar', '')
            
            if not client_name or not comment:
                self.send_error_json(400, "Missing client_name or comment")
                return
                
            test_id = str(uuid.uuid4())
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("INSERT INTO testimonials (id, client_name, rating, comment, service, avatar) VALUES (?, ?, ?, ?, ?, ?)",
                           (test_id, client_name, rating, comment, service, avatar))
            conn.commit()
            conn.close()
            self.send_success_json({"message": "Testimonial added", "id": test_id})
            return

        # Create Portfolio Item (Admin only)
        elif path == "/api/portfolio":
            if not current_user or current_user['role'] != 'admin':
                self.send_error_json(403, "Forbidden")
                return
                
            title = body.get('title')
            category = body.get('category')
            media_type = body.get('media_type', 'image')
            url = body.get('url')
            thumbnail = body.get('thumbnail', '')
            is_featured = body.get('is_featured', 0)
            
            if not title or not category or not url:
                self.send_error_json(400, "Title, category, and url are required")
                return
                
            port_id = str(uuid.uuid4())
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("INSERT INTO portfolio (id, title, category, media_type, url, thumbnail, is_featured) VALUES (?, ?, ?, ?, ?, ?, ?)",
                           (port_id, title, category, media_type, url, thumbnail, is_featured))
            conn.commit()
            conn.close()
            self.send_success_json({"message": "Portfolio item created", "id": port_id})
            return

        # Create/Add Offer (Admin only)
        elif path == "/api/offers":
            if not current_user or current_user['role'] != 'admin':
                self.send_error_json(403, "Forbidden")
                return
                
            title = body.get('title')
            description = body.get('description')
            code = body.get('code')
            discount_percent = body.get('discount_percent')
            start_date = body.get('start_date')
            expiry_date = body.get('expiry_date')
            is_active = body.get('is_active', 1)
            
            if not title or not code or not discount_percent:
                self.send_error_json(400, "Title, code, and discount percentage are required")
                return
                
            offer_id = str(uuid.uuid4())
            conn = get_db()
            cursor = conn.cursor()
            try:
                cursor.execute("""
                    INSERT INTO offers (id, title, description, code, discount_percent, start_date, expiry_date, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (offer_id, title, description, code, int(discount_percent), start_date, expiry_date, int(is_active)))
                conn.commit()
                self.send_success_json({"message": "Offer created successfully", "id": offer_id})
            except sqlite3.IntegrityError:
                self.send_error_json(400, "Coupon code must be unique")
            except Exception as e:
                self.send_error_json(500, str(e))
            finally:
                conn.close()
            return

        # Save Settings (Admin only)
        elif path == "/api/settings":
            if not current_user or current_user['role'] != 'admin':
                self.send_error_json(403, "Forbidden")
                return
            
            conn = get_db()
            cursor = conn.cursor()
            try:
                for key, val in body.items():
                    val_str = json.dumps(val) if isinstance(val, (dict, list)) else str(val)
                    cursor.execute("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)", (key, val_str))
                conn.commit()
                self.send_success_json({"message": "Settings updated successfully"})
            except Exception as e:
                self.send_error_json(500, str(e))
            finally:
                conn.close()
            return

        else:
            self.send_error_json(404, "API endpoint not found")

    # API Routing: PUT methods
    def handle_api_put(self, path, body):
        current_user = self.get_auth_user()
        if not current_user or current_user['role'] != 'admin':
            self.send_error_json(403, "Forbidden")
            return

        # Update Booking Status
        if path.startswith("/api/bookings/"):
            booking_id = path.replace("/api/bookings/", "")
            status = body.get('status')
            
            if not status:
                self.send_error_json(400, "Status is required")
                return
                
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("UPDATE bookings SET status = ? WHERE id = ?", (status, booking_id))
            conn.commit()
            conn.close()
            self.send_success_json({"message": "Booking status updated successfully"})
            return

        # Update Enquiry Notes & Status
        elif path.startswith("/api/enquiries/"):
            enquiry_id = path.replace("/api/enquiries/", "")
            status = body.get('status')
            notes = body.get('notes')
            
            conn = get_db()
            cursor = conn.cursor()
            if status and notes is not None:
                cursor.execute("UPDATE enquiries SET status = ?, notes = ? WHERE id = ?", (status, notes, enquiry_id))
            elif status:
                cursor.execute("UPDATE enquiries SET status = ? WHERE id = ?", (status, enquiry_id))
            elif notes is not None:
                cursor.execute("UPDATE enquiries SET notes = ? WHERE id = ?", (notes, enquiry_id))
                
            conn.commit()
            conn.close()
            self.send_success_json({"message": "Enquiry updated successfully"})
            return

        # Update Offer
        elif path.startswith("/api/offers/"):
            offer_id = path.replace("/api/offers/", "")
            title = body.get('title')
            description = body.get('description')
            code = body.get('code')
            discount_percent = body.get('discount_percent')
            start_date = body.get('start_date')
            expiry_date = body.get('expiry_date')
            is_active = body.get('is_active')
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE offers 
                SET title = ?, description = ?, code = ?, discount_percent = ?, start_date = ?, expiry_date = ?, is_active = ?
                WHERE id = ?
            """, (title, description, code, discount_percent, start_date, expiry_date, is_active, offer_id))
            conn.commit()
            conn.close()
            self.send_success_json({"message": "Offer updated successfully"})
            return

        else:
            self.send_error_json(404, "API endpoint not found")

    # API Routing: DELETE methods
    def handle_api_delete(self, path):
        current_user = self.get_auth_user()
        if not current_user or current_user['role'] != 'admin':
            self.send_error_json(403, "Forbidden")
            return

        # Delete Portfolio Item
        if path.startswith("/api/portfolio/"):
            port_id = path.replace("/api/portfolio/", "")
            conn = get_db()
            cursor = conn.cursor()
            
            # Check if file upload and delete physical file
            cursor.execute("SELECT url FROM portfolio WHERE id = ?", (port_id,))
            row = cursor.fetchone()
            if row and row['url'].startswith("/uploads/"):
                filepath = os.path.join(PUBLIC_DIR, row['url'].lstrip("/"))
                if os.path.exists(filepath):
                    try:
                        os.remove(filepath)
                    except Exception:
                        pass
                        
            cursor.execute("DELETE FROM portfolio WHERE id = ?", (port_id,))
            conn.commit()
            conn.close()
            self.send_success_json({"message": "Portfolio item deleted successfully"})
            return

        # Delete Offer
        elif path.startswith("/api/offers/"):
            offer_id = path.replace("/api/offers/", "")
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM offers WHERE id = ?", (offer_id,))
            conn.commit()
            conn.close()
            self.send_success_json({"message": "Offer deleted successfully"})
            return

        # Delete Testimonial
        elif path.startswith("/api/testimonials/"):
            test_id = path.replace("/api/testimonials/", "")
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM testimonials WHERE id = ?", (test_id,))
            conn.commit()
            conn.close()
            self.send_success_json({"message": "Testimonial deleted successfully"})
            return

        # Delete Booking
        elif path.startswith("/api/bookings/"):
            booking_id = path.replace("/api/bookings/", "")
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM bookings WHERE id = ?", (booking_id,))
            conn.commit()
            conn.close()
            self.send_success_json({"message": "Booking deleted successfully"})
            return

        # Delete Enquiry
        elif path.startswith("/api/enquiries/"):
            enquiry_id = path.replace("/api/enquiries/", "")
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM enquiries WHERE id = ?", (enquiry_id,))
            conn.commit()
            conn.close()
            self.send_success_json({"message": "Enquiry deleted successfully"})
            return

        else:
            self.send_error_json(404, "API endpoint not found")

    # Static File Server
    def handle_static_files(self, path):
        # Default index.html
        if path == "/" or path == "":
            path = "/index.html"

        # Sanitize path to prevent directory traversal
        path = os.path.normpath(path).replace("\\", "/")
        if ".." in path:
            self.send_error_json(403, "Access Denied")
            return

        # Trim leading slash and check path in public folder
        file_path = os.path.join(PUBLIC_DIR, path.lstrip("/"))
        
        # If file does not exist, serve index.html (supports client side SPA routing)
        if not os.path.exists(file_path) or os.path.isdir(file_path):
            file_path = os.path.join(PUBLIC_DIR, "index.html")

        # Determine Content-Type
        mime_types = {
            ".html": "text/html",
            ".css": "text/css",
            ".js": "application/javascript",
            ".json": "application/json",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".svg": "image/svg+xml",
            ".ico": "image/x-icon",
            ".mp4": "video/mp4",
            ".mov": "video/quicktime",
            ".pdf": "application/pdf"
        }
        
        _, ext = os.path.splitext(file_path)
        content_type = mime_types.get(ext.lower(), "application/octet-stream")

        try:
            with open(file_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            # Add cache control: always validate HTML, cache static assets
            if ext.lower() in ['.html', '.htm']:
                self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
                self.send_header('Pragma', 'no-cache')
                self.send_header('Expires', '0')
            elif ext.lower() in ['.css', '.js', '.png', '.jpg', '.jpeg', '.svg']:
                self.send_header('Cache-Control', 'max-age=86400')
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error_json(500, f"Server read error: {str(e)}")

# Server runner
def run(port=8000):
    server_address = ('', port)
    httpd = HTTPServer(server_address, APIRequestHandler)
    print(f"Shivam Studio and Photostate Backend Server active at http://localhost:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Shivam Studio and Photostate server...")
        httpd.server_close()
        sys.exit(0)

if __name__ == '__main__':
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    run(port)
