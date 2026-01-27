# Proto Golf Website Testing Guide

Welcome to the Proto Golf website testing guide. This document walks you through testing all the key features of your new e-commerce site.

---

## Quick Links

- **Live Site**: [Your Vercel URL]
- **Admin Dashboard**: [Your Vercel URL]/admin/dashboard.html
- **Admin Password**: (contact admin for password)

---

## Test 1: Browse Products

### Steps:
1. Go to the homepage
2. Scroll down to see the product lineup
3. Click on any product card to go to its detail page
4. Try clicking "Shop" in the navigation to see all products

### What to verify:
- [ ] Homepage loads with hero image and product cards
- [ ] Navigation works on all pages
- [ ] Product cards show correct names and prices
- [ ] Mobile menu works on smaller screens

---

## Test 2: Product Page & Variants

### Steps:
1. Go to the **Rough Mill** product page
2. Try selecting different finishes:
   - Raw (base price)
   - Brushed (+$50)
   - Black DLC (+$100)
   - Chrome (+$75)
3. Try selecting different shaft colors (Chrome or Black)
4. Watch the price update as you select options

### What to verify:
- [ ] Price updates correctly when changing finishes
- [ ] Selected options are highlighted
- [ ] "Add to Cart" button shows the total price (product + shipping)
- [ ] Stock status shows "In Stock - X units available"

---

## Test 3: Shopping Cart

### Steps:
1. On any product page, click "Add to Cart"
2. The cart sidebar should slide open
3. Add another item (or the same item with different options)
4. Try removing an item by clicking the X

### What to verify:
- [ ] Cart opens when adding items
- [ ] Items show correct name, options, and price
- [ ] Cart total calculates correctly
- [ ] Items can be removed
- [ ] Cart persists if you refresh the page

---

## Test 4: Checkout Flow

### Steps:
1. Add at least one item to your cart
2. Click "Checkout" in the cart
3. Fill in your customer information:
   - Name: Test Customer
   - Email: your-email@example.com
   - Phone: 555-555-5555
4. Select delivery method:
   - **Shipping**: Enter an address
   - **Pickup**: Select a date/time
5. Review your order summary
6. Click "Proceed to Payment"

### What to verify:
- [ ] Form validates required fields
- [ ] Shipping address fields appear when "Shipping" is selected
- [ ] Pickup calendar appears when "Pickup" is selected
- [ ] Order summary shows correct items and totals
- [ ] HST (13%) calculates correctly
- [ ] Total = Subtotal + Shipping + HST

**Note**: Payment is currently in test mode. Use these test card numbers:
- **Success**: 4242 4242 4242 4242
- **Declined**: 4000 0000 0000 0002
- Use any future date and any 3-digit CVC

---

## Test 5: Admin Dashboard

### Steps:
1. Go to `/admin/dashboard.html`
2. Enter password: (contact admin for password)
3. Review the dashboard sections:
   - **Overview**: Quick stats
   - **Inventory**: Current stock levels
   - **Orders**: Recent orders

### What to verify:
- [ ] Dashboard loads after correct password
- [ ] Inventory shows all 3 products with stock levels
- [ ] Orders tab shows any test orders you placed

### Try updating inventory:
1. Change the stock number for Rough Mill
2. Click "Save Changes"
3. Refresh the page to confirm it saved

---

## Test 6: Mobile Experience

### Steps:
1. Open the site on your phone (or resize browser window)
2. Test the hamburger menu
3. Browse to a product page
4. Try adding to cart and checking out

### What to verify:
- [ ] Navigation collapses to hamburger menu
- [ ] Product images and content resize properly
- [ ] Cart sidebar works on mobile
- [ ] Checkout form is usable on small screens

---

## Test 7: Special Pages

### FAQ Page
1. Go to `/faq.html`
2. Click on different questions to expand/collapse answers
3. Verify the content is accurate

### Limited Edition Page
1. Go to `/limited.html`
2. Review the page layout
3. (Currently a placeholder - we can add content later)

### Contact Page
1. Go to `/contact.html`
2. Verify Instagram link goes to @golfproto
3. Try submitting the contact form

### About Page
1. Go to `/about.html`
2. Review company/manufacturing info

---

## Reporting Issues

When you find something that doesn't work or looks wrong, please note:

1. **What page** you were on
2. **What you clicked or did**
3. **What you expected** to happen
4. **What actually happened**
5. **Screenshot** if possible

---

## Questions?

Contact us with any questions about testing or the website features.
