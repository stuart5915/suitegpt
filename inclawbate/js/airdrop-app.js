// Inclawbate — Admin Airdrop Controller
// Uses Disperse.app contract on Base for batch ERC-20 transfers

const CLAWNCH_ADDRESS = '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be';
const DISPERSE_ADDRESS = '0xD152f549545093347A162Dce210e7293f1452150';
const BASE_CHAIN_ID = '0x2105';
const API_BASE = '/api/inclawbate';

// ABI function selectors
const APPROVE_SELECTOR = '0x095ea7b3';                 // approve(address,uint256)
const DISPERSE_TOKEN_SELECTOR = '0xc73a2d60';          // disperseToken(address,address[],uint256[])
const ALLOWANCE_SELECTOR = '0xdd62ed3e';               // allowance(address,address)
const BALANCE_SELECTOR = '0x70a08231';                  // balanceOf(address)

let provider = null;
let userAddress = null;
let allProfiles = [];
let clawnchPrice = 0;
let currentFilter = 'no-hires';

// Helpers
function pad32(hex) {
    return hex.replace('0x', '').padStart(64, '0');
}
function toHex(n) {
    return '0x' + BigInt(n).toString(16);
}
function toWei(amount) {
    return BigInt(Math.floor(amount)) * BigInt('1000000000000000000');
}
function shortAddr(a) {
    return a.slice(0, 6) + '...' + a.slice(-4);
}

// ── Wallet ──
const connectBtn = document.getElementById('connectBtn');
const walletStatus = document.getElementById('walletStatus');
const selectPanel = document.getElementById('selectPanel');

connectBtn.addEventListener('click', async () => {
    if (!window.ethereum) {
        walletStatus.textContent = 'No wallet found. Install MetaMask or Coinbase Wallet.';
        walletStatus.className = 'airdrop-status error';
        return;
    }
    try {
        provider = window.ethereum;
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        userAddress = accounts[0];

        // Switch to Base
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

        walletStatus.textContent = 'Connected: ' + shortAddr(userAddress);
        walletStatus.className = 'airdrop-status success';
        connectBtn.textContent = shortAddr(userAddress);
        connectBtn.disabled = true;
        selectPanel.style.display = '';
        loadProfiles();
    } catch (err) {
        walletStatus.textContent = err.message || 'Connection failed';
        walletStatus.className = 'airdrop-status error';
    }
});

// ── Fetch profiles ──
async function loadProfiles() {
    const resp = await fetch(API_BASE + '/humans?limit=100&sort=newest');
    const data = await resp.json();
    allProfiles = (data.profiles || []).filter(p => p.wallet_address);

    // Exclude connected wallet (admin)
    allProfiles = allProfiles.filter(p =>
        p.wallet_address.toLowerCase() !== userAddress.toLowerCase()
    );

    applyFilter();
    fetchPrice();
}

// ── Price ──
async function fetchPrice() {
    try {
        const resp = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + CLAWNCH_ADDRESS);
        const data = await resp.json();
        const pair = data.pairs?.[0];
        if (pair) clawnchPrice = parseFloat(pair.priceUsd) || 0;
    } catch (e) { /* no price */ }
    updateSummary();
}

// ── Filters ──
const filterChips = document.querySelectorAll('.filter-chip');
filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
        filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentFilter = chip.dataset.filter;
        applyFilter();
    });
});

function getFiltered() {
    if (currentFilter === 'no-hires') {
        return allProfiles.filter(p => (p.hire_count || 0) === 0 && (p.total_paid || 0) === 0);
    }
    return allProfiles; // 'has-wallet' and 'all' both show all with wallet
}

function applyFilter() {
    const filtered = getFiltered();
    renderList(filtered);
    updateSummary();
}

// ── Render recipient list ──
function renderList(profiles) {
    const list = document.getElementById('recipientList');
    if (profiles.length === 0) {
        list.innerHTML = '<div style="padding: var(--space-xl); text-align: center; color: var(--text-dim);">No matching profiles</div>';
        return;
    }

    const selectAll = `<div class="select-all-row">
        <input type="checkbox" id="selectAll" checked>
        <label for="selectAll">Select all (${profiles.length})</label>
    </div>`;

    const rows = profiles.map((p, i) => {
        const name = p.x_name || p.x_handle;
        const avatar = p.x_avatar_url
            ? `<img class="recipient-avatar" src="${p.x_avatar_url}" onerror="this.style.display='none'">`
            : '';
        return `<div class="recipient-row">
            <input type="checkbox" class="recipient-check" data-index="${i}" checked>
            ${avatar}
            <span class="recipient-name">${escHtml(name)}</span>
            <span class="recipient-handle">@${escHtml(p.x_handle)}</span>
            <span class="recipient-wallet">${shortAddr(p.wallet_address)}</span>
        </div>`;
    }).join('');

    list.innerHTML = selectAll + rows;

    // Select all toggle
    document.getElementById('selectAll').addEventListener('change', (e) => {
        document.querySelectorAll('.recipient-check').forEach(cb => {
            cb.checked = e.target.checked;
        });
        updateSummary();
    });

    // Individual toggles
    list.querySelectorAll('.recipient-check').forEach(cb => {
        cb.addEventListener('change', updateSummary);
    });
}

function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

// ── Summary ──
const amountInput = document.getElementById('amountInput');
amountInput.addEventListener('input', updateSummary);

function getSelectedRecipients() {
    const filtered = getFiltered();
    const checks = document.querySelectorAll('.recipient-check');
    const selected = [];
    checks.forEach(cb => {
        if (cb.checked) selected.push(filtered[parseInt(cb.dataset.index)]);
    });
    return selected;
}

