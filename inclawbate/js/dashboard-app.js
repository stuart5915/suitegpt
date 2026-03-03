// Inclawbate — Dashboard Controller (Overview + Inbox + Chat)
// Capacity is market-driven: agent share = total CLAWNCH paid / all CLAWNCH paid
import { getStoredAuth, logout } from './x-auth-client.js';

const API_BASE = '/api/inclawbate';
let conversations = [];
let filteredConversations = [];
let activeConvoId = null;
let pollTimer = null;
let lastMessageTime = null;
let currentDirection = 'inbound';
let currentFilter = 'all';
let currentView = 'overview';
let sending = false;
let pendingFile = null; // { file, name, type, dataUrl }
const seenMessageIds = new Set();
let notifications = [];
let notifLoaded = false;
const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB

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

function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function renderAttachment(msg) {
    if (!msg.file_url) return '';
    const name = esc(msg.file_name || 'file');
    const url = esc(msg.file_url);
    const type = msg.file_type || '';
    if (type.startsWith('image/')) {
        return `<div class="chat-msg-attachment"><img src="${url}" alt="${name}" onclick="window.open('${url}','_blank')"></div>`;
    }
    return `<div class="chat-msg-attachment"><a href="${url}" target="_blank" rel="noopener">\uD83D\uDCCE ${name}</a></div>`;
}

// ── Agent Shares (market-driven) ──
function getAgentShares() {
    const agentTotals = {};
    conversations.forEach(c => {
        const addr = c.agent_address;
        if (!addr) return;
        if (!agentTotals[addr]) {
            agentTotals[addr] = { total_paid: 0, agent_name: c.agent_name };
        }
        agentTotals[addr].total_paid += parseFloat(c.payment_amount) || 0;
        if (c.agent_name) agentTotals[addr].agent_name = c.agent_name;
    });

    const totalPaid = Object.values(agentTotals).reduce((sum, a) => sum + a.total_paid, 0);
    const shares = {};
    Object.entries(agentTotals).forEach(([addr, a]) => {
        shares[addr] = totalPaid > 0 ? Math.round((a.total_paid / totalPaid) * 100) : 0;
    });
    return { shares, totalPaid };
}

