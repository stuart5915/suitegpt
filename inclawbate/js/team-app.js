// Inclawbate — Team Kanban Board
// Pattern: IIFE, raw EIP-1193 (same as stake-app.js)

(function() {
'use strict';

// ══════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════
const API = '/api/inclawbate/team';
const BASE_CHAIN_ID = '0x2105'; // 8453
const ROLE_LEVELS = { viewer: 0, member: 1, editor: 2, admin: 3 };
const CHAT_POLL_MS = 5000;

// ══════════════════════════════════════
// STATE
// ══════════════════════════════════════
let walletAddress = null;
let boardData = null; // { columns, cards, members, channels, me }
let myRole = 'viewer';
let activeChannelId = null;
let chatMessages = [];
let chatLastTimestamp = null;
let chatPollTimer = null;
let chatUserScrolledUp = false;

// ══════════════════════════════════════
// DOM REFS
// ══════════════════════════════════════
const gateConnect = document.getElementById('gate-connect');
const gateDenied  = document.getElementById('gate-denied');
const deniedWallet = document.getElementById('denied-wallet');
const boardContainer = document.getElementById('board-container');
const kanbanBoard = document.getElementById('kanban-board');
const btnConnect  = document.getElementById('btn-connect');
const btnAddCard  = document.getElementById('btn-add-card');
const btnAdmin    = document.getElementById('btn-admin');

// Modal refs
const cardModal     = document.getElementById('card-modal');
const modalTitle    = document.getElementById('modal-title');
const modalCardId   = document.getElementById('modal-card-id');
const modalCardTitle= document.getElementById('modal-card-title');
const modalCardDesc = document.getElementById('modal-card-desc');
const modalCardCol  = document.getElementById('modal-card-column');
const modalCardPri  = document.getElementById('modal-card-priority');
const modalCardAssn = document.getElementById('modal-card-assignee');
const btnSaveCard   = document.getElementById('btn-save-card');
const btnDeleteCard = document.getElementById('btn-delete-card');
const btnCancelModal= document.getElementById('btn-cancel-modal');

// Admin refs
const adminOverlay   = document.getElementById('admin-overlay');
const adminBackdrop  = document.getElementById('admin-backdrop');
const adminMembersList = document.getElementById('admin-members-list');
const adminColumnsList = document.getElementById('admin-columns-list');
const btnCloseAdmin  = document.getElementById('btn-close-admin');
const btnAddMember   = document.getElementById('btn-add-member');
const btnAddColumn   = document.getElementById('btn-add-column');

// Chat refs
const chatSection  = document.getElementById('chat-section');
const chatHeader   = document.getElementById('chat-header');
const chatToggle   = document.getElementById('chat-toggle');
const chatBody     = document.getElementById('chat-body');
const chatChannels = document.getElementById('chat-channels');
const chatMessagesEl = document.getElementById('chat-messages');
const chatInput    = document.getElementById('chat-input');
const chatSendBtn  = document.getElementById('chat-send-btn');

// ══════════════════════════════════════
// ROLE HELPERS
// ══════════════════════════════════════
function hasRole(minRole) {
    return (ROLE_LEVELS[myRole] || 0) >= (ROLE_LEVELS[minRole] || 0);
}

// ══════════════════════════════════════
// WALLET CONNECTION
// ══════════════════════════════════════
async function connectWallet() {
    if (!window.ethereum) {
        alert('MetaMask or a Web3 wallet is required.');
        return;
    }
    try {
        var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (!accounts || accounts.length === 0) return;
        walletAddress = accounts[0].toLowerCase();

        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: BASE_CHAIN_ID }]
            });
        } catch (switchErr) {
            if (switchErr.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: BASE_CHAIN_ID,
                        chainName: 'Base',
                        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                        rpcUrls: ['https://mainnet.base.org'],
                        blockExplorerUrls: ['https://basescan.org']
                    }]
                });
            }
        }

        await checkAccess();
    } catch (err) {
        console.error('Wallet connect failed:', err);
    }
}

