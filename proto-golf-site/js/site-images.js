// Proto Golf - Site Image Overrides
// This script loads custom images from Supabase storage if they exist

(function() {
    const SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
    const STORAGE_BUCKET = 'proto-golf-images';

    // Image mappings: storage path -> CSS selector(s)
    const imageOverrides = {
        'site/homepage-hero': '.hero-image img',
        'site/homepage-rough-mill': '[data-product-id="rough-mill"] .product-image img',
        'site/homepage-centre-blade': '[data-product-id="centre-blade"] .product-image img',
        'site/homepage-long-neck': '[data-product-id="long-neck-blade"] .product-image img',
        'site/limited-midnight': '.limited-card:first-of-type .limited-image',
        'site/limited-heirloom': '.limited-card:nth-of-type(2) .limited-image'
    };

    // Check if an image exists in storage
    async function checkImageExists(path) {
        // Try common extensions
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

    // Apply image override
    function applyImage(selector, url) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            if (el.tagName === 'IMG') {
                el.src = url;
            } else {
                // For div elements (like limited-image), add an img inside or set background
                const existingImg = el.querySelector('img');
                if (existingImg) {
                    existingImg.src = url;
                } else {
                    // Create img element
                    const img = document.createElement('img');
                    img.src = url;
                    img.alt = 'Product image';
                    img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
                    el.insertBefore(img, el.firstChild);
                }
            }
        });
    }

    // Load all custom images
    async function loadCustomImages() {
        for (const [path, selector] of Object.entries(imageOverrides)) {
            const url = await checkImageExists(path);
            if (url) {
                applyImage(selector, url);
            }
        }
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadCustomImages);
    } else {
        loadCustomImages();
    }
})();
