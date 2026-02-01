// SUITE Homepage - App Store Style
// Handles app loading, filtering, auth, and profile

(function() {
    // Supabase config
    const SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODk3MTgsImV4cCI6MjA4MzM2NTcxOH0.DcLpWs8Lf1s0Flf54J5LubokSYrd7h-XvI_X0jj6bLM';

    let supabase;
    let allApps = [];
    let currentCategory = 'all';

    // Initialize Supabase
    if (window.supabase) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    // ═══════════════════════════════════════
    // App Loading & Display
    // ═══════════════════════════════════════

    async function loadApps() {
        if (!supabase) {
            console.error('Supabase not initialized');
            return;
        }

        try {
            const { data: apps, error } = await supabase
                .from('apps')
                .select('*')
                .eq('status', 'live')
                .order('created_at', { ascending: false });

            if (error) throw error;

            allApps = apps || [];
            renderApps(allApps.slice(0, 9)); // Show first 9 on homepage
            loadFeaturedApp(allApps[0]); // Feature the newest app
            updateAppCount(allApps.length);
        } catch (error) {
            console.error('Error loading apps:', error);
            document.getElementById('appsGrid').innerHTML = '<div class="loading-placeholder">Failed to load apps</div>';
        }
    }

    function renderApps(apps) {
        const grid = document.getElementById('appsGrid');
        if (!grid) return;

        if (apps.length === 0) {
            grid.innerHTML = '<div class="loading-placeholder">No apps found</div>';
            return;
        }

        grid.innerHTML = apps.map(app => `
            <div class="app-card" onclick="openApp('${app.slug}')">
                <div class="app-card-header">
                    <div class="app-card-icon">
                        ${app.icon_url
                            ? `<img src="${app.icon_url}" alt="${app.name}">`
                            : app.icon_emoji || '📱'
                        }
                    </div>
                    <div class="app-card-info">
                        <h3>${app.name}</h3>
                        <p>${app.tagline || ''}</p>
                    </div>
                </div>
                <span class="app-card-category">${formatCategory(app.category)}</span>
            </div>
        `).join('');
    }

    function loadFeaturedApp(app) {
        const container = document.getElementById('featuredApp');
        if (!container || !app) return;

        container.innerHTML = `
            <div class="featured-icon">
                ${app.icon_url
                    ? `<img src="${app.icon_url}" alt="${app.name}">`
                    : `<div style="background: var(--accent-gradient); width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 3rem;">${app.icon_emoji || '📱'}</div>`
                }
            </div>
            <div class="featured-info">
                <h3>${app.name}</h3>
                <p class="tagline">${app.tagline || ''}</p>
                <p class="description">${app.description || ''}</p>
                <div class="featured-meta">
                    <span class="featured-category">${formatCategory(app.category)}</span>
                    <span class="featured-rating">★ 4.8</span>
                </div>
                <a href="https://suitegpt.app/apps/${app.slug}" class="btn btn-primary">Open App</a>
            </div>
        `;
    }

    function formatCategory(category) {
        if (!category) return 'App';
        return category.charAt(0).toUpperCase() + category.slice(1);
    }

    function updateAppCount(count) {
        const el = document.getElementById('statApps');
        if (el) el.textContent = count + '+';
    }

    // Category filtering
    function filterByCategory(category) {
        currentCategory = category;

        // Update active tab
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === category);
        });

        // Filter apps
        const filtered = category === 'all'
            ? allApps
            : allApps.filter(app => app.category === category);

        renderApps(filtered.slice(0, 9));
    }

    // ═══════════════════════════════════════
    // Governance Stats
    // ═══════════════════════════════════════

    async function loadGovernanceStats() {
        if (!supabase) return;

        try {
            // Get proposal count
            const { count: proposalCount } = await supabase
                .from('factory_proposals')
                .select('*', { count: 'exact', head: true })
                .in('status', ['submitted', 'open_voting']);

            // Get total votes
            const { data: votes } = await supabase
                .from('factory_votes')
                .select('id');

            // Get top proposal
            const { data: proposals } = await supabase
                .from('factory_proposals')
                .select('title, upvotes')
                .eq('status', 'open_voting')
                .order('upvotes', { ascending: false })
                .limit(1);

            // Update UI
            document.getElementById('proposalCount').textContent = proposalCount || 0;
            document.getElementById('voteCount').textContent = votes?.length || 0;

            if (proposals && proposals[0]) {
                document.getElementById('topProposalTitle').textContent = proposals[0].title;
                document.getElementById('topProposalVotes').textContent = proposals[0].upvotes || 0;
            } else {
                document.getElementById('topProposalTitle').textContent = 'Be the first to suggest a feature!';
            }
        } catch (error) {
            console.error('Error loading governance stats:', error);
        }
    }

    // ═══════════════════════════════════════
    // User Proposal Slots
    // ═══════════════════════════════════════

    async function loadUserProposalSlots() {
        if (!supabase) return;

        const tgUser = getTelegramUser();
        const wallet = getConnectedWallet();

        // If not logged in, show empty slots
        if (!tgUser && !wallet) {
            updateSlotsVisual(0, 5);
            return;
        }

        try {
            // Find user in factory_users
            let user = null;

            if (tgUser) {
                const { data } = await supabase
                    .from('factory_users')
                    .select('id, is_founder, reputation')
                    .eq('telegram_id', tgUser.id.toString())
                    .single();
                user = data;
            } else if (wallet) {
                const { data } = await supabase
                    .from('factory_users')
                    .select('id, is_founder, reputation')
                    .eq('wallet_address', wallet.toLowerCase())
                    .single();
                user = data;
            }

            if (!user) {
                updateSlotsVisual(0, 5);
                return;
            }

            // Check if admin/founder (unlimited slots)
            if (user.is_founder) {
                updateSlotsVisual(0, 999, true); // Admin mode
                return;
            }

            // Calculate max slots based on reputation
            const baseLimit = 5;
            const repBonus = Math.min(Math.floor((user.reputation || 0) / 100), 10);
            const maxSlots = baseLimit + repBonus;

            // Count user's active proposals
            const { count: activeCount } = await supabase
                .from('factory_proposals')
                .select('*', { count: 'exact', head: true })
                .eq('author_id', user.id)
                .in('status', ['submitted', 'open_voting']);

            updateSlotsVisual(activeCount || 0, maxSlots);

        } catch (error) {
            console.error('Error loading user proposal slots:', error);
            updateSlotsVisual(0, 5);
        }
    }

    function updateSlotsVisual(used, max, isAdmin = false) {
        const container = document.getElementById('proposalSlots');
        const countEl = document.getElementById('userProposalCount');
        const cardEl = document.querySelector('.proposal-slots-card');

        if (!container) return;

        // Update count display
        if (countEl) {
            countEl.textContent = used;
        }

        // Update the count badge
        const countBadge = document.querySelector('.slots-count');
        if (countBadge) {
            if (isAdmin) {
                countBadge.textContent = 'Unlimited';
                countBadge.style.background = 'rgba(34, 197, 94, 0.3)';
                countBadge.style.color = '#86efac';
            } else {
                countBadge.innerHTML = `<span id="userProposalCount">${used}</span> / ${max}`;
            }
        }

        // Update hint text
        const hintEl = document.querySelector('.slots-hint');
        if (hintEl) {
            if (isAdmin) {
                hintEl.textContent = 'Admin mode: Unlimited proposals';
                hintEl.style.color = '#86efac';
            } else if (used >= max) {
                hintEl.textContent = 'All slots full! Wait for proposals to be processed or earn more reputation.';
                cardEl?.classList.add('slots-full');
            } else {
                hintEl.textContent = `Submit up to ${max} ideas at a time. Earn reputation to unlock more slots!`;
                cardEl?.classList.remove('slots-full');
            }
        }

        // Render slots (max 5 shown visually even if more available)
        const displaySlots = Math.min(max, 5);
        let slotsHtml = '';

        for (let i = 1; i <= displaySlots; i++) {
            if (i <= used) {
                // Filled slot
                slotsHtml += `
                    <div class="slot filled" data-slot="${i}">
                        <span class="slot-icon">✓</span>
                    </div>
                `;
            } else {
                // Empty slot
                slotsHtml += `
                    <div class="slot empty" data-slot="${i}">
                        <span class="slot-icon">+</span>
                    </div>
                `;
            }
        }

        // If more than 5 slots available, show a "+X more" indicator
        if (max > 5 && !isAdmin) {
            slotsHtml += `<div class="slot-extra">+${max - 5}</div>`;
        }

        container.innerHTML = slotsHtml;
    }

    // ═══════════════════════════════════════
    // Auth & Profile
    // ═══════════════════════════════════════

    function getConnectedWallet() {
        return localStorage.getItem('connectedWallet') || null;
    }

    function getTelegramUser() {
        return JSON.parse(localStorage.getItem('telegram_user') || 'null');
    }

    function truncateWallet(address) {
        if (!address) return '';
        return address.slice(0, 6) + '...' + address.slice(-4);
    }

    function updateProfileButton() {
        const wallet = getConnectedWallet();
        const tgUser = getTelegramUser();
        const profileText = document.getElementById('profileText');
        const profileBtn = document.querySelector('.profile-btn');

        if (wallet) {
            profileText.textContent = truncateWallet(wallet);
            profileBtn.classList.add('has-credits');
        } else if (tgUser) {
            profileText.textContent = '@' + (tgUser.username || tgUser.first_name || 'User');
            profileBtn.classList.remove('has-credits');
        } else {
            profileText.textContent = 'Profile';
            profileBtn.classList.remove('has-credits');
        }
    }

    // ═══════════════════════════════════════
    // Initialize
    // ═══════════════════════════════════════

    document.addEventListener('DOMContentLoaded', function() {
        loadApps();
        loadGovernanceStats();
        loadUserProposalSlots();
        updateProfileButton();

        // Category tab clicks
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => filterByCategory(tab.dataset.category));
        });
    });

    // Expose globals
    window.openApp = function(slug) {
        window.location.href = `https://suitegpt.app/apps/${slug}`;
    };
})();

