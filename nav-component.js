// SUITE Nav Component - Single source of truth for all getsuite.app navigation
// Injects nav into <nav id="main-nav"></nav>

(function() {
    const nav = document.getElementById('main-nav');
    if (!nav) return;

    // Supabase config
    const SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODk3MTgsImV4cCI6MjA4MzM2NTcxOH0.DcLpWs8Lf1s4Flf54J5LubokSYrd7h-XvI_X0jj6bLM';

    nav.className = 'nav';
    nav.innerHTML = `
        <div class="nav-inner">
            <a href="/" class="nav-logo">
                <img src="/assets/suite-logo-new.png" alt="SUITE" class="nav-logo-img">
                SUITE
            </a>
            <div class="nav-links">
                <a href="/suite-shell.html">Apps</a>
                <a href="/docs/">Docs</a>
                <a href="/learn.html">Learn</a>
                <a href="/factory.html">Governance</a>
                <a href="/wallet.html">Wallet</a>
            </div>
            <div class="nav-actions" id="navAuthArea">
                <!-- Not logged in: Connect button -->
                <button class="connect-btn" onclick="openNavConnectModal()" id="navConnectBtn">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    Connect
                </button>

                <!-- Logged in: Credits + Identity (hidden by default) -->
                <div class="auth-display" id="navAuthDisplay" style="display: none;">
                    <a href="/wallet.html" class="auth-credits" title="Your Credits">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                            <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                        </svg>
                        <span id="navCreditsDisplay">0</span>
                    </a>
                    <div class="auth-identity" id="navAuthIdentity" onclick="openNavProfileMenu()">
                        <span id="navAuthIdentityText">@user</span>
                    </div>
                </div>
            </div>
            <button class="mobile-menu-btn" onclick="toggleMobileMenu()">
                <span></span><span></span><span></span>
            </button>
        </div>
    `;

    // Inject connect modal
    const modalHtml = `
        <div class="connect-modal-overlay" id="navConnectModalOverlay" onclick="if(event.target === this) closeNavConnectModal()">
            <div class="connect-modal">
                <button class="connect-modal-close" onclick="closeNavConnectModal()">&times;</button>
                <h3>Connect to SUITE</h3>

                <div class="connect-options">
                    <div class="connect-option" onclick="connectWalletFromNav()">
                        <div class="connect-option-icon">🔗</div>
                        <div>
                            <div class="connect-option-title">Connect Wallet</div>
                            <div class="connect-option-desc">Full access with credits</div>
                        </div>
                    </div>

                    <div class="connect-divider">
                        <span>or</span>
                    </div>

                    <div class="connect-option telegram" onclick="loginWithTelegramWidget()">
                        <div class="connect-option-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.015-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.442-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.142.121.1.154.234.169.337.015.103.034.337.019.519z"/>
                            </svg>
                        </div>
                        <div>
                            <div class="connect-option-title">Login with Telegram</div>
                            <div class="connect-option-desc">Vote & submit ideas (link wallet for credits)</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Inject styles for connect modal only (button/pill styles are in nav.css)
    const styleEl = document.createElement('style');
    styleEl.textContent = `
        /* Connect Modal */
        .connect-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
        }
        .connect-modal-overlay.active {
            opacity: 1;
            visibility: visible;
        }
        .connect-modal {
            background: #1a1a2e;
            border-radius: 20px;
            padding: 24px;
            width: 90%;
            max-width: 380px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            position: relative;
        }
        .connect-modal-close {
            position: absolute;
            top: 16px;
            right: 16px;
            background: none;
            border: none;
            color: #9ca3af;
            font-size: 1.5rem;
            cursor: pointer;
            line-height: 1;
        }
        .connect-modal h3 {
            margin: 0 0 20px 0;
            color: #fff;
            font-size: 1.2rem;
        }
        .connect-options {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .connect-option {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 16px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .connect-option:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.2);
        }
        .connect-option-icon {
            font-size: 1.5rem;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
        }
        .connect-option.telegram .connect-option-icon {
            background: rgba(0, 136, 204, 0.2);
            color: #0088cc;
        }
        .connect-option-title {
            font-weight: 600;
            color: #fff;
            margin-bottom: 2px;
        }
        .connect-option-desc {
            font-size: 0.8rem;
            color: #9ca3af;
        }
        .connect-divider {
            display: flex;
            align-items: center;
            gap: 12px;
            color: #6b7280;
            font-size: 0.8rem;
        }
        .connect-divider::before, .connect-divider::after {
            content: '';
            flex: 1;
            height: 1px;
            background: rgba(255, 255, 255, 0.1);
        }
        .connect-back {
            color: #9ca3af;
            font-size: 0.85rem;
            cursor: pointer;
            margin-bottom: 16px;
        }
        .connect-back:hover {
            color: #fff;
        }
        .telegram-login-form label {
            display: block;
            color: #9ca3af;
            font-size: 0.85rem;
            margin-bottom: 8px;
        }
        .telegram-input-group {
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 12px;
            margin-bottom: 16px;
        }
        .telegram-input-group span {
            color: #6b7280;
        }
        .telegram-input-group input {
            flex: 1;
            background: none;
            border: none;
            color: #fff;
            font-size: 1rem;
            outline: none;
        }
        .telegram-login-btn {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px;
            background: #0088cc;
            border: none;
            border-radius: 10px;
            color: white;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .telegram-login-btn:hover {
            background: #0099dd;
        }

        @media (max-width: 768px) {
            .nav-actions .connect-btn {
                padding: 6px 12px;
                font-size: 0.8rem;
            }
            .nav-actions .auth-display {
                gap: 6px;
            }
            .nav-actions .auth-credits,
            .nav-actions .auth-identity {
                padding: 5px 10px;
                font-size: 0.75rem;
            }
        }
    `;
    document.head.appendChild(styleEl);

    // Get connected wallet from localStorage
    function getConnectedWallet() {
        return localStorage.getItem('connectedWallet') || localStorage.getItem('walletAddress') || localStorage.getItem('suiteWalletAddress') || localStorage.getItem('suiteWallet') || null;
    }

    // Get telegram user
    function getTelegramUser() {
        return JSON.parse(localStorage.getItem('telegram_user') || 'null');
    }

    // Truncate wallet address
    function truncateWallet(address) {
        if (!address) return '';
        return address.slice(0, 6) + '...' + address.slice(-4);
    }

    // Update auth display
    async function updateNavAuthDisplay() {
        const wallet = getConnectedWallet();
        const tgUser = getTelegramUser();
        const connectBtn = document.getElementById('navConnectBtn');
        const authDisplay = document.getElementById('navAuthDisplay');
        const creditsEl = document.getElementById('navCreditsDisplay');
        const identityEl = document.getElementById('navAuthIdentityText');

        if (!connectBtn || !authDisplay) return;

        if (wallet) {
            // Wallet connected
            connectBtn.style.display = 'none';
            authDisplay.style.display = 'flex';
            identityEl.textContent = truncateWallet(wallet);

            // Load credits
            try {
                const response = await fetch(
                    `${SUPABASE_URL}/rest/v1/suite_credits?wallet_address=eq.${wallet.toLowerCase()}&select=balance,locked_balance`,
                    {
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                        }
                    }
                );
                const data = await response.json();
                if (data && data.length > 0) {
                    const balance = Math.floor(parseFloat(data[0].balance || 0) + parseFloat(data[0].locked_balance || 0));
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
        } else if (tgUser) {
            // Telegram only
            connectBtn.style.display = 'none';
            authDisplay.style.display = 'flex';
            identityEl.textContent = '@' + tgUser.username;
            creditsEl.textContent = '0';
        } else {
            // Not logged in
            connectBtn.style.display = 'flex';
            authDisplay.style.display = 'none';
        }
    }

    // Initialize
    updateNavAuthDisplay();

    // Listen for storage changes
    window.addEventListener('storage', (e) => {
        if (e.key === 'connectedWallet' || e.key === 'walletAddress' || e.key === 'telegram_user') {
            updateNavAuthDisplay();
        }
    });

    // Expose globally
    window.refreshNavCredits = updateNavAuthDisplay;
})();

function toggleMobileMenu() {
    document.querySelector('.mobile-menu-btn').classList.toggle('active');
    document.querySelector('.nav-links').classList.toggle('mobile-open');
    document.querySelector('.nav-actions')?.classList.toggle('mobile-open');
}

// Modal functions
function openNavConnectModal() {
    document.getElementById('navConnectModalOverlay').classList.add('active');
}

function closeNavConnectModal() {
    document.getElementById('navConnectModalOverlay').classList.remove('active');
}

// Connect wallet from nav
async function connectWalletFromNav() {
    if (typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask or another Web3 wallet to connect!');
        window.open('https://metamask.io/download/', '_blank');
        return;
    }

    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length > 0) {
            const address = accounts[0];
            localStorage.setItem('connectedWallet', address);
            localStorage.setItem('suiteWalletAddress', address);
            localStorage.setItem('suiteWallet', address);
            window.walletAddress = address;

            console.log('Wallet connected:', address);
            closeNavConnectModal();

            if (window.refreshNavCredits) {
                window.refreshNavCredits();
            }
        }
    } catch (error) {
        console.error('Wallet connection failed:', error);
        if (error.code === 4001) {
            console.log('Connection cancelled by user');
        }
    }
}

// Telegram login using official widget script
function loginWithTelegramWidget() {
    const botUsername = 'suitehubbot';

    // Load Telegram widget script if not already loaded
    if (!window.Telegram || !window.Telegram.Login) {
        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.async = true;
        script.onload = () => doTelegramAuth(botUsername);
        document.head.appendChild(script);
    } else {
        doTelegramAuth(botUsername);
    }
}

function doTelegramAuth(botUsername) {
    // Use Telegram's official auth method
    window.Telegram.Login.auth(
        { bot_id: botUsername, request_access: true },
        (user) => {
            if (user) {
                const tgUser = {
                    id: user.id,
                    username: user.username || user.first_name,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    photo_url: user.photo_url,
                    auth_date: user.auth_date,
                    hash: user.hash
                };

                localStorage.setItem('telegram_user', JSON.stringify(tgUser));

                closeNavConnectModal();

                if (window.refreshNavCredits) {
                    window.refreshNavCredits();
                }

                // Reload page to reflect login state
                window.location.reload();
            } else {
                console.log('Telegram auth cancelled or failed');
            }
        }
    );
}

// Profile menu (disconnect)
function openNavProfileMenu() {
    const wallet = localStorage.getItem('connectedWallet');
    const tgUser = JSON.parse(localStorage.getItem('telegram_user') || 'null');

    if (wallet) {
        if (confirm('Disconnect wallet?')) {
            localStorage.removeItem('connectedWallet');
            localStorage.removeItem('walletAddress');
            localStorage.removeItem('suiteWalletAddress');
            localStorage.removeItem('suiteWallet');
            window.walletAddress = null;
            if (window.refreshNavCredits) {
                window.refreshNavCredits();
            }
        }
    } else if (tgUser) {
        if (confirm('Logout from Telegram?')) {
            localStorage.removeItem('telegram_user');
            if (window.refreshNavCredits) {
                window.refreshNavCredits();
            }
        }
    }
}

// Legacy support
async function handleNavCreditsClick(event) {
    event.preventDefault();
    openNavConnectModal();
    return false;
}
