// ============================================
// STUART HOLLINGER LANDING PAGE - JavaScript
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize all components
    initNavigation();
    initSmoothScroll();
    initFormHandler();
    initAnimations();
    initTokenCalculator();
});

// ============================================
// NAVIGATION
// ============================================
function initNavigation() {
    const nav = document.querySelector('.nav');
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');

    // Scroll effect for nav
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        // Add/remove background on scroll
        if (currentScroll > 50) {
            nav.style.background = 'rgba(10, 10, 15, 0.95)';
        } else {
            nav.style.background = 'rgba(10, 10, 15, 0.8)';
        }

        lastScroll = currentScroll;
    });

    // Mobile menu toggle
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('mobile-open');
            mobileMenuBtn.classList.toggle('active');
        });
    }
}

// ============================================
// SMOOTH SCROLL
// ============================================
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');

            if (targetId === '#') return;

            const target = document.querySelector(targetId);
            if (target) {
                const navHeight = document.querySelector('.nav').offsetHeight;
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navHeight;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });

                // Close mobile menu if open
                const navLinks = document.querySelector('.nav-links');
                if (navLinks.classList.contains('mobile-open')) {
                    navLinks.classList.remove('mobile-open');
                    document.querySelector('.mobile-menu-btn').classList.remove('active');
                }
            }
        });
    });
}

