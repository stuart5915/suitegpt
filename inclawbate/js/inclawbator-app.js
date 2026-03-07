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
var TRANSFER_SEL = '0xa9059cbb'; // transfer(address,uint256)
var CLANKER_AIRDROP_V2 = '0xf652B3610D75D81871bf96DB50825d9af28391E0';
var ALLOCATION_TIERS = { 0: 0, 1: 1000000, 2: 2000000, 5: 5000000, 10: 10000000 };
var DEFAULT_SUPPLY = 100000000000; // 100B tokens
var SUPER_ADMIN = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';
var MAX_UINT256 = '0x' + 'f'.repeat(64);

// Staking factory v2 (deployed on Base — fee to inclawbate.base.eth)
var STAKING_FACTORY = '0x7AE0768D9F36088fB967e530A8F4A3936b40B621';

// inclawbate.base.eth — receives 20% of LP reward fees
var INCLAWBATE_TREASURY = '0x91B5C0D07859CFeAfEB67d9694121CD741F049bd';

// Disperse
var DISPERSE_CONTRACT = '0xd152f549545093347a162dce210e7293f1452150';
var ALLOWANCE_HOLDER = '0x0000000000001fF3684f28c67538d4D072C22734';
var USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
var ZEROX_ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
var KNOWN_DECIMALS = {};
KNOWN_DECIMALS[USDC_BASE.toLowerCase()] = 6;
KNOWN_DECIMALS[CLAWS.toLowerCase()] = 18;
KNOWN_DECIMALS[INCLAWNCH.toLowerCase()] = 18;

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
    decimals:         '0x313ce567', // decimals() → uint8
    allowance:        '0xdd62ed3e', // allowance(owner,spender)
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

async function sendTxAndWait(provider, from, to, data, gasLimit, value) {
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
    if (value) txParams.value = value;
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
    allocationPct: 0,
    clawsBalance: 0,
    burnTxHash: null,
    // Disperse
    disperseQuote: null,
    disperseRunning: false,
};

// ══════════════════════════════════════
// WALLET
// ══════════════════════════════════════

async function connectWallet() {
    // Wait for late-loading wallets (Base Wallet EIP-6963)
    if (!window.ethereum && window._awaitProvider) {
        await window._awaitProvider();
    }

    var eth = null;
    var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    var providers = window._eip6963Providers || [];

    // Auto-connect: mobile inside wallet browser, or desktop with 1 provider / legacy
    if (isMobile && (window.ethereum || (window.phantom && window.phantom.ethereum))) {
        eth = window.ethereum || window.phantom.ethereum;
    } else if (!isMobile && providers.length === 1) {
        eth = providers[0].provider;
    } else if (!isMobile && providers.length === 0 && window.ethereum) {
        eth = window.ethereum;
    } else if (window.showWalletSelector) {
        eth = await window.showWalletSelector();
    } else {
        eth = window.ethereum;
    }

    if (!eth) {
        if (!window.showWalletSelector) {
            showToast('No wallet detected. Install MetaMask, Coinbase Wallet, or Base Wallet.', 'error');
        }
        return;
    }

    try {
        var accounts = await eth.request({ method: 'eth_requestAccounts' });
        if (accounts.length > 0) {
            state.wallet = accounts[0].toLowerCase();
            state.provider = eth;
            state.isAdmin = state.wallet === SUPER_ADMIN;
            try {
                await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID }] });
            } catch (e) {
                if (e.code === 4902) {
                    await eth.request({
                        method: 'wallet_addEthereumChain',
                        params: [{ chainId: BASE_CHAIN_ID, chainName: 'Base', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://mainnet.base.org'], blockExplorerUrls: ['https://basescan.org'] }]
                    });
                }
            }

            // Authenticate with API to get JWT (needed for project registration)
            if (!localStorage.getItem('inclawbate_token')) {
                try {
                    var resp = await fetch('/api/inclawbate/wallet-connect', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ address: state.wallet })
                    });
                    var data = await resp.json();
                    if (resp.ok && data.success && data.token) {
                        localStorage.setItem('inclawbate_token', data.token);
                        if (data.profile) localStorage.setItem('inclawbate_profile', JSON.stringify(data.profile));
                    }
                } catch (e) { /* silent — will retry on deploy */ }
            }

            updateUI();
            updateComingSoonGate();
            loadClawsBalance();
        }
    } catch (e) {
        if (e.code !== 4001) {
            showToast('Wallet connection failed', 'error');
        }
    }
}

function updateComingSoonGate() {
    // Gate removed — Inclawbator is now public
}


// ══════════════════════════════════════
// TOAST
// ══════════════════════════════════════

function showToast(msg, type, duration) {
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
    }, duration || 4000);
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
// ALLOCATION / BURN HELPERS
// ══════════════════════════════════════

async function loadClawsBalance() {
    if (!state.wallet) return;
    var hex = await contractRead(CLAWS, SEL.balanceOf + pad32(state.wallet));
    state.clawsBalance = Number(BigInt(hex)) / 1e18;
    updateAllocationUI();
}

function selectAllocationTier(pct) {
    state.allocationPct = pct;

    // Update UI selection
    document.querySelectorAll('.allocation-tier').forEach(function(el) {
        el.classList.toggle('selected', parseInt(el.dataset.pct) === pct);
    });

    // Load balance if not already loaded and tier > 0
    if (pct > 0 && state.wallet && state.clawsBalance === 0) {
        loadClawsBalance();
    }

    updateAllocationUI();
}

