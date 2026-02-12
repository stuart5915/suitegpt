// Inclawbate — Admin Airdrop Controller + UBI Distribution
// Uses Disperse.app contract on Base for batch ERC-20 transfers

const CLAWNCH_ADDRESS = '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be';
const INCLAWNCH_ADDRESS = '0xB0b6e0E9da530f68D713cC03a813B506205aC808';
const DISPERSE_ADDRESS = '0xD152f549545093347A162Dce210e7293f1452150';
const BASE_CHAIN_ID = '0x2105';
const API_BASE = '/api/inclawbate';
const ADMIN_WALLET = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';

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
let distData = null; // UBI distribution data

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
function fmtNum(n) {
    return Math.round(Number(n) || 0).toLocaleString();
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

        if (userAddress.toLowerCase() !== ADMIN_WALLET) {
            walletStatus.textContent = 'Unauthorized wallet. Admin only.';
            walletStatus.className = 'airdrop-status error';
            userAddress = null;
            return;
        }

        walletStatus.textContent = 'Connected: ' + shortAddr(userAddress);
        walletStatus.className = 'airdrop-status success';
        connectBtn.textContent = shortAddr(userAddress);
        connectBtn.disabled = true;
        selectPanel.style.display = '';

        // Show UBI distribution panel
        document.getElementById('ubiDistPanel').style.display = '';

        loadProfiles();
        loadDistribution();
    } catch (err) {
        walletStatus.textContent = err.message || 'Connection failed';
        walletStatus.className = 'airdrop-status error';
    }
});

// ── Fetch profiles (paginated to get all) ──
async function loadProfiles() {
    allProfiles = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
        const resp = await fetch(API_BASE + `/humans?limit=${limit}&offset=${offset}&sort=newest`);
        const data = await resp.json();
        const batch = (data.profiles || []).filter(p => p.wallet_address);
        allProfiles.push(...batch);
        hasMore = data.hasMore || false;
        offset += limit;
    }

    // Exclude connected wallet (admin)
    allProfiles = allProfiles.filter(p =>
        p.wallet_address.toLowerCase() !== userAddress.toLowerCase()
    );

    applyFilter();
    fetchPrice();
}

// ── Price ──
function bestDexPrice(dexData, tokenAddr) {
    if (!dexData || !dexData.pairs) return 0;
    var candidates = dexData.pairs.filter(function(p) {
        return p.baseToken && p.baseToken.address &&
            p.baseToken.address.toLowerCase() === tokenAddr.toLowerCase() &&
            parseFloat(p.priceUsd) > 0;
    });
    if (candidates.length === 0) return 0;
    candidates.sort(function(a, b) {
        return (parseFloat(b.liquidity?.usd) || 0) - (parseFloat(a.liquidity?.usd) || 0);
    });
    return parseFloat(candidates[0].priceUsd) || 0;
}

async function fetchPrice() {
    try {
        const resp = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + CLAWNCH_ADDRESS);
        const data = await resp.json();
        clawnchPrice = bestDexPrice(data, CLAWNCH_ADDRESS);
    } catch (e) { /* try fallback */ }
    // CoinGecko fallback
    if (!clawnchPrice) {
        try {
            const gResp = await fetch('https://api.coingecko.com/api/v3/simple/token_price/base?contract_addresses=' + CLAWNCH_ADDRESS + '&vs_currencies=usd');
            const gData = await gResp.json();
            var key = CLAWNCH_ADDRESS.toLowerCase();
            if (gData[key] && gData[key].usd) clawnchPrice = gData[key].usd;
        } catch (e) { /* no price */ }
    }
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

        // Record hires via batch-hire API
        sendStatus.textContent = 'Recording hires...';
        try {
            const hireResp = await fetch(API_BASE + '/batch-hire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tx_hash: disperseTx,
                    agent_address: userAddress,
                    agent_name: 'inclawbate',
                    recipients: selected.map(p => ({
                        handle: p.x_handle,
                        amount: amount
                    })),
                    starting_message: (document.getElementById('startingMessage')?.value || '').trim() || undefined
                })
            });
            const hireResult = await hireResp.json();
            if (hireResult.success) {
                sendStatus.textContent = `Done! Sent ${amount.toLocaleString()} CLAWNCH to ${selected.length} humans. ${hireResult.created} hires recorded.`;
            } else {
                sendStatus.textContent = `CLAWNCH sent! But hire recording failed: ${hireResult.error || 'Unknown error'}`;
            }
        } catch (hireErr) {
            console.error('Batch hire error:', hireErr);
            sendStatus.textContent = `CLAWNCH sent to ${selected.length} humans! Hire recording failed — check console.`;
        }
        sendStatus.className = 'airdrop-status success';
        sendBtn.textContent = 'Done!';

    } catch (err) {
        console.error('Airdrop error:', err);
        sendStatus.textContent = err.message || 'Transaction failed';
        sendStatus.className = 'airdrop-status error';
        sendBtn.disabled = false;
    }
});

