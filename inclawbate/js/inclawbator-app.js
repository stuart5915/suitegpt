// Inclawbator — Token Launch + Staking Factory + Admin Distribution
// Pattern: IIFE, raw EIP-1193 (same as stake-app.js)

(function() {
'use strict';

// ══════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════

var BASE_CHAIN_ID = '0x2105';
var INCLAWNCH = '0xB0b6e0E9da530f68D713cC03a813B506205aC808';
var CLAWS = '0x7ca47B141639B893C6782823C0b219f872056379';
var CLANKER_V4 = '0xE85A59c628F7d27878ACeB4bf3b35733630083a9';
var DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';
var ADMIN_WALLETS = [
    '0x91b5c0d07859cfeafeb67d9694121cd741f049bd',
    '0xa00e81ecedd4d007965997c6cc64d9372bec397e',
    '0x612abfe54269515f0cc63b4a12fee32d48889ff2',
    '0x9fe6e70079d9cbab7693b70a11764d70cf26ce0e',
    '0x18b18e245122f4bda5f2ee4f25c702e05c241d49',
    '0x3392f862de3a2918c774cdc5c1662e2c02b9e5a3'
];
var MAX_UINT256 = '0x' + 'f'.repeat(64);

// Staking factory v2 (deployed on Base — fee to inclawbate.base.eth)
var STAKING_FACTORY = '0x7AE0768D9F36088fB967e530A8F4A3936b40B621';

// inclawbate.base.eth — receives 20% of LP reward fees
var INCLAWBATE_TREASURY = '0x91B5C0D07859CFeAfEB67d9694121CD741F049bd';

// ══════════════════════════════════════
// SELECTORS
// ══════════════════════════════════════

var SEL = {
    approve:          '0x095ea7b3', // approve(address,uint256)
    depositRewards:   '0xbdd071fb', // depositRewards(uint256,uint256)
    // Staking factory
    deployPaid:       '0x82123c96', // deployPaid(address,address)
    deployFree:       '0x489e57a1', // deployFree(address,address,address)
    deployFee:        '0xeb2a5d2c', // deployFee() → uint256
    feeRecipient:     '0x46904840', // feeRecipient() → address
    // ERC20 view
    name:             '0x06fdde03', // name() → string
    symbol:           '0x95d89b41', // symbol() → string
    // View
    balanceOf:        '0x70a08231',
    totalStaked:      '0x817b1cd2',
    stakerCount:      '0xdff69787',
    rewardRate:       '0x7b0a47ee',
    periodEnd:        '0x506ec095',
    rewardPoolBalance:'0x7a5c08ae',
    earned:           '0x008cc262',
};

// ══════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════

function pad32(hex) { return hex.replace('0x', '').padStart(64, '0'); }
function toHex(n) { return '0x' + BigInt(n).toString(16); }
function fromWei(hex) {
    if (!hex || hex === '0x' || hex === '0x0') return 0;
    return Number(BigInt(hex)) / 1e18;
}
function shortAddr(a) { return a.slice(0, 6) + '...' + a.slice(-4); }
function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); }

var BASE_RPCS = [
    'https://mainnet.base.org',
    'https://1rpc.io/base',
    'https://base-mainnet.public.blastapi.io',
    'https://base.drpc.org'
];

async function rpcFetch(body) {
    for (var i = 0; i < BASE_RPCS.length; i++) {
        try {
            var controller = new AbortController();
            var timeout = setTimeout(function() { controller.abort(); }, 5000);
            var res = await fetch(BASE_RPCS[i], {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal
            });
            clearTimeout(timeout);
            var json = await res.json();
            if (json.error) continue;
            return json;
        } catch (e) { continue; }
    }
    return null;
}

async function contractRead(to, data) {
    var json = await rpcFetch({ jsonrpc: '2.0', id: 1, method: 'eth_call',
        params: [{ to: to, data: data }, 'latest'] });
    return (json && json.result) || '0x0';
}

async function sendTxAndWait(provider, from, to, data, gasLimit) {
    try {
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID }] });
    } catch (switchErr) {
        if (switchErr.code === 4902) {
            await provider.request({
                method: 'wallet_addEthereumChain',
                params: [{ chainId: BASE_CHAIN_ID, chainName: 'Base', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://mainnet.base.org'], blockExplorerUrls: ['https://basescan.org'] }]
            });
        }
    }
    var txParams = { from: from, to: to, data: data };
    if (gasLimit) txParams.gas = gasLimit;
    var txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [txParams]
    });
    for (var i = 0; i < 90; i++) {
        await new Promise(function(r) { setTimeout(r, 2000); });
        var receipt = await provider.request({
            method: 'eth_getTransactionReceipt', params: [txHash]
        });
        if (receipt) {
            if (receipt.status !== '0x1') throw new Error('Transaction reverted');
            return { txHash: txHash, receipt: receipt };
        }
    }
    throw new Error('Transaction timed out');
}

// ══════════════════════════════════════
// STATE
// ══════════════════════════════════════

var state = {
    wallet: null,
    provider: null,
    activeDrawer: null, // 'launch' | 'pool' | 'incubate' | null
    step: 0,        // 0=normal, 4=launch success, 5=incubated success, 7=pool success
    deploying: false,
    project: null,
    deployedToken: null,
    deployTxHash: null,
    isAdmin: false,
    projects: [],
};

// ══════════════════════════════════════
// WALLET
// ══════════════════════════════════════