function updateSummary() {
    const selected = getSelectedRecipients();
    const amount = parseInt(amountInput.value) || 0;
    const total = selected.length * amount;
    const usd = clawnchPrice > 0 ? (total * clawnchPrice).toFixed(2) : '?';

    document.getElementById('recipientCount').textContent = selected.length;
    document.getElementById('totalClawnch').textContent = total.toLocaleString();
    document.getElementById('totalUsd').textContent = '$' + usd;

    const hint = document.getElementById('amountHint');
    if (clawnchPrice > 0) {
        hint.textContent = '~$' + (amount * clawnchPrice).toFixed(4) + ' each';
    }

    document.getElementById('sendBtn').disabled = selected.length === 0 || amount <= 0;
}

// ── Send airdrop ──
const sendBtn = document.getElementById('sendBtn');
const sendStatus = document.getElementById('sendStatus');

sendBtn.addEventListener('click', async () => {
    const selected = getSelectedRecipients();
    const amount = parseInt(amountInput.value) || 0;
    if (selected.length === 0 || amount <= 0) return;

    const totalWei = toWei(amount) * BigInt(selected.length);
    const amountWei = toWei(amount);

    sendBtn.disabled = true;
    sendStatus.textContent = 'Checking balance...';
    sendStatus.className = 'airdrop-status';

    try {
        // Check CLAWNCH balance
        const balanceData = BALANCE_SELECTOR + pad32(userAddress);
        const balResult = await provider.request({
            method: 'eth_call',
            params: [{ to: CLAWNCH_ADDRESS, data: balanceData }, 'latest']
        });
        const balance = BigInt(balResult);
        if (balance < totalWei) {
            sendStatus.textContent = `Insufficient CLAWNCH. Need ${(Number(totalWei) / 1e18).toLocaleString()}, have ${(Number(balance) / 1e18).toLocaleString()}`;
            sendStatus.className = 'airdrop-status error';
            sendBtn.disabled = false;
            return;
        }

        // Check allowance
        const allowData = ALLOWANCE_SELECTOR + pad32(userAddress) + pad32(DISPERSE_ADDRESS);
        const allowResult = await provider.request({
            method: 'eth_call',
            params: [{ to: CLAWNCH_ADDRESS, data: allowData }, 'latest']
        });
        const allowance = BigInt(allowResult);

        if (allowance < totalWei) {
            sendStatus.textContent = 'Approving CLAWNCH spend...';
            const approveData = APPROVE_SELECTOR
                + pad32(DISPERSE_ADDRESS)
                + pad32(toHex(totalWei));

            const approveTx = await provider.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: userAddress,
                    to: CLAWNCH_ADDRESS,
                    data: approveData
                }]
            });

            sendStatus.textContent = 'Waiting for approval confirmation...';
            await waitForReceipt(approveTx);
        }

        // Build disperseToken call
        sendStatus.textContent = 'Sending batch transfer...';

        const recipients = selected.map(p => p.wallet_address);
        const amounts = selected.map(() => amountWei);

        const calldata = buildDisperseTokenCalldata(CLAWNCH_ADDRESS, recipients, amounts);

        const disperseTx = await provider.request({
            method: 'eth_sendTransaction',
            params: [{
                from: userAddress,
                to: DISPERSE_ADDRESS,
                data: calldata
            }]
        });

        sendStatus.textContent = 'Confirming batch transfer...';
        await waitForReceipt(disperseTx);

        sendStatus.textContent = `Sent ${amount.toLocaleString()} CLAWNCH to ${selected.length} humans!`;
        sendStatus.className = 'airdrop-status success';
        sendBtn.textContent = 'Done!';

    } catch (err) {
        console.error('Airdrop error:', err);
        sendStatus.textContent = err.message || 'Transaction failed';
        sendStatus.className = 'airdrop-status error';
        sendBtn.disabled = false;
    }
});

// ── ABI encode disperseToken(address, address[], uint256[]) ──
function buildDisperseTokenCalldata(token, recipients, amounts) {
    // Function: disperseToken(address token, address[] recipients, uint256[] values)
    // Selector: 0xc73a2d60
    const n = recipients.length;

    // Head: selector + token + offset_to_recipients + offset_to_amounts
    // offset_to_recipients: 3 * 32 = 96 = 0x60
    // offset_to_amounts: 96 + 32 + n*32
    const recipientsOffset = 3 * 32; // 96
    const amountsOffset = recipientsOffset + 32 + n * 32;

    let data = DISPERSE_TOKEN_SELECTOR;
    data += pad32(token);                               // token address
    data += pad32(toHex(recipientsOffset));              // offset to recipients array
    data += pad32(toHex(amountsOffset));                 // offset to amounts array

    // Recipients array: length + elements
    data += pad32(toHex(n));
    for (const addr of recipients) {
        data += pad32(addr);
    }

    // Amounts array: length + elements
    data += pad32(toHex(n));
    for (const amt of amounts) {
        data += pad32(toHex(amt));
    }

    return data;
}

// ── Wait for tx receipt ──
async function waitForReceipt(txHash, maxWait = 60) {
    for (let i = 0; i < maxWait; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const receipt = await provider.request({
            method: 'eth_getTransactionReceipt',
            params: [txHash]
        });
        if (receipt) {
            if (receipt.status === '0x1') return receipt;
            throw new Error('Transaction reverted');
        }
    }
    throw new Error('Transaction timed out');
}