// ============================================
// FORM HANDLER
// ============================================
function initFormHandler() {
    const form = document.getElementById('subscribeForm');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const emailInput = form.querySelector('input[type="email"]');
            const submitBtn = form.querySelector('button[type="submit"]');
            const email = emailInput.value.trim();

            if (!email) return;

            // Disable button and show loading state
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <span>Joining...</span>
                <svg class="spinner" width="20" height="20" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="30 70" />
                </svg>
            `;

            // Simulate API call (replace with actual endpoint)
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Show success state
            submitBtn.innerHTML = `
                <span>You're on the list!</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 6L9 17l-5-5"/>
                </svg>
            `;
            submitBtn.style.background = 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';

            // Reset form
            emailInput.value = '';

            // Reset button after delay
            setTimeout(() => {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
                submitBtn.style.background = '';
            }, 3000);
        });
    }
}

// ============================================
// SCROLL ANIMATIONS
// ============================================
function initAnimations() {
    // Intersection Observer for fade-in animations
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe elements
    const animateElements = document.querySelectorAll(
        '.app-category, .token-card, .how-it-works, .flywheel-visual, .pricing-card, .early-alert'
    );

    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // Add animate-in class handler
    document.head.insertAdjacentHTML('beforeend', `
        <style>
            .animate-in {
                opacity: 1 !important;
                transform: translateY(0) !important;
            }
        </style>
    `);

    // Stagger animation for app items
    const appItems = document.querySelectorAll('.app-item');
    appItems.forEach((item, index) => {
        item.style.transitionDelay = `${index * 0.1}s`;
    });

    // Animate floating cards with different speeds
    const cards = document.querySelectorAll('.app-card');
    cards.forEach((card, index) => {
        const duration = 5 + (index * 0.5);
        card.style.animationDuration = `${duration}s`;
    });
}

// ============================================
// COUNTER ANIMATION (for stats)
// ============================================
function animateCounter(element, target, duration = 2000) {
    let start = 0;
    const increment = target / (duration / 16);

    const updateCounter = () => {
        start += increment;
        if (start < target) {
            element.textContent = Math.floor(start).toLocaleString();
            requestAnimationFrame(updateCounter);
        } else {
            element.textContent = target.toLocaleString();
        }
    };

    updateCounter();
}

// ============================================
// UTILITY: Add CSS spinner animation
// ============================================
document.head.insertAdjacentHTML('beforeend', `
    <style>
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .spinner {
            animation: spin 1s linear infinite;
        }
        
        /* Mobile menu styles */
        @media (max-width: 768px) {
            .nav-links {
                position: fixed;
                top: 70px;
                left: 0;
                right: 0;
                background: rgba(10, 10, 15, 0.98);
                backdrop-filter: blur(20px);
                flex-direction: column;
                padding: 24px;
                gap: 16px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                transform: translateY(-100%);
                opacity: 0;
                pointer-events: none;
                transition: all 0.3s ease;
            }
            
            .nav-links.mobile-open {
                transform: translateY(0);
                opacity: 1;
                pointer-events: all;
            }
            
            .nav-links a {
                font-size: 1.1rem;
                padding: 12px 0;
            }
            
            .nav-cta {
                width: 100%;
                text-align: center;
                margin-top: 8px;
            }
            
            .mobile-menu-btn.active span:nth-child(1) {
                transform: rotate(45deg) translate(5px, 5px);
            }
            
            .mobile-menu-btn.active span:nth-child(2) {
                opacity: 0;
            }
            
            .mobile-menu-btn.active span:nth-child(3) {
                transform: rotate(-45deg) translate(7px, -6px);
            }
            
            .mobile-menu-btn span {
                transition: all 0.3s ease;
            }
        }
    </style>
`);

// ============================================
// PRICING CARD HOVER EFFECT
// ============================================
document.querySelectorAll('.pricing-card').forEach(card => {
    card.addEventListener('mouseenter', function () {
        if (!this.classList.contains('featured')) {
            this.style.borderColor = 'rgba(99, 102, 241, 0.3)';
        }
    });

    card.addEventListener('mouseleave', function () {
        if (!this.classList.contains('featured')) {
            this.style.borderColor = '';
        }
    });
});

// ============================================
// FLYWHEEL ANIMATION
// ============================================
function initFlywheelAnimation() {
    const flywheel = document.querySelector('.flywheel');
    if (!flywheel) return;

    const items = flywheel.querySelectorAll('.flywheel-item');
    let currentHighlight = 0;

    setInterval(() => {
        // Remove highlight from all items
        items.forEach(item => {
            item.querySelector('.flywheel-icon').style.background = '';
            item.querySelector('.flywheel-icon').style.borderColor = '';
        });

        // Add highlight to current item
        const currentIcon = items[currentHighlight].querySelector('.flywheel-icon');
        currentIcon.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(168, 85, 247, 0.3))';
        currentIcon.style.borderColor = 'rgba(99, 102, 241, 0.5)';

        currentHighlight = (currentHighlight + 1) % items.length;
    }, 1500);
}

// Initialize flywheel animation when element is visible
const flywheelObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            initFlywheelAnimation();
            flywheelObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const flywheelEl = document.querySelector('.flywheel');
if (flywheelEl) {
    flywheelObserver.observe(flywheelEl);
}

// ============================================
// TOKEN CALCULATOR
// ============================================
function initTokenCalculator() {
    const subSlider = document.getElementById('subSlider');
    const priceSlider = document.getElementById('priceSlider');
    const sliderValue = document.getElementById('sliderValue');
    const priceSliderValue = document.getElementById('priceSliderValue');
    const calcTokenShare = document.getElementById('calcTokenShare');
    const calcTokenValue = document.getElementById('calcTokenValue');
    const calc6MonthTokens = document.getElementById('calc6MonthTokens');
    const calc6MonthValue = document.getElementById('calc6MonthValue');

    if (!subSlider) return;

    // Constants based on tokenomics
    const MONTHLY_EMISSION = 83333; // 2,000,000 / 24 months
    const SUBSCRIPTION_COST = 20;   // $20/month

    // Price slider maps 1-100 to $0.0001 - $0.10 (allows up to $1M market cap)
    function getTokenPrice() {
        if (!priceSlider) return 0.00085;
        const val = parseInt(priceSlider.value);
        // Scale: 1 = $0.0001, 100 = $0.10 (logarithmic)
        return 0.0001 * Math.pow(10, (val - 1) * 3 / 99);
    }

    function updateCalculator() {
        const subscribers = parseInt(subSlider.value);
        const tokenPrice = getTokenPrice();

        // Calculate tokens per subscriber
        const tokensPerSub = Math.floor(MONTHLY_EMISSION / subscribers);
        const tokenValue = tokensPerSub * tokenPrice;
        const tokens6Month = tokensPerSub * 6;
        const value6Month = tokens6Month * tokenPrice;

        // Update display
        sliderValue.textContent = subscribers.toLocaleString();
        if (priceSliderValue) {
            priceSliderValue.textContent = `$${tokenPrice.toFixed(5)}`;
        }

        // Update market cap (10M total supply)
        const calcMarketCap = document.getElementById('calcMarketCap');
        if (calcMarketCap) {
            const marketCap = Math.floor(tokenPrice * 10000000);
            calcMarketCap.textContent = `$${marketCap.toLocaleString()}`;
        }

        calcTokenShare.textContent = tokensPerSub.toLocaleString();
        calcTokenValue.textContent = `$${tokenValue.toFixed(2)}`;
        calc6MonthTokens.textContent = tokens6Month.toLocaleString();
        calc6MonthValue.textContent = `$${value6Month.toFixed(2)}`;

        // Update the live stats
        const liveTokensPerSub = document.getElementById('liveTokensPerSub');
        if (liveTokensPerSub) {
            liveTokensPerSub.textContent = tokensPerSub.toLocaleString();
        }

        // Update Pay vs Get comparison
        const payVsGet = document.getElementById('payVsGet');
        const pvgTokenValue = document.getElementById('pvgTokenValue');
        const verdictText = document.getElementById('verdictText');
        const verdictIcon = document.querySelector('.verdict-icon');

        if (pvgTokenValue) {
            pvgTokenValue.textContent = `$${tokenValue.toFixed(2)}`;
        }

        if (payVsGet && verdictText && verdictIcon) {
            payVsGet.classList.remove('profit', 'break-even');

            if (tokenValue >= SUBSCRIPTION_COST) {
                payVsGet.classList.add('profit');
                verdictIcon.textContent = '🚀';
                verdictText.textContent = 'Profit mode! You earn more than you pay!';
            } else if (tokenValue >= SUBSCRIPTION_COST * 0.5) {
                payVsGet.classList.add('break-even');
                verdictIcon.textContent = '📈';
                verdictText.textContent = 'Great value + free apps!';
            } else if (tokenValue >= SUBSCRIPTION_COST * 0.25) {
                verdictIcon.textContent = '✨';
                verdictText.textContent = 'Early adopter bonus!';
            } else {
                verdictIcon.textContent = '🎯';
                verdictText.textContent = '10 apps + token upside';
            }
        }
    }

    function updateSliderGradient(slider) {
        const percent = (slider.value - slider.min) / (slider.max - slider.min) * 100;
        slider.style.background = `linear-gradient(to right, #6366f1 0%, #a855f7 ${percent}%, #1a1a25 ${percent}%)`;
    }

    // Event listeners
    subSlider.addEventListener('input', () => {
        updateCalculator();
        updateSliderGradient(subSlider);
    });

    if (priceSlider) {
        priceSlider.addEventListener('input', () => {
            updateCalculator();
            updateSliderGradient(priceSlider);
        });
        updateSliderGradient(priceSlider);
    }

    // Update revenue flow visualization
    function updateRevenueFlow(subscribers, tokenPrice) {
        const revenue = subscribers * 20;
        const stuartShare = revenue * 0.65;
        const opsShare = revenue * 0.05;
        const buybackShare = revenue * 0.30;
        const tokensPurchased = Math.floor(buybackShare / tokenPrice);
        const tokensPerSub = Math.floor(tokensPurchased / subscribers);
        const totalTokens = 83333 + tokensPurchased;

        // Update DOM elements if they exist
        const elements = {
            flowRevenue: document.getElementById('flowRevenue'),
            flowStuart: document.getElementById('flowStuart'),
            flowOps: document.getElementById('flowOps'),
            flowBuyback: document.getElementById('flowBuyback'),
            flowTokens: document.getElementById('flowTokens'),
            flowPerSub: document.getElementById('flowPerSub'),
            flowBuybackTokens: document.getElementById('flowBuybackTokens'),
            flowTotalTokens: document.getElementById('flowTotalTokens')
        };

        if (elements.flowRevenue) elements.flowRevenue.textContent = `$${revenue.toLocaleString()}`;
        if (elements.flowStuart) elements.flowStuart.textContent = `$${stuartShare.toFixed(0)}`;
        if (elements.flowOps) elements.flowOps.textContent = `$${opsShare.toFixed(0)}`;
        if (elements.flowBuyback) elements.flowBuyback.textContent = `$${buybackShare.toFixed(0)}`;
        if (elements.flowTokens) elements.flowTokens.textContent = tokensPurchased.toLocaleString();
        if (elements.flowPerSub) elements.flowPerSub.textContent = tokensPerSub.toLocaleString();
        if (elements.flowBuybackTokens) elements.flowBuybackTokens.textContent = tokensPurchased.toLocaleString();
        if (elements.flowTotalTokens) elements.flowTotalTokens.textContent = totalTokens.toLocaleString();
    }

    function updateAll() {
        const subscribers = parseInt(subSlider.value);
        const tokenPrice = getTokenPrice();
        updateCalculator();
        updateRevenueFlow(subscribers, tokenPrice);
    }

    // Event listeners
    subSlider.addEventListener('input', () => {
        updateAll();
        updateSliderGradient(subSlider);
    });

    if (priceSlider) {
        priceSlider.addEventListener('input', () => {
            updateAll();
            updateSliderGradient(priceSlider);
        });
        updateSliderGradient(priceSlider);
    }

    // Initialize
    updateAll();
    updateSliderGradient(subSlider);
}

