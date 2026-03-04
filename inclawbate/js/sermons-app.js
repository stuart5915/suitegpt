// Inclawbate — Sermon Writer
// Pattern: IIFE, raw EIP-1193 (same as team-app.js)

(function() {
'use strict';

const API = '/api/inclawbate/sermons';
const BASE_CHAIN_ID = '0x2105'; // 8453
const AUTOSAVE_DELAY = 2000;

// ══════════════════════════════════════
// STATE
// ══════════════════════════════════════
let walletAddress = null;
let sermons = [];
let currentSermon = null; // full sermon object when editing
let saveTimer = null;
let isSaving = false;

// ══════════════════════════════════════
// DOM REFS
// ══════════════════════════════════════
const gateConnect   = document.getElementById('gate-connect');
const gateDenied    = document.getElementById('gate-denied');
const deniedWallet  = document.getElementById('denied-wallet');
const listView      = document.getElementById('list-view');
const editorView    = document.getElementById('editor-view');
const sermonsGrid   = document.getElementById('sermons-grid');
const emptyState    = document.getElementById('empty-state');
const btnConnect    = document.getElementById('btn-connect');
const btnNewSermon  = document.getElementById('btn-new-sermon');
const btnEditorBack = document.getElementById('btn-editor-back');
const btnDelete     = document.getElementById('btn-delete-sermon');
const sermonTitle   = document.getElementById('sermon-title');
const saveStatus    = document.getElementById('save-status');
const paperContent  = document.getElementById('paper-content');
const paperLines    = document.getElementById('paper-lines');
const paper         = document.getElementById('paper');
const paperWrapper  = document.getElementById('paper-wrapper');

// Toolbar refs
const fmtFont      = document.getElementById('fmt-font');
const fmtSize      = document.getElementById('fmt-size');
const fmtSpacing   = document.getElementById('fmt-spacing');
const fmtBold      = document.getElementById('fmt-bold');
const fmtItalic    = document.getElementById('fmt-italic');
const fmtUnderline = document.getElementById('fmt-underline');
const fmtLeft      = document.getElementById('fmt-left');
const fmtCenter    = document.getElementById('fmt-center');
const fmtRight     = document.getElementById('fmt-right');
const fmtColor     = document.getElementById('fmt-color');

// ══════════════════════════════════════
// HELPERS
// ══════════════════════════════════════
async function apiFetch(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (walletAddress) headers['X-Wallet-Address'] = walletAddress;
    const res = await fetch(API + path, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
    return res;
}

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    if (days < 30) return days + 'd ago';
    return new Date(dateStr).toLocaleDateString();
}

function showView(view) {
    gateConnect.style.display = 'none';
    gateDenied.style.display = 'none';
    listView.style.display = 'none';
    editorView.style.display = 'none';
    if (view === 'connect') gateConnect.style.display = 'flex';
    else if (view === 'denied') gateDenied.style.display = 'flex';
    else if (view === 'list') listView.style.display = 'block';
    else if (view === 'editor') editorView.style.display = 'block';
}

// ══════════════════════════════════════
// WALLET CONNECTION
// ══════════════════════════════════════
async function connectWallet() {
    if (!window.ethereum) {
        alert('No wallet detected. Please install MetaMask or a compatible wallet.');
        return;
    }
    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (!accounts || !accounts.length) return;
        walletAddress = accounts[0].toLowerCase();

        // Switch to Base if needed
        try {
            await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID }] });
        } catch (e) {
            // ignore chain switch errors
        }

        await checkAccess();
    } catch (err) {
        console.error('Wallet connect error:', err);
    }
}

async function checkAccess() {
    const res = await apiFetch('');
    if (res.status === 403) {
        deniedWallet.textContent = walletAddress;
        showView('denied');
        return;
    }
    if (!res.ok) {
        alert('Error checking access');
        return;
    }
    const data = await res.json();
    sermons = data.sermons || [];
    renderList();
    showView('list');
}

// ══════════════════════════════════════
// LIST VIEW
// ══════════════════════════════════════
function renderList() {
    sermonsGrid.innerHTML = '';
    if (sermons.length === 0) {
        emptyState.style.display = 'block';
        return;
    }
    emptyState.style.display = 'none';
    sermons.forEach(s => {
        const card = document.createElement('div');
        card.className = 'sermon-card';
        card.innerHTML = `
            <div class="sermon-card-title">${escHtml(s.title)}</div>
            <div class="sermon-card-meta">Edited ${timeAgo(s.updated_at)}</div>
        `;
        card.addEventListener('click', () => openSermon(s.id));
        sermonsGrid.appendChild(card);
    });
}

function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

// ══════════════════════════════════════
// EDITOR — OPEN / CREATE / SAVE / DELETE
// ══════════════════════════════════════
async function openSermon(id) {
    const res = await apiFetch('?id=' + id);
    if (!res.ok) { alert('Failed to load sermon'); return; }
    const data = await res.json();
    currentSermon = data.sermon;
    showView('editor');
    loadEditor();
}

async function createSermon() {
    const res = await apiFetch('', {
        method: 'POST',
        body: JSON.stringify({ action: 'save' })
    });
    if (!res.ok) { alert('Failed to create sermon'); return; }
    const data = await res.json();
    currentSermon = data.sermon;
    showView('editor');
    loadEditor();
}

function loadEditor() {
    sermonTitle.value = currentSermon.title || 'Untitled Sermon';
    paperContent.innerHTML = currentSermon.content_html || '';
    saveStatus.textContent = '';

    // Restore font settings
    const family = currentSermon.font_family || 'Caveat';
    const size = currentSermon.font_size || '18px';
    const spacing = currentSermon.line_spacing || '29px';

    fmtFont.value = family;
    fmtSize.value = size;
    fmtSpacing.value = spacing;

    applyFontFamily(family);
    applyFontSize(size);
    applyLineSpacing(spacing);

    paperContent.focus();
    scalePaper();
}

