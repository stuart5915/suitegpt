# Proto Golf E-Commerce Setup Guide

This guide will help you connect the backend services to make the site fully functional.

## Current Status

The following is **working now** (demo mode):
- ✅ Product pages with variant selection
- ✅ Cart functionality (localStorage)
- ✅ Checkout flow with shipping/pickup selection
- ✅ Admin dashboard at `/admin/dashboard.html` (password: `proto2026`)
- ✅ Inventory management UI
- ✅ Order form generation

The following **requires service accounts**:
- ❌ Real inventory tracking (needs Supabase)
- ❌ Payment processing (needs Stripe)
- ❌ Shipping label generation (needs Shippo)
- ❌ Email notifications (needs Resend)

---

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project called "proto-golf"
3. Wait for the database to provision (takes ~2 minutes)
4. Go to **Settings > API** and copy:
   - Project URL (e.g., `https://xxxxx.supabase.co`)
   - anon/public key (starts with `eyJ...`)

5. Go to **SQL Editor** and run the contents of `supabase-schema.sql`

6. Update `js/config.js` with your credentials:
```javascript
SUPABASE_URL: 'https://your-project.supabase.co',
SUPABASE_ANON_KEY: 'eyJ...'
```

---

## Step 2: Create Stripe Account

1. Go to [stripe.com](https://stripe.com) and create an account
2. Complete business verification when ready (can use test mode initially)
3. Go to **Developers > API keys**
4. Copy your **Publishable key** (starts with `pk_test_` or `pk_live_`)

5. Update `js/config.js`:
```javascript
STRIPE_PUBLISHABLE_KEY: 'pk_test_...'
```

### Stripe Checkout Setup

For Stripe Checkout to work, you'll need to create a webhook endpoint. I recommend using Vercel serverless functions:

1. Create `api/create-checkout.js` (I can create this for you)
2. Configure webhook in Stripe dashboard to point to your domain

---

## Step 3: Shipping Integration (Shippo)

1. Go to [goshippo.com](https://goshippo.com) and create a free account
2. Go to **Settings > API** and copy your API token
3. Connect your shipping carriers (Canada Post, USPS, etc.)

For now, the site uses flat-rate $25 shipping. To enable auto-calculated rates and label generation, let me know and I'll add the Shippo integration.

---

## Step 4: Email Notifications (Resend)

1. Go to [resend.com](https://resend.com) and create a free account
2. Add your domain (or use their test domain for development)
3. Copy your API key

Emails to set up:
- **Order confirmation** → sent to customer
- **New order notification** → sent to hello@protogolf.com
- **Shipping confirmation** → sent when tracking number added

---

## Admin Dashboard

Access: `yourdomain.com/admin/dashboard.html`
Password: `proto2026` (change this in the code before going live!)

### Features:
- **Overview**: Quick stats and recent orders
- **Orders**: View all orders, print order forms, export CSV
- **Inventory**: Adjust stock levels per product model
- **Analytics**: Page views, cart activity, conversion funnel

### Inventory Rules:
- Stock = 1 → Shows "Sold Out" on website
- Stock = 0 → Product hidden from shop
- Stock is per model (Rough Mill, Centre Blade), not per variant (finish/shaft color)

---

## File Structure

```
proto-golf-site/
├── admin/
│   └── dashboard.html    # Admin dashboard
├── js/
│   ├── config.js         # Configuration (add your API keys here)
│   ├── cart.js           # Cart functionality
│   └── analytics.js      # Analytics tracking
├── products/
│   ├── rough-mill.html
│   ├── centre-blade.html
│   └── long-neck-blade.html
├── checkout.html         # Checkout page
├── order-confirmation.html
├── supabase-schema.sql   # Database schema to run in Supabase
└── SETUP-GUIDE.md        # This file
```

---

## Testing Checklist

### Before going live:

- [ ] Create Supabase project and run schema
- [ ] Add Supabase credentials to config.js
- [ ] Create Stripe account and add publishable key
- [ ] Test checkout flow with Stripe test cards
- [ ] Change admin password from `proto2026`
- [ ] Set up email notifications
- [ ] Test on mobile devices
- [ ] Set real inventory counts in admin dashboard

### Stripe Test Cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires Auth: `4000 0025 0000 3155`

---

## Need Help?

Contact: (your developer contact info)

### Common Issues:

**Cart not persisting?**
- Check if localStorage is blocked (private browsing)

**Checkout not working?**
- Ensure Stripe key is set in config.js
- Check browser console for errors

**Orders not appearing in dashboard?**
- Ensure Supabase is connected
- Check RLS policies are correct

---

## Security Notes

1. **Never commit API keys** to git. Use environment variables in production.
2. **Change the admin password** before going live.
3. **Enable Supabase RLS** (Row Level Security) - already configured in schema.
4. **Use HTTPS** - Vercel handles this automatically.
