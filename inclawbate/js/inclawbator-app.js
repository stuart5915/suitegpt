// Inclawbator — Token Launch + Staking Factory + Admin Distribution
// Pattern: IIFE, raw EIP-1193 (same as stake-app.js)

(function() {
'use strict';

// ══════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════

var BASE_CHAIN_ID = '0x2105';
var INCLAWNCH = '0xB0b6e0E9da530f68D713cC03a813B506205aC808';
var CLANKER_V4 = '0xE85A59c628F7d27878ACeB4bf3b35733630083a9';
var DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';
var ADMIN_WALLET = '0x91B5C0D07859CFeAfEB67d9694121CD741F049bd'.toLowerCase();
var MAX_UINT256 = '0x' + 'f'.repeat(64);

// Staking factory v2 (deployed on Base — fee to inclawbate.base.eth)
var STAKING_FACTORY = '0xB0896F6c13088ca1812Ede403B8D229452b82394';

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

async function sendTxAndWait(provider, from, to, data) {
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
    var txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: from, to: to, data: data }]
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
    step: 1,        // 1=form, 2=tier, 3=deploy, 4=success
    deploying: false,
    project: null,   // registered project from API
    deployedToken: null,
    deployTxHash: null,
    isAdmin: false,
    projects: []     // loaded from API
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
            state.isAdmin = state.wallet === ADMIN_WALLET;
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
        }
    } catch (e) {
        showToast('Wallet connection failed', 'error');
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

// Clanker v4 deployToken(TokenConfig)
// TokenConfig struct: (string name, string symbol, bytes32 salt, string image,
//                      string metadata, address context, address deployer,
//                      address[] initialHolders, uint256[] initialAmounts)
// We pass minimal config — name, symbol, and msg.sender as deployer

// Clanker v4 deployToken ABI — uses ethers.js AbiCoder loaded from CDN
// Selector: 0xdf40224a
// deployToken(DeploymentConfig) where DeploymentConfig is a deeply nested struct

var CLANKER_SELECTOR = 'df40224a';

// Known Clanker v4 contract addresses on Base
var WETH_BASE = '0x4200000000000000000000000000000000000006';
var CLANKER_HOOK_STATIC = '0xDd5EeaFf7BD481AD55Db083062b13a3cdf0A68CC';
var CLANKER_FEE_LOCKER = '0xF3622742b1E446D92e45E22923Ef11C2fcD55D68';
var ZERO_ADDR = '0x0000000000000000000000000000000000000000';

// Full ABI fragment for deployToken
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
    // Use ethers.js Interface to ABI-encode the call
    var iface = new ethers.Interface(DEPLOY_TOKEN_ABI);

    // Generate random salt
    var saltBytes = new Uint8Array(32);
    crypto.getRandomValues(saltBytes);
    var salt = '0x' + Array.from(saltBytes).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');

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
            hook: CLANKER_HOOK_STATIC,
            pairedToken: WETH_BASE,
            tickIfToken0IsClanker: -199200,
            tickSpacing: 100,
            poolData: '0x'
        },
        lockerConfig: {
            locker: CLANKER_FEE_LOCKER,
            rewardAdmins: [state.wallet],
            rewardRecipients: [state.wallet],
            rewardBps: [10000],
            tickLower: [-887200],
            tickUpper: [887200],
            positionBps: [10000],
            lockerData: '0x'
        },
        mevModuleConfig: {
            mevModule: ZERO_ADDR,
            mevModuleData: '0x'
        },
        extensionConfigs: []
    };

    return iface.encodeFunctionData('deployToken', [deploymentConfig]);
}