// ============================================
// LIVE STATS SIMULATION (for demo purposes)
// ============================================
function simulateLiveStats() {
    const elements = {
        subCount: document.getElementById('liveSubCount'),
        tokenPrice: document.getElementById('liveTokenPrice'),
        marketCap: document.getElementById('liveMarketCap')
    };

    // Simulate slight price fluctuations every 5 seconds
    setInterval(() => {
        if (elements.tokenPrice) {
            const basePrice = 0.00085;
            const fluctuation = (Math.random() - 0.5) * 0.0001;
            const newPrice = basePrice + fluctuation;
            elements.tokenPrice.textContent = `$${newPrice.toFixed(5)}`;

            // Update market cap based on price
            if (elements.marketCap) {
                const marketCap = Math.floor(newPrice * 10000000);
                elements.marketCap.textContent = `$${marketCap.toLocaleString()}`;
            }
        }
    }, 5000);
}

// Initialize live stats simulation
document.addEventListener('DOMContentLoaded', simulateLiveStats);

// ============================================
// EMISSION TIMELINE
// ============================================
function initEmissionTimeline() {
    const monthButtons = document.getElementById('monthButtons');
    const currentMonthEl = document.getElementById('currentMonth');
    const progressFill = document.getElementById('progressFill');
    const progressPercent = document.getElementById('progressPercent');

    if (!monthButtons) return;

    // Set your launch date here (placeholder - set to future for demo)
    const LAUNCH_DATE = new Date('2026-02-01'); // Change this to actual launch date
    const now = new Date();

    // Calculate months since launch
    let monthsSinceLaunch = 0;
    if (now >= LAUNCH_DATE) {
        const diffTime = now - LAUNCH_DATE;
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        monthsSinceLaunch = Math.floor(diffDays / 30);
    }

    // Clamp to 0-24
    monthsSinceLaunch = Math.max(0, Math.min(24, monthsSinceLaunch));

    // Generate 24 month buttons
    for (let i = 1; i <= 24; i++) {
        const btn = document.createElement('button');
        btn.className = 'month-btn';
        btn.textContent = i;

        if (i <= monthsSinceLaunch) {
            btn.classList.add('past');
            btn.title = `Month ${i} - Emitted`;
        } else if (i === monthsSinceLaunch + 1 && monthsSinceLaunch < 24) {
            btn.classList.add('current');
            btn.title = `Month ${i} - Current`;
        } else {
            btn.classList.add('future');
            btn.title = `Month ${i} - Upcoming`;
        }

        monthButtons.appendChild(btn);
    }

    // Update current month display
    if (currentMonthEl) {
        currentMonthEl.textContent = monthsSinceLaunch;
    }

    // Update progress bar
    const progressPct = (monthsSinceLaunch / 24) * 100;
    if (progressFill) {
        progressFill.style.width = `${progressPct}%`;
    }
    if (progressPercent) {
        const tokensEmitted = monthsSinceLaunch * 83333;
        progressPercent.textContent = `${progressPct.toFixed(1)}% emitted (${tokensEmitted.toLocaleString()} $SUITE)`;
    }
}

