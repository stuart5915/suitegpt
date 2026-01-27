// Proto Golf Analytics
// Tracks page views, product views, cart events, and checkout funnel

class Analytics {
    constructor() {
        this.sessionId = this.getOrCreateSessionId();
        this.supabaseUrl = null;
        this.supabaseKey = null;
        this.initialized = false;
    }

    // Initialize with Supabase credentials
    init(supabaseUrl, supabaseKey) {
        this.supabaseUrl = supabaseUrl;
        this.supabaseKey = supabaseKey;
        this.initialized = true;

        // Track initial page view
        this.trackPageView();
    }

    // Get or create session ID
    getOrCreateSessionId() {
        let sessionId = sessionStorage.getItem('proto_golf_session');
        if (!sessionId) {
            sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('proto_golf_session', sessionId);
        }
        return sessionId;
    }

    // Track an event
    async track(eventType, metadata = {}) {
        const event = {
            event_type: eventType,
            product_id: metadata.product_id || null,
            page_url: window.location.href,
            referrer: document.referrer || null,
            user_agent: navigator.userAgent,
            session_id: this.sessionId,
            metadata: metadata,
            created_at: new Date().toISOString()
        };

        // Log locally for debugging
        console.log('[Analytics]', eventType, metadata);

        // Send to Supabase if initialized
        if (this.initialized && this.supabaseUrl && this.supabaseKey) {
            try {
                await fetch(`${this.supabaseUrl}/rest/v1/proto_golf_analytics`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': this.supabaseKey,
                        'Authorization': `Bearer ${this.supabaseKey}`
                    },
                    body: JSON.stringify(event)
                });
            } catch (e) {
                console.error('Analytics tracking failed:', e);
            }
        }

        // Also store locally for offline support
        this.storeLocally(event);
    }

    // Store event locally
    storeLocally(event) {
        try {
            const events = JSON.parse(localStorage.getItem('proto_golf_analytics_queue') || '[]');
            events.push(event);
            // Keep only last 100 events locally
            if (events.length > 100) {
                events.shift();
            }
            localStorage.setItem('proto_golf_analytics_queue', JSON.stringify(events));
        } catch (e) {
            // localStorage full or disabled
        }
    }

    // Track page view
    trackPageView() {
        this.track('page_view');
    }

    // Track product view
    trackProductView(productId) {
        this.track('product_view', { product_id: productId });
    }

    // Track add to cart
    trackAddToCart(productId, finish, shaftColor, price) {
        this.track('add_to_cart', {
            product_id: productId,
            finish,
            shaft_color: shaftColor,
            price
        });
    }

    // Track checkout started
    trackCheckoutStarted(cartItems, total) {
        this.track('checkout_started', {
            item_count: cartItems.length,
            total,
            items: cartItems.map(i => ({
                product_id: i.productId,
                finish: i.finish,
                quantity: i.quantity
            }))
        });
    }

    // Track checkout completed
    trackCheckoutCompleted(orderId, total) {
        this.track('checkout_completed', {
            order_id: orderId,
            total
        });
    }

    // Track checkout abandoned
    trackCheckoutAbandoned(step, cartItems) {
        this.track('checkout_abandoned', {
            step,
            item_count: cartItems.length,
            items: cartItems.map(i => ({
                product_id: i.productId,
                finish: i.finish
            }))
        });
    }
}

// Create global analytics instance
window.analytics = new Analytics();