async function connectWallet() {
    if (!window.ethereum) {
        showToast('MetaMask not detected. Please install MetaMask.', 'error');
        return;
    }
    try {
        var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length > 0) {
            state.wallet = accounts[0].toLowerCase();
            state.provider = window.ethereum;
            state.isAdmin = ADMIN_WALLETS.includes(state.wallet);
            try {
                await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID }] });
            } catch (e) {
                if (e.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{ chainId: BASE_CHAIN_ID, chainName: 'Base', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://mainnet.base.org'], blockExplorerUrls: ['https://basescan.org'] }]
                    });
                }
            }
            updateUI();
            updateComingSoonGate();
        }
    } catch (e) {
        showToast('Wallet connection failed', 'error');
    }
}

function updateComingSoonGate() {
    var overlay = document.getElementById('comingSoonOverlay');
    if (!overlay) return;
    if (state.isAdmin) {
        overlay.classList.add('hidden');
    } else {
        overlay.classList.remove('hidden');
    }
}

// ══════════════════════════════════════
// TOAST
// ══════════════════════════════════════

function showToast(msg, type) {
    var container = document.getElementById('toastContainer');
    if (!container) return;
    var toast = document.createElement('div');
    toast.className = 'incubator-toast' + (type ? ' incubator-toast--' + type : '');
    var icon = type === 'error' ? '\u26A0\uFE0F' : type === 'success' ? '\u2705' : '\u2139\uFE0F';
    toast.innerHTML = '<span>' + icon + '</span><span>' + msg + '</span>';
    container.appendChild(toast);
    requestAnimationFrame(function() { toast.classList.add('visible'); });
    setTimeout(function() {
        toast.classList.add('hiding');
        setTimeout(function() { toast.remove(); }, 300);
    }, 4000);
}

// ══════════════════════════════════════
// API
// ══════════════════════════════════════

var API_BASE = '/api/inclawbate/inclawbator';

async function apiGet(params) {
    var url = API_BASE + (params ? '?' + new URLSearchParams(params).toString() : '');
    var res = await fetch(url);
    return res.json();
}

async function apiPost(body) {
    var token = localStorage.getItem('inclawbate_token');
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    var res = await fetch(API_BASE, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
    });
    return res.json();
}

// ══════════════════════════════════════
// CLANKER V4 DEPLOY
// ══════════════════════════════════════

var CLANKER_SELECTOR = 'df40224a';
var WETH_BASE = '0x4200000000000000000000000000000000000006';
var CLANKER_HOOK_DYNAMIC_V2 = '0xd60D6B218116cFd801E28F78d011a203D2b068Cc';
var CLANKER_LP_LOCKER = '0x63D2DfEA64b3433F4071A98665bcD7Ca14d93496';
var CLANKER_SNIPER_AUCTION = '0xebB25BB797D82CB78E1bc70406b13233c0854413';
var ZERO_ADDR = '0x0000000000000000000000000000000000000000';

var DEPLOY_TOKEN_ABI = [{
    name: 'deployToken',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{
        name: 'deploymentConfig',
        type: 'tuple',
        components: [
            { name: 'tokenConfig', type: 'tuple', components: [
                { name: 'tokenAdmin', type: 'address' },
                { name: 'name', type: 'string' },
                { name: 'symbol', type: 'string' },
                { name: 'salt', type: 'bytes32' },
                { name: 'image', type: 'string' },
                { name: 'metadata', type: 'string' },
                { name: 'context', type: 'string' },
                { name: 'originatingChainId', type: 'uint256' }
            ]},
            { name: 'poolConfig', type: 'tuple', components: [
                { name: 'hook', type: 'address' },
                { name: 'pairedToken', type: 'address' },
                { name: 'tickIfToken0IsClanker', type: 'int24' },
                { name: 'tickSpacing', type: 'int24' },
                { name: 'poolData', type: 'bytes' }
            ]},
            { name: 'lockerConfig', type: 'tuple', components: [
                { name: 'locker', type: 'address' },
                { name: 'rewardAdmins', type: 'address[]' },
                { name: 'rewardRecipients', type: 'address[]' },
                { name: 'rewardBps', type: 'uint16[]' },
                { name: 'tickLower', type: 'int24[]' },
                { name: 'tickUpper', type: 'int24[]' },
                { name: 'positionBps', type: 'uint16[]' },
                { name: 'lockerData', type: 'bytes' }
            ]},
            { name: 'mevModuleConfig', type: 'tuple', components: [
                { name: 'mevModule', type: 'address' },
                { name: 'mevModuleData', type: 'bytes' }
            ]},
            { name: 'extensionConfigs', type: 'tuple[]', components: [
                { name: 'extension', type: 'address' },
                { name: 'msgValue', type: 'uint256' },
                { name: 'extensionBps', type: 'uint16' },
                { name: 'extensionData', type: 'bytes' }
            ]}
        ]
    }],
    outputs: [{ name: 'tokenAddress', type: 'address' }]
}];

