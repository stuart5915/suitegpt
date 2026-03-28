// Token Detail Page — Inclawbate
// Pattern: IIFE, plain JS (same as project-app.js)

(function() {
'use strict';

var API_BASE = '/api/inclawbate/inclawbator';

var CLAWS_ADDRESS = '0x7ca47B141639B893C6782823C0b219f872056379';
var S4H_ADDRESS = '0x30F5BcB8bdA2B91430BE93dBaE08aC346884EB07';
var POKERAI_ADDRESS = '0x623a5cFC2e2E04957373A9F45B2b2BEEabf82B07';


// Hardcoded metadata for tokens not in the inclawbator DB
var EXTRA_TOKENS = {};
EXTRA_TOKENS[CLAWS_ADDRESS.toLowerCase()] = {
    token_name: 'CLAWS',
    token_symbol: 'CLAWS',
    token_address: CLAWS_ADDRESS,
    logo_url: '/inclawbate/assets/clawslogo.jpg',
    tier: 'ecosystem',
    description: 'The utility token of the Inclawbate ecosystem.',
    staking_address: '0x551d9dCd8B49893b9D0E1CA41a128ec202845F40',
    is_clanker: false,
    website_url: 'https://inclawbate.app',
    x_handle: 'inclawbate'
};
EXTRA_TOKENS[S4H_ADDRESS.toLowerCase()] = {
    token_name: 'Salvation 4 Humanity',
    token_symbol: 'S4H',
    token_address: S4H_ADDRESS,
    logo_url: '/salvation4humanity/assets/s4hlogo.png',
    tier: 'partner',
    description: 'Faith-driven token supporting global humanitarian causes.',
    staking_address: '0x3A7F8a12fD0DAe62dd45e1E641dBb687a90F170D',
    is_clanker: true,
    website_url: 'https://salvation4humanity.com',
    x_handle: 'salvation4h',
    telegram_url: 'https://t.me/salvation4humanity'
};
EXTRA_TOKENS[POKERAI_ADDRESS.toLowerCase()] = {
    token_name: 'PokerAI',
    token_symbol: 'POKERAI',
    token_address: POKERAI_ADDRESS,
    logo_url: '/inclawbate/assets/pokerai-logo.png',
    tier: 'ecosystem',
    description: 'The native token of PokerAI — AI poker agents powered by Inclawbate.',
    is_clanker: true,
    website_url: 'https://pokerai.app',
    x_handle: 'inclawbate'
};

var state = { project: null, market: null, wallet: null };

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getAddress() {
    var parts = window.location.pathname.split('/');
    // /tokens/{address}
    return parts[2] || null;
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

// ══════════════════════════════════════
// DATA LOADING
// ══════════════════════════════════════

async function loadTokenData() {
    var address = getAddress();
    if (!address) return showNotFound();

    var addrLower = address.toLowerCase();
    var project = null;

    // 1. Check hardcoded EXTRA_TOKENS
    if (EXTRA_TOKENS[addrLower]) {
        project = Object.assign({}, EXTRA_TOKENS[addrLower]);
    }

    // 2. Try API for DB projects
    if (!project) {
        try {
            var res = await fetch(API_BASE + '?token_address=' + encodeURIComponent(address));
            if (res.ok) {
                var data = await res.json();
                if (data.project) {
                    project = data.project;
                    project.is_clanker = true; // DB projects are Clanker-launched
                }
            }
        } catch (e) { /* API unavailable */ }
    }

    // 3. Fetch DexScreener for live market data
    var market = null;
    try {
        var dsRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + address);
        if (dsRes.ok) {
            var dsData = await dsRes.json();
            var pairs = dsData.pairs || [];
            if (pairs.length > 0) {
                // Pick highest-liquidity pair
                pairs.sort(function(a, b) { return (b.liquidity && b.liquidity.usd || 0) - (a.liquidity && a.liquidity.usd || 0); });
                var best = pairs[0];
                market = {
                    priceUsd: parseFloat(best.priceUsd) || 0,
                    marketCap: best.marketCap || best.fdv || 0,
                    volume24h: best.volume && best.volume.h24 || 0,
                    priceChange24h: best.priceChange && best.priceChange.h24 || 0,
                    liquidity: best.liquidity && best.liquidity.usd || 0,
                    chainId: best.chainId || 'base',
                    pairAddress: best.pairAddress || '',
                    dexId: best.dexId || ''
                };

                // If no project yet, build minimal info from DexScreener
                if (!project) {
                    project = {
                        token_name: best.baseToken && best.baseToken.name || 'Unknown Token',
                        token_symbol: best.baseToken && best.baseToken.symbol || '???',
                        token_address: address,
                        tier: 'permissionless',
                        is_clanker: true
                    };
                }
            }
        }
    } catch (e) { /* DexScreener unavailable */ }

    // 4. GeckoTerminal fallback if DexScreener had no data
    if (!market) {
        try {
            var network = address.startsWith('0x') ? 'base' : 'solana';
            var gtRes = await fetch('https://api.geckoterminal.com/api/v2/networks/' + network + '/tokens/' + address);
            if (gtRes.ok) {
                var gtData = await gtRes.json();
                var attrs = gtData.data && gtData.data.attributes;
                if (attrs) {
                    var gtPrice = parseFloat(attrs.price_usd) || 0;
                    var gtMcap = parseFloat(attrs.market_cap_usd) || parseFloat(attrs.fdv_usd) || 0;
                    var gtVol = attrs.volume_usd ? parseFloat(attrs.volume_usd.h24) || 0 : 0;
                    var gtLiq = parseFloat(attrs.total_reserve_in_usd) || 0;
                    market = {
                        priceUsd: gtPrice,
                        marketCap: gtMcap,
                        volume24h: gtVol,
                        priceChange24h: null,
                        liquidity: gtLiq,
                        chainId: network,
                        pairAddress: '',
                        dexId: 'geckoterminal'
                    };
                    if (!project) {
                        project = {
                            token_name: attrs.name || 'Unknown Token',
                            token_symbol: attrs.symbol || '???',
                            token_address: address,
                            logo_url: attrs.image_url || '',
                            tier: 'permissionless',
                            is_clanker: false
                        };
                    }
                    // Fill in logo from GeckoTerminal if project has none
                    if (!project.logo_url && attrs.image_url) {
                        project.logo_url = attrs.image_url;
                    }
                }
            }
        } catch (e) { /* GeckoTerminal unavailable */ }
    }

    if (!project) return showNotFound();

    // Detect chain from address format if not set
    if (!project.chain) {
        if (address.startsWith('0x')) {
            project.chain = 'base';
        } else {
            project.chain = 'solana';
        }
    }
    // Override with DexScreener chainId if available
    if (market && market.chainId) {
        project.chain = market.chainId;
    }

    state.project = project;
    state.market = market;

    // Check wallet from nav-auth
    if (window.__inclawbateWallet) {
        state.wallet = window.__inclawbateWallet.toLowerCase();
    }

    render();
    updateMeta();
}

function showNotFound() {
    var el = document.getElementById('tdContent');
    if (el) el.innerHTML = '<div class="td-not-found"><h2>Token Not Found</h2><p>This token address was not found.</p><a href="/tokens" class="td-back">&larr; Back to Tokens</a></div>';
}

function updateMeta() {
    var p = state.project;
    if (!p) return;
    var title = (p.token_name || 'Token') + ' ($' + (p.token_symbol || '') + ') — Inclawbate';
    document.title = title;
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', (p.description || p.token_name + ' token on Inclawbate'));
    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);
}

// ══════════════════════════════════════
// RENDER
// ══════════════════════════════════════

function render() {
    var el = document.getElementById('tdContent');
    if (!el) return;

    var p = state.project;
    var m = state.market;
    var html = '';

    // ── Hero ──
    // Clean logo URL (Supabase SQL editor sometimes inserts line breaks)
    if (p.logo_url) p.logo_url = p.logo_url.replace(/[\r\n\s]+/g, '');
    var logoHtml = p.logo_url
        ? '<img class="td-logo" src="' + escapeHtml(p.logo_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
          + '<div class="td-logo-placeholder" style="display:none">' + escapeHtml((p.token_name || '?')[0]).toUpperCase() + '</div>'
        : '<div class="td-logo-placeholder">' + escapeHtml((p.token_name || '?')[0]).toUpperCase() + '</div>';

    var tierMap = {
        incubated: 'td-tier-incubated',
        permissionless: 'td-tier-permissionless',
        ecosystem: 'td-tier-ecosystem',
        partner: 'td-tier-partner',
        drops: 'td-tier-drops'
    };
    var tierLabels = {
        incubated: 'Incubated',
        permissionless: '',
        ecosystem: 'Ecosystem',
        partner: 'Partner',
        drops: 'Drop'
    };
    var tierCls = tierMap[p.tier] || 'td-tier-permissionless';
    var tierLabel = tierLabels[p.tier] || '';

    html += '<div class="td-hero">'
        + logoHtml
        + '<div class="td-hero-info">'
        + '<div class="td-hero-row">'
        + '<span class="td-name">' + escapeHtml(p.token_name) + '</span>'
        + '<span class="td-symbol">$' + escapeHtml(p.token_symbol) + '</span>'
        + (tierLabel ? '<span class="td-tier ' + tierCls + '">' + tierLabel + '</span>' : '')
        + '<span class="td-tier" style="background:' + (p.chain === 'solana' ? 'rgba(0,209,140,0.12);color:#00d18c' : 'rgba(56,133,255,0.15);color:#3885ff') + '">' + (p.chain === 'solana' ? 'Solana' : 'Base') + '</span>'
        + '</div>'
        + (p.description ? '<p class="td-desc">' + escapeHtml(p.description) + '</p>' : '')
        + '</div></div>';

    // ── Stats Grid ──
    var price = m ? formatUsd(m.priceUsd) : '--';
    var mcap = m ? formatUsd(m.marketCap) : '--';
    var vol = m ? formatUsd(m.volume24h) : '--';
    var change = m ? formatPct(m.priceChange24h) : '--';
    var changeCls = m && m.priceChange24h >= 0 ? 'positive' : (m && m.priceChange24h < 0 ? 'negative' : '');
    var liq = m ? formatUsd(m.liquidity) : '--';
    var chainRaw = (m && m.chainId) || p.chain || 'base';
    var chain = chainRaw.charAt(0).toUpperCase() + chainRaw.slice(1);

    html += '<div class="td-stats">'
        + '<div class="td-stat"><div class="td-stat-label">Market Cap</div><div class="td-stat-value">' + mcap + '</div></div>'
        + '<div class="td-stat"><div class="td-stat-label">Price</div><div class="td-stat-value">' + price + '</div></div>'
        + '<div class="td-stat"><div class="td-stat-label">24h Change</div><div class="td-stat-value ' + changeCls + '">' + change + '</div></div>'
        + '<div class="td-stat"><div class="td-stat-label">24h Volume</div><div class="td-stat-value">' + vol + '</div></div>'
        + '<div class="td-stat"><div class="td-stat-label">Liquidity</div><div class="td-stat-value">' + liq + '</div></div>'
        + '<div class="td-stat"><div class="td-stat-label">Chain</div><div class="td-stat-value">' + escapeHtml(chain) + '</div></div>'
        + '</div>';

    // ── Links Row ──
    html += '<div class="td-links">';
    if (p.website_url) {
        var websiteHref = p.website_url.startsWith('http') ? p.website_url : 'https://' + p.website_url;
        html += '<a href="' + escapeHtml(websiteHref) + '" target="_blank" rel="noopener" class="td-link td-link-website">Website</a>';
    }
    if (p.x_handle) {
        html += '<a href="https://x.com/' + escapeHtml(p.x_handle) + '" target="_blank" rel="noopener" class="td-link td-link-x">X</a>';
    }
    if (p.telegram_url) {
        var tgHref = p.telegram_url.startsWith('http') ? p.telegram_url : 'https://' + p.telegram_url;
        html += '<a href="' + escapeHtml(tgHref) + '" target="_blank" rel="noopener" class="td-link td-link-telegram">Telegram</a>';
    }
    var isSolana = p.chain === 'solana';
    if (isSolana && p.token_address) {
        html += '<a href="https://bags.fm/' + p.token_address + '" target="_blank" rel="noopener" class="td-link td-link-uniswap">Buy</a>';
        html += '<a href="https://dexscreener.com/solana/' + p.token_address + '" target="_blank" rel="noopener" class="td-link td-link-dexscreener">DexScreener</a>';
    } else {
        if (p.is_clanker !== false && p.token_address) {
            html += '<a href="https://www.clanker.world/clanker/' + p.token_address + '" target="_blank" rel="noopener" class="td-link td-link-clanker">Clanker</a>';
        }
        if (p.token_address) {
            html += '<a href="https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=' + p.token_address + '&chain=base" target="_blank" rel="noopener" class="td-link td-link-uniswap">Uniswap</a>';
            html += '<a href="https://dexscreener.com/base/' + p.token_address + '" target="_blank" rel="noopener" class="td-link td-link-dexscreener">DexScreener</a>';
        }
    }
    if (p.staking_address && p.token_symbol) {
        html += '<a href="/stake/' + p.token_symbol.toLowerCase() + '" class="td-link td-link-stake">Stake</a>';
    }
    if (p.token_address) {
        html += '<button class="td-link td-link-copy" data-ca="' + p.token_address + '">Copy CA</button>';
    }
    html += '</div>';

    // ── DexScreener Chart Embed ──
    if (p.token_address) {
        var dsNetwork = isSolana ? 'solana' : 'base';
        html += '<div class="td-chart">'
            + '<iframe src="https://dexscreener.com/' + dsNetwork + '/' + p.token_address + '?embed=1&theme=dark&info=0" allowfullscreen></iframe>'
            + '</div>';
    }

    // ── Owner Edit Panel ──
    if (p.id && state.wallet && p.creator_wallet && state.wallet === p.creator_wallet.toLowerCase()) {
        html += renderEditPanel(p);
    }

    el.innerHTML = html;

    // Bind edit panel if rendered
    var saveBtn = document.getElementById('tdEditSave');
    if (saveBtn) saveBtn.addEventListener('click', saveProject);

    // Copy CA button
    var copyBtn = el.querySelector('.td-link-copy');
    if (copyBtn) copyBtn.addEventListener('click', function() {
        var ca = this.getAttribute('data-ca');
        navigator.clipboard.writeText(ca).then(function() {
            copyBtn.textContent = 'Copied!';
            setTimeout(function() { copyBtn.textContent = 'Copy CA'; }, 1500);
        });
    });

}

function renderEditPanel(p) {
    return '<div class="td-edit">'
        + '<div class="td-edit-title">Edit Token Details</div>'
        + '<div class="td-edit-row"><label class="td-edit-label">Description</label><textarea class="td-edit-input" id="editDesc">' + escapeHtml(p.description || '') + '</textarea></div>'
        + '<div class="td-edit-row"><label class="td-edit-label">Website URL</label><input class="td-edit-input" id="editWebsite" value="' + escapeHtml(p.website_url || '') + '"></div>'
        + '<div class="td-edit-row"><label class="td-edit-label">X Handle</label><input class="td-edit-input" id="editX" value="' + escapeHtml(p.x_handle || '') + '" placeholder="handle (no @)"></div>'
        + '<div class="td-edit-row"><label class="td-edit-label">Telegram URL</label><input class="td-edit-input" id="editTelegram" value="' + escapeHtml(p.telegram_url || '') + '"></div>'
        + '<div class="td-edit-row"><label class="td-edit-label">Logo URL</label><input class="td-edit-input" id="editLogo" value="' + escapeHtml(p.logo_url || '') + '"></div>'
        + '<button class="td-edit-save" id="tdEditSave">Save Changes</button>'
        + '<div class="td-edit-msg" id="tdEditMsg"></div>'
        + '</div>';
}

async function saveProject() {
    var btn = document.getElementById('tdEditSave');
    var msg = document.getElementById('tdEditMsg');
    if (!btn || !state.project || !state.project.id) return;

    btn.disabled = true;
    btn.textContent = 'Saving...';
    if (msg) { msg.textContent = ''; msg.className = 'td-edit-msg'; }

    try {
        var token = localStorage.getItem('supabase_access_token') || '';
        var res = await fetch(API_BASE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                action: 'update-project',
                project_id: state.project.id,
                description: document.getElementById('editDesc').value,
                website_url: document.getElementById('editWebsite').value,
                x_handle: document.getElementById('editX').value,
                telegram_url: document.getElementById('editTelegram').value,
                logo_url: document.getElementById('editLogo').value
            })
        });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Save failed');
        if (msg) { msg.textContent = 'Saved!'; msg.className = 'td-edit-msg success'; }
        // Update local state
        if (data.project) {
            Object.assign(state.project, data.project);
        }
    } catch (e) {
        if (msg) { msg.textContent = e.message; msg.className = 'td-edit-msg error'; }
    }

    btn.disabled = false;
    btn.textContent = 'Save Changes';
}

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════

function init() {
    // Wait a tick for nav-auth to set wallet
    setTimeout(function() {
        if (window.__inclawbateWallet) {
            state.wallet = window.__inclawbateWallet.toLowerCase();
        }
        loadTokenData();
    }, 100);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

})();
