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
var CLANKER_DEV_BUY = '0x1331f0788F9c08C8F38D52c7a1152250A9dE00be';
var ALLOCATION_TIERS = { 0: 0, 1: 1000000, 2: 2000000, 5: 5000000, 10: 10000000 };
var DEFAULT_SUPPLY = 100000000000; // 100B tokens
var SUPER_ADMIN = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';
var MAX_UINT256 = '0x' + 'f'.repeat(64);

// Decode Solana transaction data — handles base64, base58, and byte arrays
function decodeTxData(data) {
    if (!data) throw new Error('No transaction data');
    // Already a Uint8Array or array of numbers
    if (data instanceof Uint8Array) return data;
    if (Array.isArray(data)) return new Uint8Array(data);
    // Object — unwrap known shapes
    if (typeof data === 'object' && data !== null) {
        // {transaction: "base58...", blockhash: "..."} from Bags API
        if (typeof data.transaction === 'string') return decodeTxData(data.transaction);
        if (typeof data.serializedTransaction === 'string') return decodeTxData(data.serializedTransaction);
        if (data.data && Array.isArray(data.data)) return new Uint8Array(data.data);
        if (data.type === 'Buffer' && data.data) return new Uint8Array(data.data);
        var keys = Object.keys(data);
        if (keys.length > 0 && !isNaN(keys[0])) {
            var arr = new Uint8Array(keys.length);
            for (var oi = 0; oi < keys.length; oi++) arr[oi] = data[keys[oi]];
            return arr;
        }
        throw new Error('Unknown tx object format. Keys: ' + keys.slice(0, 5).join(','));
    }
    if (typeof data !== 'string') throw new Error('Unknown tx format: ' + typeof data);
    // Only try base64 if string contains +, /, or = (characters base58 never uses)
    if (/[+\/=]/.test(data)) {
        try { return Uint8Array.from(atob(data), function(c) { return c.charCodeAt(0); }); } catch(e) {}
    }
    // Base58 decode (Solana standard — all Bags API transactions use this)
    var BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    var result = [0];
    for (var i = 0; i < data.length; i++) {
        var idx = BASE58.indexOf(data[i]);
        if (idx < 0) throw new Error('Invalid base58 character: ' + data[i]);
        var carry = idx;
        for (var j = 0; j < result.length; j++) {
            carry += result[j] * 58;
            result[j] = carry & 0xff;
            carry >>= 8;
        }
        while (carry > 0) { result.push(carry & 0xff); carry >>= 8; }
    }
    // Handle leading '1's (zero bytes in base58)
    for (var k = 0; k < data.length && data[k] === '1'; k++) result.push(0);
    return new Uint8Array(result.reverse());
}

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
    stake:            '0xa694fc3a', // stake(uint256)
};

// ══════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════

function pad32(hex) { return hex.replace('0x', '').padStart(64, '0'); }
function toHex(n) { return '0x' + BigInt(n).toString(16); }
function safeHex(v) { return (!v || v === '0x') ? '0x0' : v; }
function fromWei(hex) {
    if (!hex || hex === '0x' || hex === '0x0') return 0;
    try { return Number(BigInt(hex)) / 1e18; } catch (e) { return 0; }
}
function shortAddr(a) { return a.slice(0, 6) + '...' + a.slice(-4); }
function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); }

var BASE_RPCS = [
    'https://mainnet.base.org',
    'https://base.drpc.org',
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
    return safeHex(json && json.result);
}

