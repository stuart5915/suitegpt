/* Inclawbate PFP Generator — App Logic */
(function () {
    'use strict';

    // ── Stickers ──
    const STICKERS = [
        // Faith
        { id: 'cross', emoji: '\u271D\uFE0F', cat: 'faith', label: 'Cross' },
        { id: 'pray', emoji: '\uD83D\uDE4F', cat: 'faith', label: 'Pray' },
        { id: 'dove', emoji: '\uD83D\uDD4A\uFE0F', cat: 'faith', label: 'Dove' },
        { id: 'heart', emoji: '\u2764\uFE0F', cat: 'faith', label: 'Heart' },
        { id: 'star', emoji: '\u2B50', cat: 'faith', label: 'Star' },
        // Hustle
        { id: 'money', emoji: '\uD83D\uDCB0', cat: 'hustle', label: 'Money' },
        { id: 'rocket', emoji: '\uD83D\uDE80', cat: 'hustle', label: 'Rocket' },
        { id: 'fire', emoji: '\uD83D\uDD25', cat: 'hustle', label: 'Fire' },
        { id: 'chart', emoji: '\uD83D\uDCC8', cat: 'hustle', label: 'Chart' },
        // Tech
        { id: 'robot', emoji: '\uD83E\uDD16', cat: 'tech', label: 'Robot' },
        { id: 'laptop', emoji: '\uD83D\uDCBB', cat: 'tech', label: 'Laptop' },
        { id: 'gear', emoji: '\u2699\uFE0F', cat: 'tech', label: 'Gear' },
        { id: 'lightning', emoji: '\u26A1', cat: 'tech', label: 'Lightning' },
        // Creator
        { id: 'palette', emoji: '\uD83C\uDFA8', cat: 'creator', label: 'Palette' },
        { id: 'camera', emoji: '\uD83D\uDCF7', cat: 'creator', label: 'Camera' },
        { id: 'mic', emoji: '\uD83C\uDFA4', cat: 'creator', label: 'Mic' },
        { id: 'sparkle', emoji: '\u2728', cat: 'creator', label: 'Sparkle' },
        { id: 'pen', emoji: '\uD83D\uDD8A\uFE0F', cat: 'creator', label: 'Pen' },
        // Nature
        { id: 'leaf', emoji: '\uD83C\uDF3F', cat: 'nature', label: 'Leaf' },
        { id: 'sun', emoji: '\u2600\uFE0F', cat: 'nature', label: 'Sun' },
        { id: 'mountain', emoji: '\u26F0\uFE0F', cat: 'nature', label: 'Mountain' },
        { id: 'wave', emoji: '\uD83C\uDF0A', cat: 'nature', label: 'Wave' },
        // Lobster
        { id: 'lobster', emoji: '\uD83E\uDD9E', cat: 'lobster', label: 'Lobster' },
        { id: 'crab', emoji: '\uD83E\uDD80', cat: 'lobster', label: 'Crab' },
        { id: 'shrimp', emoji: '\uD83E\uDD90', cat: 'lobster', label: 'Shrimp' },
        { id: 'trident', emoji: '\uD83D\uDD31', cat: 'lobster', label: 'Trident' },
        { id: 'shell', emoji: '\uD83D\uDC1A', cat: 'lobster', label: 'Shell' },
    ];

    // ── Vibe Presets ──
    const VIBES = [
        {
            id: 'faith', name: 'Faith', emoji: '\u271D\uFE0F',
            stickers: [
                { sid: 'cross', x: 8, y: 12, rot: -12, size: 2.2 },
                { sid: 'pray', x: 82, y: 8, rot: 10, size: 2 },
                { sid: 'dove', x: 6, y: 78, rot: -8, size: 1.8 },
                { sid: 'heart', x: 85, y: 75, rot: 15, size: 2 },
                { sid: 'star', x: 45, y: 85, rot: 5, size: 1.6 },
            ]
        },
        {
            id: 'hustle', name: 'Hustle', emoji: '\uD83D\uDCB0',
            stickers: [
                { sid: 'money', x: 6, y: 10, rot: -10, size: 2.2 },
                { sid: 'rocket', x: 80, y: 6, rot: 20, size: 2.4 },
                { sid: 'fire', x: 5, y: 80, rot: -5, size: 2 },
                { sid: 'chart', x: 84, y: 78, rot: 8, size: 1.8 },
                { sid: 'lightning', x: 50, y: 5, rot: 0, size: 1.6 },
            ]
        },
        {
            id: 'tech', name: 'Tech', emoji: '\uD83E\uDD16',
            stickers: [
                { sid: 'robot', x: 5, y: 8, rot: -8, size: 2.4 },
                { sid: 'laptop', x: 78, y: 10, rot: 12, size: 2 },
                { sid: 'gear', x: 8, y: 82, rot: -15, size: 1.8 },
                { sid: 'lightning', x: 85, y: 80, rot: 10, size: 2 },
                { sid: 'sparkle', x: 48, y: 6, rot: 0, size: 1.6 },
            ]
        },
        {
            id: 'creator', name: 'Creator', emoji: '\uD83C\uDFA8',
            stickers: [
                { sid: 'palette', x: 6, y: 10, rot: -12, size: 2.2 },
                { sid: 'camera', x: 82, y: 8, rot: 14, size: 2 },
                { sid: 'mic', x: 5, y: 78, rot: -6, size: 2 },
                { sid: 'pen', x: 86, y: 82, rot: 10, size: 1.8 },
                { sid: 'sparkle', x: 50, y: 4, rot: 5, size: 1.6 },
            ]
        },
        {
            id: 'nature', name: 'Nature', emoji: '\uD83C\uDF3F',
            stickers: [
                { sid: 'leaf', x: 8, y: 8, rot: -10, size: 2.2 },
                { sid: 'sun', x: 80, y: 6, rot: 8, size: 2.4 },
                { sid: 'mountain', x: 4, y: 80, rot: -5, size: 2 },
                { sid: 'wave', x: 84, y: 82, rot: 12, size: 2 },
                { sid: 'shell', x: 46, y: 86, rot: 0, size: 1.6 },
            ]
        },
        {
            id: 'lobster', name: 'Lobster', emoji: '\uD83E\uDD9E',
            stickers: [
                { sid: 'lobster', x: 6, y: 6, rot: -15, size: 2.6 },
                { sid: 'crab', x: 82, y: 8, rot: 12, size: 2.2 },
                { sid: 'shrimp', x: 5, y: 82, rot: -8, size: 2 },
                { sid: 'trident', x: 85, y: 80, rot: 10, size: 2 },
                { sid: 'shell', x: 48, y: 4, rot: 5, size: 1.8 },
            ]
        },
    ];

    // ── Background Colors ──
    const BG_COLORS = [
        { id: 'cream', hex: '#f5f0e8', label: 'Cream' },
        { id: 'kraft', hex: '#c9a96e', label: 'Kraft' },
        { id: 'dark', hex: '#1a1a24', label: 'Dark' },
        { id: 'coral', hex: '#c75b3f', label: 'Coral' },
        { id: 'seafoam', hex: '#5a9e95', label: 'Seafoam' },
        { id: 'midnight', hex: '#0a0a14', label: 'Midnight' },
    ];

    // ── Ransom Letters Config ──
    const RANSOM_LETTERS = [
        { ch: 'I', bg: '#d63031', font: 'Special Elite', rot: -3, sz: 1.1 },
        { ch: 'n', bg: '#0984e3', font: 'Permanent Marker', rot: 2, sz: 1 },
        { ch: 'C', bg: '#00b894', font: 'Special Elite', rot: -2, sz: 1.15 },
        { ch: 'L', bg: '#fdcb6e', font: 'Permanent Marker', rot: 3, sz: 1.05 },
        { ch: 'A', bg: '#e17055', font: 'Special Elite', rot: -4, sz: 1.1 },
        { ch: 'W', bg: '#6c5ce7', font: 'Permanent Marker', rot: 2, sz: 1 },
        { ch: 'N', bg: '#ffffff', font: 'Special Elite', rot: -3, sz: 1.1, color: '#222' },
        { ch: 'c', bg: '#d63031', font: 'Permanent Marker', rot: 4, sz: 0.95 },
        { ch: 'h', bg: '#0984e3', font: 'Special Elite', rot: -2, sz: 1.05 },
    ];

    // ── State ──
    let userPhotoUrl = null;
    let activeVibe = null;
    let activeBgColor = BG_COLORS[0];
    let canvasStickers = [];
    let stickerIdCounter = 0;

    // ── DOM refs ──
    const $ = (s, p) => (p || document).querySelector(s);
    const $$ = (s, p) => [...(p || document).querySelectorAll(s)];

    const uploadZone = $('.pfp-upload-zone');
    const uploadInput = $('#pfp-file-input');
    const uploadThumb = $('.upload-thumb');
    const canvas = $('.pfp-canvas');
    const emptyState = $('.pfp-empty-state');
    const ransomText = $('.pfp-ransom-text');
    const photoFrame = $('.pfp-photo-frame');
    const photoImg = $('.pfp-photo-frame img');
    const displayNameEl = $('.pfp-display-name');
    const watermarkEl = $('.pfp-watermark');
    const nameInput = $('.pfp-name-input');
    const btnDownloadSquare = $('#btn-download-square');
    const btnDownloadCircle = $('#btn-download-circle');

    // ── Init ──
    function init() {
        renderRansomText();
        renderVibes();
        renderColors();
        renderStickerTray();
        bindUpload();
        bindNameInput();
        bindDownload();
        updateCanvasVisibility();
    }

    // ── Ransom Text ──
    function renderRansomText() {
        ransomText.innerHTML = '';
        RANSOM_LETTERS.forEach(l => {
            const span = document.createElement('span');
            span.className = 'pfp-ransom-letter';
            span.textContent = l.ch;
            span.style.background = l.bg;
            span.style.color = l.color || '#fff';
            span.style.fontFamily = `'${l.font}', cursive`;
            span.style.transform = `rotate(${l.rot}deg)`;
            span.style.fontSize = `${l.sz}rem`;
            ransomText.appendChild(span);
        });
    }

    // ── Vibes ──
    function renderVibes() {
        const grid = $('.pfp-vibes-grid');
        VIBES.forEach(v => {
            const card = document.createElement('div');
            card.className = 'pfp-vibe-card';
            card.dataset.vibe = v.id;
            card.innerHTML = `<div class="vibe-emoji">${v.emoji}</div><div class="vibe-name">${v.name}</div>`;
            card.addEventListener('click', () => selectVibe(v));
            grid.appendChild(card);
        });
    }

    function selectVibe(v) {
        // Toggle off if same vibe clicked
        if (activeVibe && activeVibe.id === v.id) {
            activeVibe = null;
            $$('.pfp-vibe-card').forEach(c => c.classList.remove('active'));
            clearCanvasStickers();
            return;
        }
        activeVibe = v;
        $$('.pfp-vibe-card').forEach(c => {
            c.classList.toggle('active', c.dataset.vibe === v.id);
        });
        clearCanvasStickers();
        v.stickers.forEach(s => {
            const sticker = STICKERS.find(st => st.id === s.sid);
            if (sticker) placeSticker(sticker.emoji, s.x, s.y, s.rot, s.size);
        });
    }

    // ── Colors ──
    function renderColors() {
        const wrap = $('.pfp-colors');
        BG_COLORS.forEach(c => {
            const swatch = document.createElement('div');
            swatch.className = 'pfp-color-swatch' + (c.id === activeBgColor.id ? ' active' : '');
            swatch.style.background = c.hex;
            swatch.title = c.label;
            swatch.addEventListener('click', () => {
                activeBgColor = c;
                $$('.pfp-color-swatch').forEach(s => s.classList.remove('active'));
                swatch.classList.add('active');
                canvas.style.background = c.hex;
            });
            wrap.appendChild(swatch);
        });
        canvas.style.background = activeBgColor.hex;
    }

    // ── Sticker Tray ──
    function renderStickerTray() {
        const tray = $('.pfp-sticker-tray');
        STICKERS.forEach(s => {
            const btn = document.createElement('button');
            btn.className = 'pfp-sticker-btn';
            btn.textContent = s.emoji;
            btn.title = s.label;
            btn.addEventListener('click', () => {
                const x = 20 + Math.random() * 60;
                const y = 20 + Math.random() * 60;
                const rot = -15 + Math.random() * 30;
                placeSticker(s.emoji, x, y, rot, 2);
            });
            tray.appendChild(btn);
        });
    }

    // ── Canvas Stickers ──
    function placeSticker(emoji, xPct, yPct, rot, size) {
        const id = ++stickerIdCounter;
        const el = document.createElement('div');
        el.className = 'pfp-sticker';
        el.dataset.stickerId = id;
        el.style.left = xPct + '%';
        el.style.top = yPct + '%';
        el.style.transform = `rotate(${rot}deg)`;
        el.innerHTML = `<span class="sticker-emoji" style="font-size:${size}rem">${emoji}</span><button class="sticker-delete">&times;</button>`;

        // Delete
        el.querySelector('.sticker-delete').addEventListener('click', e => {
            e.stopPropagation();
            el.remove();
            canvasStickers = canvasStickers.filter(s => s.id !== id);
        });

        // Drag
        makeDraggable(el);

        canvas.appendChild(el);
        canvasStickers.push({ id, el });
    }

    function clearCanvasStickers() {
        canvasStickers.forEach(s => s.el.remove());
        canvasStickers = [];
    }

    // ── Drag ──
    function makeDraggable(el) {
        let startX, startY, elX, elY;

        el.addEventListener('pointerdown', e => {
            if (e.target.classList.contains('sticker-delete')) return;
            e.preventDefault();
            el.setPointerCapture(e.pointerId);
            const rect = canvas.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            elX = el.offsetLeft;
            elY = el.offsetTop;

            const onMove = ev => {
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                let nx = elX + dx;
                let ny = elY + dy;
                // Clamp
                nx = Math.max(-10, Math.min(rect.width - 10, nx));
                ny = Math.max(-10, Math.min(rect.height - 10, ny));
                el.style.left = nx + 'px';
                el.style.top = ny + 'px';
            };

            const onUp = () => {
                el.removeEventListener('pointermove', onMove);
                el.removeEventListener('pointerup', onUp);
            };

            el.addEventListener('pointermove', onMove);
            el.addEventListener('pointerup', onUp);
        });
    }

    // ── Upload ──
    function bindUpload() {
        uploadZone.addEventListener('click', () => uploadInput.click());

        uploadInput.addEventListener('change', e => {
            if (e.target.files.length) handleFile(e.target.files[0]);
        });

        uploadZone.addEventListener('dragover', e => {
            e.preventDefault();
            uploadZone.classList.add('drag-over');
        });
        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('drag-over');
        });
        uploadZone.addEventListener('drop', e => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
        });
    }

    function handleFile(file) {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = e => {
            userPhotoUrl = e.target.result;
            uploadThumb.src = userPhotoUrl;
            uploadZone.classList.add('has-photo');
            photoImg.src = userPhotoUrl;
            updateCanvasVisibility();
        };
        reader.readAsDataURL(file);
    }

    function updateCanvasVisibility() {
        const hasPhoto = !!userPhotoUrl;
        emptyState.style.display = hasPhoto ? 'none' : 'flex';
        photoFrame.style.display = hasPhoto ? 'block' : 'none';
        ransomText.style.display = hasPhoto ? 'flex' : 'none';
        displayNameEl.style.display = hasPhoto ? 'block' : 'none';
        watermarkEl.style.display = hasPhoto ? 'block' : 'none';
    }

    // ── Name Input ──
    function bindNameInput() {
        nameInput.addEventListener('input', () => {
            displayNameEl.textContent = nameInput.value;
        });
    }

    // ── Download ──
    function bindDownload() {
        btnDownloadSquare.addEventListener('click', () => exportPFP(false));
        btnDownloadCircle.addEventListener('click', () => exportPFP(true));
    }

    function exportPFP(circle) {
        // Disable button during render
        const btn = circle ? btnDownloadCircle : btnDownloadSquare;
        const origText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Rendering...';

        // Hide delete buttons during render
        const deleteBtns = $$('.sticker-delete', canvas);
        deleteBtns.forEach(b => b.style.display = 'none');

        html2canvas(canvas, {
            scale: 2,
            useCORS: true,
            backgroundColor: null,
            width: canvas.offsetWidth,
            height: canvas.offsetHeight,
        }).then(rendered => {
            deleteBtns.forEach(b => b.style.display = '');
            btn.disabled = false;
            btn.textContent = origText;

            if (circle) {
                // Circle crop
                const size = rendered.width; // already 2x
                const out = document.createElement('canvas');
                out.width = size;
                out.height = size;
                const ctx = out.getContext('2d');
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(rendered, 0, 0);
                out.toBlob(blob => downloadBlob(blob, 'inclawbate-pfp-circle.png'), 'image/png');
            } else {
                rendered.toBlob(blob => downloadBlob(blob, 'inclawbate-pfp.png'), 'image/png');
            }
        }).catch(() => {
            deleteBtns.forEach(b => b.style.display = '');
            btn.disabled = false;
            btn.textContent = origText;
        });
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    // ── Boot ──
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
