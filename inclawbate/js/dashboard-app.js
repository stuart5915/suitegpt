// Inclawbate — Dashboard Controller (Single Overview Page)

function getStoredAuth() {
    try {
        const token = localStorage.getItem('inclawbate_token');
        const profile = JSON.parse(localStorage.getItem('inclawbate_profile') || 'null');
        if (token && profile) return { token, profile };
    } catch (e) {}
    return null;
}

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
    const creditCount = creditsData?.credits ?? 0;
    document.getElementById('ovCredits').textContent = creditCount;
    document.getElementById('ovApps').textContent = appsData?.apps?.length ?? appsData?.total ?? 0;

    // Update buy panel balance
    const balEl = document.getElementById('dashBuyBalance');
    if (balEl) balEl.textContent = creditCount + ' credits';

    renderAppCards(appsData?.apps || []);

    // Populate API key
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

// ── Projects ──
async function loadProjects() {
    const auth = getStoredAuth();
    if (!auth) return;

    const container = document.getElementById('projectList');
    if (!container) return;

    const profile = auth.profile;
    const wallet = profile.wallet_address;
    if (!wallet) {
        container.innerHTML = '<div class="overview-empty"><p>Connect a wallet to see your projects.</p></div>';
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/inclawbator?wallet=${encodeURIComponent(wallet.toLowerCase())}`);
        const data = await res.json();
        const projects = data.projects || [];

        // Update stat card
        document.getElementById('ovProjects').textContent = projects.length;

        if (projects.length === 0) {
            container.innerHTML = '<div class="overview-empty"><p>No projects yet. <a href="/inclawbator#launch">Launch your first token</a></p></div>';
            return;
        }

        // Sort: active first, then pending, then rejected; within each group by created_at desc
        const statusOrder = { active: 0, pending: 1, rejected: 2 };
        projects.sort((a, b) => {
            const sa = statusOrder[a.status] ?? 1;
            const sb = statusOrder[b.status] ?? 1;
            if (sa !== sb) return sa - sb;
            return new Date(b.created_at) - new Date(a.created_at);
        });

        container.innerHTML = '';
        for (const p of projects) {
            const card = document.createElement('div');
            card.className = 'project-card';

            const symbol = p.token_symbol || '???';
            const name = p.token_name || 'Unknown';
            const status = p.status || 'pending';
            const tier = p.tier || 'permissionless';
            const addr = p.token_address || '';
            const addrShort = addr ? addr.slice(0, 6) + '…' + addr.slice(-4) : '';
            const created = p.created_at ? timeAgo(p.created_at) : '';

            // Build action buttons
            let actionsHtml = '';
            if (addr) {
                actionsHtml += `<a href="https://basescan.org/address/${esc(addr)}" target="_blank" rel="noopener" class="project-card-action">BaseScan</a>`;
            }
            if (!p.staking_address && status === 'active') {
                actionsHtml += `<a href="/inclawbator#pool" class="project-card-action primary">Create Pool</a>`;
            }
            if (p.staking_address) {
                actionsHtml += `<button type="button" class="project-card-action primary" data-pool="${esc(p.staking_address)}" data-name="${esc(name)}" data-project="${esc(p.id)}">Fund Rewards</button>`;
            }
            if (p.agent_enabled) {
                actionsHtml += `<a href="/inclawbator#agent" class="project-card-action">Manage Agent</a>`;
            }

            card.innerHTML = `
                <div class="project-card-header">
                    <div class="project-card-icon">${symbol[0]}</div>
                    <div class="project-card-title">
                        <div class="project-card-name">${esc(name)}</div>
                        <div class="project-card-symbol">$${esc(symbol)}</div>
                    </div>
                    <div class="project-card-badges">
                        <span class="project-status-badge ${esc(status)}">${esc(status)}</span>
                        <span class="project-tier-badge">${esc(tier)}</span>
                    </div>
                </div>
                <div class="project-card-meta">
                    ${addr ? `<span><a href="https://basescan.org/address/${esc(addr)}" target="_blank" rel="noopener" class="project-card-address">${addrShort}</a> <button type="button" class="project-card-copy" data-copy="${esc(addr)}" title="Copy address">&#128203;</button></span>` : ''}
                    ${created ? `<span>${created}</span>` : ''}
                </div>
                <div class="project-card-actions">${actionsHtml}</div>
            `;

            // Wire copy button
            card.querySelector('.project-card-copy')?.addEventListener('click', (e) => {
                const text = e.currentTarget.dataset.copy;
                navigator.clipboard.writeText(text);
                e.currentTarget.textContent = '✓';
                setTimeout(() => { e.currentTarget.innerHTML = '&#128203;'; }, 1500);
            });

            // Wire fund button
            card.querySelector('.project-card-action.primary[data-pool]')?.addEventListener('click', (e) => {
                const btn = e.currentTarget;
                openFundModal(btn.dataset.pool, btn.dataset.name, btn.dataset.project);
            });

            container.appendChild(card);
        }
    } catch (e) {
        container.innerHTML = '<div class="overview-empty"><p>Failed to load projects.</p></div>';
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
    pause:          '0x8456cb59',
    unpause:        '0x3f4ba83a',
    paused:         '0x5c975abb',
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
            card._projectId = project.id;
            card._poolAddr = project.staking_address;
            card.innerHTML = `
                <div class="staking-pool-header">
                    <div class="staking-pool-icon">${(project.token_symbol || '?')[0]}</div>
                    <div class="staking-pool-title">
                        <div class="staking-pool-name">${esc(project.token_name || 'Unknown')}</div>
                        <div class="staking-pool-symbol">$${esc(project.token_symbol || '???')}</div>
                    </div>
                </div>
                <div class="staking-pool-analytics" data-field="analytics"></div>
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
                    <button class="staking-pool-fund-btn" data-pool="${esc(project.staking_address)}" data-name="${esc(project.token_name || 'Pool')}" data-project="${esc(project.id)}">Fund Rewards</button>
                    <button class="staking-pool-pause-btn" data-pool="${esc(project.staking_address)}" data-field="pauseBtn">Pause</button>
                    <a href="https://basescan.org/address/${esc(project.staking_address)}" target="_blank" rel="noopener" class="staking-pool-view-btn">BaseScan</a>
                </div>
                <div class="staking-pool-history" data-field="history">
                    <button class="staking-pool-history-toggle" data-field="historyToggle">Distribution History &#9662;</button>
                    <div class="staking-pool-history-list" data-field="historyList" style="display:none"></div>
                </div>
            `;

            // Wire fund button
            card.querySelector('.staking-pool-fund-btn').addEventListener('click', (e) => {
                const btn = e.target;
                openFundModal(btn.dataset.pool, btn.dataset.name, btn.dataset.project);
            });

            // Wire pause/unpause button
            card.querySelector('.staking-pool-pause-btn').addEventListener('click', (e) => {
                handlePauseToggle(card, e.target);
            });

            // Wire history toggle
            card.querySelector('[data-field="historyToggle"]').addEventListener('click', () => {
                const list = card.querySelector('[data-field="historyList"]');
                const toggle = card.querySelector('[data-field="historyToggle"]');
                const isOpen = list.style.display !== 'none';
                list.style.display = isOpen ? 'none' : 'block';
                toggle.innerHTML = isOpen ? 'Distribution History &#9662;' : 'Distribution History &#9652;';
            });

            container.appendChild(card);

            // Load on-chain stats + distribution history in parallel
            Promise.all([
                loadPoolStats(card, project.staking_address),
                loadDistributions(card, project.id)
            ]).then(([_, distributions]) => {
                renderPoolAnalytics(card, distributions);
            });
        }
    } catch (e) {
        container.innerHTML = '<div class="overview-empty"><p>Failed to load pools.</p></div>';
    }
}

async function loadPoolStats(card, poolAddr) {
    try {
        const [totalHex, countHex, rateHex, endHex, pausedHex] = await Promise.all([
            rpcCall(poolAddr, STAKING_SEL.totalStaked),
            rpcCall(poolAddr, STAKING_SEL.stakerCount),
            rpcCall(poolAddr, STAKING_SEL.rewardRate),
            rpcCall(poolAddr, STAKING_SEL.periodEnd),
            rpcCall(poolAddr, STAKING_SEL.paused),
        ]);

        const total = fromWei(totalHex);
        const stakers = Number(BigInt(countHex || '0x0'));
        const rate = fromWei(rateHex);
        const periodEnd = Number(BigInt(endHex || '0x0'));
        const isPaused = pausedHex && BigInt(pausedHex) === 1n;
        const now = Math.floor(Date.now() / 1000);

        // Store stats on card for analytics
        card._onChainStats = { total, stakers, rate, periodEnd, isPaused };

        card.querySelector('[data-field="staked"]').textContent = fmt(total);
        card.querySelector('[data-field="stakers"]').textContent = fmt(stakers);
        card.querySelector('[data-field="rate"]').textContent = fmt(rate * 86400);

        // Paused state
        const pauseBtn = card.querySelector('[data-field="pauseBtn"]');
        const nameEl = card.querySelector('.staking-pool-name');
        if (isPaused) {
            card.classList.add('is-paused');
            if (!nameEl.querySelector('.staking-pool-paused-badge')) {
                nameEl.insertAdjacentHTML('afterend', '<span class="staking-pool-paused-badge">Paused</span>');
            }
            pauseBtn.textContent = 'Unpause';
            pauseBtn.classList.add('is-unpause');
        } else {
            pauseBtn.textContent = 'Pause';
        }

        // Reward period progress bar
        const bar = card.querySelector('[data-field="bar"]');
        if (periodEnd > now) {
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

async function loadDistributions(card, projectId) {
    try {
        const res = await fetch(`${API_BASE}/inclawbator?distributions=${encodeURIComponent(projectId)}`);
        const data = await res.json();
        const distributions = data.distributions || [];

        card._distributions = distributions;

        const list = card.querySelector('[data-field="historyList"]');
        const historySection = card.querySelector('[data-field="history"]');

        if (distributions.length === 0) {
            historySection.style.display = 'none';
            return distributions;
        }

        list.innerHTML = distributions.map(d => {
            const amount = parseFloat(d.amount) || 0;
            const days = Math.round((d.duration_seconds || 0) / 86400);
            const ago = timeAgo(d.created_at);
            const txLink = d.tx_hash ? `https://basescan.org/tx/${d.tx_hash}` : '#';
            return `<div class="staking-pool-history-item">
                <div class="staking-pool-history-amount">${fmt(amount)} CLAWS</div>
                <div class="staking-pool-history-meta">${days}d period · ${ago}</div>
                ${d.tx_hash ? `<a href="${txLink}" target="_blank" rel="noopener" class="staking-pool-history-tx">tx</a>` : ''}
            </div>`;
        }).join('');

        return distributions;
    } catch (e) {
        return [];
    }
}