async function sendTxAndWait(provider, from, to, data, gasLimit, value) {
    try {
        await Promise.race([
            provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID }] }),
            new Promise(function(_, reject) {
                setTimeout(function() { reject(new Error('switch_timeout')); }, 10000);
            })
        ]);
    } catch (switchErr) {
        if (switchErr.code === 4902) {
            await provider.request({
                method: 'wallet_addEthereumChain',
                params: [{ chainId: BASE_CHAIN_ID, chainName: 'Base', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://mainnet.base.org'], blockExplorerUrls: ['https://basescan.org'] }]
            });
        } else if (switchErr.message === 'switch_timeout') {
            throw new Error('Wallet not responding. Please disconnect and reconnect.');
        }
    }
    var txParams = { from: from, to: to, data: data };
    if (gasLimit) txParams.gas = gasLimit;
    if (value) txParams.value = value;
    var txHash;
    try {
        txHash = await provider.request({
            method: 'eth_sendTransaction',
            params: [txParams]
        });
    } catch (txErr) {
        var errMsg = (txErr.message || '').toLowerCase();
        if (errMsg.indexOf('session') !== -1 || errMsg.indexOf('disconnect') !== -1 ||
            errMsg.indexOf('no matching key') !== -1 || errMsg.indexOf('expired') !== -1) {
            throw new Error('Wallet session expired. Please disconnect and reconnect.');
        }
        throw txErr;
    }
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
    // Chain
    chain: 'base',        // 'base' | 'solana' | 'cardano'
    solanaWallet: null,    // Solana pubkey string
    cardanoWallet: null,   // Cardano bech32 address string
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

    // Mobile inside wallet browser: auto-connect the injected provider directly.
    // Showing the selector here shows deep links/install links — wrong when already inside the wallet.
    if (isMobile && (window.ethereum || (window.phantom && window.phantom.ethereum))) {
        eth = window.ethereum || window.phantom.ethereum;
    } else if (!isMobile && providers.length === 1) {
        eth = providers[0].provider;
    } else if (!isMobile && providers.length > 1 && window.showWalletSelector) {
        var selected = await window.showWalletSelector();
        if (selected && selected.provider) eth = selected.provider;
        else if (selected && selected.address) {
            state.wallet = selected.address.toLowerCase();
            state.isAdmin = state.wallet === SUPER_ADMIN;
            return;
        }
    } else if (!isMobile && providers.length === 0 && window.ethereum) {
        eth = window.ethereum;
    } else if (window.showWalletSelector) {
        var selected2 = await window.showWalletSelector();
        if (selected2 && selected2.provider) eth = selected2.provider;
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
            // Sync with nav component
            try {
                localStorage.setItem('connectedWallet', state.wallet);
                localStorage.setItem('walletAddress', state.wallet);
            } catch(e) {}
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
    var lockupNote = document.getElementById('allocationLockupNote');
    if (lockupNote) lockupNote.style.display = state.allocationPct > 0 ? 'block' : 'none';
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

// Advanced config state
state.feeType = 'dynamic';
state.feeTier = 3;
state.sniperTaxDuration = 15;
state.rewardToken = 'weth';
state.rewardPct = 80;
state.airdropLockupDays = 7;
state.airdropVestingDays = 0;

function toggleAdvanced(bodyId) {
    var body = document.getElementById(bodyId);
    if (!body) return;
    var section = body.closest('.advanced-section');
    var isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    if (section) section.classList.toggle('open', !isOpen);
}
window.toggleAdvanced = toggleAdvanced;

function selectFeeType(type) {
    state.feeType = type;
    document.querySelectorAll('[data-fee]').forEach(function(el) {
        el.classList.toggle('selected', el.dataset.fee === type);
    });
    var tierGroup = document.getElementById('feeTierGroup');
    if (tierGroup) tierGroup.style.display = type === 'static' ? 'block' : 'none';
}
window.selectFeeType = selectFeeType;

function selectFeeTier(tier) {
    state.feeTier = tier;
    document.querySelectorAll('[data-feepct]').forEach(function(el) {
        el.classList.toggle('selected', parseInt(el.dataset.feepct) === tier);
    });
}
window.selectFeeTier = selectFeeTier;

function selectRewardToken(token) {
    state.rewardToken = token;
    document.querySelectorAll('[data-rwdtoken]').forEach(function(el) {
        el.classList.toggle('selected', el.dataset.rwdtoken === token);
    });
}
window.selectRewardToken = selectRewardToken;

function addAirdropEntry() {
    var container = document.getElementById('airdropEntries');
    if (!container) return;
    var entry = document.createElement('div');
    entry.className = 'airdrop-entry';
    entry.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:6px';
    entry.innerHTML = '<input class="form-input airdrop-addr" type="text" placeholder="0x... wallet address" style="font-family:var(--font-mono);font-size:0.82rem;flex:3">' +
        '<input class="form-input airdrop-pct" type="number" min="0" max="100" placeholder="%" style="font-family:var(--font-mono);width:70px;flex:0 0 70px">' +
        '<button type="button" onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:1.1rem;padding:4px">&times;</button>';
    container.appendChild(entry);
}
window.addAirdropEntry = addAirdropEntry;

function getAirdropEntries() {
    var entries = [];
    var container = document.getElementById('airdropEntries');
    if (!container) return entries;
    container.querySelectorAll('.airdrop-entry').forEach(function(row) {
        var addr = row.querySelector('.airdrop-addr');
        var pct = row.querySelector('.airdrop-pct');
        if (addr && addr.value && pct && pct.value) {
            entries.push({ address: addr.value.trim(), pct: parseFloat(pct.value) });
        }
    });
    return entries;
}

function addRewardRecipient() {
    var container = document.getElementById('rewardRecipientEntries');
    if (!container) return;
    var entry = document.createElement('div');
    entry.className = 'reward-entry';
    entry.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:6px';
    entry.innerHTML = '<input class="form-input reward-addr" type="text" placeholder="0x... wallet address" style="font-family:var(--font-mono);font-size:0.82rem;flex:3">' +
        '<input class="form-input reward-pct" type="number" min="0" max="100" placeholder="%" style="font-family:var(--font-mono);width:70px;flex:0 0 70px">' +
        '<button type="button" onclick="removeRewardRecipient(this)" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:1.1rem;padding:4px;flex:0 0 16px">&times;</button>';
    container.appendChild(entry);
    updateRewardTotal();
}
window.addRewardRecipient = addRewardRecipient;

function removeRewardRecipient(btn) {
    btn.parentElement.remove();
    updateRewardTotal();
}
window.removeRewardRecipient = removeRewardRecipient;

function updateRewardTotal() {
    var total = 0;
    document.querySelectorAll('#rewardRecipientEntries .reward-pct').forEach(function(el) {
        total += parseInt(el.value) || 0;
    });
    var label = document.getElementById('rewardTotalLabel');
    if (label) {
        label.textContent = 'Total: ' + total + '%';
        label.style.color = total === 100 ? 'var(--text-dim)' : '#ef4444';
    }
}

function getRewardRecipients() {
    var recipients = [];
    document.querySelectorAll('#rewardRecipientEntries .reward-entry').forEach(function(row) {
        var addr = row.querySelector('.reward-addr');
        var pct = row.querySelector('.reward-pct');
        var address = addr ? addr.value.trim() : '';
        var percent = pct ? (parseInt(pct.value) || 0) : 0;
        if (percent > 0) {
            recipients.push({ address: address, bps: percent * 100 });
        }
    });
    return recipients;
}

// Listen for % changes to update total
document.addEventListener('input', function(e) {
    if (e.target && e.target.classList.contains('reward-pct')) updateRewardTotal();
});

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

function encodeClankerDeploy(name, symbol, devBuyWei, imageUrl) {
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

    // Read reward recipients from dynamic list
    var recipientList = getRewardRecipients();
    // Fill in empty addresses with connected wallet
    recipientList.forEach(function(r) { if (!r.address) r.address = state.wallet; });
    // Fallback: if no recipients configured, use default 80/20
    if (recipientList.length === 0) {
        recipientList = [
            { address: state.wallet, bps: 8000 },
            { address: INCLAWBATE_TREASURY, bps: 2000 }
        ];
    }
    var rewardAdminAddr = recipientList[0].address;

    // Build sniper MEV data with configurable duration
    var sniperDuration = parseInt((document.getElementById('sniperTaxDuration') || {}).value) || 15;
    var coder = ethers.AbiCoder.defaultAbiCoder();
    var sniperMevData = coder.encode(
        ['uint256', 'uint256', 'uint256'],
        [666777, 41673, sniperDuration]
    );

    var deploymentConfig = {
        tokenConfig: {
            tokenAdmin: rewardAdminAddr,
            name: name,
            symbol: symbol,
            salt: salt,
            image: imageUrl || '',
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
            rewardAdmins: recipientList.map(function(r) { return r.address; }),
            rewardRecipients: recipientList.map(function(r) { return r.address; }),
            rewardBps: recipientList.map(function(r) { return r.bps; }),
            tickLower: [-230400],
            tickUpper: [-120000],
            positionBps: [10000],
            lockerData: '0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001'
        },
        mevModuleConfig: {
            mevModule: CLANKER_SNIPER_AUCTION,
            mevModuleData: sniperMevData
        },
        extensionConfigs: []
    };

    // Add airdrop extension if allocation selected
    if (state.allocationPct > 0) {
        var extensionBps = state.allocationPct * 100; // e.g. 5% = 500 bps
        var lockupDays = parseInt((document.getElementById('airdropLockup') || {}).value) || 7;
        var vestingDays = parseInt((document.getElementById('airdropVesting') || {}).value) || 0;
        var lockupSeconds = lockupDays * 86400;
        var vestingSeconds = vestingDays * 86400;

        // Check for custom airdrop entries
        var airdropEntries = getAirdropEntries();
        var tokenAmount, merkleRoot;

        if (airdropEntries.length > 0) {
            // Multi-recipient airdrop — build merkle tree from entries
            // For now, use single-leaf with creator wallet for the full allocation
            // (multi-leaf merkle would require StandardMerkleTree library)
            tokenAmount = BigInt(DEFAULT_SUPPLY) * BigInt(state.allocationPct) / 100n * BigInt('1000000000000000000');
            merkleRoot = buildMerkleRoot(state.wallet, tokenAmount);
        } else {
            tokenAmount = BigInt(DEFAULT_SUPPLY) * BigInt(state.allocationPct) / 100n * BigInt('1000000000000000000');
            merkleRoot = buildMerkleRoot(state.wallet, tokenAmount);
        }

        var extensionData = coder.encode(
            ['address', 'bytes32', 'uint256', 'uint256'],
            [rewardAdminAddr, merkleRoot, lockupSeconds, vestingSeconds]
        );

        deploymentConfig.extensionConfigs = [{
            extension: CLANKER_AIRDROP_V2,
            msgValue: 0,
            extensionBps: extensionBps,
            extensionData: extensionData
        }];
    }

    // Dev buy extension — sends ETH to buy tokens at launch
    if (devBuyWei && BigInt(devBuyWei) > 0n) {
        deploymentConfig.extensionConfigs.push({
            extension: CLANKER_DEV_BUY,
            msgValue: BigInt(devBuyWei),
            extensionBps: 0,
            extensionData: '0x'
        });
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

    // Connect wallet if not connected (skip in embed mode — show form first)
    var isEmbed = new URLSearchParams(window.location.search).get('embed') === '1';
    if (!state.wallet && !isEmbed) {
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
        noTokens.querySelector('p').textContent = 'Connect your wallet to see your tokens, or enter any token address below.';
        form.classList.remove('hidden');
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
            return (p.token_address || p.solana_token_mint) && p.status === 'active' && !p.staking_address;
        });
        poolTokensCache = projects;
        showPoolTokenForm(projects, loading, noTokens, form, select);
    } catch (e) {
        loading.textContent = 'Failed to load tokens.';
    }
}

function showPoolTokenForm(projects, loading, noTokens, form, select) {
    loading.classList.add('hidden');
    noTokens.classList.add('hidden');
    form.classList.remove('hidden');

    // Populate select — always show with custom option
    select.innerHTML = '<option value="">Choose a token...</option>';
    projects.forEach(function(p) {
        var opt = document.createElement('option');
        var chain = (p.chain === 'solana') ? 'solana' : (p.chain === 'cardano') ? 'cardano' : 'base';
        var chainLabel = chain === 'solana' ? ' [Solana]' : chain === 'cardano' ? ' [Cardano]' : ' [Base]';
        opt.value = p.token_address || p.solana_token_mint || '';
        opt.textContent = (p.token_name || 'Unknown') + ' ($' + (p.token_symbol || '???') + ')' + chainLabel;
        opt.dataset.name = p.token_name || '';
        opt.dataset.symbol = p.token_symbol || '';
        opt.dataset.chain = chain;
        if (chain === 'solana' || chain === 'cardano') {
            opt.disabled = true;
            opt.textContent += ' — Coming Soon';
        }
        select.appendChild(opt);
    });
    // Always add custom option at end
    var customOpt = select.querySelector('option[value="custom"]');
    if (!customOpt) {
        customOpt = document.createElement('option');
        customOpt.value = 'custom';
        customOpt.textContent = 'Enter token address manually';
        select.appendChild(customOpt);
    }

    if (projects.length === 0) {
        noTokens.classList.remove('hidden');
    }

    // Wire select change to update preview + custom field
    select.onchange = function() {
        var preview = document.getElementById('partnerTokenPreview');
        var customDiv = document.getElementById('poolCustomAddr');
        var selected = select.options[select.selectedIndex];
        if (select.value === 'custom') {
            if (customDiv) customDiv.style.display = '';
            preview.classList.add('hidden');
        } else if (select.value && selected.dataset.name) {
            if (customDiv) customDiv.style.display = 'none';
            var chain = selected.dataset.chain || 'base';
            var chainBadge = chain === 'solana' ? ' (Solana)' : ' (Base)';
            document.getElementById('partnerTokenName').textContent = selected.dataset.name;
            document.getElementById('partnerTokenSymbol').textContent = '$' + selected.dataset.symbol + chainBadge;
            document.getElementById('partnerTokenIcon').textContent = (selected.dataset.symbol || '?')[0];
            preview.classList.remove('hidden');
        } else {
            if (customDiv) customDiv.style.display = 'none';
            preview.classList.add('hidden');
        }
    };

    // Wire auto-stake checkbox
    var autoStakeCb = document.getElementById('poolAutoStake');
    var autoStakeDiv = document.getElementById('poolAutoStakeAmount');
    if (autoStakeCb && autoStakeDiv) {
        autoStakeCb.onchange = function() {
            autoStakeDiv.style.display = autoStakeCb.checked ? '' : 'none';
        };
    }
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

    // Dispatch to Solana flow if chain is solana
    if (state.chain === 'solana') return handleSolanaLaunch();
    // Dispatch to Cardano flow if chain is cardano
    if (state.chain === 'cardano') return handleCardanoLaunch();

    var name = document.getElementById('tokenName').value.trim();
    var symbol = document.getElementById('tokenSymbol').value.trim().toUpperCase();
    var desc = document.getElementById('launchDesc').value.trim();
    var website = document.getElementById('launchWebsite').value.trim();
    var imageUrl = (document.getElementById('launchImageUrl') || {}).value || '';
    var xHandle = (document.getElementById('launchXHandle') || {}).value || '';
    var telegram = (document.getElementById('launchTelegram') || {}).value || '';

    if (!name) return showToast('Token name is required', 'error');
    if (!symbol || symbol.length > 10) return showToast('Symbol required (max 10 chars)', 'error');

    if (!state.wallet) {
        await connectWallet();
        if (!state.wallet) return;
    }

    state.deploying = true;
    state.burnTxHash = null;
    var btn = document.getElementById('deployLaunchBtn');

    // Dev buy amount
    var devBuyInput = document.getElementById('devBuyAmount');
    var devBuyEth = devBuyInput ? parseFloat(devBuyInput.value) || 0 : 0;
    var devBuyWei = devBuyEth > 0 ? BigInt(Math.round(devBuyEth * 1e18)) : 0n;

    try {

        setBtnState(btn, 'Deploying token...', true);

        // Step 1: Deploy token via Clanker v4
        var calldata = encodeClankerDeploy(name, symbol, devBuyWei, imageUrl);
        var txValue = devBuyWei > 0n ? '0x' + devBuyWei.toString(16) : undefined;
        var result = await sendTxAndWait(state.provider, state.wallet, CLANKER_V4, calldata, '0x7A1200', txValue);

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
            logo_url: imageUrl || null,
            x_handle: xHandle || null,
            telegram_url: telegram || null,
            fee_split_bps: 2000,
            tier: 'permissionless',
            creator_wallet: state.wallet,
            allocation_pct: state.allocationPct,
            burn_amount: 0
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
        var successEl = document.getElementById('successStep');
        if (successEl) successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

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

    // Handle custom token address
    if (tokenAddress === 'custom') {
        var customInput = document.getElementById('poolCustomToken');
        tokenAddress = customInput ? customInput.value.trim() : '';
        tokenName = 'Custom Token';
        tokenSymbol = '';
    }

    if (!tokenAddress || tokenAddress.length !== 42) return showToast('Enter a valid token address', 'error');

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

        // ── Post-deploy: Fund with CLAWS rewards ──
        var rewardInput = document.getElementById('poolRewardAmount');
        var rewardAmount = rewardInput ? parseFloat(rewardInput.value) : 0;
        if (rewardAmount > 0) {
            var rewardWei = BigInt(Math.round(rewardAmount * 1e18));
            var rewardHex = '0x' + rewardWei.toString(16);
            var duration30d = '0x' + (2592000).toString(16); // 30 days

            setBtnState(btn, 'Approving CLAWS for rewards...', true);
            var approveData = SEL.approve + pad32(stakingPool) + pad32(MAX_UINT256);
            await sendTxAndWait(state.provider, state.wallet, CLAWS, approveData);

            setBtnState(btn, 'Depositing CLAWS rewards...', true);
            var depositData = SEL.depositRewards + pad32(rewardHex) + pad32(duration30d);
            await sendTxAndWait(state.provider, state.wallet, stakingPool, depositData);
        }

        // ── Post-deploy: Auto-stake user's tokens ──
        var autoStakeCb = document.getElementById('poolAutoStake');
        var stakeInput = document.getElementById('poolStakeAmount');
        var stakeAmount = (autoStakeCb && autoStakeCb.checked && stakeInput) ? parseFloat(stakeInput.value) : 0;
        if (stakeAmount > 0) {
            var stakeWei = BigInt(Math.round(stakeAmount * 1e18));
            var stakeHex = '0x' + stakeWei.toString(16);

            setBtnState(btn, 'Approving tokens for staking...', true);
            var stakeApprove = SEL.approve + pad32(stakingPool) + pad32(MAX_UINT256);
            await sendTxAndWait(state.provider, state.wallet, tokenAddress, stakeApprove);

            setBtnState(btn, 'Staking your tokens...', true);
            var stakeData = SEL.stake + pad32(stakeHex);
            await sendTxAndWait(state.provider, state.wallet, stakingPool, stakeData);
        }

        state.step = 7; // partner success
        state.deploying = false;
        poolTokensCache = null;
        closeToolDrawer();
        updateUI();
        showToast('Staking pool deployed!' + (rewardAmount > 0 ? ' CLAWS rewards funded.' : '') + (stakeAmount > 0 ? ' Tokens staked.' : ''), 'success');

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
    state.chain = 'base';
    state.solanaWallet = null;
    state.cardanoWallet = null;

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

    // Reset dev buy input
    var devBuyInput = document.getElementById('devBuyAmount');
    if (devBuyInput) devBuyInput.value = '';

    // Reset allocation tier UI
    selectAllocationTier(0);

    // Reset chain selector
    selectChain('base');

    // Hide success states
    ['successStep', 'incubatedSuccessStep', 'partnerSuccessStep'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Close drawer
    closeToolDrawer();

    updateUI();
}

// ══════════════════════════════════════
// CHAIN SELECTOR
// ══════════════════════════════════════

function selectChain(chain) {
    state.chain = chain;
    var btns = document.querySelectorAll('.chain-btn');
    btns.forEach(function(b) { b.classList.toggle('selected', b.dataset.chain === chain); });

    var devBuyUnit = document.getElementById('devBuyUnit');
    var devBuyHint = document.getElementById('devBuyHint');
    var feeBase = document.getElementById('feeStructureBase');
    var feeSolana = document.getElementById('feeStructureSolana');
    var feeCardano = document.getElementById('feeStructureCardano');

    if (chain === 'solana') {
        if (devBuyUnit) devBuyUnit.textContent = '(SOL)';
        if (devBuyHint) devBuyHint.textContent = 'Buy your own token at launch with SOL. Leave blank to skip.';
        if (feeBase) feeBase.style.display = 'none';
        if (feeSolana) feeSolana.style.display = 'inline';
        if (feeCardano) feeCardano.style.display = 'none';
    } else if (chain === 'cardano') {
        if (devBuyUnit) devBuyUnit.textContent = '(ADA)';
        if (devBuyHint) devBuyHint.textContent = 'Add initial liquidity with ADA. Minimum 2 ADA. Leave blank to skip.';
        if (feeBase) feeBase.style.display = 'none';
        if (feeSolana) feeSolana.style.display = 'none';
        if (feeCardano) feeCardano.style.display = 'inline';
    } else {
        if (devBuyUnit) devBuyUnit.textContent = '(ETH)';
        if (devBuyHint) devBuyHint.textContent = 'Buy your own token at launch with ETH. Leave blank to skip.';
        if (feeBase) feeBase.style.display = 'inline';
        if (feeSolana) feeSolana.style.display = 'none';
        if (feeCardano) feeCardano.style.display = 'none';
    }

    // Show/hide Base-only advanced sections
    document.querySelectorAll('.advanced-section[data-chain="base"]').forEach(function(el) {
        el.style.display = chain === 'base' ? 'block' : 'none';
    });
}
window.selectChain = selectChain;

// ══════════════════════════════════════
// SOLANA LAUNCH FLOW (via Bags API)
// ══════════════════════════════════════

async function handleSolanaLaunch() {
    if (state.deploying) return;

    var name = document.getElementById('tokenName').value.trim();
    var symbol = document.getElementById('tokenSymbol').value.trim().toUpperCase();
    var desc = document.getElementById('launchDesc').value.trim();
    var website = document.getElementById('launchWebsite').value.trim();

    if (!name) return showToast('Token name is required', 'error');
    if (!symbol || symbol.length > 10) return showToast('Symbol required (max 10 chars)', 'error');

    var btn = document.getElementById('deployLaunchBtn');

    try {
        // Step 1: Connect Solana wallet (Phantom)
        setBtnState(btn, 'Connecting Solana wallet...', true);
        state.deploying = true;
        state.burnTxHash = null;

        var solPubkey = await window.connectSolanaWallet();
        if (!solPubkey) {
            state.deploying = false;
            setBtnState(btn, 'Deploy Token', false);
            return;
        }
        state.solanaWallet = solPubkey;

        // Step 2: Ensure EVM wallet connected (for JWT auth)
        if (!state.wallet) {
            setBtnState(btn, 'Connect EVM wallet...', true);
            await connectWallet();
            if (!state.wallet) {
                state.deploying = false;
                setBtnState(btn, 'Deploy Token', false);
                return;
            }
        }

        // Ensure we have a JWT before calling backend
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
            } catch (e) { /* will fail gracefully */ }
        }

        // Step 4: Create token info on Bags
        setBtnState(btn, 'Creating token on Solana...', true);
        var createResult = await apiPost({
            action: 'bags-create-token',
            name: name,
            symbol: symbol,
            description: desc,
            image_url: (document.getElementById('launchImageUrl') || {}).value || 'https://www.inclawbate.app/inclawbate/assets/inclawbate-logo.png'
        });
        if (createResult.error) throw new Error('Bags create failed: ' + createResult.error);

        var bagsData = createResult.response || createResult;
        var tokenMint = bagsData.tokenMint || createResult.tokenMint;
        var metadataUrl = bagsData.tokenMetadata || createResult.metadataUrl || '';
        if (!tokenMint) throw new Error('No tokenMint returned from Bags. Response: ' + JSON.stringify(createResult));

        // Step 5: Configure fee sharing (80/20 split)
        setBtnState(btn, 'Configuring fee split...', true);
        var feeResult = await apiPost({
            action: 'bags-fee-config',
            token_mint: tokenMint,
            creator_solana_wallet: solPubkey
        });
        if (feeResult.error) throw new Error('Fee config failed: ' + feeResult.error);

        var feeData = feeResult.response || feeResult;
        var configKey = feeData.configKey || feeData.meteoraConfigKey || feeResult.configKey || null;

        // Step 6: Sign fee config transactions if provided
        var feeTxs = feeData.transactions || feeResult.transactions || [];
        console.log('[Solana] Fee config response:', JSON.stringify(feeData).slice(0, 500));
        if (feeTxs.length > 0) {
            setBtnState(btn, 'Signing fee config txs...', true);
            for (var fi = 0; fi < feeTxs.length; fi++) {
                console.log('[Solana] Fee tx ' + fi + ':', typeof feeTxs[fi], typeof feeTxs[fi] === 'object' ? Object.keys(feeTxs[fi]) : '');
                var txBytes = decodeTxData(feeTxs[fi]);
                console.log('[Solana] Fee tx ' + fi + ' decoded, ' + txBytes.length + ' bytes');
                await window.signAndSendSolanaTransaction(txBytes);
            }
        }

        // Step 7: Create launch transaction
        var devBuyInput = document.getElementById('devBuyAmount');
        var devBuySol = devBuyInput ? parseFloat(devBuyInput.value) || 0 : 0;
        var devBuyLamports = devBuySol > 0 ? Math.round(devBuySol * 1e9) : 0;

        setBtnState(btn, 'Creating launch transaction...', true);
        var launchResult = await apiPost({
            action: 'bags-create-launch-tx',
            token_mint: tokenMint,
            creator_solana_wallet: solPubkey,
            initial_buy_lamports: devBuyLamports,
            config_key: configKey,
            metadata_url: metadataUrl
        });
        if (launchResult.error) throw new Error('Launch tx failed: ' + launchResult.error);

        // Step 8: Sign + send launch transaction
        setBtnState(btn, 'Sign in wallet to launch...', true);
        var launchData = launchResult.response || launchResult;
        // Bags may return raw bytes (numeric keys), a wrapped object, or a string
        var rawLaunchTx = launchData.transaction || launchData.serializedTransaction
            || (launchData.transactions && launchData.transactions[0])
            || launchResult.transaction || launchData;
        var launchTxBytes = decodeTxData(rawLaunchTx);
        var sendResult = await window.signAndSendSolanaTransaction(launchTxBytes);
        var solanaTxSig = sendResult.signature || sendResult;

        state.deployedToken = tokenMint;
        state.deployTxHash = typeof solanaTxSig === 'string' ? solanaTxSig : '';

        // Step 9: Register with backend
        setBtnState(btn, 'Registering project...', true);
        var solImageUrl = (document.getElementById('launchImageUrl') || {}).value || '';
        var solXHandle = (document.getElementById('launchXHandle') || {}).value || '';
        var solTelegram = (document.getElementById('launchTelegram') || {}).value || '';
        var regResult = await apiPost({
            action: 'register',
            token_address: tokenMint,
            token_name: name,
            token_symbol: symbol,
            deploy_tx_hash: state.deployTxHash,
            description: desc,
            website_url: website,
            logo_url: solImageUrl || null,
            x_handle: solXHandle || null,
            telegram_url: solTelegram || null,
            fee_split_bps: 2000,
            tier: 'permissionless',
            creator_wallet: state.wallet,
            allocation_pct: state.allocationPct,
            burn_amount: 0,
            chain: 'solana',
            solana_wallet: solPubkey,
            solana_token_mint: tokenMint
        });

        if (regResult.error) {
            showToast('Token launched on Solana but registration failed: ' + regResult.error, 'error', 10000);
        } else {
            state.project = regResult.project;
            showToast('Token launched on Solana!', 'success');
        }

        state.step = 4;
        state.deploying = false;
        closeToolDrawer();
        updateUI();
        var successEl = document.getElementById('successStep');
        if (successEl) successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

    } catch (e) {
        state.deploying = false;
        setBtnState(btn, 'Deploy Token', false);
        if (e.code === 4001 || (e.message && e.message.includes('rejected'))) {
            showToast('Transaction rejected by user', 'error');
        } else {
            showToast('Solana launch failed: ' + (e.message || 'Unknown error'), 'error');
        }
    }
}

// ══════════════════════════════════════
// CARDANO LAUNCH FLOW (via Mesh SDK + Minswap)
// ══════════════════════════════════════

async function handleCardanoLaunch() {
    if (state.deploying) return;

    var name = document.getElementById('tokenName').value.trim();
    var symbol = document.getElementById('tokenSymbol').value.trim().toUpperCase();
    var desc = document.getElementById('launchDesc').value.trim();
    var website = document.getElementById('launchWebsite').value.trim();

    if (!name) return showToast('Token name is required', 'error');
    if (!symbol || symbol.length > 10) return showToast('Symbol required (max 10 chars)', 'error');

    var btn = document.getElementById('deployLaunchBtn');

    try {
        // Step 1: Connect Cardano wallet (CIP-30)
        setBtnState(btn, 'Connecting Cardano wallet...', true);
        state.deploying = true;
        state.burnTxHash = null;

        var cardanoAddr = await window.connectCardanoWallet();
        if (!cardanoAddr) {
            state.deploying = false;
            setBtnState(btn, 'Deploy Token', false);
            return;
        }
        state.cardanoWallet = cardanoAddr;

        // Step 2: Ensure EVM wallet connected (for JWT auth)
        if (!state.wallet) {
            setBtnState(btn, 'Connect EVM wallet for auth...', true);
            await connectWallet();
            if (!state.wallet) {
                state.deploying = false;
                setBtnState(btn, 'Deploy Token', false);
                return;
            }
        }

        // Ensure JWT
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
            } catch (e) { /* will fail gracefully */ }
        }

        // Step 3: Mint token on Cardano (server builds the tx)
        setBtnState(btn, 'Creating token on Cardano...', true);
        var imageUrl = (document.getElementById('launchImageUrl') || {}).value || '';
        var mintResult = await apiPost({
            action: 'cardano-mint-token',
            name: name,
            symbol: symbol,
            description: desc,
            image_url: imageUrl || 'https://www.inclawbate.app/inclawbate/assets/inclawbate-logo.png',
            creator_cardano_address: cardanoAddr
        });
        if (mintResult.error) throw new Error('Mint failed: ' + mintResult.error);

        var unsignedMintTx = mintResult.unsignedTx;
        var policyId = mintResult.policyId;
        var assetName = mintResult.assetName;
        var tokenUnit = mintResult.unit || (policyId + assetName);
        if (!unsignedMintTx) throw new Error('No unsigned transaction returned from server');

        // Step 4: Sign mint tx in Cardano wallet
        setBtnState(btn, 'Sign in wallet to mint...', true);
        var mintTxResult = await window.signAndSubmitCardanoTx(unsignedMintTx);
        var mintTxHash = mintTxResult.txHash;

        // Step 5: Create Minswap liquidity pool (if dev buy > 0)
        var devBuyInput = document.getElementById('devBuyAmount');
        var devBuyAda = devBuyInput ? parseFloat(devBuyInput.value) || 0 : 0;

        if (devBuyAda >= 2) {
            setBtnState(btn, 'Creating Minswap pool...', true);
            var poolResult = await apiPost({
                action: 'cardano-create-pool-tx',
                policy_id: policyId,
                asset_name: assetName,
                creator_cardano_address: cardanoAddr,
                ada_amount: devBuyAda,
                mint_tx_hash: mintTxHash
            });
            if (poolResult.error) {
                showToast('Token minted but pool creation failed: ' + poolResult.error + '. You can add liquidity manually on Minswap.', 'error', 10000);
            } else if (poolResult.unsignedTx) {
                // Step 6: Sign pool tx
                setBtnState(btn, 'Sign pool creation...', true);
                var poolTxResult = await window.signAndSubmitCardanoTx(poolResult.unsignedTx);
                // Use pool tx hash as the deploy hash if successful
                if (poolTxResult.txHash) mintTxHash = poolTxResult.txHash;
            }
        } else if (devBuyAda > 0 && devBuyAda < 2) {
            showToast('Minimum 2 ADA for liquidity pool. Skipping pool creation.', 'error');
        }

        state.deployedToken = tokenUnit;
        state.deployTxHash = mintTxHash;

        // Step 7: Register with backend
        setBtnState(btn, 'Registering project...', true);
        var xHandle = (document.getElementById('launchXHandle') || {}).value || '';
        var telegram = (document.getElementById('launchTelegram') || {}).value || '';
        var regResult = await apiPost({
            action: 'register',
            token_address: tokenUnit,
            token_name: name,
            token_symbol: symbol,
            deploy_tx_hash: mintTxHash,
            description: desc,
            website_url: website,
            logo_url: imageUrl || null,
            x_handle: xHandle || null,
            telegram_url: telegram || null,
            fee_split_bps: 2000,
            tier: 'permissionless',
            creator_wallet: state.wallet,
            allocation_pct: state.allocationPct,
            burn_amount: 0,
            chain: 'cardano',
            cardano_wallet: cardanoAddr,
            cardano_policy_id: policyId,
            cardano_asset_name: assetName
        });

        if (regResult.error) {
            showToast('Token launched on Cardano but registration failed: ' + regResult.error, 'error', 10000);
        } else {
            state.project = regResult.project;
            showToast('Token launched on Cardano!', 'success');
        }

        state.step = 4;
        state.deploying = false;
        closeToolDrawer();
        updateUI();
        var successEl = document.getElementById('successStep');
        if (successEl) successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

    } catch (e) {
        state.deploying = false;
        setBtnState(btn, 'Deploy Token', false);
        if (e.code === 4001 || (e.message && e.message.includes('rejected')) || (e.message && e.message.includes('declined'))) {
            showToast('Transaction rejected by user', 'error');
        } else {
            showToast('Cardano launch failed: ' + (e.message || 'Unknown error'), 'error');
        }
    }
}

