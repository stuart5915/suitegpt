// SUITE Hub - Telegram Mini App

// Supabase config
const SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODk3MTgsImV4cCI6MjA4MzM2NTcxOH0.DcLpWs8Lf1s4Flf54J5LubokSYrd7h-XvI_X0jj6bLM';

// Initialize Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Telegram WebApp
const tg = window.Telegram?.WebApp;

// App state
let apps = [];
let user = null;
let credits = 0;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Telegram WebApp
    if (tg) {
        tg.ready();
        tg.expand(); // Expand to full height

        // Apply Telegram theme
        document.body.style.backgroundColor = tg.backgroundColor || '#0A0A1A';

        // Get user data from Telegram
        if (tg.initDataUnsafe?.user) {
            user = tg.initDataUnsafe.user;
            updateUserUI();
            await loadUserCredits();
        }

        // Enable closing confirmation
        tg.enableClosingConfirmation();

        // Set header color
        tg.setHeaderColor('#0A0A1A');
        tg.setBackgroundColor('#0A0A1A');
    }

    // Load apps from Supabase
    await loadApps();

    // Set up haptic feedback for buttons
    setupHaptics();
});

// Update UI with user data
function updateUserUI() {
    if (!user) return;

    const firstName = user.first_name || 'Guest';
    const lastName = user.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();

    // Update welcome card
    document.getElementById('userName').textContent = fullName;
    document.getElementById('profileName').textContent = fullName;

    // Update avatar with first letter
    const avatarLetter = firstName.charAt(0).toUpperCase();
    document.getElementById('userAvatar').textContent = avatarLetter;
    document.getElementById('profileAvatar').textContent = avatarLetter;
}

// Load user credits from Supabase
async function loadUserCredits() {
    if (!user) return;

    try {
        const { data, error } = await supabaseClient
            .from('user_credits')
            .select('suite_balance')
            .eq('telegram_id', user.id.toString())
            .single();

        if (data) {
            credits = data.suite_balance || 0;
            updateCreditsUI();
        }
    } catch (err) {
        console.log('No credits found for user');
    }
}

// Update credits display
function updateCreditsUI() {
    const formatted = credits.toLocaleString();
    document.getElementById('creditsAmount').textContent = formatted;
    document.getElementById('walletCredits').textContent = formatted;
    document.getElementById('balanceUsd').textContent = `≈ $${(credits * 0.001).toFixed(2)} USD`;
}

// Load apps from Supabase
async function loadApps() {
    try {
        const { data, error } = await supabaseClient
            .from('apps')
            .select('*')
            .in('status', ['approved', 'featured'])
            .order('created_at', { ascending: false });

        if (error) throw error;

        apps = data || [];
        document.getElementById('appsCount').textContent = `${apps.length} apps`;

        renderRecentApps();
        renderAppsList();
        renderFeaturedApp();

    } catch (err) {
        console.error('Error loading apps:', err);
    }
}

// Render recent apps (horizontal scroll)
function renderRecentApps() {
    const container = document.getElementById('recentApps');
    container.innerHTML = apps.slice(0, 8).map(app => `
        <div class="app-card-small" onclick="openApp('${app.slug}')">
            <div class="app-icon-small">${getAppEmoji(app)}</div>
            <div class="app-name-small">${app.name}</div>
        </div>
    `).join('');
}

// Render apps list
function renderAppsList() {
    const container = document.getElementById('appsList');
    container.innerHTML = apps.map(app => `
        <div class="app-card" onclick="openApp('${app.slug}')">
            <div class="app-icon">${getAppEmoji(app)}</div>
            <div class="app-info">
                <div class="app-name">${app.name}</div>
                <div class="app-tagline">${app.tagline || 'Tap to explore'}</div>
                <div class="app-meta">
                    <span class="app-badge">${app.category || 'App'}</span>
                    ${app.status === 'featured' ? '<span class="app-badge featured">🔥 Featured</span>' : ''}
                </div>
            </div>
            <div class="app-arrow">→</div>
        </div>
    `).join('');
}