// Parse TokenDeployed event from receipt logs to get token address
function parseDeployedToken(receipt) {
    // Look for TokenDeployed event
    // TokenDeployed(address indexed token, address indexed deployer, ...)
    // The token address is in topics[1]
    if (!receipt || !receipt.logs) return null;
    for (var i = 0; i < receipt.logs.length; i++) {
        var log = receipt.logs[i];
        if (log.address && log.address.toLowerCase() === CLANKER_V4.toLowerCase() && log.topics && log.topics.length >= 2) {
            // Token address is in topics[1] (indexed param)
            return '0x' + log.topics[1].slice(26);
        }
    }
    return null;
}

// Parse PoolDeployed event from StakingFactory receipt
function parsePoolDeployed(receipt) {
    // PoolDeployed(address indexed pool, address indexed stakingToken, address indexed admin, bool paid)
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
// BYT (BRING YOUR TOKEN)
// ══════════════════════════════════════

function decodeString(hex) {
    // ABI-encoded string: offset (32b) + length (32b) + data
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

var bytDebounceTimer = null;

function onBytAddressInput() {
    clearTimeout(bytDebounceTimer);
    var input = document.getElementById('bytTokenAddress');
    var preview = document.getElementById('bytTokenPreview');
    var btn = document.getElementById('bytDeployBtn');
    var val = input.value.trim();

    if (!val || val.length !== 42 || !val.startsWith('0x')) {
        preview.classList.add('hidden');
        btn.disabled = true;
        return;
    }

    bytDebounceTimer = setTimeout(async function() {
        try {
            var info = await readTokenInfo(val);
            if (info.name && info.symbol) {
                document.getElementById('bytTokenName').textContent = info.name;
                document.getElementById('bytTokenSymbol').textContent = '$' + info.symbol;
                document.getElementById('bytTokenIcon').textContent = info.symbol[0];
                preview.classList.remove('hidden');
                btn.disabled = false;
            } else {
                preview.classList.add('hidden');
                btn.disabled = true;
                showToast('Could not read token info. Is this a valid ERC20 on Base?', 'error');
            }
        } catch (e) {
            preview.classList.add('hidden');
            btn.disabled = true;
        }
    }, 600);
}

async function handleBYTDeploy() {
    if (state.deploying) return;

    var tokenAddress = document.getElementById('bytTokenAddress').value.trim();
    var desc = document.getElementById('bytDesc').value.trim();
    var website = document.getElementById('bytWebsite').value.trim();
    var logo = document.getElementById('bytLogo').value.trim();
    var tokenName = document.getElementById('bytTokenName').textContent;
    var tokenSymbol = document.getElementById('bytTokenSymbol').textContent.replace('$', '');

    if (!tokenAddress || tokenAddress.length !== 42) return showToast('Valid token address required', 'error');

    if (!state.wallet) {
        await connectWallet();
        if (!state.wallet) return;
    }

    state.deploying = true;
    var btn = document.getElementById('bytDeployBtn');
    btn.disabled = true;
    btn.textContent = 'Approving INCLAWNCH...';

    try {
        // Step 1: Approve INCLAWNCH to factory
        var approveData = SEL.approve + pad32(STAKING_FACTORY) + MAX_UINT256.slice(2);
        await sendTxAndWait(state.provider, state.wallet, INCLAWNCH, '0x' + approveData.replace('0x0x', '0x'));

        btn.textContent = 'Deploying staking pool...';

        // Step 2: deployPaid(tokenAddress, INCLAWNCH)
        var deployData = SEL.deployPaid + pad32(tokenAddress) + pad32(INCLAWNCH);
        var result = await sendTxAndWait(state.provider, state.wallet, STAKING_FACTORY, deployData);

        var stakingPool = parsePoolDeployed(result.receipt);
        if (!stakingPool) throw new Error('Could not find staking pool address in receipt');

        btn.textContent = 'Registering project...';

        // Step 3: Register with API as BYT
        var regResult = await apiPost({
            action: 'register',
            token_address: tokenAddress,
            token_name: tokenName,
            token_symbol: tokenSymbol,
            description: desc,
            website_url: website,
            logo_url: logo,
            fee_split_bps: 10000,
            tier: 'byt',
            creator_wallet: state.wallet
        });

        // Step 4: Update staking address
        if (regResult.project) {
            await apiPost({
                action: 'update-staking',
                project_id: regResult.project.id,
                staking_address: stakingPool,
                staking_deploy_tx: result.txHash
            });
        }

        // Show success
        document.getElementById('bytForm').classList.add('hidden');
        document.getElementById('bytSuccess').classList.remove('hidden');
        document.getElementById('bytStakingAddr').textContent = stakingPool;

        var adminLink = document.getElementById('bytAdminLink');
        if (regResult.project) {
            adminLink.href = '/stake/' + regResult.project.id + '/admin';
        }

        state.deploying = false;
        showToast('Staking deployed! Pending review.', 'success');

    } catch (e) {
        state.deploying = false;
        btn.disabled = false;
        btn.textContent = 'Deploy Staking';
        if (e.code === 4001 || (e.message && e.message.includes('rejected'))) {
            showToast('Transaction rejected', 'error');
        } else {
            showToast('Deploy failed: ' + (e.message || 'Unknown error'), 'error');
        }
    }
}

// ══════════════════════════════════════
// LAUNCH FLOW
// ══════════════════════════════════════

async function handleDeploy() {
    if (state.deploying) return;

    var nameEl = document.getElementById('tokenName');
    var symbolEl = document.getElementById('tokenSymbol');
    var descEl = document.getElementById('tokenDesc');
    var websiteEl = document.getElementById('tokenWebsite');
    var splitEl = document.getElementById('feeSplit');
    var tierEl = document.querySelector('input[name="tier"]:checked');

    var name = nameEl.value.trim();
    var symbol = symbolEl.value.trim().toUpperCase();
    var desc = descEl.value.trim();
    var website = websiteEl.value.trim();
    var agentCheckbox = document.getElementById('agentEnabled');
    var agentPersonaEl = document.getElementById('agentPersona');
    var agentPostsEl = document.getElementById('agentPostsPerDay');

    var splitPct = parseInt(splitEl.value) || 100;
    var tier = tierEl ? tierEl.value : 'permissionless';
    var agentEnabled = agentCheckbox ? agentCheckbox.checked : false;
    var agentPersona = agentPersonaEl ? agentPersonaEl.value.trim() : '';
    var agentPostsPerDay = agentPostsEl ? parseInt(agentPostsEl.value) || 4 : 4;

    if (!name) return showToast('Token name is required', 'error');
    if (!symbol || symbol.length > 10) return showToast('Symbol required (max 10 chars)', 'error');

    // ── Incubated: application-only flow (no on-chain deploy) ──
    if (tier === 'incubated') {
        var xHandle = (document.getElementById('incXHandle')?.value || '').trim();
        var telegram = (document.getElementById('incTelegram')?.value || '').trim();
        var logoUrl = (document.getElementById('incLogoUrl')?.value || '').trim();
        var helpNeeded = (document.getElementById('incHelpNeeded')?.value || '').trim();

        if (!xHandle && !telegram) return showToast('Please provide at least an X handle or Telegram so we can reach you', 'error');

        if (!state.wallet) {
            await connectWallet();
            if (!state.wallet) return;
        }

        state.deploying = true;
        updateDeployButton('Submitting application...', true);

        try {
            var regResult = await apiPost({
                action: 'register',
                token_name: name,
                token_symbol: symbol,
                description: desc + (helpNeeded ? '\n\n--- HELP NEEDED ---\n' + helpNeeded : ''),
                website_url: website,
                x_handle: xHandle,
                telegram_url: telegram,
                logo_url: logoUrl,
                fee_split_bps: 10000,
                tier: 'incubated',
                creator_wallet: state.wallet,
                agent_enabled: agentEnabled,
                agent_persona: agentPersona || null,
                agent_posts_per_day: agentPostsPerDay
            });

            if (regResult.error) {
                showToast('Submission failed: ' + regResult.error, 'error');
                state.deploying = false;
                updateDeployButton('Submit Application', false);
                return;
            }

            state.project = regResult.project;
            state.step = 5; // incubated success
            state.deploying = false;
            updateUI();
            showToast('Application submitted!', 'success');
        } catch (e) {
            state.deploying = false;
            updateDeployButton('Submit Application', false);
            showToast('Submission failed: ' + (e.message || 'Unknown error'), 'error');
        }
        return;
    }

    // ── Permissionless: full deploy flow ──
    if (splitPct < 20 || splitPct > 100) return showToast('Fee split must be 20-100%', 'error');

    if (!state.wallet) {
        await connectWallet();
        if (!state.wallet) return;
    }

    state.deploying = true;
    updateDeployButton('Deploying token...', true);

    try {
        // Step 1: Deploy token via Clanker v4
        var calldata = encodeClankerDeploy(name, symbol);

        var result = await sendTxAndWait(state.provider, state.wallet, CLANKER_V4, calldata);

        var tokenAddress = parseDeployedToken(result.receipt);
        if (!tokenAddress) {
            throw new Error('Could not find deployed token address in transaction');
        }

        state.deployedToken = tokenAddress;
        state.deployTxHash = result.txHash;

        updateDeployButton('Registering project...', true);

        // Step 2: Register with API
        var regResult = await apiPost({
            action: 'register',
            token_address: tokenAddress,
            token_name: name,
            token_symbol: symbol,
            deploy_tx_hash: result.txHash,
            description: desc,
            website_url: website,
            fee_split_bps: splitPct * 100,
            tier: tier,
            creator_wallet: state.wallet,
            agent_enabled: agentEnabled,
            agent_persona: agentPersona || null,
            agent_posts_per_day: agentPostsPerDay
        });

        if (regResult.error) {
            showToast('Token deployed but registration failed: ' + regResult.error, 'error');
        } else {
            state.project = regResult.project;
        }

        // Step 3: Deploy staking pool
        if (STAKING_FACTORY) {
            try {
                updateDeployButton('Deploying staking pool...', true);

                // Approve INCLAWNCH burn to factory
                var approveData = SEL.approve + pad32(STAKING_FACTORY) + MAX_UINT256.slice(2);
                await sendTxAndWait(state.provider, state.wallet, INCLAWNCH, '0x' + approveData.replace('0x0x', '0x'));

                updateDeployButton('Creating staking pool...', true);

                // deployPaid(stakingToken, rewardToken)
                var deployPaidData = SEL.deployPaid + pad32(tokenAddress) + pad32(INCLAWNCH);
                var stakingResult = await sendTxAndWait(state.provider, state.wallet, STAKING_FACTORY, deployPaidData);

                // Parse PoolDeployed event to get staking pool address
                var stakingPool = parsePoolDeployed(stakingResult.receipt);
                if (stakingPool) {
                    await apiPost({
                        action: 'update-staking',
                        project_id: state.project ? state.project.id : null,
                        staking_address: stakingPool,
                        staking_deploy_tx: stakingResult.txHash
                    });
                    showToast('Staking pool deployed!', 'success');
                }
            } catch (stakingErr) {
                showToast('Token deployed but staking pool failed: ' + (stakingErr.message || ''), 'error');
            }
        }

        // Step 4: Show success
        state.step = 4;
        state.deploying = false;
        updateUI();
        showToast('Token deployed successfully!', 'success');

    } catch (e) {
        state.deploying = false;
        updateDeployButton('Deploy Token', false);
        if (e.code === 4001 || (e.message && e.message.includes('rejected'))) {
            showToast('Transaction rejected by user', 'error');
        } else {
            showToast('Deploy failed: ' + (e.message || 'Unknown error'), 'error');
        }
    }
}

function updateDeployButton(text, disabled) {
    var btn = document.getElementById('deployBtn');
    if (!btn) return;
    // If resetting (not disabled), use tier-appropriate label
    if (!disabled && !text) {
        var sel = document.querySelector('input[name="tier"]:checked');
        btn.textContent = (sel && sel.value === 'incubated') ? 'Submit Application' : 'Deploy Token';
    } else {
        btn.textContent = text;
    }
    btn.disabled = disabled;
    if (disabled) {
        btn.classList.add('deploying');
    } else {
        btn.classList.remove('deploying');
    }
}

// ══════════════════════════════════════
// PROJECT CARDS
// ══════════════════════════════════════

async function loadProjects() {
    try {
        var data = await apiGet();
        state.projects = data.projects || [];
        renderProjects();
    } catch (e) {
        // Silently fail
    }
}

function renderProjects() {
    var grid = document.getElementById('projectsGrid');
    if (!grid) return;

    if (state.projects.length === 0) {
        grid.innerHTML = '<div class="no-projects">No projects launched yet. Be the first!</div>';
        return;
    }

    grid.innerHTML = state.projects.map(function(p) {
        var tierBadge = p.tier === 'incubated'
            ? '<span class="tier-badge tier-incubated">Incubated</span>'
            : p.tier === 'byt'
            ? '<span class="tier-badge tier-permissionless">BYT</span>'
            : '<span class="tier-badge tier-permissionless">Permissionless</span>';

        // Agent status dot
        var agentDot = '';
        if (p.agent_enabled) {
            var dotColor = p.agent_status === 'active' ? 'var(--seafoam-400)' : 'var(--text-dim)';
            agentDot = '<span class="agent-dot" style="background:' + dotColor + '" title="AI Agent ' + (p.agent_status === 'active' ? 'Live' : 'Dormant') + '"></span>';
        }

        // Truncate description
        var desc = p.description || '';
        if (desc.length > 120) desc = desc.slice(0, 117) + '...';

        return '<a href="/inclawbator/' + p.id + '" class="project-card" style="border-color:' + (p.color || 'var(--border-subtle)') + '">' +
            '<div class="project-card-header">' +
                (p.logo_url ? '<img src="' + p.logo_url + '" class="project-logo" alt="">' : '<div class="project-logo-placeholder" style="background:' + (p.color || 'var(--seafoam-500)') + '">' + (p.token_symbol || '?')[0] + '</div>') +
                '<div class="project-card-info">' +
                    '<div class="project-name">' + escapeHtml(p.token_name) + ' ' + agentDot + '</div>' +
                    '<div class="project-symbol">$' + escapeHtml(p.token_symbol) + '</div>' +
                '</div>' +
                tierBadge +
            '</div>' +
            (desc ? '<p class="project-desc">' + escapeHtml(desc) + '</p>' : '') +
        '</a>';
    }).join('');
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ══════════════════════════════════════
// SORT/FILTER
// ══════════════════════════════════════

function sortProjects(by) {
    // Update active button
    document.querySelectorAll('.sort-btn').forEach(function(b) { b.classList.remove('active'); });
    var activeBtn = document.querySelector('.sort-btn[data-sort="' + by + '"]');
    if (activeBtn) activeBtn.classList.add('active');

    var sorted = state.projects.slice();
    if (by === 'newest') {
        sorted.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    } else if (by === 'fees') {
        sorted.sort(function(a, b) { return (b.total_fees_claimed || 0) - (a.total_fees_claimed || 0); });
    } else if (by === 'split') {
        sorted.sort(function(a, b) { return (b.fee_split_bps || 0) - (a.fee_split_bps || 0); });
    }
    state.projects = sorted;
    renderProjects();
}

// ══════════════════════════════════════
// ADMIN: BATCH DISTRIBUTION
// ══════════════════════════════════════

async function loadAdminPanel() {
    if (!state.isAdmin) return;

    var panel = document.getElementById('adminPanel');
    if (!panel) return;
    panel.style.display = 'block';

    // Load all projects with staking addresses
    try {
        var data = await apiGet();
        var pools = (data.projects || []).filter(function(p) { return p.staking_address; });
        renderAdminTable(pools);
    } catch (e) {}
}

function renderAdminTable(pools) {
    var tbody = document.getElementById('adminPoolsBody');
    if (!tbody) return;

    if (pools.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-dim)">No pools with staking addresses yet</td></tr>';
        return;
    }

    var totalFees = pools.reduce(function(sum, p) { return sum + parseFloat(p.total_fees_claimed || 0); }, 0);

    tbody.innerHTML = pools.map(function(p) {
        var fees = parseFloat(p.total_fees_claimed || 0);
        var share = totalFees > 0 ? ((fees / totalFees) * 100).toFixed(1) : '0.0';

        return '<tr>' +
            '<td>' + escapeHtml(p.token_name) + ' <span style="color:var(--text-dim)">$' + escapeHtml(p.token_symbol) + '</span></td>' +
            '<td><code style="font-size:0.75rem">' + shortAddr(p.staking_address) + '</code></td>' +
            '<td>' + fmt(fees) + '</td>' +
            '<td>' + share + '%</td>' +
            '<td>' + fmt(parseFloat(p.total_rewards_distributed || 0)) + '</td>' +
        '</tr>';
    }).join('');
}

async function handleBatchDistribute() {
    if (!state.isAdmin || !state.wallet) return;

    var amountEl = document.getElementById('distAmount');
    var daysEl = document.getElementById('distDays');

    var totalAmount = parseFloat(amountEl.value);
    var days = parseInt(daysEl.value);

    if (!totalAmount || totalAmount <= 0) return showToast('Enter a valid amount', 'error');
    if (!days || days <= 0) return showToast('Enter valid duration in days', 'error');

    var durationSeconds = days * 86400;

    // Get pools with staking addresses
    var data = await apiGet();
    var pools = (data.projects || []).filter(function(p) { return p.staking_address; });

    if (pools.length === 0) return showToast('No pools with staking addresses', 'error');

    var totalFees = pools.reduce(function(sum, p) { return sum + parseFloat(p.total_fees_claimed || 0); }, 0);

    if (totalFees <= 0) {
        // Equal distribution if no fees tracked yet
        var equalShare = totalAmount / pools.length;
        pools.forEach(function(p) { p._share = equalShare; });
    } else {
        pools.forEach(function(p) {
            var fees = parseFloat(p.total_fees_claimed || 0);
            p._share = (fees / totalFees) * totalAmount;
        });
    }

    var btn = document.getElementById('batchDistributeBtn');
    btn.disabled = true;
    btn.textContent = 'Distributing...';

    try {
        for (var i = 0; i < pools.length; i++) {
            var pool = pools[i];
            var shareWei = BigInt(Math.floor(pool._share * 1e18)).toString(16).padStart(64, '0');
            var durHex = BigInt(durationSeconds).toString(16).padStart(64, '0');

            btn.textContent = 'Approving ' + (i + 1) + '/' + pools.length + '...';

            // Approve INCLAWNCH to staking contract
            var approveData = SEL.approve + pad32(pool.staking_address) + shareWei;
            await sendTxAndWait(state.provider, state.wallet, INCLAWNCH, approveData);

            btn.textContent = 'Depositing ' + (i + 1) + '/' + pools.length + '...';

            // depositRewards(amount, duration)
            var depositData = SEL.depositRewards + shareWei + durHex;
            var result = await sendTxAndWait(state.provider, state.wallet, pool.staking_address, depositData);

            // Record in API
            await apiPost({
                action: 'record-distribution',
                admin_secret: prompt('Admin secret for recording:'),
                project_id: pool.id,
                staking_address: pool.staking_address,
                amount: pool._share,
                duration_seconds: durationSeconds,
                tx_hash: result.txHash,
                distributed_by: state.wallet
            });

            showToast('Distributed to ' + pool.token_name, 'success');
        }

        btn.textContent = 'Batch Distribute';
        btn.disabled = false;
        showToast('All distributions complete!', 'success');
        loadAdminPanel();
    } catch (e) {
        btn.textContent = 'Batch Distribute';
        btn.disabled = false;
        showToast('Distribution failed: ' + (e.message || 'Unknown error'), 'error');
    }
}

// ══════════════════════════════════════
// UI UPDATE
// ══════════════════════════════════════

function updateUI() {
    var connectBtn = document.getElementById('walletConnectBtn');
    var walletInfo = document.getElementById('walletInfo');
    var launchSection = document.getElementById('launchSection');
    var formStep = document.getElementById('formStep');
    var successStep = document.getElementById('successStep');
    var bytSection = document.getElementById('bytSection');

    var heroLaunchBtn = document.getElementById('heroLaunchBtn');

    // Wallet state
    if (state.wallet) {
        if (connectBtn) connectBtn.style.display = 'none';
        if (heroLaunchBtn) heroLaunchBtn.style.display = 'inline-flex';
        if (walletInfo) {
            walletInfo.style.display = 'flex';
            walletInfo.querySelector('.wallet-addr').textContent = shortAddr(state.wallet);
        }
        if (launchSection) launchSection.style.display = 'block';
        if (bytSection) bytSection.style.display = 'block';
    } else {
        if (connectBtn) connectBtn.style.display = 'inline-flex';
        if (heroLaunchBtn) heroLaunchBtn.style.display = 'none';
        if (walletInfo) walletInfo.style.display = 'none';
        if (launchSection) launchSection.style.display = 'none';
        if (bytSection) bytSection.style.display = 'none';
    }

    var incubatedSuccessStep = document.getElementById('incubatedSuccessStep');

    // Step state
    if (state.step === 4 && successStep && formStep) {
        // Permissionless deploy success
        formStep.style.display = 'none';
        successStep.style.display = 'block';
        if (incubatedSuccessStep) incubatedSuccessStep.style.display = 'none';

        var addrEl = successStep.querySelector('.deployed-address');
        if (addrEl && state.deployedToken) addrEl.textContent = state.deployedToken;

        var txLink = successStep.querySelector('.deploy-tx-link');
        if (txLink && state.deployTxHash) {
            txLink.href = 'https://basescan.org/tx/' + state.deployTxHash;
        }

        var projectIdEl = successStep.querySelector('.project-id');
        if (projectIdEl && state.project) projectIdEl.textContent = state.project.id;

        // Show agent success note if enabled
        var agentNote = document.getElementById('agentSuccessNote');
        if (agentNote && state.project && state.project.agent_enabled) {
            agentNote.style.display = 'block';
        }
    } else if (state.step === 5 && incubatedSuccessStep && formStep) {
        // Incubated application success
        formStep.style.display = 'none';
        if (successStep) successStep.style.display = 'none';
        incubatedSuccessStep.style.display = 'block';

        var incProjectIdEl = incubatedSuccessStep.querySelector('.incubated-project-id');
        if (incProjectIdEl && state.project) incProjectIdEl.textContent = state.project.id;
    } else if (formStep && successStep) {
        formStep.style.display = 'block';
        successStep.style.display = 'none';
        if (incubatedSuccessStep) incubatedSuccessStep.style.display = 'none';
    }

    // Admin panel
    if (state.isAdmin) {
        loadAdminPanel();
    }
}

// ══════════════════════════════════════
// FEE SPLIT SLIDER
// ══════════════════════════════════════

function initSlider() {
    var slider = document.getElementById('feeSplit');
    var display = document.getElementById('feeSplitDisplay');
    var bar = document.querySelector('.split-bar-fill');
    if (!slider) return;

    function update() {
        var val = parseInt(slider.value);
        if (display) display.textContent = val + '% to stakers';
        if (bar) bar.style.width = val + '%';
    }

    slider.addEventListener('input', update);
    update();
}

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════

async function init() {
    // Bind wallet connect
    var connectBtn = document.getElementById('walletConnectBtn');
    if (connectBtn) connectBtn.addEventListener('click', connectWallet);

    var heroCta = document.getElementById('heroLaunchBtn');
    if (heroCta) heroCta.addEventListener('click', function(e) {
        e.preventDefault();
        if (!state.wallet) {
            connectWallet().then(function() {
                document.getElementById('launchSection')?.scrollIntoView({ behavior: 'smooth' });
            });
        } else {
            document.getElementById('launchSection')?.scrollIntoView({ behavior: 'smooth' });
        }
    });

    // Bind deploy
    var deployBtn = document.getElementById('deployBtn');
    if (deployBtn) deployBtn.addEventListener('click', handleDeploy);

    // Bind sort buttons
    document.querySelectorAll('.sort-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { sortProjects(btn.dataset.sort); });
    });

    // Bind admin distribute
    var batchBtn = document.getElementById('batchDistributeBtn');
    if (batchBtn) batchBtn.addEventListener('click', handleBatchDistribute);

    // Agent toggle
    var agentCheckbox = document.getElementById('agentEnabled');
    var agentOptions = document.getElementById('agentOptions');
    if (agentCheckbox && agentOptions) {
        agentCheckbox.addEventListener('change', function() {
            if (agentCheckbox.checked) {
                agentOptions.classList.add('visible');
            } else {
                agentOptions.classList.remove('visible');
            }
        });
    }

    // Tier toggle — show/hide incubated fields, change button text
    var tierRadios = document.querySelectorAll('input[name="tier"]');
    var incubatedFields = document.getElementById('incubatedFields');
    var deployBtnEl = document.getElementById('deployBtn');
    var feeSplitGroup = document.getElementById('feeSplit')?.closest('.form-group');

    function onTierChange() {
        var selected = document.querySelector('input[name="tier"]:checked');
        var isIncubated = selected && selected.value === 'incubated';

        if (incubatedFields) {
            if (isIncubated) {
                incubatedFields.classList.add('visible');
            } else {
                incubatedFields.classList.remove('visible');
            }
        }

        // Change button text
        if (deployBtnEl && !state.deploying) {
            deployBtnEl.textContent = isIncubated ? 'Submit Application' : 'Deploy Token';
        }

        // Hide fee split for incubated (irrelevant until approved)
        if (feeSplitGroup) {
            feeSplitGroup.style.display = isIncubated ? 'none' : '';
        }
    }

    tierRadios.forEach(function(radio) {
        radio.addEventListener('change', onTierChange);
    });

    // BYT bindings
    var bytAddrInput = document.getElementById('bytTokenAddress');
    if (bytAddrInput) bytAddrInput.addEventListener('input', onBytAddressInput);

    var bytDeployBtn = document.getElementById('bytDeployBtn');
    if (bytDeployBtn) bytDeployBtn.addEventListener('click', handleBYTDeploy);

    // Load deploy fee for BYT display
    readDeployFee().then(function(fee) {
        var el = document.getElementById('bytFeeDisplay');
        if (el) el.textContent = fmt(fee);
    }).catch(function() {});

    // Init slider
    initSlider();

    // Auto-connect if previously connected
    if (window.ethereum) {
        try {
            var accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                state.wallet = accounts[0].toLowerCase();
                state.provider = window.ethereum;
                state.isAdmin = state.wallet === ADMIN_WALLET;
                updateUI();
            }
        } catch (e) {}
    }

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

    // Load projects
    loadProjects();
}


if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

})();
