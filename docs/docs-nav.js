/**
 * SUITE Docs Shared Navigation Component
 * Single source of truth for all docs page navigation
 * Injects consistent nav HTML across all pages
 */

document.addEventListener('DOMContentLoaded', function () {
    // Find nav element by ID or class
    let nav = document.querySelector('#main-nav') || document.querySelector('nav.nav');

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
                        <a href="index.html" class="active">Docs</a>
                        <a href="../learn.html">Learn</a>
                        <a href="../wallet.html">Vault</a>
                        <a href="../start-building.html" class="nav-cta"><img src="../assets/emojis/clay-rocket.png" alt="" class="nav-cta-emoji"> Start Building</a>
                    </div>
                    <div class="nav-actions">
                        <button class="nav-btn nav-wallet" onclick="connectWallet()">
                            🔗 Connect Wallet
                        </button>
                    </div>
                    <button class="mobile-menu-btn" onclick="this.classList.toggle('active'); document.querySelector('.nav-links').classList.toggle('mobile-open'); document.querySelector('.nav-actions').classList.toggle('mobile-open');">
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>
                </div>
            </nav>
        `;
    }
});
