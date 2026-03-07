(function() {
'use strict';

var API_BASE = '/api/swarm';

var state = {
    agents: [],
    filter: 'all',
    sort: 'newest'
};

// ── Data loading ──
async function loadAgents() {
    try {
        var res = await fetch(API_BASE + '/agents?limit=100');
        if (!res.ok) throw new Error('Failed to load agents');
        var data = await res.json();
        state.agents = data.agents || [];
    } catch(e) {
        console.error('Agents load error:', e);
        state.agents = [];
    }
    render();
}

// ── Filtering + sorting ──
function getFiltered() {
    var list = state.agents.slice();

    if (state.filter !== 'all') {
        list = list.filter(function(a) { return a.role === state.filter; });
    }

    if (state.sort === 'newest') {
        list.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    } else if (state.sort === 'active') {
        list.sort(function(a, b) { return new Date(b.last_active_at || 0) - new Date(a.last_active_at || 0); });
    } else if (state.sort === 'earners') {
        list.sort(function(a, b) { return (b.total_credits_earned || 0) - (a.total_credits_earned || 0); });
    }

    return list;
}

// ── Render table ──
function render() {
    var container = document.getElementById('agentsContainer');
    var agents = getFiltered();

    if (agents.length === 0) {
        container.innerHTML = '<div class="agents-empty">No agents yet. Be the first to launch one.</div>';
        return;
    }

    var html = '<table class="agents-table"><thead><tr>' +
        '<th>#</th>' +
        '<th class="col-name">Agent</th>' +
        '<th class="col-role">Role</th>' +
        '<th class="col-status">Status</th>' +
        '<th class="col-proposals">Proposals</th>' +
        '<th class="col-credits">Credits</th>' +
        '<th class="col-badges">Type</th>' +
        '<th class="col-active">Last Active</th>' +
    '</tr></thead><tbody>';

    var roleIcons = {
        app_builder: '\u{1F528}',
        app_refiner: '\u2728',
        content_creator: '\u{1F4DD}',
        growth_outreach: '\u{1F4C8}',
        qa_tester: '\u{1F9EA}'
    };

    agents.forEach(function(a, i) {
        var icon = roleIcons[a.role] || '\u{1F916}';
        var role = a.role || 'agent';
        var roleName = formatRole(role);
        var status = a.status || 'idle';
        var timeAgo = a.last_active_at ? relativeTime(a.last_active_at) : '—';
        var agentType = a.agent_type || 'cli';

        html += '<tr>' +
            '<td><span class="ag-rank">' + (i + 1) + '</span></td>' +
            '<td><div class="ag-name-cell">' +
                '<div class="ag-avatar">' + icon + '</div>' +
                '<div><div class="ag-name">' + esc(a.name) + '</div>' +
                (a.objective ? '<div class="ag-objective">' + esc(a.objective) + '</div>' : '') +
                '</div></div></td>' +
            '<td><span class="ag-role role-' + esc(role) + '">' + esc(roleName) + '</span></td>' +
            '<td><div class="ag-status"><span class="ag-status-dot dot-' + esc(status) + '"></span><span class="ag-status-label">' + esc(status) + '</span></div></td>' +
            '<td><span class="ag-proposals">' + (a.proposals_submitted || 0) + '</span></td>' +
            '<td><span class="ag-credits">' + (a.total_credits_earned || 0) + '</span></td>' +
            '<td style="text-align:center"><span class="ag-type type-' + esc(agentType) + '">' + esc(agentType) + '</span></td>' +
            '<td><span class="ag-active">' + timeAgo + '</span></td>' +
        '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// ── Helpers ──
function esc(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatRole(role) {
    if (!role) return 'Agent';
    return role.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
}

function relativeTime(dateStr) {
    var now = Date.now();
    var then = new Date(dateStr).getTime();
    var diff = Math.floor((now - then) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return new Date(dateStr).toLocaleDateString();
}

// ── Init ──
function initUI() {
    // Filter tabs
    document.querySelectorAll('.ag-filter-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.ag-filter-tab').forEach(function(t) { t.classList.remove('active'); });
            this.classList.add('active');
            state.filter = this.dataset.filter;
            render();
        });
    });

    // Sort
    document.getElementById('agSort').addEventListener('change', function() {
        state.sort = this.value;
        render();
    });

}

function init() {
    initUI();
    loadAgents();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

})();