// ── Top Tab Switching ──
function switchTab(view) {
    if (view === currentView) return;
    currentView = view;

    // Update active tab
    document.querySelectorAll('.dash-top-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.dash-top-tab[data-view="${view}"]`)?.classList.add('active');

    // Hide all panels
    document.getElementById('dashOverview').classList.add('hidden');
    document.getElementById('dashInboxWrap').classList.add('hidden');
    document.getElementById('creditsPanel').classList.add('hidden');
    document.getElementById('notifPanel').classList.add('hidden');

    // Close any active chat
    activeConvoId = null;
    stopPolling();

    if (view === 'overview') {
        document.getElementById('dashOverview').classList.remove('hidden');
        loadOverview();
    } else if (view === 'inbox') {
        currentDirection = 'inbound';
        document.getElementById('dashInboxWrap').classList.remove('hidden');
        document.getElementById('outreachFilters').classList.add('hidden');
        resetChatPanel();
        loadConversations();
    } else if (view === 'outreach') {
        currentDirection = 'outbound';
        document.getElementById('dashInboxWrap').classList.remove('hidden');
        resetChatPanel();
        loadConversations();
    } else if (view === 'credits') {
        document.getElementById('creditsPanel').classList.remove('hidden');
        loadCreditsPanel();
    } else if (view === 'notifications') {
        document.getElementById('notifPanel').classList.remove('hidden');
        loadNotifications();
    }
}

function resetChatPanel() {
    document.getElementById('chatView')?.classList.add('hidden');
    document.getElementById('chatEmpty')?.classList.remove('hidden');
    document.getElementById('dashSidebar')?.classList.remove('chat-open');
    document.getElementById('dashMain')?.classList.add('no-chat');
    currentFilter = 'all';
    document.querySelectorAll('.dash-filter').forEach(c => c.classList.remove('active'));
    document.querySelector('.dash-filter[data-filter="all"]')?.classList.add('active');
}

// ── Overview ──
async function loadOverview() {
    const auth = getStoredAuth();
    if (!auth) return;
    const profile = auth.profile;

    renderProfileCard(profile);

    // Parallel fetch all data
    const [credits, projects, convos, apps] = await Promise.allSettled([
        fetch(`${API_BASE}/credits`, { headers: authHeaders() }).then(r => r.ok ? r.json() : null),
        profile.wallet_address
            ? fetch(`${API_BASE}/inclawbator?wallet=${encodeURIComponent(profile.wallet_address)}`).then(r => r.ok ? r.json() : null)
            : Promise.resolve(null),
        fetch(`${API_BASE}/conversations`, { headers: authHeaders() }).then(r => r.ok ? r.json() : null),
        profile.x_handle
            ? fetch(`${API_BASE}/apps?creator=${encodeURIComponent(profile.x_handle)}`).then(r => r.ok ? r.json() : null)
            : Promise.resolve(null)
    ]);

    const creditsData = credits.status === 'fulfilled' ? credits.value : null;
    const projectsData = projects.status === 'fulfilled' ? projects.value : null;
    const convosData = convos.status === 'fulfilled' ? convos.value : null;
    const appsData = apps.status === 'fulfilled' ? apps.value : null;

    // Update stat cards
    document.getElementById('ovCredits').textContent = creditsData?.credits ?? 0;
    document.getElementById('ovProjects').textContent = projectsData?.projects?.length ?? 0;
    document.getElementById('ovApps').textContent = appsData?.apps?.length ?? appsData?.total ?? 0;
    document.getElementById('ovConvos').textContent = convosData?.conversations?.length ?? 0;

    renderProjectCards(projectsData?.projects || []);
    renderAppCards(appsData?.apps || []);
    renderRecentConvos(convosData?.conversations || []);
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
    `;
}

function renderProjectCards(projects) {
    const container = document.getElementById('overviewProjectList');
    if (!projects.length) {
        container.innerHTML = '<div class="overview-empty"><p>No projects yet. <a href="/inclawbator">Launch your first token</a></p></div>';
        return;
    }

    container.innerHTML = '';
    projects.slice(0, 5).forEach(p => {
        const status = (p.status || 'pending').toLowerCase();
        const badgeClass = status === 'funded' ? 'funded' : status === 'building' ? 'building' : status === 'live' ? 'live' : 'pending';
        const el = document.createElement('div');
        el.className = 'overview-item';
        el.innerHTML = `
            <div class="overview-item-info">
                <div class="overview-item-title">${esc(p.token_name || p.name || 'Untitled')}</div>
                <div class="overview-item-sub">${p.token_ticker ? '$' + esc(p.token_ticker) : ''} ${p.created_at ? '· ' + timeAgo(p.created_at) : ''}</div>
            </div>
            <span class="overview-item-badge ${badgeClass}">${esc(status)}</span>
            <a href="/inclawbator/${p.id}" class="overview-item-action">Manage</a>
        `;
        container.appendChild(el);
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
            <a href="/apps/${a.slug || a.id}" class="overview-item-action">View</a>
        `;
        container.appendChild(el);
    });
}

function renderRecentConvos(convos) {
    const container = document.getElementById('overviewConvoList');
    if (!convos.length) {
        container.innerHTML = '<div class="overview-empty"><p>No conversations yet.</p></div>';
        return;
    }

    container.innerHTML = '';
    convos.slice(0, 5).forEach(c => {
        const name = c.agent_name || 'Unknown Agent';
        const el = document.createElement('div');
        el.className = 'overview-item';
        el.style.cursor = 'pointer';
        el.innerHTML = `
            <div class="overview-item-info">
                <div class="overview-item-title">${esc(name)}</div>
                <div class="overview-item-sub">${timeAgo(c.last_message_at || c.created_at)}</div>
            </div>
        `;
        el.addEventListener('click', () => {
            switchTab('inbox');
            setTimeout(() => openConversation(c.id), 300);
        });
        container.appendChild(el);
    });
}

