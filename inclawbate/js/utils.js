// Inclawbate — Shared Utilities

export function uuid() {
    return crypto.randomUUID();
}

export function slug(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function truncate(str, len = 100) {
    if (str.length <= len) return str;
    return str.slice(0, len).trimEnd() + '...';
}

export function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

export function formatNumber(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toLocaleString();
}

export function formatUSD(n) {
    if (n < 0.01) return '$' + n.toFixed(6);
    if (n < 1) return '$' + n.toFixed(4);
    return '$' + formatNumber(n);
}

export function formatETH(n) {
    if (n < 0.001) return n.toFixed(6) + ' ETH';
    return n.toFixed(4) + ' ETH';
}

export function timeAgo(dateStr) {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
    return new Date(dateStr).toLocaleDateString();
}

export function shortenAddress(addr, chars = 4) {
    if (!addr) return '';
    return addr.slice(0, chars + 2) + '...' + addr.slice(-chars);
}

export function isValidAddress(addr) {
    return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

export function isValidTicker(ticker) {
    return /^[A-Z0-9]{2,10}$/.test(ticker);
}

export function debounce(fn, ms = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

export function $(selector, parent = document) {
    return parent.querySelector(selector);
}

export function $$(selector, parent = document) {
    return [...parent.querySelectorAll(selector)];
}

export function createElement(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [key, val] of Object.entries(attrs)) {
        if (key === 'className') el.className = val;
        else if (key === 'textContent') el.textContent = val;
        else if (key === 'innerHTML') el.innerHTML = val;
        else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), val);
        else el.setAttribute(key, val);
    }
    for (const child of children) {
        if (typeof child === 'string') el.appendChild(document.createTextNode(child));
        else if (child) el.appendChild(child);
    }
    return el;
}

export function showToast(message, type = 'success', duration = 3000) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = createElement('div', {
        className: `toast toast-${type}`,
        textContent: message
    });
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

// Simple client-side router helper
export function getPathSegment(index) {
    const segments = window.location.pathname.split('/').filter(Boolean);
    return segments[index] || null;
}

export function getQueryParam(key) {
    return new URLSearchParams(window.location.search).get(key);
}