async function handlePauseToggle(card, btn) {
    const auth = getStoredAuth();
    if (!auth) { alert('Connect your wallet first.'); return; }

    const wallet = auth.profile.wallet_address;
    const poolAddr = card._poolAddr;
    const isPaused = card.classList.contains('is-paused');
    const selector = isPaused ? STAKING_SEL.unpause : STAKING_SEL.pause;

    btn.disabled = true;
    btn.textContent = isPaused ? 'Unpausing...' : 'Pausing...';

    try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (chainId !== '0x2105') {
            await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] });
        }

        await sendTx(wallet, poolAddr, selector);

        // Toggle state
        if (isPaused) {
            card.classList.remove('is-paused');
            const badge = card.querySelector('.staking-pool-paused-badge');
            if (badge) badge.remove();
            btn.textContent = 'Pause';
            btn.classList.remove('is-unpause');
        } else {
            card.classList.add('is-paused');
            const nameEl = card.querySelector('.staking-pool-name');
            nameEl.insertAdjacentHTML('afterend', '<span class="staking-pool-paused-badge">Paused</span>');
            btn.textContent = 'Unpause';
            btn.classList.add('is-unpause');
        }
    } catch (e) {
        btn.textContent = isPaused ? 'Unpause' : 'Pause';
        alert(e.message || 'Transaction failed');
    } finally {
        btn.disabled = false;
    }
}