function encodeClankerDeploy(name, symbol) {
    var iface = new ethers.Interface(DEPLOY_TOKEN_ABI);
    var saltBytes = new Uint8Array(32);
    crypto.getRandomValues(saltBytes);
    var salt = '0x' + Array.from(saltBytes).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');

    // Dynamic fee pool data for ClankerHookDynamicFeeV2
    // Extracted from verified successful deploy tx (March 2026)
    var DYNAMIC_FEE_POOL_DATA = '0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000002710000000000000000000000000000000000000000000000000000000000000c350000000000000000000000000000000000000000000000000000000000000001e000000000000000000000000000000000000000000000000000000000000007800000000000000000000000000000000000000000000000000000000000000c8000000000000000000000000000000000000000000000000000000001dcd65000000000000000000000000000000000000000000000000000000000000001d4c';

    // Sniper auction MEV module data: startingFee=666777, endingFee=41673, secondsToDecay=15
    // Anti-sniper protection matching current Clanker deploys
    var SNIPER_MEV_DATA = '0x00000000000000000000000000000000000000000000000000000000000a2c99000000000000000000000000000000000000000000000000000000000000a2c9000000000000000000000000000000000000000000000000000000000000000f';

    var deploymentConfig = {
        tokenConfig: {
            tokenAdmin: state.wallet,
            name: name,
            symbol: symbol,
            salt: salt,
            image: '',
            metadata: '',
            context: '',
            originatingChainId: 8453
        },
        poolConfig: {
            hook: CLANKER_HOOK_DYNAMIC_V2,
            pairedToken: WETH_BASE,
            tickIfToken0IsClanker: -230400,
            tickSpacing: 200,
            poolData: DYNAMIC_FEE_POOL_DATA
        },
        lockerConfig: {
            locker: CLANKER_LP_LOCKER,
            rewardAdmins: [state.wallet, INCLAWBATE_TREASURY],
            rewardRecipients: [state.wallet, INCLAWBATE_TREASURY],
            rewardBps: [8000, 2000],
            tickLower: [-230400],
            tickUpper: [-120000],
            positionBps: [10000],
            lockerData: '0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001'
        },
        mevModuleConfig: {
            mevModule: CLANKER_SNIPER_AUCTION,
            mevModuleData: SNIPER_MEV_DATA
        },
        extensionConfigs: []
    };

    return iface.encodeFunctionData('deployToken', [deploymentConfig]);
}

var TOKEN_CREATED_TOPIC = '0x9299d1d1a88d8e1abdc591ae7a167a6bc63a8f17d695804e9091ee33aa89fb67';
var TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
var ZERO_ADDR_TOPIC = '0x0000000000000000000000000000000000000000000000000000000000000000';

function parseDeployedToken(receipt) {
    if (!receipt || !receipt.logs) return null;
    var logs = receipt.logs;

    // Strategy 1: Find TokenCreated event from Clanker V4
    for (var i = 0; i < logs.length; i++) {
        var log = logs[i];
        if (log.address && log.address.toLowerCase() === CLANKER_V4.toLowerCase() && log.topics && log.topics.length >= 2) {
            return '0x' + log.topics[1].slice(26);
        }
    }

    // Strategy 2: Find TokenCreated event by signature (any emitter)
    for (var i = 0; i < logs.length; i++) {
        var log = logs[i];
        if (log.topics && log.topics[0] === TOKEN_CREATED_TOPIC && log.topics.length >= 2) {
            return '0x' + log.topics[1].slice(26);
        }
    }

    // Strategy 3: Find first Transfer from address(0) — the token mint
    // The log.address of that Transfer IS the new token contract
    for (var i = 0; i < logs.length; i++) {
        var log = logs[i];
        if (log.topics && log.topics[0] === TRANSFER_TOPIC && log.topics[1] === ZERO_ADDR_TOPIC && log.address) {
            return log.address.length === 42 ? log.address : '0x' + log.address.slice(26);
        }
    }

    return null;
}

function parsePoolDeployed(receipt) {
    if (!receipt || !receipt.logs) return null;
    for (var i = 0; i < receipt.logs.length; i++) {
        var log = receipt.logs[i];
        if (log.address && STAKING_FACTORY &&
            log.address.toLowerCase() === STAKING_FACTORY.toLowerCase() &&
            log.topics && log.topics.length >= 2) {
            return '0x' + log.topics[1].slice(26);
        }
    }
    return null;
}

// ══════════════════════════════════════
// TOKEN HELPERS
// ══════════════════════════════════════

function decodeString(hex) {
    if (!hex || hex === '0x' || hex.length < 130) return '';
    try {
        var offset = parseInt(hex.slice(2, 66), 16) * 2;
        var len = parseInt(hex.slice(2 + offset, 2 + offset + 64), 16);
        var data = hex.slice(2 + offset + 64, 2 + offset + 64 + len * 2);
        var bytes = [];
        for (var i = 0; i < data.length; i += 2) bytes.push(parseInt(data.substr(i, 2), 16));
        return new TextDecoder().decode(new Uint8Array(bytes));
    } catch (e) { return ''; }
}

async function readTokenInfo(address) {
    var nameHex = await contractRead(address, SEL.name);
    var symbolHex = await contractRead(address, SEL.symbol);
    return { name: decodeString(nameHex), symbol: decodeString(symbolHex) };
}

async function readDeployFee() {
    var hex = await contractRead(STAKING_FACTORY, SEL.deployFee);
    return fromWei(hex);
}

// ══════════════════════════════════════
// TOOL DRAWER
// ══════════════════════════════════════

