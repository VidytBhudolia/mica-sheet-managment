# Mica Sheet Sales Manager — Developer Context

## Architecture

- **Framework**: Next.js 16.2.10 (App Router), single `'use client'` page component
- **Storage**: Google Sheets via `googleapis` package (no database)
- **Styling**: Tailwind CSS 4, Lucide React icons
- **Single file UI**: Everything is in `app/page.js` (~1000 lines)
- **Server actions**: `app/actions.js` (3 functions)

## Google Sheets Structure

| Sheet | Columns | Notes |
|-------|---------|-------|
| SKU | A: Product ID, B: Description, C: Last Price | Column C is auto-updated on every order |
| Buyer | A: Buyer ID, B: Company Name, C: POC, D: Contact, E: Email, F: GSTIN, G: Address | |
| Storage | A: Date, B: Buyer ID, C: Product ID, D: Quantity, E: Unit Price, F: Order ID, G: Notes | Append-only log |

## Server Actions (`app/actions.js`)

1. `fetchMasterData()` — Reads all 3 sheets, returns `{ skus, buyers, logs }`
2. `appendOrderLog(orderData)` — Appends to Storage sheet + updates Last Price in SKU!C
3. `updateSkuPrice(productId, newPrice)` — Manually updates SKU!C (from SKU Master tab)

## Data Flow

1. On mount: `fetchMasterData()` → all data loaded into client state
2. All analytics computed client-side via `useMemo` (no additional API calls)
3. On order submit: `appendOrderLog()` → appends Storage row + writes last price back to SKU!C
4. Local state updated optimistically (rolled back on failure)

## UI Tabs (in `page.js`)

1. **Data Entry** — Form: date, order ID, buyer search dropdown, product search dropdown, qty, price, notes. Auto-fills last price on product selection.
2. **Dashboard** — Stat tiles + filterable table. Filters: Date Range (FY), Grouping (Annual/Monthly), View (Detailed/Consolidated). Consolidated view has sort buttons.
3. **Buyer Analytics** — Select buyer, searchable product filter, filters (Date Range, Grouping, View). Same period-grouped tables with sort. Stats shown per-buyer.
4. **Storage Logs** — Full log table with note icons.
5. **SKU Master** — Searchable list, tap-to-edit last price (inline input with tick/cancel).
6. **Buyer Master** — Read-only table.

## Key UI Patterns

- **Period grouping**: Tables use highlighted row separators (blue bg with left border) showing year/month. Data rows below. No separate period column.
- **Notes**: Small sticky-note icon appears only when note exists. Tap → modal popup with note text + close button.
- **Sort bar**: Appears in Consolidated views. Buttons for Product ID, Qty, Revenue, Lines. Click to toggle asc/desc (arrow icon changes).
- **Searchable dropdowns**: Buyer search, product search, buyer analytics product filter — all use typed text to filter options in a dropdown.
- **Mobile responsive**: Sidebar replaced with overlay nav on mobile. Tables hide non-essential columns. Smaller padding/text on small screens.
- **SKU price editing**: Tap the price text → inline input appears with ✓ (save) and ✗ (cancel). Enter to save, Escape to cancel. No separate Action column.

## State Variables (key ones)

- `financialYear` — 'ALL' | '2025-2026' | '2026-2027'
- `viewMode` — 'Detailed Logs' | 'Consolidated View'
- `dashboardGrouping` — 'Annually' | 'Monthly'
- `dashboardSort` / `buyerSort` — `{ key: string, dir: 'asc'|'desc' }`
- `buyerGrouping` — 'Year-wise' | 'Month-wise'
- `buyerViewMode` — 'Detailed Logs' | 'Consolidated'
- `buyerProductFilter` — 'ALL' | productId
- `buyerProductSearch` — text for searchable product dropdown in buyer analytics

## Important Notes

- **Last Price** is stored in SKU!C and auto-updated on every `appendOrderLog`. The `lastPriceMap` is built from `skus` state (not logs). This is fast on load.
- **Financial Year** is Indian (April–March). `getFinancialYear()` computes it.
- **Month keys** are `YYYY-MM` format. `getMonthLabel()` converts to "Jul 2026".
- All dates are ISO format `YYYY-MM-DD` in storage.
- The `enrichedLogs` memo joins Storage logs with buyer names and product descriptions.

## Dev Commands

```bash
npm run dev    # Start dev server
npm run build  # Production build
npm run lint   # ESLint
```

## Common Issues

- **Stuck on "Connecting to Google Sheets"**: Restart dev server. If persists, check `.env` credentials.
- **Last price not updating**: The `appendOrderLog` action updates SKU!C in a try/catch — it's non-critical. If Sheet permissions are wrong, logs still save but price doesn't sync.
- **Buyer Analytics empty**: Make sure a buyer is selected from the dropdown. The product filter defaults to "All Products" — if it shows text but no selection was made, data should still show (filter defaults to 'ALL').