// ── Tier Selection for Incubation ──
var selectedIncTier = 'incubation';

function selectTier(tier) {
    selectedIncTier = tier;
    var cards = document.querySelectorAll('#incTierCards .inc-tier-card');
    cards.forEach(function(c) {
        c.classList.toggle('selected', c.dataset.tier === tier);
    });
}

// Expose to onclick handlers
window.resetForm = resetForm;
if (typeof approveProject === 'function') window.approveProject = approveProject;
if (typeof rejectProject === 'function') window.rejectProject = rejectProject;
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
        var isSolana = state.chain === 'solana';
        var isCardano = state.chain === 'cardano';
        var addrEl = successStep.querySelector('.deployed-address');
        if (addrEl && state.deployedToken) addrEl.textContent = state.deployedToken;
        var txLink = successStep.querySelector('.deploy-tx-link');
        if (txLink && state.deployTxHash) {
            if (isCardano) {
                txLink.href = 'https://cardanoscan.io/transaction/' + state.deployTxHash;
                txLink.textContent = 'View on CardanoScan';
            } else if (isSolana) {
                txLink.href = 'https://solscan.io/tx/' + state.deployTxHash;
                txLink.textContent = 'View on Solscan';
            } else {
                txLink.href = 'https://basescan.org/tx/' + state.deployTxHash;
                txLink.textContent = 'View on BaseScan';
            }
        }
        var successSubtitle = document.getElementById('successSubtitle');
        if (successSubtitle) {
            if (isCardano) successSubtitle.textContent = 'Your token is live on Cardano. Here are the details:';
            else if (isSolana) successSubtitle.textContent = 'Your token is live on Solana. Here are the details:';
            else successSubtitle.textContent = 'Your token is live on Base. Here are the details:';
        }
        var projectIdEl = successStep.querySelector('.project-id');
        if (projectIdEl && state.project) projectIdEl.textContent = state.project.id;
        var stakingNote = document.getElementById('stakingSuccessNote');
        if (stakingNote) stakingNote.style.display = (isSolana || isCardano) ? 'none' : '';
        var agentNote = document.getElementById('agentSuccessNote');
        if (agentNote && state.project && state.project.agent_enabled) agentNote.style.display = 'block';
        // Burn/allocation info
        var burnNote = document.getElementById('burnSuccessNote');
        if (burnNote && state.allocationPct > 0 && state.burnTxHash) {
            burnNote.style.display = 'block';
            var burnText = document.getElementById('burnSuccessText');
            if (burnText) burnText.textContent = 'Burned ' + fmt(ALLOCATION_TIERS[state.allocationPct]) + ' CLAWS for ' + state.allocationPct + '% ' + (isSolana ? 'launch tier' : 'allocation');
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

async function loadAngelHolders() {
    var btn = document.getElementById('disperseAngelAirdrop');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading...'; }

    try {
        var CONTRACT = '0x14d44d4d9f7898be1b9e1184a116502061eff5e7';
        var RPC = 'https://mainnet.base.org';

        // Get totalSupply
        var supplyResp = await fetch(RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: CONTRACT, data: '0x18160ddd' }, 'latest'] })
        });
        var supplyJson = await supplyResp.json();
        var totalSupply = parseInt(supplyJson.result, 16);
        if (!totalSupply || totalSupply <= 0) throw new Error('Could not read totalSupply');

        // Batch ownerOf calls (token IDs 1..totalSupply)
        var batchSize = 50;
        var owners = new Set();

        for (var start = 1; start <= totalSupply; start += batchSize) {
            var batch = [];
            for (var i = start; i < start + batchSize && i <= totalSupply; i++) {
                // ownerOf(uint256) = 0x6352211e
                var tokenIdHex = i.toString(16).padStart(64, '0');
                batch.push({ jsonrpc: '2.0', id: i, method: 'eth_call', params: [{ to: CONTRACT, data: '0x6352211e' + tokenIdHex }, 'latest'] });
            }
            var resp = await fetch(RPC, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(batch)
            });
            var results = await resp.json();
            results.forEach(function(r) {
                if (r.result && r.result !== '0x') {
                    var addr = '0x' + r.result.slice(26);
                    if (addr.length === 42) owners.add(addr.toLowerCase());
                }
            });
        }

        // Clear existing rows and populate
        var list = document.getElementById('disperseRecipientList');
        if (list) list.innerHTML = '';
        var uniqueOwners = Array.from(owners);
        uniqueOwners.forEach(function(addr) {
            addDisperseRecipientRow();
            var rows = list.querySelectorAll('.disperse-recipient-row');
            var lastRow = rows[rows.length - 1];
            var input = lastRow.querySelector('.disperse-addr-input');
            if (input) input.value = addr;
        });
        recalcEvenSplit();

        if (btn) { btn.textContent = '\uD83D\uDC7C ' + uniqueOwners.length + ' holders loaded'; }
    } catch (e) {
        console.error('Angel holder load failed:', e);
        if (btn) { btn.textContent = 'Failed — try again'; btn.disabled = false; }
    }
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

    // Bind advanced config inputs
    var rewardPctInput = document.getElementById('rewardPct');
    if (rewardPctInput) rewardPctInput.addEventListener('change', function() {
        state.rewardPct = Math.min(100, Math.max(0, parseInt(rewardPctInput.value) || 80));
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

    // Disperse bindings
    var disperseQuoteBtn = document.getElementById('disperseQuoteBtn');
    if (disperseQuoteBtn) disperseQuoteBtn.addEventListener('click', handleDisperseQuote);
    var disperseExecBtn = document.getElementById('disperseExecBtn');
    if (disperseExecBtn) disperseExecBtn.addEventListener('click', handleDisperseExecute);
    var disperseAddRow = document.getElementById('disperseAddRow');
    if (disperseAddRow) disperseAddRow.addEventListener('click', addDisperseRecipientRow);
    var disperseAngelAirdrop = document.getElementById('disperseAngelAirdrop');
    if (disperseAngelAirdrop) disperseAngelAirdrop.addEventListener('click', loadAngelHolders);
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
                // Sync with nav
                try {
                    localStorage.setItem('connectedWallet', state.wallet);
                    localStorage.setItem('walletAddress', state.wallet);
                } catch(e) {}
                updateUI();
                loadClawsBalance();
            }
        } catch (e) {}
    }

    // Listen for nav wallet changes (disconnect/reconnect via nav)
    window.addEventListener('navAuthChanged', function(e) {
        var newWallet = e.detail && e.detail.wallet;
        if (newWallet) {
            state.wallet = newWallet.toLowerCase();
            // Set provider from whatever is available
            if (!state.provider) {
                state.provider = window.ethereum || (window.phantom && window.phantom.ethereum) || null;
            }
            state.isAdmin = state.wallet === SUPER_ADMIN;
            updateUI();
            loadClawsBalance();
        } else {
            state.wallet = null;
            state.provider = null;
            state.isAdmin = false;
            state.clawsBalance = 0;
            updateUI();
        }
    });

    // Listen for MetaMask account switches
    if (window.ethereum && window.ethereum.on) {
        window.ethereum.on('accountsChanged', function(accounts) {
            if (accounts.length > 0) {
                state.wallet = accounts[0].toLowerCase();
                state.isAdmin = state.wallet === SUPER_ADMIN;
                try {
                    localStorage.setItem('connectedWallet', state.wallet);
                    localStorage.setItem('walletAddress', state.wallet);
                } catch(e) {}
                updateUI();
                loadClawsBalance();
                window.dispatchEvent(new CustomEvent('navAuthChanged', { detail: { wallet: state.wallet } }));
            }
        });
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

    // Embed mode: ?embed=1 hides everything except the tool drawer
    var isEmbed = urlParams.get('embed') === '1';
    if (isEmbed) {
        document.body.classList.add('embed-mode');
        // Report content height to parent for auto-sizing modal
        function reportHeight() {
            var drawer = document.querySelector('.tool-drawer-inner');
            var h = drawer ? drawer.scrollHeight + 40 : document.body.scrollHeight;
            if (h > 200 && window.parent !== window) {
                window.parent.postMessage({ type: 'embed-height', height: h }, '*');
            }
        }
        // Wait for drawer to open (300ms delay + render), then start reporting
        setTimeout(function() {
            reportHeight();
            if (window.ResizeObserver) {
                var target = document.querySelector('.tool-drawer-inner') || document.body;
                new ResizeObserver(reportHeight).observe(target);
            }
            setInterval(reportHeight, 1000);
        }, 500);
    }

    // Deep-link: ?tool=pool or #launch opens a drawer
    var toolParam = urlParams.get('tool') || window.location.hash.replace('#', '');
    if (isEmbed && toolParam && ['launch','pool','incubate','agent','disperse','marketing'].indexOf(toolParam) !== -1) {
        if (!isEmbed) window.history.replaceState({}, '', window.location.pathname);
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