function openToolDrawer(tool) {
    // If clicking the same tool, close the drawer
    if (state.activeDrawer === tool) {
        closeToolDrawer();
        return;
    }

    // Connect wallet if not connected
    if (!state.wallet) {
        connectWallet().then(function() {
            if (state.wallet) openToolDrawer(tool);
        });
        return;
    }

    state.activeDrawer = tool;

    // Highlight active card
    document.querySelectorAll('.tool-card[data-tool]').forEach(function(card) {
        card.classList.toggle('active', card.dataset.tool === tool);
    });

    // Show drawer
    var drawer = document.getElementById('toolDrawer');
    if (drawer) {
        drawer.classList.add('open');
        // Reset animation
        drawer.style.animation = 'none';
        drawer.offsetHeight; // force reflow
        drawer.style.animation = '';
    }

    // Show correct content
    var drawers = { launch: 'drawerLaunch', pool: 'drawerPool', incubate: 'drawerIncubate', agent: 'drawerAgent' };
    Object.keys(drawers).forEach(function(key) {
        var el = document.getElementById(drawers[key]);
        if (el) el.classList.toggle('active', key === tool);
    });

    // Load apps when agent drawer opens
    if (tool === 'agent') loadAgentApps();

    // Load user's tokens when pool drawer opens
    if (tool === 'pool') loadPoolTokens();

    // Scroll drawer into view
    if (drawer) {
        setTimeout(function() { drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 100);
    }
}

function closeToolDrawer() {
    state.activeDrawer = null;

    document.querySelectorAll('.tool-card[data-tool]').forEach(function(card) {
        card.classList.remove('active');
    });

    var drawer = document.getElementById('toolDrawer');
    if (drawer) drawer.classList.remove('open');

    document.querySelectorAll('.drawer-content').forEach(function(el) {
        el.classList.remove('active');
    });
}

// Pool token selector — load user's launched tokens
var poolTokensCache = null;

async function loadPoolTokens() {
    var loading = document.getElementById('poolTokenLoading');
    var noTokens = document.getElementById('poolNoTokens');
    var form = document.getElementById('poolTokenForm');
    var select = document.getElementById('poolTokenSelect');

    if (!loading || !noTokens || !form || !select) return;

    // Must be connected
    if (!state.wallet) {
        loading.classList.add('hidden');
        noTokens.classList.remove('hidden');
        noTokens.querySelector('p').textContent = 'Connect your wallet first.';
        form.classList.add('hidden');
        return;
    }

    // If already cached, use it
    if (poolTokensCache) {
        showPoolTokenForm(poolTokensCache, loading, noTokens, form, select);
        return;
    }

    loading.classList.remove('hidden');
    noTokens.classList.add('hidden');
    form.classList.add('hidden');

    try {
        var res = await fetch('/api/inclawbate/inclawbator?wallet=' + encodeURIComponent(state.wallet.toLowerCase()));
        var data = await res.json();
        var projects = (data.projects || []).filter(function(p) {
            return p.token_address && p.status === 'active' && !p.staking_address;
        });
        poolTokensCache = projects;
        showPoolTokenForm(projects, loading, noTokens, form, select);
    } catch (e) {
        loading.textContent = 'Failed to load tokens.';
    }
}

function showPoolTokenForm(projects, loading, noTokens, form, select) {
    loading.classList.add('hidden');

    if (projects.length === 0) {
        noTokens.classList.remove('hidden');
        noTokens.querySelector('p').textContent = "You don't have any tokens without a staking pool. Launch a token first, or all your tokens already have pools.";
        form.classList.add('hidden');
        return;
    }

    noTokens.classList.add('hidden');
    form.classList.remove('hidden');

    // Populate select
    select.innerHTML = '<option value="">Choose a token...</option>';
    projects.forEach(function(p) {
        var opt = document.createElement('option');
        opt.value = p.token_address;
        opt.textContent = (p.token_name || 'Unknown') + ' ($' + (p.token_symbol || '???') + ')';
        opt.dataset.name = p.token_name || '';
        opt.dataset.symbol = p.token_symbol || '';
        select.appendChild(opt);
    });

    // Wire select change to update preview
    select.onchange = function() {
        var preview = document.getElementById('partnerTokenPreview');
        var selected = select.options[select.selectedIndex];
        if (select.value && selected.dataset.name) {
            document.getElementById('partnerTokenName').textContent = selected.dataset.name;
            document.getElementById('partnerTokenSymbol').textContent = '$' + selected.dataset.symbol;
            document.getElementById('partnerTokenIcon').textContent = (selected.dataset.symbol || '?')[0];
            preview.classList.remove('hidden');
        } else {
            preview.classList.add('hidden');
        }
    };
}

// ══════════════════════════════════════
// LAUNCH AI AGENT
// ══════════════════════════════════════

var agentAppsCache = null;

async function loadAgentApps() {
    var select = document.getElementById('agentAppSelect');
    if (!select) return;

    if (agentAppsCache) {
        populateAppSelect(select, agentAppsCache);
        return;
    }

    select.innerHTML = '<option value="">Loading apps...</option>';

    try {
        var res = await fetch('/api/inclawbate/apps?limit=50&sort=trending');
        var data = await res.json();
        agentAppsCache = data.apps || [];
        populateAppSelect(select, agentAppsCache);
    } catch (e) {
        select.innerHTML = '<option value="">Failed to load apps</option>';
    }
}

function populateAppSelect(select, apps) {
    if (!apps || apps.length === 0) {
        select.innerHTML = '<option value="">No apps available</option>';
        return;
    }
    var html = '<option value="">Choose an app...</option>';
    apps.forEach(function(app) {
        html += '<option value="' + app.id + '" data-name="' + escapeHtml(app.name) + '" data-desc="' + escapeHtml(app.description || '') + '">' + escapeHtml(app.name) + (app.category ? ' (' + app.category + ')' : '') + '</option>';
    });
    select.innerHTML = html;
}

async function handleAgentLaunch() {
    if (state.deploying) return;

    var appSelect = document.getElementById('agentAppSelect');
    var appId = appSelect ? appSelect.value : '';
    var persona = document.getElementById('agentPersona').value.trim();
    var postsPerDay = parseInt(document.getElementById('agentPostsPerDay').value) || 4;

    if (!appId) return showToast('Please select an app', 'error');

    if (!state.wallet) {
        await connectWallet();
        if (!state.wallet) return;
    }

    state.deploying = true;
    var btn = document.getElementById('deployAgentBtn');
    setBtnState(btn, 'Launching agent...', true);

    try {
        var result = await apiPost({
            action: 'launch-agent',
            app_id: appId,
            agent_persona: persona || null,
            agent_posts_per_day: postsPerDay,
            creator_wallet: state.wallet
        });

        if (result.error) {
            showToast('Agent launch failed: ' + result.error, 'error');
            state.deploying = false;
            setBtnState(btn, 'Launch Agent', false);
            return;
        }

        state.deploying = false;
        closeToolDrawer();
        showToast('AI Agent launched! First post within 30 minutes.', 'success');

    } catch (e) {
        state.deploying = false;
        setBtnState(btn, 'Launch Agent', false);
        showToast('Agent launch failed: ' + (e.message || 'Unknown error'), 'error');
    }
}

// ══════════════════════════════════════
// DEPLOY: LAUNCH TOKEN
// ══════════════════════════════════════

async function handleLaunchDeploy() {
    if (state.deploying) return;

    var name = document.getElementById('tokenName').value.trim();
    var symbol = document.getElementById('tokenSymbol').value.trim().toUpperCase();
    var desc = document.getElementById('launchDesc').value.trim();
    var website = document.getElementById('launchWebsite').value.trim();

    if (!name) return showToast('Token name is required', 'error');
    if (!symbol || symbol.length > 10) return showToast('Symbol required (max 10 chars)', 'error');

    if (!state.wallet) {
        await connectWallet();
        if (!state.wallet) return;
    }

    state.deploying = true;
    var btn = document.getElementById('deployLaunchBtn');
    setBtnState(btn, 'Deploying token...', true);

    try {
        // Step 1: Deploy token via Clanker v4
        var calldata = encodeClankerDeploy(name, symbol);
        var result = await sendTxAndWait(state.provider, state.wallet, CLANKER_V4, calldata, '0x7A1200');

        var tokenAddress = parseDeployedToken(result.receipt);

        // Fallback: re-fetch receipt via public RPC (mobile wallets sometimes return incomplete logs)
        if (!tokenAddress) {
            var rpcReceipt = await rpcFetch({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [result.txHash] });
            if (rpcReceipt && rpcReceipt.result) {
                tokenAddress = parseDeployedToken(rpcReceipt.result);
            }
        }

        if (!tokenAddress) {
            throw new Error('Could not find deployed token address in transaction');
        }

        state.deployedToken = tokenAddress;
        state.deployTxHash = result.txHash;

        setBtnState(btn, 'Registering project...', true);

        // Step 2: Register with API
        var regResult = await apiPost({
            action: 'register',
            token_address: tokenAddress,
            token_name: name,
            token_symbol: symbol,
            deploy_tx_hash: result.txHash,
            description: desc,
            website_url: website,
            fee_split_bps: 2000,
            tier: 'permissionless',
            creator_wallet: state.wallet
        });

        if (regResult.error) {
            showToast('Token deployed but registration failed: ' + regResult.error, 'error');
        } else {
            state.project = regResult.project;
        }

        state.step = 4;
        state.deploying = false;
        closeToolDrawer();
        updateUI();
        showToast('Token deployed! Create a stake pool from your dashboard when ready.', 'success');

    } catch (e) {
        state.deploying = false;
        setBtnState(btn, 'Deploy Token', false);
        if (e.code === 4001 || (e.message && e.message.includes('rejected'))) {
            showToast('Transaction rejected by user', 'error');
        } else {
            showToast('Deploy failed: ' + (e.message || 'Unknown error'), 'error');
        }
    }
}

function showPoolDeployPrompt(tokenAddress, name, symbol) {
    var overlay = document.createElement('div');
    overlay.className = 'pool-deploy-prompt-overlay';
    overlay.innerHTML = '<div class="pool-deploy-prompt">' +
        '<div class="pool-deploy-prompt-icon">&#128170;</div>' +
        '<h3>Staking Pool Not Deployed</h3>' +
        '<p>Your token <strong>$' + (symbol || name || '').toUpperCase() + '</strong> was deployed successfully, but the staking pool couldn\'t be created automatically.</p>' +
        '<p>You can deploy it now from the Create Stake Pool tool.</p>' +
        '<div class="pool-deploy-prompt-actions">' +
            '<button class="btn btn-primary pool-deploy-prompt-go">Deploy Pool Now</button>' +
            '<button class="btn btn-secondary pool-deploy-prompt-dismiss">Dismiss</button>' +
        '</div>' +
    '</div>';

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) overlay.remove();
    });

    overlay.querySelector('.pool-deploy-prompt-go').addEventListener('click', function() {
        overlay.remove();
        openToolDrawer('pool');
    });

    overlay.querySelector('.pool-deploy-prompt-dismiss').addEventListener('click', function() {
        overlay.remove();
    });

    document.body.appendChild(overlay);
}

