/**
 * SUITE Docs Shared Navigation Component
 * Single source of truth for all docs page navigation
 * Injects consistent nav HTML across all pages
 */

document.addEventListener('DOMContentLoaded', function () {
    // Find or create nav element
    let nav = document.querySelector('nav.nav');

    if (nav) {
        // Replace existing nav with standardized version
        nav.outerHTML = `
            <nav class="nav">
                <div class="nav-inner">
                    <a href="../index.html" class="nav-logo">
                        <img src="../assets/suite-token.png" alt="SUITE" class="nav-logo-img">
                        SUITE
                    </a>
                    <div class="nav-links">
                        <a href="../apps.html">Apps</a>
                        <a href="../developer-portal.html">Build</a>
                        <a href="../discuss.html">Discuss</a>
                        <a href="../incubate.html">Incubate</a>
                        <a href="index.html" class="active">Docs</a>
                        <div class="nav-dropdown">
                            <span class="nav-dropdown-trigger">SUITE ▾</span>
                            <div class="nav-dropdown-menu">
                                <a href="../wallet.html">🏦 Vault</a>
                                <a href="../boost.html">🛒 Store</a>
                                <a href="../dashboard.html">⚙️ Dashboard</a>
                            </div>
                        </div>
                        <a href="../start-building.html" class="nav-cta">🚀 Start Building</a>
                    </div>
                    <button class="mobile-menu-btn">
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>
                </div>
            </nav>
        `;
    }
});
