/**
 * SUITE Dashboard Configuration
 * ================================
 * Edit THIS FILE to add/remove/reorder dashboard sections.
 * The sidebar and routing are generated from this config.
 */

const DASHBOARD_CONFIG = {
    // Sidebar sections - grouped by category
    sections: [
        // --- App Store (MVP - CORE) ---
        {
            category: 'App Store',
            items: [
                { id: 'store', label: 'App Store', icon: '🏪', status: 'LIVE' },
            ]
        },
        // --- $SUITE Economy (MVP - CORE) ---
        {
            category: '$SUITE Economy',
            items: [
                { id: 'treasury', label: 'Treasury', icon: '🏦', status: 'LIVE' },
                { id: 'earn', label: 'Earn SUITE', icon: '💰', status: 'SOON' },
            ]
        },
        // --- Roadmap (Coming Soon) ---
        {
            category: 'Roadmap',
            items: [
                { id: 'incubator', label: 'Incubator', icon: '🚀', status: 'SOON' },
                { id: 'apps', label: 'My Apps', icon: '📱', status: 'SOON' },
                { id: 'studio', label: 'Studio', icon: '🎨', status: 'SOON' },
                { id: 'marketplace', label: 'Marketplace', icon: '🛒', status: 'SOON' },
                { id: 'ai-fleet', label: 'AI Fleet', icon: '🤖', status: 'SOON' },
            ]
        },
        // --- Community ---
        {
            category: 'Community',
            items: [
                { id: 'constitution', label: 'Constitution', icon: '📜', status: 'NEW' },
                { id: 'suitehub', label: 'SUITE Hub', icon: '💬', status: 'SOON' },
                { id: 'giving', label: 'Giving Fund', icon: '❤️', status: 'SOON' },
            ]
        },
    ],

    // Admin sections (shown only to owner) - includes WIP/experimental features
    adminSections: [
        { id: 'admin-treasury', label: 'Treasury Admin', icon: '🔐', status: null },
        { id: 'admin-apps', label: 'App Admin', icon: '⚙️', status: null },
        { id: 'ventures', label: 'Ventures (WIP)', icon: '💼', status: 'WIP' },
        { id: 'prompt-server', label: 'Prompt Server', icon: '💻', status: null },
        { id: 'cadence', label: 'Cadence AI', icon: '🎯', status: null },
        { id: 'lp-incentives', label: 'LP Incentives', icon: '🌊', status: null },
    ],

    // Panels that should show "Coming Soon" overlay
    comingSoonPanels: ['earn', 'incubator', 'apps', 'studio', 'marketplace', 'suitehub', 'giving', 'ai-fleet'],

    // Default section to show
    defaultSection: 'store',
};

/**
 * Dashboard Navigation Controller
 * Renders sidebar and handles hash routing
 */
class DashboardNav {
    constructor(config) {
        this.config = config;
        this.currentSection = null;
        this.init();
    }

    init() {
        // Render sidebar
        this.renderSidebar();

        // Handle initial route
        this.handleRoute();

        // Listen for hash changes
        window.addEventListener('hashchange', () => this.handleRoute());
    }

    renderSidebar() {
        const container = document.getElementById('dashboard-sidebar');
        if (!container) return;

        let html = '';

        // Render each category
        this.config.sections.forEach(section => {
            html += `
                <div class="sidebar-section">
                    <div class="sidebar-title">${section.category}</div>
                    ${section.items.map(item => this.renderSidebarItem(item)).join('')}
                </div>
            `;
        });

        // Admin section (hidden by default, shown by checkAdmin())
        html += `
            <div class="sidebar-section" id="adminSection" style="display: none;">
                <div class="sidebar-title">Admin</div>
                ${this.config.adminSections.map(item => this.renderSidebarItem(item)).join('')}
            </div>
        `;

        container.innerHTML = html;
    }

    renderSidebarItem(item) {
        const statusHtml = item.status
            ? `<span class="sidebar-status ${item.status.toLowerCase()}">${item.status}</span>`
            : '';

        return `
            <div class="sidebar-link" data-section="${item.id}" onclick="dashboardNav.navigateTo('${item.id}')">
                <span class="sidebar-link-icon">${item.icon}</span>
                ${item.label}
                ${statusHtml}
            </div>
        `;
    }

    navigateTo(sectionId) {
        window.location.hash = sectionId;
    }

    handleRoute() {
        // Get section from hash, or use default
        const hash = window.location.hash.slice(1);
        const sectionId = hash || this.config.defaultSection;

        // Find if section exists
        const allItems = this.config.sections.flatMap(s => s.items)
            .concat(this.config.adminSections);
        const section = allItems.find(item => item.id === sectionId);

        if (!section) {
            // Section not found, go to default
            this.showSection(this.config.defaultSection);
            return;
        }

        this.showSection(sectionId);
    }

    showSection(sectionId) {
        // Hide all panels
        document.querySelectorAll('.section-panel').forEach(panel => {
            panel.classList.remove('active');
        });

        // Show target panel (panels use 'panel-' prefix)
        const targetPanel = document.getElementById('panel-' + sectionId);
        if (targetPanel) {
            targetPanel.classList.add('active');
        }

        // Update sidebar active state
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.classList.remove('active');
        });
        const activeLink = document.querySelector(`.sidebar-link[data-section="${sectionId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        // Update hash without triggering navigation
        if (window.location.hash.slice(1) !== sectionId) {
            history.replaceState(null, null, `#${sectionId}`);
        }

        this.currentSection = sectionId;
    }
}

// Initialize on DOM ready
let dashboardNav;
document.addEventListener('DOMContentLoaded', () => {
    dashboardNav = new DashboardNav(DASHBOARD_CONFIG);

    // Apply "coming-soon" class to panels that aren't ready yet
    if (DASHBOARD_CONFIG.comingSoonPanels) {
        DASHBOARD_CONFIG.comingSoonPanels.forEach(panelId => {
            const panel = document.getElementById('panel-' + panelId);
            if (panel) {
                panel.classList.add('coming-soon');
            }
        });
    }
});