// ══════════════════════════════════════
// DEPLOY: CREATE STAKE POOL
// ══════════════════════════════════════

async function handlePoolDeploy() {
    if (state.deploying) return;

    var select = document.getElementById('poolTokenSelect');
    var tokenAddress = select ? select.value : '';
    var desc = document.getElementById('poolDesc').value.trim();
    var tokenName = document.getElementById('partnerTokenName').textContent;
    var tokenSymbol = document.getElementById('partnerTokenSymbol').textContent.replace('$', '');

    if (!tokenAddress || tokenAddress.length !== 42) return showToast('Select a token first', 'error');
    if (!tokenName || tokenName === '--') return showToast('Select a token first', 'error');

    if (!state.wallet) {
        await connectWallet();
        if (!state.wallet) return;
    }

    state.deploying = true;
    var btn = document.getElementById('deployPoolBtn');
    setBtnState(btn, 'Deploying staking pool...', true);

    try {
        // Deploy staking pool (free — no CLAWS fee)
        var deployData = SEL.deployPaid + pad32(tokenAddress) + pad32(CLAWS);
        var result = await sendTxAndWait(state.provider, state.wallet, STAKING_FACTORY, deployData);

        var stakingPool = parsePoolDeployed(result.receipt);
        if (!stakingPool) throw new Error('Could not find staking pool address in receipt');

        setBtnState(btn, 'Linking staking pool...', true);

        // Step 3: Find existing project for this token and update staking address
        var existingProject = poolTokensCache ? poolTokensCache.find(function(p) { return p.token_address === tokenAddress; }) : null;
        if (existingProject && existingProject.id) {
            await apiPost({
                action: 'update-staking',
                project_id: existingProject.id,
                staking_address: stakingPool,
                staking_deploy_tx: result.txHash
            });
            existingProject.staking_address = stakingPool;
            state.project = existingProject;
        } else {
            // Fallback: register as partner (shouldn't happen with new flow)
            var regResult = await apiPost({
                action: 'register',
                token_address: tokenAddress,
                token_name: tokenName,
                token_symbol: tokenSymbol,
                description: desc,
                fee_split_bps: 10000,
                tier: 'partner',
                creator_wallet: state.wallet
            });
            if (regResult.project) {
                regResult.project.staking_address = stakingPool;
                await apiPost({
                    action: 'update-staking',
                    project_id: regResult.project.id,
                    staking_address: stakingPool,
                    staking_deploy_tx: result.txHash
                });
                state.project = regResult.project;
            }
        }

        state.step = 7; // partner success
        state.deploying = false;
        poolTokensCache = null; // Invalidate cache so it refreshes
        closeToolDrawer();
        updateUI();
        showToast('Staking deployed!', 'success');

    } catch (e) {
        state.deploying = false;
        setBtnState(btn, 'Deploy Pool', false);
        if (e.code === 4001 || (e.message && e.message.includes('rejected'))) {
            showToast('Transaction rejected', 'error');
        } else {
            showToast('Deploy failed: ' + (e.message || 'Unknown error'), 'error');
        }
    }
}