async function saveSermon() {
    if (!currentSermon || isSaving) return;
    isSaving = true;
    saveStatus.textContent = 'Saving...';

    const res = await apiFetch('', {
        method: 'POST',
        body: JSON.stringify({
            action: 'save',
            id: currentSermon.id,
            title: sermonTitle.value.trim() || 'Untitled Sermon',
            content_html: paperContent.innerHTML,
            font_family: fmtFont.value,
            font_size: fmtSize.value,
            line_spacing: fmtSpacing.value
        })
    });

    isSaving = false;
    if (res.ok) {
        const data = await res.json();
        currentSermon = data.sermon;
        saveStatus.textContent = 'Saved';
    } else {
        saveStatus.textContent = 'Save failed';
    }
}

function scheduleSave() {
    saveStatus.textContent = '';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveSermon, AUTOSAVE_DELAY);
}

async function deleteSermon() {
    if (!currentSermon) return;
    if (!confirm('Delete this sermon? This cannot be undone.')) return;

    const res = await apiFetch('', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', id: currentSermon.id })
    });

    if (res.ok) {
        currentSermon = null;
        await goBackToList();
    } else {
        alert('Failed to delete sermon');
    }
}

async function goBackToList() {
    // Save any pending changes before leaving
    clearTimeout(saveTimer);
    if (currentSermon && !isSaving) {
        await saveSermon();
    }
    currentSermon = null;

    // Refresh list
    const res = await apiFetch('');
    if (res.ok) {
        const data = await res.json();
        sermons = data.sermons || [];
    }
    renderList();
    showView('list');
}

// ══════════════════════════════════════
// FORMATTING
// ══════════════════════════════════════
function applyFontFamily(family) {
    const fallback = family === 'Georgia' ? 'serif' :
                     (family === 'Caveat' || family === 'Dancing Script') ? 'cursive' : 'sans-serif';
    paperContent.style.fontFamily = `'${family}', ${fallback}`;
}

function applyFontSize(size) {
    paperContent.style.fontSize = size;
}

function applyLineSpacing(spacing) {
    const px = parseInt(spacing);
    paperContent.style.lineHeight = spacing;
    // Update paper ruled lines to match
    paperLines.style.background = `repeating-linear-gradient(
        to bottom,
        transparent,
        transparent ${px - 1}px,
        #c8d4e0 ${px - 1}px,
        #c8d4e0 ${px}px
    )`;
}

function execCmd(cmd, value) {
    document.execCommand(cmd, false, value || null);
    paperContent.focus();
    scheduleSave();
}

// ══════════════════════════════════════
// RESPONSIVE PAPER SCALING
// ══════════════════════════════════════
function scalePaper() {
    const wrapperWidth = paperWrapper.clientWidth;
    const paperWidth = 816;
    if (wrapperWidth < paperWidth + 20) {
        const scale = (wrapperWidth - 16) / paperWidth;
        paper.style.transform = `scale(${scale})`;
        paper.style.transformOrigin = 'top left';
        paper.style.marginBottom = `-${(1 - scale) * paper.scrollHeight}px`;
    } else {
        paper.style.transform = '';
        paper.style.marginBottom = '';
    }
}

// ══════════════════════════════════════
// EVENT LISTENERS
// ══════════════════════════════════════
btnConnect.addEventListener('click', connectWallet);
btnNewSermon.addEventListener('click', createSermon);
btnEditorBack.addEventListener('click', goBackToList);
btnDelete.addEventListener('click', deleteSermon);

// Autosave on content or title change
paperContent.addEventListener('input', scheduleSave);
sermonTitle.addEventListener('input', scheduleSave);

// Toolbar — use mousedown to prevent losing focus from contenteditable
fmtBold.addEventListener('mousedown', (e) => { e.preventDefault(); execCmd('bold'); });
fmtItalic.addEventListener('mousedown', (e) => { e.preventDefault(); execCmd('italic'); });
fmtUnderline.addEventListener('mousedown', (e) => { e.preventDefault(); execCmd('underline'); });
fmtLeft.addEventListener('mousedown', (e) => { e.preventDefault(); execCmd('justifyLeft'); });
fmtCenter.addEventListener('mousedown', (e) => { e.preventDefault(); execCmd('justifyCenter'); });
fmtRight.addEventListener('mousedown', (e) => { e.preventDefault(); execCmd('justifyRight'); });

fmtColor.addEventListener('input', () => {
    execCmd('foreColor', fmtColor.value);
});

fmtFont.addEventListener('change', () => {
    applyFontFamily(fmtFont.value);
    scheduleSave();
});

fmtSize.addEventListener('change', () => {
    applyFontSize(fmtSize.value);
    scheduleSave();
});

fmtSpacing.addEventListener('change', () => {
    applyLineSpacing(fmtSpacing.value);
    scheduleSave();
});

// Responsive paper scaling
window.addEventListener('resize', () => {
    if (editorView.style.display !== 'none') scalePaper();
});

// ══════════════════════════════════════
// INIT — auto-connect if wallet already connected
// ══════════════════════════════════════
async function init() {
    document.body.style.opacity = '1';
    if (window.ethereum) {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts && accounts.length) {
                walletAddress = accounts[0].toLowerCase();
                await checkAccess();
                return;
            }
        } catch (e) {
            // ignore
        }
    }
    showView('connect');
}

init();

})();
