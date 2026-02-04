// Proto Golf - Site Image Overrides
// Loads custom images from Supabase storage, with localStorage caching for instant display

(function() {
    const SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
    const STORAGE_BUCKET = 'proto-golf-images';
    const CACHE_KEY = 'protoGolfSiteImages';

    // Image mappings: storage path -> CSS selector(s)
    const imageOverrides = {
        'site/homepage-hero': '.hero-image img',
        'site/homepage-rough-mill': '[data-product-id="rough-mill"] .product-image img',
        'site/homepage-centre-blade': '[data-product-id="centre-blade"] .product-image img',
        'site/homepage-long-neck': '[data-product-id="long-neck-blade"] .product-image img',
        'site/limited-midnight': '.limited-card:first-of-type .limited-image',
        'site/limited-heirloom': '.limited-card:nth-of-type(2) .limited-image'
    };

    // Apply image override
    function applyImage(selector, url) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            if (el.tagName === 'IMG') {
                el.src = url;
            } else {
                // For div elements (like limited-image), add an img inside
                let img = el.querySelector('img.custom-site-img');
                if (!img) {
                    img = document.createElement('img');
                    img.className = 'custom-site-img';
                    img.alt = 'Product image';
                    img.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;z-index:1;';
                    el.style.position = 'relative';
                    el.appendChild(img);
                }
                img.src = url;
            }
        });
    }

    // Load cached images IMMEDIATELY (no network delay)
    function applyCachedImages() {
        try {
            const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
            for (const [path, url] of Object.entries(cache)) {
                const selector = imageOverrides[path];
                if (selector && url) {
                    applyImage(selector, url);
                }
            }
        } catch (e) {
            console.error('Failed to load cached images:', e);
        }
    }

    // Check if an image exists in storage
    async function checkImageExists(path) {
        const extensions = ['jpg', 'jpeg', 'png', 'webp'];
        for (const ext of extensions) {
            const url = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}.${ext}`;
            try {
                const resp = await fetch(url, { method: 'HEAD' });
                if (resp.ok) {
                    return url;
                }
            } catch (e) {
                // Continue to next extension
            }
        }
        return null;
    }

    // Verify and update cache from Supabase (runs in background)
    async function verifyAndUpdateCache() {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        let cacheUpdated = false;

        for (const [path, selector] of Object.entries(imageOverrides)) {
            const url = await checkImageExists(path);
            if (url) {
                // Update cache and apply if different
                if (cache[path] !== url) {
                    cache[path] = url;
                    cacheUpdated = true;
                    applyImage(selector, url);
                }
            } else if (cache[path]) {
                // Image was removed from storage
                delete cache[path];
                cacheUpdated = true;
            }
        }

        if (cacheUpdated) {
            localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        }
    }

    // Run immediately - apply cache first, then verify in background
    applyCachedImages();

    // Verify against Supabase after page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', verifyAndUpdateCache);
    } else {
        verifyAndUpdateCache();
    }
})();
