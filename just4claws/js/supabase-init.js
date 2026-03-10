// Just4Claws Init
// Wallet-based identity (localStorage), Supabase for data storage only

window.J4C_BASE = location.hostname.includes('just4claws') ? '' : '/j4c';

const J4C_SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
const J4C_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODk3MTgsImV4cCI6MjA4MzM2NTcxOH0.DcLpWs8Lf1s4Flf54J5LubokSYrd7h-XvI_X0jj6bLM';

supabase = supabase.createClient(J4C_SUPABASE_URL, J4C_SUPABASE_KEY);

window.j4c = {
    supabase,
    wallet: localStorage.getItem('j4c_wallet') || null,
    profile: null,
    ready: false
};

// Simple auth check — wallet-based, no Supabase auth
async function initAuth(opts = {}) {
    const { requireAuth = false } = opts;
    const wallet = localStorage.getItem('j4c_wallet');

    if (!wallet) {
        window.j4c.ready = true;
        return null;
    }

    window.j4c.wallet = wallet;
    window.j4c.ready = true;
    return { wallet_address: wallet };
}

// Toast helper
function showToast(message, type = '') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function formatMoney(amount) {
    return '$' + parseFloat(amount || 0).toFixed(2);
}

function formatCount(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
}

function timeAgo(date) {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
    return new Date(date).toLocaleDateString();
}