// ══════════════════════════════════════
// DEPLOY: REQUEST INCUBATION
// ══════════════════════════════════════

async function handleIncubationSubmit() {
    if (state.deploying) return;

    var name = document.getElementById('incProjectName').value.trim();
    var vision = document.getElementById('incVision').value.trim();
    var contactMethod = document.getElementById('incContactMethod').value;
    var contactHandle = document.getElementById('incContactHandle').value.trim();
    var logoUrl = document.getElementById('incLogoUrl').value.trim();
    var helpNeeded = document.getElementById('incHelpNeeded').value.trim();

    if (!name) return showToast('Project name is required', 'error');
    if (!contactHandle) return showToast('Please provide a handle or link so we can reach you', 'error');

    if (!state.wallet) {
        await connectWallet();
        if (!state.wallet) return;
    }

    state.deploying = true;
    var btn = document.getElementById('submitIncubationBtn');
    setBtnState(btn, 'Submitting application...', true);

    try {
        var description = vision;
        if (helpNeeded) description += '\n\n--- HELP NEEDED ---\n' + helpNeeded;
        description += '\n\n--- CONTACT ---\n' + contactMethod + ': ' + contactHandle;

        var xHandle = contactMethod === 'x_dms' ? contactHandle.replace(/^@/, '') : '';
        var telegram = contactMethod === 'telegram' ? contactHandle : '';

        var regResult = await apiPost({
            action: 'register',
            token_name: name,
            description: description,
            x_handle: xHandle,
            telegram_url: telegram,
            logo_url: logoUrl,
            fee_split_bps: 10000,
            tier: 'incubated',
            creator_wallet: state.wallet
        });

        if (regResult.error) {
            showToast('Submission failed: ' + regResult.error, 'error');
            state.deploying = false;
            setBtnState(btn, 'Submit Application', false);
            return;
        }

        state.project = regResult.project;
        state.step = 5; // incubated success
        state.deploying = false;
        closeToolDrawer();
        updateUI();
        showToast('Application submitted! We\'ll reach out within 48 hours.', 'success');
        setTimeout(function() { window.location.href = '/dashboard'; }, 2500);
    } catch (e) {
        state.deploying = false;
        setBtnState(btn, 'Submit Application', false);
        showToast('Submission failed: ' + (e.message || 'Unknown error'), 'error');
    }
}

// ══════════════════════════════════════
// BUTTON HELPER
// ══════════════════════════════════════