function renderPoolAnalytics(card, distributions) {
    const el = card.querySelector('[data-field="analytics"]');
    if (!distributions || distributions.length === 0) {
        el.style.display = 'none';
        return;
    }

    const totalDistributed = distributions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
    const eventCount = distributions.length;

    // Mini bar chart of last 5 distributions
    const recent = distributions.slice(0, 5).reverse();
    const maxAmount = Math.max(...recent.map(d => parseFloat(d.amount) || 0), 1);

    const barsHtml = recent.map(d => {
        const amount = parseFloat(d.amount) || 0;
        const pct = Math.max(8, (amount / maxAmount) * 100);
        return `<div class="analytics-bar" style="height:${pct}%" title="${fmt(amount)} CLAWS"></div>`;
    }).join('');

    el.innerHTML = `
        <div class="analytics-summary">
            <div class="analytics-metric">
                <div class="analytics-metric-val">${fmt(totalDistributed)}</div>
                <div class="analytics-metric-label">Total Distributed</div>
            </div>
            <div class="analytics-metric">
                <div class="analytics-metric-val">${eventCount}</div>
                <div class="analytics-metric-label">Funding Events</div>
            </div>
        </div>
        <div class="analytics-bars">${barsHtml}</div>
    `;
    el.style.display = '';
}

