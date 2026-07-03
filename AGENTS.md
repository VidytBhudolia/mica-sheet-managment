# Agent Rules — Mica Sheet Sales Manager

## Project Philosophy

- **Lightweight first.** No extra dependencies, no over-engineering. Simple tool for a non-technical user.
- **Minimal changes.** Touch only what's needed. Don't refactor or restructure unless asked.
- **Single-file UI.** All frontend in `app/page.js`. Keep it that way.
- **Mobile-friendly.** User accesses this on phone. All UI must work on small screens.

## Architecture

- Next.js 16 (App Router) — single `page.js` client component + `actions.js` server actions
- Google Sheets as database (3 tabs: SKU, Buyer, Storage)
- Tailwind CSS 4, Lucide React icons
- No ORM, no state library, no component library

## File Structure

```
app/
  page.js      — All UI (~1000 lines, single client component)
  actions.js   — Server actions (fetchMasterData, appendOrderLog, updateSkuPrice)
  layout.js    — Root layout
  globals.css  — Tailwind imports
```

## Google Sheets Schema

- **SKU** (A: Product ID, B: Description, C: Last Price) — C is auto-updated on every order
- **Buyer** (A-G: ID, Company, POC, Contact, Email, GSTIN, Address)
- **Storage** (A-G: Date, Buyer ID, Product ID, Qty, Unit Price, Order ID, Notes)

## Key Patterns

- All data loaded once on mount via `fetchMasterData()`
- Analytics computed client-side with `useMemo`
- Optimistic UI on form submission (rollback on failure)
- "Last Price" stored in SKU!C, synced on every order submit
- Period-grouped tables with highlighted row separators (no period column)
- Sort bar for consolidated views (Product ID, Qty, Revenue, Lines with asc/desc)
- Searchable dropdowns for buyer/product selection
- Notes displayed as popup on icon tap (not inline)
- SKU price editing: tap to edit inline, tick to save, no separate button column

## Rules for Code Changes

1. Read existing code before writing — match style exactly
2. Don't add new files unless genuinely needed
3. Don't install packages unless unavoidable
4. Don't add TypeScript (project uses .js)
5. Keep all UI in `page.js` — no component extraction unless requested
6. Google Sheets columns are positional — never reorder without updating `actions.js`
7. Test on mobile viewports — tables should hide non-essential columns on small screens
8. The sidebar uses mobile overlay pattern (not fixed on small screens)

## Current Features (as of Jul 2026)

- Data Entry: Form with auto-fill last price, searchable buyer/product dropdowns
- Dashboard: FY filter, Annual/Monthly grouping toggle, Detailed/Consolidated toggle, sort buttons
- Buyer Analytics: Buyer search, searchable product filter, FY filter, grouping, view mode, sort
- Storage Logs: Full log with note icons
- SKU Master: Searchable list, tap-to-edit price
- Buyer Master: Read-only table

## Known State

- Build passes clean (`npm run build`)
- All features working but buyer analytics may need dev server restart to show data
- Mobile responsive with collapsible sidebar

<!-- BEGIN:nextjs-agent-rules -->
This project uses Next.js 16 which may have breaking changes from your training data. Check `node_modules/next/dist/docs/` if unsure about APIs.
<!-- END:nextjs-agent-rules -->
