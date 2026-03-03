// Inclawbate — Dashboard Controller (Single Overview Page)
import { getStoredAuth, logout } from './x-auth-client.js';

const API_BASE = '/api/inclawbate';

function authHeaders() {
    const token = localStorage.getItem('inclawbate_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

function esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

function timeAgo(dateStr) {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = Math.floor((now - then) / 1000);
    if (diff < 60) return 'now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Overview ──
async function loadOverview() {
    const auth = getStoredAuth();
    if (!auth) return;
    const profile = auth.profile;

    renderProfileCard(profile);

    const [credits, apps] = await Promise.allSettled([
        fetch(`${API_BASE}/credits`, { headers: authHeaders() }).then(r => r.ok ? r.json() : null),
        profile.x_handle
            ? fetch(`${API_BASE}/apps?creator=${encodeURIComponent(profile.x_handle)}`).then(r => r.ok ? r.json() : null)
            : Promise.resolve(null)
    ]);

    const creditsData = credits.status === 'fulfilled' ? credits.value : null;
    const appsData = apps.status === 'fulfilled' ? apps.value : null;

    // Update stat cards
    document.getElementById('ovCredits').textContent = creditsData?.credits ?? 0;
    document.getElementById('ovApps').textContent = appsData?.apps?.length ?? appsData?.total ?? 0;

    renderAppCards(appsData?.apps || []);

    // Render credits inline
    document.getElementById('creditBalance').textContent = creditsData?.credits ?? 0;
    if (creditsData?.api_key) {
        document.getElementById('dashApiKey').value = creditsData.api_key;
    }
}

function renderProfileCard(profile) {
    const card = document.getElementById('overviewProfileCard');
    const name = profile.x_name || profile.x_handle || 'Anonymous';
    const handle = profile.x_handle && !profile.x_handle.startsWith('w_') ? `@${profile.x_handle}` : '';
    const profileHref = profile.x_handle ? `/u/${encodeURIComponent(profile.x_handle)}` : '#';

    let avatarHtml;
    if (profile.x_avatar_url) {
        avatarHtml = `<img src="${esc(profile.x_avatar_url)}" class="overview-profile-avatar" alt="">`;
    } else {
        avatarHtml = `<div class="overview-profile-avatar-fallback">${name[0].toUpperCase()}</div>`;
    }

    card.innerHTML = `
        ${avatarHtml}
        <div class="overview-profile-info">
            <div class="overview-profile-name">${esc(name)}</div>
            ${handle ? `<div class="overview-profile-handle">${esc(handle)}</div>` : ''}
        </div>
        <a href="${profileHref}" class="overview-profile-link">View Profile</a>
        <button type="button" class="overview-profile-link" id="dashDisconnect" style="color:var(--text-dim);border-color:var(--border-subtle);">Disconnect</button>
    `;

    document.getElementById('dashDisconnect')?.addEventListener('click', () => {
        localStorage.removeItem('inclawbate_token');
        localStorage.removeItem('inclawbate_profile');
        localStorage.removeItem('inclawbate_last_inbox');
        window.location.reload();
    });
}

function renderAppCards(apps) {
    const container = document.getElementById('overviewAppList');
    if (!apps.length) {
        container.innerHTML = '<div class="overview-empty"><p>No apps yet. <a href="/apps">Build your first app</a></p></div>';
        return;
    }

    container.innerHTML = '';
    apps.slice(0, 5).forEach(a => {
        const el = document.createElement('div');
        el.className = 'overview-item';
        el.innerHTML = `
            <div class="overview-item-info">
                <div class="overview-item-title">${esc(a.name || 'Untitled App')}</div>
                <div class="overview-item-sub">${a.upvote_count ? a.upvote_count + ' upvotes' : '0 upvotes'} · ${a.category || 'App'}</div>
            </div>
            <div class="app-actions">
                <button type="button" class="overview-item-action app-actions-toggle">Manage</button>
                <div class="app-actions-menu">
                    <a href="/apps/${esc(a.slug || a.id)}">View on Store</a>
                    <button type="button" class="app-actions-delete" data-id="${esc(a.id)}" data-name="${esc(a.name || 'Untitled App')}">Delete</button>
                </div>
            </div>
        `;

        el.querySelector('.app-actions-toggle').addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = el.querySelector('.app-actions-menu');
            const wasOpen = menu.classList.contains('open');
            closeAllAppMenus();
            if (!wasOpen) menu.classList.add('open');
        });

        el.querySelector('.app-actions-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllAppMenus();
            deleteApp(a.id, a.name || 'Untitled App');
        });

        container.appendChild(el);
    });
}

