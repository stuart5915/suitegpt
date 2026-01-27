// Proto Golf Cart System
// Handles cart state, persistence, and UI

class Cart {
    constructor() {
        this.items = [];
        this.load();
    }

    // Load cart from localStorage
    load() {
        try {
            const saved = localStorage.getItem('proto_golf_cart');
            if (saved) {
                this.items = JSON.parse(saved);
            }
        } catch (e) {
            console.error('Failed to load cart:', e);
            this.items = [];
        }
    }

    // Save cart to localStorage
    save() {
        try {
            localStorage.setItem('proto_golf_cart', JSON.stringify(this.items));
            this.updateUI();
        } catch (e) {
            console.error('Failed to save cart:', e);
        }
    }

    // Add item to cart
    add(item) {
        // Check if same product with same options exists
        const existingIndex = this.items.findIndex(i =>
            i.productId === item.productId &&
            i.finish === item.finish &&
            i.shaftColor === item.shaftColor
        );

        if (existingIndex > -1) {
            // Update quantity
            this.items[existingIndex].quantity += item.quantity || 1;
        } else {
            // Add new item
            this.items.push({
                id: Date.now().toString(),
                productId: item.productId,
                productName: item.productName,
                finish: item.finish,
                finishName: item.finishName,
                shaftColor: item.shaftColor,
                shaftColorName: item.shaftColorName,
                price: item.price,
                quantity: item.quantity || 1,
                addedAt: new Date().toISOString()
            });
        }

        this.save();
        this.showNotification(`${item.productName} added to cart`);

        // Track analytics
        if (window.analytics) {
            window.analytics.track('add_to_cart', {
                product_id: item.productId,
                finish: item.finish,
                shaft_color: item.shaftColor,
                price: item.price
            });
        }
    }

    // Remove item from cart
    remove(itemId) {
        this.items = this.items.filter(i => i.id !== itemId);
        this.save();
    }

    // Update item quantity
    updateQuantity(itemId, quantity) {
        const item = this.items.find(i => i.id === itemId);
        if (item) {
            if (quantity <= 0) {
                this.remove(itemId);
            } else {
                item.quantity = quantity;
                this.save();
            }
        }
    }

    // Clear cart
    clear() {
        this.items = [];
        this.save();
    }

    // Get cart totals
    getTotals() {
        const subtotal = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const itemCount = this.items.reduce((sum, item) => sum + item.quantity, 0);

        return {
            subtotal,
            itemCount,
            shipping: 0, // Calculated at checkout
            tax: 0, // Calculated at checkout
            total: subtotal
        };
    }

    // Update cart UI (badge count, etc.)
    updateUI() {
        const totals = this.getTotals();

        // Update cart badges
        document.querySelectorAll('.cart-badge').forEach(badge => {
            badge.textContent = totals.itemCount;
            badge.style.display = totals.itemCount > 0 ? 'flex' : 'none';
        });

        // Update cart icon in nav if exists
        const cartIcon = document.getElementById('cartIcon');
        if (cartIcon) {
            cartIcon.dataset.count = totals.itemCount;
        }
    }

    // Show notification toast
    showNotification(message) {
        // Remove existing toast
        const existing = document.querySelector('.cart-toast');
        if (existing) existing.remove();

        // Create toast
        const toast = document.createElement('div');
        toast.className = 'cart-toast';
        toast.innerHTML = `
            <span>${message}</span>
            <a href="checkout.html" class="toast-link">View Cart</a>
        `;

        document.body.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Remove after delay
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Check if cart is empty
    isEmpty() {
        return this.items.length === 0;
    }
}

// Create global cart instance
window.cart = new Cart();

// Initialize cart UI on page load
document.addEventListener('DOMContentLoaded', () => {
    window.cart.updateUI();
});