function updateAllocationUI() {
    var balanceEl = document.getElementById('allocationBalance');
    var balanceDisplay = document.getElementById('clawsBalanceDisplay');
    var costDisplay = document.getElementById('allocationCostDisplay');
    var warningEl = document.getElementById('allocationWarning');
    var lockupNote = document.getElementById('allocationLockupNote');

    if (state.allocationPct === 0) {
        if (balanceEl) balanceEl.style.display = 'none';
        if (warningEl) warningEl.classList.remove('visible');
        if (lockupNote) lockupNote.style.display = 'none';
        return;
    }

    if (balanceEl) balanceEl.style.display = 'flex';
    if (balanceDisplay) balanceDisplay.textContent = fmt(state.clawsBalance);
    if (lockupNote) lockupNote.style.display = 'block';

    var cost = ALLOCATION_TIERS[state.allocationPct] || 0;
    {
        if (costDisplay) costDisplay.textContent = 'Cost: ' + fmt(cost) + ' CLAWS';
        var insufficient = state.clawsBalance < cost && state.wallet;
        if (warningEl) warningEl.classList.toggle('visible', insufficient);
    }
}

function buildMerkleRoot(address, amount) {
    // Single-leaf merkle tree using OpenZeppelin StandardMerkleTree format
    // Leaf = keccak256(keccak256(abi.encode(address, uint256)))
    var coder = ethers.AbiCoder.defaultAbiCoder();
    var leafValue = coder.encode(['address', 'uint256'], [address, amount]);
    var innerHash = ethers.keccak256(leafValue);
    var root = ethers.keccak256(innerHash);
    return root;
}

window.selectAllocationTier = selectAllocationTier;

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

    // Add airdrop extension if allocation selected
    if (state.allocationPct > 0) {
        var extensionBps = state.allocationPct * 100; // e.g. 5% = 500 bps
        var tokenAmount = BigInt(DEFAULT_SUPPLY) * BigInt(state.allocationPct) / 100n * BigInt('1000000000000000000'); // tokens in wei
        var merkleRoot = buildMerkleRoot(state.wallet, tokenAmount);

        // extensionData = abi.encode(address admin, bytes32 merkleRoot, uint256 lockupDuration, uint256 vestingDuration)
        var coder = ethers.AbiCoder.defaultAbiCoder();
        var extensionData = coder.encode(
            ['address', 'bytes32', 'uint256', 'uint256'],
            [state.wallet, merkleRoot, 604800, 0] // 7 days lockup, instant vesting
        );

        deploymentConfig.extensionConfigs = [{
            extension: CLANKER_AIRDROP_V2,
            msgValue: 0,
            extensionBps: extensionBps,
            extensionData: extensionData
        }];
    }

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
    document.querySelectorAll('.tool-card-v2[data-tool]').forEach(function(card) {
        card.classList.toggle('active', card.dataset.tool === tool);
    });

    // Show drawer
    var drawer = document.getElementById('toolDrawer');
    if (drawer) {
        drawer.classList.add('open');
    }

    // Show correct content
    var drawers = { launch: 'drawerLaunch', pool: 'drawerPool', incubate: 'drawerIncubate', agent: 'drawerAgent', disperse: 'drawerDisperse' };
    Object.keys(drawers).forEach(function(key) {
        var el = document.getElementById(drawers[key]);
        if (el) el.classList.toggle('active', key === tool);
    });

    // Load apps when agent drawer opens
    if (tool === 'agent') loadAgentApps();

    // Load user's tokens when pool drawer opens
    if (tool === 'pool') loadPoolTokens();

    // Init disperse drawer
    if (tool === 'disperse') initDisperseDrawer();

}

