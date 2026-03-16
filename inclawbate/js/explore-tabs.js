// Shared Explore tab bar — include on any explore page
// Auto-inserts a sticky tab bar below the nav, highlights the active tab
(function() {
    var TABS = [
        { label: 'Tokens',       href: '/tokens' },
        { label: 'Apps',         href: '/apps' },
        { label: 'NFTs',         href: '/nfts' },
        { label: 'Staking',      href: '/stake' },
        { label: 'Agents',       href: '/agents' },
        { label: 'Inclawbators', href: '/inclawbators' },
        { label: 'Tools',        href: '/tools' }
    ];

    var path = location.pathname.replace(/\/$/, '') || '/';

    // Inject CSS
    var style = document.createElement('style');
    style.textContent =
        '.explore-tabs{' +
            'position:sticky;top:var(--nav-height,60px);z-index:90;' +
            'background:var(--bg-deepest);' +
            'border-bottom:1px solid var(--border-subtle);' +
            'margin-top:var(--nav-height,60px);' +
        '}' +
        '.explore-tabs-inner{' +
            'display:flex;gap:0;max-width:900px;margin:0 auto;' +
            'overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;' +
            'padding:0 var(--space-md);' +
        '}' +
        '.explore-tabs-inner::-webkit-scrollbar{display:none}' +
        '.explore-tab{' +
            'flex-shrink:0;padding:11px 16px;' +
            'font-family:var(--font-display,Nunito,sans-serif);' +
            'font-size:0.82rem;font-weight:600;' +
            'color:var(--text-dim);text-decoration:none;' +
            'border-bottom:2px solid transparent;' +
            'transition:color 0.15s,border-color 0.15s;' +
            'white-space:nowrap;' +
        '}' +
        '.explore-tab:hover{color:var(--text-primary)}' +
        '.explore-tab.active{' +
            'color:var(--lobster-400,#e87955);' +
            'border-bottom-color:var(--lobster-400,#e87955);' +
        '}' +
        '@media(max-width:600px){' +
            '.explore-tabs-inner{padding:0 var(--space-xs)}' +
            '.explore-tab{padding:10px 12px;font-size:0.76rem}' +
        '}';
    document.head.appendChild(style);

    // Build tabs
    var bar = document.createElement('div');
    bar.className = 'explore-tabs';

    var inner = document.createElement('div');
    inner.className = 'explore-tabs-inner';

    TABS.forEach(function(tab) {
        var a = document.createElement('a');
        a.href = tab.href;
        a.className = 'explore-tab';
        a.textContent = tab.label;
        if (path === tab.href || (tab.href !== '/' && path.startsWith(tab.href + '/'))) {
            a.classList.add('active');
        }
        inner.appendChild(a);
    });

    bar.appendChild(inner);

    // Insert after nav
    var nav = document.querySelector('nav.nav') || document.querySelector('nav');
    if (nav) {
        nav.parentNode.insertBefore(bar, nav.nextSibling);
    }

    // Scroll active tab into view on mobile
    var activeTab = inner.querySelector('.explore-tab.active');
    if (activeTab) {
        setTimeout(function() {
            activeTab.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' });
        }, 50);
    }
})();
