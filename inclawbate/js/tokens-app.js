// Tokens Page — CMC-style table of Inclawbator-launched tokens

(function() {
'use strict';

var API_BASE = '/api/inclawbate/inclawbator';

window.addTokenToWallet = async function(address, symbol, decimals, image) {
    var provider = window.ethereum || (window.phantom && window.phantom.ethereum) || (window.WalletKit && window.WalletKit.getProvider());
    if (!provider) { alert('No wallet detected. Please install MetaMask or another wallet.'); return; }
    try {
        await provider.request({
            method: 'wallet_watchAsset',
            params: { type: 'ERC20', options: {
                address: address,
                symbol: symbol,
                decimals: decimals || 18,
                image: image || ''
            }}
        });
    } catch (e) { console.log('User rejected or error:', e); }
};

// Featured tokens not in the inclawbator API
var EXTRA_TOKENS = [
    {
        id: 'claws',
        token_name: 'CLAWS',
        token_symbol: 'CLAWS',
        token_address: '0x7ca47B141639B893C6782823C0b219f872056379',
        logo_url: '/inclawbate/assets/clawslogo.jpg',
        status: 'active',
        tier: 'ecosystem',
        staking_address: '0x551d9dCd8B49893b9D0E1CA41a128ec202845F40',
        created_at: '2025-01-01T00:00:00Z'
    },
    {
        id: 's4h',
        token_name: 'Salvation 4 Humanity',
        token_symbol: 'S4H',
        token_address: '0x30F5BcB8bdA2B91430BE93dBaE08aC346884EB07',
        logo_url: '/salvation4humanity/assets/s4hlogo.png',
        status: 'active',
        tier: 'partner',
        staking_address: '0x3A7F8a12fD0DAe62dd45e1E641dBb687a90F170D',
        created_at: '2025-06-01T00:00:00Z'
    },
    {
        id: 'pokerai',
        token_name: 'PokerAI',
        token_symbol: 'POKERAI',
        token_address: '0x623a5cFC2e2E04957373A9F45B2b2BEEabf82B07',
        logo_url: '/inclawbate/assets/pokerai-logo.png',
        status: 'active',
        tier: 'ecosystem',
        created_at: '2026-03-14T00:00:00Z'
    },
    {
        id: 'mirrormind',
        token_name: 'Mirror Mind',
        token_symbol: 'MIND',
        token_address: '0x997494e831a2660F5d411BCe58695437617a7B07',
        logo_url: '/inclawbate/assets/mirrormind.png',
        status: 'active',
        tier: 'incubated',
        created_at: '2026-03-18T00:00:00Z'
    },
    {
        id: 'oddsclaw',
        token_name: 'OddsClaw',
        token_symbol: 'ODDS',
        token_address: '0x3a70Ce6D5DB46348B6930505cf55261c17Cd4B07',
        logo_url: '/inclawbate/assets/oddsclaw-logo.png',
        status: 'active',
        tier: 'ecosystem',
        created_at: '2026-03-19T00:00:00Z'
    }
];

var lpState = { projects: [], mcaps: {}, filter: 'all', sort: 'mcap' };

async function loadLiveProjects() {
    try {
        var res = await fetch(API_BASE);
        if (!res.ok) throw new Error('Failed to fetch projects');
        var data = await res.json();
        var apiProjects = (data.projects || data || []).filter(function(p) {
            return p.status === 'active' || p.status === 'launched';
        });
        // Merge extra tokens (avoid duplicates by address)
        var existingAddrs = {};
        apiProjects.forEach(function(p) {
            if (p.token_address) existingAddrs[p.token_address.toLowerCase()] = true;
        });
        EXTRA_TOKENS.forEach(function(t) {
            if (!existingAddrs[t.token_address.toLowerCase()]) {
                apiProjects.push(t);
            }
        });
        lpState.projects = apiProjects;
        renderTable();
        fetchMarketCaps();
    } catch (e) {
        var c = document.getElementById('tokensContainer');
        if (c) c.innerHTML = '<div class="tokens-empty">Could not load tokens.</div>';
    }
}

async function fetchMarketCaps() {
    var addresses = lpState.projects
        .filter(function(p) { return p.token_address; })
        .map(function(p) { return p.token_address; });
    if (!addresses.length) return;

    // DexScreener (primary)
    for (var i = 0; i < addresses.length; i += 25) {
        var batch = addresses.slice(i, i + 25).join(',');
        try {
            var res = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + batch);
            if (!res.ok) continue;
            var data = await res.json();
            (data.pairs || []).forEach(function(pair) {
                var addr = pair.baseToken && pair.baseToken.address ? pair.baseToken.address.toLowerCase() : null;
                var val = pair.marketCap || pair.fdv || 0;
                if (addr && val > 0) {
                    if (!lpState.mcaps[addr] || val > lpState.mcaps[addr]) {
                        lpState.mcaps[addr] = val;
                    }
                }
            });
        } catch (e) { /* DexScreener unavailable */ }
    }
    renderTable();

    // GeckoTerminal fallback for tokens DexScreener missed
    var missing = addresses.filter(function(a) { return !lpState.mcaps[a.toLowerCase()]; });
    if (!missing.length) return;
    var changed = false;

    // Split by chain and batch via multi endpoint
    var baseMissing = missing.filter(function(a) { return a.startsWith('0x'); });
    var solMissing = missing.filter(function(a) { return !a.startsWith('0x'); });

    async function geckoMulti(network, addrs) {
        if (!addrs.length) return;
        try {
            var url = 'https://api.geckoterminal.com/api/v2/networks/' + network + '/tokens/multi/' + addrs.join(',');
            var gRes = await fetch(url);
            if (!gRes.ok) return;
            var gData = await gRes.json();
            var tokens = gData.data || [];
            tokens.forEach(function(t) {
                var attrs = t.attributes;
                if (!attrs) return;
                var addr = (attrs.address || '').toLowerCase();
                var fdv = attrs.fdv_usd ? parseFloat(attrs.fdv_usd) : 0;
                var mc = attrs.market_cap_usd ? parseFloat(attrs.market_cap_usd) : 0;
                var val = mc || fdv;
                if (addr && val > 0) {
                    lpState.mcaps[addr] = val;
                    changed = true;
                }
            });
        } catch (e) { /* GeckoTerminal unavailable */ }
    }

    await geckoMulti('base', baseMissing);
    await geckoMulti('solana', solMissing);
    if (changed) renderTable();
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

function renderTable() {
    var container = document.getElementById('tokensContainer');
    if (!container) return;

    var list = getFilteredProjects();
    if (!list.length) {
        container.innerHTML = '<div class="tokens-empty">No tokens match this filter.</div>';
        return;
    }

    var tierMap = {
        incubated: { cls: 'lp-tier-incubated', label: 'Incubated' },
        permissionless: { cls: 'lp-tier-permissionless', label: 'Launched' },
        ecosystem: { cls: 'lp-tier-ecosystem', label: 'Ecosystem' },
        partner: { cls: 'lp-tier-partner', label: 'Partner' }
    };
    var colors = ['#6366f1','#ec4899','#f59e0b','#10b981','#8b5cf6','#ef4444','#06b6d4','#84cc16'];

    var html = '<table class="tokens-table"><thead><tr>'
        + '<th>#</th>'
        + '<th class="col-name">Name</th>'
        + '<th class="col-mcap">Market Cap</th>'
        + '<th class="col-badges">Status</th>'
        + '<th class="col-actions">Trade</th>'
        + '</tr></thead><tbody>';

    list.forEach(function(p, i) {
        var tier = tierMap[p.tier] || tierMap.permissionless;
        var mcapVal = p.token_address ? lpState.mcaps[(p.token_address || '').toLowerCase()] : null;
        var mcapStr = p.token_address ? formatMcap(mcapVal) : '--';
        var name = p.token_name || p.name || 'Unnamed';
        var symbol = p.token_symbol || '';
        var logoColor = colors[i % colors.length];
        // All tokens navigate to detail page
        var href = p.token_address ? '/tokens/' + p.token_address : '/tokens';

        var logoHtml = p.logo_url
            ? '<img class="tok-logo" src="' + p.logo_url + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
              + '<div class="tok-logo-placeholder" style="display:none;background:' + logoColor + '">' + name[0].toUpperCase() + '</div>'
            : '<div class="tok-logo-placeholder" style="background:' + logoColor + '">' + name[0].toUpperCase() + '</div>';

        var isSolana = p.chain === 'solana';
        var isCardano = p.chain === 'cardano';
        var chainBadge = isCardano
            ? '<span class="lp-badge-chain lp-chain-cardano">Cardano</span>'
            : isSolana
            ? '<span class="lp-badge-chain lp-chain-solana">Solana</span>'
            : '<span class="lp-badge-chain lp-chain-base">Base</span>';
        var badges = chainBadge + '<span class="' + tier.cls + '">' + tier.label + '</span>';
        if (p.staking_address) badges += '<span class="lp-badge-staking">Staking</span>';
        if (p.agent_enabled) badges += '<span class="lp-badge-agent">Agent</span>';

        var actions = '';
        var CLAWS_ADDR = '0x7ca47B141639B893C6782823C0b219f872056379';
        if (p.token_address) {
            if (isCardano) {
                var cardanoPolicyId = p.cardano_policy_id || p.token_address.slice(0, 56);
                var cardanoAssetName = p.cardano_asset_name || p.token_address.slice(56);
                actions += '<a href="https://app.minswap.org/swap?currencySymbolA=&tokenNameA=&currencySymbolB=' + cardanoPolicyId + '&tokenNameB=' + cardanoAssetName + '" target="_blank" rel="noopener" class="btn-uniswap" style="background:linear-gradient(135deg,#1a44b7,#4a84ff)">Minswap</a>';
            } else if (isSolana) {
                actions += '<a href="https://jup.ag/swap/SOL-' + p.token_address + '" target="_blank" rel="noopener" class="btn-uniswap" style="background:linear-gradient(135deg,#00d18c,#08b4c9)">Jupiter</a>';
            } else {
                if (p.token_address.toLowerCase() !== CLAWS_ADDR.toLowerCase()) {
                    actions += '<a href="https://www.clanker.world/clanker/' + p.token_address + '" target="_blank" rel="noopener" class="btn-clanker">Clanker</a>';
                }
                actions += '<a href="https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=' + p.token_address + '&chain=base" target="_blank" rel="noopener" class="btn-uniswap">Uniswap</a>';
            }
        }
        if (p.staking_address && symbol) {
            actions += '<a href="/stake/' + symbol.toLowerCase() + '" class="btn-stake">Stake</a>';
        }
        if (p.token_address && symbol) {
            var logoAbsolute = p.logo_url ? (p.logo_url.startsWith('http') ? p.logo_url : 'https://inclawbate.com' + p.logo_url) : '';
            actions += '<button class="btn-wallet" onclick="event.stopPropagation();addTokenToWallet(\'' + p.token_address + '\',\'' + symbol + '\',18,\'' + logoAbsolute + '\')" title="Add $' + symbol + ' to wallet">+ Wallet</button>';
        }

        html += '<tr data-href="' + href + '">'
            + '<td><span class="tok-rank">' + (i + 1) + '</span></td>'
            + '<td><div class="tok-name-cell">' + logoHtml + '<div><span class="tok-name">' + name + '</span>' + (symbol ? '<span class="tok-symbol">$' + symbol + '</span>' : '') + '</div></div></td>'
            + '<td><span class="tok-mcap">' + mcapStr + '</span></td>'
            + '<td><div class="tok-badges">' + badges + '</div></td>'
            + '<td><div class="tok-actions">' + actions + '</div></td>'
            + '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    // Row click → navigate to project (but not if clicking a trade button)
    container.querySelectorAll('tr[data-href]').forEach(function(row) {
        row.addEventListener('click', function(e) {
            if (e.target.closest('.tok-actions a') || e.target.closest('.tok-actions button')) return;
            var href = row.dataset.href;
            if (href.startsWith('http')) {
                window.open(href, '_blank', 'noopener');
            } else {
                window.location.href = href;
            }
        });
    });
}

function initUI() {
    var filtersEl = document.getElementById('lpFilters');
    if (filtersEl) {
        filtersEl.addEventListener('click', function(e) {
            var btn = e.target.closest('.lp-filter-tab');
            if (!btn) return;
            filtersEl.querySelectorAll('.lp-filter-tab').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            lpState.filter = btn.dataset.filter || 'all';
            renderTable();
        });
    }
    var sortEl = document.getElementById('lpSort');
    if (sortEl) {
        sortEl.addEventListener('change', function() {
            lpState.sort = sortEl.value;
            renderTable();
        });
    }
}

function init() {
    initUI();
    loadLiveProjects();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

})();