// Initialize emission timeline
document.addEventListener('DOMContentLoaded', initEmissionTimeline);

// ============================================
// APP MODAL
// ============================================
const appData = {
    'physio-ai': {
        icon: '🩺',
        title: 'Physiotherapy AI Scanner',
        category: 'Health Suite',
        desc: 'Scan physio reports with AI to get instant summaries, exercise recommendations, and track your recovery progress over time.',
        features: ['AI-powered report scanning', 'Exercise video library', 'Recovery progress tracking'],
        page: 'apps/physio-ai.html'
    },
    'opticrep': {
        icon: '🏋️',
        title: 'OpticRep',
        category: 'Health Suite',
        desc: 'Your AI personal trainer that watches your form in real-time, counts your reps, and helps you avoid injury.',
        features: ['Real-time form analysis', 'Automatic rep counting', 'Workout history & stats'],
        page: 'apps/opticrep.html'
    },
    'foodvital': {
        icon: '🍎',
        title: 'FoodVital',
        category: 'Health Suite',
        desc: 'Point your camera at any food to instantly get nutrition info. Track meals and hit your macro goals.',
        features: ['Instant food scanning', 'Macro & calorie tracking', 'Meal history & trends'],
        page: 'apps/foodvital.html'
    },
    'bible-social': {
        icon: '📖',
        title: 'Bible Social',
        category: 'Life Suite',
        desc: 'A social Bible study app where you can share insights, join reading groups, and grow in faith together.',
        features: ['Daily verse notifications', 'Community discussion', 'Reading plans & streaks'],
        page: 'apps/bible-social.html'
    },
    'dream-journal': {
        icon: '🌙',
        title: 'Dream Journal',
        category: 'Life Suite',
        desc: 'Record your dreams with voice or text. AI analyzes patterns and helps you understand recurring themes.',
        features: ['Voice-to-text recording', 'AI dream analysis', 'Pattern recognition'],
        page: 'apps/dream-journal.html'
    },
    'asmr-objects': {
        icon: '🎧',
        title: 'ASMR Objects',
        category: 'Products',
        desc: 'Create your own ASMR sounds by tapping virtual 3D objects. Perfect for relaxation and sleep.',
        features: ['100+ 3D objects', 'Custom sound creation', 'Sleep timer & playlists'],
        page: 'apps/asmr-objects.html'
    },
    'mini-me': {
        icon: '👤',
        title: '3D Mini-Me',
        category: 'Products',
        desc: 'Create a 3D avatar from a selfie. Use it across games, social apps, and virtual meetings.',
        features: ['AI avatar generation', 'Customization options', 'Export to other apps'],
        page: 'apps/mini-me.html'
    },
    'deal-finder': {
        icon: '💰',
        title: 'Deal Finder',
        category: 'Tools',
        desc: 'Find the best deals in your area. Track prices, get alerts, and never miss a bargain.',
        features: ['Local deal scanning', 'Price drop alerts', 'Watchlist & history'],
        page: 'apps/deal-finder.html'
    },
    'ai-marketing': {
        icon: '📊',
        title: 'AI Marketing Dashboard',
        category: 'Tools',
        desc: 'Your AI marketing assistant that generates content, analyzes competitors, and optimizes campaigns.',
        features: ['AI content generation', 'Competitor tracking', 'Campaign analytics'],
        page: 'apps/ai-marketing.html'
    },
    'defi-hub': {
        icon: '🪙',
        title: 'DeFi Knowledge Hub',
        category: 'Tools',
        desc: 'Learn DeFi from scratch. Interactive tutorials, portfolio tracking, and market insights.',
        features: ['Interactive DeFi courses', 'Portfolio tracker', 'Market analysis'],
        page: 'apps/defi-hub.html'
    }
};

function openAppModal(appId) {
    const app = appData[appId];
    if (!app) return;

    document.getElementById('modalIcon').textContent = app.icon;
    document.getElementById('modalTitle').textContent = app.title;
    document.getElementById('modalCategory').textContent = app.category;
    document.getElementById('modalDesc').textContent = app.desc;
    document.getElementById('modalLearnMore').href = app.page;

    // Set store links (placeholder URLs for now)
    const appleLink = document.getElementById('modalAppleLink');
    const playLink = document.getElementById('modalPlayLink');
    if (appleLink) appleLink.href = app.appleStore || '#';
    if (playLink) playLink.href = app.playStore || '#';

    const featuresList = document.getElementById('modalFeatures');
    featuresList.innerHTML = app.features.map(f => `<li>${f}</li>`).join('');

    document.getElementById('appModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeAppModal() {
    document.getElementById('appModal').classList.remove('active');
    document.body.style.overflow = '';
}

// Close modal on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAppModal();
});

// Initialize app item click handlers
document.addEventListener('DOMContentLoaded', () => {
    const appItems = document.querySelectorAll('.app-item');
    const appIdMap = [
        'physio-ai', 'opticrep', 'foodvital', // Health
        'bible-social', 'dream-journal', // Life
        'asmr-objects', 'mini-me', // Products
        'deal-finder', 'ai-marketing', 'defi-hub' // Tools
    ];

    appItems.forEach((item, index) => {
        if (appIdMap[index]) {
            item.addEventListener('click', () => openAppModal(appIdMap[index]));
        }
    });
});