// ══════════════════════════════════════
// ACCESS CHECK + LOAD BOARD
// ══════════════════════════════════════
async function checkAccess() {
    try {
        var resp = await fetch(API, {
            headers: { 'X-Wallet-Address': walletAddress }
        });

        if (resp.status === 403) {
            gateConnect.style.display = 'none';
            gateDenied.style.display = '';
            deniedWallet.textContent = walletAddress;
            boardContainer.style.display = 'none';
            return;
        }

        if (!resp.ok) throw new Error('API error');

        boardData = await resp.json();
        myRole = boardData.me ? boardData.me.role : 'viewer';

        gateConnect.style.display = 'none';
        gateDenied.style.display = 'none';
        boardContainer.style.display = '';

        // Show admin button for admins
        if (hasRole('admin')) {
            btnAdmin.style.display = '';
        }

        // Hide add-card button for viewers
        btnAddCard.style.display = hasRole('member') ? '' : 'none';

        renderBoard();
        initChat();

        // Prompt for display name if not set
        if (boardData.me && !boardData.me.display_name) {
            promptDisplayName();
        }
    } catch (err) {
        console.error('Access check failed:', err);
        kanbanBoard.innerHTML = '<div class="board-loading">Failed to load board. Try refreshing.</div>';
    }
}

// ══════════════════════════════════════
// RENDER BOARD
// ══════════════════════════════════════
function renderBoard() {
    if (!boardData) return;
    var columns = boardData.columns;
    var cards = boardData.cards;
    var members = boardData.members;

    kanbanBoard.innerHTML = '';

    columns.forEach(function(col, colIndex) {
        var colCards = cards
            .filter(function(c) { return c.column_id === col.id; })
            .sort(function(a, b) { return a.position - b.position; });

        var colEl = document.createElement('div');
        colEl.className = 'kanban-column';
        colEl.dataset.columnId = col.id;
        colEl.dataset.colIndex = colIndex;

        colEl.innerHTML =
            '<div class="kanban-column-header">' +
                '<span class="kanban-column-title">' + escHtml(col.title) + '</span>' +
                '<span class="kanban-column-count">' + colCards.length + '</span>' +
            '</div>' +
            '<div class="kanban-cards" data-column-id="' + col.id + '"></div>';

        var cardsContainer = colEl.querySelector('.kanban-cards');

        // Drop zone events (only for member+)
        if (hasRole('member')) {
            cardsContainer.addEventListener('dragover', function(e) {
                e.preventDefault();
                cardsContainer.classList.add('drag-over');
            });
            cardsContainer.addEventListener('dragleave', function() {
                cardsContainer.classList.remove('drag-over');
            });
            cardsContainer.addEventListener('drop', function(e) {
                e.preventDefault();
                cardsContainer.classList.remove('drag-over');
                var cardId = e.dataTransfer.getData('text/plain');
                if (!cardId) return;
                onCardDrop(cardId, col.id, cardsContainer);
            });
        }

        if (colCards.length === 0) {
            var emptyEl = document.createElement('div');
            emptyEl.className = 'kanban-empty';
            emptyEl.textContent = 'Drop cards here';
            cardsContainer.appendChild(emptyEl);
        }

        colCards.forEach(function(card) {
            cardsContainer.appendChild(renderCard(card, members));
        });

        kanbanBoard.appendChild(colEl);
    });
}

