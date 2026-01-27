# Proto Golf - Quick Start Guide

## 5-Minute Test Walkthrough

### 1. Place a Test Order (2 min)

1. Go to your site homepage
2. Click on **Rough Mill** product
3. Select "Black DLC" finish (+$100)
4. Click **Add to Cart**
5. Click **Checkout**
6. Fill in test info:
   - Name: `Test Order`
   - Email: `test@protogolf.com`
   - Phone: `519-555-1234`
7. Select **Shipping** and enter any address
8. Click **Proceed to Payment**
9. Use test card: `4242 4242 4242 4242` (any future date, any CVC)
10. Complete payment

### 2. Check Admin Dashboard (1 min)

1. Go to `/admin/dashboard.html`
2. Password: (contact admin)
3. Click **Orders** tab
4. You should see your test order!

### 3. Update Inventory (1 min)

1. In the dashboard, click **Inventory** tab
2. Change Rough Mill stock to `19`
3. Click **Save Changes**
4. Refresh page - it should still show `19`

### 4. Test "Sold Out" (1 min)

1. Set any product's inventory to `1`
2. Save changes
3. Go to that product page
4. It should show **"Sold Out"** and button disabled

---

## Key Info

| Item | Value |
|------|-------|
| Admin URL | `/admin/dashboard.html` |
| Admin Password | (contact admin) |
| Test Card | `4242 4242 4242 4242` |
| Shipping Cost | $25 flat rate |
| HST Rate | 13% (Ontario) |

---

## What's Working

- [x] Product browsing & variants
- [x] Shopping cart
- [x] Checkout with Stripe (test mode)
- [x] Admin inventory management
- [x] Order tracking in admin
- [x] Analytics (page views, cart, purchases)
- [x] Mobile responsive

## What's Needed From You

- [ ] Stripe account (for live payments)
- [ ] Real product photos (optional)
- [ ] FAQ content
- [ ] Any pricing changes