// ============================================
// CUSTOM SUBSCRIPTION SLIDER
// ============================================
function initCustomSubscription() {
    const slider = document.getElementById('customSubSlider');
    if (!slider) return;

    const priceEl = document.getElementById('customPrice');
    const tierEl = document.getElementById('customTier');
    const tokensEl = document.getElementById('customTokens');
    const valueEl = document.getElementById('customValue');
    const perksEl = document.getElementById('customPerks');
    const subCountEl = document.getElementById('flexSubCount');

    function getTier(amount) {
        if (amount >= 200) return { name: 'Whale 🐋', perks: 'Direct chat + Name in credits' };
        if (amount >= 100) return { name: 'Super Supporter 🔥', perks: 'Priority support + Badge' };
        if (amount >= 50) return { name: 'Supporter 💪', perks: 'Vote on features + Badge' };
        return { name: 'Member ✨', perks: 'Vote on features' };
    }

    function updateCustomSub() {
        const amount = parseInt(slider.value);
        const subCount = subCountEl ? parseInt(subCountEl.value) : 100;
        const tokenPrice = 0.002; // $20K market cap / 10M tokens

        // Monthly emission pool tokens per subscriber
        const emissionTokens = 83333 / subCount;
        // Proportional based on contribution amount
        const multiplier = amount / 20;
        const tokens = Math.round(emissionTokens * multiplier);
        const value = (tokens * tokenPrice).toFixed(2);

        const tier = getTier(amount);

        priceEl.textContent = `$${amount}`;
        tierEl.textContent = tier.name;
        tokensEl.textContent = `~${tokens.toLocaleString()}`;
        valueEl.textContent = `~$${value}`;
        perksEl.textContent = tier.perks;

        // Update slider gradient
        const percent = ((amount - 20) / (500 - 20)) * 100;
        slider.style.background = `linear-gradient(to right, #6366f1 0%, #a855f7 ${percent}%, #1e1e2e ${percent}%)`;
    }

    slider.addEventListener('input', updateCustomSub);
    if (subCountEl) subCountEl.addEventListener('change', updateCustomSub);
    updateCustomSub();
}

document.addEventListener('DOMContentLoaded', initCustomSubscription);

// ============================================
// STAKING REVENUE CALCULATOR (Enhanced with Visible Assumptions)
// ============================================
function initStakingCalculator() {
    const stakeInput = document.getElementById('stakeAmount');
    const subCountSelect = document.getElementById('stakeSubCount');
    const toggleBtns = document.querySelectorAll('.toggle-btn-sm');
    const tierBtns = document.querySelectorAll('.tier-btn-sm');

    // Assumption inputs
    const priceSlider = document.getElementById('tokenPriceSlider');
    const priceDisplay = document.getElementById('tokenPriceDisplay');
    const mcapDisplay = document.getElementById('marketCapDisplay');
    const totalStakedSelect = document.getElementById('totalStakedSelect');

    if (!stakeInput) return;

    // Output elements
    const poolShareEl = document.getElementById('stakePoolShare');
    const monthlyEl = document.getElementById('stakeMonthlyEarn');
    const yearlyEl = document.getElementById('stakeYearlyEarn');
    const stakeUsdValueEl = document.getElementById('stakeUsdValue');

    // Membership tier elements
    const tierLabelEl = document.getElementById('rewardTierLabel');
    const tokenShareEl = document.getElementById('yourTokenShare');
    const tokenValueEl = document.getElementById('yourTokenValue');
    const multiplierEl = document.getElementById('yourMultiplier');
    const totalValueEl = document.getElementById('totalMonthlyValue');

    let payoutType = 'usdc';
    let membershipTier = 100;

    // Constants
    const STAKER_SHARE = 0.15; // 15% of revenue goes to stakers
    const TOTAL_SUPPLY = 10000000; // 10M tokens
    const MONTHLY_EMISSION = 83333; // 2M tokens / 24 months
    const BASE_TIER = 20;

    function getTokenPrice() {
        if (!priceSlider) return 0.002;
        // Slider 1-100 maps to $0.0001 to $0.01 (logarithmic feel)
        const val = parseInt(priceSlider.value);
        return val * 0.0001; // 1 = $0.0001, 100 = $0.01
    }

    function getTotalStaked() {
        if (!totalStakedSelect) return 1000000;
        return parseInt(totalStakedSelect.value);
    }

    function updatePriceDisplay() {
        const price = getTokenPrice();
        const mcap = price * TOTAL_SUPPLY;

        if (priceDisplay) {
            priceDisplay.textContent = price < 0.001
                ? `$${price.toFixed(4)}`
                : `$${price.toFixed(3)}`;
        }
        if (mcapDisplay) {
            mcapDisplay.textContent = mcap >= 1000000
                ? `$${(mcap / 1000000).toFixed(1)}M`
                : `$${Math.round(mcap).toLocaleString()}`;
        }
    }

    function updateCalc() {
        const stake = parseInt(stakeInput.value) || 0;
        const subs = parseInt(subCountSelect?.value) || 100;
        const tokenPrice = getTokenPrice();
        const totalStaked = getTotalStaked();

        // Show stake USD value
        const stakeUsd = stake * tokenPrice;
        if (stakeUsdValueEl) stakeUsdValueEl.textContent = `$${stakeUsd.toFixed(2)}`;

        // Average subscription value
        const avgSubValue = 25;
        const monthlyRevenue = subs * avgSubValue;

        // === MEMBERSHIP TOKEN REWARDS ===
        const totalContribution = subs * avgSubValue;
        const yourContribution = membershipTier;
        const yourShare = yourContribution / totalContribution;

        const yourTokens = Math.round(MONTHLY_EMISSION * yourShare);
        const yourTokensValue = yourTokens * tokenPrice;
        const multiplier = membershipTier / BASE_TIER;

        if (tierLabelEl) tierLabelEl.textContent = `$${membershipTier}/mo member`;
        if (tokenShareEl) tokenShareEl.textContent = yourTokens.toLocaleString();
        if (tokenValueEl) tokenValueEl.textContent = `$${yourTokensValue.toFixed(2)}`;
        if (multiplierEl) multiplierEl.textContent = `${multiplier}x`;

        // === STAKING REVENUE SHARE ===
        const stakerPool = monthlyRevenue * STAKER_SHARE;
        const poolShare = (stake / totalStaked) * 100;
        const monthlyStakeEarn = (stake / totalStaked) * stakerPool;
        const yearlyStakeEarn = monthlyStakeEarn * 12;

        if (poolShareEl) poolShareEl.textContent = poolShare.toFixed(2) + '%';

        if (payoutType === 'usdc') {
            if (monthlyEl) monthlyEl.textContent = `~$${monthlyStakeEarn.toFixed(2)}`;
            if (yearlyEl) yearlyEl.textContent = `~$${yearlyStakeEarn.toFixed(2)}`;
        } else {
            const tokensMonthly = monthlyStakeEarn / tokenPrice;
            const tokensYearly = yearlyStakeEarn / tokenPrice;
            if (monthlyEl) monthlyEl.textContent = `~${Math.round(tokensMonthly).toLocaleString()} $SUITE`;
            if (yearlyEl) yearlyEl.textContent = `~${Math.round(tokensYearly).toLocaleString()} $SUITE`;
        }

        // === TOTAL COMBINED VALUE ===
        const totalMonthly = yourTokensValue + monthlyStakeEarn;
        if (totalValueEl) totalValueEl.textContent = `~$${totalMonthly.toFixed(2)}`;

        updatePriceDisplay();
    }

    // Price slider handler
    if (priceSlider) {
        priceSlider.addEventListener('input', updateCalc);
    }

    // Total staked handler
    if (totalStakedSelect) {
        totalStakedSelect.addEventListener('change', updateCalc);
    }

    // Tier button handlers
    tierBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tierBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            membershipTier = parseInt(btn.dataset.tier);
            updateCalc();
        });
    });

    // Toggle buttons
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            toggleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            payoutType = btn.dataset.payout;
            updateCalc();
        });
    });

    stakeInput.addEventListener('input', updateCalc);
    if (subCountSelect) subCountSelect.addEventListener('change', updateCalc);

    updateCalc();
}