// ── Init ──
function init() {
    const auth = getStoredAuth();
    if (!auth) {
        document.getElementById('loginGate').classList.remove('hidden');
        return;
    }

    document.getElementById('dashboardView').classList.remove('hidden');

    // Mark inbox as visited (clears unread badge)
    localStorage.setItem('inclawbate_last_inbox', new Date().toISOString());

    // Fetch fresh profile from API to check Telegram status
    const profile = auth.profile;
    fetch(`/api/inclawbate/humans?handle=${profile.x_handle}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
            if (!data || !data.profile) return;
            const fresh = data.profile;
            localStorage.setItem('inclawbate_profile', JSON.stringify(fresh));
            if (fresh.telegram_chat_id) {
                document.getElementById('telegramBar').classList.add('hidden');
                document.getElementById('telegramConnected').classList.remove('hidden');
            } else {
                document.getElementById('telegramBar').classList.remove('hidden');
                document.getElementById('telegramBarBtn').href = `https://t.me/inclawbate_bot?start=${profile.x_handle}`;
            }
        })
        .catch(() => {
            if (profile.telegram_chat_id) {
                document.getElementById('telegramConnected').classList.remove('hidden');
            } else {
                document.getElementById('telegramBar').classList.remove('hidden');
                document.getElementById('telegramBarBtn').href = `https://t.me/inclawbate_bot?start=${profile.x_handle}`;
            }
        });

    // Top tab switching
    document.querySelectorAll('.dash-top-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            switchTab(tab.dataset.view);
        });
    });

    // Wire credits panel buttons
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

    // Outreach filter chips
    document.querySelectorAll('.dash-filter').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.dash-filter').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.dataset.filter;
            applyFilter();
        });
    });

    // Default to overview
    loadOverview();

    // Load unread notification count for badge
    loadNotifBadge();
}

function applyFilter() {
    if (currentDirection !== 'outbound' || currentFilter === 'all') {
        filteredConversations = conversations;
    } else if (currentFilter === 'no-replies') {
        filteredConversations = conversations.filter(c => c.message_count > 0 && !c.has_human_reply);
    } else if (currentFilter === 'has-replies') {
        filteredConversations = conversations.filter(c => c.has_human_reply);
    } else if (currentFilter === 'no-messages') {
        filteredConversations = conversations.filter(c => !c.message_count || c.message_count === 0);
    } else {
        filteredConversations = conversations;
    }
    renderConversationList();
    updateStats();
}

// ── Load Conversations ──
async function loadConversations() {
    try {
        const dirParam = currentDirection === 'outbound' ? '?direction=outbound' : '';
        const res = await fetch(`${API_BASE}/conversations${dirParam}`, { headers: authHeaders() });
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        conversations = data.conversations || [];

        // Show/hide outreach filters
        const filtersEl = document.getElementById('outreachFilters');
        if (currentDirection === 'outbound') {
            filtersEl.classList.remove('hidden');
        } else {
            filtersEl.classList.add('hidden');
        }

        applyFilter();
    } catch (err) {
        // Load failed
    }
}

function updateStats() {
    if (currentDirection === 'outbound') {
        const totalSent = conversations.reduce((sum, c) => sum + (parseFloat(c.payment_amount) || 0), 0);
        const uniqueHumans = new Set(conversations.map(c => c.human_id)).size;
        document.getElementById('statAgents').textContent = uniqueHumans;
        document.getElementById('statEarnings').textContent = totalSent > 0 ? totalSent.toLocaleString() : '0';
        document.getElementById('statAllocated').textContent = conversations.length;

        document.querySelector('.dash-stat:nth-child(1) .dash-stat-label').textContent = 'Humans';
        document.querySelector('.dash-stat:nth-child(2) .dash-stat-label').textContent = 'CLAWNCH Sent';
        document.querySelector('.dash-stat:nth-child(3) .dash-stat-label').textContent = 'Conversations';
    } else {
        const { shares, totalPaid } = getAgentShares();
        const uniqueAgents = Object.keys(shares).filter(addr => shares[addr] >= 1).length;
        const allocated = totalPaid > 0 ? 100 : 0;

        document.getElementById('statAgents').textContent = uniqueAgents;
        document.getElementById('statEarnings').textContent = totalPaid > 0 ? totalPaid.toLocaleString() : '0';
        document.getElementById('statAllocated').textContent = allocated + '%';

        document.querySelector('.dash-stat:nth-child(1) .dash-stat-label').textContent = 'Agents';
        document.querySelector('.dash-stat:nth-child(2) .dash-stat-label').textContent = 'CLAWNCH';
        document.querySelector('.dash-stat:nth-child(3) .dash-stat-label').textContent = 'Allocated';
    }
}