function renderCard(card, members) {
    var el = document.createElement('div');
    var isViewer = !hasRole('member');
    el.className = 'kanban-card' + (isViewer ? ' viewer-card' : '');
    el.draggable = !isViewer;
    el.dataset.cardId = card.id;

    var assignee = '';
    var assigneeRole = '';
    if (card.assigned_to) {
        var member = members.find(function(m) { return m.id === card.assigned_to; });
        if (member) {
            assignee = member.display_name || shortenWallet(member.wallet_address);
            assigneeRole = member.role || '';
        }
    }

    var initial = assignee ? assignee.charAt(0).toUpperCase() : '';
    var roleBadge = assigneeRole ? ' <span class="role-badge role-' + assigneeRole + '">' + assigneeRole + '</span>' : '';

    el.innerHTML =
        '<div class="kanban-card-title">' + escHtml(card.title) + '</div>' +
        (card.description ? '<div class="kanban-card-desc">' + escHtml(card.description) + '</div>' : '') +
        '<div class="kanban-card-meta">' +
            '<span class="priority-badge priority-' + card.priority + '">' + card.priority + '</span>' +
            (assignee ? '<span class="card-assignee"><span class="card-assignee-avatar">' + initial + '</span>' + escHtml(assignee) + roleBadge + '</span>' : '') +
        '</div>';

    // Drag events (member+)
    if (!isViewer) {
        el.addEventListener('dragstart', function(e) {
            e.dataTransfer.setData('text/plain', card.id);
            el.classList.add('dragging');
        });
        el.addEventListener('dragend', function() {
            el.classList.remove('dragging');
        });

        // Click to edit
        el.addEventListener('click', function() {
            openCardModal(card);
        });
    }

    return el;
}

// ══════════════════════════════════════
// DRAG & DROP
// ══════════════════════════════════════
async function onCardDrop(cardId, newColumnId, container) {
    var existingCards = container.querySelectorAll('.kanban-card');
    var newPosition = existingCards.length;

    var card = boardData.cards.find(function(c) { return c.id === cardId; });
    if (card) {
        card.column_id = newColumnId;
        card.position = newPosition;
    }
    renderBoard();

    try {
        await apiPost({
            action: 'update-card',
            card_id: cardId,
            column_id: newColumnId,
            position: newPosition
        });
    } catch (err) {
        console.error('Move failed:', err);
        await refreshBoard();
    }
}

// ══════════════════════════════════════
// CARD MODAL
// ══════════════════════════════════════
function openCardModal(card) {
    modalCardCol.innerHTML = '';
    boardData.columns.forEach(function(col) {
        var opt = document.createElement('option');
        opt.value = col.id;
        opt.textContent = col.title;
        modalCardCol.appendChild(opt);
    });

    modalCardAssn.innerHTML = '<option value="">Unassigned</option>';
    boardData.members.forEach(function(m) {
        var opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.display_name || shortenWallet(m.wallet_address);
        modalCardAssn.appendChild(opt);
    });

    if (card) {
        modalTitle.textContent = 'Edit Card';
        modalCardId.value = card.id;
        modalCardTitle.value = card.title;
        modalCardDesc.value = card.description || '';
        modalCardCol.value = card.column_id;
        modalCardPri.value = card.priority || 'normal';
        modalCardAssn.value = card.assigned_to || '';
        btnDeleteCard.style.display = '';
    } else {
        modalTitle.textContent = 'New Card';
        modalCardId.value = '';
        modalCardTitle.value = '';
        modalCardDesc.value = '';
        if (boardData.columns.length > 0) modalCardCol.value = boardData.columns[0].id;
        modalCardPri.value = 'normal';
        modalCardAssn.value = '';
        btnDeleteCard.style.display = 'none';
    }

    cardModal.classList.add('active');
    modalCardTitle.focus();
}

function closeCardModal() {
    cardModal.classList.remove('active');
}

