# VENKATARAMANA ENTERPRISES
### Full-Stack Construction Materials Website & Owner POS System
**"ONE STOP SOLUTION FOR BUILDING SOLUTION"** &bull; Established 2016 &bull; Gokavaram, Andhra Pradesh

---

## 1. Project Overview
A complete, production-ready, full-stack website and integrated Owner POS system engineered specifically for **VENKATARAMANA ENTERPRISES** ("IRON AND CEMENTS"), located opposite the Police Station on Main Road in Gokavaram, East Godavari District, Andhra Pradesh.

The application serves dual purposes:
1. **Public Showcase**: A high-performance, responsive Single Page Application (SPA) offering a 50+ item construction material catalogue (Cement, TMT Steel, Bricks & Blocks, Chemicals, Plaster, Aggregates, Plumbing, Roofing), brand showcases for confirmed suppliers (UltraTech Building Solutions, Jindal Panther, Vizag Steel, Mangal TMT), Google Maps directions, and one-tap WhatsApp enquiries.
2. **Owner Management & POS System**: A secure PIN-protected digital point-of-sale terminal supporting bill generation, automatic calculation of subtotals/discounts/configurable GST, instant client-side PDF downloads, WhatsApp bill dispatches, product/category management, and real-time revenue analytics.

---

## 2. Key Features

- **Single Page Application (SPA)**: Zero-page-refresh navigation with smooth scrolling and section highlights.
- **Construction-Focused Visual Identity**: Engineered with warm cream (`#FAF8F5`), deep charcoal (`#141414`), crimson accent (`#C8102E`), luxury gold framing (`#C5A059`), and architectural line motifs.
- **Bilingual Support (English &amp; Telugu)**: Instant language toggle with native `Noto Sans Telugu` font integration.
- **Comprehensive Product Catalog**: Over 50 real-world building materials across 10 categories with real-time text search, category pills, and sorting (A-Z, Z-A, Price Low-High, Price High-Low).
- **Strict No-Fabrication Compliance**: Unconfirmed inventory prices default to **"Contact for Price"** and link directly to pre-formatted WhatsApp enquiry chats.
- **Confirmed Brand Showcase**: Dedicated brand cards and product filtering for **UltraTech Building Solutions**, **Jindal Panther**, **Vizag Steel**, and **Mangal TMT**.
- **Digital Owner POS Terminal**:
  - Auto-generated sequential invoice numbers (`VE-YYYYMMDD-XXXX`).
  - Catalog-linked item picker with custom manual item override.
  - Multi-unit pricing (Bags, Metric Tons, Bundles, Pieces, Sq.Ft, Litres, Brass/cft).
  - Discount, configurable GST rate, and grand total calculations.
  - Payment modes: Cash, UPI, Card, Bank Transfer.
- **Client-Side PDF Generation**: High-resolution print-ready Tax Invoice PDF generation via `html2pdf.js`.
- **WhatsApp Invoice Integration**: Pre-formats structured bill summaries and opens WhatsApp directly to the customer's phone number.
- **Sales Analytics Dashboard**: Real-time tracking of Total Revenue, Total Bills, Today's Revenue, and Today's Bills.
- **Product Management (CRUD)**: Add, edit, delete, activate/deactivate, set prices, units, and stock.
- **Dual-Database Layer**:
  - Cloud Turso LibSQL database via HTTP pipeline when credentials are provided.
  - Automatic fallback to local SQLite (`data/local.db`) using native `node:sqlite`.
- **Installable Progressive Web App (PWA)**: Includes `manifest.json`, mobile theme tags, SVG icons, and `sw.js` offline cache.
- **Zero Console/Server Errors**: Verified via automated QA test suite (`test.js`) with 100% pass rate.

---

## 3. Technology Stack

- **Frontend**: HTML5, Vanilla CSS3 (custom CSS variables &amp; responsive grid), ES6+ JavaScript.
- **Backend**: Node.js REST API with Express routing semantics and serverless Vercel compatibility.
- **Database**: Turso Cloud LibSQL / SQLite with automatic local fallback (`node:sqlite` in `data/local.db`).
- **Typography**: Playfair Display (Headings), Plus Jakarta Sans (Body/UI), Noto Sans Telugu (Telugu).
- **PDF Engine**: `html2pdf.js` client-side library.
- **Deployment**: Vercel ready via `vercel.json`.

---

## 4. Folder Structure

```
venkataramana-enterprises/
├── server.js              # Full-stack Node.js server, REST API & database migration engine
├── index.html             # Responsive Single Page Application, Owner Portal & POS UI
├── package.json           # Project metadata, scripts, and production dependencies
├── manifest.json          # PWA manifest configuration
├── sw.js                  # PWA service worker for asset caching
├── vercel.json            # Vercel deployment and serverless rewrite configuration
├── .env                   # Local environment configuration
├── .env.example           # Reference environment variables template
├── .gitignore             # Git ignore file for secrets and database artifacts
├── test.js                # Automated 31-point QA test suite
├── README.md              # Complete project documentation and operation manual
├── node.cmd               # Local Windows Node.js runner shim
├── assets/
│   ├── logo/
│   │   ├── logo.svg       # Primary brand logo (Iron & Cements)
│   │   └── icon.svg       # Square monogram app icon & favicon
│   ├── icons/             # Clean category SVGs (cement, steel, bricks, etc.)
│   ├── brands/            # Confirmed brand SVGs (UltraTech, Jindal, Vizag, Mangal)
│   └── banners/           # Hero architectural construction SVG
└── data/
    └── local.db           # Local SQLite fallback database (auto-generated)
```