// ══════════════════════════════════════════════════
//  UBI DISTRIBUTION
// ══════════════════════════════════════════════════

async function loadDistribution() {
    // Fetch distribution data, prices, and wallet balances in parallel
    const balCalldata = BALANCE_SELECTOR + pad32(userAddress);
    const [ubiResp, clawnchPriceResp, inclawnchPriceResp, clawnchBalResp, inclawnchBalResp] = await Promise.all([
        fetch(API_BASE + '/ubi?distribution=true'),
        fetch('https://api.dexscreener.com/latest/dex/tokens/' + CLAWNCH_ADDRESS).catch(() => null),
        fetch('https://api.dexscreener.com/latest/dex/tokens/' + INCLAWNCH_ADDRESS).catch(() => null),
        provider.request({ method: 'eth_call', params: [{ to: CLAWNCH_ADDRESS, data: balCalldata }, 'latest'] }).catch(() => '0x0'),
        provider.request({ method: 'eth_call', params: [{ to: INCLAWNCH_ADDRESS, data: balCalldata }, 'latest'] }).catch(() => '0x0')
    ]);

    const data = await ubiResp.json();
    distData = data;

    // Parse prices (use bestDexPrice for robust pair selection)
    let inclawnchPrice = 0;
    try {
        const cpData = await clawnchPriceResp?.json();
        clawnchPrice = bestDexPrice(cpData, CLAWNCH_ADDRESS);
    } catch (e) {}
    try {
        const ipData = await inclawnchPriceResp?.json();
        inclawnchPrice = bestDexPrice(ipData, INCLAWNCH_ADDRESS);
    } catch (e) {}
    // CoinGecko fallback
    if (!clawnchPrice || !inclawnchPrice) {
        try {
            const gResp = await fetch('https://api.coingecko.com/api/v3/simple/token_price/base?contract_addresses=' + CLAWNCH_ADDRESS + ',' + INCLAWNCH_ADDRESS + '&vs_currencies=usd');
            const gData = await gResp.json();
            if (!clawnchPrice && gData[CLAWNCH_ADDRESS.toLowerCase()]?.usd) clawnchPrice = gData[CLAWNCH_ADDRESS.toLowerCase()].usd;
            if (!inclawnchPrice && gData[INCLAWNCH_ADDRESS.toLowerCase()]?.usd) inclawnchPrice = gData[INCLAWNCH_ADDRESS.toLowerCase()].usd;
        } catch (e) {}
    }

    // Parse balances
    const walletClawnch = Number(BigInt(clawnchBalResp || '0x0')) / 1e18;
    const walletInclawnch = Number(BigInt(inclawnchBalResp || '0x0')) / 1e18;
    const walletUsd = (walletClawnch * clawnchPrice) + (walletInclawnch * inclawnchPrice);

    // Update wallet stats
    document.getElementById('distWalletClawnch').textContent = fmtNum(walletClawnch);
    document.getElementById('distWalletInclawnch').textContent = fmtNum(walletInclawnch);
    document.getElementById('distClawnchPrice').textContent = clawnchPrice > 0 ? '$' + clawnchPrice.toFixed(6) : '--';
    document.getElementById('distWalletUsd').textContent = walletUsd > 0 ? '$' + walletUsd.toFixed(2) : '--';

    const dist = data.distribution || {};
    const stakers = dist.stakers || [];
    const pendingUnstakes = dist.pending_unstakes || [];
    const weeklyRate = dist.weekly_rate || 0;
    const totalWeighted = dist.total_weighted_days || 0;

    // Update stats
    document.getElementById('distWeeklyRate').textContent = fmtNum(weeklyRate);
    document.getElementById('distTotalWeighted').textContent = fmtNum(totalWeighted);
    document.getElementById('distActiveStakers').textContent = stakers.length;

    // APY
    const clawnchStaked = Number(data.total_balance) || 0;
    const inclawnchStaked = Number(data.inclawnch_staked) || 0;
    const totalWeightedStake = clawnchStaked + (inclawnchStaked * 2);
    if (totalWeightedStake > 0 && weeklyRate > 0) {
        const apy = ((weeklyRate * 52) / totalWeightedStake * 100).toFixed(1);
        document.getElementById('distEffectiveApy').textContent = apy + '%';
    }

    // Set input to current weekly rate
    document.getElementById('weeklyRateInput').value = weeklyRate || '';

    // Render staker table
    const tbody = document.getElementById('stakerTableBody');
    if (stakers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: var(--text-dim); padding: var(--space-lg);">No active stakers</td></tr>';
    } else {
        tbody.innerHTML = stakers.map(s => {
            const name = s.x_name || s.x_handle || shortAddr(s.wallet);
            const tokenLabel = s.token === 'inclawnch' ? 'inCLAWNCH' : 'CLAWNCH';
            const barWidth = Math.max(4, Math.min(80, s.share_pct * 0.8));
            return `<tr>
                <td><strong>${escHtml(name)}</strong><br><span class="mono">${shortAddr(s.wallet)}</span></td>
                <td>${tokenLabel}</td>
                <td class="mono">${fmtNum(s.amount)}</td>
                <td class="mono">${s.staked_days}d</td>
                <td class="mono">${fmtNum(s.weighted_days)}</td>
                <td><span class="share-bar" style="width:${barWidth}px"></span>${s.share_pct}%</td>
                <td class="mono" style="color: var(--seafoam-300); font-weight:600;">${fmtNum(s.share_amount)}</td>
            </tr>`;
        }).join('');
    }

    // Render pending unstakes
    const unstakeTbody = document.getElementById('unstakeTableBody');
    if (pendingUnstakes.length === 0) {
        unstakeTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--text-dim); padding: var(--space-lg);">No pending unstakes</td></tr>';
    } else {
        // Aggregate by wallet+token
        const unstakeMap = {};
        for (const u of pendingUnstakes) {
            const key = u.wallet_address + '_' + u.token;
            if (!unstakeMap[key]) {
                unstakeMap[key] = { ...u, total: 0 };
            }
            unstakeMap[key].total += u.clawnch_amount;
        }
        const aggregated = Object.values(unstakeMap);

        unstakeTbody.innerHTML = aggregated.map(u => {
            const name = u.x_name || u.x_handle || shortAddr(u.wallet_address);
            const tokenLabel = u.token === 'inclawnch' ? 'inCLAWNCH' : 'CLAWNCH';
            const when = new Date(u.unstaked_at).toLocaleDateString();
            return `<tr>
                <td><strong>${escHtml(name)}</strong><br><span class="mono">${shortAddr(u.wallet_address)}</span></td>
                <td>${tokenLabel}</td>
                <td class="mono">${fmtNum(u.total)}</td>
                <td class="mono">${when}</td>
            </tr>`;
        }).join('');
    }

    // Enable buttons
    document.getElementById('airdropUbiBtn').disabled = stakers.length === 0 || weeklyRate <= 0;
    document.getElementById('returnUnstakedBtn').disabled = pendingUnstakes.length === 0;
}