function closeAllAppMenus() {
    document.querySelectorAll('.app-actions-menu.open').forEach(m => m.classList.remove('open'));
}

document.addEventListener('click', () => closeAllAppMenus());

async function deleteApp(appId, appName) {
    if (!confirm(`Delete "${appName}"? This cannot be undone.`)) return;

    try {
        const res = await fetch(`${API_BASE}/apps`, {
            method: 'DELETE',
            headers: authHeaders(),
            body: JSON.stringify({ app_id: appId })
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.error || 'Failed to delete app');
            return;
        }
        loadOverview();
    } catch (err) {
        alert('Failed to delete app');
    }
}

// ── Staking Pools ──
const BASE_RPCS = [
    'https://mainnet.base.org',
    'https://1rpc.io/base',
    'https://base-mainnet.public.blastapi.io'
];
const CLAWS = '0x7ca47B141639B893C6782823C0b219f872056379';
const STAKING_SEL = {
    approve:        '0x095ea7b3',
    depositRewards: '0xbdd071fb',
    totalStaked:    '0x817b1cd2',
    stakerCount:    '0xdff69787',
    rewardRate:     '0x7b0a47ee',
    periodEnd:      '0x506ec095',
};

function pad32(hex) { return hex.replace('0x', '').padStart(64, '0'); }
function fromWei(hex) {
    if (!hex || hex === '0x' || hex === '0x0') return 0;
    return Number(BigInt(hex)) / 1e18;
}
function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); }

async function rpcCall(to, data) {
    for (const url of BASE_RPCS) {
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 5000);
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
                signal: ctrl.signal
            });
            clearTimeout(timer);
            const json = await res.json();
            return (json && json.result) || '0x0';
        } catch (e) { continue; }
    }
    return '0x0';
}

async function sendTx(from, to, data) {
    const provider = window.ethereum;
    if (!provider) throw new Error('No wallet');
    const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from, to, data }]
    });
    // Wait for receipt
    for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2000));
        try {
            const receipt = await provider.request({ method: 'eth_getTransactionReceipt', params: [txHash] });
            if (receipt) return receipt;
        } catch (e) {}
    }
    throw new Error('Transaction timed out');
}

