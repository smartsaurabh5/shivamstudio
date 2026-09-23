# Shivam Studio and Photostate - Full-Stack Photography & Videography Website

Shivam Studio and Photostate (Owner: Akhilesh Kumar Pal) is a premium, responsive, and luxury-themed full-stack website designed for modern photography, videography, and photostate services in Jaunpur, Uttar Pradesh. It features an interactive single-page application (SPA) frontend, a SQLite database, and a zero-dependency Python backend server.

---

## Key Features

1. **Premium Luxury Aesthetic**: A beautiful visual theme with gold/bronze accents (`#D4AF37`), dark slate card designs, custom typography (Google Fonts Outfit & Playfair Display), and responsive glassmorphic overlays. Supports both **Dark Mode** and **Light Mode**.
2. **Interactive Services Hub**: Clean catalog showcasing 13 different visual services (Weddings, Pre-wedding, Maternity, Corporate, Drone etc.) with customizable pricing packages (Silver, Gold, Platinum).
3. **Optimized Portfolio Gallery**: Category-filterable image and video grid equipped with a custom Javascript media Lightbox player supporting next/prev navigation.
4. **Dynamic 4-Step Booking Wizard**: Interactive wizard supporting service selection, real-time package updates, calendar bookings, and reference image uploads (converted to base64 for server processing).
5. **Anonymous Booking Tracking**: Customers can check on their session confirmation status using their Booking tracking ID directly from the interface.
6. **Enquiry Inbox & custom Quotes**: A fully integrated contact form and custom quote request popup that routes data to the admin panel.
7. **Customer Dashboard**: Logged-in customers can review booking histories, edit details, and download simulated PDF receipts.
8. **Admin Control Center**:
   - **Analytics**: Key metrics (revenue, enquiries, total bookings) and custom-drawn SVG charts representing monthly trend lines and popularity lists.
   - **Bookings**: Manage status configurations (Pending, Confirmed, Completed, Cancelled) and search/filter.
   - **Enquiry Inbox**: Read details, update action logs, and change resolution states.
   - **Portfolio Creator**: Form to upload new media to the catalog (URLs or file attachments).
   - **Promotions & Site Config**: Manage active coupons, edit parameters, and modify business locations.
   - **Excel Export**: Export bookings and enquiries data sheets to CSV files.
9. **Zero Dependencies Backend**: The server runs entirely on Python's built-in libraries and SQLite database, eliminating compile issues.

---

## Project Structure

```text
e:\shivamstudio/
├── server.py                 # Custom Python server serving static files and API
├── database.db               # SQLite database (auto-generated on startup)
├── public/                   # Frontend assets
│   ├── index.html            # Main SPA container
│   ├── css/
│   │   └── styles.css        # Premium CSS design system, themes, and layouts
│   ├── js/
│   │   ├── app.js            # Core App logic and client router
│   │   ├── api.js            # Backend API handler
│   │   ├── booking.js        # Booking system logic
│   │   ├── admin.js          # Admin dashboard & Analytics charts
│   │   └── portfolio.js      # Portfolio filter, lightbox, & media upload
│   └── uploads/              # Uploaded reference images and visual media
└── README.md                 # Running instructions (this file)
```

---

## Quick Start Instructions

1. **Launch the Server**:
   Ensure you have Python installed, open terminal or powershell in the root workspace folder, and run:
   ```powershell
   python server.py
   ```

2. **Access the Website**:
   Open your browser and navigate to:
   ```text
   http://localhost:8000
   ```

---

## Testing Credentials

You can test roles with these seeded accounts:

- **Admin Account**:
  - **Email**: `admin@shivamstudio.com`
  - **Password**: `admin@123`
  
- **Customer Account**:
  - **Email**: `client@gmail.com`
  - **Password**: `client123`

---

## Technical Details

- **Database**: SQLite database handles records with automatic schema migrations.
- **Image Uploads**: Frontend parses files into Base64 format and sends JSON payloads. Python server decodes it and writes files into `public/uploads/`.
- **Session Auth**: Managed via token tables in SQLite and `Authorization: Bearer <token>` client headers.