function renderConversationList() {
    const container = document.getElementById('convoList');
    const noConvos = document.getElementById('noConvos');

    if (filteredConversations.length === 0) {
        if (conversations.length === 0) {
            noConvos.innerHTML = currentDirection === 'outbound'
                ? `<p>No outreach yet. Visit a human's profile and click "Hire Me" to start.</p>`
                : `<p>No conversations yet. When an agent hires you, it'll show up here.</p>`;
        } else {
            noConvos.innerHTML = `<p>No conversations matching this filter.</p>`;
        }
        noConvos.classList.remove('hidden');
        container.querySelectorAll('.dash-convo-item').forEach(el => el.remove());
        return;
    }

    noConvos.classList.add('hidden');
    container.querySelectorAll('.dash-convo-item').forEach(el => el.remove());

    const { shares } = getAgentShares();

    filteredConversations.forEach(c => {
        const el = document.createElement('div');
        el.className = `dash-convo-item${c.id === activeConvoId ? ' active' : ''}`;
        el.dataset.id = c.id;

        const amount = parseFloat(c.payment_amount) || 0;

        if (currentDirection === 'outbound') {
            const name = c.human_x_name || c.human_x_handle || 'Unknown';
            const initial = name[0].toUpperCase();
            let statusClass = 'no-messages';
            if (c.message_count > 0 && c.has_human_reply) statusClass = 'replied';
            else if (c.message_count > 0) statusClass = 'unreplied';

            el.innerHTML = `
                <div class="dash-convo-avatar">${c.human_x_avatar_url
                    ? `<img src="${esc(c.human_x_avatar_url)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
                    : initial}</div>
                <div class="dash-convo-info">
                    <div class="dash-convo-name">${esc(name)}</div>
                    <div class="dash-convo-preview">${c.human_x_handle ? '@' + esc(c.human_x_handle) : ''}</div>
                </div>
                <div class="dash-convo-meta">
                    <div class="dash-convo-time">${timeAgo(c.last_message_at || c.created_at)}</div>
                    ${amount > 0 ? `<div class="dash-convo-amount">${amount.toLocaleString()} C</div>` : ''}
                </div>
                <div class="dash-convo-status ${statusClass}" title="${statusClass === 'replied' ? 'Has replied' : statusClass === 'unreplied' ? 'Awaiting reply' : 'No messages'}"></div>
            `;
        } else {
            const initial = (c.agent_name || 'A')[0].toUpperCase();
            const agentShare = shares[c.agent_address] || 0;
            el.innerHTML = `
                <div class="dash-convo-avatar">${initial}</div>
                <div class="dash-convo-info">
                    <div class="dash-convo-name">${esc(c.agent_name || 'Unknown Agent')}</div>
                    <div class="dash-convo-preview">${agentShare >= 1 ? `${agentShare}% of your capacity` : 'Below 1% threshold'}</div>
                </div>
                <div class="dash-convo-meta">
                    <div class="dash-convo-time">${timeAgo(c.last_message_at || c.created_at)}</div>
                    ${amount > 0 ? `<div class="dash-convo-amount">${amount.toLocaleString()} C</div>` : ''}
                </div>
            `;
        }

        el.addEventListener('click', () => openConversation(c.id));
        container.appendChild(el);
    });
}

// ── Open Conversation ──
async function openConversation(convoId) {
    activeConvoId = convoId;

    document.querySelectorAll('.dash-convo-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === convoId);
    });

    document.getElementById('chatEmpty').classList.add('hidden');
    const chatView = document.getElementById('chatView');
    chatView.classList.remove('hidden');
    chatView.style.display = 'flex';

    // Mobile: hide sidebar
    document.getElementById('dashSidebar').classList.add('chat-open');
    document.getElementById('dashMain').classList.remove('no-chat');

    const convo = conversations.find(c => c.id === convoId);
    if (convo) {
        const amount = parseFloat(convo.payment_amount) || 0;

        if (currentDirection === 'outbound') {
            const name = convo.human_x_name || convo.human_x_handle || 'Unknown';
            const avatarEl = document.getElementById('chatAgentAvatar');
            if (convo.human_x_avatar_url) {
                avatarEl.innerHTML = `<img src="${esc(convo.human_x_avatar_url)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
            } else {
                avatarEl.textContent = name[0].toUpperCase();
            }
            document.getElementById('chatAgentName').textContent = `You \u2192 ${name}`;
            document.getElementById('chatAgentAddr').textContent = convo.human_x_handle ? `@${convo.human_x_handle}` : '';
            document.getElementById('chatPaymentBadge').textContent = amount > 0 ? `${amount.toLocaleString()} CLAWNCH sent` : 'No payment yet';
            document.getElementById('chatInput').placeholder = convo.human_x_handle ? `Message @${convo.human_x_handle}...` : 'Send a message...';
        } else {
            const initial = (convo.agent_name || 'A')[0].toUpperCase();
            document.getElementById('chatAgentAvatar').innerHTML = '';
            document.getElementById('chatAgentAvatar').textContent = initial;
            document.getElementById('chatAgentName').textContent = convo.agent_name || 'Unknown Agent';
            document.getElementById('chatAgentAddr').textContent = convo.agent_address
                ? convo.agent_address.slice(0, 6) + '...' + convo.agent_address.slice(-4)
                : '';

            const { shares } = getAgentShares();
            const agentShare = shares[convo.agent_address] || 0;
            const badge = amount > 0 ? `${amount.toLocaleString()} CLAWNCH` : 'No payment yet';
            document.getElementById('chatPaymentBadge').textContent = agentShare >= 1 ? `${badge} · ${agentShare}% capacity` : badge;
            document.getElementById('chatInput').placeholder = 'Reply to this agent...';
        }
    }

    await loadMessages(convoId);
    startPolling(convoId);
}

