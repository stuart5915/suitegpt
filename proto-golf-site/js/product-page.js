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
let selectedShaftLength = { length: '34', price: 0 }; // Default 34", no upcharge
let selectedShipping = { type: 'shipping', price: 25 };
let cart = JSON.parse(localStorage.getItem('proto_cart')) || [];

// Shaft length options (30" to 39" in 0.5" increments)
const SHAFT_LENGTHS = [];
for (let i = 30; i <= 39; i += 0.5) {
    const lengthStr = i % 1 === 0 ? i.toString() : i.toFixed(1);
    const upcharge = i >= 36.5 ? 15 : 0;
    SHAFT_LENGTHS.push({ length: lengthStr, price: upcharge });
}

// Long Neck Blade specific state
let isLongNeckBlade = false;
let faceMills = [];
let headFinishes = [];
let hoselOptions = [];
let shaftOptions = [];
let selectedFaceMill = null;
let selectedHeadFinish = null;
let selectedHosel = null;
let selectedLNBShaft = null;

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

    // Check if this is Long Neck Blade - it has special options
    isLongNeckBlade = productId === 'long-neck-blade';

    try {
        if (isLongNeckBlade) {
            // Long Neck Blade: Fetch from shared inventory table
            const [productData, sharedInventoryData, imageData] = await Promise.all([
                sbFetch('proto_golf_products', `?id=eq.${encodeURIComponent(productId)}&limit=1`),
                sbFetch('proto_golf_shared_inventory', `?order=item_type,sort_order`),
                sbFetch('proto_golf_product_images', `?product_id=eq.${encodeURIComponent(productId)}&order=sort_order`)
            ]);

            if (!productData || productData.length === 0) {
                document.getElementById('productPageContent').innerHTML =
                    '<div style="text-align:center;padding:80px 20px;"><h2>Product not found</h2><p><a href="../shop.html">Back to shop</a></p></div>';
                return;
            }

            product = productData[0];

            // Parse shared inventory into separate arrays
            const inventory = sharedInventoryData || [];
            faceMills = inventory
                .filter(i => i.item_type === 'longneck_head')
                .map(i => ({ pattern_name: i.item_name, base_price: 110, stock: i.stock || 0 }));
            // Build hosel options - add "Stainless + Black Oxide" as a variant
            const rawHosels = inventory.filter(i => i.item_type === 'hosel');
            hoselOptions = [];
            rawHosels.forEach(i => {
                hoselOptions.push({ hosel_name: i.item_name, price_addon: parseFloat(i.price_addon) || 0, stock: i.stock || 0 });
                // Add Black Oxide variant for Stainless
                if (i.item_name === 'Stainless') {
                    hoselOptions.push({ hosel_name: 'Stainless + Black Oxide', price_addon: 25, stock: i.stock || 0 });
                }
            });
            shaftOptions = inventory
                .filter(i => i.item_type === 'shaft')
                .map(i => ({ shaft_name: i.item_name, price_addon: parseFloat(i.price_addon) || 0, stock: i.stock || 0 }));

            // Head finishes are fixed options (no inventory tracking)
            headFinishes = [
                { finish_name: 'Black Oxide', price_addon: 0 },
                { finish_name: 'Brushed Stainless', price_addon: 0 }
            ];

            // Group images by variant_key
            if (Array.isArray(imageData)) {
                imageData.forEach(img => {
                    if (!dbImages[img.variant_key]) dbImages[img.variant_key] = [];
                    dbImages[img.variant_key].push(img.image_url);
                });
            }

            // Set defaults (prefer items with stock)
            const availableFaceMills = faceMills.filter(fm => fm.stock > 0);
            selectedFaceMill = availableFaceMills[0] || faceMills[0] || { pattern_name: 'Squiggle', base_price: 110, stock: 0 };
            selectedHeadFinish = headFinishes[0] || { finish_name: 'Black Oxide', price_addon: 0 };
            const availableHosels = hoselOptions.filter(h => h.stock > 0);
            selectedHosel = availableHosels[0] || hoselOptions[0] || { hosel_name: 'Stainless', price_addon: 0 };
            const availableShafts = shaftOptions.filter(s => s.stock > 0);
            selectedLNBShaft = availableShafts[0] || shaftOptions[0] || { shaft_name: 'Chrome', price_addon: 0 };

        } else {
            // Standard product: Fetch variants
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
                selectedShaft = { name: defaultVariant.shaft_color, price: parseFloat(defaultVariant.shaft_price_addon) || 0 };
            } else {
                selectedFinish = { name: 'Default', price: 0 };
                selectedShaft = { name: 'Chrome', price: 0 };
            }
        }

        // Set page title
        document.title = `${product.name} Putter | Proto Golf`;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.content = product.short_description || product.description || '';

        // Render
        if (isLongNeckBlade) {
            renderLongNeckBlade();
            updateLNBPrice();
        } else {
            renderProduct();
            updatePrice();
            updateGallery();
        }
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
            shafts.push({ name: v.shaft_color, price: parseFloat(v.shaft_price_addon) || 0 });
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
        const isSelected = s.name === selectedShaft.name;
        const priceLabel = s.price > 0 ? ` (+$${s.price})` : '';
        return `<button class="variant-btn${isSelected ? ' selected' : ''}" onclick="selectShaft(this, '${escapeAttr(s.name)}', ${s.price})">${escapeHtml(s.name)}${priceLabel}</button>`;
    }).join('');

    // Build shaft length dropdown
    let shaftLengthHtml = `<select class="form-input" id="shaftLengthSelect" onchange="selectShaftLength(this.value)" style="max-width: 200px;">`;
    SHAFT_LENGTHS.forEach(sl => {
        const selected = sl.length === selectedShaftLength.length ? ' selected' : '';
        const priceLabel = sl.price > 0 ? ` (+$${sl.price})` : '';
        shaftLengthHtml += `<option value="${sl.length}"${selected}>${sl.length}"${priceLabel}</option>`;
    });
    shaftLengthHtml += '</select>';

    // Build main content
    const content = document.getElementById('productPageContent');
    content.innerHTML = `
        <div class="product-page-grid">
            <!-- Gallery (carousel) -->
            <div class="product-gallery">
                <div class="product-carousel" id="productCarousel">
                    <div class="product-main-image" id="mainImage">
                        <img src="${heroImg}" alt="${escapeAttr(product.name)} Putter" id="mainImg">
                    </div>
                    <button class="carousel-arrow carousel-prev" id="carouselPrev" onclick="prevImage()">&lsaquo;</button>
                    <button class="carousel-arrow carousel-next" id="carouselNext" onclick="nextImage()">&rsaquo;</button>
                </div>
                <div class="carousel-dots" id="carouselDots"></div>

                ${specsHtml ? `
                <div class="modal-specs">
                    <h4>Specifications</h4>
                    ${specsHtml}
                </div>` : ''}
            </div>

            <!-- Details -->
            <div class="product-details">
                <div class="product-brand">Proto Golf</div>
                <h1>${escapeHtml(product.name)}</h1>
                <div class="product-page-price" id="productPrice">$${product.base_price}</div>

                <p class="product-description">${escapeHtml(product.description || '')}</p>

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

                    <div class="variant-group">
                        <span class="variant-label">Shaft Length</span>
                        ${shaftLengthHtml}
                        <span style="font-size: 0.75rem; color: #888; margin-top: 4px; display: block;">Standard: 30"-36" · Extended 36.5"+ adds $15</span>
                    </div>
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

// ============================================
// LONG NECK BLADE SPECIFIC FUNCTIONS
// ============================================

function renderLongNeckBlade() {
    const specs = product.specs || {};
    const heroImg = product.hero_image
        ? (product.hero_image.startsWith('http') ? product.hero_image : `../${product.hero_image}`)
        : '../assets/putters/stainless-long-neck-blade-1.png';

    // Build specs HTML
    const specLabels = {
        headWeight: 'Head Weight',
        shaftWeight: 'Shaft Weight',
        lie: 'Lie Angle',
        loft: 'Loft',
        length: 'Length',
        grip: 'Grip',
        feature: 'Feature'
    };

    let specsHtml = '';
    if (product.material) {
        specsHtml += `<div class="spec-row"><span class="spec-label">Material</span><span class="spec-value">${escapeHtml(product.material)} CNC milled</span></div>`;
    }
    for (const [key, label] of Object.entries(specLabels)) {
        if (specs[key]) {
            specsHtml += `<div class="spec-row"><span class="spec-label">${label}</span><span class="spec-value">${escapeHtml(specs[key])}</span></div>`;
        }
    }

    // Build Face Mill buttons (hide stock counts from consumers)
    const faceMillHtml = faceMills.map(fm => {
        const isSelected = fm.pattern_name === selectedFaceMill.pattern_name;
        const isDisabled = fm.stock <= 0;
        const stockLabel = isDisabled ? '(Unavailable)' : '';
        return `<button class="variant-btn${isSelected ? ' selected' : ''}${isDisabled ? ' disabled' : ''}"
            onclick="selectFaceMill(this, '${escapeAttr(fm.pattern_name)}', ${fm.base_price}, ${fm.stock})"
            ${isDisabled ? 'disabled' : ''}>
            ${escapeHtml(fm.pattern_name)}
            ${stockLabel ? `<span class="variant-stock out-stock">${stockLabel}</span>` : ''}
        </button>`;
    }).join('');

    // Build Head Finish buttons
    const headFinishHtml = headFinishes.map(hf => {
        const isSelected = hf.finish_name === selectedHeadFinish.finish_name;
        const priceLabel = parseFloat(hf.price_addon) > 0 ? ` (+$${hf.price_addon})` : '';
        return `<button class="variant-btn${isSelected ? ' selected' : ''}"
            onclick="selectHeadFinish(this, '${escapeAttr(hf.finish_name)}', ${hf.price_addon})">
            ${escapeHtml(hf.finish_name)}${priceLabel}
        </button>`;
    }).join('');

    // Build Hosel buttons
    const hoselHtml = hoselOptions.map(h => {
        const isSelected = h.hosel_name === selectedHosel.hosel_name;
        const priceLabel = parseFloat(h.price_addon) > 0 ? ` (+$${h.price_addon})` : '';
        return `<button class="variant-btn${isSelected ? ' selected' : ''}"
            onclick="selectHosel(this, '${escapeAttr(h.hosel_name)}', ${h.price_addon})">
            ${escapeHtml(h.hosel_name)}${priceLabel}
        </button>`;
    }).join('');

    // Build Shaft buttons
    const shaftHtml = shaftOptions.map(s => {
        const isSelected = s.shaft_name === selectedLNBShaft.shaft_name;
        const priceLabel = parseFloat(s.price_addon) > 0 ? ` (+$${s.price_addon})` : '';
        return `<button class="variant-btn${isSelected ? ' selected' : ''}"
            onclick="selectLNBShaft(this, '${escapeAttr(s.shaft_name)}', ${s.price_addon})">
            ${escapeHtml(s.shaft_name)}${priceLabel}
        </button>`;
    }).join('');

    // Build shaft length dropdown for LNB
    let lnbShaftLengthHtml = `<select class="form-input" id="shaftLengthSelect" onchange="selectShaftLength(this.value)" style="max-width: 200px;">`;
    SHAFT_LENGTHS.forEach(sl => {
        const selected = sl.length === selectedShaftLength.length ? ' selected' : '';
        const priceLabel = sl.price > 0 ? ` (+$${sl.price})` : '';
        lnbShaftLengthHtml += `<option value="${sl.length}"${selected}>${sl.length}"${priceLabel}</option>`;
    });
    lnbShaftLengthHtml += '</select>';

    // Check if any face mills are in stock
    const totalStock = faceMills.reduce((sum, fm) => sum + (fm.stock || 0), 0);
    const hasStock = totalStock > 0;

    const content = document.getElementById('productPageContent');
    content.innerHTML = `
        <div class="product-page-grid">
            <!-- Gallery -->
            <div class="product-gallery">
                <div class="product-carousel" id="productCarousel">
                    <div class="product-main-image" id="mainImage">
                        <img src="${heroImg}" alt="${escapeAttr(product.name)} Putter" id="mainImg">
                    </div>
                    <button class="carousel-arrow carousel-prev" id="carouselPrev" onclick="prevImage()" style="display:none">&lsaquo;</button>
                    <button class="carousel-arrow carousel-next" id="carouselNext" onclick="nextImage()" style="display:none">&rsaquo;</button>
                </div>
                <div class="carousel-dots" id="carouselDots"></div>

                ${specsHtml ? `
                <div class="modal-specs">
                    <h4>Specifications</h4>
                    ${specsHtml}
                </div>` : ''}
            </div>

            <!-- Details -->
            <div class="product-details">
                <div class="product-brand">Proto Golf</div>
                <h1>${escapeHtml(product.name)}</h1>
                <div class="product-page-price" id="productPrice">$${selectedFaceMill.base_price}</div>
                <p class="lnb-price-note">Starting at $110 · Build your custom putter below</p>

                <p class="product-description">${escapeHtml(product.description || '')}</p>

                <!-- Long Neck Blade Options -->
                <div class="product-variants lnb-options">
                    <!-- Face Mill Pattern (Primary - has inventory) -->
                    <div class="variant-group">
                        <span class="variant-label">Face Mill Pattern</span>
                        <div class="variant-options" id="faceMillOptions">${faceMillHtml}</div>
                    </div>

                    <!-- Head Finish -->
                    <div class="variant-group">
                        <span class="variant-label">Head Finish</span>
                        <div class="variant-options" id="headFinishOptions">${headFinishHtml}</div>
                    </div>

                    <!-- Hosel -->
                    <div class="variant-group">
                        <span class="variant-label">Hosel</span>
                        <div class="variant-options" id="hoselOptions">${hoselHtml}</div>
                    </div>

                    <!-- Shaft Color -->
                    <div class="variant-group">
                        <span class="variant-label">Shaft Color</span>
                        <div class="variant-options" id="lnbShaftOptions">${shaftHtml}</div>
                    </div>

                    <!-- Shaft Length -->
                    <div class="variant-group">
                        <span class="variant-label">Shaft Length</span>
                        ${lnbShaftLengthHtml}
                        <span style="font-size: 0.75rem; color: #888; margin-top: 4px; display: block;">Standard: 30"-36" · Extended 36.5"+ adds $15</span>
                    </div>
                </div>

                <!-- Price Breakdown -->
                <div class="lnb-price-breakdown" id="priceBreakdown">
                    <div class="breakdown-row">
                        <span>Face Mill (${escapeHtml(selectedFaceMill.pattern_name)})</span>
                        <span>$${selectedFaceMill.base_price}</span>
                    </div>
                </div>

                <!-- Stock Status -->
                <div class="product-stock${!hasStock ? ' out' : ''}" id="stockStatus">
                    ${hasStock ? '' : 'All patterns currently sold out'}
                </div>

                ${hasStock ? `
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
                    <button class="btn btn-primary btn-lg" id="addToCartBtn" onclick="addLNBToCart()">
                        Add to Cart - <span id="totalPrice">$0</span>
                    </button>
                </div>` : `
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
                    We'll send you a one-time email when the Long Neck Blade becomes available.
                </p>`}
            </div>
        </div>
    `;

    // Update gallery for selected options
    updateLNBGallery();
}

