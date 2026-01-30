// Proto Golf — Dynamic Product Page Logic
// Loads product, variants, and images from Supabase

const SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODk3MTgsImV4cCI6MjA4MzM2NTcxOH0.DcLpWs8Lf1s4Flf54J5LubokSYrd7h-XvI_X0jj6bLM';

// State
let product = null;
let variants = [];
let dbImages = {};
let currentGallery = [];
let selectedFinish = null;
let selectedShaft = null;
let selectedShipping = { type: 'shipping', price: 25 };
let cart = JSON.parse(localStorage.getItem('proto_cart')) || [];

// Supabase fetch helper
async function sbFetch(table, query) {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
        headers: { 'apikey': SUPABASE_KEY }
    });
    return resp.json();
}

// Get product ID from URL
function getProductId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// Initialize the page
async function initProductPage() {
    const productId = getProductId();
    if (!productId) {
        document.getElementById('productPageContent').innerHTML =
            '<div style="text-align:center;padding:80px 20px;"><h2>Product not found</h2><p><a href="../shop.html">Back to shop</a></p></div>';
        return;
    }

    try {
        // Fetch product, variants, and images in parallel
        const [productData, variantData, imageData] = await Promise.all([
            sbFetch('proto_golf_products', `?id=eq.${encodeURIComponent(productId)}&limit=1`),
            sbFetch('proto_golf_variants', `?product_id=eq.${encodeURIComponent(productId)}&order=sort_order`),
            sbFetch('proto_golf_product_images', `?product_id=eq.${encodeURIComponent(productId)}&order=sort_order`)
        ]);

        if (!productData || productData.length === 0) {
            document.getElementById('productPageContent').innerHTML =
                '<div style="text-align:center;padding:80px 20px;"><h2>Product not found</h2><p><a href="../shop.html">Back to shop</a></p></div>';
            return;
        }

        product = productData[0];
        variants = variantData || [];

        // Group images by variant_key
        if (Array.isArray(imageData)) {
            imageData.forEach(img => {
                if (!dbImages[img.variant_key]) dbImages[img.variant_key] = [];
                dbImages[img.variant_key].push(img.image_url);
            });
        }

        // Set defaults from is_default variant or first variant
        const defaultVariant = variants.find(v => v.is_default) || variants[0];
        if (defaultVariant) {
            selectedFinish = { name: defaultVariant.finish_name, price: parseFloat(defaultVariant.price_addon) || 0 };
            selectedShaft = defaultVariant.shaft_color;
        } else {
            selectedFinish = { name: 'Default', price: 0 };
            selectedShaft = 'Chrome';
        }

        // Set page title
        document.title = `${product.name} Putter | Proto Golf`;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.content = product.short_description || product.description || '';

        // Render
        renderProduct();
        updatePrice();
        updateGallery();
        updateCartUI();

        // Track analytics
        if (window.analytics) {
            window.analytics.trackProductView(productId);
        }
    } catch (e) {
        console.error('Failed to load product:', e);
        document.getElementById('productPageContent').innerHTML =
            '<div style="text-align:center;padding:80px 20px;"><h2>Failed to load product</h2><p><a href="../shop.html">Back to shop</a></p></div>';
    }
}