function openFundModal(poolAddr, poolName, projectId) {
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
            const receipt = await sendTx(wallet, poolAddr, depositData);

            // Record distribution
            if (projectId && receipt?.transactionHash) {
                try {
                    await fetch(`${API_BASE}/inclawbator`, {
                        method: 'POST',
                        headers: authHeaders(),
                        body: JSON.stringify({
                            action: 'record-distribution-owner',
                            project_id: projectId,
                            staking_address: poolAddr,
                            amount: amountRaw,
                            duration_seconds: durationDays * 86400,
                            tx_hash: receipt.transactionHash
                        })
                    });
                } catch (e) { /* non-critical */ }
            }

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

// ── Buy Credits ──
const PROTOCOL_WALLET = '0x91B5C0D07859CFeAfEB67d9694121CD741F049bd';
const CLAWS_ADDRESS = '0x7ca47B141639B893C6782823C0b219f872056379';
const BASE_CHAIN_ID = '0x2105';
const buyState = { clawsPerCredit: 0, selectedAmount: 250, clawsPrice: 0 };

function initBuyCredits() {
    // Tab switching
    document.querySelectorAll('.dash-buy-panel .buy-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.dash-buy-panel .buy-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
            document.getElementById('dashBuyCredits').classList.toggle('active', tab === 'credits');
            document.getElementById('dashBuySubscribe').classList.toggle('active', tab === 'subscribe');
        });
    });

    // Presets
    document.querySelectorAll('.dash-buy-panel .buy-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            buyState.selectedAmount = parseInt(btn.dataset.amount);
            const custom = document.getElementById('dashBuyCustom');
            if (custom) custom.value = '';
            document.querySelectorAll('.dash-buy-panel .buy-preset').forEach(b => b.classList.toggle('active', b === btn));
            updateDashBuyCost();
        });
    });

    // Custom amount
    document.getElementById('dashBuyCustom')?.addEventListener('input', () => {
        const val = parseInt(document.getElementById('dashBuyCustom').value) || 0;
        if (val > 0) {
            buyState.selectedAmount = val;
            document.querySelectorAll('.dash-buy-panel .buy-preset').forEach(b => b.classList.remove('active'));
        }
        updateDashBuyCost();
    });

    // Pay with card
    document.getElementById('dashBuyCardBtn')?.addEventListener('click', dashBuyWithCard);

    // Pay with CLAWS
    document.getElementById('dashBuySendBtn')?.addEventListener('click', dashSendClawsTx);


    // Fetch price
    fetchClawsPrice();
}

