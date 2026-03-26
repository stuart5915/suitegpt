(function () {
    'use strict';

    // ── Config ──
    var APIS = {
        projects: '/api/inclawbate/projects?public=1',
        apps: '/api/inclawbate/apps?sort=newest&limit=50',
        tokens: '/api/inclawbate/inclawbator',
        agents: '/api/inclawbate/agent-posts?public=1'
    };

    // Extra tokens not in inclawbator API (same as tokens-app.js + stake-app.js)
    var EXTRA_TOKENS = [
        {
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
            token_name: 'inCLAWNCH',
            token_symbol: 'INCLAWNCH',
            token_address: '0xB0b6e0E9da530f68D713cC03a813B506205aC808',
            logo_url: '/inclawbate/assets/logo-circle.jpg',
            status: 'active',
            tier: 'ecosystem',
            staking_address: '0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6',
            created_at: '2025-01-01T00:00:00Z'
        },
        {
            token_name: 'CLAWNCH',
            token_symbol: 'CLAWNCH',
            token_address: '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be',
            logo_url: '/inclawbate/assets/clawnchlogo.jpg',
            status: 'active',
            tier: 'ecosystem',
            staking_address: '0xAda0e738F0E4DEb4e2C0B83d6836DE953f2e57b9',
            created_at: '2025-01-01T00:00:00Z'
        },
        {
            token_name: 'ClawnStrategy',
            token_symbol: 'CLAWNSTR',
            token_address: '0x1c6B6b77bDC1d1DeBc35760901f39f4A0A66BAa1',
            logo_url: '/inclawbate/assets/clawnstr-logo.jpg',
            status: 'active',
            tier: 'incubated',
            staking_address: '0x9f7cD1C3e4526937736629a400acBdcA50836848',
            created_at: '2025-03-01T00:00:00Z'
        },
        {
            token_name: 'BitVault Signal',
            token_symbol: 'BV7X',
            token_address: '0xD88FD4a11255E51f64f78b4a7d74456325c2d8dC',
            logo_url: '/inclawbate/assets/bv7x-logo.jpg',
            status: 'active',
            tier: 'incubated',
            staking_address: '0x65Aec0C9fd455822F1cC0e3De7965B106d182017',
            created_at: '2025-04-01T00:00:00Z'
        },
        {
            token_name: 'PokerAI',
            token_symbol: 'POKERAI',
            token_address: '0x623a5cFC2e2E04957373A9F45B2b2BEEabf82B07',
            logo_url: '/inclawbate/assets/pokerai-logo.png',
            status: 'active',
            tier: 'ecosystem',
            created_at: '2026-03-14T00:00:00Z'
        }
    ];

    // Static NFTs
    var STATIC_NFTS = [
        {
            type: 'nft',
            name: 'Angel NFT',
            description: 'The founding badge for the 828 original Inclawbate holders. Unlimited builder credits, free tool access, all AI models unlocked.',
            logo_url: '/inclawbate/assets/angelnft.jpg',
            href: '/angel',
            badges: ['Featured', 'Base'],
            supply: '828',
            created_at: '2025-01-01T00:00:00Z'
        },
        {
            type: 'nft',
            name: 'Fight Farm NFTs',
            description: 'Collectible fighters for the Fight Farm game. Train, battle, and earn with your NFT fighters.',
            logo_url: '/fight-farm/assets/fightfarmlogo.jpg',
            href: '#',
            badges: ['Coming Soon'],
            supply: 'TBD',
            created_at: '2025-12-01T00:00:00Z'
        }
    ];

    // Pool config — maps staking address (lowercase) to reward info
    var POOL_CONFIG = {
        '0x551d9dcd8b49893b9d0e1ca41a128ec202845f40': { ticker: 'CLAWS', rewardTicker: 'CLAWS', token: '0x7ca47B141639B893C6782823C0b219f872056379', rewardToken: null },
        '0x206c97d4ecf053561bd2c714335aaef0ec1105e6': { ticker: 'INCLAWNCH', rewardTicker: 'INCLAWNCH', token: '0xB0b6e0E9da530f68D713cC03a813B506205aC808', rewardToken: null },
        '0x3a7f8a12fd0dae62dd45e1e641dbb687a90f170d': { ticker: 'S4H', rewardTicker: 'INCLAWNCH', token: '0x30F5BcB8bdA2B91430BE93dBaE08aC346884EB07', rewardToken: '0xB0b6e0E9da530f68D713cC03a813B506205aC808' },
        '0xada0e738f0e4deb4e2c0b83d6836de953f2e57b9': { ticker: 'CLAWNCH', rewardTicker: 'INCLAWNCH', token: '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be', rewardToken: '0xB0b6e0E9da530f68D713cC03a813B506205aC808' },
        '0x9f7cd1c3e4526937736629a400acbdca50836848': { ticker: 'CLAWNSTR', rewardTicker: 'CLAWNSTR', token: '0x1c6B6b77bDC1d1DeBc35760901f39f4A0A66BAa1', rewardToken: null },
        '0x65aec0c9fd455822f1cc0e3de7965b106d182017': { ticker: 'BV7X', rewardTicker: 'BV7X', token: '0xD88FD4a11255E51f64f78b4a7d74456325c2d8dC', rewardToken: null }
    };

    var BASE_RPCS = [
        'https://mainnet.base.org',
        'https://base.drpc.org',
        'https://base-mainnet.public.blastapi.io'
    ];

    // ── DOM ──
    var resultsEl = document.getElementById('exploreResults');
    var searchInput = document.getElementById('exploreSearch');
    var tabsEl = document.getElementById('exploreTabs');
    var tabBtns = tabsEl.querySelectorAll('.explore-tab');

    // ── State ──
    var allItems = [];
    var mcaps = {};
    var prices = {};
    var stakingStats = {};
    var activeTab = 'all';
    var searchQuery = '';
    var debounceTimer = null;

    // ── Utilities ──
    function hashColor(str) {
        var h = 0;
        for (var i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
        return 'hsl(' + (Math.abs(h) % 360) + ', 55%, 35%)';
    }

    function escapeHtml(s) {
        var d = document.createElement('div');
        d.textContent = s || '';
        return d.innerHTML;
    }

    function formatMcap(n) {
        if (!n || n <= 0) return '--';
        if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
        if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
        if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
        return '$' + n.toFixed(0);
    }

    function fmtUsd(n) {
        if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
        if (n >= 10000) return '$' + (n / 1000).toFixed(0) + 'K';
        if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
        if (n >= 0.01) return '$' + n.toFixed(2);
        return '$0';
    }

    function fromWei(hex) {
        if (!hex || hex === '0x' || hex === '0x0') return 0;
        try { return Number(BigInt(hex)) / 1e18; } catch (e) { return 0; }
    }

    async function rpcCall(to, data) {
        for (var i = 0; i < BASE_RPCS.length; i++) {
            try {
                var res = await fetch(BASE_RPCS[i], {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: to, data: data }, 'latest'] })
                });
                var json = await res.json();
                if (json.result) return json.result;
            } catch (e) { continue; }
        }
        return '0x0';
    }

    // ── Normalize sources into unified items ──
    function normalizeProjects(projects) {
        return (projects || []).map(function (p) {
            var badges = [];
            if (p.app_slug) badges.push('App');
            if (p.token_address) badges.push('Token');
            if (p.staking_address) badges.push('Staking');
            return {
                type: 'project',
                name: p.name || 'Unnamed',
                slug: p.slug || '',
                description: p.description || '',
                logo_url: p.logo_url || '',
                href: '/projects/' + (p.slug || ''),
                token_address: p.token_address || '',
                token_symbol: '',
                staking_address: p.staking_address || '',
                category: '',
                upvote_count: 0,
                tier: '',
                supply: '',
                badges: badges,
                created_at: p.created_at || ''
            };
        });
    }

    function normalizeApps(apps) {
        return (apps || []).map(function (a) {
            return {
                type: 'app',
                name: a.name || a.title || 'Unnamed App',
                slug: a.slug || '',
                description: a.description || '',
                logo_url: a.icon_url || a.logo_url || '',
                href: '/apps',
                token_address: '',
                token_symbol: '',
                staking_address: '',
                category: a.category || '',
                upvote_count: a.upvote_count || a.upvotes || 0,
                tier: '',
                supply: '',
                badges: a.category ? [a.category] : [],
                created_at: a.created_at || ''
            };
        });
    }

    function normalizeTokens(tokens) {
        return (tokens || []).map(function (t) {
            var badges = [];
            var tierMap = { incubated: 'Incubated', permissionless: 'Launched', ecosystem: 'Ecosystem', partner: 'Partner' };
            if (t.tier && tierMap[t.tier]) badges.push(tierMap[t.tier]);
            if (t.staking_address) badges.push('Staking');
            var isSolana = t.chain === 'solana';
            badges.push(isSolana ? 'Solana' : 'Base');
            return {
                type: 'token',
                name: t.token_name || t.name || 'Unnamed Token',
                slug: '',
                description: '',
                logo_url: t.logo_url || '',
                href: t.token_address ? '/tokens/' + t.token_address : '/tokens',
                token_address: t.token_address || '',
                token_symbol: t.token_symbol || '',
                staking_address: t.staking_address || '',
                category: '',
                upvote_count: 0,
                tier: t.tier || '',
                supply: '',
                badges: badges,
                created_at: t.created_at || ''
            };
        });
    }

    function normalizeAgents(agents) {
        return (agents || []).map(function (a) {
            var badges = ['Agent'];
            if (a.x_handle) badges.push('@' + a.x_handle);
            if (a.token_symbol) badges.push('$' + a.token_symbol);
            return {
                type: 'agent',
                name: a.name || 'Unnamed Agent',
                slug: a.slug || '',
                description: a.latest_tweet || a.description || '',
                logo_url: a.logo_url || '',
                href: '/agents',
                token_address: '',
                token_symbol: a.token_symbol || '',
                staking_address: '',
                category: '',
                upvote_count: 0,
                tier: '',
                supply: '',
                badges: badges,
                agent_total_posts: a.agent_total_posts || 0,
                created_at: a.latest_tweet_at || ''
            };
        });
    }

    // ── Dedup & merge ──
    function buildItemList(projects, apps, tokens, agents) {
        // Normalize tokens (API + extras)
        var apiTokens = (tokens || []).filter(function (t) {
            return t.status === 'active' || t.status === 'launched';
        });
        // Merge extra tokens, avoid dupes
        var tokenAddrs = {};
        apiTokens.forEach(function (t) {
            if (t.token_address) tokenAddrs[t.token_address.toLowerCase()] = true;
        });
        EXTRA_TOKENS.forEach(function (t) {
            if (!tokenAddrs[t.token_address.toLowerCase()]) {
                apiTokens.push(t);
                tokenAddrs[t.token_address.toLowerCase()] = true;
            }
        });

        var tokenItems = normalizeTokens(apiTokens);

        // Auto-populate POOL_CONFIG for API tokens not already in the hardcoded config
        apiTokens.forEach(function (t) {
            if (!t.staking_address || !t.token_address) return;
            var sKey = t.staking_address.toLowerCase();
            if (POOL_CONFIG[sKey]) return; // already configured
            POOL_CONFIG[sKey] = {
                ticker: t.token_symbol || '',
                rewardTicker: t.reward_token_symbol || 'CLAWS',
                token: t.token_address,
                rewardToken: t.reward_token_address || '0x7ca47B141639B893C6782823C0b219f872056379'
            };
        });

        // Normalize projects — keep all, they link to project detail pages
        var projectItems = normalizeProjects(projects);

        var appItems = normalizeApps(apps);

        // Create staking items derived from tokens with staking_address
        var stakingItems = tokenItems
            .filter(function (t) { return t.staking_address; })
            .map(function (t) {
                var sCfg = POOL_CONFIG[(t.staking_address || '').toLowerCase()];
                var rTicker = (sCfg && sCfg.rewardTicker) ? sCfg.rewardTicker : (t.token_symbol || '');
                return {
                    type: 'staking',
                    name: t.name + ' Staking',
                    slug: '',
                    description: 'Stake $' + (t.token_symbol || '') + ' → Earn $' + rTicker,
                    logo_url: t.logo_url,
                    href: '/stake/' + (t.token_symbol || '').toLowerCase(),
                    token_address: t.token_address,
                    token_symbol: t.token_symbol,
                    staking_address: t.staking_address,
                    category: '',
                    upvote_count: 0,
                    tier: t.tier,
                    supply: '',
                    badges: ['Staking', t.token_symbol ? '$' + t.token_symbol : ''],
                    created_at: t.created_at
                };
            });

        // NFT items from static data
        var nftItems = STATIC_NFTS.slice();

        var agentItems = normalizeAgents(agents);

        allItems = [].concat(projectItems, appItems, tokenItems, stakingItems, nftItems, agentItems);
    }

    // ── Filtering & sorting ──
    function getFiltered() {
        var q = searchQuery.toLowerCase();
        var filtered = allItems.filter(function (item) {
            // Tab filter
            if (activeTab !== 'all' && item.type !== activeTab) return false;
            // Search filter
            if (q) {
                var hay = (
                    (item.name || '') + ' ' +
                    (item.description || '') + ' ' +
                    (item.token_symbol || '') + ' ' +
                    (item.category || '') + ' ' +
                    (item.slug || '') + ' ' +
                    (item.badges || []).join(' ')
                ).toLowerCase();
                if (hay.indexOf(q) === -1) return false;
            }
            return true;
        });

        // Sort
        if (activeTab === 'token' || activeTab === 'staking') {
            // By market cap desc, then newest
            filtered.sort(function (a, b) {
                var ma = mcaps[(a.token_address || '').toLowerCase()] || 0;
                var mb = mcaps[(b.token_address || '').toLowerCase()] || 0;
                if (mb !== ma) return mb - ma;
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            });
        } else {
            // Newest first
            filtered.sort(function (a, b) {
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            });
        }

        return filtered;
    }

    // ── Render ──
    function render() {
        var items = getFiltered();

        // Update tab counts
        var counts = { all: 0, project: 0, app: 0, token: 0, nft: 0, staking: 0, agent: 0 };
        var q = searchQuery.toLowerCase();
        allItems.forEach(function (item) {
            if (q) {
                var hay = (
                    (item.name || '') + ' ' + (item.description || '') + ' ' +
                    (item.token_symbol || '') + ' ' + (item.category || '') + ' ' +
                    (item.slug || '') + ' ' + (item.badges || []).join(' ')
                ).toLowerCase();
                if (hay.indexOf(q) === -1) return;
            }
            counts.all++;
            if (counts[item.type] !== undefined) counts[item.type]++;
        });
        tabBtns.forEach(function (btn) {
            var tab = btn.dataset.tab;
            var countEl = btn.querySelector('.tab-count');
            if (countEl) countEl.textContent = counts[tab] || 0;
        });

        if (!items.length) {
            resultsEl.innerHTML = '<div class="explore-empty">No results found.</div>';
            return;
        }

        var html = '<div class="explore-list">';
        items.forEach(function (item, i) {
            var logoHtml;
            if (item.logo_url) {
                logoHtml = '<img class="explore-row-logo" src="' + item.logo_url + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
                    + '<div class="explore-row-logo-placeholder" style="display:none;background:' + hashColor(item.name) + '">' + item.name.charAt(0).toUpperCase() + '</div>';
            } else {
                logoHtml = '<div class="explore-row-logo-placeholder" style="background:' + hashColor(item.name) + '">' + item.name.charAt(0).toUpperCase() + '</div>';
            }

            var typeClass = 'type-' + item.type;
            var typeLabel = item.type.charAt(0).toUpperCase() + item.type.slice(1);

            // Stats column
            var statsHtml = '';
            if (item.type === 'token') {
                var mcap = mcaps[(item.token_address || '').toLowerCase()];
                if (item.token_symbol) {
                    statsHtml += '<span class="explore-row-stat"><strong>$' + escapeHtml(item.token_symbol) + '</strong></span>';
                }
                statsHtml += '<span class="explore-row-stat">' + formatMcap(mcap) + '</span>';
            } else if (item.type === 'staking') {
                var sStats = stakingStats[(item.staking_address || '').toLowerCase()] || {};
                var sPrice = prices[(item.token_address || '').toLowerCase()] || 0;
                var sTvl = (sStats.totalStaked || 0) * sPrice;
                if (item.token_symbol) {
                    statsHtml += '<span class="explore-row-stat"><strong>$' + escapeHtml(item.token_symbol) + '</strong></span>';
                }
                if (sTvl > 0) {
                    statsHtml += '<span class="explore-row-stat">TVL ' + fmtUsd(sTvl) + '</span>';
                }
                if (sStats.apy > 0) {
                    statsHtml += '<span class="explore-row-stat" style="color:var(--lobster-300)">' + (sStats.apy >= 100 ? Math.round(sStats.apy) : sStats.apy.toFixed(1)) + '% APY</span>';
                }
                if (sStats.active === true) {
                    statsHtml += '<span class="explore-row-badge badge-staking">Active</span>';
                } else if (sStats.active === false) {
                    statsHtml += '<span class="explore-row-badge" style="color:#f87171;background:rgba(239,68,68,0.12)">Ended</span>';
                }
            } else if (item.type === 'app' && item.upvote_count) {
                statsHtml += '<span class="explore-row-stat">' + item.upvote_count + ' upvotes</span>';
            } else if (item.type === 'agent') {
                if (item.agent_total_posts) statsHtml += '<span class="explore-row-stat">' + item.agent_total_posts + ' posts</span>';
            } else if (item.type === 'nft') {
                if (item.supply) statsHtml += '<span class="explore-row-stat">Supply: <strong>' + escapeHtml(item.supply) + '</strong></span>';
            }

            // Badges
            (item.badges || []).forEach(function (b) {
                if (!b) return;
                var cls = 'explore-row-badge ';
                var bl = b.toLowerCase();
                if (bl === 'app') cls += 'badge-app';
                else if (bl === 'token') cls += 'badge-token';
                else if (bl === 'staking') cls += 'badge-staking';
                else if (bl === 'featured') cls += 'badge-featured';
                else if (bl === 'coming soon') cls += 'badge-coming';
                else if (bl === 'base' || bl === 'solana') cls += 'badge-chain';
                else cls += 'badge-app';
                statsHtml += '<span class="' + cls + '">' + escapeHtml(b) + '</span>';
            });

            var descHtml = item.description
                ? '<div class="explore-row-desc">' + escapeHtml(item.description) + '</div>'
                : '';

            html += '<a href="' + item.href + '" class="explore-row" data-type="' + item.type + '">'
                + '<span class="explore-row-rank">' + (i + 1) + '</span>'
                + '<div>' + logoHtml + '</div>'
                + '<div class="explore-row-info">'
                    + '<div class="explore-row-top">'
                        + '<span class="explore-row-name">' + escapeHtml(item.name) + '</span>'
                        + '<span class="explore-row-type ' + typeClass + '">' + typeLabel + '</span>'
                    + '</div>'
                    + descHtml
                + '</div>'
                + '<div class="explore-row-stats">' + statsHtml + '</div>'
            + '</a>';
        });
        html += '</div>';
        resultsEl.innerHTML = html;
    }

    // ── Fetch market caps from DexScreener ──
    async function fetchMarketCaps() {
        var addresses = allItems
            .filter(function (item) { return item.token_address; })
            .map(function (item) { return item.token_address; });
        // Dedupe addresses
        var seen = {};
        addresses = addresses.filter(function (a) {
            var key = a.toLowerCase();
            if (seen[key]) return false;
            seen[key] = true;
            return true;
        });
        if (!addresses.length) return;

        // DexScreener in batches of 25
        for (var i = 0; i < addresses.length; i += 25) {
            var batch = addresses.slice(i, i + 25).join(',');
            try {
                var res = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + batch);
                if (!res.ok) continue;
                var data = await res.json();
                (data.pairs || []).forEach(function (pair) {
                    var addr = pair.baseToken && pair.baseToken.address ? pair.baseToken.address.toLowerCase() : null;
                    var val = pair.marketCap || pair.fdv || 0;
                    if (addr && val > 0) {
                        if (!mcaps[addr] || val > mcaps[addr]) {
                            mcaps[addr] = val;
                        }
                    }
                    if (addr && pair.priceUsd) {
                        prices[addr] = parseFloat(pair.priceUsd);
                    }
                });
            } catch (e) { /* DexScreener unavailable */ }
        }
        render();

        // GeckoTerminal fallback for missed tokens
        var missing = addresses.filter(function (a) { return !mcaps[a.toLowerCase()]; });
        if (!missing.length) return;
        var changed = false;
        for (var j = 0; j < missing.length; j++) {
            try {
                var gRes = await fetch('https://api.geckoterminal.com/api/v2/networks/base/tokens/' + missing[j]);
                if (!gRes.ok) continue;
                var gData = await gRes.json();
                var attrs = gData.data && gData.data.attributes;
                if (!attrs) continue;
                var fdv = attrs.fdv_usd ? parseFloat(attrs.fdv_usd) : 0;
                var mc = attrs.market_cap_usd ? parseFloat(attrs.market_cap_usd) : 0;
                var val = mc || fdv;
                if (val > 0) {
                    mcaps[missing[j].toLowerCase()] = val;
                    changed = true;
                }
                var priceUsd = attrs.price_usd ? parseFloat(attrs.price_usd) : 0;
                if (priceUsd > 0) prices[missing[j].toLowerCase()] = priceUsd;
            } catch (e) { /* GeckoTerminal unavailable */ }
        }
        if (changed) render();
    }

    // ── Fetch on-chain staking stats ──
    async function fetchStakingStats() {
        var items = allItems.filter(function (it) { return it.type === 'staking' && it.staking_address; });
        if (!items.length) return;

        var calls = items.map(function (item) {
            var addr = item.staking_address;
            return Promise.all([
                rpcCall(addr, '0x817b1cd2'), // totalStaked
                rpcCall(addr, '0xdff69787'), // stakerCount
                rpcCall(addr, '0x7b0a47ee'), // rewardRate
                rpcCall(addr, '0x506ec095')  // periodEnd
            ]).then(function (r) {
                return { stakingAddr: addr, tokenAddr: item.token_address, totalStaked: r[0], stakerCount: r[1], rewardRate: r[2], periodEnd: r[3] };
            });
        });

        var results = await Promise.allSettled(calls);
        var now = Math.floor(Date.now() / 1000);

        results.forEach(function (r) {
            if (r.status !== 'fulfilled') return;
            var d = r.value;
            var totalStaked = fromWei(d.totalStaked);
            var stakers = parseInt(d.stakerCount, 16) || 0;
            var rewardRate = fromWei(d.rewardRate);
            var periodEnd = parseInt(d.periodEnd, 16) || 0;
            var active = periodEnd > now;

            // APY calculation, adjusted for dual-token pools
            var apy = 0;
            if (totalStaked > 0 && active && rewardRate > 0) {
                var rawApy = (rewardRate * 86400 * 365 / totalStaked) * 100;
                var poolCfg = POOL_CONFIG[d.stakingAddr.toLowerCase()];
                if (poolCfg && poolCfg.rewardToken) {
                    var sp = prices[(poolCfg.token || '').toLowerCase()] || 0;
                    var rp = prices[(poolCfg.rewardToken || '').toLowerCase()] || 0;
                    apy = (sp > 0 && rp > 0) ? rawApy * (rp / sp) : rawApy;
                } else {
                    apy = rawApy;
                }
            }

            stakingStats[d.stakingAddr.toLowerCase()] = {
                totalStaked: totalStaked,
                stakers: stakers,
                rewardRate: rewardRate,
                periodEnd: periodEnd,
                active: active,
                apy: apy
            };
        });

        render();
    }

    // ── Tab & search events ──
    tabsEl.addEventListener('click', function (e) {
        var btn = e.target.closest('.explore-tab');
        if (!btn) return;
        tabBtns.forEach(function (t) { t.classList.remove('active'); });
        btn.classList.add('active');
        activeTab = btn.dataset.tab;
        // Update hash
        window.location.hash = activeTab === 'all' ? '' : activeTab;
        render();
    });

    searchInput.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
            searchQuery = searchInput.value.trim();
            render();
        }, 200);
    });

    // ── URL-based tab selection ──
    function selectTabFromURL() {
        var path = window.location.pathname;
        var hash = window.location.hash.replace('#', '').toLowerCase();

        if (hash && ['project', 'app', 'token', 'nft', 'staking', 'agent'].indexOf(hash) !== -1) {
            activeTab = hash;
        }
        // Also support plural hashes
        var pluralMap = { projects: 'project', apps: 'app', tokens: 'token', nfts: 'nft', agents: 'agent' };
        if (hash && pluralMap[hash]) activeTab = pluralMap[hash];

        tabBtns.forEach(function (t) {
            t.classList.toggle('active', t.dataset.tab === activeTab);
        });
    }

    // ── Load everything ──
    async function init() {
        selectTabFromURL();

        var projectsData = [];
        var appsData = [];
        var tokensData = [];
        var agentsData = [];

        // 4 parallel fetches
        var results = await Promise.allSettled([
            fetch(APIS.projects).then(function (r) { return r.json(); }),
            fetch(APIS.apps).then(function (r) { return r.json(); }),
            fetch(APIS.tokens).then(function (r) { return r.json(); }),
            fetch(APIS.agents).then(function (r) { return r.json(); })
        ]);

        if (results[0].status === 'fulfilled') {
            projectsData = results[0].value.projects || results[0].value || [];
        }
        if (results[1].status === 'fulfilled') {
            var ad = results[1].value;
            appsData = ad.apps || ad.sites || ad || [];
            if (!Array.isArray(appsData)) appsData = [];
        }
        if (results[2].status === 'fulfilled') {
            var td = results[2].value;
            tokensData = td.projects || td || [];
            if (!Array.isArray(tokensData)) tokensData = [];
        }
        if (results[3].status === 'fulfilled') {
            agentsData = results[3].value.agents || [];
            if (!Array.isArray(agentsData)) agentsData = [];
        }

        buildItemList(projectsData, appsData, tokensData, agentsData);
        render();
        fetchMarketCaps();
        fetchStakingStats();
    }

    // ── Kick off ──
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