function renderProduct() {
    const specs = product.specs || {};
    const isComingSoon = product.status === 'coming_soon';
    const heroImg = product.hero_image
        ? (product.hero_image.startsWith('http') ? product.hero_image : `../${product.hero_image}`)
        : '../assets/putters/polished-rough-mill-1.png';

    // Get unique finishes and shafts from variants
    const finishes = [];
    const finishSeen = new Set();
    variants.forEach(v => {
        if (!finishSeen.has(v.finish_name)) {
            finishSeen.add(v.finish_name);
            finishes.push({ name: v.finish_name, price: parseFloat(v.price_addon) || 0 });
        }
    });

    const shafts = [];
    const shaftSeen = new Set();
    variants.forEach(v => {
        if (!shaftSeen.has(v.shaft_color)) {
            shaftSeen.add(v.shaft_color);
            shafts.push(v.shaft_color);
        }
    });

    // Build specs HTML
    const specLabels = {
        headWeight: 'Head Weight',
        shaftWeight: 'Shaft Weight',
        lie: 'Lie Angle',
        loft: 'Loft',
        length: 'Length',
        grip: 'Grip',
        finish: 'Finish',
        paintFill: 'Paint Fill',
        feature: 'Feature'
    };

    let specsHtml = '';
    // Always show material first
    if (product.material) {
        specsHtml += `<div class="spec-row"><span class="spec-label">Material</span><span class="spec-value">${escapeHtml(product.material)} CNC milled</span></div>`;
    }
    for (const [key, label] of Object.entries(specLabels)) {
        if (specs[key]) {
            specsHtml += `<div class="spec-row"><span class="spec-label">${label}</span><span class="spec-value">${escapeHtml(specs[key])}</span></div>`;
        }
    }

    // Build finish buttons
    let finishButtonsHtml = finishes.map(f => {
        const isSelected = f.name === selectedFinish.name;
        const priceLabel = f.price > 0 ? ` (+$${f.price})` : '';
        return `<button class="variant-btn${isSelected ? ' selected' : ''}" onclick="selectFinish(this, '${escapeAttr(f.name)}', ${f.price})">${escapeHtml(f.name)}${priceLabel}</button>`;
    }).join('');

    // Build shaft buttons
    let shaftButtonsHtml = shafts.map(s => {
        const isSelected = s === selectedShaft;
        return `<button class="variant-btn${isSelected ? ' selected' : ''}" onclick="selectShaft(this, '${escapeAttr(s)}')">${escapeHtml(s)}</button>`;
    }).join('');

    // Build main content
    const content = document.getElementById('productPageContent');
    content.innerHTML = `
        <div class="product-page-grid">
            <!-- Gallery -->
            <div class="product-gallery">
                <div class="product-main-image" id="mainImage">
                    <img src="${heroImg}" alt="${escapeAttr(product.name)} Putter" id="mainImg">
                </div>
                <div class="product-thumbnails" id="thumbnails"></div>
            </div>

            <!-- Details -->
            <div class="product-details">
                <div class="product-brand">Proto Golf</div>
                <h1>${escapeHtml(product.name)}</h1>
                <div class="product-page-price" id="productPrice">$${product.base_price}</div>

                <p class="product-description">${escapeHtml(product.description || '')}</p>

                <!-- Specs -->
                <div class="modal-specs">
                    <h4>Specifications</h4>
                    ${specsHtml}
                </div>

                ${!isComingSoon && finishes.length > 0 ? `
                <!-- Variants -->
                <div class="product-variants">
                    ${finishes.length > 0 ? `
                    <div class="variant-group">
                        <span class="variant-label">Head Finish</span>
                        <div class="variant-options" id="finishOptions">${finishButtonsHtml}</div>
                    </div>` : ''}

                    ${shafts.length > 0 ? `
                    <div class="variant-group">
                        <span class="variant-label">Shaft Color</span>
                        <div class="variant-options" id="shaftOptions">${shaftButtonsHtml}</div>
                    </div>` : ''}
                </div>` : ''}

                <!-- Stock Status -->
                <div class="product-stock${isComingSoon ? ' out' : ''}" id="stockStatus">
                    ${isComingSoon ? 'Coming Soon - Sign up for notifications' : ''}
                </div>

                ${isComingSoon ? `
                <!-- Notify Form -->
                <div class="variant-group mt-3">
                    <span class="variant-label">Get Notified</span>
                    <div class="form-row">
                        <input type="email" class="form-input" placeholder="Enter your email" id="notifyEmail">
                    </div>
                    <button class="btn btn-primary mt-2" style="width: 100%;" onclick="notifyMe()">
                        Notify Me When Available
                    </button>
                </div>
                <p class="text-muted mt-3" style="font-size: 0.875rem;">
                    We'll send you a one-time email when the ${escapeHtml(product.name)} becomes available. No spam.
                </p>` : `
                <!-- Shipping Options -->
                <div class="shipping-options">
                    <span class="variant-label">Delivery Method</span>
                    <div class="shipping-option selected" onclick="selectShipping(this, 'shipping', 25)">
                        <input type="radio" name="shipping" checked>
                        <div class="shipping-radio"></div>
                        <div class="shipping-info">
                            <h4>Standard Shipping</h4>
                            <p>5-7 business days</p>
                        </div>
                        <span class="shipping-price">$25</span>
                    </div>
                    <div class="shipping-option" onclick="selectShipping(this, 'pickup', 0)">
                        <input type="radio" name="shipping">
                        <div class="shipping-radio"></div>
                        <div class="shipping-info">
                            <h4>Local Pickup</h4>
                            <p>Cambridge, ON - Schedule appointment</p>
                        </div>
                        <span class="shipping-price">Free</span>
                    </div>
                </div>

                <!-- Actions -->
                <div class="product-actions">
                    <button class="btn btn-primary btn-lg" id="addToCartBtn" onclick="addToCart()">
                        Add to Cart - <span id="totalPrice">$0</span>
                    </button>
                </div>`}
            </div>
        </div>
    `;

    // Update stock status for non-coming-soon products
    if (!isComingSoon) {
        updateStockStatus();
    }
}