async function loadMessages(convoId) {
    try {
        const res = await fetch(`${API_BASE}/conversations?id=${convoId}`, { headers: authHeaders() });
        if (!res.ok) throw new Error('Failed to load messages');
        const data = await res.json();
        renderMessages(data.messages || []);
    } catch (err) {
        // Load failed
    }
}

function renderMessages(messages) {
    const container = document.getElementById('chatMessages');
    container.innerHTML = '';
    seenMessageIds.clear();

    if (messages.length === 0) {
        const emptyText = currentDirection === 'outbound'
            ? 'No messages yet. Send the first message to start the conversation.'
            : 'No messages yet. The agent will send the first message.';
        container.innerHTML = `<div style="text-align:center;color:var(--text-dim);padding:var(--space-2xl);font-size:0.88rem;">${emptyText}</div>`;
        lastMessageTime = null;
        return;
    }

    messages.forEach(msg => {
        seenMessageIds.add(msg.id);
        const el = document.createElement('div');
        const isYou = currentDirection === 'outbound'
            ? msg.sender_type === 'agent'
            : msg.sender_type === 'human';
        el.className = `chat-msg ${isYou ? 'human' : 'agent'}`;
        const senderLabel = isYou ? 'You' : (currentDirection === 'outbound' ? 'Them' : 'Agent');
        const contentHtml = msg.content ? `<div class="chat-msg-content">${esc(msg.content)}</div>` : '';
        el.innerHTML = `
            <div class="chat-msg-sender">${senderLabel}</div>
            ${contentHtml}
            ${renderAttachment(msg)}
            <div class="chat-msg-time">${formatTime(msg.created_at)}</div>
        `;
        container.appendChild(el);
    });

    lastMessageTime = messages[messages.length - 1].created_at;
    container.scrollTop = container.scrollHeight;
}

// ── Polling for new messages ──
function startPolling(convoId) {
    stopPolling();
    pollTimer = setInterval(async () => {
        if (convoId !== activeConvoId) return;
        try {
            const after = lastMessageTime ? `&after=${encodeURIComponent(lastMessageTime)}` : '';
            const res = await fetch(
                `${API_BASE}/messages?conversation_id=${convoId}${after}`,
                { headers: authHeaders() }
            );
            if (!res.ok) return;
            const data = await res.json();
            if (data.messages && data.messages.length > 0) {
                appendMessages(data.messages);
            }
        } catch (err) {
            // Silent fail on poll
        }
    }, 15000);
}

function stopPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

function appendMessages(messages) {
    const container = document.getElementById('chatMessages');
    const placeholder = container.querySelector('div[style]');
    if (placeholder && container.children.length === 1) {
        container.innerHTML = '';
    }

    const newMsgs = messages.filter(msg => !seenMessageIds.has(msg.id));
    if (newMsgs.length === 0) return;

    newMsgs.forEach(msg => {
        seenMessageIds.add(msg.id);
        const el = document.createElement('div');
        const isYou = currentDirection === 'outbound'
            ? msg.sender_type === 'agent'
            : msg.sender_type === 'human';
        el.className = `chat-msg ${isYou ? 'human' : 'agent'}`;
        const senderLabel = isYou ? 'You' : (currentDirection === 'outbound' ? 'Them' : 'Agent');
        const contentHtml = msg.content ? `<div class="chat-msg-content">${esc(msg.content)}</div>` : '';
        el.innerHTML = `
            <div class="chat-msg-sender">${senderLabel}</div>
            ${contentHtml}
            ${renderAttachment(msg)}
            <div class="chat-msg-time">${formatTime(msg.created_at)}</div>
        `;
        container.appendChild(el);
    });

    lastMessageTime = newMsgs[newMsgs.length - 1].created_at;
    container.scrollTop = container.scrollHeight;

    loadConversations();
}

// ── Send Message ──
async function sendMessage() {
    if (sending) return;
    const input = document.getElementById('chatInput');
    const content = input.value.trim();
    if (!content && !pendingFile) return;
    if (!activeConvoId) return;

    sending = true;
    const btn = document.getElementById('chatSendBtn');
    btn.disabled = true;

    try {
        let fileData = null;

        if (pendingFile) {
            const inputBar = document.querySelector('.chat-input-bar');
            inputBar.classList.add('chat-attach-uploading');

            const uploadRes = await fetch(`${API_BASE}/upload`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    file_data: pendingFile.dataUrl,
                    file_name: pendingFile.name,
                    file_type: pendingFile.type
                })
            });

            inputBar.classList.remove('chat-attach-uploading');

            if (!uploadRes.ok) {
                const err = await uploadRes.json().catch(() => ({}));
                throw new Error(err.error || 'File upload failed');
            }

            fileData = await uploadRes.json();
        }

        const body = {
            conversation_id: activeConvoId,
            sender_type: currentDirection === 'outbound' ? 'agent' : 'human',
            content: content || ''
        };
        if (fileData) {
            body.file_url = fileData.url;
            body.file_name = fileData.file_name;
            body.file_type = fileData.file_type;
        }

        const res = await fetch(`${API_BASE}/messages`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to send');
        }

        const data = await res.json();
        input.value = '';
        input.style.height = 'auto';
        clearAttachment();
        appendMessages([data.message]);

    } catch (err) {
        alert('Failed to send: ' + err.message);
    } finally {
        sending = false;
        btn.disabled = false;
    }
}

function clearAttachment() {
    pendingFile = null;
    const preview = document.getElementById('attachPreview');
    if (preview) preview.classList.add('hidden');
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';
    updateSendBtn();
}

function updateSendBtn() {
    const input = document.getElementById('chatInput');
    const btn = document.getElementById('chatSendBtn');
    if (btn) btn.disabled = !(input?.value.trim() || pendingFile);
}

// ── Events ──

document.getElementById('chatSendBtn')?.addEventListener('click', sendMessage);

document.getElementById('chatInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

document.getElementById('chatInput')?.addEventListener('input', (e) => {
    updateSendBtn();
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
});

document.getElementById('attachBtn')?.addEventListener('click', () => {
    document.getElementById('fileInput')?.click();
});

document.getElementById('fileInput')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
        alert('File too large (max 3MB)');
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        pendingFile = {
            file,
            name: file.name,
            type: file.type,
            dataUrl: reader.result
        };
        const preview = document.getElementById('attachPreview');
        document.getElementById('attachName').textContent = file.name;
        preview.classList.remove('hidden');
        updateSendBtn();
    };
    reader.readAsDataURL(file);
});

document.getElementById('attachRemove')?.addEventListener('click', clearAttachment);

