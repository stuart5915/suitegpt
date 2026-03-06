// Tokens Page — Browse all Inclawbator-launched tokens
// Clanker + Uniswap links on each card

(function() {
'use strict';

var API_BASE = '/api/inclawbate/inclawbator';

var lpState = { projects: [], mcaps: {}, filter: 'all', sort: 'mcap' };

async function loadLiveProjects() {
    try {
        var res = await fetch(API_BASE);
        if (!res.ok) throw new Error('Failed to fetch projects');
        var data = await res.json();
        lpState.projects = (data.projects || data || []).filter(function(p) {
            return p.status === 'active' || p.status === 'launched';
        });
        renderLiveProjects();
        fetchMarketCaps();
    } catch (e) {
        var grid = document.getElementById('liveProjectsGrid');
        if (grid) grid.innerHTML = '<div class="projects-empty">Could not load projects.</div>';
    }
}

async function fetchMarketCaps() {
    var addresses = lpState.projects
        .filter(function(p) { return p.token_address; })
        .map(function(p) { return p.token_address; });
    if (!addresses.length) return;

    for (var i = 0; i < addresses.length; i += 25) {
        var batch = addresses.slice(i, i + 25).join(',');
        try {
            var res = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + batch);
            if (!res.ok) continue;
            var data = await res.json();
            (data.pairs || []).forEach(function(pair) {
                var addr = pair.baseToken && pair.baseToken.address ? pair.baseToken.address.toLowerCase() : null;
                if (addr && pair.marketCap) {
                    if (!lpState.mcaps[addr] || pair.marketCap > lpState.mcaps[addr]) {
                        lpState.mcaps[addr] = pair.marketCap;
                    }
                }
            });
        } catch (e) { /* DexScreener unavailable */ }
    }
    renderLiveProjects();
}

function getFilteredProjects() {
    var list = lpState.projects.slice();

    if (lpState.filter === 'tokens') {
        list = list.filter(function(p) { return !!p.token_address; });
    } else if (lpState.filter === 'staking') {
        list = list.filter(function(p) { return !!p.staking_address; });
    } else if (lpState.filter === 'agents') {
        list = list.filter(function(p) { return p.agent_enabled === true; });
    }

    if (lpState.sort === 'mcap') {
        list.sort(function(a, b) {
            var ma = lpState.mcaps[(a.token_address || '').toLowerCase()] || 0;
            var mb = lpState.mcaps[(b.token_address || '').toLowerCase()] || 0;
            return mb - ma;
        });
    } else {
        list.sort(function(a, b) {
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });
    }

    return list;
}

function formatMcap(n) {
    if (!n || n <= 0) return '--';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + n.toFixed(0);
}

function renderLiveProjects() {
    var grid = document.getElementById('liveProjectsGrid');
    if (!grid) return;

    var list = getFilteredProjects();
    if (!list.length) {
        grid.innerHTML = '<div class="projects-empty">No projects match this filter.</div>';
        return;
    }

    var html = '';
    var tierMap = {
        incubated: { cls: 'lp-tier-incubated', label: 'Incubated' },
        permissionless: { cls: 'lp-tier-permissionless', label: 'Launched' },
        ecosystem: { cls: 'lp-tier-ecosystem', label: 'Ecosystem' },
        partner: { cls: 'lp-tier-partner', label: 'Partner' }
    };
    var colors = ['#6366f1','#ec4899','#f59e0b','#10b981','#8b5cf6','#ef4444','#06b6d4','#84cc16'];

    list.forEach(function(p, i) {
        var tier = tierMap[p.tier] || tierMap.permissionless;
        var mcapVal = p.token_address ? lpState.mcaps[(p.token_address || '').toLowerCase()] : null;
        var mcapStr = p.token_address ? formatMcap(mcapVal) : '';
        var name = p.token_name || p.name || 'Unnamed';
        var symbol = p.token_symbol || '';
        var logoColor = colors[i % colors.length];
        var logoHtml = p.logo_url
            ? '<img class="project-card-logo" src="' + p.logo_url + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
              + '<div class="project-card-logo-placeholder" style="display:none;background:' + logoColor + '">' + name[0].toUpperCase() + '</div>'
            : '<div class="project-card-logo-placeholder" style="background:' + logoColor + '">' + name[0].toUpperCase() + '</div>';

        var badges = '<span class="' + tier.cls + '">' + tier.label + '</span>';
        if (p.staking_address) badges += '<span class="lp-badge-staking">Staking Live</span>';
        if (p.agent_enabled) badges += '<span class="lp-badge-agent">AI Agent</span>';

        var href = '/inclawbator/' + (p.id || '');

        // Clanker + Uniswap buttons
        var actionsHtml = '';
        if (p.token_address) {
            actionsHtml = '<div class="project-card-actions">'
                + '<a href="https://www.clanker.world/clanker/' + p.token_address + '" target="_blank" rel="noopener" class="btn-clanker" onclick="event.stopPropagation()">Clanker</a>'
                + '<a href="https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=' + p.token_address + '&chain=base" target="_blank" rel="noopener" class="btn-uniswap" onclick="event.stopPropagation()">Uniswap</a>'
                + '</div>';
        }

        html += '<a class="project-card" href="' + href + '" style="animation-delay:' + (i * 0.05) + 's">'
            + '<div class="project-card-head">'
            + logoHtml
            + '<div><div class="project-card-name">' + name + '</div>'
            + (symbol ? '<div class="project-card-symbol">$' + symbol + '</div>' : '')
            + '</div></div>'
            + '<div class="project-card-badges">' + badges + '</div>'
            + (mcapStr ? '<div class="project-card-mcap">' + mcapStr + '</div>' : '')
            + actionsHtml
            + '</a>';
    });

    grid.innerHTML = html;
}

function initLiveProjectsUI() {
    var filtersEl = document.getElementById('lpFilters');
    if (filtersEl) {
        filtersEl.addEventListener('click', function(e) {
            var btn = e.target.closest('.lp-filter-tab');
            if (!btn) return;
            filtersEl.querySelectorAll('.lp-filter-tab').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            lpState.filter = btn.dataset.filter || 'all';
            renderLiveProjects();
        });
    }
    var sortEl = document.getElementById('lpSort');
    if (sortEl) {
        sortEl.addEventListener('change', function() {
            lpState.sort = sortEl.value;
            renderLiveProjects();
        });
    }
}

function init() {
    initLiveProjectsUI();
    loadLiveProjects();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

})();
