// Inclawbate — Dashboard Controller (Inbox + Chat)
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
let sending = false;
const seenMessageIds = new Set();

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

// ── Agent Shares (market-driven) ──
// Groups all payments by agent_address across all conversations
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

    // Tab switching
    document.querySelectorAll('.dash-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const dir = tab.dataset.dir;
            if (dir === currentDirection) return;
            currentDirection = dir;
            document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Close any open conversation
            activeConvoId = null;
            stopPolling();
            document.getElementById('chatView').classList.add('hidden');
            document.getElementById('chatEmpty').classList.remove('hidden');
            document.getElementById('dashSidebar').classList.remove('chat-open');
            document.getElementById('dashMain').classList.add('no-chat');

            // Toggle credits panel vs conversation view
            const creditsPanel = document.getElementById('creditsPanel');
            const convoList = document.getElementById('convoList');
            const statsEl = document.querySelector('.dash-stats');
            const telegramBar = document.getElementById('telegramBar');
            const telegramConn = document.getElementById('telegramConnected');

            if (dir === 'credits') {
                convoList.classList.add('hidden');
                statsEl.classList.add('hidden');
                telegramBar.classList.add('hidden');
                telegramConn.classList.add('hidden');
                creditsPanel.classList.remove('hidden');
                document.getElementById('dashMain').classList.add('hidden');
                loadCreditsPanel();
                return;
            }

            // Restore conversation view
            creditsPanel.classList.add('hidden');
            convoList.classList.remove('hidden');
            statsEl.classList.remove('hidden');
            document.getElementById('dashMain').classList.remove('hidden');

            // Reset filter
            currentFilter = 'all';
            document.querySelectorAll('.dash-filter').forEach(c => c.classList.remove('active'));
            document.querySelector('.dash-filter[data-filter="all"]')?.classList.add('active');

            // Update empty state text
            const emptyEl = document.getElementById('chatEmpty');
            if (dir === 'outbound') {
                emptyEl.querySelector('h3').textContent = 'Select a conversation';
                emptyEl.querySelector('p').textContent = 'Click a conversation to see your outreach messages.';
            } else {
                emptyEl.querySelector('h3').textContent = 'Select a conversation';
                emptyEl.querySelector('p').textContent = 'Click a conversation from your inbox to see messages from the agent and reply.';
            }

            loadConversations();
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

    loadConversations();
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
        // Outreach stats: humans hired, CLAWNCH sent, conversations
        const totalSent = conversations.reduce((sum, c) => sum + (parseFloat(c.payment_amount) || 0), 0);
        const uniqueHumans = new Set(conversations.map(c => c.human_id)).size;
        document.getElementById('statAgents').textContent = uniqueHumans;
        document.getElementById('statEarnings').textContent = totalSent > 0 ? totalSent.toLocaleString() : '0';
        document.getElementById('statAllocated').textContent = conversations.length;

        document.querySelector('.dash-stat:nth-child(1) .dash-stat-label').textContent = 'Humans';
        document.querySelector('.dash-stat:nth-child(2) .dash-stat-label').textContent = 'CLAWNCH Sent';
        document.querySelector('.dash-stat:nth-child(3) .dash-stat-label').textContent = 'Conversations';
    } else {
        // Inbound stats (original)
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
            // Show the hired human's info
            const name = c.human_x_name || c.human_x_handle || 'Unknown';
            const initial = name[0].toUpperCase();
            // Status dot
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
            // Inbound: show agent info (original behavior)
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
            // Outbound: show the hired human's info
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
            // Inbound: show agent info (original behavior)
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
        // In outbound direction, the "agent" messages are from YOU (the payer) and "human" messages are from the hired person
        const isYou = currentDirection === 'outbound'
            ? msg.sender_type === 'agent'
            : msg.sender_type === 'human';
        el.className = `chat-msg ${isYou ? 'human' : 'agent'}`;
        const senderLabel = isYou ? 'You' : (currentDirection === 'outbound' ? 'Them' : 'Agent');
        el.innerHTML = `
            <div class="chat-msg-sender">${senderLabel}</div>
            <div class="chat-msg-content">${esc(msg.content)}</div>
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

    // Deduplicate — skip messages we've already rendered
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
        el.innerHTML = `
            <div class="chat-msg-sender">${senderLabel}</div>
            <div class="chat-msg-content">${esc(msg.content)}</div>
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
    if (sending) return; // Prevent double-send
    const input = document.getElementById('chatInput');
    const content = input.value.trim();
    if (!content || !activeConvoId) return;

    sending = true;
    const btn = document.getElementById('chatSendBtn');
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/messages`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
                conversation_id: activeConvoId,
                sender_type: currentDirection === 'outbound' ? 'agent' : 'human',
                content
            })
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to send');
        }

        const data = await res.json();
        input.value = '';
        input.style.height = 'auto';
        appendMessages([data.message]);

    } catch (err) {
        alert('Failed to send: ' + err.message);
    } finally {
        sending = false;
        btn.disabled = false;
    }
}

// ── Events ──

// Send button
document.getElementById('chatSendBtn')?.addEventListener('click', sendMessage);

// Enter to send (shift+enter for newline)
document.getElementById('chatInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Enable/disable send button based on input
document.getElementById('chatInput')?.addEventListener('input', (e) => {
    document.getElementById('chatSendBtn').disabled = !e.target.value.trim();
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
});

// Mobile back button
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

// Boot
init();
