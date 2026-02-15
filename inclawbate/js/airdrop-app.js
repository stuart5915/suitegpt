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
let showBanned = false;
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
function timeSinceStr(dateStr) {
    const ms = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ' + (mins % 60) + 'm ago';
    const days = Math.floor(hrs / 24);
    return days + 'd ' + (hrs % 24) + 'h ago';
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

        // Show UBI distribution panel and philanthropy panel
        document.getElementById('ubiDistPanel').style.display = '';
        document.getElementById('philPanel').style.display = '';

        // Enable bulk welcome button
        document.getElementById('bulkWelcomeBtn').disabled = false;

        loadProfiles();
        loadDistribution();
        loadPhilanthropy();
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
        const bannedParam = showBanned ? '&include_banned=true' : '';
        const resp = await fetch(API_BASE + `/humans?limit=${limit}&offset=${offset}&sort=newest${bannedParam}`);
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

// ── Ban/unban ──
async function toggleBan(xHandle, ban) {
    try {
        const resp = await fetch(API_BASE + '/humans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'ban',
                wallet_address: userAddress,
                x_handle: xHandle,
                banned: ban
            })
        });
        const data = await resp.json();
        if (data.success) {
            loadProfiles();
        } else {
            alert('Ban failed: ' + (data.error || 'Unknown error'));
        }
    } catch (err) {
        alert('Ban failed: ' + err.message);
    }
}