// Render featured app
function renderFeaturedApp() {
    const featured = apps.find(a => a.status === 'featured') || apps[0];
    if (!featured) return;

    const container = document.getElementById('featuredApp');
    container.innerHTML = `
        <div class="featured-icon">${getAppEmoji(featured)}</div>
        <div class="featured-info">
            <div class="featured-name">${featured.name}</div>
            <div class="featured-tagline">${featured.tagline || 'Tap to explore'}</div>
        </div>
        <div class="featured-arrow">→</div>
    `;
    container.onclick = () => openApp(featured.slug);
}

// Get emoji for app (based on name/category)
function getAppEmoji(app) {
    const name = app.name.toLowerCase();
    if (name.includes('food') || name.includes('nutrition')) return '🍎';
    if (name.includes('optic') || name.includes('eye')) return '👁️';
    if (name.includes('cheshbon') || name.includes('finance')) return '📊';
    if (name.includes('fit') || name.includes('health')) return '💪';
    if (name.includes('ai') || name.includes('chat')) return '🤖';
    return '📱';
}

// Filter apps by search
function filterApps() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const filtered = apps.filter(app =>
        app.name.toLowerCase().includes(query) ||
        (app.category && app.category.toLowerCase().includes(query))
    );

    const container = document.getElementById('appsList');
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <div class="empty-text">No apps found</div>
            </div>
        `;
    } else {
        container.innerHTML = filtered.map(app => `
            <div class="app-card" onclick="openApp('${app.slug}')">
                <div class="app-icon">${getAppEmoji(app)}</div>
                <div class="app-info">
                    <div class="app-name">${app.name}</div>
                    <div class="app-tagline">${app.tagline || 'Tap to explore'}</div>
                    <div class="app-meta">
                        <span class="app-badge">${app.category || 'App'}</span>
                        ${app.status === 'featured' ? '<span class="app-badge featured">🔥 Featured</span>' : ''}
                    </div>
                </div>
                <div class="app-arrow">→</div>
            </div>
        `).join('');
    }
}

// Show screen
function showScreen(screenId) {
    // Haptic feedback
    if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }

    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    // Show target screen
    document.getElementById(screenId).classList.add('active');

    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.screen === screenId);
    });

    // Show/hide bottom nav
    const app = document.getElementById('app');
    app.classList.toggle('viewing-app', screenId === 'appViewScreen');
}

// Open app in Telegram browser
function openApp(slug) {
    const app = apps.find(a => a.slug === slug);
    if (!app) return;

    // Haptic feedback
    if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('medium');
    }

    const url = app.app_url?.startsWith('http')
        ? app.app_url
        : `https://www.getsuite.app${app.app_url || '/' + slug}`;

    // Open in Telegram's browser (fullscreen, camera works)
    if (tg) {
        tg.openLink(url);
    } else {
        window.open(url, '_blank');
    }
}

// Close app WebView
function closeApp() {
    document.getElementById('appFrame').src = '';
    showScreen('homeScreen');

    if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
}

// Open external web app
function openWebApp(url) {
    if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }

    if (tg) {
        tg.openLink(url);
    } else {
        window.open(url, '_blank');
    }
}

// Join community
function joinCommunity() {
    if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }

    // Open SUITE Telegram channel/group
    if (tg) {
        tg.openTelegramLink('https://t.me/SUITEHub');
    } else {
        window.open('https://t.me/SUITEHub', '_blank');
    }
}

// Setup haptic feedback for all interactive elements
function setupHaptics() {
    if (!tg?.HapticFeedback) return;

    document.querySelectorAll('.action-card, .app-card, .link-card, .wallet-btn, .nav-item').forEach(el => {
        el.addEventListener('touchstart', () => {
            tg.HapticFeedback.impactOccurred('light');
        });
    });
}

// Utility: Create or update user in Supabase
async function ensureUserExists() {
    if (!user) return;

    try {
        const { data, error } = await supabaseClient
            .from('user_credits')
            .upsert({
                telegram_id: user.id.toString(),
                telegram_username: user.username,
                telegram_first_name: user.first_name,
                telegram_last_name: user.last_name,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'telegram_id'
            });

        if (error) console.error('Error upserting user:', error);
    } catch (err) {
        console.error('Error ensuring user exists:', err);
    }
}