---

## 5. Installation & Local Development

### Prerequisites
- Node.js v18.0.0 or higher.
- (On Windows systems where Node is accessed via executable wrapper, use `.\node.cmd`).

### 1. Clone or Open Project
```bash
cd "c:\Users\Lakshmi Steels\OneDrive\Desktop\VENKATARAMANA ENTERPRISES"
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure `.env` contains:
```ini
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
OWNER_PIN=1234
GST_RATE=
PORT=3000
```

### 3. Run the Server
Using standard Node:
```bash
node server.js
```
Or using the local workspace wrapper:
```bash
.\node.cmd server.js
```

Open your browser to:
```
http://localhost:3000
```

### 4. Run the Automated QA Test Suite
Verify all 31 automated tests:
```bash
.\node.cmd test.js
```

---

## 6. Turso Cloud Database Setup

To link a persistent cloud database on Turso:
1. Create a database on [Turso](https://turso.tech):
   ```bash
   turso db create venkataramana-db
   ```
2. Retrieve the database URL and authentication token:
   ```bash
   turso db show venkataramana-db --url
   turso db tokens create venkataramana-db
   ```
3. Update `.env`:
   ```ini
   TURSO_DATABASE_URL=https://venkataramana-db-[org].turso.io
   TURSO_AUTH_TOKEN=your-turso-auth-token-here
   ```
4. Restart the server. The application will automatically connect to Turso and migrate tables.

---

## 7. Owner Portal & POS Operation Guide

### Accessing the Owner Portal
- Click the **"🔒 Owner Portal"** button in the top navigation bar or browse to `http://localhost:3000/#owner`.
- Enter the Owner PIN (Default setup PIN: `1234`).
- A security banner will prompt you to change this PIN in the **Settings** tab.

### POS / Billing Workflow
1. Navigate to the **"🧾 Billing / POS"** tab.
2. The invoice number (`VE-YYYYMMDD-XXXX`) and today's date are pre-filled automatically.
3. Enter Customer Name and 10-digit Phone Number.
4. Select a material from the catalog dropdown (or type a custom name), adjust the quantity and unit price, and click **"Add"**.
5. Adjust Discount (₹) or GST % if applicable.
6. Select Payment Method (**Cash**, **UPI**, **Card**, **Bank Transfer**).
7. Click **"💾 Generate & Save Bill"**.
8. Click **"💬 Send Invoice on WhatsApp"** to open WhatsApp with a clean pre-formatted invoice summary directly to the customer's phone.
9. Click **"📄 Download PDF Invoice"** to save a PDF tax invoice generated right in the browser.

### Product Management
- In the **"📦 Product Management"** tab, click **"➕ Add New Product"** to introduce new inventory.
- Click **"Edit"** on any existing material to add a confirmed retail price, update stock, or toggle active/inactive status.
- Setting price to blank automatically displays **"Contact for Price"** on the public store.

### Sales History & Deletion
- In the **"📑 Sales History"** tab, search invoices by customer name, phone, or invoice number.
- Click **"View"** to reload and reprint/resend any past invoice.
- Click **"Delete"** to remove erroneous entries.

---

## 8. Deployment to Vercel

1. Push the repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial release of VENKATARAMANA ENTERPRISES full-stack system"
   git branch -M main
   git remote add origin https://github.com/<your-username>/venkataramana-enterprises.git
   git push -u origin main
   ```
2. Connect your GitHub repository to [Vercel](https://vercel.com).
3. Under **Project Settings &gt; Environment Variables** on Vercel, set:
   - `TURSO_DATABASE_URL` = *(Your Turso DB URL)*
   - `TURSO_AUTH_TOKEN` = *(Your Turso Auth Token)*
   - `OWNER_PIN` = *(Your Secure 4+ digit Owner PIN)*
   - `GST_RATE` = *(Optional: e.g. 18)*
4. Click **Deploy**. Vercel will automatically build the application and route `/api/*` and static assets.

---

## 9. Items Requiring Owner Input

The application is 100% operational out of the box with zero fake information. The owner can configure the following at their convenience via the **Owner Portal**:

1. **Owner Security PIN**: Change the initial setup PIN (`1234`) to a private PIN via the Settings tab.
2. **GST / Tax Percentage**: Configure the official store GST rate (e.g. 18% or 0%) in the Settings tab.
3. **Confirmed Retail Prices**: Update catalog prices for specific cement bags, steel rebar bundles, and masonry items to replace the default "Contact for Price".
4. **Stock Levels**: Record actual warehouse bag and metric ton counts as stock arrives.
5. **Custom Photography**: As shop photos or real product photos are taken, place them in `assets/store/` and `assets/products/`.

---

&copy; 2016&ndash;Present **VENKATARAMANA ENTERPRISES**. All Rights Reserved.  
Main Road, Opposite Police Station, Gokavaram, East Godavari District, Andhra Pradesh - 533286