async function saveCard() {
    var title = modalCardTitle.value.trim();
    if (!title) { modalCardTitle.focus(); return; }

    var cardId = modalCardId.value;
    var payload;

    if (cardId) {
        payload = {
            action: 'update-card',
            card_id: cardId,
            title: title,
            description: modalCardDesc.value.trim(),
            column_id: modalCardCol.value,
            priority: modalCardPri.value,
            assigned_to: modalCardAssn.value || null
        };
    } else {
        payload = {
            action: 'add-card',
            title: title,
            description: modalCardDesc.value.trim(),
            column_id: modalCardCol.value,
            priority: modalCardPri.value,
            assigned_to: modalCardAssn.value || null
        };
    }

    btnSaveCard.disabled = true;
    btnSaveCard.textContent = 'Saving...';

    try {
        await apiPost(payload);
        closeCardModal();
        await refreshBoard();
    } catch (err) {
        console.error('Save failed:', err);
        alert('Failed to save card.');
    } finally {
        btnSaveCard.disabled = false;
        btnSaveCard.textContent = 'Save';
    }
}

async function deleteCard() {
    var cardId = modalCardId.value;
    if (!cardId) return;
    if (!confirm('Delete this card?')) return;

    try {
        await apiPost({ action: 'delete-card', card_id: cardId });
        closeCardModal();
        await refreshBoard();
    } catch (err) {
        console.error('Delete failed:', err);
        alert('Failed to delete card.');
    }
}

// ══════════════════════════════════════
// ADMIN PANEL
// ══════════════════════════════════════
function openAdminPanel() {
    renderAdminMembers();
    renderAdminColumns();
    renderAdminChannels();
    adminOverlay.classList.add('active');
}

function closeAdminPanel() {
    adminOverlay.classList.remove('active');
}

function renderAdminMembers() {
    adminMembersList.innerHTML = '';
    boardData.members.forEach(function(m) {
        var row = document.createElement('div');
        row.className = 'admin-member';

        var infoDiv = document.createElement('div');
        infoDiv.className = 'admin-member-info';

        var nameDiv = document.createElement('div');
        nameDiv.className = 'admin-member-name';
        nameDiv.textContent = m.display_name || 'Unnamed';

        var walletDiv = document.createElement('div');
        walletDiv.className = 'admin-member-wallet';
        walletDiv.textContent = m.wallet_address;

        infoDiv.appendChild(nameDiv);
        infoDiv.appendChild(walletDiv);
        row.appendChild(infoDiv);

        // Role dropdown (admin can change others' roles)
        if (m.id !== boardData.me.id) {
            var controls = document.createElement('div');
            controls.style.display = 'flex';
            controls.style.alignItems = 'center';
            controls.style.gap = '8px';

            var roleSelect = document.createElement('select');
            roleSelect.className = 'admin-role-select';
            ['viewer', 'member', 'editor', 'admin'].forEach(function(r) {
                var opt = document.createElement('option');
                opt.value = r;
                opt.textContent = r;
                if (r === m.role) opt.selected = true;
                roleSelect.appendChild(opt);
            });
            roleSelect.addEventListener('change', function() {
                updateMemberRole(m.id, roleSelect.value);
            });
            controls.appendChild(roleSelect);

            var rmBtn = document.createElement('button');
            rmBtn.className = 'admin-remove-btn';
            rmBtn.textContent = 'Remove';
            rmBtn.addEventListener('click', function() { removeMember(m.id, m.display_name || m.wallet_address); });
            controls.appendChild(rmBtn);

            row.appendChild(controls);
        } else {
            var selfBadge = document.createElement('span');
            selfBadge.className = 'role-badge role-' + m.role;
            selfBadge.textContent = m.role + ' (you)';
            row.appendChild(selfBadge);
        }

        adminMembersList.appendChild(row);
    });
}

function renderAdminColumns() {
    adminColumnsList.innerHTML = '';
    boardData.columns.forEach(function(col) {
        var row = document.createElement('div');
        row.className = 'admin-col-item';
        row.innerHTML = '<span>' + escHtml(col.title) + '</span>';

        var rmBtn = document.createElement('button');
        rmBtn.className = 'admin-remove-btn';
        rmBtn.textContent = 'Delete';
        rmBtn.addEventListener('click', function() { deleteColumn(col.id, col.title); });
        row.appendChild(rmBtn);

        adminColumnsList.appendChild(row);
    });
}

