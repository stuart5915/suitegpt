(function () {
    'use strict';

    var loadingEl = document.getElementById('pdLoading');
    var notFoundEl = document.getElementById('pdNotFound');
    var pageEl = document.getElementById('pdPage');

    function getSlug() {
        var parts = window.location.pathname.split('/');
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

    function formatUsd(n) {
        if (!n || n <= 0) return '--';
        if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
        if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
        if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
        if (n >= 1) return '$' + n.toFixed(2);
        if (n >= 0.0001) return '$' + n.toFixed(6);
        return '$' + n.toExponential(2);
    }

    function formatPct(n) {
        if (n === null || n === undefined) return '--';
        var prefix = n >= 0 ? '+' : '';
        return prefix + n.toFixed(2) + '%';
    }

    function showState(state) {
        loadingEl.classList.toggle('hidden', state !== 'loading');
        notFoundEl.classList.toggle('hidden', state !== 'notfound');
        pageEl.classList.toggle('hidden', state !== 'loaded');
    }

    function render(p, market) {
        document.title = p.name + ' — Inclawbate';

        // Logo
        var logoEl = document.getElementById('pdLogo');
        if (p.logo_url) {
            logoEl.innerHTML = '<img class="pd-hero-logo" src="' + p.logo_url + '" alt="">';
        } else {
            logoEl.innerHTML = '<div class="pd-hero-logo-placeholder" style="background:' + hashColor(p.name) + '">' + p.name.charAt(0).toUpperCase() + '</div>';
        }

        // Name, slug
        document.getElementById('pdName').textContent = p.name;
        document.getElementById('pdSlug').textContent = '/' + p.slug;
        document.getElementById('pdDesc').textContent = p.description || '';

        // Tier badge
        var tierMap = {
            incubated: 'pd-tier-incubated',
            permissionless: 'pd-tier-permissionless',
            ecosystem: 'pd-tier-ecosystem',
            partner: 'pd-tier-partner'
        };
        var tierLabels = {
            incubated: 'Incubated',
            permissionless: 'Launched',
            ecosystem: 'Ecosystem',
            partner: 'Partner'
        };
        if (p.tier) {
            var tierEl = document.getElementById('pdTierBadge');
            tierEl.className = 'pd-tier ' + (tierMap[p.tier] || 'pd-tier-permissionless');
            tierEl.textContent = tierLabels[p.tier] || 'Launched';
            tierEl.classList.remove('hidden');
        }

        // Chain badge
        if (p.token_address) {
            var chainEl = document.getElementById('pdChainBadge');
            chainEl.textContent = 'Base';
            chainEl.classList.remove('hidden');
        }

        // Action buttons
        var actions = [];
        if (p.token_address) {
            actions.push('<a href="https://www.clanker.world/clanker/' + p.token_address + '" target="_blank" rel="noopener" class="pd-action pd-action-clanker">Buy on Clanker</a>');
            actions.push('<a href="https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=' + p.token_address + '&chain=base" target="_blank" rel="noopener" class="pd-action pd-action-uniswap">Buy on Uniswap</a>');
        }
        if (p.staking_address && p.token_symbol) {
            actions.push('<a href="/stake/' + p.token_symbol.toLowerCase() + '" class="pd-action pd-action-stake">Stake</a>');
        }
        if (p.token_address) {
            actions.push('<a href="https://dexscreener.com/base/' + p.token_address + '" target="_blank" rel="noopener" class="pd-action pd-action-dexscreener">DexScreener</a>');
            actions.push('<button class="pd-action pd-action-copy" data-ca="' + p.token_address + '">Copy CA</button>');
        }
        if (p.website_url) {
            var href = p.website_url.startsWith('http') ? p.website_url : 'https://' + p.website_url;
            actions.push('<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener" class="pd-action pd-action-website">Website</a>');
        }
        if (p.x_handle) {
            actions.push('<a href="https://x.com/' + escapeHtml(p.x_handle) + '" target="_blank" rel="noopener" class="pd-action pd-action-x">@' + escapeHtml(p.x_handle) + '</a>');
        }
        if (p.telegram_url) {
            var tgHref = p.telegram_url.startsWith('http') ? p.telegram_url : 'https://' + p.telegram_url;
            actions.push('<a href="' + escapeHtml(tgHref) + '" target="_blank" rel="noopener" class="pd-action pd-action-telegram">Telegram</a>');
        }
        if (p.app_slug) {
            actions.push('<a href="/s/' + p.app_slug + '" class="pd-action pd-action-app">Open App</a>');
        }

        var actionsEl = document.getElementById('pdActions');
        if (actions.length > 0) {
            actionsEl.innerHTML = actions.join('');
            actionsEl.classList.remove('hidden');
        }

        // Market stats
        if (market && p.token_address) {
            var price = formatUsd(market.priceUsd);
            var mcap = formatUsd(market.marketCap);
            var vol = formatUsd(market.volume24h);
            var change = formatPct(market.priceChange24h);
            var changeCls = market.priceChange24h >= 0 ? 'positive' : 'negative';
            var liq = formatUsd(market.liquidity);
            var chain = (market.chainId || 'base').charAt(0).toUpperCase() + (market.chainId || 'base').slice(1);

            var statsEl = document.getElementById('pdStats');
            statsEl.innerHTML =
                '<div class="pd-stat"><div class="pd-stat-label">Price</div><div class="pd-stat-value">' + price + '</div></div>' +
                '<div class="pd-stat"><div class="pd-stat-label">Market Cap</div><div class="pd-stat-value">' + mcap + '</div></div>' +
                '<div class="pd-stat"><div class="pd-stat-label">24h Change</div><div class="pd-stat-value ' + changeCls + '">' + change + '</div></div>' +
                '<div class="pd-stat"><div class="pd-stat-label">24h Volume</div><div class="pd-stat-value">' + vol + '</div></div>' +
                '<div class="pd-stat"><div class="pd-stat-label">Liquidity</div><div class="pd-stat-value">' + liq + '</div></div>' +
                '<div class="pd-stat"><div class="pd-stat-label">Chain</div><div class="pd-stat-value">' + escapeHtml(chain) + '</div></div>';
            statsEl.classList.remove('hidden');
        }

        // Token info card
        if (p.token_address) {
            var tokenInfoEl = document.getElementById('pdTokenInfo');
            tokenInfoEl.innerHTML =
                '<span class="pd-token-label">Contract</span>' +
                '<span class="pd-token-addr">' + p.token_address + '</span>' +
                (p.token_symbol ? '<span class="pd-token-symbol">$' + escapeHtml(p.token_symbol) + '</span>' : '') +
                '<button class="pd-token-copy" data-ca="' + p.token_address + '">Copy</button>';
            tokenInfoEl.classList.remove('hidden');
        }

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

        // Price chart (before about section)
        if (p.token_address) {
            var chartSection = document.getElementById('pdChartSection');
            chartSection.classList.remove('hidden');
            document.getElementById('pdChartIframe').src =
                'https://dexscreener.com/base/' + p.token_address + '?embed=1&theme=dark&info=0';
        }

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
            var embedIframe = document.getElementById('pdEmbedIframe');
            var embedUrl = '/s/' + p.app_slug;
            // Pass auth to embedded app so it doesn't need its own wallet connect
            try {
                var token = localStorage.getItem('inclawbate_token');
                var prof = JSON.parse(localStorage.getItem('inclawbate_profile') || 'null');
                if (token && prof && prof.wallet_address) {
                    var sep = embedUrl.includes('?') ? '&' : '?';
                    embedUrl += sep + 'wallet=' + encodeURIComponent(prof.wallet_address);
                }
            } catch(e) {}
            embedIframe.src = embedUrl;

            var fsBtn = document.getElementById('pdFullscreen');
            if (fsBtn) {
                fsBtn.addEventListener('click', function() {
                    if (embedIframe.requestFullscreen) embedIframe.requestFullscreen();
                    else if (embedIframe.webkitRequestFullscreen) embedIframe.webkitRequestFullscreen();
                });
            }
        }

        showState('loaded');

        // Bind copy CA buttons
        var copyBtns = document.querySelectorAll('[data-ca]');
        copyBtns.forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                var ca = this.getAttribute('data-ca');
                var el = this;
                var origText = el.textContent;
                navigator.clipboard.writeText(ca).then(function() {
                    el.textContent = 'Copied!';
                    setTimeout(function() { el.textContent = origText; }, 1500);
                });
            });
        });
    }

    async function loadProject() {
        var slug = getSlug();
        if (!slug) { showState('notfound'); return; }

        try {
            var res = await fetch('/api/inclawbate/projects?slug=' + encodeURIComponent(slug));
            if (!res.ok) { showState('notfound'); return; }
            var json = await res.json();
            if (!json.project) { showState('notfound'); return; }

            var project = json.project;
            var market = null;

            // Fetch DexScreener data if token exists
            if (project.token_address) {
                try {
                    var dsRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + project.token_address);
                    if (dsRes.ok) {
                        var dsData = await dsRes.json();
                        var pairs = dsData.pairs || [];
                        if (pairs.length > 0) {
                            pairs.sort(function(a, b) {
                                return (b.liquidity && b.liquidity.usd || 0) - (a.liquidity && a.liquidity.usd || 0);
                            });
                            var best = pairs[0];
                            market = {
                                priceUsd: parseFloat(best.priceUsd) || 0,
                                marketCap: best.marketCap || best.fdv || 0,
                                volume24h: best.volume && best.volume.h24 || 0,
                                priceChange24h: best.priceChange && best.priceChange.h24 || 0,
                                liquidity: best.liquidity && best.liquidity.usd || 0,
                                chainId: best.chainId || 'base'
                            };
                        }
                    }
                } catch (e) { /* DexScreener unavailable */ }
            }

            render(project, market);
        } catch (e) {
            showState('notfound');
        }
    }

    showState('loading');
    loadProject();
})();