// Set weekly rate
document.getElementById('setRateBtn').addEventListener('click', async () => {
    const rateInput = document.getElementById('weeklyRateInput');
    const rateStatus = document.getElementById('rateStatus');
    const rate = Number(rateInput.value);

    if (isNaN(rate) || rate < 0) {
        rateStatus.textContent = 'Enter a valid number';
        rateStatus.className = 'airdrop-status error';
        return;
    }

    rateStatus.textContent = 'Saving...';
    rateStatus.className = 'airdrop-status';

    try {
        const resp = await fetch(API_BASE + '/ubi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update-config',
                wallet_address: userAddress,
                weekly_rate: rate
            })
        });
        const data = await resp.json();
        if (resp.ok && data.success) {
            rateStatus.textContent = 'Weekly rate set to ' + fmtNum(rate) + ' CLAWNCH';
            rateStatus.className = 'airdrop-status success';
            loadDistribution();
        } else {
            rateStatus.textContent = data.error || 'Failed';
            rateStatus.className = 'airdrop-status error';
        }
    } catch (err) {
        rateStatus.textContent = err.message || 'Failed';
        rateStatus.className = 'airdrop-status error';
    }
});

// Refresh distribution
document.getElementById('refreshDistBtn').addEventListener('click', () => {
    loadDistribution();
});

