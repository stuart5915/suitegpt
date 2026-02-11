// Inclawbate — Nav Auth State + Unread Badge + Disconnect
// Swaps "Launch Profile" for avatar+handle when logged in
// Shows unread badge on Inbox link
(function() {
    try {
        const token = localStorage.getItem('inclawbate_token');
        const profileStr = localStorage.getItem('inclawbate_profile');
        if (!profileStr) return;

        const profile = JSON.parse(profileStr);
        if (!profile || !profile.x_handle) return;

        const navLinks = document.querySelector('.nav-links');
        if (!navLinks) return;

        // Swap "Launch Profile" for avatar+handle with dropdown
        const launchBtn = navLinks.querySelector('a[href="/launch"]');
        if (launchBtn) {
            const wrapper = document.createElement('div');
            wrapper.className = 'nav-user-wrap';

            const userBtn = document.createElement('button');
            userBtn.className = 'nav-user';
            userBtn.type = 'button';

            if (profile.x_avatar_url) {
                const img = document.createElement('img');
                img.src = profile.x_avatar_url;
                img.className = 'nav-avatar';
                img.alt = '';
                userBtn.appendChild(img);
            } else {
                const span = document.createElement('span');
                span.className = 'nav-avatar-fallback';
                span.textContent = (profile.x_name || profile.x_handle || '?')[0].toUpperCase();
                userBtn.appendChild(span);
            }

            const handleSpan = document.createElement('span');
            handleSpan.className = 'nav-handle';
            handleSpan.textContent = `@${profile.x_handle}`;
            userBtn.appendChild(handleSpan);

            // Dropdown
            const dropdown = document.createElement('div');
            dropdown.className = 'nav-dropdown';
            dropdown.innerHTML = `
                <a href="/u/${encodeURIComponent(profile.x_handle)}" class="nav-dropdown-item">Profile</a>
                <button type="button" class="nav-dropdown-item nav-disconnect">Disconnect</button>
            `;

            wrapper.appendChild(userBtn);
            wrapper.appendChild(dropdown);
            launchBtn.replaceWith(wrapper);

            // Toggle dropdown
            userBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                wrapper.classList.toggle('open');
            });

            // Close on outside click
            document.addEventListener('click', () => {
                wrapper.classList.remove('open');
            });

            // Disconnect
            dropdown.querySelector('.nav-disconnect').addEventListener('click', () => {
                localStorage.removeItem('inclawbate_token');
                localStorage.removeItem('inclawbate_profile');
                localStorage.removeItem('inclawbate_last_inbox');
                window.location.reload();
            });
        }

        // Check for unread conversations
        if (!token) return;

        const inboxLink = navLinks.querySelector('a[href="/dashboard"]');
        if (!inboxLink) return;

        inboxLink.style.position = 'relative';

        fetch('/api/inclawbate/conversations', {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
            if (!data || !data.conversations || data.conversations.length === 0) return;

            const lastVisit = localStorage.getItem('inclawbate_last_inbox') || '1970-01-01';
            const unread = data.conversations.filter(c =>
                new Date(c.last_message_at) > new Date(lastVisit)
            ).length;

            if (unread > 0) {
                const badge = document.createElement('span');
                badge.className = 'nav-badge';
                badge.textContent = unread > 9 ? '9+' : unread;
                inboxLink.appendChild(badge);
            }
        })
        .catch(() => {});

    } catch (e) {
        // Silently fail
    }
})();
