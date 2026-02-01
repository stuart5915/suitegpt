/* ═══════════════════════════════════════════════════════════════
   HOMEPAGE JAVASCRIPT
   Consolidated scripts for the SUITE homepage
   ═══════════════════════════════════════════════════════════════ */

// Store apps data for modal
let carouselAppsData = [];

/* === COUNTDOWN TIMER === */
function updateCountdown() {
    const hoursEl = document.getElementById('countdown-hours');
    const minutesEl = document.getElementById('countdown-minutes');
    const secondsEl = document.getElementById('countdown-seconds');

    if (!hoursEl || !minutesEl || !secondsEl) return;

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0); // 10 AM EST

    // If it's past 10 AM today, countdown to tomorrow
    const today10am = new Date(now);
    today10am.setHours(10, 0, 0, 0);
    const target = now > today10am ? tomorrow : today10am;

    const diff = target - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    hoursEl.textContent = String(hours).padStart(2, '0');
    minutesEl.textContent = String(minutes).padStart(2, '0');
    secondsEl.textContent = String(seconds).padStart(2, '0');
}

/* === AI FLEET - LOAD LATEST APP === */
async function loadFleetLatestApp() {
    const iconEl = document.getElementById('fleetAppIcon');
    const nameEl = document.getElementById('fleetAppName');
    const taglineEl = document.getElementById('fleetAppTagline');
    const stakeEl = document.getElementById('fleetAppStake');
    const daysEl = document.getElementById('fleetAppDays');

    if (!nameEl || !window.SuiteAppStore) return;

    try {
        const apps = await window.SuiteAppStore.fetchAllSuiteApps();

        // Get the most recently created live app
        const liveApps = apps.filter(app =>
            app.status === 'live' || app.status === 'approved' || app.status === 'published'
        );

        if (liveApps.length === 0) {
            nameEl.textContent = 'Coming Soon';
            taglineEl.textContent = 'New app launching tomorrow';
            return;
        }

        // Sort by created_at descending
        liveApps.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const latestApp = liveApps[0];

        // Update UI
        if (iconEl) {
            if (latestApp.icon_url && !latestApp.icon_url.includes('example.com')) {
                iconEl.innerHTML = `<a href="https://suitegpt.app/apps" class="fleet-icon-link"><img src="${latestApp.icon_url}" alt="${latestApp.name}"></a>`;
            } else {
                iconEl.innerHTML = `<a href="https://suitegpt.app/apps" class="fleet-icon-link">${latestApp.icon || latestApp.icon_emoji || '📱'}</a>`;
            }
        }

        nameEl.textContent = latestApp.name;
        if (taglineEl) taglineEl.textContent = latestApp.tagline || latestApp.category || 'AI-powered app';
        if (stakeEl) stakeEl.textContent = `💎 $${latestApp.total_staked || 0} funded`;
        if (daysEl) {
            const createdDate = new Date(latestApp.created_at);
            const daysSinceLaunch = Math.floor((Date.now() - createdDate) / (1000 * 60 * 60 * 24));
            const daysRemaining = Math.max(0, 30 - daysSinceLaunch);
            daysEl.textContent = `⏰ ${daysRemaining} days`;
        }

    } catch (err) {
        console.error('Failed to load fleet app:', err);
        nameEl.textContent = 'Offline';
        if (taglineEl) taglineEl.textContent = 'Check connection';
    }
}

/* === APPS CAROUSEL === */
async function loadAppsCarousel() {
    const container = document.getElementById('appsCarousel');
    if (!container || !window.SuiteAppStore) return;

    try {
        const apps = await window.SuiteAppStore.fetchAllSuiteApps();
        const liveApps = apps.length > 0 ? apps : [];
        carouselAppsData = liveApps;

        if (liveApps.length === 0) {
            container.innerHTML = `
                <div class="carousel-card">
                    <div class="card-icon">📱</div>
                    <div class="card-info">
                        <h3>No Apps Yet</h3>
                        <p>Be the first to publish!</p>
                    </div>
                </div>
            `;
            return;
        }

        // Duplicate apps 4x for seamless infinite loop
        const duplicatedApps = [...liveApps, ...liveApps, ...liveApps, ...liveApps];
        container.innerHTML = duplicatedApps.map((app, index) =>
            renderCarouselCard(app, index % liveApps.length)
        ).join('');

        // Dynamic animation duration
        const animationDuration = Math.max(liveApps.length * 8, 30);
        container.style.animationDuration = animationDuration + 's';

        // Add click handlers
        container.querySelectorAll('.carousel-card').forEach((card, i) => {
            card.addEventListener('click', () => {
                const appIndex = i % liveApps.length;
                openAppModal(carouselAppsData[appIndex]);
            });
        });

        // Setup drag-to-scroll
        setupCarouselDrag(container);

    } catch (err) {
        console.error('Failed to load apps carousel:', err);
        container.innerHTML = `
            <div class="carousel-card">
                <div class="card-icon">📱</div>
                <div class="card-info">
                    <h3>Offline</h3>
                    <p>Check your connection</p>
                </div>
            </div>
        `;
    }
}