async function fetchClawsPrice() {
    const rateEl = document.getElementById('dashBuyRate');
    try {
        const resp = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + CLAWS_ADDRESS);
        const data = await resp.json();
        if (data.pairs && data.pairs.length > 0) {
            const price = parseFloat(data.pairs[0].priceUsd) || 0;
            if (price > 0) {
                buyState.clawsPrice = price;
                buyState.clawsPerCredit = Math.ceil(0.005 / price);
                if (rateEl) rateEl.textContent = '~' + buyState.clawsPerCredit.toLocaleString() + ' CLAWS / credit';
                updateDashBuyCost();
                return;
            }
        }
        if (rateEl) rateEl.textContent = 'Price unavailable';
    } catch (e) {
        if (rateEl) rateEl.textContent = 'Price unavailable';
    }
}

function updateDashBuyCost() {
    const amount = buyState.selectedAmount;
    const costEl = document.getElementById('dashBuyCost');
    const sendBtn = document.getElementById('dashBuySendBtn');
    const cardBtn = document.getElementById('dashBuyCardBtn');
    const bH = document.getElementById('dashBrkHaiku');
    const bS = document.getElementById('dashBrkSonnet');
    const bO = document.getElementById('dashBrkOpus');
    const cardIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>';

    if (!amount || !buyState.clawsPerCredit) {
        if (costEl) costEl.textContent = '--';
        if (sendBtn) sendBtn.disabled = true;
        if (cardBtn) { cardBtn.disabled = true; cardBtn.innerHTML = cardIcon + 'Pay with Card'; }
        if (bH) bH.textContent = '--';
        if (bS) bS.textContent = '--';
        if (bO) bO.textContent = '--';
        return;
    }

    const totalClaws = amount * buyState.clawsPerCredit;
    const totalUsd = (amount * 0.005).toFixed(2);
    if (costEl) costEl.textContent = totalClaws.toLocaleString() + ' CLAWS (~$' + totalUsd + ')';
    if (sendBtn) sendBtn.disabled = false;
    if (cardBtn) {
        if (amount >= 100) {
            cardBtn.disabled = false;
            cardBtn.innerHTML = cardIcon + 'Pay with Card — $' + totalUsd;
        } else {
            cardBtn.disabled = true;
            cardBtn.innerHTML = cardIcon + 'Card min $0.50 (100 credits)';
        }
    }
    if (bH) bH.textContent = Math.floor(amount / 5) + ' msgs';
    if (bS) bS.textContent = Math.floor(amount / 15) + ' msgs';
    if (bO) bO.textContent = Math.floor(amount / 60) + ' msgs';
}

