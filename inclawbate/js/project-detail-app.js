(function () {
    'use strict';

    var loadingEl = document.getElementById('pdLoading');
    var notFoundEl = document.getElementById('pdNotFound');
    var pageEl = document.getElementById('pdPage');

    function getSlug() {
        var parts = window.location.pathname.split('/');
        // /projects/my-slug → parts[2]
        return (parts[2] || '').toLowerCase().trim();
    }

    function escapeHtml(s) {
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    function shortAddr(addr) {
        if (!addr || addr.length < 10) return addr || '';
        return addr.slice(0, 6) + '...' + addr.slice(-4);
    }

    function hashColor(str) {
        var h = 0;
        for (var i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
        return 'hsl(' + (Math.abs(h) % 360) + ', 55%, 35%)';
    }

    function showState(state) {
        loadingEl.classList.toggle('hidden', state !== 'loading');
        notFoundEl.classList.toggle('hidden', state !== 'notfound');
        pageEl.classList.toggle('hidden', state !== 'loaded');
    }

    function render(p) {
        document.title = p.name + ' — Inclawbate';

        // Logo
        var logoEl = document.getElementById('pdLogo');
        if (p.logo_url) {
            logoEl.innerHTML = '<img class="pd-hero-logo" src="' + p.logo_url + '" alt="">';
        } else {
            logoEl.innerHTML = '<div class="pd-hero-logo-placeholder" style="background:' + hashColor(p.name) + '">' + p.name.charAt(0).toUpperCase() + '</div>';
        }

        // Name, slug, description
        document.getElementById('pdName').textContent = p.name;
        document.getElementById('pdSlug').textContent = '/' + p.slug;
        document.getElementById('pdDesc').textContent = p.description || '';

        // Links row
        var links = [];
        if (p.website_url) links.push('<a href="' + p.website_url + '" target="_blank" rel="noopener" class="pd-link">Website</a>');
        if (p.x_handle) links.push('<a href="https://x.com/' + p.x_handle + '" target="_blank" rel="noopener" class="pd-link">@' + escapeHtml(p.x_handle) + '</a>');
        if (p.telegram_url) links.push('<a href="' + p.telegram_url + '" target="_blank" rel="noopener" class="pd-link">Telegram</a>');
        if (p.token_address) {
            links.push('<a href="https://dexscreener.com/base/' + p.token_address + '" target="_blank" rel="noopener" class="pd-link">Chart</a>');
            links.push('<a href="https://app.uniswap.org/swap?outputCurrency=' + p.token_address + '&chain=base" target="_blank" rel="noopener" class="pd-link">Trade</a>');
        }
        if (p.staking_address) links.push('<a href="/stake" class="pd-link">Stake</a>');
        document.getElementById('pdLinks').innerHTML = links.join('');

        // Info grid
        var cards = [];
        if (p.app_slug) {
            cards.push(
                '<div class="pd-info-card">' +
                    '<div class="pd-info-label">App</div>' +
                    '<div class="pd-info-value"><a href="/s/' + p.app_slug + '">' + escapeHtml(p.app_slug) + '</a></div>' +
                '</div>'
            );
        }
        if (p.token_address) {
            cards.push(
                '<div class="pd-info-card">' +
                    '<div class="pd-info-label">Token</div>' +
                    '<div class="pd-info-value"><a href="/tokens/' + p.token_address + '">' + shortAddr(p.token_address) + '</a></div>' +
                '</div>'
            );
        }
        if (p.staking_address) {
            cards.push(
                '<div class="pd-info-card">' +
                    '<div class="pd-info-label">Staking</div>' +
                    '<div class="pd-info-value"><span class="pd-active-dot"></span>Live</div>' +
                '</div>'
            );
        }
        if (p.created_at) {
            var d = new Date(p.created_at);
            cards.push(
                '<div class="pd-info-card">' +
                    '<div class="pd-info-label">Launched</div>' +
                    '<div class="pd-info-value">' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + '</div>' +
                '</div>'
            );
        }
        document.getElementById('pdInfoGrid').innerHTML = cards.join('');

        // Long description
        if (p.long_description && p.long_description.trim()) {
            var aboutSection = document.getElementById('pdAboutSection');
            aboutSection.classList.remove('hidden');
            var paragraphs = p.long_description.trim().split(/\n\s*\n|\n/).filter(function(s) { return s.trim(); });
            document.getElementById('pdAboutContent').innerHTML = paragraphs.map(function(para) {
                return '<p>' + escapeHtml(para.trim()) + '</p>';
            }).join('');
        }

        // App embed
        if (p.app_slug) {
            var embedSection = document.getElementById('pdEmbedSection');
            embedSection.classList.remove('hidden');
            document.getElementById('pdEmbedIframe').src = '/s/' + p.app_slug;
        }

        // DexScreener chart
        if (p.token_address) {
            var chartSection = document.getElementById('pdChartSection');
            chartSection.classList.remove('hidden');
            document.getElementById('pdChartIframe').src =
                'https://dexscreener.com/base/' + p.token_address + '?embed=1&theme=dark&info=0';
        }

        showState('loaded');
    }

    async function loadProject() {
        var slug = getSlug();
        if (!slug) { showState('notfound'); return; }

        try {
            var res = await fetch('/api/inclawbate/projects?slug=' + encodeURIComponent(slug));
            if (!res.ok) { showState('notfound'); return; }
            var json = await res.json();
            if (!json.project) { showState('notfound'); return; }
            render(json.project);
        } catch (e) {
            showState('notfound');
        }
    }

    showState('loading');
    loadProject();
})();