function renderCarouselCard(app, index) {
    const iconUrl = app.icon_url && !app.icon_url.includes('example.com') ? app.icon_url : null;
    const iconEmoji = app.icon_emoji || app.icon || '📱';
    const rating = app.rating ? app.rating.toFixed(1) : '4.9';

    const iconHtml = iconUrl
        ? `<img src="${iconUrl}" alt="${app.name}">`
        : iconEmoji;

    return `
        <div class="carousel-card" data-app-index="${index}">
            <div class="card-header">
                <div class="card-icon">${iconHtml}</div>
                <div class="card-info">
                    <h3>${app.name}</h3>
                    <p>${app.tagline || app.category || 'productivity'}</p>
                </div>
            </div>
            <div class="card-tagline">${app.description ? app.description.slice(0, 80) + '...' : ''}</div>
        </div>
    `;
}

function setupCarouselDrag(carousel) {
    let isDown = false;
    let startX;
    let velocity = 0;
    let momentumId = null;
    const wrapper = carousel.parentElement;

    carousel.addEventListener('mousedown', (e) => {
        isDown = true;
        carousel.classList.add('dragging');
        startX = e.pageX;
        cancelMomentum();
        e.preventDefault();
    });

    carousel.addEventListener('mouseleave', () => {
        if (isDown) {
            isDown = false;
            carousel.classList.remove('dragging');
            applyMomentum();
        }
    });

    carousel.addEventListener('mouseup', () => {
        isDown = false;
        carousel.classList.remove('dragging');
        applyMomentum();
    });

    carousel.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX;
        const walk = (x - startX) * 2;
        velocity = x - startX;
        startX = x;
        wrapper.scrollLeft = wrapper.scrollLeft - walk;
    });

    // Touch support
    carousel.addEventListener('touchstart', (e) => {
        isDown = true;
        carousel.classList.add('dragging');
        startX = e.touches[0].pageX;
        cancelMomentum();
    }, { passive: true });

    carousel.addEventListener('touchend', () => {
        isDown = false;
        carousel.classList.remove('dragging');
        applyMomentum();
    });

    carousel.addEventListener('touchmove', (e) => {
        if (!isDown) return;
        const x = e.touches[0].pageX;
        const walk = (x - startX) * 2;
        velocity = x - startX;
        startX = x;
        wrapper.scrollLeft = wrapper.scrollLeft - walk;
    }, { passive: true });

    function applyMomentum() {
        if (Math.abs(velocity) > 1) {
            momentumId = requestAnimationFrame(function momentum() {
                velocity *= 0.95;
                wrapper.scrollLeft -= velocity;
                if (Math.abs(velocity) > 0.5) {
                    momentumId = requestAnimationFrame(momentum);
                }
            });
        }
    }

    function cancelMomentum() {
        if (momentumId) {
            cancelAnimationFrame(momentumId);
            momentumId = null;
        }
    }
}

/* === APP MODAL === */
function openAppModal(app) {
    const modal = document.getElementById('appExpandModal');
    const content = document.getElementById('appExpandContent');
    if (!modal || !content) return;

    const iconUrl = app.icon_url && !app.icon_url.includes('example.com') ? app.icon_url : null;
    const iconEmoji = app.icon_emoji || app.icon || '📱';
    const appUrl = app.expo_link || app.pwa_url || `app.html?slug=${app.slug}`;
    const description = app.description || app.tagline || 'An amazing app built with SUITE.';

    const iconHtml = iconUrl
        ? `<img src="${iconUrl}" alt="${app.name}">`
        : iconEmoji;

    content.innerHTML = `
        <button class="expand-close" onclick="closeAppModal()">✕</button>
        <div class="expand-header">
            <div class="expand-icon">${iconHtml}</div>
            <div class="expand-title">
                <h2>${app.name}</h2>
                <p>${app.tagline || app.category || 'productivity'}</p>
            </div>
        </div>
        <p class="expand-description">${description}</p>
        <div class="expand-actions">
            <a href="${appUrl}" class="expand-btn primary">Try Now</a>
            <a href="app.html?slug=${app.slug}" class="expand-btn secondary">Learn More</a>
        </div>
    `;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeAppModal() {
    const modal = document.getElementById('appExpandModal');
    if (modal) {
        modal.classList.remove('open');
        document.body.style.overflow = '';
    }
}

/* === STATS LOADING === */
async function loadGrowthStats() {
    const appsEl = document.getElementById('statAppsPublished');
    if (!appsEl) return;

    try {
        if (window.SuiteAppStore) {
            const apps = await window.SuiteAppStore.fetchAllSuiteApps();
            const liveApps = apps.filter(app =>
                app.status === 'live' || app.status === 'published' || app.status === 'approved'
            );
            appsEl.textContent = liveApps.length + '+';
        } else {
            appsEl.textContent = '5+';
        }
    } catch (err) {
        console.error('Failed to load growth stats:', err);
        appsEl.textContent = '5+';
    }
}

/* === INITIALIZE === */
document.addEventListener('DOMContentLoaded', function() {
    // Start countdown timer
    updateCountdown();
    setInterval(updateCountdown, 1000);

    // Load dynamic content
    loadFleetLatestApp();
    loadAppsCarousel();
    loadGrowthStats();

    // Modal close handlers
    const modal = document.getElementById('appExpandModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) closeAppModal();
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeAppModal();
    });
});