function selectFaceMill(btn, patternName, basePrice, stock) {
    if (stock <= 0) return;
    document.querySelectorAll('#faceMillOptions .variant-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedFaceMill = { pattern_name: patternName, base_price: basePrice, stock: stock };
    updateLNBPrice();
    updateLNBGallery();
}

function selectHeadFinish(btn, finishName, priceAddon) {
    document.querySelectorAll('#headFinishOptions .variant-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedHeadFinish = { finish_name: finishName, price_addon: parseFloat(priceAddon) || 0 };
    updateLNBPrice();
    updateLNBGallery();
}

function selectHosel(btn, hoselName, priceAddon) {
    document.querySelectorAll('#hoselOptions .variant-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedHosel = { hosel_name: hoselName, price_addon: parseFloat(priceAddon) || 0 };
    updateLNBPrice();
}

function selectLNBShaft(btn, shaftName, priceAddon) {
    document.querySelectorAll('#lnbShaftOptions .variant-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedLNBShaft = { shaft_name: shaftName, price_addon: parseFloat(priceAddon) || 0 };
    updateLNBPrice();
}

function updateLNBPrice() {
    const basePrice = parseFloat(selectedFaceMill.base_price) || 110;
    const headFinishPrice = parseFloat(selectedHeadFinish.price_addon) || 0;
    const hoselPrice = parseFloat(selectedHosel.price_addon) || 0;
    const shaftPrice = parseFloat(selectedLNBShaft.price_addon) || 0;
    const lengthPrice = selectedShaftLength ? selectedShaftLength.price : 0;
    const productPrice = basePrice + headFinishPrice + hoselPrice + shaftPrice + lengthPrice;
    const total = productPrice + selectedShipping.price;

    // Update displayed price
    const priceEl = document.getElementById('productPrice');
    if (priceEl) priceEl.textContent = '$' + productPrice;

    const totalEl = document.getElementById('totalPrice');
    if (totalEl) totalEl.textContent = '$' + total;

    // Update price breakdown
    const breakdownEl = document.getElementById('priceBreakdown');
    if (breakdownEl) {
        let html = `<div class="breakdown-row"><span>Face Mill (${escapeHtml(selectedFaceMill.pattern_name)})</span><span>$${basePrice}</span></div>`;
        if (headFinishPrice > 0) {
            html += `<div class="breakdown-row"><span>${escapeHtml(selectedHeadFinish.finish_name)}</span><span>+$${headFinishPrice}</span></div>`;
        }
        if (hoselPrice > 0) {
            html += `<div class="breakdown-row"><span>${escapeHtml(selectedHosel.hosel_name)} Hosel</span><span>+$${hoselPrice}</span></div>`;
        }
        if (shaftPrice > 0) {
            html += `<div class="breakdown-row"><span>${escapeHtml(selectedLNBShaft.shaft_name)} Shaft</span><span>+$${shaftPrice}</span></div>`;
        }
        if (lengthPrice > 0) {
            html += `<div class="breakdown-row"><span>Extended Length (${selectedShaftLength.length}")</span><span>+$${lengthPrice}</span></div>`;
        }
        html += `<div class="breakdown-row breakdown-total"><span>Subtotal</span><span>$${productPrice}</span></div>`;
        breakdownEl.innerHTML = html;
    }
}

function updateLNBGallery() {
    // Try to find images for this combination: FaceMill|HeadFinish
    const key = selectedFaceMill.pattern_name + '|' + selectedHeadFinish.finish_name;
    currentGallery = dbImages[key] || [];

    // Fallback to just face mill pattern
    if (currentGallery.length === 0) {
        currentGallery = dbImages[selectedFaceMill.pattern_name] || [];
    }

    currentImageIndex = 0;

    const mainImg = document.getElementById('mainImg');
    const dotsContainer = document.getElementById('carouselDots');
    const prevBtn = document.getElementById('carouselPrev');
    const nextBtn = document.getElementById('carouselNext');

    if (currentGallery.length === 0) {
        // No images - keep hero image
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
        if (dotsContainer) dotsContainer.innerHTML = '';
        return;
    }

    // Has images
    if (mainImg) mainImg.src = currentGallery[0];

    const showArrows = currentGallery.length > 1;
    if (prevBtn) prevBtn.style.display = showArrows ? '' : 'none';
    if (nextBtn) nextBtn.style.display = showArrows ? '' : 'none';

    if (dotsContainer) {
        if (currentGallery.length > 1) {
            dotsContainer.innerHTML = currentGallery.map((_, i) =>
                `<button class="carousel-dot${i === 0 ? ' active' : ''}" onclick="goToImage(${i})"></button>`
            ).join('');
        } else {
            dotsContainer.innerHTML = '';
        }
    }

    setupCarouselTouch();
}

function addLNBToCart() {
    if (!selectedFaceMill || selectedFaceMill.stock <= 0) {
        showToast('This pattern is out of stock');
        return;
    }

    const basePrice = parseFloat(selectedFaceMill.base_price) || 110;
    const headFinishPrice = parseFloat(selectedHeadFinish.price_addon) || 0;
    const hoselPrice = parseFloat(selectedHosel.price_addon) || 0;
    const shaftPrice = parseFloat(selectedLNBShaft.price_addon) || 0;
    const lengthPrice = selectedShaftLength ? selectedShaftLength.price : 0;
    const totalPrice = basePrice + headFinishPrice + hoselPrice + shaftPrice + lengthPrice;

    const item = {
        id: product.id,
        name: product.name,
        price: totalPrice,
        icon: product.icon || 'L',
        options: {
            faceMill: selectedFaceMill.pattern_name,
            headFinish: selectedHeadFinish.finish_name,
            hosel: selectedHosel.hosel_name,
            shaft: selectedLNBShaft.shaft_name,
            shaftLength: selectedShaftLength ? selectedShaftLength.length : '34',
            shipping: selectedShipping.type
        },
        shippingCost: selectedShipping.price,
        isLongNeckBlade: true
    };

    cart.push(item);
    saveCart();
    updateCartUI();
    openCart();
    showToast(`${product.name} added to cart!`);

    if (window.analytics) {
        window.analytics.trackAddToCart(product.id, selectedFaceMill.pattern_name, selectedLNBShaft.shaft_name, totalPrice);
    }
}

// ============================================
// END LONG NECK BLADE FUNCTIONS
// ============================================

let currentImageIndex = 0;

function updateGallery() {
    const key = selectedFinish.name + '|' + selectedShaft.name;
    currentGallery = dbImages[key] || [];
    currentImageIndex = 0;

    const mainImg = document.getElementById('mainImg');
    const dotsContainer = document.getElementById('carouselDots');
    const prevBtn = document.getElementById('carouselPrev');
    const nextBtn = document.getElementById('carouselNext');

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
                    <span style="font-size:12px;color:#444;margin-top:4px">${selectedFinish.name} · ${selectedShaft.name}</span>
                `;
                mainImg.parentNode.insertBefore(placeholder, mainImg);
            } else {
                placeholder.style.display = 'flex';
                placeholder.querySelector('span:last-child').textContent = `${selectedFinish.name} · ${selectedShaft.name}`;
            }
        }
        if (dotsContainer) dotsContainer.innerHTML = '';
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
        return;
    }

    // Has images — hide placeholder, show main image
    if (mainImg) {
        mainImg.style.display = '';
        const placeholder = document.getElementById('noImagePlaceholder');
        if (placeholder) placeholder.style.display = 'none';
        mainImg.src = currentGallery[0];
    }

    // Show/hide arrows based on image count
    const showArrows = currentGallery.length > 1;
    if (prevBtn) prevBtn.style.display = showArrows ? '' : 'none';
    if (nextBtn) nextBtn.style.display = showArrows ? '' : 'none';

    // Render dots
    if (dotsContainer) {
        if (currentGallery.length > 1) {
            dotsContainer.innerHTML = currentGallery.map((_, i) =>
                `<button class="carousel-dot${i === 0 ? ' active' : ''}" onclick="goToImage(${i})"></button>`
            ).join('');
        } else {
            dotsContainer.innerHTML = '';
        }
    }

    // Set up touch/swipe on carousel
    setupCarouselTouch();
}

function goToImage(index) {
    if (index < 0 || index >= currentGallery.length) return;
    currentImageIndex = index;
    const mainImg = document.getElementById('mainImg');
    if (mainImg) mainImg.src = currentGallery[index];

    // Update dots
    document.querySelectorAll('.carousel-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
    });
}

function prevImage() {
    const newIndex = currentImageIndex <= 0 ? currentGallery.length - 1 : currentImageIndex - 1;
    goToImage(newIndex);
}

function nextImage() {
    const newIndex = currentImageIndex >= currentGallery.length - 1 ? 0 : currentImageIndex + 1;
    goToImage(newIndex);
}

function setupCarouselTouch() {
    const carousel = document.getElementById('productCarousel');
    if (!carousel || carousel._touchSetup) return;
    carousel._touchSetup = true;

    let startX = 0;
    let startY = 0;
    carousel.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }, { passive: true });

    carousel.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - startX;
        const dy = e.changedTouches[0].clientY - startY;
        // Only trigger if horizontal swipe is dominant and > 50px
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0) nextImage();
            else prevImage();
        }
    }, { passive: true });
}

function selectFinish(btn, name, price) {
    document.querySelectorAll('#finishOptions .variant-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedFinish = { name, price };
    updatePrice();
    updateGallery();
}

function selectShaft(btn, shaft, price) {
    document.querySelectorAll('#shaftOptions .variant-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedShaft = { name: shaft, price: price || 0 };
    updatePrice();
    updateGallery();
}

function selectShipping(el, type, price) {
    document.querySelectorAll('.shipping-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    selectedShipping = { type, price };
    updatePrice();
}

function selectShaftLength(lengthValue) {
    const found = SHAFT_LENGTHS.find(sl => sl.length === lengthValue);
    if (found) {
        selectedShaftLength = found;
        updatePrice();
        // Also update for LNB
        updateLNBPrice();
    }
}


function updatePrice() {
    if (!product) return;
    const basePrice = parseFloat(product.base_price);
    const finishPrice = selectedFinish ? selectedFinish.price : 0;
    const shaftPrice = selectedShaft ? selectedShaft.price : 0;
    const lengthPrice = selectedShaftLength ? selectedShaftLength.price : 0;
    const productPrice = basePrice + finishPrice + shaftPrice + lengthPrice;
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
        stockEl.textContent = 'Low Stock';
        stockEl.classList.add('low');
    } else {
        stockEl.textContent = 'In Stock';
    }
}

function addToCart() {
    if (!product || product.stock <= 0) return;

    const lengthPrice = selectedShaftLength ? selectedShaftLength.price : 0;
    const item = {
        id: product.id,
        name: product.name,
        price: parseFloat(product.base_price) + (selectedFinish ? selectedFinish.price : 0) + (selectedShaft ? selectedShaft.price : 0) + lengthPrice,
        icon: product.icon || product.name.charAt(0),
        options: {
            finish: selectedFinish ? selectedFinish.name : '',
            shaft: selectedShaft ? selectedShaft.name : '',
            shaftLength: selectedShaftLength ? selectedShaftLength.length : '34',
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
        cartItems.innerHTML = cart.map((item, index) => {
            // Handle Long Neck Blade items differently
            let optionsHtml = '';
            if (item.isLongNeckBlade && item.options) {
                optionsHtml = `${item.options.faceMill} · ${item.options.headFinish}<br>${item.options.hosel} hosel · ${item.options.shaft} shaft · ${item.options.shaftLength || '34'}"`;
            } else if (item.options) {
                optionsHtml = `${item.options.finish} / ${item.options.shaft} shaft / ${item.options.shaftLength || '34'}"`;
            }
            return `
                <div class="cart-item">
                    <div class="cart-item-image">${item.icon || item.name.charAt(0)}</div>
                    <div class="cart-item-info">
                        <div class="cart-item-name">${item.name}</div>
                        <div class="cart-item-options">${optionsHtml}</div>
                        <div class="cart-item-price">$${item.price}</div>
                    </div>
                    <button class="cart-item-remove" onclick="removeFromCart(${index})">X</button>
                </div>
            `;
        }).join('');
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

    const newCart = cart.map(item => {
        if (item.isLongNeckBlade) {
            // Long Neck Blade has different options
            return {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                productId: item.id,
                productName: item.name,
                faceMill: item.options.faceMill,
                headFinish: item.options.headFinish,
                hosel: item.options.hosel,
                shaftColor: item.options.shaft.toLowerCase(),
                shaftColorName: item.options.shaft,
                shaftLength: item.options.shaftLength || '34',
                price: item.price,
                quantity: 1,
                isLongNeckBlade: true
            };
        } else {
            return {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                productId: item.id,
                productName: item.name,
                finish: item.options.finish.toLowerCase().replace(/ /g, '-'),
                finishName: item.options.finish,
                shaftColor: item.options.shaft.toLowerCase(),
                shaftColorName: item.options.shaft,
                shaftLength: item.options.shaftLength || '34',
                price: item.price,
                quantity: 1
            };
        }
    });

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