// Airdrop UBI via Disperse
document.getElementById('airdropUbiBtn').addEventListener('click', async () => {
    if (!distData?.distribution?.stakers?.length) return;

    const stakers = distData.distribution.stakers.filter(s => s.share_amount > 0);
    if (stakers.length === 0) return;

    const distStatus = document.getElementById('distStatus');
    const btn = document.getElementById('airdropUbiBtn');
    btn.disabled = true;
    distStatus.textContent = 'Preparing UBI airdrop...';
    distStatus.className = 'airdrop-status';

    try {
        const recipients = stakers.map(s => s.wallet);
        const amounts = stakers.map(s => toWei(Math.floor(s.share_amount)));
        const totalWei = amounts.reduce((sum, a) => sum + a, 0n);

        // Check balance
        const balanceData = BALANCE_SELECTOR + pad32(userAddress);
        const balResult = await provider.request({
            method: 'eth_call',
            params: [{ to: CLAWNCH_ADDRESS, data: balanceData }, 'latest']
        });
        const balance = BigInt(balResult);
        if (balance < totalWei) {
            distStatus.textContent = `Insufficient CLAWNCH. Need ${(Number(totalWei) / 1e18).toLocaleString()}, have ${(Number(balance) / 1e18).toLocaleString()}`;
            distStatus.className = 'airdrop-status error';
            btn.disabled = false;
            return;
        }

        // Check allowance
        distStatus.textContent = 'Checking allowance...';
        const allowData = ALLOWANCE_SELECTOR + pad32(userAddress) + pad32(DISPERSE_ADDRESS);
        const allowResult = await provider.request({
            method: 'eth_call',
            params: [{ to: CLAWNCH_ADDRESS, data: allowData }, 'latest']
        });
        const allowance = BigInt(allowResult);

        if (allowance < totalWei) {
            distStatus.textContent = 'Approving CLAWNCH spend...';
            const approveData = APPROVE_SELECTOR + pad32(DISPERSE_ADDRESS) + pad32(toHex(totalWei));
            const approveTx = await provider.request({
                method: 'eth_sendTransaction',
                params: [{ from: userAddress, to: CLAWNCH_ADDRESS, data: approveData }]
            });
            distStatus.textContent = 'Waiting for approval...';
            await waitForReceipt(approveTx);
        }

        // Disperse
        distStatus.textContent = `Sending UBI to ${stakers.length} stakers...`;
        const calldata = buildDisperseTokenCalldata(CLAWNCH_ADDRESS, recipients, amounts);
        const disperseTx = await provider.request({
            method: 'eth_sendTransaction',
            params: [{ from: userAddress, to: DISPERSE_ADDRESS, data: calldata }]
        });

        distStatus.textContent = 'Confirming...';
        await waitForReceipt(disperseTx);

        distStatus.textContent = `UBI distributed to ${stakers.length} stakers!`;
        distStatus.className = 'airdrop-status success';
    } catch (err) {
        console.error('UBI airdrop error:', err);
        distStatus.textContent = err.message || 'Airdrop failed';
        distStatus.className = 'airdrop-status error';
        btn.disabled = false;
    }
});

