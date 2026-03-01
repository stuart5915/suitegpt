// Inclawbate — Team Kanban Board
// Pattern: IIFE, raw EIP-1193 (same as stake-app.js)

(function() {
'use strict';

// ══════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════
const API = '/api/inclawbate/team';
const BASE_CHAIN_ID = '0x2105'; // 8453

// ══════════════════════════════════════
// STATE
// ══════════════════════════════════════
let walletAddress = null;
let boardData = null; // { columns, cards, members, me }

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

// ══════════════════════════════════════
// WALLET CONNECTION
// ══════════════════════════════════════
async function connectWallet() {
    if (!window.ethereum) {
        alert('MetaMask or a Web3 wallet is required.');
        return;
    }
    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (!accounts || accounts.length === 0) return;
        walletAddress = accounts[0].toLowerCase();

        // Switch to Base
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
        const resp = await fetch(API, {
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
        gateConnect.style.display = 'none';
        gateDenied.style.display = 'none';
        boardContainer.style.display = '';

        if (boardData.me && boardData.me.role === 'admin') {
            btnAdmin.style.display = '';
        }

        renderBoard();
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
    const { columns, cards, members } = boardData;

    kanbanBoard.innerHTML = '';

    columns.forEach(function(col) {
        const colCards = cards
            .filter(function(c) { return c.column_id === col.id; })
            .sort(function(a, b) { return a.position - b.position; });

        var colEl = document.createElement('div');
        colEl.className = 'kanban-column';
        colEl.dataset.columnId = col.id;

        colEl.innerHTML =
            '<div class="kanban-column-header">' +
                '<span class="kanban-column-title">' + escHtml(col.title) + '</span>' +
                '<span class="kanban-column-count">' + colCards.length + '</span>' +
            '</div>' +
            '<div class="kanban-cards" data-column-id="' + col.id + '"></div>';

        var cardsContainer = colEl.querySelector('.kanban-cards');

        // Drop zone events
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

        colCards.forEach(function(card) {
            cardsContainer.appendChild(renderCard(card, members));
        });

        kanbanBoard.appendChild(colEl);
    });
}

function renderCard(card, members) {
    var el = document.createElement('div');
    el.className = 'kanban-card';
    el.draggable = true;
    el.dataset.cardId = card.id;

    var assignee = '';
    if (card.assigned_to) {
        var member = members.find(function(m) { return m.id === card.assigned_to; });
        if (member) assignee = member.display_name || shortenWallet(member.wallet_address);
    }

    el.innerHTML =
        '<div class="kanban-card-title">' + escHtml(card.title) + '</div>' +
        (card.description ? '<div class="kanban-card-desc">' + escHtml(card.description) + '</div>' : '') +
        '<div class="kanban-card-meta">' +
            '<span class="priority-badge priority-' + card.priority + '">' + card.priority + '</span>' +
            (assignee ? '<span class="card-assignee">' + escHtml(assignee) + '</span>' : '') +
        '</div>';

    // Drag events
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

    return el;
}

// ══════════════════════════════════════
// DRAG & DROP
// ══════════════════════════════════════
async function onCardDrop(cardId, newColumnId, container) {
    // Calculate position: append to end of column
    var existingCards = container.querySelectorAll('.kanban-card');
    var newPosition = existingCards.length;

    // Optimistic: move in local state
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
    // Populate column select
    modalCardCol.innerHTML = '';
    boardData.columns.forEach(function(col) {
        var opt = document.createElement('option');
        opt.value = col.id;
        opt.textContent = col.title;
        modalCardCol.appendChild(opt);
    });

    // Populate assignee select
    modalCardAssn.innerHTML = '<option value="">Unassigned</option>';
    boardData.members.forEach(function(m) {
        var opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.display_name || shortenWallet(m.wallet_address);
        modalCardAssn.appendChild(opt);
    });

    if (card) {
        // Edit mode
        modalTitle.textContent = 'Edit Card';
        modalCardId.value = card.id;
        modalCardTitle.value = card.title;
        modalCardDesc.value = card.description || '';
        modalCardCol.value = card.column_id;
        modalCardPri.value = card.priority || 'normal';
        modalCardAssn.value = card.assigned_to || '';
        btnDeleteCard.style.display = '';
    } else {
        // New card mode
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
        row.innerHTML =
            '<div class="admin-member-info">' +
                '<div class="admin-member-name">' + escHtml(m.display_name || 'Unnamed') +
                    ' <span class="admin-member-role">' + m.role + '</span></div>' +
                '<div class="admin-member-wallet">' + m.wallet_address + '</div>' +
            '</div>';

        if (m.id !== boardData.me.id) {
            var rmBtn = document.createElement('button');
            rmBtn.className = 'admin-remove-btn';
            rmBtn.textContent = 'Remove';
            rmBtn.addEventListener('click', function() { removeMember(m.id, m.display_name || m.wallet_address); });
            row.appendChild(rmBtn);
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
