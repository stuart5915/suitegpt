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
    let savedSlugs = new Set();

    // ── Color from string ──
    function hashColor(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
        const hue = Math.abs(h) % 360;
        return 'hsl(' + hue + ', 55%, 35%)';
    }

    function escapeHtml(s) {
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    function formatMcap(n) {
        if (!n || n <= 0) return '—';
        if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
        if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
        if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
        return '$' + n.toFixed(0);
    }

    function logoHtml(url, name, fallbackColor) {
        if (url) return '<img class="exp-logo" src="' + url + '" alt="">';
        var bg = fallbackColor || hashColor(name || '?');
        return '<div class="exp-logo-ph" style="background:' + bg + '">' + (name || '?').charAt(0).toUpperCase() + '</div>';
    }

    function getAuth() {
        try {
            var token = localStorage.getItem('inclawbate_token');
            if (token) return token;
        } catch (e) {}
        return null;
    }

    // ── Render a single project card (top grid) ──
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

    // ── Filter + render projects grid ──
    function render() {
        var q = searchQuery.toLowerCase();
        var filtered = allProjects.filter(function (p) {
            if (activeFilter === 'app' && !p.app_slug) return false;
            if (activeFilter === 'token' && !p.token_address) return false;
            if (activeFilter === 'stake' && !p.staking_address) return false;
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

    // ── Load projects ──
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

    // ── Load Tokens (table rows) ──
    async function loadTokens() {
        var section = document.getElementById('exploreTokens');
        var tbody = document.getElementById('exploreTokensBody');
        try {
            var res = await fetch('/api/inclawbate/inclawbator');
            var json = await res.json();
            var projects = (json.projects || []).filter(function (p) { return p.token_address; });

            CORE_TOKENS.forEach(function (ct) {
                var exists = projects.some(function (p) {
                    return p.token_address && p.token_address.toLowerCase() === ct.token_address.toLowerCase();
                });
                if (!exists) projects.unshift(ct);
            });

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
                } catch (e) {}
            }

            projects.forEach(function (p) {
                p._mcap = mcaps[(p.token_address || '').toLowerCase()] || 0;
            });
            projects.sort(function (a, b) { return b._mcap - a._mcap; });

            var top = projects.slice(0, 6);
            if (!top.length) return;

            tbody.innerHTML = top.map(function (p, i) {
                var name = p.token_name || p.token_symbol;
                var uniswap = 'https://app.uniswap.org/swap?outputCurrency=' + p.token_address + '&chain=base';
                return '<tr onclick="window.open(\'' + uniswap + '\',\'_blank\')">' +
                    '<td><span class="exp-rank">' + (i + 1) + '</span></td>' +
                    '<td><div class="exp-name-cell">' + logoHtml(p.logo_url, name) +
                        '<div><span class="exp-name">' + escapeHtml(name) + '</span><span class="exp-sub">$' + escapeHtml(p.token_symbol) + '</span></div>' +
                    '</div></td>' +
                    '<td><span class="exp-stat">' + formatMcap(p._mcap) + '</span></td>' +
                    '<td><div class="exp-actions"><a href="' + uniswap + '" target="_blank" rel="noopener" class="exp-btn exp-btn--trade" onclick="event.stopPropagation()">Trade</a></div></td>' +
                '</tr>';
            }).join('');
            section.classList.add('visible');
        } catch (e) {}
    }

    // ── Hardcoded staking pools ──
    var POOLS = [
        { name: 'CLAWS', ticker: 'CLAWS', logo: '/inclawbate/assets/clawslogo.jpg', description: 'Stake CLAWS, earn CLAWS. No lock. No tiers.', color: 'hsl(172, 50%, 42%)' },
        { name: 'Salvation 4 Humanity', ticker: 'S4H', logo: null, description: 'Stake S4H, earn INCLAWNCH. Powered by Inclawbate.', color: 'hsl(45, 60%, 50%)' },
        { name: 'CLAWNCH', ticker: 'CLAWNCH', logo: null, description: 'Legacy CLAWNCH staking pool.', color: 'hsl(260, 50%, 50%)' }
    ];

    // ── Load Pools (table rows) ──
    function loadPools() {
        var section = document.getElementById('explorePools');
        var tbody = document.getElementById('explorePoolsBody');
        tbody.innerHTML = POOLS.map(function (pool, i) {
            return '<tr onclick="window.location.href=\'/stake\'">' +
                '<td><span class="exp-rank">' + (i + 1) + '</span></td>' +
                '<td><div class="exp-name-cell">' + logoHtml(pool.logo, pool.name, pool.color) +
                    '<div><span class="exp-name">' + escapeHtml(pool.name) + '</span><span class="exp-sub">$' + escapeHtml(pool.ticker) + '</span></div>' +
                '</div></td>' +
                '<td><span class="exp-desc">' + escapeHtml(pool.description) + '</span></td>' +
                '<td><div class="exp-actions"><a href="/stake" class="exp-btn exp-btn--stake" onclick="event.stopPropagation()">Stake</a></div></td>' +
            '</tr>';
        }).join('');
        section.classList.add('visible');
    }

    // ── Load saved slugs ──
    async function loadSavedSlugs() {
        var token = getAuth();
        if (!token) return;
        try {
            var res = await fetch('/api/inclawbate/apps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ action: 'get_saved' })
            });
            var json = await res.json();
            (json.slugs || []).forEach(function (s) { savedSlugs.add(s); });
        } catch (e) {}
    }

    // ── Save / Unsave app ──
    window.toggleSaveApp = async function (slug, btn) {
        var token = getAuth();
        if (!token) return;
        var isSaved = savedSlugs.has(slug);
        var action = isSaved ? 'unsave' : 'save';
        try {
            var res = await fetch('/api/inclawbate/apps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ action: action, app_slug: slug })
            });
            if (res.ok) {
                if (isSaved) {
                    savedSlugs.delete(slug);
                    btn.classList.remove('saved');
                    btn.textContent = 'Save';
                } else {
                    savedSlugs.add(slug);
                    btn.classList.add('saved');
                    btn.textContent = 'Saved';
                }
            }
        } catch (e) {}
    };

    // ── Load Apps (table rows) ──
    async function loadApps() {
        var section = document.getElementById('exploreApps');
        var tbody = document.getElementById('exploreAppsBody');
        try {
            var res = await fetch('/api/inclawbate/apps?sort=trending&limit=6');
            var json = await res.json();
            var apps = json.apps || [];
            if (!apps.length) return;

            var hasAuth = !!getAuth();

            tbody.innerHTML = apps.map(function (app, i) {
                var saveBtn = hasAuth
                    ? '<button class="exp-btn exp-btn--save' + (savedSlugs.has(app.slug) ? ' saved' : '') + '" onclick="event.stopPropagation();toggleSaveApp(\'' + escapeHtml(app.slug) + '\',this)">' + (savedSlugs.has(app.slug) ? 'Saved' : 'Save') + '</button>'
                    : '';
                return '<tr onclick="window.location.href=\'/s/' + escapeHtml(app.slug) + '\'">' +
                    '<td><span class="exp-rank">' + (i + 1) + '</span></td>' +
                    '<td><div class="exp-name-cell">' + logoHtml(null, app.name || app.slug) +
                        '<div><span class="exp-name">' + escapeHtml(app.name) + '</span>' +
                        (app.category ? '<span class="exp-sub">' + escapeHtml(app.category) + '</span>' : '') +
                        '</div></div></td>' +
                    '<td><span class="exp-desc">' + escapeHtml(app.description || '') + '</span></td>' +
                    '<td><div class="exp-actions">' + saveBtn +
                        '<a href="/s/' + escapeHtml(app.slug) + '" class="exp-btn exp-btn--use" onclick="event.stopPropagation()">Use</a>' +
                    '</div></td>' +
                '</tr>';
            }).join('');
            section.classList.add('visible');
        } catch (e) {}
    }

    // ── Init ──
    load();
    loadPools();
    loadTokens();
    loadSavedSlugs().then(loadApps);
})();
