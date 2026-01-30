# Proto Golf — Project Instructions

## Overview
Proto Golf is a custom putter company website. Static HTML/CSS/JS, hosted on Vercel via the parent repo (stuart-hollinger-landing). No build step — edit HTML files directly.

## Tech Stack
- Static HTML/CSS/JS (no framework)
- Supabase for data (products, orders, variants, product images)
- Supabase Storage for image hosting (bucket: `proto-golf-images`)
- Google Fonts: Outfit (UI) + Space Mono (monospace/data)
- Vercel hosting (auto-deploy on git push)

## File Structure
```
proto-golf-site/
  index.html          — Landing page / homepage
  shop.html           — Product listing page
  checkout.html       — Checkout flow
  order-confirmation.html — Post-purchase confirmation
  contact.html        — Contact form
  about.html          — About the brand
  faq.html            — FAQ page
  limited.html        — Limited edition drops
  products/
    product.html      — Dynamic product detail page (loads by query param)
    rough-mill.html   — Rough Mill putter page
    centre-blade.html — Centre Blade putter page
    long-neck-blade.html — Long Neck Blade page
  admin/
    dashboard.html    — Admin dashboard (inventory, orders, photos, variants, bg remover, client requests)
  assets/
    images/           — Static images (logos, icons, hero shots)
```

## Supabase Tables
- `proto_golf_products` — Product catalog (name, price, description, hero_image, stock, status, sort_order)
- `proto_golf_orders` — Customer orders
- `proto_golf_variants` — Product variants (finish, weight, specs per product)
- `proto_golf_product_images` — Gallery images per product (stored in Supabase Storage)

## Design System
- **Colors:** CSS vars `--color-ink` (#1a1a1a), `--color-carbon`, `--color-graphite`, `--color-steel`, `--color-silver`, `--color-ash`, `--color-mist`, `--color-bone` (#f5f5f5), `--color-paper` (#fafafa)
- **Fonts:** `'Outfit', sans-serif` for all UI, `'Space Mono', monospace` for data/prices
- **Components:** `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-sm`, `.badge`, `.section-card`, `.data-table`, `.form-input`, `.form-label`
- **Status badges:** `.badge-success` (green), `.badge-warning` (yellow), `.badge-error` (red), `.badge-neutral` (gray)
- **Aesthetic:** Minimal, monochrome, premium feel. No bright colors. Dark backgrounds (#1a1a1a) with light text on hero sections, light backgrounds on content sections.

## Admin Dashboard
Single-page app at `admin/dashboard.html`. Sidebar nav with sections: Overview, Orders, Inventory, Analytics, Products, Variants, Photos, BG Remover, Requests. Uses `supabaseQuery()` helper for all API calls.

## Conventions
- All Supabase calls use the anon key (no auth required for admin — it's a simple admin panel)
- Product images uploaded to Supabase Storage, public URLs stored in DB
- No build tools, bundlers, or package.json — pure static files
- Mobile-responsive with breakpoints at 1024px and 600px
- Print styles exist for order forms