document.addEventListener('DOMContentLoaded', initStakingCalculator);

// ============================================
// FLEXIBLE PRICING SLIDER
// ============================================
function initFlexPricing() {
    const slider = document.getElementById('flexPriceSlider');
    if (!slider) return;

    const amountEl = document.getElementById('flexAmount');
    const unlockBanner = document.getElementById('unlockBanner');
    const unlockIcon = document.getElementById('unlockIcon');
    const unlockText = document.getElementById('unlockText');
    const appsCount = document.getElementById('appsCount');
    const flexTokens = document.getElementById('flexTokens');
    const flexTokenValue = document.getElementById('flexTokenValue');
    const ctaBtn = document.getElementById('flexCtaBtn');

    const appChips = document.querySelectorAll('.app-chip');
    const perks = document.querySelectorAll('.perk');

    const TOKEN_PRICE = 0.002;
    const MONTHLY_EMISSION = 83333;
    const UNLOCK_THRESHOLD = 20;

    function updatePricing() {
        const price = parseInt(slider.value);
        amountEl.textContent = price;

        // Update app unlocks
        let unlocked = 0;
        appChips.forEach(chip => {
            const unlockAt = parseInt(chip.dataset.unlock);
            if (price >= unlockAt) {
                chip.classList.add('unlocked');
                chip.classList.remove('locked');
                unlocked++;
            } else {
                chip.classList.remove('unlocked');
                chip.classList.add('locked');
            }
        });
        appsCount.textContent = unlocked;

        // Update perks
        perks.forEach(perk => {
            const unlockAt = parseInt(perk.dataset.unlock);
            if (price >= unlockAt) {
                perk.classList.add('unlocked');
                perk.classList.remove('locked');
            } else {
                perk.classList.remove('unlocked');
                perk.classList.add('locked');
            }
        });

        // Calculate tokens (proportional to payment, starts at $5)
        let tokens = 0;
        if (price >= 5) {
            // Base tokens at $20 = 833, scales proportionally
            tokens = Math.round((price / 20) * 833);
        }
        flexTokens.textContent = tokens.toLocaleString();

        // SVG icons for lock states
        const lockSvg = '<svg class="lock-svg" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
        const unlockSvg = '<svg class="lock-svg" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';

        // Update unlock banner
        if (price >= UNLOCK_THRESHOLD) {
            unlockBanner.classList.add('unlocked');
            unlockIcon.innerHTML = unlockSvg;
            unlockText.textContent = 'All 10 apps unlocked!';
        } else if (price >= 5) {
            unlockBanner.classList.remove('unlocked');
            unlockIcon.innerHTML = lockSvg;
            unlockText.textContent = `${unlocked}/10 apps · Unlock all at $20/mo`;
        } else if (price >= 1) {
            unlockBanner.classList.remove('unlocked');
            unlockIcon.innerHTML = lockSvg;
            unlockText.textContent = 'Start at $5/mo to unlock apps';
        } else {
            unlockBanner.classList.remove('unlocked');
            unlockIcon.innerHTML = lockSvg;
            unlockText.textContent = 'Free tier: Limited features';
        }

        // Update CTA
        if (price === 0) {
            ctaBtn.textContent = 'Try Free →';
        } else if (price < 20) {
            ctaBtn.textContent = `Subscribe for $${price}/mo →`;
        } else {
            ctaBtn.textContent = `Get Everything for $${price}/mo →`;
        }
    }

    slider.addEventListener('input', updatePricing);
    updatePricing();
}

