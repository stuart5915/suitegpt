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

    load();
})();
