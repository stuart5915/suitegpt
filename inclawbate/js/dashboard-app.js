// Inclawbate — Dashboard Controller (Inbox + Chat)
import { getStoredAuth, logout } from './x-auth-client.js';

const API_BASE = '/api/inclawbate';
let conversations = [];
let activeConvoId = null;
let pollTimer = null;
let lastMessageTime = null;

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

    // Set capacity from stored profile
    const profile = auth.profile;
    const capacity = profile.available_capacity !== undefined ? profile.available_capacity : 100;
    document.getElementById('statCapacity').textContent = capacity + '%';

    // Fetch fresh profile from API to check Telegram status
    fetch(`/api/inclawbate/humans?handle=${profile.x_handle}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
            if (!data || !data.profile) return;
            const fresh = data.profile;
            // Update localStorage with fresh data
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
            // Fallback to localStorage
            if (profile.telegram_chat_id) {
                document.getElementById('telegramConnected').classList.remove('hidden');
            } else {
                document.getElementById('telegramBar').classList.remove('hidden');
                document.getElementById('telegramBarBtn').href = `https://t.me/inclawbate_bot?start=${profile.x_handle}`;
            }
        });

    loadConversations();
}

// ── Load Conversations ──
async function loadConversations() {
    try {
        const res = await fetch(`${API_BASE}/conversations`, { headers: authHeaders() });
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        conversations = data.conversations || [];
        renderConversationList();
        updateStats();
    } catch (err) {
        // Load failed
    }
}

function updateStats() {
    const active = conversations.filter(c => c.status === 'active').length;
    const totalEarnings = conversations.reduce((sum, c) => sum + (parseFloat(c.payment_amount) || 0), 0);
    document.getElementById('statConversations').textContent = active;
    document.getElementById('statEarnings').textContent = totalEarnings > 0 ? totalEarnings.toLocaleString() : '0';
    document.getElementById('statCapacity').textContent = active > 0 ? '0%' : '100%';
}

// Calculate payment-weighted capacity shares for active conversations
function getCapacityShares() {
    const active = conversations.filter(c => c.status === 'active');
    const totalPayment = active.reduce((sum, c) => sum + Math.max(parseFloat(c.payment_amount) || 0, 1), 0);
    const shares = {};
    active.forEach(c => {
        shares[c.id] = Math.round((Math.max(parseFloat(c.payment_amount) || 0, 1) / totalPayment) * 100);
    });
    return shares;
}

function renderConversationList() {
    const container = document.getElementById('convoList');
    const noConvos = document.getElementById('noConvos');

    if (conversations.length === 0) {
        noConvos.classList.remove('hidden');
        container.querySelectorAll('.dash-convo-item').forEach(el => el.remove());
        return;
    }

    noConvos.classList.add('hidden');

    // Clear old items
    container.querySelectorAll('.dash-convo-item').forEach(el => el.remove());

    const shares = getCapacityShares();

    conversations.forEach(c => {
        const el = document.createElement('div');
        el.className = `dash-convo-item${c.id === activeConvoId ? ' active' : ''}`;
        el.dataset.id = c.id;

        const initial = (c.agent_name || 'A')[0].toUpperCase();
        const amount = parseFloat(c.payment_amount) || 0;
        const share = shares[c.id];
        const isActive = c.status === 'active';

        el.innerHTML = `
            <div class="dash-convo-avatar">${initial}</div>
            <div class="dash-convo-info">
                <div class="dash-convo-name">${esc(c.agent_name || 'Unknown Agent')}</div>
                <div class="dash-convo-preview">${isActive && share ? `${share}% of your capacity` : esc(c.status)}</div>
            </div>
            <div class="dash-convo-meta">
                <div class="dash-convo-time">${timeAgo(c.last_message_at || c.created_at)}</div>
                ${amount > 0 ? `<div class="dash-convo-amount">${amount.toLocaleString()} C</div>` : ''}
            </div>
        `;

        el.addEventListener('click', () => openConversation(c.id));
        container.appendChild(el);
    });
}

