// Inclawbate — Nav Auth State
// Swaps "Launch Profile" button for user avatar+handle when logged in
(function() {
    try {
        const profileStr = localStorage.getItem('inclawbate_profile');
        if (!profileStr) return;

        const profile = JSON.parse(profileStr);
        if (!profile || !profile.x_handle) return;

        // Find the "Launch Profile" or "Edit Profile" nav button
        const navLinks = document.querySelector('.nav-links');
        if (!navLinks) return;

        const launchBtn = navLinks.querySelector('a[href="/launch"]');
        if (!launchBtn) return;

        // Replace with avatar + handle link
        const userLink = document.createElement('a');
        userLink.href = `/u/${profile.x_handle}`;
        userLink.className = 'nav-user';
        userLink.innerHTML = profile.x_avatar_url
            ? `<img src="${profile.x_avatar_url}" class="nav-avatar" alt="">`
            : `<span class="nav-avatar-fallback">${(profile.x_name || profile.x_handle)[0].toUpperCase()}</span>`;
        userLink.innerHTML += `<span class="nav-handle">@${profile.x_handle}</span>`;

        launchBtn.replaceWith(userLink);
    } catch (e) {
        // Silently fail — nav stays as default
    }
})();
