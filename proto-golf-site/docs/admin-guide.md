# Proto Golf Admin Guide

## Accessing the Dashboard

1. Go to: `[your-site]/admin/dashboard.html`
2. Enter password: `protogolf2026`
3. You're in!

---

## Dashboard Overview

### Stats Panel
Shows at-a-glance metrics:
- **Total Orders**: All orders placed
- **Revenue**: Total sales amount
- **Inventory**: Products currently in stock

---

## Managing Inventory

### Viewing Stock Levels
1. Click the **Inventory** tab
2. You'll see each product with its current stock count

### Updating Stock
1. Change the number in the input field
2. Click **Save Changes**
3. The website will immediately reflect the new count

### How "Sold Out" Works
- When inventory reaches **1 or below**, the product shows "Sold Out"
- The "Add to Cart" button becomes disabled
- Customers can't purchase until you add more stock

### After Making a Putter
When you complete a new putter:
1. Go to Inventory tab
2. Increase the count for that model
3. Save changes
4. It's now available for purchase!

---

## Managing Orders

### Viewing Orders
1. Click the **Orders** tab
2. Orders are listed newest first
3. Each order shows:
   - Order number (e.g., PG-260127-A1B2)
   - Customer name and email
   - Items ordered with options
   - Total amount
   - Delivery method (Shipping or Pickup)
   - Status

### Order Statuses
- **Pending**: Just placed, awaiting processing
- **Confirmed**: Payment received
- **Shipped**: On its way (shipping orders)
- **Ready**: Ready for pickup (pickup orders)
- **Completed**: Delivered/picked up

### What to Do When an Order Comes In
1. Check the order details in admin
2. Note the finish and shaft color selected
3. Verify inventory and deduct 1 from stock
4. Build/prepare the putter
5. If shipping: Ship and update status
6. If pickup: Contact customer to schedule, update status

---

## Order Information Details

Each order includes:
- **Customer**: Name, email, phone
- **Items**: Product, finish, shaft color, price
- **Delivery**: Shipping address OR pickup date/time
- **Payment**: Total paid (subtotal + shipping + HST)

---

## Database (Supabase)

Your data is stored in Supabase. You can access it directly at:
`https://supabase.com/dashboard/project/rdsmdywbdiskxknluiym`

### Tables
- `proto_golf_products`: Product info and inventory counts
- `proto_golf_orders`: All customer orders
- `proto_golf_analytics`: Page views and events

---

## Security Notes

- The admin password is basic protection
- For production, consider adding proper authentication
- Never share Supabase credentials publicly
- Change the admin password periodically

---

## Need Help?

Contact your developer with:
- Screenshots of any issues
- Steps to reproduce the problem
- Order numbers if relevant