async function loadStakingPools() {
    const auth = getStoredAuth();
    if (!auth) return;

    const container = document.getElementById('stakingPoolList');
    if (!container) return;

    const profile = auth.profile;
    const wallet = profile.wallet_address;
    if (!wallet) {
        container.innerHTML = '<div class="overview-empty"><p>Connect a wallet to see your staking pools.</p></div>';
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/inclawbator?wallet=${encodeURIComponent(wallet.toLowerCase())}`);
        const data = await res.json();
        const projects = (data.projects || []).filter(p => p.staking_address && p.status === 'active');

        if (projects.length === 0) {
            container.innerHTML = '<div class="overview-empty"><p>No staking pools yet. <a href="/inclawbator#pool">Create one</a></p></div>';
            return;
        }

        container.innerHTML = '';
        for (const project of projects) {
            const card = document.createElement('div');
            card.className = 'staking-pool-card';
            card.innerHTML = `
                <div class="staking-pool-header">
                    <div class="staking-pool-icon">${(project.token_symbol || '?')[0]}</div>
                    <div class="staking-pool-title">
                        <div class="staking-pool-name">${esc(project.token_name || 'Unknown')}</div>
                        <div class="staking-pool-symbol">$${esc(project.token_symbol || '???')}</div>
                    </div>
                </div>
                <div class="staking-pool-stats">
                    <div class="staking-pool-stat">
                        <div class="staking-pool-stat-val" data-field="staked">--</div>
                        <div class="staking-pool-stat-label">Staked</div>
                    </div>
                    <div class="staking-pool-stat">
                        <div class="staking-pool-stat-val" data-field="stakers">--</div>
                        <div class="staking-pool-stat-label">Stakers</div>
                    </div>
                    <div class="staking-pool-stat">
                        <div class="staking-pool-stat-val" data-field="rate">--</div>
                        <div class="staking-pool-stat-label">CLAWS/day</div>
                    </div>
                </div>
                <div class="staking-pool-reward-bar"><div class="staking-pool-reward-fill" data-field="bar" style="width:0%"></div></div>
                <div class="staking-pool-actions">
                    <button class="staking-pool-fund-btn" data-pool="${esc(project.staking_address)}" data-name="${esc(project.token_name || 'Pool')}">Fund Rewards</button>
                    <a href="https://basescan.org/address/${esc(project.staking_address)}" target="_blank" rel="noopener" class="staking-pool-view-btn">BaseScan</a>
                </div>
            `;

            // Wire fund button
            card.querySelector('.staking-pool-fund-btn').addEventListener('click', (e) => {
                openFundModal(e.target.dataset.pool, e.target.dataset.name);
            });

            container.appendChild(card);

            // Load on-chain stats async
            loadPoolStats(card, project.staking_address);
        }
    } catch (e) {
        container.innerHTML = '<div class="overview-empty"><p>Failed to load pools.</p></div>';
    }
}

async function loadPoolStats(card, poolAddr) {
    try {
        const [totalHex, countHex, rateHex, endHex] = await Promise.all([
            rpcCall(poolAddr, STAKING_SEL.totalStaked),
            rpcCall(poolAddr, STAKING_SEL.stakerCount),
            rpcCall(poolAddr, STAKING_SEL.rewardRate),
            rpcCall(poolAddr, STAKING_SEL.periodEnd),
        ]);

        const total = fromWei(totalHex);
        const stakers = Number(BigInt(countHex || '0x0'));
        const rate = fromWei(rateHex);
        const periodEnd = Number(BigInt(endHex || '0x0'));
        const now = Math.floor(Date.now() / 1000);

        card.querySelector('[data-field="staked"]').textContent = fmt(total);
        card.querySelector('[data-field="stakers"]').textContent = fmt(stakers);
        card.querySelector('[data-field="rate"]').textContent = fmt(rate * 86400);

        // Reward period progress bar
        const bar = card.querySelector('[data-field="bar"]');
        if (periodEnd > now) {
            // Still active — show remaining as a percentage (arbitrary: assume 30 day periods)
            const remaining = periodEnd - now;
            const pct = Math.min(100, Math.max(5, (remaining / (30 * 86400)) * 100));
            bar.style.width = pct + '%';
        } else {
            bar.style.width = '0%';
        }
    } catch (e) {
        // Stats stay as --
    }
}

function openFundModal(poolAddr, poolName) {
    const auth = getStoredAuth();
    if (!auth) { alert('Connect your wallet first.'); return; }

    const overlay = document.createElement('div');
    overlay.className = 'fund-modal-overlay';
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    const modal = document.createElement('div');
    modal.className = 'fund-modal';
    modal.innerHTML = `
        <div class="fund-modal-title">Fund Rewards — ${esc(poolName)}</div>
        <label class="fund-modal-label">CLAWS Amount</label>
        <input class="fund-modal-input" type="number" placeholder="e.g. 100000" id="fundAmount" min="1">
        <label class="fund-modal-label">Duration (days)</label>
        <input class="fund-modal-input" type="number" placeholder="e.g. 30" id="fundDuration" min="1" max="365" value="30">
        <div class="fund-modal-hint">CLAWS will be dripped to stakers over this period. You can top up anytime — leftover rewards roll into the new period.</div>
        <div class="fund-modal-actions">
            <button class="fund-modal-submit" id="fundSubmitBtn">Approve & Fund</button>
            <button class="fund-modal-cancel" id="fundCancelBtn">Cancel</button>
        </div>
        <div class="fund-modal-result" id="fundResult"></div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    modal.querySelector('#fundCancelBtn').addEventListener('click', () => overlay.remove());

    modal.querySelector('#fundSubmitBtn').addEventListener('click', async () => {
        const amountRaw = parseFloat(document.getElementById('fundAmount').value);
        const durationDays = parseInt(document.getElementById('fundDuration').value);
        const resultEl = document.getElementById('fundResult');
        const btn = document.getElementById('fundSubmitBtn');

        if (!amountRaw || amountRaw <= 0) { resultEl.textContent = 'Enter a valid amount'; resultEl.className = 'fund-modal-result error'; return; }
        if (!durationDays || durationDays <= 0) { resultEl.textContent = 'Enter a valid duration'; resultEl.className = 'fund-modal-result error'; return; }

        const wallet = auth.profile.wallet_address;
        if (!wallet) { resultEl.textContent = 'No wallet connected'; resultEl.className = 'fund-modal-result error'; return; }

        // Ensure on Base
        try {
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            if (chainId !== '0x2105') {
                await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] });
            }
        } catch (e) {
            resultEl.textContent = 'Switch to Base network';
            resultEl.className = 'fund-modal-result error';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Approving CLAWS...';
        resultEl.textContent = '';
        resultEl.className = 'fund-modal-result';

        const amountWei = BigInt(Math.floor(amountRaw * 1e18)).toString(16).padStart(64, '0');
        const durationSec = BigInt(durationDays * 86400).toString(16).padStart(64, '0');

        try {
            // Step 1: Approve CLAWS to pool
            const approveData = STAKING_SEL.approve + pad32(poolAddr) + amountWei;
            await sendTx(wallet, CLAWS, approveData);

            // Step 2: depositRewards(amount, duration)
            btn.textContent = 'Funding pool...';
            const depositData = STAKING_SEL.depositRewards + amountWei + durationSec;
            await sendTx(wallet, poolAddr, depositData);

            resultEl.textContent = `Funded ${fmt(amountRaw)} CLAWS over ${durationDays} days!`;
            resultEl.className = 'fund-modal-result success';
            btn.textContent = 'Done!';

            // Refresh pool stats
            setTimeout(() => {
                loadStakingPools();
                overlay.remove();
            }, 2000);
        } catch (e) {
            resultEl.textContent = e.message || 'Transaction failed';
            resultEl.className = 'fund-modal-result error';
            btn.disabled = false;
            btn.textContent = 'Approve & Fund';
        }
    });

    // Escape to close
    const escHandler = (e) => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);
}

