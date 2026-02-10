/**
 * SUITE Docs Sidebar Component
 * Single source of truth for documentation sidebar
 * Edit this file to update sidebar across all docs pages
 */

document.addEventListener('DOMContentLoaded', function () {
    const sidebar = document.querySelector('.docs-sidebar');
    if (!sidebar) return;

    // Get current page from path
    const currentPath = window.location.pathname.replace(/\/$/, '');
    const currentPage = currentPath.split('/').pop() || 'index';

    // Helper to add active class
    const isActive = (page) => {
        const pageName = page.replace('.html', '');
        return currentPage === pageName || currentPage === page ? 'active' : '';
    };

    sidebar.innerHTML = `
        <div class="sidebar-section">
            <a href="/docs/roadmap.html" class="sidebar-link ${isActive('roadmap.html')}">🗺️ Roadmap</a>
        </div>

        <div class="sidebar-section">
            <div class="sidebar-title">Learn</div>
            <a href="/docs/index.html" class="sidebar-link ${isActive('index.html') || currentPage === 'docs' ? 'active' : ''}">📚 Getting Started</a>
            <a href="/docs/ai-fleet.html" class="sidebar-link ${isActive('ai-fleet.html')}">🤖 AI Fleet</a>
            <a href="/docs/safety.html" class="sidebar-link ${isActive('safety.html')}">🛡️ AI Safety</a>
        </div>

        <div class="sidebar-section">
            <div class="sidebar-title">Using SUITE</div>
            <a href="/docs/revenue.html" class="sidebar-link ${isActive('revenue.html')}">💡 How It Works</a>
            <a href="/docs/earning.html" class="sidebar-link ${isActive('earning.html')}">🎁 Free Credits</a>
            <a href="/docs/white-label-apps.html" class="sidebar-link ${isActive('white-label-apps.html')}">🏪 White-Label Apps</a>
        </div>

        <div class="sidebar-section">
            <div class="sidebar-title">SuiteGPT Guide</div>
            <a href="/docs/suitegpt-guide.html" class="sidebar-link ${isActive('suitegpt-guide.html')}">🎯 Use Cases by Role</a>
        </div>

        <div class="sidebar-section">
            <div class="sidebar-title">Treasury</div>
            <a href="/docs/vault.html" class="sidebar-link ${isActive('vault.html')}">🏦 Reward Pool</a>
        </div>

        <div class="sidebar-section">
            <div class="sidebar-title">Profile</div>
            <a href="/docs/profile-credits.html" class="sidebar-link ${isActive('profile-credits.html')}">⚡ Credits</a>
            <a href="/docs/your-profile.html" class="sidebar-link ${isActive('your-profile.html')}">👤 Your Profile</a>
            <a href="/docs/vote-for-apps.html" class="sidebar-link ${isActive('vote-for-apps.html')}">🗳️ Vote for Apps</a>
        </div>

        <div class="sidebar-section">
            <div class="sidebar-title">Admin</div>
            <a href="/docs/systems.html" class="sidebar-link ${isActive('systems.html')}">🔧 Systems View</a>
            <a href="/docs/governance.html" class="sidebar-link ${isActive('governance.html')}">🗳️ Governance</a>
            <a href="/docs/content-policy.html" class="sidebar-link ${isActive('content-policy.html')}">📜 Content Policy</a>
        </div>

        <div class="sidebar-section">
            <div class="sidebar-title">Partner</div>
            <a href="/docs/for-businesses.html" class="sidebar-link ${isActive('for-businesses.html')}">🏢 For Businesses</a>
            <a href="/docs/for-influencers.html" class="sidebar-link ${isActive('for-influencers.html')}">📢 For Influencers</a>
            <a href="/docs/app-operators.html" class="sidebar-link ${isActive('app-operators.html')}">🚀 App Operators</a>
        </div>
    `;
});
