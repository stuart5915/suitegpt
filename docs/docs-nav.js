/**
 * SUITE Docs Navigation Component
 * Matches main site nav with real credit loading
 */

document.addEventListener('DOMContentLoaded', function () {
    // Supabase config
    const SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODk3MTgsImV4cCI6MjA4MzM2NTcxOH0.DcLpWs8Lf1s4Flf54J5LubokSYrd7h-XvI_X0jj6bLM';

    // Find nav element
    let nav = document.querySelector('#main-nav') || document.querySelector('nav.nav');

    if (nav) {
        nav.outerHTML = `
            <nav class="nav">
                <div class="nav-inner">
                    <a href="../index.html" class="nav-logo">
                        <img src="../assets/suite-logo-new.png" alt="SUITE" class="nav-logo-img">
                        SUITE
                    </a>
                    <div class="nav-links">
                        <a href="../suite-shell.html">Apps</a>
                        <a href="index.html" class="active">Docs</a>
                        <a href="../learn.html">Learn</a>
                        <a href="../wallet.html">Wallet</a>
                    </div>
                    <div class="nav-actions">
                        <a href="../wallet.html" class="nav-credits-btn" title="Your Credits">
                            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                                <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                            </svg>
                            <span id="navCreditsDisplay">0</span>
                        </a>
                    </div>
                    <button class="mobile-menu-btn" onclick="this.classList.toggle('active'); document.querySelector('.nav-links').classList.toggle('mobile-open'); document.querySelector('.nav-actions').classList.toggle('mobile-open');">
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>
                </div>
            </nav>
        `;
    }

    // Get Telegram user from URL params or localStorage
    function getTelegramUser() {
        const params = new URLSearchParams(window.location.search);
        const tgId = params.get('tg_id');
        if (tgId) {
            return {
                id: tgId,
                username: params.get('tg_username') || '',
                first_name: params.get('tg_first_name') || '',
                photo_url: params.get('tg_photo_url') || ''
            };
        }

        const stored = localStorage.getItem('telegram_user');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {}
        }

        return null;
    }

    // Load credits from Supabase
    async function loadCredits() {
        const user = getTelegramUser();
        const creditsEl = document.getElementById('navCreditsDisplay');
        if (!creditsEl) return;

        if (!user || !user.id) {
            creditsEl.textContent = '0';
            return;
        }

        try {
            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/user_credits?telegram_id=eq.${user.id}&select=suite_balance`,
                {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    }
                }
            );
            const data = await response.json();
            if (data && data.length > 0) {
                const balance = Math.floor(parseFloat(data[0].suite_balance) || 0);
                creditsEl.textContent = balance.toLocaleString();
                localStorage.setItem('suite_credits', balance.toString());
            } else {
                creditsEl.textContent = '0';
            }
        } catch (error) {
            console.error('Failed to load credits:', error);
            const cached = localStorage.getItem('suite_credits');
            creditsEl.textContent = cached || '0';
        }
    }

    // Load credits after nav is injected
    setTimeout(loadCredits, 100);
});