document.addEventListener('DOMContentLoaded', initFlexPricing);

// ============================================
// SUITE TOKENOMICS SIMULATOR (Flow Diagram)
// ============================================
function initSuiteSimulator() {
    // Flow diagram elements
    const flowDeposit = document.getElementById('flowDeposit');
    const flowWithdraw = document.getElementById('flowWithdraw');
    const flowReset = document.getElementById('flowReset');
    const simUsd = document.getElementById('simUsd');
    const simSuite = document.getElementById('simSuite');
    const flowTreasury = document.getElementById('flowTreasury');
    const flowBacking = document.getElementById('flowBacking');
    const flowYourSuite = document.getElementById('flowYourSuite');
    const depositParticle = document.getElementById('depositParticle');
    const burnParticle = document.getElementById('burnParticle');
    const depositAmountInput = document.getElementById('depositAmount');
    const appBtns = document.querySelectorAll('.app-action-btn');

    if (!flowDeposit) return;

    // State - $1 = 1000 SUITE denomination
    let state = {
        usdBalance: 1000000,
        suiteBalance: 0,
        stakedBalance: 0,
        treasuryValue: 50000,      // $50,000 in treasury
        totalSupply: 50000000,     // 50 million SUITE = $1 = 1000 SUITE
        feeRate: 0.005
    };

    function getBackingRate() {
        if (state.totalSupply === 0) return 1;
        return state.treasuryValue / state.totalSupply;
    }

    function getDepositAmount() {
        const val = parseFloat(depositAmountInput.value) || 100;
        return Math.max(1, val);
    }

    function updateUI() {
        const backingRate = getBackingRate();
        const depositAmount = getDepositAmount();

        // Update displays - use whole numbers for SUITE (no decimals needed now)
        simUsd.textContent = `$${state.usdBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        simSuite.textContent = Math.floor(state.suiteBalance).toLocaleString();
        flowTreasury.textContent = `$${state.treasuryValue.toLocaleString()}`;
        flowBacking.textContent = `$${(backingRate * 1000).toFixed(2)}`; // Show per 1000 SUITE
        flowYourSuite.textContent = `${Math.floor(state.suiteBalance).toLocaleString()} SUITE`;

        // Calculate and display redemption power (how much USD can be extracted)
        const redemptionPower = document.getElementById('redemptionPower');
        if (redemptionPower) {
            const grossValue = state.suiteBalance * backingRate;
            const netValue = grossValue * (1 - state.feeRate); // After 0.5% fee
            redemptionPower.textContent = `$${netValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }

        // Enable/disable buttons based on custom deposit amount
        flowDeposit.disabled = state.usdBalance < depositAmount;
        flowWithdraw.disabled = state.suiteBalance <= 0 && state.stakedBalance <= 0;

        // Enable/disable app buttons
        appBtns.forEach(btn => {
            const cost = parseFloat(btn.dataset.cost);
            btn.disabled = state.suiteBalance < cost;
        });

        // Stake button state
        const stakeBtn = document.getElementById('stakeBtn');
        const stakeBtnText = document.getElementById('stakeBtnText');
        const stakedDisplay = document.getElementById('stakedDisplay');
        const stakedAmount = document.getElementById('stakedAmount');

        if (stakeBtn) {
            if (state.stakedBalance > 0) {
                stakeBtn.classList.add('staked');
                stakeBtnText.textContent = 'Unstake All';
                stakeBtn.disabled = false;
                stakedDisplay.style.display = 'flex';
                stakedAmount.textContent = `${state.stakedBalance.toFixed(2)} SUITE`;
            } else {
                stakeBtn.classList.remove('staked');
                stakeBtnText.textContent = 'Stake SUITE';
                stakeBtn.disabled = state.suiteBalance <= 0;
                stakedDisplay.style.display = 'none';
            }
        }

        // Usage potential blurb - shows when user has SUITE balance
        const usagePotential = document.getElementById('usagePotential');
        const usageExample = document.getElementById('usageExample');
        const totalBalance = state.suiteBalance + state.stakedBalance;

        if (usagePotential && usageExample && totalBalance > 0) {
            usagePotential.style.display = 'block';

            // Calculate potential uses with new SUITE denomination (2, 10, 5 SUITE per use)
            const foodScans = Math.floor(totalBalance / 2);
            const physioScans = Math.floor(totalBalance / 10);
            const bibleReflections = Math.floor(totalBalance / 5);

            // Pick a random example to show
            const examples = [
                `${foodScans.toLocaleString()} food scans`,
                `${physioScans.toLocaleString()} physio analyses`,
                `${bibleReflections.toLocaleString()} AI reflections`
            ];
            const randomExample = examples[Math.floor(Math.random() * examples.length)];
            usageExample.textContent = randomExample;
        } else if (usagePotential) {
            usagePotential.style.display = 'none';
        }

        // Update governance unlock state
        const govLocked = document.getElementById('govLocked');
        const govUnlocked = document.getElementById('govUnlocked');
        const govLockBadge = document.getElementById('govLockBadge');
        const yieldSharePct = document.getElementById('yieldSharePct');
        const govPanel = document.getElementById('governanceSection');

        if (govLocked && govUnlocked && govLockBadge) {
            if (state.stakedBalance > 0) {
                govLocked.style.display = 'none';
                govUnlocked.style.display = 'flex';
                govLockBadge.textContent = '🔓 Unlocked';
                govLockBadge.classList.add('unlocked');
                if (govPanel) govPanel.classList.add('unlocked');

                // Calculate yield share (proportional to staked amount vs total supply)
                const sharePercent = (state.stakedBalance / state.totalSupply) * 100;
                if (yieldSharePct) yieldSharePct.textContent = `${sharePercent.toFixed(2)}%`;
            } else {
                govLocked.style.display = 'block';
                govUnlocked.style.display = 'none';
                govLockBadge.textContent = '🔒 Locked';
                govLockBadge.classList.remove('unlocked');
                if (govPanel) govPanel.classList.remove('unlocked');
            }
        }
    }

    function animateParticle(particle) {
        particle.classList.remove('active');
        void particle.offsetWidth; // Force reflow
        particle.classList.add('active');
    }

    function deposit() {
        const depositAmount = getDepositAmount();
        if (state.usdBalance < depositAmount) return;

        const depositValue = depositAmount;
        const fee = depositValue * state.feeRate;
        const netDeposit = depositValue - fee;
        const backingRate = getBackingRate();
        const suiteReceived = netDeposit / backingRate;

        state.usdBalance -= depositValue;
        state.treasuryValue += netDeposit;
        state.totalSupply += suiteReceived;
        state.suiteBalance += suiteReceived;

        animateParticle(depositParticle);
        updateUI();
    }

    function withdraw() {
        if (state.suiteBalance <= 0) return;

        const suiteToRedeem = state.suiteBalance + state.stakedBalance;
        if (suiteToRedeem <= 0) return;

        const backingRate = getBackingRate();
        const grossValue = suiteToRedeem * backingRate;
        const fee = grossValue * state.feeRate;
        const netValue = grossValue - fee;

        state.suiteBalance = 0;
        state.stakedBalance = 0;
        state.treasuryValue -= grossValue;
        state.totalSupply -= suiteToRedeem;
        state.usdBalance += netValue;

        updateUI();
    }

    function useApp(cost) {
        if (state.suiteBalance < cost) return;

        state.suiteBalance -= cost;
        state.totalSupply -= cost;

        animateParticle(burnParticle);
        updateUI();
    }

    function toggleStake() {
        if (state.stakedBalance > 0) {
            // Unstake all
            state.suiteBalance += state.stakedBalance;
            state.stakedBalance = 0;
        } else if (state.suiteBalance > 0) {
            // Stake all
            state.stakedBalance = state.suiteBalance;
            state.suiteBalance = 0;
        }
        updateUI();
    }

    function reset() {
        state = {
            usdBalance: 1000000,
            suiteBalance: 0,
            stakedBalance: 0,
            treasuryValue: 50000,
            totalSupply: 50000,
            feeRate: 0.005
        };
        state.day = 0;
        depositAmountInput.value = 100;
        updateUI();
    }

    // Time simulation
    let simInterval = null;
    const dailyYieldRate = 0.18 / 365; // 18% APY divided by 365 days
    const charityRate = 0.15; // 15% of yields go to charity

    function advanceDay() {
        state.day++;

        // Calculate daily yield on treasury
        const dailyYield = state.treasuryValue * dailyYieldRate;
        const toCharity = dailyYield * charityRate;
        const toTreasury = dailyYield - toCharity;

        // Add yield to treasury (net of charity allocation)
        state.treasuryValue += toTreasury;

        // Animate treasury pulse
        const treasuryNode = document.querySelector('.flow-node.primary');
        if (treasuryNode) {
            treasuryNode.classList.remove('yielding');
            void treasuryNode.offsetWidth; // Force reflow
            treasuryNode.classList.add('yielding');
            setTimeout(() => treasuryNode.classList.remove('yielding'), 500);
        }

        updateUI();
    }

    function togglePlay() {
        const playIcon = document.getElementById('playIcon');
        const pauseIcon = document.getElementById('pauseIcon');
        const playBtn = document.getElementById('simPlayPause');

        if (simInterval) {
            // Stop
            clearInterval(simInterval);
            simInterval = null;
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
            playBtn.classList.remove('playing');
        } else {
            // Start - advance a day every 500ms
            simInterval = setInterval(advanceDay, 500);
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
            playBtn.classList.add('playing');
        }
    }

    // Event listeners
    flowDeposit.addEventListener('click', deposit);
    flowWithdraw.addEventListener('click', withdraw);
    flowReset.addEventListener('click', () => {
        if (simInterval) togglePlay(); // Stop simulation
        reset();
    });

    const simPlayPause = document.getElementById('simPlayPause');
    const simNextDay = document.getElementById('simNextDay');
    const simNextMonth = document.getElementById('simNextMonth');
    const stakeBtn = document.getElementById('stakeBtn');
    if (simPlayPause) simPlayPause.addEventListener('click', togglePlay);
    if (simNextDay) simNextDay.addEventListener('click', advanceDay);
    if (simNextMonth) simNextMonth.addEventListener('click', () => {
        for (let i = 0; i < 30; i++) advanceDay();
    });
    if (stakeBtn) stakeBtn.addEventListener('click', toggleStake);

    appBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const cost = parseFloat(btn.dataset.cost);
            useApp(cost);
        });
    });

    // Update day display in updateUI
    const originalUpdateUI = updateUI;
    updateUI = function () {
        originalUpdateUI();
        const dayDisplay = document.getElementById('simDay');
        if (dayDisplay) dayDisplay.textContent = state.day || 0;
    };

    state.day = 0;
    updateUI();
}

document.addEventListener('DOMContentLoaded', initSuiteSimulator);
