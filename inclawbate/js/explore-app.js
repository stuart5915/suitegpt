(function () {
    'use strict';

    const API = '/api/inclawbate/projects?public=1';
    const grid = document.getElementById('exploreGrid');
    const searchInput = document.getElementById('exploreSearch');
    const filterTabs = document.querySelectorAll('.explore-filter-tab');

    let allProjects = [];
    let activeFilter = 'all';
    let searchQuery = '';
    let debounceTimer = null;

    // ── Color from string ──
    function hashColor(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
        const hue = Math.abs(h) % 360;
        return 'hsl(' + hue + ', 55%, 35%)';
    }

    // ── Render a single card ──
    function cardHTML(p) {
        const logo = p.logo_url
            ? '<img class="project-card-logo" src="' + p.logo_url + '" alt="">'
            : '<div class="project-card-logo-placeholder" style="background:' + hashColor(p.name) + '">' + p.name.charAt(0).toUpperCase() + '</div>';

        const badges = [];
        if (p.app_slug) badges.push('<span class="project-card-badge project-card-badge--app">App</span>');
        if (p.token_address) badges.push('<span class="project-card-badge project-card-badge--token">Token</span>');
        if (p.staking_address) badges.push('<span class="project-card-badge project-card-badge--stake">Staking</span>');
        if (p.x_handle) badges.push('<span class="project-card-badge project-card-badge--x">@' + p.x_handle + '</span>');

        return '<a href="/projects/' + p.slug + '" class="project-card">' +
            '<div class="project-card-header">' + logo +
                '<div>' +
                    '<div class="project-card-name">' + escapeHtml(p.name) + '</div>' +
                    '<div class="project-card-slug">/' + p.slug + '</div>' +
                '</div>' +
            '</div>' +
            (p.description ? '<div class="project-card-desc">' + escapeHtml(p.description) + '</div>' : '') +
            (badges.length ? '<div class="project-card-badges">' + badges.join('') + '</div>' : '') +
        '</a>';
    }

    function escapeHtml(s) {
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    // ── Filter + render ──
    function render() {
        var q = searchQuery.toLowerCase();
        var filtered = allProjects.filter(function (p) {
            // category filter
            if (activeFilter === 'app' && !p.app_slug) return false;
            if (activeFilter === 'token' && !p.token_address) return false;
            if (activeFilter === 'stake' && !p.staking_address) return false;
            // search filter
            if (q) {
                var hay = ((p.name || '') + ' ' + (p.description || '') + ' ' + (p.slug || '')).toLowerCase();
                if (hay.indexOf(q) === -1) return false;
            }
            return true;
        });

        if (!filtered.length) {
            grid.innerHTML = '<div class="explore-empty">No projects found.</div>';
            return;
        }

        grid.innerHTML = filtered.map(cardHTML).join('');
    }

    // ── Load ──
    async function load() {
        try {
            var res = await fetch(API);
            var json = await res.json();
            allProjects = json.projects || [];
        } catch (e) {
            allProjects = [];
        }
        render();
    }

    // ── Events ──
    searchInput.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
            searchQuery = searchInput.value.trim();
            render();
        }, 200);
    });

    filterTabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            filterTabs.forEach(function (t) { t.classList.remove('active'); });
            tab.classList.add('active');
            activeFilter = tab.dataset.filter;
            render();
        });
    });

    // ── Format market cap ──
    function formatMcap(n) {
        if (!n || n <= 0) return '—';
        if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
        if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
        if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
        return '$' + n.toFixed(0);
    }

    // ── Hardcoded core tokens ──
    var CORE_TOKENS = [
        {
            token_name: 'CLAWS',
            token_symbol: 'CLAWS',
            token_address: '0x7ca47B141639B893C6782823C0b219f872056379',
            logo_url: '/inclawbate/assets/clawslogo.jpg',
            tier: 'incubated'
        },
        {
            token_name: 'Salvation 4 Humanity',
            token_symbol: 'S4H',
            token_address: '0x30F5BcB8bdA2B91430BE93dBaE08aC346884EB07',
            logo_url: null,
            tier: 'incubated'
        }
    ];

    // ── Load Tokens ──
    async function loadTokens() {
        var section = document.getElementById('exploreTokens');
        var grid = document.getElementById('exploreTokensGrid');
        try {
            var res = await fetch('/api/inclawbate/inclawbator');
            var json = await res.json();
            var projects = (json.projects || []).filter(function (p) { return p.token_address; });

            // Merge core tokens if missing
            CORE_TOKENS.forEach(function (ct) {
                var exists = projects.some(function (p) {
                    return p.token_address && p.token_address.toLowerCase() === ct.token_address.toLowerCase();
                });
                if (!exists) projects.unshift(ct);
            });

            // Fetch mcaps from DexScreener
            var addresses = projects.map(function (p) { return p.token_address; }).filter(Boolean);
            var mcaps = {};
            if (addresses.length) {
                try {
                    var dexRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + addresses.slice(0, 30).join(','));
                    var dexJson = await dexRes.json();
                    (dexJson.pairs || []).forEach(function (pair) {
                        var addr = (pair.baseToken && pair.baseToken.address) ? pair.baseToken.address.toLowerCase() : '';
                        if (addr && pair.marketCap && (!mcaps[addr] || pair.marketCap > mcaps[addr])) {
                            mcaps[addr] = pair.marketCap;
                        }
                    });
                } catch (e) { /* DexScreener unavailable */ }
            }

            // Attach mcap + sort by mcap desc
            projects.forEach(function (p) {
                p._mcap = mcaps[(p.token_address || '').toLowerCase()] || 0;
            });
            projects.sort(function (a, b) { return b._mcap - a._mcap; });

            var top = projects.slice(0, 6);
            if (!top.length) return;

            grid.innerHTML = top.map(function (p) {
                var logo = p.logo_url
                    ? '<img class="mini-card-logo" src="' + p.logo_url + '" alt="">'
                    : '<div class="mini-card-logo-placeholder" style="background:' + hashColor(p.token_name || p.token_symbol) + '">' + (p.token_symbol || '?').charAt(0) + '</div>';
                var uniswap = 'https://app.uniswap.org/swap?outputCurrency=' + p.token_address + '&chain=base';
                return '<div class="mini-card">' +
                    '<div class="mini-card-top">' + logo +
                        '<div class="mini-card-info">' +
                            '<div class="mini-card-name">' + escapeHtml(p.token_name || p.token_symbol) + '</div>' +
                            '<div class="mini-card-sub">$' + escapeHtml(p.token_symbol) + '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="mini-card-footer">' +
                        '<span class="mini-card-stat">' + formatMcap(p._mcap) + '</span>' +
                        '<a href="' + uniswap + '" target="_blank" rel="noopener" class="mini-card-btn mini-card-btn--trade">Trade</a>' +
                    '</div>' +
                '</div>';
            }).join('');
            section.classList.add('visible');
        } catch (e) { /* silent */ }
    }

    // ── Hardcoded staking pools ──
    var POOLS = [
        {
            name: 'CLAWS',
            ticker: 'CLAWS',
            logo: '/inclawbate/assets/clawslogo.jpg',
            description: 'Stake CLAWS, earn CLAWS. No lock. No tiers.',
            color: 'hsl(172, 50%, 42%)'
        },
        {
            name: 'Salvation 4 Humanity',
            ticker: 'S4H',
            logo: null,
            description: 'Stake S4H, earn INCLAWNCH. Powered by Inclawbate.',
            color: 'hsl(45, 60%, 50%)'
        },
        {
            name: 'CLAWNCH',
            ticker: 'CLAWNCH',
            logo: null,
            description: 'Legacy CLAWNCH staking pool.',
            color: 'hsl(260, 50%, 50%)'
        }
    ];

    // ── Load Pools ──
    function loadPools() {
        var section = document.getElementById('explorePools');
        var grid = document.getElementById('explorePoolsGrid');
        grid.innerHTML = POOLS.map(function (pool) {
            var logo = pool.logo
                ? '<img class="mini-card-logo" src="' + pool.logo + '" alt="">'
                : '<div class="mini-card-logo-placeholder" style="background:' + pool.color + '">' + pool.ticker.charAt(0) + '</div>';
            return '<div class="mini-card">' +
                '<div class="mini-card-top">' + logo +
                    '<div class="mini-card-info">' +
                        '<div class="mini-card-name">' + escapeHtml(pool.name) + '</div>' +
                        '<div class="mini-card-sub">$' + escapeHtml(pool.ticker) + '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="mini-card-desc">' + escapeHtml(pool.description) + '</div>' +
                '<div class="mini-card-footer">' +
                    '<span></span>' +
                    '<a href="/stake" class="mini-card-btn mini-card-btn--stake">Stake</a>' +
                '</div>' +
            '</div>';
        }).join('');
        section.classList.add('visible');
    }

    // ── Load Apps ──
    async function loadApps() {
        var section = document.getElementById('exploreApps');
        var grid = document.getElementById('exploreAppsGrid');
        try {
            var res = await fetch('/api/inclawbate/apps?sort=trending&limit=6');
            var json = await res.json();
            var apps = json.apps || [];
            if (!apps.length) return;

            grid.innerHTML = apps.map(function (app) {
                var initial = (app.name || '?').charAt(0);
                var logo = '<div class="mini-card-logo-placeholder" style="background:' + hashColor(app.name || app.slug) + '">' + initial + '</div>';
                return '<a href="/s/' + app.slug + '" class="mini-card" style="text-decoration:none">' +
                    '<div class="mini-card-top">' + logo +
                        '<div class="mini-card-info">' +
                            '<div class="mini-card-name">' + escapeHtml(app.name) + '</div>' +
                            (app.category ? '<div class="mini-card-sub">' + escapeHtml(app.category) + '</div>' : '') +
                        '</div>' +
                    '</div>' +
                    (app.description ? '<div class="mini-card-desc">' + escapeHtml(app.description) + '</div>' : '') +
                    '<div class="mini-card-footer">' +
                        '<span></span>' +
                        '<span class="mini-card-btn mini-card-btn--use">Use</span>' +
                    '</div>' +
                '</a>';
            }).join('');
            section.classList.add('visible');
        } catch (e) { /* silent */ }
    }

    load();
    loadPools();
    loadTokens();
    loadApps();
})();