// Return unstaked tokens via Disperse
document.getElementById('returnUnstakedBtn').addEventListener('click', async () => {
    if (!distData?.distribution?.pending_unstakes?.length) return;

    const distStatus = document.getElementById('distStatus');
    const btn = document.getElementById('returnUnstakedBtn');
    btn.disabled = true;

    // Aggregate unstakes by wallet+token
    const unstakeMap = {};
    for (const u of distData.distribution.pending_unstakes) {
        const key = u.wallet_address + '_' + u.token;
        if (!unstakeMap[key]) {
            unstakeMap[key] = { wallet: u.wallet_address, token: u.token, total: 0 };
        }
        unstakeMap[key].total += u.clawnch_amount;
    }
    const aggregated = Object.values(unstakeMap);

    // Separate by token (CLAWNCH and inCLAWNCH need separate Disperse calls)
    const clawnchReturns = aggregated.filter(a => a.token === 'clawnch');
    const inclawnchReturns = aggregated.filter(a => a.token === 'inclawnch');

    try {
        // Return CLAWNCH tokens
        if (clawnchReturns.length > 0) {
            distStatus.textContent = 'Returning CLAWNCH to ' + clawnchReturns.length + ' wallets...';
            distStatus.className = 'airdrop-status';
            await disperseReturn(CLAWNCH_ADDRESS, clawnchReturns, distStatus);
        }

        // Return inCLAWNCH tokens
        if (inclawnchReturns.length > 0) {
            distStatus.textContent = 'Returning inCLAWNCH to ' + inclawnchReturns.length + ' wallets...';
            distStatus.className = 'airdrop-status';
            await disperseReturn(INCLAWNCH_ADDRESS, inclawnchReturns, distStatus);
        }

        distStatus.textContent = 'All unstaked tokens returned!';
        distStatus.className = 'airdrop-status success';
    } catch (err) {
        console.error('Return unstaked error:', err);
        distStatus.textContent = err.message || 'Return failed';
        distStatus.className = 'airdrop-status error';
        btn.disabled = false;
    }
});

async function disperseReturn(tokenAddress, returns, statusEl) {
    const recipients = returns.map(r => r.wallet);
    const amounts = returns.map(r => toWei(Math.floor(r.total)));
    const totalWei = amounts.reduce((sum, a) => sum + a, 0n);

    // Check balance
    const balanceData = BALANCE_SELECTOR + pad32(userAddress);
    const balResult = await provider.request({
        method: 'eth_call',
        params: [{ to: tokenAddress, data: balanceData }, 'latest']
    });
    const balance = BigInt(balResult);
    if (balance < totalWei) {
        throw new Error(`Insufficient token balance. Need ${(Number(totalWei) / 1e18).toLocaleString()}, have ${(Number(balance) / 1e18).toLocaleString()}`);
    }

    // Check allowance
    const allowData = ALLOWANCE_SELECTOR + pad32(userAddress) + pad32(DISPERSE_ADDRESS);
    const allowResult = await provider.request({
        method: 'eth_call',
        params: [{ to: tokenAddress, data: allowData }, 'latest']
    });
    const allowance = BigInt(allowResult);

    if (allowance < totalWei) {
        statusEl.textContent = 'Approving token spend...';
        const approveData = APPROVE_SELECTOR + pad32(DISPERSE_ADDRESS) + pad32(toHex(totalWei));
        const approveTx = await provider.request({
            method: 'eth_sendTransaction',
            params: [{ from: userAddress, to: tokenAddress, data: approveData }]
        });
        await waitForReceipt(approveTx);
    }

    statusEl.textContent = `Sending to ${recipients.length} wallets...`;
    const calldata = buildDisperseTokenCalldata(tokenAddress, recipients, amounts);
    const disperseTx = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: userAddress, to: DISPERSE_ADDRESS, data: calldata }]
    });

    statusEl.textContent = 'Confirming...';
    await waitForReceipt(disperseTx);
}

// ── ABI encode disperseToken(address, address[], uint256[]) ──
function buildDisperseTokenCalldata(token, recipients, amounts) {
    const n = recipients.length;

    const recipientsOffset = 3 * 32; // 96
    const amountsOffset = recipientsOffset + 32 + n * 32;

    let data = DISPERSE_TOKEN_SELECTOR;
    data += pad32(token);
    data += pad32(toHex(recipientsOffset));
    data += pad32(toHex(amountsOffset));

    // Recipients array
    data += pad32(toHex(n));
    for (const addr of recipients) {
        data += pad32(addr);
    }

    // Amounts array
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