function closeToolDrawer() {
    state.activeDrawer = null;

    document.querySelectorAll('.tool-card-v2[data-tool]').forEach(function(card) {
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
    state.burnTxHash = null;
    var btn = document.getElementById('deployLaunchBtn');

    var burnAmount = ALLOCATION_TIERS[state.allocationPct] || 0;

    try {
        // Step 0: Burn CLAWS if allocation selected
        if (state.allocationPct > 0 && burnAmount > 0) {
            // Check balance
            var balHex = await contractRead(CLAWS, SEL.balanceOf + pad32(state.wallet));
            var bal = Number(BigInt(balHex)) / 1e18;
            if (bal < burnAmount) {
                state.deploying = false;
                return showToast('Insufficient CLAWS balance. Need ' + fmt(burnAmount) + ' CLAWS.', 'error');
            }

            setBtnState(btn, 'Burning ' + fmt(burnAmount) + ' CLAWS...', true);

            // Transfer CLAWS to dead address (burn)
            var burnAmountWei = BigInt(burnAmount) * BigInt('1000000000000000000');
            var burnData = TRANSFER_SEL + pad32(DEAD_ADDRESS) + pad32(toHex(burnAmountWei));
            var burnResult = await sendTxAndWait(state.provider, state.wallet, CLAWS, burnData);
            state.burnTxHash = burnResult.txHash;
        }

        setBtnState(btn, 'Deploying token...', true);

        // Step 1: Deploy token via Clanker v4
        var calldata = encodeClankerDeploy(name, symbol);
        var result = await sendTxAndWait(state.provider, state.wallet, CLANKER_V4, calldata, '0x7A1200');

        var tokenAddress = parseDeployedToken(result.receipt);

        // Fallback: re-fetch receipt via public RPC with retries
        // Mobile wallets often return receipts with empty/incomplete logs
        if (!tokenAddress) {
            for (var retryI = 0; retryI < 5 && !tokenAddress; retryI++) {
                if (retryI > 0) await new Promise(function(r) { setTimeout(r, 3000); });
                var rpcReceipt = await rpcFetch({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [result.txHash] });
                if (rpcReceipt && rpcReceipt.result) {
                    tokenAddress = parseDeployedToken(rpcReceipt.result);
                }
            }
        }

        // Last resort: check tx logs via debug trace or basescan
        if (!tokenAddress) {
            try {
                var txData = await rpcFetch({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionByHash', params: [result.txHash] });
                if (txData && txData.result && txData.result.to && txData.result.to.toLowerCase() === CLANKER_V4.toLowerCase()) {
                    // Tx went to Clanker — check basescan API for token creation
                    var bsResp = await fetch('https://api.basescan.org/api?module=account&action=tokentx&txhash=' + result.txHash + '&page=1&offset=5');
                    var bsData = await bsResp.json();
                    if (bsData.result && bsData.result.length > 0) {
                        for (var bi = 0; bi < bsData.result.length; bi++) {
                            if (bsData.result[bi].from === '0x0000000000000000000000000000000000000000') {
                                tokenAddress = bsData.result[bi].contractAddress;
                                break;
                            }
                        }
                    }
                }
            } catch (e) { /* basescan fallback failed, continue */ }
        }

        if (!tokenAddress) {
            throw new Error('Could not find deployed token address in transaction. Tx hash: ' + result.txHash + ' — check basescan.org and contact support if your token was created.');
        }

        state.deployedToken = tokenAddress;
        state.deployTxHash = result.txHash;

        setBtnState(btn, 'Registering project...', true);

        // Ensure we have a JWT before registering
        if (!localStorage.getItem('inclawbate_token') && state.wallet) {
            try {
                var authResp = await fetch('/api/inclawbate/wallet-connect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address: state.wallet })
                });
                var authData = await authResp.json();
                if (authResp.ok && authData.success && authData.token) {
                    localStorage.setItem('inclawbate_token', authData.token);
                    if (authData.profile) localStorage.setItem('inclawbate_profile', JSON.stringify(authData.profile));
                }
            } catch (e) { /* will fail gracefully below */ }
        }

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
            creator_wallet: state.wallet,
            burn_tx_hash: state.burnTxHash || null,
            allocation_pct: state.allocationPct,
            burn_amount: burnAmount
        });

        if (regResult.error) {
            showToast('Token deployed at ' + tokenAddress.slice(0,8) + '… but registration failed: ' + regResult.error + '. Visit your dashboard to retry.', 'error', 10000);
        } else {
            state.project = regResult.project;
            showToast('Token deployed! Create a stake pool from your dashboard when ready.', 'success');
        }

        state.step = 4;
        state.deploying = false;
        closeToolDrawer();
        updateUI();

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
        description += '\n\n--- TIER ---\n' + (selectedIncTier === 'super' ? 'Super Incubation' : 'Incubation');
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
    state.allocationPct = 0;
    state.burnTxHash = null;

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

    // Reset allocation tier UI
    selectAllocationTier(0);

    // Hide success states
    ['successStep', 'incubatedSuccessStep', 'partnerSuccessStep'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Close drawer
    closeToolDrawer();

    updateUI();
}

// ── Tier Selection for Incubation ──
var selectedIncTier = 'incubation';

function selectTier(tier) {
    selectedIncTier = tier;
    var cards = document.querySelectorAll('#incTierCards .inc-tier-card');
    cards.forEach(function(c) {
        var isSel = c.dataset.tier === tier;
        c.classList.toggle('selected', isSel);
        c.style.borderColor = isSel ? '#6366f1' : '';
        c.style.background = isSel ? 'rgba(99,102,241,0.08)' : '';
    });
}

// Expose to onclick handlers
window.resetForm = resetForm;
window.approveProject = approveProject;
window.rejectProject = rejectProject;
window.openToolDrawer = openToolDrawer;
window.IncApp = { selectTier: selectTier };

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
        // Burn/allocation info
        var burnNote = document.getElementById('burnSuccessNote');
        if (burnNote && state.allocationPct > 0 && state.burnTxHash) {
            burnNote.style.display = 'block';
            var burnText = document.getElementById('burnSuccessText');
            if (burnText) burnText.textContent = 'Burned ' + fmt(ALLOCATION_TIERS[state.allocationPct]) + ' CLAWS for ' + state.allocationPct + '% allocation';
            var burnLink = document.getElementById('burnTxLink');
            if (burnLink) burnLink.href = 'https://basescan.org/tx/' + state.burnTxHash;
        }
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
// LIVE PROJECTS
// ══════════════════════════════════════

var lpState = { projects: [], mcaps: {}, filter: 'all', sort: 'mcap' };

async function loadLiveProjects() {
    try {
        var res = await fetch(API_BASE);
        if (!res.ok) throw new Error('Failed to fetch projects');
        var data = await res.json();
        lpState.projects = (data.projects || data || []).filter(function(p) {
            return p.status === 'active' || p.status === 'launched';
        });
        renderLiveProjects();
        fetchMarketCaps();
    } catch (e) {
        var grid = document.getElementById('liveProjectsGrid');
        if (grid) grid.innerHTML = '<div class="projects-empty">Could not load projects.</div>';
    }
}

async function fetchMarketCaps() {
    var addresses = lpState.projects
        .filter(function(p) { return p.token_address; })
        .map(function(p) { return p.token_address; });
    if (!addresses.length) return;

    // Batch in groups of 25
    for (var i = 0; i < addresses.length; i += 25) {
        var batch = addresses.slice(i, i + 25).join(',');
        try {
            var res = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + batch);
            if (!res.ok) continue;
            var data = await res.json();
            (data.pairs || []).forEach(function(pair) {
                var addr = pair.baseToken && pair.baseToken.address ? pair.baseToken.address.toLowerCase() : null;
                if (addr && pair.marketCap) {
                    // Keep highest mcap pair per token
                    if (!lpState.mcaps[addr] || pair.marketCap > lpState.mcaps[addr]) {
                        lpState.mcaps[addr] = pair.marketCap;
                    }
                }
            });
        } catch (e) { /* DexScreener unavailable, leave mcaps empty */ }
    }
    renderLiveProjects();
}

function getFilteredProjects() {
    var list = lpState.projects.slice();

    // Filter
    if (lpState.filter === 'tokens') {
        list = list.filter(function(p) { return !!p.token_address; });
    } else if (lpState.filter === 'staking') {
        list = list.filter(function(p) { return !!p.staking_address; });
    } else if (lpState.filter === 'agents') {
        list = list.filter(function(p) { return p.agent_enabled === true; });
    }

    // Sort
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

function renderLiveProjects() {
    var grid = document.getElementById('liveProjectsGrid');
    if (!grid) return;

    var list = getFilteredProjects();
    if (!list.length) {
        grid.innerHTML = '<div class="projects-empty">No projects match this filter.</div>';
        return;
    }

    var html = '';
    var tierMap = {
        incubated: { cls: 'lp-tier-incubated', label: 'Incubated' },
        permissionless: { cls: 'lp-tier-permissionless', label: 'Launched' },
        ecosystem: { cls: 'lp-tier-ecosystem', label: 'Ecosystem' },
        partner: { cls: 'lp-tier-partner', label: 'Partner' }
    };
    var colors = ['#6366f1','#ec4899','#f59e0b','#10b981','#8b5cf6','#ef4444','#06b6d4','#84cc16'];

    list.forEach(function(p, i) {
        var tier = tierMap[p.tier] || tierMap.permissionless;
        var mcapVal = p.token_address ? lpState.mcaps[(p.token_address || '').toLowerCase()] : null;
        var mcapStr = p.token_address ? formatMcap(mcapVal) : '';
        var name = p.token_name || p.name || 'Unnamed';
        var symbol = p.token_symbol || '';
        var logoColor = colors[i % colors.length];
        var logoHtml = p.logo_url
            ? '<img class="project-card-logo" src="' + p.logo_url + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
              + '<div class="project-card-logo-placeholder" style="display:none;background:' + logoColor + '">' + name[0].toUpperCase() + '</div>'
            : '<div class="project-card-logo-placeholder" style="background:' + logoColor + '">' + name[0].toUpperCase() + '</div>';

        var badges = '<span class="' + tier.cls + '">' + tier.label + '</span>';
        if (p.staking_address) badges += '<span class="lp-badge-staking">Staking Live</span>';
        if (p.agent_enabled) badges += '<span class="lp-badge-agent">AI Agent</span>';

        var href = '/inclawbator/' + (p.id || '');

        html += '<a class="project-card" href="' + href + '" style="animation-delay:' + (i * 0.05) + 's">'
            + '<div class="project-card-head">'
            + logoHtml
            + '<div><div class="project-card-name">' + name + '</div>'
            + (symbol ? '<div class="project-card-symbol">$' + symbol + '</div>' : '')
            + '</div></div>'
            + '<div class="project-card-badges">' + badges + '</div>'
            + (mcapStr ? '<div class="project-card-mcap">' + mcapStr + '</div>' : '')
            + '</a>';
    });

    grid.innerHTML = html;
}

function initLiveProjectsUI() {
    var filtersEl = document.getElementById('lpFilters');
    if (filtersEl) {
        filtersEl.addEventListener('click', function(e) {
            var btn = e.target.closest('.lp-filter-tab');
            if (!btn) return;
            filtersEl.querySelectorAll('.lp-filter-tab').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            lpState.filter = btn.dataset.filter || 'all';
            renderLiveProjects();
        });
    }
    var sortEl = document.getElementById('lpSort');
    if (sortEl) {
        sortEl.addEventListener('change', function() {
            lpState.sort = sortEl.value;
            renderLiveProjects();
        });
    }
}

// ══════════════════════════════════════
// DISPERSE
// ══════════════════════════════════════

var decimalsCache = {};

async function readTokenDecimals(address) {
    var key = address.toLowerCase();
    if (KNOWN_DECIMALS[key] !== undefined) return KNOWN_DECIMALS[key];
    if (decimalsCache[key] !== undefined) return decimalsCache[key];
    var hex = await contractRead(address, SEL.decimals);
    var d = Number(BigInt(hex));
    decimalsCache[key] = d;
    return d;
}

function getDisperseInputToken() {
    var sel = document.getElementById('disperseInputSelect');
    if (!sel) return null;
    if (sel.value === 'custom') {
        var addr = (document.getElementById('disperseInputAddr') || {}).value || '';
        return addr.trim() || null;
    }
    return sel.value;
}

function getDisperseOutputToken() {
    var sel = document.getElementById('disperseOutputSelect');
    if (!sel) return null;
    if (sel.value === 'custom') {
        var addr = (document.getElementById('disperseOutputAddr') || {}).value || '';
        return addr.trim() || null;
    }
    return sel.value;
}

function isETH(token) { return token === 'ETH'; }

async function updateDisperseInputInfo() {
    var token = getDisperseInputToken();
    var badge = document.getElementById('disperseAmountBadge');
    var balEl = document.getElementById('disperseBalance');
    if (!token) {
        if (badge) badge.textContent = '???';
        if (balEl) balEl.textContent = '';
        return;
    }
    if (isETH(token)) {
        if (badge) badge.textContent = 'ETH';
        if (state.wallet && balEl) {
            var balHex = await rpcFetch({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [state.wallet, 'latest'] });
            var bal = balHex && balHex.result ? Number(BigInt(balHex.result)) / 1e18 : 0;
            balEl.textContent = 'Balance: ' + bal.toFixed(6) + ' ETH';
        }
    } else {
        // ERC-20
        try {
            var info = await readTokenInfo(token);
            if (badge) badge.textContent = info.symbol || shortAddr(token);
            if (state.wallet && balEl) {
                var dec = await readTokenDecimals(token);
                var bHex = await contractRead(token, SEL.balanceOf + pad32(state.wallet));
                var b = Number(BigInt(bHex)) / Math.pow(10, dec);
                balEl.textContent = 'Balance: ' + b.toFixed(6) + ' ' + (info.symbol || '');
            }
        } catch (e) {
            if (badge) badge.textContent = shortAddr(token);
            if (balEl) balEl.textContent = '';
        }
    }
}

function initDisperseDrawer() {
    state.disperseQuote = null;
    state.disperseRunning = false;
    var preview = document.getElementById('dispersePreview');
    if (preview) preview.classList.remove('visible');
    var steps = document.getElementById('disperseSteps');
    if (steps) { steps.classList.remove('visible'); steps.innerHTML = ''; }
    var execBtn = document.getElementById('disperseExecBtn');
    if (execBtn) execBtn.style.display = 'none';
    var quoteBtn = document.getElementById('disperseQuoteBtn');
    if (quoteBtn) { quoteBtn.disabled = false; quoteBtn.textContent = 'Get Quote'; }

    // Ensure at least 2 recipient rows
    var list = document.getElementById('disperseRecipientList');
    if (list && list.children.length === 0) {
        addDisperseRecipientRow();
        addDisperseRecipientRow();
    }

    updateDisperseInputInfo();
}

function addDisperseRecipientRow() {
    var list = document.getElementById('disperseRecipientList');
    if (!list) return;
    var row = document.createElement('div');
    row.className = 'disperse-recipient-row';
    row.innerHTML =
        '<input class="form-input disperse-addr-input" type="text" placeholder="0x... wallet address">' +
        '<input class="disperse-pct-input" type="number" placeholder="%" step="any" min="0" max="100">' +
        '<button type="button" class="disperse-remove-btn">&times;</button>';
    list.appendChild(row);
    row.querySelector('.disperse-remove-btn').addEventListener('click', function() {
        if (list.children.length > 1) row.remove();
        recalcEvenSplit();
    });
    recalcEvenSplit();
}

function recalcEvenSplit() {
    var cb = document.getElementById('disperseEvenSplit');
    if (!cb || !cb.checked) return;
    var list = document.getElementById('disperseRecipientList');
    if (!list) return;
    var rows = list.querySelectorAll('.disperse-recipient-row');
    var pct = Math.floor(10000 / rows.length) / 100;
    var remainder = 100 - pct * rows.length;
    rows.forEach(function(row, i) {
        var inp = row.querySelector('.disperse-pct-input');
        if (inp) {
            inp.value = i === 0 ? (pct + Math.round(remainder * 100) / 100).toFixed(2) : pct.toFixed(2);
            inp.disabled = true;
        }
    });
}

function toggleEvenSplit() {
    var cb = document.getElementById('disperseEvenSplit');
    var list = document.getElementById('disperseRecipientList');
    if (!list) return;
    if (cb && cb.checked) {
        recalcEvenSplit();
    } else {
        list.querySelectorAll('.disperse-pct-input').forEach(function(inp) {
            inp.disabled = false;
        });
    }
}

function getDisperseRecipients() {
    var list = document.getElementById('disperseRecipientList');
    if (!list) return [];
    var result = [];
    list.querySelectorAll('.disperse-recipient-row').forEach(function(row) {
        var addr = (row.querySelector('.disperse-addr-input') || {}).value || '';
        var pct = parseFloat((row.querySelector('.disperse-pct-input') || {}).value) || 0;
        if (addr.trim().match(/^0x[a-fA-F0-9]{40}$/)) {
            result.push({ address: addr.trim(), pct: pct });
        }
    });
    return result;
}

async function handleDisperseQuote() {
    if (state.disperseRunning) return;
    var inputToken = getDisperseInputToken();
    var outputToken = getDisperseOutputToken();
    var amountStr = (document.getElementById('disperseAmount') || {}).value;
    var recipients = getDisperseRecipients();

    if (!inputToken) { showToast('Select an input token', 'error'); return; }
    if (!outputToken) { showToast('Select an output token', 'error'); return; }
    if (!amountStr || parseFloat(amountStr) <= 0) { showToast('Enter an amount', 'error'); return; }
    if (recipients.length === 0) { showToast('Add at least one valid recipient address', 'error'); return; }

    var totalPct = recipients.reduce(function(s, r) { return s + r.pct; }, 0);
    if (Math.abs(totalPct - 100) > 0.1) { showToast('Percentages must add up to 100% (currently ' + totalPct.toFixed(2) + '%)', 'error'); return; }

    var quoteBtn = document.getElementById('disperseQuoteBtn');
    if (quoteBtn) { quoteBtn.disabled = true; quoteBtn.textContent = 'Loading...'; }

    var sameToken = inputToken === outputToken;

    try {
        var inputDec = isETH(inputToken) ? 18 : await readTokenDecimals(inputToken);
        var rawAmount = BigInt(Math.floor(parseFloat(amountStr) * Math.pow(10, inputDec)));

        if (sameToken) {
            // No swap needed
            var outputDec = inputDec;
            var outputSymbol = isETH(outputToken) ? 'ETH' : (await readTokenInfo(outputToken)).symbol || shortAddr(outputToken);
            state.disperseQuote = {
                sameToken: true,
                inputToken: inputToken,
                outputToken: outputToken,
                inputAmount: rawAmount.toString(),
                outputAmount: rawAmount.toString(),
                outputDecimals: outputDec,
                outputSymbol: outputSymbol,
                recipients: recipients,
                tx: null
            };
            renderDispersePreview();
        } else {
            // Need 0x swap
            var sellToken = isETH(inputToken) ? ZEROX_ETH : inputToken;
            var buyToken = isETH(outputToken) ? ZEROX_ETH : outputToken;
            var params = 'sellToken=' + encodeURIComponent(sellToken) +
                '&buyToken=' + encodeURIComponent(buyToken) +
                '&sellAmount=' + rawAmount.toString() +
                '&taker=' + state.wallet +
                '&chainId=8453';
            var resp = await fetch('/api/inclawbate/swap-quote?' + params);
            var data = await resp.json();
            if (!resp.ok || data.error) {
                showToast(data.error || 'Quote failed', 'error');
                if (quoteBtn) { quoteBtn.disabled = false; quoteBtn.textContent = 'Get Quote'; }
                return;
            }

            var outDec = isETH(outputToken) ? 18 : await readTokenDecimals(outputToken);
            var outSymbol = isETH(outputToken) ? 'ETH' : (await readTokenInfo(outputToken)).symbol || shortAddr(outputToken);

            state.disperseQuote = {
                sameToken: false,
                inputToken: inputToken,
                outputToken: outputToken,
                inputAmount: rawAmount.toString(),
                outputAmount: data.buyAmount,
                outputDecimals: outDec,
                outputSymbol: outSymbol,
                recipients: recipients,
                tx: data.transaction,
                allowanceTarget: data.allowanceTarget
            };
            renderDispersePreview();
        }
    } catch (e) {
        showToast('Quote error: ' + e.message, 'error');
    }

    if (quoteBtn) { quoteBtn.disabled = false; quoteBtn.textContent = 'Get Quote'; }
}

function renderDispersePreview() {
    var q = state.disperseQuote;
    if (!q) return;

    var preview = document.getElementById('dispersePreview');
    var rateEl = document.getElementById('disperseRate');
    var breakdownEl = document.getElementById('disperseBreakdown');
    if (!preview || !rateEl || !breakdownEl) return;

    var outHuman = Number(BigInt(q.outputAmount)) / Math.pow(10, q.outputDecimals);

    if (q.sameToken) {
        rateEl.textContent = 'Direct distribution (no swap)';
    } else {
        var inDec = isETH(q.inputToken) ? 18 : (KNOWN_DECIMALS[q.inputToken.toLowerCase()] || 18);
        var inHuman = Number(BigInt(q.inputAmount)) / Math.pow(10, inDec);
        rateEl.textContent = inHuman.toFixed(6) + ' → ' + outHuman.toFixed(6) + ' ' + q.outputSymbol;
    }

    var html = '';
    q.recipients.forEach(function(r) {
        var amt = outHuman * r.pct / 100;
        html += '<div class="disperse-preview-row">' +
            '<span class="disperse-preview-addr">' + shortAddr(r.address) + ' (' + r.pct + '%)</span>' +
            '<span class="disperse-preview-amt">' + amt.toFixed(6) + ' ' + q.outputSymbol + '</span>' +
            '</div>';
    });
    breakdownEl.innerHTML = html;
    preview.classList.add('visible');

    var execBtn = document.getElementById('disperseExecBtn');
    if (execBtn) execBtn.style.display = '';
}

function renderDisperseSteps(stepNames) {
    var container = document.getElementById('disperseSteps');
    if (!container) return;
    var html = '';
    stepNames.forEach(function(name, i) {
        html += '<div class="disperse-step-item" id="disperseStep' + i + '">' +
            '<span class="disperse-step-icon"></span>' +
            '<span>' + name + '</span>' +
            '</div>';
    });
    container.innerHTML = html;
    container.classList.add('visible');
}

function markStep(index, status) {
    var el = document.getElementById('disperseStep' + index);
    if (!el) return;
    el.classList.remove('active', 'done', 'error');
    el.classList.add(status);
    var icon = el.querySelector('.disperse-step-icon');
    if (icon) {
        if (status === 'done') icon.textContent = '\u2713';
        else if (status === 'error') icon.textContent = '\u2717';
        else if (status === 'active') icon.textContent = '';
    }
}

function encodeDisperseToken(token, addresses, amounts) {
    // disperseToken(address,address[],uint256[])
    // selector: 0xc73a2d60
    var data = '0xc73a2d60';
    // token address
    data += pad32(token);
    // offset to addresses array (3 * 32 = 96 = 0x60)
    data += pad32('0x60');
    // offset to amounts array
    var amountsOffset = 96 + 32 + addresses.length * 32; // skip header + count + addresses
    data += pad32('0x' + amountsOffset.toString(16));
    // addresses array
    data += pad32('0x' + addresses.length.toString(16));
    addresses.forEach(function(a) { data += pad32(a); });
    // amounts array
    data += pad32('0x' + amounts.length.toString(16));
    amounts.forEach(function(a) { data += pad32(toHex(a)); });
    return data;
}

function encodeDisperseEther(addresses, amounts) {
    // disperseEther(address[],uint256[])
    // selector: 0xe63d38ed
    var data = '0xe63d38ed';
    // offset to addresses array (2 * 32 = 64 = 0x40)
    data += pad32('0x40');
    // offset to amounts array
    var amountsOffset = 64 + 32 + addresses.length * 32;
    data += pad32('0x' + amountsOffset.toString(16));
    // addresses array
    data += pad32('0x' + addresses.length.toString(16));
    addresses.forEach(function(a) { data += pad32(a); });
    // amounts array
    data += pad32('0x' + amounts.length.toString(16));
    amounts.forEach(function(a) { data += pad32(toHex(a)); });
    return data;
}

async function handleDisperseExecute() {
    if (state.disperseRunning) return;
    var q = state.disperseQuote;
    if (!q) { showToast('Get a quote first', 'error'); return; }

    state.disperseRunning = true;
    var execBtn = document.getElementById('disperseExecBtn');
    if (execBtn) { execBtn.disabled = true; execBtn.textContent = 'Processing...'; }

    var outputIsETH = isETH(q.outputToken);
    var inputIsETH = isETH(q.inputToken);
    var needsSwap = !q.sameToken;

    // Build step names
    var steps = [];
    if (needsSwap && !inputIsETH) steps.push('Approve input token for swap');
    if (needsSwap) steps.push('Swap tokens via 0x');
    if (!outputIsETH) steps.push('Approve output token for Disperse');
    steps.push(outputIsETH ? 'Disperse ETH to recipients' : 'Disperse tokens to recipients');
    renderDisperseSteps(steps);

    var stepIdx = 0;
    try {
        // Step: Approve input token for 0x swap
        if (needsSwap && !inputIsETH) {
            markStep(stepIdx, 'active');
            var target = q.allowanceTarget || (q.tx && q.tx.to);
            var approveData = SEL.approve + pad32(target) + pad32(MAX_UINT256);
            await sendTxAndWait(state.provider, state.wallet, q.inputToken, approveData);
            markStep(stepIdx, 'done');
            stepIdx++;
        }

        // Step: Execute swap
        var outputTotal;
        if (needsSwap) {
            markStep(stepIdx, 'active');
            var swapValue = inputIsETH ? q.tx.value : undefined;
            await sendTxAndWait(state.provider, state.wallet, q.tx.to, q.tx.data, q.tx.gas, swapValue);
            markStep(stepIdx, 'done');
            stepIdx++;
            // Read actual output balance after swap
            if (outputIsETH) {
                outputTotal = BigInt(q.outputAmount);
            } else {
                var balHex = await contractRead(q.outputToken, SEL.balanceOf + pad32(state.wallet));
                outputTotal = BigInt(balHex);
                // Use quoted amount as fallback if balance read seems wrong
                if (outputTotal === 0n) outputTotal = BigInt(q.outputAmount);
            }
        } else {
            outputTotal = BigInt(q.outputAmount);
        }

        // Calculate per-recipient amounts
        var addresses = [];
        var amounts = [];
        var sumPct = q.recipients.reduce(function(s, r) { return s + r.pct; }, 0);
        var sumAmounts = 0n;
        q.recipients.forEach(function(r, i) {
            addresses.push(r.address);
            var amt;
            if (i === q.recipients.length - 1) {
                // Last recipient gets remainder to avoid rounding dust
                amt = outputTotal - sumAmounts;
            } else {
                amt = outputTotal * BigInt(Math.floor(r.pct * 10000)) / BigInt(Math.floor(sumPct * 10000));
                sumAmounts += amt;
            }
            amounts.push(amt);
        });

        // Step: Approve output token for Disperse contract
        if (!outputIsETH) {
            markStep(stepIdx, 'active');
            var disperseApprove = SEL.approve + pad32(DISPERSE_CONTRACT) + pad32(MAX_UINT256);
            await sendTxAndWait(state.provider, state.wallet, q.outputToken, disperseApprove);
            markStep(stepIdx, 'done');
            stepIdx++;
        }

        // Step: Disperse
        markStep(stepIdx, 'active');
        if (outputIsETH) {
            var disperseData = encodeDisperseEther(addresses, amounts);
            var totalValue = amounts.reduce(function(s, a) { return s + a; }, 0n);
            await sendTxAndWait(state.provider, state.wallet, DISPERSE_CONTRACT, disperseData, null, toHex(totalValue));
        } else {
            var disperseData = encodeDisperseToken(q.outputToken, addresses, amounts);
            await sendTxAndWait(state.provider, state.wallet, DISPERSE_CONTRACT, disperseData);
        }
        markStep(stepIdx, 'done');

        showToast('Disperse complete! Tokens sent to ' + addresses.length + ' recipients.', 'success');

    } catch (e) {
        markStep(stepIdx, 'error');
        showToast('Disperse failed: ' + e.message, 'error');
    }

    state.disperseRunning = false;
    if (execBtn) { execBtn.disabled = false; execBtn.textContent = 'Execute Disperse'; }
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
    document.querySelectorAll('.tool-card-v2[data-tool]').forEach(function(card) {
        card.addEventListener('click', function(e) {
            // Don't intercept clicks on the <a> card (Build App)
            if (card.tagName === 'A') return;
            e.preventDefault();
            var tool = card.dataset.tool;
            if (tool === 'marketing') {
                alert('Marketing tools launching soon — join our Discord for early access!');
                return;
            }
            openToolDrawer(tool);
        });
    });

    // Close modal on backdrop click or close button
    var drawerEl = document.getElementById('toolDrawer');
    if (drawerEl) drawerEl.addEventListener('click', function(e) {
        if (e.target === drawerEl) closeToolDrawer();
    });
    var closeBtn = document.getElementById('drawerCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeToolDrawer);

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

    // Disperse bindings
    var disperseQuoteBtn = document.getElementById('disperseQuoteBtn');
    if (disperseQuoteBtn) disperseQuoteBtn.addEventListener('click', handleDisperseQuote);
    var disperseExecBtn = document.getElementById('disperseExecBtn');
    if (disperseExecBtn) disperseExecBtn.addEventListener('click', handleDisperseExecute);
    var disperseAddRow = document.getElementById('disperseAddRow');
    if (disperseAddRow) disperseAddRow.addEventListener('click', addDisperseRecipientRow);
    var disperseEvenSplit = document.getElementById('disperseEvenSplit');
    if (disperseEvenSplit) disperseEvenSplit.addEventListener('change', toggleEvenSplit);
    var disperseInputSelect = document.getElementById('disperseInputSelect');
    if (disperseInputSelect) {
        disperseInputSelect.addEventListener('change', function() {
            var custom = document.getElementById('disperseInputCustom');
            if (custom) custom.classList.toggle('visible', disperseInputSelect.value === 'custom');
            updateDisperseInputInfo();
        });
    }
    var disperseOutputSelect = document.getElementById('disperseOutputSelect');
    if (disperseOutputSelect) {
        disperseOutputSelect.addEventListener('change', function() {
            var custom = document.getElementById('disperseOutputCustom');
            if (custom) custom.classList.toggle('visible', disperseOutputSelect.value === 'custom');
        });
    }
    var disperseInputAddr = document.getElementById('disperseInputAddr');
    if (disperseInputAddr) disperseInputAddr.addEventListener('blur', updateDisperseInputInfo);
    var disperseOutputAddr = document.getElementById('disperseOutputAddr');
    if (disperseOutputAddr) disperseOutputAddr.addEventListener('blur', function() {
        // Resolve custom output token name (visual only)
    });

    // Accordion toggle
    var accordionToggle = document.getElementById('learnAccordionToggle');
    if (accordionToggle) accordionToggle.addEventListener('click', toggleAccordion);

    // Auto-connect if previously connected (wait for late-loading wallets)
    var autoProvider = window.ethereum;
    if (!autoProvider && window._awaitProvider) autoProvider = await window._awaitProvider();
    if (autoProvider) {
        try {
            var accounts = await autoProvider.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                state.wallet = accounts[0].toLowerCase();
                state.provider = autoProvider;
                if (!window.ethereum) window.ethereum = autoProvider;
                state.isAdmin = state.wallet === SUPER_ADMIN;
                updateUI();
                loadClawsBalance();
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

    // Deep-link: ?tool=pool opens the pool factory drawer
    var toolParam = urlParams.get('tool');
    if (toolParam) {
        window.history.replaceState({}, '', window.location.pathname);
        setTimeout(function() { openToolDrawer(toolParam); }, 300);
    }

    // Load admin panel (handled by updateUI when admin)

    // Live Projects
    initLiveProjectsUI();
    loadLiveProjects();
}


if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

})();