async function addMember() {
    var wallet = document.getElementById('admin-new-wallet').value.trim();
    var name = document.getElementById('admin-new-name').value.trim();
    if (!wallet) return;

    try {
        await apiPost({ action: 'add-member', wallet_address: wallet, display_name: name || null });
        document.getElementById('admin-new-wallet').value = '';
        document.getElementById('admin-new-name').value = '';
        await refreshBoard();
        renderAdminMembers();
    } catch (err) {
        alert('Failed to add member: ' + (err.message || err));
    }
}

async function removeMember(memberId, name) {
    if (!confirm('Remove ' + name + ' from the team?')) return;
    try {
        await apiPost({ action: 'remove-member', member_id: memberId });
        await refreshBoard();
        renderAdminMembers();
    } catch (err) {
        alert('Failed to remove member.');
    }
}

async function updateMemberRole(memberId, newRole) {
    try {
        await apiPost({ action: 'update-member-role', member_id: memberId, role: newRole });
        await refreshBoard();
        renderAdminMembers();
    } catch (err) {
        alert('Failed to update role: ' + (err.message || err));
    }
}

async function addColumn() {
    var title = document.getElementById('admin-new-col').value.trim();
    if (!title) return;
    try {
        await apiPost({ action: 'add-column', title: title });
        document.getElementById('admin-new-col').value = '';
        await refreshBoard();
        renderAdminColumns();
    } catch (err) {
        alert('Failed to add column.');
    }
}

async function deleteColumn(colId, title) {
    if (!confirm('Delete column "' + title + '" and all its cards?')) return;
    try {
        await apiPost({ action: 'delete-column', column_id: colId });
        await refreshBoard();
        renderAdminColumns();
    } catch (err) {
        alert('Failed to delete column.');
    }
}

// ══════════════════════════════════════
// TEAM CHAT
// ══════════════════════════════════════
function initChat() {
    if (!boardData.channels || boardData.channels.length === 0) return;

    renderChannelTabs();

    // Select first channel
    activeChannelId = boardData.channels[0].id;
    highlightChannelTab(activeChannelId);
    loadMessages(activeChannelId);

    // Start polling
    startChatPoll();
}

function renderChannelTabs() {
    chatChannels.innerHTML = '';
    boardData.channels.forEach(function(ch) {
        var tab = document.createElement('button');
        tab.className = 'chat-channel-tab';
        tab.dataset.channelId = ch.id;
        tab.textContent = '#' + ch.title;
        tab.addEventListener('click', function() {
            if (activeChannelId === ch.id) return;
            activeChannelId = ch.id;
            chatMessages = [];
            chatLastTimestamp = null;
            highlightChannelTab(ch.id);
            loadMessages(ch.id);
        });
        chatChannels.appendChild(tab);
    });
}

function highlightChannelTab(channelId) {
    var tabs = chatChannels.querySelectorAll('.chat-channel-tab');
    tabs.forEach(function(t) {
        t.classList.toggle('active', t.dataset.channelId === channelId);
    });
}

async function loadMessages(channelId) {
    try {
        var url = API + '?messages_channel=' + channelId;
        var resp = await fetch(url, {
            headers: { 'X-Wallet-Address': walletAddress }
        });
        if (!resp.ok) return;
        var data = await resp.json();
        chatMessages = data.messages || [];
        if (chatMessages.length > 0) {
            chatLastTimestamp = chatMessages[chatMessages.length - 1].created_at;
        }
        renderMessages();
        scrollChatToBottom(true);
    } catch (err) {
        console.error('Load messages failed:', err);
    }
}