// ═══════════════════════════════════════
// Mobile Nav Toggle
// ═══════════════════════════════════════

function toggleMobileNav() {
    const btn = document.querySelector('.mobile-menu-btn');
    const navRight = document.querySelector('.nav-right');
    btn.classList.toggle('active');
    navRight.classList.toggle('mobile-open');
}

// ═══════════════════════════════════════
// Profile Modal
// ═══════════════════════════════════════

function openProfileMenu() {
    const modal = document.getElementById('profileModal');
    const content = document.getElementById('profileModalContent');

    const wallet = localStorage.getItem('connectedWallet');
    const tgUser = JSON.parse(localStorage.getItem('telegram_user') || 'null');
    const credits = localStorage.getItem('suite_credits') || '0';

    const isLoggedIn = wallet || tgUser;
    const displayName = wallet
        ? wallet.slice(0, 6) + '...' + wallet.slice(-4)
        : tgUser
            ? '@' + (tgUser.username || tgUser.first_name)
            : 'Guest';

    if (isLoggedIn) {
        content.innerHTML = `
            <div class="profile-modal-header">
                <h3>Your Profile</h3>
                <p style="color: var(--text-medium);">${displayName}</p>
            </div>

            <div class="credits-display">
                <div class="credits-number">${parseInt(credits).toLocaleString()}</div>
                <div class="credits-label">Credits Available</div>
            </div>

            <div class="profile-actions">
                <a href="profile.html" class="profile-action">
                    <div class="profile-action-icon">⚡</div>
                    <div class="profile-action-text">
                        <h4>Manage Credits</h4>
                        <p>Buy, earn, or withdraw credits</p>
                    </div>
                </a>

                <a href="factory.html" class="profile-action">
                    <div class="profile-action-icon">🗳️</div>
                    <div class="profile-action-text">
                        <h4>Your Votes</h4>
                        <p>View proposals you've voted on</p>
                    </div>
                </a>
            </div>

            <button class="logout-btn" onclick="logoutAll()">Sign Out</button>
        `;
    } else {
        content.innerHTML = `
            <div class="profile-modal-header">
                <h3>Connect to SUITE</h3>
                <p style="color: var(--text-medium);">Sign in to track credits and vote</p>
            </div>

            <div class="profile-actions">
                <div class="profile-action" onclick="connectWallet()">
                    <div class="profile-action-icon">🔗</div>
                    <div class="profile-action-text">
                        <h4>Connect Wallet</h4>
                        <p>Full access with credits</p>
                    </div>
                </div>

                <div class="profile-divider"><span>or</span></div>

                <div class="profile-action" onclick="loginWithTelegram()">
                    <div class="profile-action-icon" style="background: #0088cc;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.015-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.442-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.142.121.1.154.234.169.337.015.103.034.337.019.519z"/>
                        </svg>
                    </div>
                    <div class="profile-action-text">
                        <h4>Login with Telegram</h4>
                        <p>Vote and submit ideas</p>
                    </div>
                </div>
            </div>
        `;
    }

    modal.classList.add('active');
}