// ── Init ──
function init() {
    const auth = getStoredAuth();
    if (!auth) {
        document.getElementById('loginGate').classList.remove('hidden');
        return;
    }

    document.getElementById('dashboardView').classList.remove('hidden');

    // Fetch fresh profile for Telegram status
    const profile = auth.profile;
    fetch(`/api/inclawbate/humans?handle=${profile.x_handle}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
            if (data?.profile) {
                localStorage.setItem('inclawbate_profile', JSON.stringify(data.profile));
            }
        })
        .catch(() => {});

    // Wire credits buttons
    document.getElementById('generateApiKey')?.addEventListener('click', async () => {
        const btn = document.getElementById('generateApiKey');
        btn.disabled = true;
        btn.textContent = '...';
        try {
            const res = await fetch(`${API_BASE}/credits`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ action: 'generate-key' })
            });
            const data = await res.json();
            if (data.api_key) {
                document.getElementById('dashApiKey').value = data.api_key;
            }
        } catch (err) {
            // Silent
        } finally {
            btn.disabled = false;
            btn.textContent = 'Generate';
        }
    });

    document.getElementById('copyApiKey')?.addEventListener('click', () => {
        const input = document.getElementById('dashApiKey');
        if (input.value) {
            navigator.clipboard.writeText(input.value);
            const btn = document.getElementById('copyApiKey');
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
        }
    });

    document.getElementById('copyDepositAddr')?.addEventListener('click', () => {
        const input = document.getElementById('depositAddr');
        navigator.clipboard.writeText(input.value);
        const btn = document.getElementById('copyDepositAddr');
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
    });

    loadOverview();
    loadStakingPools();
}

// Boot
init();