async function pollNewMessages() {
    if (!activeChannelId) return;
    try {
        var url = API + '?messages_channel=' + activeChannelId;
        if (chatLastTimestamp) url += '&messages_after=' + encodeURIComponent(chatLastTimestamp);
        var resp = await fetch(url, {
            headers: { 'X-Wallet-Address': walletAddress }
        });
        if (!resp.ok) return;
        var data = await resp.json();
        var newMsgs = data.messages || [];
        if (newMsgs.length > 0) {
            var existingIds = {};
            chatMessages.forEach(function(m) { existingIds[m.id] = true; });
            var dedupMsgs = newMsgs.filter(function(m) { return !existingIds[m.id]; });
            if (dedupMsgs.length > 0) {
                chatMessages = chatMessages.concat(dedupMsgs);
                chatLastTimestamp = dedupMsgs[dedupMsgs.length - 1].created_at;
                renderMessages();
                if (!chatUserScrolledUp) scrollChatToBottom(false);
            }
        }
    } catch (err) {
        // silent
    }
}

function startChatPoll() {
    if (chatPollTimer) clearInterval(chatPollTimer);
    chatPollTimer = setInterval(pollNewMessages, CHAT_POLL_MS);
}

function renderMessages() {
    if (chatMessages.length === 0) {
        chatMessagesEl.innerHTML = '<div class="chat-empty">No messages yet. Start the conversation!</div>';
        return;
    }

    chatMessagesEl.innerHTML = '';
    chatMessages.forEach(function(msg) {
        var sender = findMember(msg.sender_id);
        var name = sender ? (sender.display_name || shortenWallet(sender.wallet_address)) : 'Unknown';
        var initial = name.charAt(0).toUpperCase();

        var msgEl = document.createElement('div');
        msgEl.className = 'chat-msg';
        msgEl.innerHTML =
            '<div class="chat-msg-avatar">' + initial + '</div>' +
            '<div class="chat-msg-body">' +
                '<div class="chat-msg-header">' +
                    '<span class="chat-msg-name">' + escHtml(name) + '</span>' +
                    '<span class="chat-msg-time">' + relativeTime(msg.created_at) + '</span>' +
                '</div>' +
                '<div class="chat-msg-text">' + escHtml(msg.content) + '</div>' +
            '</div>';
        chatMessagesEl.appendChild(msgEl);
    });
}

function scrollChatToBottom(force) {
    if (force) {
        chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
        chatUserScrolledUp = false;
    } else if (!chatUserScrolledUp) {
        chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    }
}

async function sendMessage() {
    var content = chatInput.value.trim();
    if (!content || !activeChannelId) return;

    chatSendBtn.disabled = true;
    chatInput.value = '';

    try {
        await apiPost({
            action: 'send-message',
            channel_id: activeChannelId,
            content: content
        });
        // Immediately poll for the new message
        await pollNewMessages();
        scrollChatToBottom(true);
    } catch (err) {
        console.error('Send failed:', err);
        chatInput.value = content; // restore on failure
    } finally {
        chatSendBtn.disabled = false;
        chatInput.focus();
    }
}

function findMember(id) {
    if (!boardData || !boardData.members) return null;
    return boardData.members.find(function(m) { return m.id === id; }) || null;
}

function relativeTime(isoStr) {
    var diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
}

// ══════════════════════════════════════
// DISPLAY NAME PROMPT
// ══════════════════════════════════════
async function promptDisplayName() {
    var name = prompt('Set your display name for the team board:');
    if (!name || !name.trim()) return;
    try {
        await apiPost({ action: 'set-display-name', display_name: name.trim() });
        boardData.me.display_name = name.trim();
        // Update in members list too
        boardData.members.forEach(function(m) {
            if (m.id === boardData.me.id) m.display_name = name.trim();
        });
        renderBoard();
        renderMessages();
    } catch (err) {
        console.error('Set name failed:', err);
    }
}

// ══════════════════════════════════════
// ADMIN CHANNEL MANAGEMENT
// ══════════════════════════════════════
function renderAdminChannels() {
    var list = document.getElementById('admin-channels-list');
    if (!list) return;
    list.innerHTML = '';
    (boardData.channels || []).forEach(function(ch) {
        var row = document.createElement('div');
        row.className = 'admin-col-item';
        row.innerHTML = '<span>#' + escHtml(ch.title) + '</span>';

        var rmBtn = document.createElement('button');
        rmBtn.className = 'admin-remove-btn';
        rmBtn.textContent = 'Delete';
        rmBtn.addEventListener('click', function() { deleteChannel(ch.id, ch.title); });
        row.appendChild(rmBtn);

        list.appendChild(row);
    });
}

