# Mica Sheet Sales Manager (Nexus B2B)

Lightweight Next.js app for logging mica sheet sales and viewing analytics. Built for non-technical users who need a simple way to track orders and review performance on any device.

## Features

- **Data Entry** — Log sales: pick buyer, pick product, enter quantity/price, submit. Last price auto-fills.
- **Dashboard** — Holistic view with FY + Monthly grouping, Detailed/Consolidated views, sort controls.
- **Buyer Analytics** — Per-buyer history with searchable product filter, date range, and grouping options.
- **Storage Logs** — Full searchable log of all entries.
- **SKU Master** — Product catalog with tap-to-edit last price.
- **Buyer Master** — Customer directory.
- **Mobile Optimised** — Works well on phone with responsive tables and collapsible navigation.

## Tech Stack

- Next.js 16 (App Router, single-page client component)
- Google Sheets as database (`googleapis`)
- Tailwind CSS 4
- Lucide React icons

## Setup

1. Install:
   ```bash
   npm install
   ```

2. Create `.env`:
   ```
   GOOGLE_SHEET_ID=your_spreadsheet_id
   GOOGLE_CLIENT_EMAIL=your_service_account_email
   GOOGLE_PRIVATE_KEY=your_private_key
   ```

3. Google Sheet tabs required:
   - **SKU** (A: Product ID, B: Description, C: Last Price)
   - **Buyer** (A: Buyer ID, B: Company Name, C: POC, D: Contact, E: Email, F: GSTIN, G: Address)
   - **Storage** (A: Date, B: Buyer ID, C: Product ID, D: Quantity, E: Unit Price, F: Order ID, G: Notes)

4. Run:
   ```bash
   npm run dev
   ```

## How It Works

- All data is fetched from Google Sheets on page load.
- Orders are appended to the Storage tab. The last price is automatically saved back to SKU column C.
- All analytics (totals, groupings, filtering) are computed client-side for speed.
- No server-side rendering needed — it's a single-page client app.

## Key Design Decisions

- **Last Price in Sheet**: Stored in SKU!C so it's available instantly on load without scanning all logs.
- **Period Row Separators**: Instead of a "Year" or "Month" column, tables show highlighted header rows separating periods.
- **Notes as Popup**: Notes don't take up table space. A small icon shows only when a note exists; tap to view in a modal.
- **Sort Controls**: Consolidated views have inline sort buttons (Product ID, Qty, Revenue, Lines) with asc/desc toggle.
- **Searchable Product Filter**: In Buyer Analytics, the product filter is a searchable dropdown for handling 200+ SKUs.
- **Mobile-first Tables**: Non-essential columns (Order ID, Total, Lines) are hidden on small screens.