function closeProfileMenu() {
    document.getElementById('profileModal').classList.remove('active');
}

async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask or another Web3 wallet!');
        window.open('https://metamask.io/download/', '_blank');
        return;
    }

    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length > 0) {
            localStorage.setItem('connectedWallet', accounts[0]);
            closeProfileMenu();
            location.reload();
        }
    } catch (error) {
        console.error('Wallet connection failed:', error);
    }
}

function loginWithTelegram() {
    const botId = '8574475080'; // SUITEGovBot (for getsuite.app domain)
    closeProfileMenu();

    if (!window.Telegram || !window.Telegram.Login) {
        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.onload = () => openTelegramAuth(botId);
        document.head.appendChild(script);
    } else {
        openTelegramAuth(botId);
    }
}

function openTelegramAuth(botId) {
    window.Telegram.Login.auth(
        { bot_id: botId, request_access: true },
        (user) => {
            if (user) {
                localStorage.setItem('telegram_user', JSON.stringify({
                    id: user.id,
                    username: user.username || user.first_name,
                    first_name: user.first_name,
                    auth_date: user.auth_date,
                    hash: user.hash
                }));
                location.reload();
            }
        }
    );
}

function logoutAll() {
    localStorage.removeItem('connectedWallet');
    localStorage.removeItem('telegram_user');
    localStorage.removeItem('suite_credits');
    closeProfileMenu();
    location.reload();
}