async function addChannel() {
    var input = document.getElementById('admin-new-channel');
    var title = input.value.trim();
    if (!title) return;
    try {
        await apiPost({ action: 'add-channel', title: title });
        input.value = '';
        await refreshBoard();
        renderAdminChannels();
        initChat();
    } catch (err) {
        alert('Failed to add channel.');
    }
}

async function deleteChannel(channelId, title) {
    if (!confirm('Delete channel "#' + title + '" and all its messages?')) return;
    try {
        await apiPost({ action: 'delete-channel', channel_id: channelId });
        await refreshBoard();
        renderAdminChannels();
        initChat();
    } catch (err) {
        alert('Failed to delete channel.');
    }
}

// ══════════════════════════════════════
// API HELPERS
// ══════════════════════════════════════
async function apiPost(body) {
    var resp = await fetch(API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Wallet-Address': walletAddress
        },
        body: JSON.stringify(body)
    });
    if (!resp.ok) {
        var errData = await resp.json().catch(function() { return {}; });
        throw new Error(errData.error || 'Request failed');
    }
    return resp.json();
}

async function refreshBoard() {
    try {
        var resp = await fetch(API, {
            headers: { 'X-Wallet-Address': walletAddress }
        });
        if (resp.ok) {
            var data = await resp.json();
            boardData.columns = data.columns;
            boardData.cards = data.cards;
            boardData.members = data.members;
            if (data.channels) boardData.channels = data.channels;
            renderBoard();
        }
    } catch (err) {
        console.error('Refresh failed:', err);
    }
}

// ══════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════
function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

function shortenWallet(addr) {
    if (!addr || addr.length < 10) return addr || '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
}

// ══════════════════════════════════════
// EVENT LISTENERS
// ══════════════════════════════════════
function init() {
    btnConnect.addEventListener('click', connectWallet);
    btnAddCard.addEventListener('click', function() { openCardModal(null); });
    btnSaveCard.addEventListener('click', saveCard);
    btnDeleteCard.addEventListener('click', deleteCard);
    btnCancelModal.addEventListener('click', closeCardModal);
    cardModal.addEventListener('click', function(e) {
        if (e.target === cardModal) closeCardModal();
    });

    btnAdmin.addEventListener('click', openAdminPanel);
    btnCloseAdmin.addEventListener('click', closeAdminPanel);
    adminBackdrop.addEventListener('click', closeAdminPanel);
    btnAddMember.addEventListener('click', addMember);
    btnAddColumn.addEventListener('click', addColumn);
    var btnAddChannel = document.getElementById('btn-add-channel');
    if (btnAddChannel) btnAddChannel.addEventListener('click', addChannel);

    // Chat events
    chatHeader.addEventListener('click', function() {
        chatBody.classList.toggle('collapsed');
        chatToggle.classList.toggle('collapsed');
    });

    var btnSetName = document.getElementById('btn-set-name');
    if (btnSetName) btnSetName.addEventListener('click', promptDisplayName);

    chatSendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Track if user scrolled up in chat
    chatMessagesEl.addEventListener('scroll', function() {
        var el = chatMessagesEl;
        chatUserScrolledUp = (el.scrollHeight - el.scrollTop - el.clientHeight) > 50;
    });

    // Auto-connect if wallet already authorized
    if (window.ethereum) {
        window.ethereum.request({ method: 'eth_accounts' }).then(function(accounts) {
            if (accounts && accounts.length > 0) {
                walletAddress = accounts[0].toLowerCase();
                checkAccess();
            }
        }).catch(function() {});
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

})();
