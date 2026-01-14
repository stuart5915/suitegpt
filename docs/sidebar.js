/**
 * SUITE Docs Sidebar Component
 * Single source of truth for documentation sidebar
 * Edit this file to update sidebar across all docs pages
 */

document.addEventListener('DOMContentLoaded', function () {
    const sidebar = document.querySelector('.docs-sidebar');
    if (!sidebar) return;

    // Get current page filename
    const currentPath = window.location.pathname;
    const currentPage = currentPath.split('/').pop() || 'index.html';

    // Helper to add active class
    const isActive = (page) => currentPage === page ? 'active' : '';

    sidebar.innerHTML = `
        <div class="sidebar-section">
            <div class="sidebar-title">Learn</div>
            <a href="index.html" class="sidebar-link ${isActive('index.html')}">📚 Getting Started</a>
            <a href="ecosystem-overview.html" class="sidebar-link ${isActive('ecosystem-overview.html')}">🌐 Ecosystem</a>
            <a href="tokenomics.html" class="sidebar-link ${isActive('tokenomics.html')}">📊 Tokenomics</a>
            <a href="safety.html" class="sidebar-link ${isActive('safety.html')}">🛡️ AI Safety</a>
        </div>

        <div class="sidebar-section">
            <div class="sidebar-title">Build</div>
            <a href="quickstart.html" class="sidebar-link ${isActive('quickstart.html')}">🚀 Quick Start</a>
            <a href="developer.html" class="sidebar-link ${isActive('developer.html')}">👨‍💻 Developer Guide</a>
            <a href="commands.html" class="sidebar-link ${isActive('commands.html')}">⚡ Commands & Features</a>
            <a href="publish-checklist.html" class="sidebar-link ${isActive('publish-checklist.html')}">📋 Publish Checklist</a>
            <a href="incubate.html" class="sidebar-link ${isActive('incubate.html')}">🌱 Incubate (coming soon)</a>
            <a href="ai-fleet.html" class="sidebar-link ${isActive('ai-fleet.html')}">🤖 AI Fleet (coming soon)</a>
        </div>

        <div class="sidebar-section">
            <div class="sidebar-title">Earn</div>
            <a href="earning.html" class="sidebar-link ${isActive('earning.html')}">💰 Earn SUITE</a>
            <a href="revenue.html" class="sidebar-link ${isActive('revenue.html')}">💵 Revenue & Fees</a>
            <a href="user-flows.html" class="sidebar-link ${isActive('user-flows.html')}">🔄 User Flows</a>
        </div>

        <div class="sidebar-section">
            <div class="sidebar-title">Admin</div>
            <a href="systems.html" class="sidebar-link ${isActive('systems.html')}">🔧 Systems View</a>
            <a href="governance.html" class="sidebar-link ${isActive('governance.html')}">🗳️ Governance</a>
            <a href="content-policy.html" class="sidebar-link ${isActive('content-policy.html')}">📜 Content Policy</a>
        </div>
    `;
});