function updateGallery() {
    const key = selectedFinish.name + '|' + selectedShaft;
    currentGallery = dbImages[key] || [];

    const mainImg = document.getElementById('mainImg');
    const thumbContainer = document.getElementById('thumbnails');

    if (currentGallery.length === 0) {
        // Show placeholder when no images exist for this variant
        if (mainImg) {
            mainImg.style.display = 'none';
            let placeholder = document.getElementById('noImagePlaceholder');
            if (!placeholder) {
                placeholder = document.createElement('div');
                placeholder.id = 'noImagePlaceholder';
                placeholder.style.cssText = 'width:100%;aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#1a1a1a;border:2px dashed #333;border-radius:12px;color:#666;font-family:inherit;';
                placeholder.innerHTML = `
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:12px">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span style="font-size:14px;font-weight:600;color:#555">No images for this variant</span>
                    <span style="font-size:12px;color:#444;margin-top:4px">${selectedFinish.name} · ${selectedShaft}</span>
                `;
                mainImg.parentNode.insertBefore(placeholder, mainImg);
            } else {
                placeholder.style.display = 'flex';
                placeholder.querySelector('span:last-child').textContent = `${selectedFinish.name} · ${selectedShaft}`;
            }
        }
        if (thumbContainer) thumbContainer.innerHTML = '';
        return;
    }

    // Has images — hide placeholder, show main image
    if (mainImg) {
        mainImg.style.display = '';
        const placeholder = document.getElementById('noImagePlaceholder');
        if (placeholder) placeholder.style.display = 'none';
        mainImg.src = currentGallery[0];
    }

    if (thumbContainer) {
        thumbContainer.innerHTML = currentGallery.map((src, i) =>
            `<div class="product-thumbnail${i === 0 ? ' active' : ''}" onclick="selectThumb(this, ${i})" style="background: url('${src}') center/cover;"></div>`
        ).join('');
    }
}

