// SUITE Nav Component - Single source of truth for all getsuite.app navigation
// Injects nav into <nav id="main-nav"></nav>

(function() {
    const nav = document.getElementById('main-nav');
    if (!nav) return;

    // Supabase config
    const SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODk3MTgsImV4cCI6MjA4MzM2NTcxOH0.DcLpWs8Lf1s4Flf54J5LubokSYrd7h-XvI_X0jj6bLM';

    // SuiteStaking contract config (Base mainnet)
    const SUITE_STAKING_ADDRESS = '0x539d3fE65339c0dA7aaa6D0a528b520d8B010F54';
    const SUITE_STAKING_ABI = [
        'function availableCredits(address) view returns (uint256)',
        'function stakedBalance(address) view returns (uint256)'
    ];
    const BASE_CHAIN_ID = 8453;
    const BASE_RPC = 'https://mainnet.base.org';

    // Dynamically load ethers.js if not already loaded
    let ethersLoaded = typeof ethers !== 'undefined';
    async function ensureEthers() {
        if (ethersLoaded) return true;
        if (typeof ethers !== 'undefined') {
            ethersLoaded = true;
            return true;
        }
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/ethers@6.9.0/dist/ethers.umd.min.js';
            script.onload = () => {
                ethersLoaded = true;
                resolve(true);
            };
            script.onerror = () => resolve(false);
            document.head.appendChild(script);
        });
    }

    nav.className = 'nav';
    nav.innerHTML = `
        <div class="nav-inner">
            <a href="/" class="nav-logo">
                <img src="/assets/suite-logo-new.png" alt="SUITE" class="nav-logo-img">
                SUITE
            </a>
            <div class="nav-links">
                <a href="/suitegpt.html">SuiteGPT</a>
                <a href="/suite-shell.html">Apps</a>
                <a href="/profile.html">Profile</a>
            </div>
        </div>
    `;

    // Bottom nav removed - keeping simple top nav only

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
        .connect-option.connected {
            cursor: default;
        }
        .connect-option.connected:hover {
            background: rgba(255, 255, 255, 0.05);
            border-color: rgba(255, 255, 255, 0.1);
        }
        .disconnect-btn {
            padding: 6px 12px;
            background: rgba(239, 68, 68, 0.2);
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: 8px;
            color: #ef4444;
            font-size: 0.75rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .disconnect-btn:hover {
            background: rgba(239, 68, 68, 0.3);
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
        const raw = localStorage.getItem('telegram_user');
        console.log('[Nav Auth] Raw telegram_user from localStorage:', raw);
        return JSON.parse(raw || 'null');
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

            // Load credits from SuiteStaking contract on Base
            try {
                // First show cached value while loading
                const cached = localStorage.getItem('suite_credits');
                if (cached) creditsEl.textContent = cached;

                // Ensure ethers is loaded
                const hasEthers = await ensureEthers();

                if (hasEthers && typeof ethers !== 'undefined') {
                    // Use Base RPC directly so it works regardless of user's current network
                    const provider = new ethers.JsonRpcProvider(BASE_RPC);
                    const stakingContract = new ethers.Contract(
                        SUITE_STAKING_ADDRESS,
                        SUITE_STAKING_ABI,
                        provider
                    );
                    const creditsRaw = await stakingContract.availableCredits(wallet);
                    // SUITE has 18 decimals, display as whole number
                    const credits = Math.floor(Number(creditsRaw) / 1e18);
                    creditsEl.textContent = credits.toLocaleString();
                    localStorage.setItem('suite_credits', credits.toString());
                    console.log('[Nav] Credits loaded from Base staking contract:', credits);
                } else {
                    console.log('[Nav] Ethers not available, using cached credits');
                }
            } catch (error) {
                console.error('Failed to load credits from contract:', error);
                const cached = localStorage.getItem('suite_credits');
                creditsEl.textContent = cached || '0';
            }
        } else if (tgUser) {
            // Telegram only
            connectBtn.style.display = 'none';
            authDisplay.style.display = 'flex';
            identityEl.textContent = '@' + (tgUser.username || tgUser.first_name || 'User');
            creditsEl.textContent = '0';
        } else {
            // Not logged in
            connectBtn.style.display = 'flex';
            authDisplay.style.display = 'none';
        }

        console.log('[Nav Auth] State:', { wallet: !!wallet, tgUser: !!tgUser });
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
    // Reset modal content to original connect options
    const modal = document.querySelector('.connect-modal');
    if (modal) {
        modal.innerHTML = `
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
                <div class="connect-divider"><span>or</span></div>
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
        `;
    }
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

            // Dispatch event so other scripts can react to wallet connection
            window.dispatchEvent(new CustomEvent('navAuthChanged', { detail: { wallet: address } }));

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

// Telegram login - clean one-click popup flow
function loginWithTelegramWidget() {
    const botId = '8341049569'; // SUITEHubBot

    closeNavConnectModal();

    // Load Telegram widget script if needed
    if (!window.Telegram || !window.Telegram.Login) {
        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.onload = () => openTelegramPopup(botId);
        document.head.appendChild(script);
    } else {
        openTelegramPopup(botId);
    }
}

function openTelegramPopup(botId) {
    window.Telegram.Login.auth(
        { bot_id: botId, request_access: true },
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

                if (window.refreshNavCredits) {
                    window.refreshNavCredits();
                }

                window.location.reload();
            }
        }
    );
}

