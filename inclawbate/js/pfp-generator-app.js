/* Inclawbate PFP Generator — Collage Style */
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

    // ── Background Options ──
    const BACKGROUNDS = [
        { id: 'collage', label: 'Collage', type: 'image', value: '/assets/logo-banner.jpg' },
        { id: 'dark',    label: 'Dark',    type: 'color', value: '#0a0a14' },
        { id: 'cream',   label: 'Cream',   type: 'color', value: '#f5f0e8' },
        { id: 'kraft',   label: 'Kraft',   type: 'color', value: '#c9a96e' },
        { id: 'coral',   label: 'Coral',   type: 'color', value: '#c75b3f' },
        { id: 'seafoam', label: 'Seafoam', type: 'color', value: '#5a9e95' },
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
    let activeBg = BACKGROUNDS[0]; // Default: Collage
    let canvasStickers = [];
    let stickerIdCounter = 0;

    // ── DOM refs ──
    var $ = function(s, p) { return (p || document).querySelector(s); };
    var $$ = function(s, p) { return [].slice.call((p || document).querySelectorAll(s)); };

    var uploadZone = $('.pfp-upload-zone');
    var uploadInput = $('#pfp-file-input');
    var uploadThumb = $('.upload-thumb');
    var canvasEl = $('.pfp-canvas');
    var emptyState = $('.pfp-empty-state');
    var ransomText = $('.pfp-ransom-text');
    var photoFrame = $('.pfp-photo-frame');
    var photoImg = $('.pfp-photo-frame img');
    var displayNameEl = $('.pfp-display-name');
    var watermarkEl = $('.pfp-watermark');
    var nameInput = $('.pfp-name-input');
    var btnDownloadSquare = $('#btn-download-square');
    var btnDownloadCircle = $('#btn-download-circle');

    // ── Init ──
    function init() {
        renderRansomText();
        renderBackgrounds();
        renderStickerTray();
        bindUpload();
        bindNameInput();
        bindDownload();
        applyBackground(activeBg);
        updateCanvasVisibility();
    }

    // ── Ransom Text ──
    function renderRansomText() {
        ransomText.innerHTML = '';
        RANSOM_LETTERS.forEach(function(l) {
            var span = document.createElement('span');
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

    // ── Backgrounds ──
    function renderBackgrounds() {
        var grid = $('.pfp-bg-grid');
        BACKGROUNDS.forEach(function(bg) {
            var swatch = document.createElement('div');
            swatch.className = 'pfp-bg-swatch' + (bg.id === activeBg.id ? ' active' : '');
            swatch.title = bg.label;
            swatch.dataset.bgId = bg.id;

            if (bg.type === 'image') {
                swatch.style.backgroundImage = 'url(' + bg.value + ')';
            } else {
                swatch.style.background = bg.value;
            }

            swatch.addEventListener('click', function() {
                activeBg = bg;
                $$('.pfp-bg-swatch').forEach(function(s) { s.classList.remove('active'); });
                swatch.classList.add('active');
                applyBackground(bg);
            });
            grid.appendChild(swatch);
        });
    }

    function applyBackground(bg) {
        if (bg.type === 'image') {
            canvasEl.style.background = '#0a0a0f url(' + bg.value + ') center center / cover no-repeat';
        } else {
            canvasEl.style.background = bg.value;
        }
    }

    // ── Sticker Tray ──
    function renderStickerTray() {
        var tray = $('.pfp-sticker-tray');
        STICKERS.forEach(function(s) {
            var btn = document.createElement('button');
            btn.className = 'pfp-sticker-btn';
            btn.textContent = s.emoji;
            btn.title = s.label;
            btn.addEventListener('click', function() {
                var x = 20 + Math.random() * 60;
                var y = 20 + Math.random() * 60;
                var rot = -15 + Math.random() * 30;
                placeSticker(s.emoji, x, y, rot, 2);
            });
            tray.appendChild(btn);
        });
    }

    // ── Canvas Stickers ──
    function placeSticker(emoji, xPct, yPct, rot, size) {
        var id = ++stickerIdCounter;
        var el = document.createElement('div');
        el.className = 'pfp-sticker';
        el.dataset.stickerId = id;
        el.style.left = xPct + '%';
        el.style.top = yPct + '%';
        el.style.transform = 'rotate(' + rot + 'deg)';
        el.innerHTML = '<span class="sticker-emoji" style="font-size:' + size + 'rem">' + emoji + '</span><button class="sticker-delete">&times;</button>';

        el.querySelector('.sticker-delete').addEventListener('click', function(e) {
            e.stopPropagation();
            el.remove();
            canvasStickers = canvasStickers.filter(function(s) { return s.id !== id; });
        });

        makeDraggable(el);
        canvasEl.appendChild(el);
        canvasStickers.push({ id: id, el: el });
    }

    // ── Drag ──
    function makeDraggable(el) {
        var startX, startY, elX, elY;

        el.addEventListener('pointerdown', function(e) {
            if (e.target.classList.contains('sticker-delete')) return;
            e.preventDefault();
            el.setPointerCapture(e.pointerId);
            startX = e.clientX;
            startY = e.clientY;
            elX = el.offsetLeft;
            elY = el.offsetTop;

            function onMove(ev) {
                var rect = canvasEl.getBoundingClientRect();
                var dx = ev.clientX - startX;
                var dy = ev.clientY - startY;
                var nx = elX + dx;
                var ny = elY + dy;
                nx = Math.max(-10, Math.min(rect.width - 10, nx));
                ny = Math.max(-10, Math.min(rect.height - 10, ny));
                el.style.left = nx + 'px';
                el.style.top = ny + 'px';
            }

            function onUp() {
                el.removeEventListener('pointermove', onMove);
                el.removeEventListener('pointerup', onUp);
            }

            el.addEventListener('pointermove', onMove);
            el.addEventListener('pointerup', onUp);
        });
    }

    // ── Upload ──
    function bindUpload() {
        uploadZone.addEventListener('click', function() { uploadInput.click(); });

        uploadInput.addEventListener('change', function(e) {
            if (e.target.files.length) handleFile(e.target.files[0]);
        });

        uploadZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            uploadZone.classList.add('drag-over');
        });
        uploadZone.addEventListener('dragleave', function() {
            uploadZone.classList.remove('drag-over');
        });
        uploadZone.addEventListener('drop', function(e) {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
        });
    }

    function handleFile(file) {
        if (!file.type.startsWith('image/')) return;
        var reader = new FileReader();
        reader.onload = function(e) {
            userPhotoUrl = e.target.result;
            uploadThumb.src = userPhotoUrl;
            uploadZone.classList.add('has-photo');
            photoImg.src = userPhotoUrl;
            updateCanvasVisibility();
        };
        reader.readAsDataURL(file);
    }

    function updateCanvasVisibility() {
        var hasPhoto = !!userPhotoUrl;
        emptyState.style.display = hasPhoto ? 'none' : 'flex';
        photoFrame.style.display = hasPhoto ? 'block' : 'none';
        ransomText.style.display = hasPhoto ? 'flex' : 'none';
        displayNameEl.style.display = hasPhoto ? 'block' : 'none';
        watermarkEl.style.display = hasPhoto ? 'block' : 'none';
    }

    // ── Name Input ──
    function bindNameInput() {
        nameInput.addEventListener('input', function() {
            displayNameEl.textContent = nameInput.value;
        });
    }

    // ── Download ──
    function bindDownload() {
        btnDownloadSquare.addEventListener('click', function() { exportPFP(false); });
        btnDownloadCircle.addEventListener('click', function() { exportPFP(true); });
    }

    function exportPFP(circle) {
        var btn = circle ? btnDownloadCircle : btnDownloadSquare;
        var origText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Rendering...';

        // Hide delete buttons during render
        var deleteBtns = $$('.sticker-delete', canvasEl);
        deleteBtns.forEach(function(b) { b.style.display = 'none'; });

        html2canvas(canvasEl, {
            scale: 2,
            useCORS: true,
            backgroundColor: null,
            width: canvasEl.offsetWidth,
            height: canvasEl.offsetHeight,
        }).then(function(rendered) {
            deleteBtns.forEach(function(b) { b.style.display = ''; });
            btn.disabled = false;
            btn.textContent = origText;

            if (circle) {
                var size = rendered.width;
                var out = document.createElement('canvas');
                out.width = size;
                out.height = size;
                var ctx = out.getContext('2d');
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(rendered, 0, 0);
                out.toBlob(function(blob) { downloadBlob(blob, 'inclawbate-pfp-circle.png'); }, 'image/png');
            } else {
                rendered.toBlob(function(blob) { downloadBlob(blob, 'inclawbate-pfp.png'); }, 'image/png');
            }
        }).catch(function() {
            deleteBtns.forEach(function(b) { b.style.display = ''; });
            btn.disabled = false;
            btn.textContent = origText;
        });
    }

    function downloadBlob(blob, filename) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
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
