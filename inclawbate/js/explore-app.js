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
    var INITIAL_SHOW = 6;

    // cached full lists for "show more"
    var _allTokens = [];
    var _allApps = [];

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

    function tokenRowHtml(p, i) {
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
    }

    function renderTokenRows(count) {
        var tbody = document.getElementById('exploreTokensBody');
        var btn = document.getElementById('tokensShowMore');
        var items = _allTokens.slice(0, count);
        tbody.innerHTML = items.map(tokenRowHtml).join('');
        if (btn) btn.style.display = count >= _allTokens.length ? 'none' : '';
    }

    // ── Load Tokens (table rows) ──
    async function loadTokens() {
        var section = document.getElementById('exploreTokens');
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

            _allTokens = projects;
            if (!projects.length) return;

            renderTokenRows(INITIAL_SHOW);
            section.classList.add('visible');
        } catch (e) {}
    }

    // ── Staking Pools (hardcoded core + dynamic from API) ──
    var STAKING_POOLS = {
        claws:    { name:'CLAWS',              ticker:'CLAWS',    token:'0x7ca47B141639B893C6782823C0b219f872056379', staking:'0x551d9dCd8B49893b9D0E1CA41a128ec202845F40', logo:'/inclawbate/assets/clawslogo.jpg',    color:'hsl(172,50%,42%)', rewardTicker:'CLAWS', retired:false },
        bv7x:    { name:'BitVault Signal',     ticker:'BV7X',     token:'0xD88FD4a11255E51f64f78b4a7d74456325c2d8dC', staking:'0x65Aec0C9fd455822F1cC0e3De7965B106d182017', logo:'/inclawbate/assets/bv7x-logo.jpg',    color:'hsl(220,70%,50%)', rewardTicker:'BV7X', retired:false },
        clawnch:  { name:'CLAWNCH',            ticker:'CLAWNCH',  token:'0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be', staking:'0xAda0e738F0E4DEb4e2C0B83d6836DE953f2e57b9', logo:'/inclawbate/assets/clawnchlogo.jpg',  color:'hsl(32,50%,50%)',  rewardTicker:'INCLAWNCH', rewardToken:'0xB0b6e0E9da530f68D713cC03a813B506205aC808', retired:false },
        clawnstr: { name:'ClawnStrategy',      ticker:'CLAWNSTR', token:'0x1c6B6b77bDC1d1DeBc35760901f39f4A0A66BAa1', staking:'0x9f7cD1C3e4526937736629a400acBdcA50836848', logo:'/inclawbate/assets/clawnstr-logo.jpg', color:'hsl(0,68%,42%)',   rewardTicker:'CLAWNSTR', retired:false },
        s4h:      { name:'Salvation 4 Humanity',ticker:'S4H',     token:'0x30F5BcB8bdA2B91430BE93dBaE08aC346884EB07', staking:'0x3A7F8a12fD0DAe62dd45e1E641dBb687a90F170D', logo:'/salvation4humanity/assets/s4hlogo.png', color:'hsl(35,38%,38%)', rewardTicker:'INCLAWNCH', rewardToken:'0xB0b6e0E9da530f68D713cC03a813B506205aC808', retired:false },
        inclawnch:{ name:'inCLAWNCH',          ticker:'INCLAWNCH',token:'0xB0b6e0E9da530f68D713cC03a813B506205aC808', staking:'0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6', logo:'/inclawbate/assets/logo-circle.jpg',   color:'hsl(172,32%,48%)', rewardTicker:'INCLAWNCH', retired:true }
    };
    var COMING_SOON_POOLS = [
        { name:'MirrorMind', ticker:'MIRROR', logo:null, color:'hsl(280,60%,55%)' }
    ];

    var BASE_RPCS = [
        'https://mainnet.base.org',
        'https://1rpc.io/base',
        'https://base-mainnet.public.blastapi.io'
    ];
    var SEL_totalStaked  = '0x817b1cd2';
    var SEL_stakerCount  = '0xdff69787';
    var SEL_rewardRate   = '0x7b0a47ee';

    async function rpcBatch(calls) {
        var batch = calls.map(function(c,i){
            return { jsonrpc:'2.0', id:i+1, method:'eth_call', params:[{to:c.to,data:c.data},'latest'] };
        });
        for (var r=0; r<BASE_RPCS.length; r++) {
            try {
                var res = await fetch(BASE_RPCS[r], { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(batch) });
                var json = await res.json();
                if (Array.isArray(json)) {
                    json.sort(function(a,b){ return a.id-b.id; });
                    return json.map(function(x){ return (x.result && x.result !== '0x') ? x.result : '0x0'; });
                }
            } catch(e){}
        }
        return calls.map(function(){ return '0x0'; });
    }

    function fromWei(hex) {
        if (!hex || hex==='0x' || hex==='0x0') return 0;
        try { return Number(BigInt(hex))/1e18; } catch(e){ return 0; }
    }
    function safeNum(hex) {
        if (!hex || hex==='0x' || hex==='0x0') return 0;
        try { return Number(BigInt(hex)); } catch(e){ return 0; }
    }
    function fmtUsd(n) {
        if (n>=1e6) return '$'+(n/1e6).toFixed(1)+'M';
        if (n>=1e4) return '$'+(n/1e3).toFixed(0)+'K';
        if (n>=1e3) return '$'+(n/1e3).toFixed(1)+'K';
        if (n>=0.01) return '$'+n.toFixed(2);
        return '$0';
    }

    var _allPools = [];

    function poolRowHtml(p, i) {
        var apyStr = p.retired ? '0%' : (p.apy > 0 ? Math.round(p.apy).toLocaleString('en-US')+'%' : '--');
        var tvlStr = p.tvl > 0 ? fmtUsd(p.tvl) : '--';
        var stakersStr = p.stakers > 0 ? p.stakers.toLocaleString('en-US') : '--';
        var btnText = p.retired ? 'Unstake' : 'Stake';
        var earnTag = p.retired ? '' : '<span class="exp-sub" style="margin-left:0;display:block;">Earn $' + escapeHtml(p.rewardTicker) + '</span>';
        return '<tr onclick="window.location.href=\'/stake/' + escapeHtml(p.ticker.toLowerCase()) + '\'">' +
            '<td><span class="exp-rank">' + (i+1) + '</span></td>' +
            '<td><div class="exp-name-cell">' + logoHtml(p.logo, p.name, p.color) +
                '<div><span class="exp-name">' + escapeHtml(p.name) + '</span><span class="exp-sub">$' + escapeHtml(p.ticker) + '</span>' + earnTag + '</div>' +
            '</div></td>' +
            '<td><span class="exp-stat' + (p.apy > 0 && !p.retired ? ' style="color:var(--seafoam-300)"' : '') + '">' + apyStr + '</span></td>' +
            '<td><span class="exp-stat">' + tvlStr + '</span></td>' +
            '<td><span class="exp-stat">' + stakersStr + '</span></td>' +
            '<td><div class="exp-actions"><a href="/stake/' + escapeHtml(p.ticker.toLowerCase()) + '" class="exp-btn exp-btn--stake" onclick="event.stopPropagation()">' + btnText + '</a></div></td>' +
        '</tr>';
    }

    function renderPoolRows(count) {
        var tbody = document.getElementById('explorePoolsBody');
        var btn = document.getElementById('poolsShowMore');
        var items = _allPools.slice(0, count);
        var html = items.map(poolRowHtml).join('');
        // Coming soon at end
        if (count >= _allPools.length) {
            COMING_SOON_POOLS.forEach(function(cs, ci) {
                var rank = items.length + ci + 1;
                html += '<tr style="opacity:0.5">' +
                    '<td><span class="exp-rank">' + rank + '</span></td>' +
                    '<td><div class="exp-name-cell">' + logoHtml(cs.logo, cs.name, cs.color) +
                        '<div><span class="exp-name">' + escapeHtml(cs.name) + '</span><span class="exp-sub">$' + escapeHtml(cs.ticker) + '</span><span class="exp-sub" style="margin-left:0;display:block;color:var(--text-dim)">Coming Soon</span></div>' +
                    '</div></td>' +
                    '<td><span class="exp-stat">--</span></td><td><span class="exp-stat">--</span></td><td><span class="exp-stat">--</span></td><td></td></tr>';
            });
        }
        tbody.innerHTML = html;
        if (btn) btn.style.display = count >= _allPools.length ? 'none' : '';
    }

    async function loadPools() {
        var section = document.getElementById('explorePools');
        try {
            // Load dynamic pools from inclawbator API (same as stake page)
            try {
                var apiRes = await fetch('/api/inclawbate/inclawbator');
                if (apiRes.ok) {
                    var apiData = await apiRes.json();
                    (apiData.projects || []).forEach(function(p) {
                        if (!p.staking_address || !p.token_address) return;
                        var key = p.token_symbol.toLowerCase();
                        if (STAKING_POOLS[key]) return;
                        STAKING_POOLS[key] = {
                            name: p.token_name, ticker: p.token_symbol, token: p.token_address,
                            rewardToken: '0xB0b6e0E9da530f68D713cC03a813B506205aC808', rewardTicker: 'CLAWS',
                            staking: p.staking_address, logo: p.logo_url || null,
                            color: p.color || 'hsl(172,32%,48%)', retired: false
                        };
                    });
                }
            } catch(e){}

            var STAKING_KEYS = Object.keys(STAKING_POOLS);

            // Fetch on-chain stats
            var calls = [];
            STAKING_KEYS.forEach(function(key) {
                var s = STAKING_POOLS[key].staking;
                calls.push({ to:s, data:SEL_totalStaked });
                calls.push({ to:s, data:SEL_stakerCount });
                calls.push({ to:s, data:SEL_rewardRate });
            });
            var results = await rpcBatch(calls);

            // Fetch prices
            var tokenAddrs = [];
            var seen = {};
            STAKING_KEYS.forEach(function(key) {
                var a = STAKING_POOLS[key].token.toLowerCase();
                if (!seen[a]) { seen[a]=true; tokenAddrs.push(STAKING_POOLS[key].token); }
                if (STAKING_POOLS[key].rewardToken) {
                    var ra = STAKING_POOLS[key].rewardToken.toLowerCase();
                    if (!seen[ra]) { seen[ra]=true; tokenAddrs.push(STAKING_POOLS[key].rewardToken); }
                }
            });
            var addrPrices = {};
            try {
                var dexRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + tokenAddrs.join(','));
                var dexJson = await dexRes.json();
                (dexJson.pairs || []).forEach(function(pair) {
                    var ba = pair.baseToken && pair.baseToken.address ? pair.baseToken.address.toLowerCase() : '';
                    var price = parseFloat(pair.priceUsd) || 0;
                    if (ba && price > 0 && (!addrPrices[ba] || price > addrPrices[ba])) {
                        addrPrices[ba] = price;
                    }
                });
            } catch(e){}

            // Build pool data
            _allPools = [];
            STAKING_KEYS.forEach(function(key, i) {
                var pool = STAKING_POOLS[key];
                var base = i*3;
                var totalStaked = fromWei(results[base]);
                var stakers = safeNum(results[base+1]);
                var rewardRate = fromWei(results[base+2]);
                var price = addrPrices[pool.token.toLowerCase()] || 0;
                var tvl = totalStaked * price;
                var apy = 0;
                if (totalStaked > 0 && rewardRate > 0) {
                    var rawApy = (rewardRate * 86400 * 365 / totalStaked) * 100;
                    if (pool.rewardToken) {
                        var rp = addrPrices[pool.rewardToken.toLowerCase()] || 0;
                        if (price > 0 && rp > 0) apy = rawApy * (rp / price);
                        else apy = rawApy;
                    } else {
                        apy = rawApy;
                    }
                }
                _allPools.push({
                    name: pool.name, ticker: pool.ticker, logo: pool.logo, color: pool.color,
                    rewardTicker: pool.rewardTicker, retired: pool.retired,
                    tvl: tvl, apy: apy, stakers: stakers
                });
            });

            // Sort by TVL desc
            _allPools.sort(function(a,b){ return b.tvl - a.tvl; });

            renderPoolRows(INITIAL_SHOW);
            section.classList.add('visible');
        } catch(e) {
            section.classList.add('visible');
        }
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

    function appRowHtml(app, i) {
        var hasAuth = !!getAuth();
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
    }

    function renderAppRows(count) {
        var tbody = document.getElementById('exploreAppsBody');
        var btn = document.getElementById('appsShowMore');
        var items = _allApps.slice(0, count);
        tbody.innerHTML = items.map(appRowHtml).join('');
        if (btn) btn.style.display = count >= _allApps.length ? 'none' : '';
    }

    // ── Load Apps (table rows) ──
    async function loadApps() {
        var section = document.getElementById('exploreApps');
        try {
            var res = await fetch('/api/inclawbate/apps?sort=trending&limit=50');
            var json = await res.json();
            var apps = json.apps || [];
            if (!apps.length) return;

            _allApps = apps;
            renderAppRows(INITIAL_SHOW);
            section.classList.add('visible');
        } catch (e) {}
    }

    // ── Show more handlers ──
    document.getElementById('tokensShowMore').addEventListener('click', function () {
        renderTokenRows(_allTokens.length);
    });
    document.getElementById('poolsShowMore').addEventListener('click', function () {
        renderPoolRows(_allPools.length);
    });
    document.getElementById('appsShowMore').addEventListener('click', function () {
        renderAppRows(_allApps.length);
    });

    // ── Init ──
    load();
    loadPools();
    loadTokens();
    loadSavedSlugs().then(loadApps);
})();