// Profile menu - show account management modal
function openNavProfileMenu() {
    const wallet = localStorage.getItem('connectedWallet');
    const tgUser = JSON.parse(localStorage.getItem('telegram_user') || 'null');

    // Update modal content for account management
    const modal = document.querySelector('.connect-modal');
    if (!modal) return;

    const truncateWallet = (addr) => addr ? addr.slice(0, 6) + '...' + addr.slice(-4) : '';

    let content = '<h3>Your Account</h3><div class="connect-options">';

    // Wallet section
    if (wallet) {
        content += `
            <div class="connect-option connected">
                <div class="connect-option-icon">🔗</div>
                <div style="flex:1">
                    <div class="connect-option-title">Wallet Connected</div>
                    <div class="connect-option-desc">${truncateWallet(wallet)}</div>
                </div>
                <button class="disconnect-btn" onclick="disconnectWallet()">Disconnect</button>
            </div>
        `;
    } else {
        content += `
            <div class="connect-option" onclick="connectWalletFromNav()">
                <div class="connect-option-icon">🔗</div>
                <div>
                    <div class="connect-option-title">Connect Wallet</div>
                    <div class="connect-option-desc">Link your wallet for credits</div>
                </div>
            </div>
        `;
    }

    // Telegram section
    if (tgUser) {
        content += `
            <div class="connect-option connected">
                <div class="connect-option-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#0088cc">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.015-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.442-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.142.121.1.154.234.169.337.015.103.034.337.019.519z"/>
                    </svg>
                </div>
                <div style="flex:1">
                    <div class="connect-option-title">Telegram Connected</div>
                    <div class="connect-option-desc">@${tgUser.username || tgUser.first_name}</div>
                </div>
                <button class="disconnect-btn" onclick="disconnectTelegram()">Disconnect</button>
            </div>
        `;
    } else {
        content += `
            <div class="connect-option telegram" onclick="loginWithTelegramWidget()">
                <div class="connect-option-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.015-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.442-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.142.121.1.154.234.169.337.015.103.034.337.019.519z"/>
                    </svg>
                </div>
                <div>
                    <div class="connect-option-title">Login with Telegram</div>
                    <div class="connect-option-desc">Link your Telegram account</div>
                </div>
            </div>
        `;
    }

    content += '</div>';
    modal.innerHTML = `<button class="connect-modal-close" onclick="closeNavConnectModal()">&times;</button>${content}`;

    // Open the modal
    document.getElementById('navConnectModalOverlay').classList.add('active');
}

function disconnectWallet() {
    localStorage.removeItem('connectedWallet');
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('suiteWalletAddress');
    localStorage.removeItem('suiteWallet');
    window.walletAddress = null;
    closeNavConnectModal();

    // Dispatch event so other scripts can react to wallet disconnection
    window.dispatchEvent(new CustomEvent('navAuthChanged', { detail: { wallet: null } }));

    if (window.refreshNavCredits) {
        window.refreshNavCredits();
    }
}

function disconnectTelegram() {
    localStorage.removeItem('telegram_user');
    closeNavConnectModal();
    if (window.refreshNavCredits) {
        window.refreshNavCredits();
    }
}

// Legacy support
async function handleNavCreditsClick(event) {
    event.preventDefault();
    openNavConnectModal();
    return false;
}

// Bottom nav submenu toggle
function toggleBottomNavSubmenu(btn, type) {
    // Close other open submenus first
    document.querySelectorAll('.bottom-nav-item.expanded').forEach(item => {
        if (item !== btn) {
            item.classList.remove('expanded');
        }
    });

    // Toggle this submenu
    btn.classList.toggle('expanded');
}

// Close bottom nav submenus when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('.bottom-nav-item')) {
        document.querySelectorAll('.bottom-nav-item.expanded').forEach(item => {
            item.classList.remove('expanded');
        });
    }
});
