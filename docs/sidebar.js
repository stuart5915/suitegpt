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
            <a href="index.html" class="sidebar-link ${isActive('index.html')}">📚 Introduction</a>
            <a href="how-it-works.html" class="sidebar-link ${isActive('how-it-works.html')}">⚙️ How It Works</a>
            <a href="../ecosystem.html" class="sidebar-link">🌐 Ecosystem</a>
            <a href="tokenomics.html" class="sidebar-link ${isActive('tokenomics.html')}">📊 Tokenomics</a>
            <a href="utility.html" class="sidebar-link ${isActive('utility.html')}">⚡ SUITE Utility</a>
            <a href="roadmap.html" class="sidebar-link ${isActive('roadmap.html')}">🗺️ Roadmap</a>
            <a href="systems-view.html" class="sidebar-link ${isActive('systems-view.html')}">🏗️ Systems View</a>
            <a href="glossary.html" class="sidebar-link ${isActive('glossary.html')}">🗣️ SUITE Lingo</a>
            <a href="codex.html" class="sidebar-link ${isActive('codex.html')}">📖 The SUITE Bible</a>
        </div>

        <div class="sidebar-section">
            <div class="sidebar-title">Build</div>
            <a href="quickstart.html" class="sidebar-link ${isActive('quickstart.html')}">🚀 Quick Start</a>
            <a href="developer.html" class="sidebar-link ${isActive('developer.html')}">👨‍💻 Developer Guide</a>
            <a href="commands.html" class="sidebar-link ${isActive('commands.html')}">⚡ Commands</a>
            <a href="dashboard.html" class="sidebar-link ${isActive('dashboard.html')}">🛠️ Dashboard</a>
            <a href="publish-checklist.html" class="sidebar-link ${isActive('publish-checklist.html')}">📋 Publish Checklist</a>
            <a href="ai-fleet.html" class="sidebar-link ${isActive('ai-fleet.html')}">🤖 AI Fleet</a>
        </div>

        <div class="sidebar-section">
            <div class="sidebar-title">Earn</div>
            <a href="earning.html" class="sidebar-link ${isActive('earning.html')}">💰 Earn SUITE</a>
            <a href="revenue.html" class="sidebar-link ${isActive('revenue.html')}">💵 Revenue & Fees</a>
            <a href="user-flows.html" class="sidebar-link ${isActive('user-flows.html')}">🔄 User Flows</a>
        </div>

        <div class="sidebar-section">
            <div class="sidebar-title">Admin</div>
            <a href="governance.html" class="sidebar-link ${isActive('governance.html')}">🗳️ Governance</a>
            <a href="admin-flows.html" class="sidebar-link ${isActive('admin-flows.html')}">⚙️ Admin Flows</a>
            <a href="content-policy.html" class="sidebar-link ${isActive('content-policy.html')}">📜 Content Policy</a>
        </div>
    `;
});
