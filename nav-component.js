// nav-component.js - Single source of truth for SUITE navigation
// Include this script and add <nav id="main-nav"></nav> to any page

(function () {
    const isDocsPage = window.location.pathname.includes('/docs/');
    const basePath = isDocsPage ? '../' : '';

    const navHTML = `
    <div class="nav-inner">
        <a href="${basePath}index.html" class="nav-logo">
            <img src="${basePath}assets/suite-token.png" alt="SUITE" class="nav-logo-img">
            SUITE
        </a>
        <div class="nav-links">
            <a href="${basePath}apps.html">Apps</a>
            <a href="${basePath}developer-portal.html">Build</a>
            <a href="${basePath}discuss.html">Discuss</a>
            <a href="${basePath}incubate.html">Incubate</a>
            <a href="${basePath}docs/">Docs</a>
            <a href="${basePath}wallet.html">Wallet</a>
            <a href="${basePath}start-building.html" class="nav-cta"><img src="${basePath}assets/emojis/clay-rocket.png" alt="" class="nav-cta-emoji"> Start Building</a>
        </div>
        <button class="mobile-menu-btn" onclick="this.classList.toggle('active'); document.querySelector('.nav-links').classList.toggle('mobile-open');">
            <span></span>
            <span></span>
            <span></span>
        </button>
    </div>
    `;

    // Inject nav when DOM is ready
    function injectNav() {
        const navElement = document.getElementById('main-nav');
        if (navElement) {
            navElement.className = 'nav';
            navElement.innerHTML = navHTML;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectNav);
    } else {
        injectNav();
    }
})();

