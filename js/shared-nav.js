/**
 * SUITE Shared Navigation
 * ========================
 * Edit THIS FILE to update nav across ALL pages.
 * 
 * Usage: Add to any page:
 *   <div id="nav-container"></div>
 *   <script src="js/shared-nav.js"></script>
 */

const NAV_HTML = `
<nav class="nav">
    <div class="nav-inner">
        <a href="index.html" class="nav-logo">
            <img src="assets/suite-token.png" alt="SUITE" class="nav-logo-img">
            SUITE
        </a>
        <div class="nav-links">
            <a href="apps.html">Apps</a>
            <a href="ecosystem.html">Ecosystem</a>
            <a href="developer-portal.html">Build</a>
            <a href="discuss.html">Discuss</a>
            <a href="incubate.html">Incubate</a>
            <a href="https://docs.getsuite.app">Docs</a>
            <div class="nav-dropdown">
                <span class="nav-dropdown-trigger">SUITE ▾</span>
                <div class="nav-dropdown-menu">
                    <a href="wallet.html">🏦 Vault</a>
                    <a href="dashboard.html">💼 Dashboard</a>
                    <a href="learn.html">📚 Learn</a>
                </div>
            </div>
            <a href="start-building.html" class="nav-cta">✨ Start Building</a>
        </div>
        <button class="mobile-menu-btn" onclick="toggleMobileMenu()">
            <span></span>
            <span></span>
            <span></span>
        </button>
    </div>
</nav>
`;

// Inject nav into page
document.getElementById('nav-container').innerHTML = NAV_HTML;

// Mobile menu toggle
function toggleMobileMenu() {
    document.querySelector('.nav-links').classList.toggle('active');
    document.querySelector('.mobile-menu-btn').classList.toggle('active');
}