// ── Open Conversation ──
async function openConversation(convoId) {
    activeConvoId = convoId;

    // Update active state in list
    document.querySelectorAll('.dash-convo-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === convoId);
    });

    // Show chat view
    document.getElementById('chatEmpty').classList.add('hidden');
    const chatView = document.getElementById('chatView');
    chatView.classList.remove('hidden');
    chatView.style.display = 'flex';

    // Mobile: hide sidebar
    document.getElementById('dashSidebar').classList.add('chat-open');
    document.getElementById('dashMain').classList.remove('no-chat');

    const convo = conversations.find(c => c.id === convoId);
    if (convo) {
        const initial = (convo.agent_name || 'A')[0].toUpperCase();
        document.getElementById('chatAgentAvatar').textContent = initial;
        document.getElementById('chatAgentName').textContent = convo.agent_name || 'Unknown Agent';
        document.getElementById('chatAgentAddr').textContent = convo.agent_address
            ? convo.agent_address.slice(0, 6) + '...' + convo.agent_address.slice(-4)
            : '';
        const amount = parseFloat(convo.payment_amount) || 0;
        const shares = getCapacityShares();
        const share = shares[convo.id];
        const badge = amount > 0 ? `${amount.toLocaleString()} CLAWNCH` : 'No payment yet';
        document.getElementById('chatPaymentBadge').textContent = share ? `${badge} · ${share}% capacity` : badge;

        const completeBtn = document.getElementById('chatCompleteBtn');
        if (convo.status === 'active') {
            completeBtn.style.display = '';
            completeBtn.textContent = 'Complete';
            completeBtn.disabled = false;
        } else {
            completeBtn.style.display = 'none';
        }
    }

    // Load messages
    await loadMessages(convoId);

    // Start polling for new messages
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

    if (messages.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:var(--space-2xl);font-size:0.88rem;">No messages yet. The agent will send the first message.</div>';
        lastMessageTime = null;
        return;
    }

    messages.forEach(msg => {
        const el = document.createElement('div');
        el.className = `chat-msg ${msg.sender_type}`;
        el.innerHTML = `
            <div class="chat-msg-sender">${msg.sender_type === 'agent' ? 'Agent' : 'You'}</div>
            <div class="chat-msg-content">${esc(msg.content)}</div>
            <div class="chat-msg-time">${formatTime(msg.created_at)}</div>
        `;
        container.appendChild(el);
    });

    lastMessageTime = messages[messages.length - 1].created_at;

    // Scroll to bottom
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
    // Remove "no messages" placeholder if it exists
    const placeholder = container.querySelector('div[style]');
    if (placeholder && container.children.length === 1) {
        container.innerHTML = '';
    }

    messages.forEach(msg => {
        const el = document.createElement('div');
        el.className = `chat-msg ${msg.sender_type}`;
        el.innerHTML = `
            <div class="chat-msg-sender">${msg.sender_type === 'agent' ? 'Agent' : 'You'}</div>
            <div class="chat-msg-content">${esc(msg.content)}</div>
            <div class="chat-msg-time">${formatTime(msg.created_at)}</div>
        `;
        container.appendChild(el);
    });

    lastMessageTime = messages[messages.length - 1].created_at;
    container.scrollTop = container.scrollHeight;

    // Also refresh conversation list to update previews
    loadConversations();
}

// ── Send Message ──
async function sendMessage() {
    const input = document.getElementById('chatInput');
    const content = input.value.trim();
    if (!content || !activeConvoId) return;

    const btn = document.getElementById('chatSendBtn');
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/messages`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
                conversation_id: activeConvoId,
                sender_type: 'human',
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
        // Send failed
        alert('Failed to send: ' + err.message);
    } finally {
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
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
});

// Complete conversation
document.getElementById('chatCompleteBtn')?.addEventListener('click', async () => {
    if (!activeConvoId) return;
    const btn = document.getElementById('chatCompleteBtn');
    btn.disabled = true;
    btn.textContent = 'Completing...';

    try {
        const res = await fetch(`${API_BASE}/conversations`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({ id: activeConvoId })
        });
        if (!res.ok) throw new Error('Failed');

        // Refresh conversations list
        await loadConversations();

        // Update the active conversation's state in the header
        const convo = conversations.find(c => c.id === activeConvoId);
        if (convo) {
            document.getElementById('chatPaymentBadge').textContent =
                (parseFloat(convo.payment_amount) || 0) > 0
                    ? `${parseFloat(convo.payment_amount).toLocaleString()} CLAWNCH · completed`
                    : 'Completed';
        }
        btn.style.display = 'none';
    } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Complete';
        alert('Failed to complete conversation');
    }
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

// Boot
init();
