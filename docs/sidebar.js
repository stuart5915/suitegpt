/**
 * SUITE Docs Sidebar Component
 * Single source of truth for documentation sidebar
 * Edit this file to update sidebar across all docs pages
 */

document.addEventListener('DOMContentLoaded', function () {
    const sidebar = document.querySelector('.docs-sidebar');
    if (!sidebar) return;

    // Get current page from path (handles both /docs/earning/ and /docs/earning.html)
    const currentPath = window.location.pathname.replace(/\/$/, ''); // remove trailing slash
    const currentPage = currentPath.split('/').pop() || 'index';

    // Helper to add active class (compare without .html extension)
    const isActive = (page) => {
        const pageName = page.replace('.html', '');
        return currentPage === pageName || currentPage === page ? 'active' : '';
    };

    sidebar.innerHTML = `
        <div class="sidebar-section">
            <div class="sidebar-title">Learn</div>
            <a href="/docs/" class="sidebar-link ${isActive('index.html') || currentPage === 'docs' ? 'active' : ''}">📚 Getting Started</a>
            <a href="/docs/ai-fleet/" class="sidebar-link ${isActive('ai-fleet.html')}">🤖 AI Fleet</a>
            <a href="/docs/safety/" class="sidebar-link ${isActive('safety.html')}">🛡️ AI Safety</a>
        </div>

        <div class="sidebar-section">
            <div class="sidebar-title">Earn</div>
            <a href="/docs/earning/" class="sidebar-link ${isActive('earning.html')}">💰 Earn SUITE Credits</a>
            <a href="/docs/white-label-apps/" class="sidebar-link ${isActive('white-label-apps.html')}">🏪 White-Label Apps</a>
            <a href="/docs/revenue/" class="sidebar-link ${isActive('revenue.html')}">💵 Revenue & Fees</a>
            <a href="/docs/user-flows/" class="sidebar-link ${isActive('user-flows.html')}">🔄 Flows & Actions</a>
        </div>

        <div class="sidebar-section">
            <div class="sidebar-title">Wallet</div>
            <a href="/docs/vault/" class="sidebar-link ${isActive('vault.html')}">🏦 SUITE Vault</a>
            <a href="/docs/suite-token/" class="sidebar-link ${isActive('suite-token.html')}">🪙 SUITE Token</a>
            <a href="/docs/wallet-credits/" class="sidebar-link ${isActive('wallet-credits.html')}">💳 Credits</a>
            <a href="/docs/roadmap/" class="sidebar-link ${isActive('roadmap.html')}">🗺️ Roadmap</a>
        </div>

        <div class="sidebar-section">
            <div class="sidebar-title">Admin</div>
            <a href="/docs/systems/" class="sidebar-link ${isActive('systems.html')}">🔧 Systems View</a>
            <a href="/docs/governance/" class="sidebar-link ${isActive('governance.html')}">🗳️ Governance</a>
            <a href="/docs/content-policy/" class="sidebar-link ${isActive('content-policy.html')}">📜 Content Policy</a>
        </div>

        <div class="sidebar-section">
            <div class="sidebar-title">Partner</div>
            <a href="/docs/for-businesses/" class="sidebar-link ${isActive('for-businesses.html')}">🏢 For Businesses</a>
            <a href="/docs/for-influencers/" class="sidebar-link ${isActive('for-influencers.html')}">📢 For Influencers</a>
        </div>
    `;
});