function setBtnState(btn, text, disabled) {
    if (!btn) return;
    btn.textContent = text;
    btn.disabled = disabled;
    if (disabled) {
        btn.classList.add('deploying');
    } else {
        btn.classList.remove('deploying');
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ══════════════════════════════════════
// ADMIN: BATCH DISTRIBUTION
// ══════════════════════════════════════

async function loadAdminPanel() {
    if (!state.isAdmin) return;

    var panel = document.getElementById('adminPanel');
    if (!panel) return;
    panel.style.display = 'block';

    try {
        var pendingData = await fetch(API_BASE + '?pending=true', {
            headers: { 'x-wallet': state.wallet }
        }).then(function(r) { return r.json(); });
        renderPendingApps(pendingData.projects || []);
    } catch (e) {
        var pendingList = document.getElementById('adminPendingList');
        if (pendingList) pendingList.innerHTML = '<p style="color:var(--text-dim);text-align:center">Failed to load</p>';
    }

}

function renderPendingApps(apps) {
    var list = document.getElementById('adminPendingList');
    if (!list) return;

    if (apps.length === 0) {
        list.innerHTML = '<p style="color:var(--text-dim);text-align:center">No pending applications</p>';
        return;
    }

    list.innerHTML = apps.map(function(p) {
        var borderColor = p.color || 'var(--border-subtle)';
        var meta = [];
        if (p.creator_wallet) meta.push('Wallet: ' + shortAddr(p.creator_wallet));
        if (p.x_handle) meta.push('X: @' + escapeHtml(p.x_handle).replace('@', ''));
        if (p.telegram_url) meta.push('TG: ' + escapeHtml(p.telegram_url));
        if (p.token_address) meta.push('Token: ' + shortAddr(p.token_address));

        return '<div class="admin-pending-card" style="border-color:' + borderColor + '">' +
            '<div class="pending-header">' +
                '<span class="pending-name">' + escapeHtml(p.token_name) + (p.token_symbol ? ' ($' + escapeHtml(p.token_symbol) + ')' : '') + '</span>' +
                '<span class="pending-tier">' + escapeHtml(p.tier || 'incubated') + '</span>' +
            '</div>' +
            '<div class="pending-meta">' + meta.join(' &middot; ') + '</div>' +
            (p.description ? '<div class="pending-desc">' + escapeHtml(p.description) + '</div>' : '') +
            '<div class="admin-pending-actions">' +
                '<button class="btn-approve" onclick="approveProject(\'' + p.id + '\')">Approve</button>' +
                '<button class="btn-reject" onclick="rejectProject(\'' + p.id + '\')">Reject</button>' +
            '</div>' +
        '</div>';
    }).join('');
}

async function approveProject(id) {
    var secret = prompt('Admin secret:');
    if (!secret) return;

    try {
        var result = await apiPost({ action: 'approve', project_id: id, admin_secret: secret });
        if (result.error) {
            showToast('Approve failed: ' + result.error, 'error');
        } else {
            showToast('Project approved!', 'success');
            loadAdminPanel();
        }
    } catch (e) {
        showToast('Approve failed: ' + (e.message || 'Unknown error'), 'error');
    }
}

async function rejectProject(id) {
    var reason = prompt('Rejection reason:');
    if (reason === null) return;
    var secret = prompt('Admin secret:');
    if (!secret) return;

    try {
        var result = await apiPost({ action: 'reject', project_id: id, admin_secret: secret, rejection_reason: reason });
        if (result.error) {
            showToast('Reject failed: ' + result.error, 'error');
        } else {
            showToast('Project rejected', 'success');
            loadAdminPanel();
        }
    } catch (e) {
        showToast('Reject failed: ' + (e.message || 'Unknown error'), 'error');
    }
}


// ══════════════════════════════════════
// FORM RESET
// ══════════════════════════════════════

function resetForm() {
    state.step = 0;
    state.deploying = false;
    state.project = null;
    state.deployedToken = null;
    state.deployTxHash = null;

    // Clear all form inputs
    ['tokenName', 'tokenSymbol', 'launchDesc', 'launchWebsite',
     'poolDesc',
     'incProjectName', 'incVision', 'incXHandle', 'incTelegram', 'incLogoUrl', 'incHelpNeeded',
     'agentPersona'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });

    // Reset agent drawer
    var agentPostsPerDay = document.getElementById('agentPostsPerDay');
    if (agentPostsPerDay) agentPostsPerDay.value = '4';
    var agentAppSelect = document.getElementById('agentAppSelect');
    if (agentAppSelect) agentAppSelect.value = '';
    var agentAppPreview = document.getElementById('agentAppPreview');
    if (agentAppPreview) agentAppPreview.classList.add('hidden');

    // Reset partner token preview + select
    var preview = document.getElementById('partnerTokenPreview');
    if (preview) preview.classList.add('hidden');
    var poolSelect = document.getElementById('poolTokenSelect');
    if (poolSelect) poolSelect.value = '';
    poolTokensCache = null;

    // Hide success states
    ['successStep', 'incubatedSuccessStep', 'partnerSuccessStep'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Close drawer
    closeToolDrawer();

    updateUI();
}

// Expose to onclick handlers
window.resetForm = resetForm;
window.approveProject = approveProject;
window.rejectProject = rejectProject;
window.openToolDrawer = openToolDrawer;

// ══════════════════════════════════════
// UI UPDATE
// ══════════════════════════════════════

function updateUI() {
    var connectBtn = document.getElementById('walletConnectBtn');
    var walletInfo = document.getElementById('walletInfo');

    // Wallet state
    if (state.wallet) {
        if (connectBtn) connectBtn.style.display = 'none';
        if (walletInfo) {
            walletInfo.style.display = 'flex';
            walletInfo.querySelector('.wallet-addr').textContent = shortAddr(state.wallet);
        }
    } else {
        if (connectBtn) connectBtn.style.display = 'inline-flex';
        if (walletInfo) walletInfo.style.display = 'none';
    }

    // Success states
    var successStep = document.getElementById('successStep');
    var incubatedSuccessStep = document.getElementById('incubatedSuccessStep');
    var partnerSuccessStep = document.getElementById('partnerSuccessStep');

    // Hide all success states
    if (successStep) successStep.style.display = 'none';
    if (incubatedSuccessStep) incubatedSuccessStep.style.display = 'none';
    if (partnerSuccessStep) partnerSuccessStep.style.display = 'none';

    if (state.step === 4 && successStep) {
        successStep.style.display = 'block';
        var addrEl = successStep.querySelector('.deployed-address');
        if (addrEl && state.deployedToken) addrEl.textContent = state.deployedToken;
        var txLink = successStep.querySelector('.deploy-tx-link');
        if (txLink && state.deployTxHash) txLink.href = 'https://basescan.org/tx/' + state.deployTxHash;
        var projectIdEl = successStep.querySelector('.project-id');
        if (projectIdEl && state.project) projectIdEl.textContent = state.project.id;
        var agentNote = document.getElementById('agentSuccessNote');
        if (agentNote && state.project && state.project.agent_enabled) agentNote.style.display = 'block';
    } else if (state.step === 5 && incubatedSuccessStep) {
        incubatedSuccessStep.style.display = 'block';
        var incProjectIdEl = incubatedSuccessStep.querySelector('.incubated-project-id');
        if (incProjectIdEl && state.project) incProjectIdEl.textContent = state.project.id;
    } else if (state.step === 7 && partnerSuccessStep) {
        partnerSuccessStep.style.display = 'block';
        var partnerAddrEl = partnerSuccessStep.querySelector('.partner-staking-addr');
        if (partnerAddrEl && state.project && state.project.staking_address) {
            partnerAddrEl.textContent = state.project.staking_address;
        }
        var partnerProjectIdEl = partnerSuccessStep.querySelector('.partner-project-id');
        if (partnerProjectIdEl && state.project) partnerProjectIdEl.textContent = state.project.id;
        var partnerAgentNote = document.getElementById('partnerAgentSuccessNote');
        if (partnerAgentNote && state.project && state.project.agent_enabled) partnerAgentNote.style.display = 'block';
    }

    // Admin panel
    if (state.isAdmin) {
        loadAdminPanel();
    }
}

// ══════════════════════════════════════
// ACCORDION
// ══════════════════════════════════════

function toggleAccordion() {
    var accordion = document.getElementById('learnAccordion');
    if (accordion) accordion.classList.toggle('open');
}

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════

async function init() {
    // Bind wallet connect
    var connectBtn = document.getElementById('walletConnectBtn');
    if (connectBtn) connectBtn.addEventListener('click', connectWallet);

    // Bind tool card clicks → open drawers
    document.querySelectorAll('.tool-card[data-tool]').forEach(function(card) {
        card.addEventListener('click', function(e) {
            // Don't intercept clicks on the <a> card (Build App)
            if (card.tagName === 'A') return;
            e.preventDefault();
            openToolDrawer(card.dataset.tool);
        });
    });

    // Bind deploy buttons
    var deployLaunchBtn = document.getElementById('deployLaunchBtn');
    if (deployLaunchBtn) deployLaunchBtn.addEventListener('click', handleLaunchDeploy);

    var deployPoolBtn = document.getElementById('deployPoolBtn');
    if (deployPoolBtn) deployPoolBtn.addEventListener('click', handlePoolDeploy);

    var submitIncBtn = document.getElementById('submitIncubationBtn');
    if (submitIncBtn) submitIncBtn.addEventListener('click', handleIncubationSubmit);


    // Bind agent launch
    var deployAgentBtn = document.getElementById('deployAgentBtn');
    if (deployAgentBtn) deployAgentBtn.addEventListener('click', handleAgentLaunch);

    // Agent app selector — show preview on change
    var agentAppSelect = document.getElementById('agentAppSelect');
    if (agentAppSelect) {
        agentAppSelect.addEventListener('change', function() {
            var preview = document.getElementById('agentAppPreview');
            var selected = agentAppSelect.options[agentAppSelect.selectedIndex];
            if (agentAppSelect.value && selected) {
                document.getElementById('agentAppName').textContent = selected.getAttribute('data-name') || '--';
                document.getElementById('agentAppDesc').textContent = selected.getAttribute('data-desc') || '--';
                document.getElementById('agentAppIcon').textContent = (selected.getAttribute('data-name') || '?')[0];
                if (preview) preview.classList.remove('hidden');
            } else {
                if (preview) preview.classList.add('hidden');
            }
        });
    }

    // Deploy fee removed — staking pool deploy is free (gas only)

    // Accordion toggle
    var accordionToggle = document.getElementById('learnAccordionToggle');
    if (accordionToggle) accordionToggle.addEventListener('click', toggleAccordion);

    // Auto-connect if previously connected
    if (window.ethereum) {
        try {
            var accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                state.wallet = accounts[0].toLowerCase();
                state.provider = window.ethereum;
                state.isAdmin = ADMIN_WALLETS.includes(state.wallet);
                updateUI();
            }
        } catch (e) {}
    }

    // Coming Soon gate
    updateComingSoonGate();

    // Check for X connect callback result
    var urlParams = new URLSearchParams(window.location.search);
    var xConnect = urlParams.get('x_connect');
    if (xConnect === 'success') {
        var handle = urlParams.get('handle');
        showToast('X account connected' + (handle ? ': @' + handle : '') + '! Agent will post from this account.', 'success');
        window.history.replaceState({}, '', window.location.pathname);
    } else if (xConnect === 'denied') {
        showToast('X authorization was denied', 'error');
        window.history.replaceState({}, '', window.location.pathname);
    } else if (xConnect === 'error' || xConnect === 'expired') {
        showToast('X connection failed. Please try again.', 'error');
        window.history.replaceState({}, '', window.location.pathname);
    }

    // Load admin panel (handled by updateUI when admin)
}


if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

})();
