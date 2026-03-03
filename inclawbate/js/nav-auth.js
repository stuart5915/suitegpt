// Inclawbate — Nav Mobile Menu
(function() {
    // ── Mobile hamburger toggle ──
    try {
        var nav = document.querySelector('.nav');
        var navLinks = document.querySelector('.nav-links');
        if (nav && navLinks) {
            var toggle = document.createElement('button');
            toggle.className = 'nav-toggle';
            toggle.setAttribute('aria-label', 'Menu');
            toggle.innerHTML = '<svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
            nav.appendChild(toggle);
            toggle.addEventListener('click', function() {
                navLinks.classList.toggle('open');
                var isOpen = navLinks.classList.contains('open');
                toggle.innerHTML = isOpen
                    ? '<svg viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>'
                    : '<svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
            });
        }
    } catch(e) {}
})();