function selectFinish(btn, name, price) {
    document.querySelectorAll('#finishOptions .variant-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedFinish = { name, price };
    updatePrice();
    updateGallery();
}

function selectShaft(btn, shaft) {
    document.querySelectorAll('#shaftOptions .variant-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedShaft = shaft;
    updatePrice();
    updateGallery();
}

function selectShipping(el, type, price) {
    document.querySelectorAll('.shipping-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    selectedShipping = { type, price };
    updatePrice();
}

function selectThumb(thumb, index) {
    document.querySelectorAll('.product-thumbnail').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
    const mainImg = document.getElementById('mainImg');
    if (mainImg && currentGallery[index]) mainImg.src = currentGallery[index];
}

function updatePrice() {
    if (!product) return;
    const basePrice = parseFloat(product.base_price);
    const finishPrice = selectedFinish ? selectedFinish.price : 0;
    const productPrice = basePrice + finishPrice;
    const total = productPrice + selectedShipping.price;

    const priceEl = document.getElementById('productPrice');
    if (priceEl) priceEl.textContent = '$' + productPrice;

    const totalEl = document.getElementById('totalPrice');
    if (totalEl) totalEl.textContent = '$' + total;
}

function updateStockStatus() {
    const stockEl = document.getElementById('stockStatus');
    const addBtn = document.getElementById('addToCartBtn');
    if (!stockEl || !product) return;

    if (product.stock <= 0) {
        stockEl.textContent = 'Sold Out';
        stockEl.classList.add('out');
        if (addBtn) {
            addBtn.disabled = true;
            addBtn.textContent = 'Sold Out';
        }
    } else if (product.stock <= 5) {
        stockEl.textContent = `Low Stock - Only ${product.stock} left`;
        stockEl.classList.add('low');
    } else {
        stockEl.textContent = `In Stock - ${product.stock} units available`;
    }
}

function addToCart() {
    if (!product || product.stock <= 0) return;

    const item = {
        id: product.id,
        name: product.name,
        price: parseFloat(product.base_price) + (selectedFinish ? selectedFinish.price : 0),
        icon: product.icon || product.name.charAt(0),
        options: {
            finish: selectedFinish ? selectedFinish.name : '',
            shaft: selectedShaft || '',
            shipping: selectedShipping.type
        },
        shippingCost: selectedShipping.price
    };

    cart.push(item);
    saveCart();
    updateCartUI();
    openCart();
    showToast(`${product.name} added to cart!`);

    if (window.analytics) {
        window.analytics.trackAddToCart(product.id, item.options.finish, item.options.shaft, item.price);
    }
}

function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart();
    updateCartUI();
}

function saveCart() {
    localStorage.setItem('proto_cart', JSON.stringify(cart));
}

function updateCartUI() {
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    const cartCountNav = document.getElementById('cartCountNav');

    if (!cartItems) return;

    if (cart.length === 0) {
        cartItems.innerHTML = '<div class="cart-empty">Your cart is empty</div>';
    } else {
        cartItems.innerHTML = cart.map((item, index) => `
            <div class="cart-item">
                <div class="cart-item-image">${item.icon || item.name.charAt(0)}</div>
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-options">
                        ${item.options ? `${item.options.finish} / ${item.options.shaft} shaft` : ''}
                    </div>
                    <div class="cart-item-price">$${item.price}</div>
                </div>
                <button class="cart-item-remove" onclick="removeFromCart(${index})">X</button>
            </div>
        `).join('');
    }

    const subtotal = cart.reduce((sum, item) => sum + item.price, 0);
    const shipping = cart.length > 0 ? cart[cart.length - 1].shippingCost : 0;
    if (cartTotal) cartTotal.textContent = '$' + (subtotal + shipping);
    if (cartCountNav) cartCountNav.textContent = cart.length;
}

function openCart() {
    document.getElementById('cartSidebar').classList.add('open');
    document.getElementById('cartBackdrop').classList.add('open');
}

function closeCart() {
    document.getElementById('cartSidebar').classList.remove('open');
    document.getElementById('cartBackdrop').classList.remove('open');
}

function proceedToCheckout() {
    if (cart.length === 0) {
        showToast('Your cart is empty');
        return;
    }

    const newCart = cart.map(item => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        productId: item.id,
        productName: item.name,
        finish: item.options.finish.toLowerCase().replace(/ /g, '-'),
        finishName: item.options.finish,
        shaftColor: item.options.shaft.toLowerCase(),
        shaftColorName: item.options.shaft,
        price: item.price,
        quantity: 1
    }));

    localStorage.setItem('proto_golf_cart', JSON.stringify(newCart));
    window.location.href = '../checkout.html';
}

function notifyMe() {
    const email = document.getElementById('notifyEmail').value;
    if (!email || !email.includes('@')) {
        showToast('Please enter a valid email address');
        return;
    }
    showToast('Thank you! We\'ll notify you when it\'s available.');
    document.getElementById('notifyEmail').value = '';
}

function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function toggleNav() {
    const navLinks = document.getElementById('navLinks');
    const navIcon = document.getElementById('navIcon');
    navLinks.classList.toggle('open');
    navIcon.innerHTML = navLinks.classList.contains('open') ? '&times;' : '&#9776;';
}

// Escape helpers
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// Init on DOM ready
document.addEventListener('DOMContentLoaded', initProductPage);

// Close cart on escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCart();
});