async function dashSendClawsTx() {
    const resultEl = document.getElementById('dashBuyResult');
    const sendBtn = document.getElementById('dashBuySendBtn');

    if (!window.ethereum) {
        resultEl.textContent = 'No wallet detected. Install MetaMask or another browser wallet.';
        resultEl.className = 'buy-result error';
        return;
    }

    const amount = buyState.selectedAmount;
    if (!amount || !buyState.clawsPerCredit) return;

    sendBtn.disabled = true;
    resultEl.innerHTML = '';

    try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (chainId !== BASE_CHAIN_ID) {
            try {
                await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID }] });
            } catch (e) {
                resultEl.textContent = 'Please switch to Base network in your wallet.';
                resultEl.className = 'buy-result error';
                sendBtn.disabled = false;
                return;
            }
        }

        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const from = accounts[0];

        const totalTokens = BigInt(amount) * BigInt(buyState.clawsPerCredit);
        const amountWei = totalTokens * BigInt('1000000000000000000');
        const selector = '0xa9059cbb';
        const paddedAddr = PROTOCOL_WALLET.slice(2).toLowerCase().padStart(64, '0');
        const paddedAmt = amountWei.toString(16).padStart(64, '0');
        const data = selector + paddedAddr + paddedAmt;

        resultEl.textContent = 'Confirm in your wallet...';
        resultEl.className = 'buy-result';

        const txHash = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{ from, to: CLAWS_ADDRESS, data }]
        });

        resultEl.textContent = 'Transaction sent! Verifying...';

        // Verify deposit
        const resp = await fetch(`${API_BASE}/credits`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ action: 'deposit', tx_hash: txHash })
        });
        const result = await resp.json();

        if (resp.ok) {
            resultEl.textContent = '+' + result.credits_added + ' credits added! New balance: ' + result.credits_total;
            resultEl.className = 'buy-result success';
            document.getElementById('ovCredits').textContent = result.credits_total;
            document.getElementById('dashBuyBalance').textContent = result.credits_total + ' credits';
        } else {
            resultEl.textContent = result.error || 'Verification failed.';
            resultEl.className = 'buy-result error';
            sendBtn.disabled = false;
        }
    } catch (e) {
        if (e.code === 4001) {
            resultEl.textContent = 'Transaction cancelled.';
        } else {
            resultEl.textContent = e.message || 'Transaction failed.';
        }
        resultEl.className = 'buy-result error';
        sendBtn.disabled = false;
    }
}

async function dashBuyWithCard() {
    const amount = buyState.selectedAmount;
    if (!amount || amount < 100) return;

    const cardBtn = document.getElementById('dashBuyCardBtn');
    const resultEl = document.getElementById('dashBuyResult');
    cardBtn.disabled = true;
    resultEl.innerHTML = '';

    try {
        const resp = await fetch(`${API_BASE}/create-checkout`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ credits: amount, return_path: '/dashboard' })
        });
        const data = await resp.json();

        if (resp.ok && data.url) {
            window.location.href = data.url;
        } else {
            resultEl.textContent = data.error || 'Failed to start checkout.';
            resultEl.className = 'buy-result error';
            cardBtn.disabled = false;
        }
    } catch (e) {
        resultEl.textContent = 'Network error. Try again.';
        resultEl.className = 'buy-result error';
        cardBtn.disabled = false;
    }
}

// ── Init ──
function init() {
    // Handle Stripe payment return
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
        const cr = params.get('credits');
        const resultEl = document.getElementById('dashBuyResult');
        if (resultEl) {
            resultEl.textContent = (cr ? cr + ' credits' : 'Credits') + ' added! Refreshing balance...';
            resultEl.className = 'buy-result success';
        }
        window.history.replaceState({}, '', '/dashboard');
    } else if (params.get('payment') === 'cancelled') {
        const resultEl = document.getElementById('dashBuyResult');
        if (resultEl) {
            resultEl.textContent = 'Payment cancelled.';
            resultEl.className = 'buy-result error';
        }
        window.history.replaceState({}, '', '/dashboard');
    }

    const auth = getStoredAuth();
    if (!auth) {
        document.getElementById('connectBanner')?.classList.remove('hidden');
        initBuyCredits();
        return;
    }

    // Fetch fresh profile
    const profile = auth.profile;
    fetch(`/api/inclawbate/humans?handle=${profile.x_handle}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
            if (data?.profile) {
                localStorage.setItem('inclawbate_profile', JSON.stringify(data.profile));
            }
        })
        .catch(() => {});

    // Wire API key buttons
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
        } catch (err) {}
        finally {
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

    // Init buy credits panel
    initBuyCredits();

    // Check Stripe payment return
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    if (payment) {
        history.replaceState(null, '', window.location.pathname);
        if (payment === 'success') {
            const credits = params.get('credits');
            setTimeout(() => {
                alert(credits ? 'Payment successful! ' + credits + ' credits added.' : 'Payment successful! Credits are being added.');
                loadOverview();
            }, 500);
        }
    }

    loadOverview();
    loadProjects();
    loadStakingPools();
}

// Boot
init();