document.getElementById('chatBackBtn')?.addEventListener('click', () => {
    document.getElementById('dashSidebar').classList.remove('chat-open');
    document.getElementById('dashMain').classList.add('no-chat');
    document.getElementById('chatView').classList.add('hidden');
    document.getElementById('chatEmpty').classList.remove('hidden');
    activeConvoId = null;
    stopPolling();
});

// ── Credits Panel ──
async function loadCreditsPanel() {
    try {
        const res = await fetch(`${API_BASE}/credits`, { headers: authHeaders() });
        if (!res.ok) return;
        const data = await res.json();

        document.getElementById('creditBalance').textContent = data.credits ?? '--';
        if (data.api_key) {
            document.getElementById('dashApiKey').value = data.api_key;
        }
    } catch (err) {
        // Silent
    }
}

// ── Notifications ──
function getWallet() {
    try {
        const p = JSON.parse(localStorage.getItem('inclawbate_profile') || '{}');
        return p.wallet_address || null;
    } catch { return null; }
}

async function loadNotifBadge() {
    const wallet = getWallet();
    if (!wallet) return;
    try {
        const res = await fetch(`${API_BASE}/notifications?wallet=${wallet}`);
        if (!res.ok) return;
        const data = await res.json();
        updateNotifBadge(data.unread_count || 0);
    } catch { /* silent */ }
}

async function loadNotifications() {
    const wallet = getWallet();
    if (!wallet) {
        document.getElementById('notifItems').innerHTML =
            '<div class="dash-no-convos"><p>Connect a wallet on your profile to receive notifications.</p></div>';
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/notifications?wallet=${wallet}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        notifications = data.notifications || [];
        notifLoaded = true;
        updateNotifBadge(data.unread_count || 0);
        renderNotifications();
    } catch {
        document.getElementById('notifItems').innerHTML =
            '<div class="dash-no-convos"><p>Failed to load notifications.</p></div>';
    }
}

function renderNotifications() {
    const container = document.getElementById('notifItems');
    const noNotifs = document.getElementById('noNotifs');

    if (notifications.length === 0) {
        container.innerHTML = '';
        container.appendChild(noNotifs);
        noNotifs.style.display = '';
        return;
    }

    container.innerHTML = '';

    notifications.forEach(n => {
        const el = document.createElement('div');
        el.className = `dash-notif-item${n.read ? '' : ' unread'}`;

        const icon = n.type === 'fund' ? '\uD83D\uDCB0' : '\uD83D\uDCAC';
        const fromLabel = n.from_handle ? `@${esc(n.from_handle)}` : (n.from_wallet ? n.from_wallet.slice(0, 6) + '...' + n.from_wallet.slice(-4) : 'Someone');

        el.innerHTML = `
            <div class="dash-notif-icon">${icon}</div>
            <div class="dash-notif-body">
                <div class="dash-notif-text"><strong>${fromLabel}</strong> ${esc(n.message)}</div>
                <div class="dash-notif-time">${timeAgo(n.created_at)}</div>
            </div>
            ${n.read ? '' : '<div class="dash-notif-dot"></div>'}
        `;

        el.addEventListener('click', () => {
            if (!n.read) markNotifRead(n.id);
        });

        container.appendChild(el);
    });
}

function updateNotifBadge(count) {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'inline';
    } else {
        badge.style.display = 'none';
    }
}

async function markNotifRead(notifId) {
    const wallet = getWallet();
    if (!wallet) return;

    try {
        await fetch(`${API_BASE}/notifications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'mark_read',
                wallet_address: wallet,
                notification_id: notifId
            })
        });

        const n = notifications.find(x => x.id === notifId);
        if (n) n.read = true;
        const unread = notifications.filter(x => !x.read).length;
        updateNotifBadge(unread);
        renderNotifications();
    } catch { /* silent */ }
}

async function markAllNotifsRead() {
    const wallet = getWallet();
    if (!wallet) return;

    try {
        await fetch(`${API_BASE}/notifications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'mark_read',
                wallet_address: wallet
            })
        });

        notifications.forEach(n => { n.read = true; });
        updateNotifBadge(0);
        renderNotifications();
    } catch { /* silent */ }
}

document.getElementById('markAllRead')?.addEventListener('click', markAllNotifsRead);

// Boot
init();
