// Just4Claws Nav Component
// Inserts nav into any page that includes it

const _B = window.J4C_BASE || '';

function renderNav() {
    const currentPath = window.location.pathname;
    const nav = document.createElement('nav');
    nav.className = 'j4c-nav';
    nav.innerHTML = `
        <div class="j4c-nav-inner">
            <a href="${_B || '/'}" class="j4c-nav-brand">Just4Claws</a>
            <div class="j4c-nav-links" id="nav-links">
                <a href="${_B}/app" class="j4c-nav-link ${currentPath.endsWith('/app') ? 'active' : ''}">Discover</a>
                <a href="${_B}/feed" class="j4c-nav-link ${currentPath.endsWith('/feed') ? 'active' : ''}">Feed</a>
                <a href="${_B}/studio" class="j4c-nav-link ${currentPath.endsWith('/studio') ? 'active' : ''}">Studio</a>
                <a href="${_B}/dashboard" class="j4c-nav-link ${currentPath.endsWith('/dashboard') ? 'active' : ''}">Dashboard</a>
            </div>
            <div class="j4c-nav-actions">
                <button class="j4c-nav-hamburger" onclick="toggleMobileNav()">&#9776;</button>
                <div class="j4c-nav-avatar" id="nav-avatar" onclick="toggleAvatarMenu()">
                    <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:700;" id="nav-avatar-letter"></div>
                </div>
            </div>
        </div>
        <div class="avatar-dropdown" id="avatar-dropdown">
            <a href="${_B}/settings">Settings</a>
            <a href="${_B}/content">My Content</a>
            <a href="${_B}/payout">Payouts</a>
            <div class="dropdown-divider"></div>
            <button class="dropdown-danger" onclick="signOut()">Sign Out</button>
        </div>
    `;
    document.body.prepend(nav);
}

function updateNav(profile) {
    if (!profile) return;
    const avatarLetter = document.getElementById('nav-avatar-letter');
    const avatar = document.getElementById('nav-avatar');

    if (profile.avatar_url) {
        avatar.innerHTML = `<img src="${profile.avatar_url}" alt="">`;
    } else if (avatarLetter) {
        avatarLetter.textContent = (profile.display_name || profile.handle || '?')[0].toUpperCase();
    }

    // Hide creator-only links for subscribers
    if (profile.role === 'subscriber') {
        document.querySelectorAll('.j4c-nav-link').forEach(link => {
            const href = link.getAttribute('href');
            if (href.endsWith('/studio') || href.endsWith('/dashboard')) {
                link.style.display = 'none';
            }
        });
    }
}

function toggleAvatarMenu() {
    document.getElementById('avatar-dropdown').classList.toggle('open');
}

function toggleMobileNav() {
    document.getElementById('nav-links').classList.toggle('mobile-open');
}

async function signOut() {
    await supabase.auth.signOut();
    window.location.href = _B + '/';
}

// Close dropdown on outside click
document.addEventListener('click', (e) => {
    const dd = document.getElementById('avatar-dropdown');
    const av = document.getElementById('nav-avatar');
    if (dd && !dd.contains(e.target) && !av?.contains(e.target)) {
        dd.classList.remove('open');
    }
});

// Init nav
renderNav();