// ── Render recipient list ──
function renderList(profiles) {
    const list = document.getElementById('recipientList');
    if (profiles.length === 0) {
        list.innerHTML = '<div style="padding: var(--space-xl); text-align: center; color: var(--text-dim);">No matching profiles</div>';
        return;
    }

    const bannedToggle = `<div class="select-all-row" style="justify-content: space-between;">
        <div>
            <input type="checkbox" id="selectAll" checked>
            <label for="selectAll">Select all (${profiles.length})</label>
        </div>
        <label style="cursor:pointer; font-size:0.85em; color: var(--text-dim);">
            <input type="checkbox" id="showBannedToggle" ${showBanned ? 'checked' : ''}> Show Banned
        </label>
    </div>`;

    const rows = profiles.map((p, i) => {
        const name = p.x_name || p.x_handle;
        const avatar = p.x_avatar_url
            ? `<img class="recipient-avatar" src="${p.x_avatar_url}" onerror="this.style.display='none'">`
            : '';
        const isBanned = p.airdrop_banned;
        const banBtn = isBanned
            ? `<button class="ban-btn unbanned" data-handle="${escHtml(p.x_handle)}" data-ban="false" title="Unban">Unban</button>`
            : `<button class="ban-btn" data-handle="${escHtml(p.x_handle)}" data-ban="true" title="Ban from airdrops">Ban</button>`;
        const bannedStyle = isBanned ? ' style="opacity:0.5;"' : '';
        return `<div class="recipient-row"${bannedStyle}>
            <input type="checkbox" class="recipient-check" data-index="${i}" ${isBanned ? '' : 'checked'}>
            ${avatar}
            <span class="recipient-name">${escHtml(name)}</span>
            <span class="recipient-handle">@${escHtml(p.x_handle)}</span>
            <span class="recipient-wallet">${shortAddr(p.wallet_address)}</span>
            ${banBtn}
        </div>`;
    }).join('');

    list.innerHTML = bannedToggle + rows;

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

    // Show banned toggle
    document.getElementById('showBannedToggle').addEventListener('change', (e) => {
        showBanned = e.target.checked;
        loadProfiles();
    });

    // Ban/unban buttons
    list.querySelectorAll('.ban-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const handle = btn.dataset.handle;
            const ban = btn.dataset.ban === 'true';
            const action = ban ? 'ban' : 'unban';
            if (confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} @${handle} from airdrops?`)) {
                toggleBan(handle, ban);
            }
        });
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

let distTimerInterval = null;

function updateDistTimer(lastDistAt, distCount) {
    const timerEl = document.getElementById('distTimer');
    const countdownEl = document.getElementById('distCountdown');
    const labelEl = document.getElementById('distTimerLabel');
    if (!timerEl) return;

    timerEl.style.display = 'block';

    // Clear previous interval
    if (distTimerInterval) clearInterval(distTimerInterval);

    if (!lastDistAt) {
        // Never distributed yet
        countdownEl.textContent = 'No distributions yet';
        countdownEl.className = 'ubi-dist-timer-countdown overdue';
        labelEl.textContent = 'Send your first daily UBI distribution below';
        return;
    }

    // Next distribution = next 6am EST (11am UTC)
    const now = new Date();
    const nextDist6am = new Date(now);
    nextDist6am.setUTCHours(11, 0, 0, 0);
    if (now >= nextDist6am) nextDist6am.setUTCDate(nextDist6am.getUTCDate() + 1);
    const nextDist = nextDist6am.getTime();

    function tick() {
        const now = Date.now();
        const diff = nextDist - now;

        if (diff <= 0) {
            // Overdue!
            const overdue = Math.abs(diff);
            const hrs = Math.floor(overdue / 3600000);
            const mins = Math.floor((overdue % 3600000) / 60000);
            countdownEl.textContent = 'OVERDUE by ' + (hrs > 0 ? hrs + 'h ' : '') + mins + 'm';
            countdownEl.className = 'ubi-dist-timer-countdown overdue';
            labelEl.textContent = 'Distribution #' + ((distCount || 0) + 1) + ' is ready · Last: ' + timeSinceStr(lastDistAt);
        } else {
            const days = Math.floor(diff / 86400000);
            const hrs = Math.floor((diff % 86400000) / 3600000);
            const mins = Math.floor((diff % 3600000) / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            countdownEl.textContent = (days > 0 ? days + 'd ' : '') + hrs + 'h ' + mins + 'm ' + secs + 's';
            countdownEl.className = 'ubi-dist-timer-countdown ok';
            labelEl.textContent = 'Next distribution (#' + ((distCount || 0) + 1) + ') · Last: ' + timeSinceStr(lastDistAt);
        }
    }

    tick();
    distTimerInterval = setInterval(tick, 1000);
}

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
    const dailyRate = weeklyRate / 7;
    const totalWeighted = dist.total_weighted_days || 0;

    // Update stats
    document.getElementById('distDailyRate').textContent = fmtNum(Math.round(dailyRate));
    document.getElementById('distTotalWeighted').textContent = fmtNum(totalWeighted);
    document.getElementById('distActiveStakers').textContent = stakers.length;

    // Total distributed banner
    const totalDistributed = Number(data.total_distributed) || 0;
    document.getElementById('distTotalDistributed').textContent = fmtNum(totalDistributed);
    document.getElementById('distDistCount').textContent = data.distribution_count || 0;
    if (clawnchPrice > 0 && totalDistributed > 0) {
        document.getElementById('distTotalDistUsd').textContent = '$' + (totalDistributed * clawnchPrice).toFixed(2);
    }

    // Distribution countdown timer
    updateDistTimer(data.last_distribution_at, data.distribution_count);

    // APY
    const clawnchStaked = Number(data.total_balance) || 0;
    const inclawnchStaked = Number(data.inclawnch_staked) || 0;
    const totalWeightedStake = clawnchStaked + (inclawnchStaked * 2);
    if (totalWeightedStake > 0 && dailyRate > 0) {
        const apy = ((dailyRate * 365) / totalWeightedStake * 100).toFixed(1);
        document.getElementById('distEffectiveApy').textContent = apy + '%';
    }

    // Set inputs to current config
    document.getElementById('dailyRateInput').value = Math.round(dailyRate) || '';
    document.getElementById('splitPctInput').value = Number(data.reward_split_pct) || 80;

    // Build org name lookup from philanthropy_orgs
    const orgMap = {};
    (data.philanthropy_orgs || []).forEach(o => { orgMap[o.id] = o.name; });

    // Render staker table
    const tbody = document.getElementById('stakerTableBody');
    if (stakers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color: var(--text-dim); padding: var(--space-lg);">No active stakers</td></tr>';
    } else {
        tbody.innerHTML = stakers.map(s => {
            const name = s.x_name || s.x_handle || shortAddr(s.wallet);
            const tokenLabel = s.token === 'inclawnch' ? 'inCLAWNCH' : 'CLAWNCH';
            const barWidth = Math.max(4, Math.min(80, s.share_pct * 0.8));
            const autoBadge = s.auto_stake ? '<span class="ubi-autostake-badge">auto</span>' : '';
            let allocHtml = '';
            if (s.auto_stake) {
                allocHtml = '<span class="alloc-auto">auto-stake</span>';
            } else if (s.redirect_target === 'philanthropy') {
                const orgName = s.redirect_org_id && orgMap[s.redirect_org_id] ? orgMap[s.redirect_org_id] : 'Kingdom';
                allocHtml = `<span class="alloc-kingdom">&rarr; ${escHtml(orgName)}</span>`;
            } else if (s.redirect_target === 'reinvest') {
                allocHtml = '<span class="alloc-reinvest">&rarr; reinvest</span>';
            } else if (s.redirect_target === 'split') {
                const k = s.split_keep_pct || 0;
                const g = s.split_kingdom_pct || 0;
                const r = s.split_reinvest_pct || 0;
                allocHtml = `<span class="alloc-keep">${k}%</span> / <span class="alloc-kingdom">${g}%</span> / <span class="alloc-reinvest">${r}%</span>`;
            } else {
                allocHtml = '<span class="alloc-keep">keep</span>';
            }
            const shareDisplay = `<span class="share-bar" style="width:${barWidth}px"></span>${s.share_pct}%`;
            return `<tr>
                <td><strong>${escHtml(name)}</strong>${autoBadge}<br><span class="mono">${shortAddr(s.wallet)}</span></td>
                <td>${tokenLabel}</td>
                <td class="mono">${fmtNum(s.amount)}</td>
                <td class="mono">${s.staked_days}d</td>
                <td class="mono">${fmtNum(s.weighted_days)}</td>
                <td>${shareDisplay}</td>
                <td class="alloc-cell">${allocHtml}</td>
                <td class="mono" style="color: var(--seafoam-300); font-weight:600;">${fmtNum(s.share_amount)}</td>
            </tr>`;
        }).join('');
    }

    // Show auto-stake vs manual vs philanthropy split summary
    const splitSummary = document.getElementById('distSplitSummary');
    if (splitSummary && stakers.length > 0) {
        const manualStakers = stakers.filter(s => !s.auto_stake && !s.redirect_target && s.share_amount > 0);
        const autoStakers = stakers.filter(s => s.auto_stake && s.share_amount > 0);
        const philStakers = stakers.filter(s => s.redirect_target === 'philanthropy' && s.share_amount > 0);
        const reinvestStakers = stakers.filter(s => s.redirect_target === 'reinvest' && s.share_amount > 0);
        const splitStakers = stakers.filter(s => s.redirect_target === 'split' && s.share_amount > 0);
        const manualTotal = manualStakers.reduce((sum, s) => sum + Math.floor(s.share_amount), 0);
        const autoTotal = autoStakers.reduce((sum, s) => sum + Math.floor(s.share_amount), 0);
        const philTotal = philStakers.reduce((sum, s) => sum + Math.floor(s.share_amount), 0);
        const reinvestTotal = reinvestStakers.reduce((sum, s) => sum + Math.floor(s.share_amount), 0);
        // Split stakers: calculate kingdom + reinvest portions
        let splitKingdomTotal = 0, splitReinvestTotal = 0, splitKeepTotal = 0;
        splitStakers.forEach(s => {
            const amt = Math.floor(s.share_amount);
            splitKeepTotal += Math.round(amt * ((s.split_keep_pct || 0) / 100));
            splitKingdomTotal += Math.round(amt * ((s.split_kingdom_pct || 0) / 100));
            splitReinvestTotal += Math.round(amt * ((s.split_reinvest_pct || 0) / 100));
        });

        const hasExtra = autoStakers.length > 0 || philStakers.length > 0 || reinvestStakers.length > 0 || splitStakers.length > 0;
        if (hasExtra) {
            splitSummary.style.display = '';
            let summaryHtml = `
                <div class="split-group">
                    <span class="split-group-count">${manualStakers.length}</span> manual
                    <span class="split-group-amount">${fmtNum(manualTotal)} CLAWNCH via Disperse</span>
                </div>`;
            if (autoStakers.length > 0) {
                summaryHtml += `
                <div class="split-group">
                    <span class="split-group-count">${autoStakers.length}</span> auto-stake
                    <span class="split-group-amount">${fmtNum(autoTotal)} CLAWNCH compounded</span>
                </div>`;
            }
            if (philStakers.length > 0) {
                summaryHtml += `
                <div class="split-group">
                    <span class="split-group-count">${philStakers.length}</span> giving back
                    <span class="split-group-amount">${fmtNum(philTotal)} CLAWNCH to philanthropy</span>
                </div>`;
            }
            if (reinvestStakers.length > 0) {
                summaryHtml += `
                <div class="split-group">
                    <span class="split-group-count">${reinvestStakers.length}</span> reinvesting
                    <span class="split-group-amount">${fmtNum(reinvestTotal)} CLAWNCH back to pool</span>
                </div>`;
            }
            if (splitStakers.length > 0) {
                summaryHtml += `
                <div class="split-group">
                    <span class="split-group-count">${splitStakers.length}</span> splitting
                    <span class="split-group-amount">${fmtNum(splitKeepTotal)} keep · ${fmtNum(splitKingdomTotal)} kingdom · ${fmtNum(splitReinvestTotal)} reinvest</span>
                </div>`;
            }
            splitSummary.innerHTML = summaryHtml;
        } else {
            splitSummary.style.display = 'none';
        }
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
    document.getElementById('retryUnstakeBtn').disabled = pendingUnstakes.length === 0;
}

// Set daily rate
document.getElementById('setRateBtn').addEventListener('click', async () => {
    const rateInput = document.getElementById('dailyRateInput');
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
                daily_rate: rate
            })
        });
        const data = await resp.json();
        if (resp.ok && data.success) {
            rateStatus.textContent = 'Daily rate set to ' + fmtNum(rate) + ' CLAWNCH';
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

// Set split percentage
document.getElementById('setSplitBtn').addEventListener('click', async () => {
    const splitInput = document.getElementById('splitPctInput');
    const splitStatus = document.getElementById('splitStatus');
    const pct = Number(splitInput.value);

    if (isNaN(pct) || pct < 0 || pct > 100) {
        splitStatus.textContent = 'Enter 0-100';
        splitStatus.className = 'airdrop-status error';
        return;
    }

    splitStatus.textContent = 'Saving...';
    splitStatus.className = 'airdrop-status';

    try {
        const resp = await fetch(API_BASE + '/ubi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update-config',
                wallet_address: userAddress,
                reward_split_pct: pct
            })
        });
        const data = await resp.json();
        if (resp.ok && data.success) {
            splitStatus.textContent = 'Split set: ' + pct + '% rewards / ' + (100 - pct) + '% LP';
            splitStatus.className = 'airdrop-status success';
            loadDistribution();
        } else {
            splitStatus.textContent = data.error || 'Failed';
            splitStatus.className = 'airdrop-status error';
        }
    } catch (err) {
        splitStatus.textContent = err.message || 'Failed';
        splitStatus.className = 'airdrop-status error';
    }
});

// Per-wallet cap removed — cap is set to 100% (disabled)

// Refresh distribution
document.getElementById('refreshDistBtn').addEventListener('click', () => {
    loadDistribution();
});

// Airdrop UBI via Disperse (with auto-stake split)
document.getElementById('airdropUbiBtn').addEventListener('click', async () => {
    if (!distData?.distribution?.stakers?.length) return;

    const allStakers = distData.distribution.stakers.filter(s => s.share_amount > 0);
    if (allStakers.length === 0) return;

    // Split into manual and auto-stake groups
    const manualStakers = allStakers.filter(s => !s.auto_stake);
    const autoStakers = allStakers.filter(s => s.auto_stake);

    const distStatus = document.getElementById('distStatus');
    const btn = document.getElementById('airdropUbiBtn');
    btn.disabled = true;
    distStatus.textContent = 'Preparing UBI airdrop...';
    distStatus.className = 'airdrop-status';

    try {
        // Look up philanthropy org wallets for Kingdom routing
        const orgWalletMap = {};
        (distData.philanthropy_orgs || []).forEach(o => {
            if (o.wallet_address) orgWalletMap[o.id] = o.wallet_address.toLowerCase();
        });
        const defaultOrgWallet = Object.values(orgWalletMap)[0] || null;

        // Build Disperse recipients with split routing
        // Each manual staker's share gets split according to their preferences:
        //   Keep portion    → staker's wallet
        //   Kingdom portion → E3 Ministry wallet
        //   Reinvest portion → stays in treasury (not sent)
        const disperseMap = {}; // wallet → accumulated amount
        let reinvestTotal = 0;
        let kingdomTotal = 0;
        let keepTotal = 0;

        for (const s of manualStakers) {
            const amt = Math.floor(s.share_amount);
            if (amt <= 0) continue;

            if (s.redirect_target === 'split') {
                const kPct = s.split_keep_pct ?? 100;
                const gPct = s.split_kingdom_pct ?? 0;
                const rPct = s.split_reinvest_pct ?? 0;
                const keepAmt = Math.round(amt * kPct / 100);
                const kingdomAmt = Math.round(amt * gPct / 100);
                const reinvestAmt = amt - keepAmt - kingdomAmt;

                if (keepAmt > 0) {
                    disperseMap[s.wallet] = (disperseMap[s.wallet] || 0) + keepAmt;
                    keepTotal += keepAmt;
                }
                if (kingdomAmt > 0 && defaultOrgWallet) {
                    disperseMap[defaultOrgWallet] = (disperseMap[defaultOrgWallet] || 0) + kingdomAmt;
                    kingdomTotal += kingdomAmt;
                }
                reinvestTotal += reinvestAmt;
            } else if (s.redirect_target === 'philanthropy') {
                const orgWallet = (s.redirect_org_id && orgWalletMap[s.redirect_org_id]) || defaultOrgWallet;
                if (orgWallet) {
                    disperseMap[orgWallet] = (disperseMap[orgWallet] || 0) + amt;
                    kingdomTotal += amt;
                }
            } else if (s.redirect_target === 'reinvest') {
                reinvestTotal += amt;
            } else {
                // Default: send full amount to staker (Keep)
                disperseMap[s.wallet] = (disperseMap[s.wallet] || 0) + amt;
                keepTotal += amt;
            }
        }

        const disperseEntries = Object.entries(disperseMap).filter(([, amt]) => amt > 0);

        if (disperseEntries.length > 0) {
            const recipients = disperseEntries.map(([addr]) => addr);
            const amounts = disperseEntries.map(([, amt]) => toWei(amt));
            const totalWei = amounts.reduce((sum, a) => sum + a, 0n);

            // Check inCLAWNCH balance
            const balanceData = BALANCE_SELECTOR + pad32(userAddress);
            const balResult = await provider.request({
                method: 'eth_call',
                params: [{ to: INCLAWNCH_ADDRESS, data: balanceData }, 'latest']
            });
            const balance = BigInt(balResult);
            if (balance < totalWei) {
                distStatus.textContent = `Insufficient inCLAWNCH. Need ${(Number(totalWei) / 1e18).toLocaleString()}, have ${(Number(balance) / 1e18).toLocaleString()}`;
                distStatus.className = 'airdrop-status error';
                btn.disabled = false;
                return;
            }

            // Check allowance
            distStatus.textContent = 'Checking allowance...';
            const allowData = ALLOWANCE_SELECTOR + pad32(userAddress) + pad32(DISPERSE_ADDRESS);
            const allowResult = await provider.request({
                method: 'eth_call',
                params: [{ to: INCLAWNCH_ADDRESS, data: allowData }, 'latest']
            });
            const allowance = BigInt(allowResult);

            if (allowance < totalWei) {
                distStatus.textContent = 'Approving inCLAWNCH spend...';
                const approveData = APPROVE_SELECTOR + pad32(DISPERSE_ADDRESS) + pad32(toHex(totalWei));
                const approveTx = await provider.request({
                    method: 'eth_sendTransaction',
                    params: [{ from: userAddress, to: INCLAWNCH_ADDRESS, data: approveData }]
                });
                distStatus.textContent = 'Waiting for approval...';
                await waitForReceipt(approveTx);
            }

            // Disperse inCLAWNCH
            distStatus.textContent = `Sending UBI (inCLAWNCH) to ${recipients.length} addresses...`;
            const calldata = buildDisperseTokenCalldata(INCLAWNCH_ADDRESS, recipients, amounts);
            const disperseTx = await provider.request({
                method: 'eth_sendTransaction',
                params: [{ from: userAddress, to: DISPERSE_ADDRESS, data: calldata }]
            });

            distStatus.textContent = 'Confirming...';
            await waitForReceipt(disperseTx);
        }

        // Record auto-stakes in DB
        if (autoStakers.length > 0) {
            distStatus.textContent = `Recording ${autoStakers.length} auto-stakes...`;
            try {
                await fetch(API_BASE + '/ubi', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'record-auto-stakes',
                        wallet_address: userAddress,
                        distribution_count: distData.distribution_count || 0,
                        recipients: autoStakers.map(s => ({
                            wallet: s.wallet,
                            amount: Math.floor(s.share_amount),
                            token: 'inclawnch'
                        }))
                    })
                });
            } catch (e) {
                console.error('Auto-stake recording error:', e);
            }
        }

        // Mark distribution complete for ALL recipients (both groups)
        distStatus.textContent = 'Recording distribution...';
        try {
            await fetch(API_BASE + '/ubi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'mark-distributed',
                    wallet_address: userAddress,
                    recipients: allStakers.map(s => ({ wallet: s.wallet, amount: Math.floor(s.share_amount) }))
                })
            });
        } catch (e) { /* non-critical */ }

        // Build status message
        const autoTotal = autoStakers.reduce((sum, s) => sum + Math.floor(s.share_amount), 0);
        let parts = [];
        if (keepTotal > 0) parts.push(`${fmtNum(keepTotal)} inCLAWNCH kept`);
        if (kingdomTotal > 0) parts.push(`${fmtNum(kingdomTotal)} inCLAWNCH to Kingdom`);
        if (reinvestTotal > 0) parts.push(`${fmtNum(reinvestTotal)} inCLAWNCH reinvested`);
        if (autoTotal > 0) parts.push(`${fmtNum(autoTotal)} inCLAWNCH auto-staked`);
        const statusMsg = 'UBI distributed! ' + parts.join(' · ');

        distStatus.textContent = statusMsg;
        distStatus.className = 'airdrop-status success';

        // Show completion banner
        const banner = document.getElementById('distCompleteBanner');
        const bannerMsg = document.getElementById('distCompleteBannerMsg');
        if (banner) {
            bannerMsg.textContent = parts.join(' · ');
            banner.classList.add('show');
            setTimeout(() => banner.classList.remove('show'), 60000);
        }

        // Refresh to update timer
        loadDistribution();
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
        // Return CLAWNCH tokens and mark as returned immediately
        if (clawnchReturns.length > 0) {
            distStatus.textContent = 'Returning CLAWNCH to ' + clawnchReturns.length + ' wallets...';
            distStatus.className = 'airdrop-status';
            const clawnchTx = await disperseReturn(CLAWNCH_ADDRESS, clawnchReturns, distStatus);
            // Mark CLAWNCH returns as completed right away (prevents double-send if next step fails)
            try {
                await fetch(API_BASE + '/ubi', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'mark-returned',
                        wallet_address: userAddress,
                        returns: clawnchReturns.map(a => ({ wallet: a.wallet, token: a.token })),
                        tx_hash: clawnchTx
                    })
                });
            } catch (e) { console.error('mark-returned CLAWNCH error:', e); }
        }

        // Return inCLAWNCH tokens and mark as returned immediately
        if (inclawnchReturns.length > 0) {
            distStatus.textContent = 'Returning inCLAWNCH to ' + inclawnchReturns.length + ' wallets...';
            distStatus.className = 'airdrop-status';
            const inclawnchTx = await disperseReturn(INCLAWNCH_ADDRESS, inclawnchReturns, distStatus);
            // Mark inCLAWNCH returns as completed right away
            try {
                await fetch(API_BASE + '/ubi', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'mark-returned',
                        wallet_address: userAddress,
                        returns: inclawnchReturns.map(a => ({ wallet: a.wallet, token: a.token })),
                        tx_hash: inclawnchTx
                    })
                });
            } catch (e) { console.error('mark-returned inCLAWNCH error:', e); }
        }

        distStatus.textContent = 'All unstaked tokens returned!';
        distStatus.className = 'airdrop-status success';

        // Refresh to clear returned items from list
        loadDistribution();
    } catch (err) {
        console.error('Return unstaked error:', err);
        distStatus.textContent = err.message || 'Return failed — already-sent returns were recorded. Refresh and retry remaining.';
        distStatus.className = 'airdrop-status error';
        btn.disabled = false;
    }
});

// Mark pending unstakes as returned (manual send — no on-chain Disperse)
document.getElementById('retryUnstakeBtn').addEventListener('click', async () => {
    if (!distData?.distribution?.pending_unstakes?.length) return;

    const distStatus = document.getElementById('distStatus');
    const btn = document.getElementById('retryUnstakeBtn');
    const txHash = document.getElementById('returnTxHash').value.trim() || null;

    if (!confirm('Mark all pending unstakes as returned? This should only be done after you have already sent the tokens.')) return;

    btn.disabled = true;
    distStatus.textContent = 'Marking as returned...';
    distStatus.className = 'airdrop-status';

    // Aggregate by wallet+token
    const unstakeMap = {};
    for (const u of distData.distribution.pending_unstakes) {
        const key = u.wallet_address + '_' + u.token;
        if (!unstakeMap[key]) {
            unstakeMap[key] = { wallet: u.wallet_address, token: u.token, total: 0 };
        }
        unstakeMap[key].total += u.clawnch_amount;
    }
    const returns = Object.values(unstakeMap);

    try {
        const resp = await fetch(API_BASE + '/ubi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'mark-returned',
                wallet_address: userAddress,
                returns: returns.map(a => ({ wallet: a.wallet, token: a.token })),
                tx_hash: txHash
            })
        });
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.error || 'mark-returned failed');

        distStatus.textContent = 'All pending unstakes marked as returned!';
        distStatus.className = 'airdrop-status success';
        document.getElementById('returnTxHash').value = '';
        loadDistribution();
    } catch (err) {
        console.error('Mark returned error:', err);
        distStatus.textContent = err.message || 'Failed to mark as returned';
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
    return disperseTx;
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

// ══════════════════════════════════════════════════
//  PHILANTHROPY RECIPIENTS
// ══════════════════════════════════════════════════

let philRecipients = [];

async function loadPhilanthropy() {
    try {
        const resp = await fetch(API_BASE + '/humans?philanthropy=true');
        const data = await resp.json();
        philRecipients = data.profiles || [];
        renderPhilanthropy();
    } catch (err) {
        console.error('Failed to load philanthropy recipients:', err);
    }
}

function renderPhilanthropy() {
    const list = document.getElementById('philRecipientList');
    if (philRecipients.length === 0) {
        list.innerHTML = '<div style="padding: var(--space-xl); text-align: center; color: var(--text-dim);">No philanthropy recipients yet. Add one above.</div>';
        updatePhilSummary();
        return;
    }

    const selectAll = `<div class="select-all-row">
        <input type="checkbox" id="philSelectAll" checked>
        <label for="philSelectAll">Select all (${philRecipients.length})</label>
    </div>`;

    const rows = philRecipients.map((p, i) => {
        const name = p.x_name || p.x_handle;
        const avatar = p.x_avatar_url
            ? `<img class="recipient-avatar" src="${p.x_avatar_url}" onerror="this.style.display='none'">`
            : '';
        const note = p.philanthropy_note || '';
        return `<div class="phil-recipient-row">
            <input type="checkbox" class="phil-check" data-index="${i}" checked>
            ${avatar}
            <span class="recipient-name">${escHtml(name)}</span>
            <span class="recipient-handle">@${escHtml(p.x_handle)}</span>
            <span class="phil-recipient-note" title="${escHtml(note)}">${escHtml(note)}</span>
            <span class="recipient-wallet">${shortAddr(p.wallet_address)}</span>
            <input type="number" class="input phil-amount-input" data-index="${i}" value="50000" min="0" step="1000" placeholder="Amount">
            <button class="phil-remove-btn" data-handle="${escHtml(p.x_handle)}" title="Remove from philanthropy">Remove</button>
        </div>`;
    }).join('');

    list.innerHTML = selectAll + rows;

    // Select all
    document.getElementById('philSelectAll').addEventListener('change', (e) => {
        list.querySelectorAll('.phil-check').forEach(cb => { cb.checked = e.target.checked; });
        updatePhilSummary();
    });

    // Individual toggles + amount changes
    list.querySelectorAll('.phil-check').forEach(cb => {
        cb.addEventListener('change', updatePhilSummary);
    });
    list.querySelectorAll('.phil-amount-input').forEach(inp => {
        inp.addEventListener('input', updatePhilSummary);
    });

    // Remove buttons
    list.querySelectorAll('.phil-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const handle = btn.dataset.handle;
            if (confirm(`Remove @${handle} from philanthropy recipients?`)) {
                removePhilanthropyRecipient(handle);
            }
        });
    });

    updatePhilSummary();
}

function getSelectedPhilRecipients() {
    const selected = [];
    document.querySelectorAll('.phil-check').forEach(cb => {
        if (cb.checked) {
            const idx = parseInt(cb.dataset.index);
            const amountInput = document.querySelector(`.phil-amount-input[data-index="${idx}"]`);
            const amount = parseInt(amountInput?.value) || 0;
            if (amount > 0) {
                selected.push({ ...philRecipients[idx], amount });
            }
        }
    });
    return selected;
}

function updatePhilSummary() {
    const selected = getSelectedPhilRecipients();
    const totalClawnch = selected.reduce((sum, r) => sum + r.amount, 0);
    const usd = clawnchPrice > 0 ? (totalClawnch * clawnchPrice).toFixed(2) : '?';

    document.getElementById('philRecipientCount').textContent = selected.length;
    document.getElementById('philTotalClawnch').textContent = totalClawnch.toLocaleString();
    document.getElementById('philTotalUsd').textContent = '$' + usd;

    document.getElementById('sendPhilBtn').disabled = selected.length === 0;
}

// Add recipient
document.getElementById('addPhilBtn').addEventListener('click', async () => {
    const handleInput = document.getElementById('philHandleInput');
    const noteInput = document.getElementById('philNoteInput');
    const status = document.getElementById('philAddStatus');
    const handle = handleInput.value.replace('@', '').trim().toLowerCase();

    if (!handle) {
        status.textContent = 'Enter a handle';
        status.className = 'airdrop-status error';
        return;
    }

    status.textContent = 'Adding...';
    status.className = 'airdrop-status';

    try {
        const resp = await fetch(API_BASE + '/humans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'set-philanthropy',
                wallet_address: userAddress,
                x_handle: handle,
                is_recipient: true,
                note: noteInput.value.trim() || null
            })
        });
        const data = await resp.json();
        if (data.success) {
            status.textContent = `@${handle} added`;
            status.className = 'airdrop-status success';
            handleInput.value = '';
            noteInput.value = '';
            loadPhilanthropy();
        } else {
            status.textContent = data.error || 'Failed';
            status.className = 'airdrop-status error';
        }
    } catch (err) {
        status.textContent = err.message || 'Failed';
        status.className = 'airdrop-status error';
    }
});

async function removePhilanthropyRecipient(handle) {
    try {
        const resp = await fetch(API_BASE + '/humans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'set-philanthropy',
                wallet_address: userAddress,
                x_handle: handle,
                is_recipient: false
            })
        });
        const data = await resp.json();
        if (data.success) {
            loadPhilanthropy();
        } else {
            alert('Remove failed: ' + (data.error || 'Unknown error'));
        }
    } catch (err) {
        alert('Remove failed: ' + err.message);
    }
}

// Refresh
document.getElementById('refreshPhilBtn').addEventListener('click', () => {
    loadPhilanthropy();
});

// Send philanthropy via Disperse
document.getElementById('sendPhilBtn').addEventListener('click', async () => {
    const selected = getSelectedPhilRecipients();
    if (selected.length === 0) return;

    const btn = document.getElementById('sendPhilBtn');
    const status = document.getElementById('philSendStatus');
    btn.disabled = true;
    status.textContent = 'Preparing...';
    status.className = 'airdrop-status';

    try {
        const recipients = selected.map(r => r.wallet_address);
        const amounts = selected.map(r => toWei(r.amount));
        const totalWei = amounts.reduce((sum, a) => sum + a, 0n);

        // Check balance
        const balanceData = BALANCE_SELECTOR + pad32(userAddress);
        const balResult = await provider.request({
            method: 'eth_call',
            params: [{ to: CLAWNCH_ADDRESS, data: balanceData }, 'latest']
        });
        const balance = BigInt(balResult);
        if (balance < totalWei) {
            status.textContent = `Insufficient CLAWNCH. Need ${(Number(totalWei) / 1e18).toLocaleString()}, have ${(Number(balance) / 1e18).toLocaleString()}`;
            status.className = 'airdrop-status error';
            btn.disabled = false;
            return;
        }

        // Check allowance
        status.textContent = 'Checking allowance...';
        const allowData = ALLOWANCE_SELECTOR + pad32(userAddress) + pad32(DISPERSE_ADDRESS);
        const allowResult = await provider.request({
            method: 'eth_call',
            params: [{ to: CLAWNCH_ADDRESS, data: allowData }, 'latest']
        });
        const allowance = BigInt(allowResult);

        if (allowance < totalWei) {
            status.textContent = 'Approving CLAWNCH spend...';
            const approveData = APPROVE_SELECTOR + pad32(DISPERSE_ADDRESS) + pad32(toHex(totalWei));
            const approveTx = await provider.request({
                method: 'eth_sendTransaction',
                params: [{ from: userAddress, to: CLAWNCH_ADDRESS, data: approveData }]
            });
            status.textContent = 'Waiting for approval...';
            await waitForReceipt(approveTx);
        }

        // Disperse
        status.textContent = `Sending to ${selected.length} recipients...`;
        const calldata = buildDisperseTokenCalldata(CLAWNCH_ADDRESS, recipients, amounts);
        const disperseTx = await provider.request({
            method: 'eth_sendTransaction',
            params: [{ from: userAddress, to: DISPERSE_ADDRESS, data: calldata }]
        });

        status.textContent = 'Confirming...';
        await waitForReceipt(disperseTx);

        // Record via batch-hire so it shows on human cards
        status.textContent = 'Recording...';
        try {
            await fetch(API_BASE + '/batch-hire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tx_hash: disperseTx,
                    agent_address: userAddress,
                    agent_name: 'philanthropy',
                    recipients: selected.map(r => ({
                        handle: r.x_handle,
                        amount: r.amount
                    }))
                })
            });
        } catch (e) { /* non-critical */ }

        const totalSent = selected.reduce((s, r) => s + r.amount, 0);
        status.textContent = `Sent ${totalSent.toLocaleString()} CLAWNCH to ${selected.length} recipients!`;
        status.className = 'airdrop-status success';
    } catch (err) {
        console.error('Philanthropy send error:', err);
        status.textContent = err.message || 'Send failed';
        status.className = 'airdrop-status error';
        btn.disabled = false;
    }
});

// ══════════════════════════════════════════════════
//  BULK WELCOME MESSAGE
// ══════════════════════════════════════════════════

document.getElementById('bulkWelcomeBtn').addEventListener('click', async () => {
    const btn = document.getElementById('bulkWelcomeBtn');
    const status = document.getElementById('bulkWelcomeStatus');
    const message = (document.getElementById('startingMessage')?.value || '').trim();

    if (!message) {
        status.textContent = 'Write a message in the textarea above first';
        status.className = 'airdrop-status error';
        return;
    }

    if (!confirm('Send this welcome message to ALL humans who haven\'t been messaged yet?')) {
        return;
    }

    btn.disabled = true;
    status.textContent = 'Sending welcome messages...';
    status.className = 'airdrop-status';

    try {
        const resp = await fetch(API_BASE + '/bulk-welcome', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wallet_address: userAddress,
                message: message
            })
        });
        const data = await resp.json();

        if (data.success) {
            status.textContent = `Done! Sent welcome to ${data.sent} humans` + (data.errors ? ` (${data.errors.length} errors)` : '');
            status.className = 'airdrop-status success';
        } else {
            status.textContent = data.error || 'Failed';
            status.className = 'airdrop-status error';
        }
    } catch (err) {
        console.error('Bulk welcome error:', err);
        status.textContent = err.message || 'Failed';
        status.className = 'airdrop-status error';
    }

    btn.disabled = false;
});
