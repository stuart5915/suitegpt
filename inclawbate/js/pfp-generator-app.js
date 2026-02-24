/* Inclawbate PFP Generator — Duotone Canvas Effects */
(function () {
    'use strict';

    // ── Stickers ──
    const STICKERS = [
        { id: 'lobster', emoji: '\uD83E\uDD9E', label: 'Lobster' },
        { id: 'crab', emoji: '\uD83E\uDD80', label: 'Crab' },
        { id: 'shrimp', emoji: '\uD83E\uDD90', label: 'Shrimp' },
        { id: 'trident', emoji: '\uD83D\uDD31', label: 'Trident' },
        { id: 'shell', emoji: '\uD83D\uDC1A', label: 'Shell' },
        { id: 'cross', emoji: '\u271D\uFE0F', label: 'Cross' },
        { id: 'pray', emoji: '\uD83D\uDE4F', label: 'Pray' },
        { id: 'fire', emoji: '\uD83D\uDD25', label: 'Fire' },
        { id: 'rocket', emoji: '\uD83D\uDE80', label: 'Rocket' },
        { id: 'money', emoji: '\uD83D\uDCB0', label: 'Money' },
        { id: 'chart', emoji: '\uD83D\uDCC8', label: 'Chart' },
        { id: 'robot', emoji: '\uD83E\uDD16', label: 'Robot' },
        { id: 'lightning', emoji: '\u26A1', label: 'Lightning' },
        { id: 'sparkle', emoji: '\u2728', label: 'Sparkle' },
        { id: 'palette', emoji: '\uD83C\uDFA8', label: 'Palette' },
        { id: 'camera', emoji: '\uD83D\uDCF7', label: 'Camera' },
        { id: 'heart', emoji: '\u2764\uFE0F', label: 'Heart' },
        { id: 'star', emoji: '\u2B50', label: 'Star' },
        { id: 'dove', emoji: '\uD83D\uDD4A\uFE0F', label: 'Dove' },
        { id: 'wave', emoji: '\uD83C\uDF0A', label: 'Wave' },
    ];

    // ── Vibes (Duotone Presets) ──
    const VIBES = [
        { id: 'ember',   name: 'Ember',   dark: [45, 27, 18],  light: [232, 131, 107], bg: '#1a1410' },
        { id: 'ocean',   name: 'Ocean',   dark: [10, 22, 40],  light: [116, 185, 255], bg: '#0d1520' },
        { id: 'moss',    name: 'Moss',    dark: [13, 31, 13],  light: [123, 198, 126], bg: '#0f170f' },
        { id: 'gilded',  name: 'Gilded',  dark: [26, 20, 8],   light: [212, 165, 116], bg: '#15120d' },
        { id: 'infrared',name: 'Infrared',dark: [10, 5, 5],    light: [255, 71, 87],   bg: '#150a0a' },
        { id: 'claw',    name: 'Claw',    dark: [26, 8, 8],    light: [199, 91, 63],   bg: '#120a08' },
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
    let userPhoto = null;        // HTMLImageElement (original)
    let activeVibe = VIBES[5];   // Default: Claw
    let duotoneCache = null;     // { vibeId, dataUrl } — cached processed result
    let canvasStickers = [];
    let stickerIdCounter = 0;

    // ── DOM refs ──
    const $ = (s, p) => (p || document).querySelector(s);
    const $$ = (s, p) => [...(p || document).querySelectorAll(s)];

    const uploadZone = $('.pfp-upload-zone');
    const uploadInput = $('#pfp-file-input');
    const uploadThumb = $('.upload-thumb');
    const canvasEl = $('.pfp-canvas');
    const emptyState = $('.pfp-empty-state');
    const ransomText = $('.pfp-ransom-text');
    const photoFrame = $('.pfp-photo-frame');
    const photoImg = $('.pfp-photo-frame img');
    const displayNameEl = $('.pfp-display-name');
    const watermarkEl = $('.pfp-watermark');
    const nameInput = $('.pfp-name-input');
    const btnDownloadSquare = $('#btn-download-square');
    const btnDownloadCircle = $('#btn-download-circle');

    // ── Offscreen canvas for duotone processing ──
    const offCanvas = document.createElement('canvas');
    offCanvas.width = 540;
    offCanvas.height = 540;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

    // ── Init ──
    function init() {
        renderRansomText();
        renderVibes();
        renderStickerTray();
        bindUpload();
        bindNameInput();
        bindDownload();
        updateCanvasVisibility();
        // Set default vibe active
        $$('.pfp-vibe-card').forEach(c => {
            c.classList.toggle('active', c.dataset.vibe === activeVibe.id);
        });
        canvasEl.style.background = activeVibe.bg;
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
            span.style.fontFamily = "'" + l.font + "', cursive";
            span.style.transform = 'rotate(' + l.rot + 'deg)';
            span.style.fontSize = l.sz + 'rem';
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

            // Gradient swatch
            const swatch = document.createElement('div');
            swatch.className = 'pfp-vibe-swatch';
            const darkHex = rgbToHex(v.dark);
            const lightHex = rgbToHex(v.light);
            swatch.style.background = 'linear-gradient(135deg, ' + darkHex + ', ' + lightHex + ')';

            const name = document.createElement('div');
            name.className = 'vibe-name';
            name.textContent = v.name;

            card.appendChild(swatch);
            card.appendChild(name);
            card.addEventListener('click', () => selectVibe(v));
            grid.appendChild(card);
        });
    }

    function selectVibe(v) {
        activeVibe = v;
        $$('.pfp-vibe-card').forEach(c => {
            c.classList.toggle('active', c.dataset.vibe === v.id);
        });
        canvasEl.style.background = v.bg;
        // Re-process photo with new vibe
        if (userPhoto) {
            duotoneCache = null; // invalidate
            processAndDisplay();
        }
    }

    // ── Duotone Processing ──
    function processAndDisplay() {
        if (!userPhoto || !activeVibe) return;

        // Check cache
        if (duotoneCache && duotoneCache.vibeId === activeVibe.id) {
            photoImg.src = duotoneCache.dataUrl;
            return;
        }

        const img = userPhoto;
        const size = 540;

        // Clear
        offCtx.clearRect(0, 0, size, size);

        // Draw cover-fit (center crop)
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const scale = Math.max(size / iw, size / ih);
        const sw = iw * scale;
        const sh = ih * scale;
        const sx = (size - sw) / 2;
        const sy = (size - sh) / 2;
        offCtx.drawImage(img, sx, sy, sw, sh);

        // Get pixel data
        const imageData = offCtx.getImageData(0, 0, size, size);
        const data = imageData.data;
        const dark = activeVibe.dark;
        const light = activeVibe.light;

        // Duotone + grain + vignette in one pass
        const cx = size / 2;
        const cy = size / 2;
        const maxDist = Math.sqrt(cx * cx + cy * cy);

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Grayscale luminance
            const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

            // Lerp between dark and light
            let nr = dark[0] + (light[0] - dark[0]) * lum;
            let ng = dark[1] + (light[1] - dark[1]) * lum;
            let nb = dark[2] + (light[2] - dark[2]) * lum;

            // Grain — random ±25 per channel
            nr += (Math.random() - 0.5) * 50;
            ng += (Math.random() - 0.5) * 50;
            nb += (Math.random() - 0.5) * 50;

            // Vignette — darken edges
            const px = (i / 4) % size;
            const py = Math.floor((i / 4) / size);
            const dist = Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
            const vignette = 1 - 0.35 * Math.pow(dist / maxDist, 2);

            data[i]     = clamp(nr * vignette);
            data[i + 1] = clamp(ng * vignette);
            data[i + 2] = clamp(nb * vignette);
            // Alpha stays 255
        }

        offCtx.putImageData(imageData, 0, 0);

        const dataUrl = offCanvas.toDataURL('image/png');
        duotoneCache = { vibeId: activeVibe.id, dataUrl: dataUrl };
        photoImg.src = dataUrl;
    }

    function clamp(v) {
        return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
    }

    function rgbToHex(rgb) {
        return '#' + rgb.map(function(c) {
            var hex = c.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
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
        el.style.transform = 'rotate(' + rot + 'deg)';
        el.innerHTML = '<span class="sticker-emoji" style="font-size:' + size + 'rem">' + emoji + '</span><button class="sticker-delete">&times;</button>';

        el.querySelector('.sticker-delete').addEventListener('click', e => {
            e.stopPropagation();
            el.remove();
            canvasStickers = canvasStickers.filter(s => s.id !== id);
        });

        makeDraggable(el);
        canvasEl.appendChild(el);
        canvasStickers.push({ id, el });
    }

    // ── Drag ──
    function makeDraggable(el) {
        let startX, startY, elX, elY;

        el.addEventListener('pointerdown', e => {
            if (e.target.classList.contains('sticker-delete')) return;
            e.preventDefault();
            el.setPointerCapture(e.pointerId);
            startX = e.clientX;
            startY = e.clientY;
            elX = el.offsetLeft;
            elY = el.offsetTop;

            const onMove = ev => {
                const rect = canvasEl.getBoundingClientRect();
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                let nx = elX + dx;
                let ny = elY + dy;
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
            const dataUrl = e.target.result;
            // Show thumbnail
            uploadThumb.src = dataUrl;
            uploadZone.classList.add('has-photo');

            // Load into Image for canvas processing
            const img = new Image();
            img.onload = () => {
                userPhoto = img;
                duotoneCache = null;
                processAndDisplay();
                updateCanvasVisibility();
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
    }

    function updateCanvasVisibility() {
        const hasPhoto = !!userPhoto;
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
        const btn = circle ? btnDownloadCircle : btnDownloadSquare;
        const origText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Rendering...';

        // Hide delete buttons during render
        const deleteBtns = $$('.sticker-delete', canvasEl);
        deleteBtns.forEach(b => b.style.display = 'none');

        html2canvas(canvasEl, {
            scale: 2,
            useCORS: true,
            backgroundColor: null,
            width: canvasEl.offsetWidth,
            height: canvasEl.offsetHeight,
        }).then(rendered => {
            deleteBtns.forEach(b => b.style.display = '');
            btn.disabled = false;
            btn.textContent = origText;

            if (circle) {
                const size = rendered.width;
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
