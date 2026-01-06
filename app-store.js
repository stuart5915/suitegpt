// PWA Install functionality and interactions

document.addEventListener('DOMContentLoaded', () => {
    // Handle install button clicks
    const installBtns = document.querySelectorAll('.install-btn');

    installBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const appCard = btn.closest('.app-card');
            const appName = appCard.querySelector('.app-name').textContent;
            const status = appCard.getAttribute('data-status');

            if (status === 'almost-live' || status === 'live') {
                // Show install modal
                showInstallModal(appName);
            } else {
                // Show pre-order modal
                showPreOrderModal(appName);
            }
        });
    });

    // App card clicks
    const appCards = document.querySelectorAll('.app-card, .featured-card');
    appCards.forEach(card => {
        card.addEventListener('click', () => {
            const appName = card.querySelector('.app-name, .featured-info h3').textContent;
            showAppDetails(appName);
        });
    });

    // Smooth scroll for carousel
    const carousel = document.querySelector('.carousel-track');
    let isDown = false;
    let startX;
    let scrollLeft;

    if (carousel) {
        carousel.addEventListener('mousedown', (e) => {
            isDown = true;
            startX = e.pageX - carousel.offsetLeft;
            scrollLeft = carousel.scrollLeft;
        });

        carousel.addEventListener('mouseleave', () => {
            isDown = false;
        });

        carousel.addEventListener('mouseup', () => {
            isDown = false;
        });

        carousel.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - carousel.offsetLeft;
            const walk = (x - startX) * 2;
            carousel.scrollLeft = scrollLeft - walk;
        });
    }
});

function showInstallModal(appName) {
    // Create simple modal
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(10px);
    `;

    modal.innerHTML = `
        <div style="
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1));
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 24px;
            padding: 3rem;
            max-width: 500px;
            text-align: center;
        ">
            <h2 style="font-size: 2rem; margin-bottom: 1rem;">Install ${appName}?</h2>
            <p style="color: rgba(255,255,255,0.7); margin-bottom: 2rem;">
                This will add ${appName} to your home screen as a Progressive Web App.
            </p>
            <div style="display: flex; gap: 1rem; justify-content: center;">
                <button onclick="this.closest('[style]').remove()" style="
                    padding: 1rem 2rem;
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 12px;
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                ">Cancel</button>
                <button onclick="installApp('${appName}'); this.closest('[style]').remove()" style="
                    padding: 1rem 2rem;
                    background: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%);
                    border: none;
                    border-radius: 12px;
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                ">Install</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

function showPreOrderModal(appName) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(10px);
    `;

    modal.innerHTML = `
        <div style="
            background: linear-gradient(135deg, rgba(249, 158, 11, 0.1), rgba(249, 115, 22, 0.1));
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 24px;
            padding: 3rem;
            max-width: 500px;
            text-align: center;
        ">
            <h2 style="font-size: 2rem; margin-bottom: 1rem;">Pre-order ${appName}</h2>
            <p style="color: rgba(255,255,255,0.7); margin-bottom: 2rem;">
                This app is currently in development. Join the waitlist to get notified when it launches!
            </p>
            <div style="display: flex; gap: 1rem; justify-content: center;">
                <button onclick="this.closest('[style]').remove()" style="
                    padding: 1rem 2rem;
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 12px;
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                ">Cancel</button>
                <button onclick="joinWaitlist('${appName}'); this.closest('[style]').remove()" style="
                    padding: 1rem 2rem;
                    background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
                    border: none;
                    border-radius: 12px;
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                ">Join Waitlist</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

function showAppDetails(appName) {
    // Placeholder for full app details modal
    console.log(`Show details for: ${appName}`);
}

function installApp(appName) {
    // PWA installation logic
    console.log(`Installing: ${appName}`);
    alert(`${appName} will be installed! (PWA logic to be implemented)`);
}

function joinWaitlist(appName) {
    console.log(`Joined waitlist for: ${appName}`);
    alert(`You're on the waitlist for ${appName}!`);
}
