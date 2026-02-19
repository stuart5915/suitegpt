// Inclawbate — Instagram Content Studio
// Personal morning dashboard for IG content creation
// No auth, no AI API calls — pure client-side templates + live data

(function () {
    'use strict';

    const API_BASE = '/api/inclawbate';
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // ── Content Pillars ──
    const PILLARS = [
        { name: 'Big Picture', emoji: '\u{1F30D}', sub: 'Sun: Where Inclawbate is heading' },
        { name: 'Building in Public', emoji: '\u{1F6E0}\uFE0F', sub: 'Mon: Here\'s what we shipped' },
        { name: 'Education', emoji: '\u{1F4DA}', sub: 'Tue: What is agent staking?' },
        { name: 'Token Update', emoji: '\u{1F4CA}', sub: 'Wed: Price, stakers, milestones' },
        { name: 'Meme Day', emoji: '\u{1F92A}', sub: 'Thu: Crypto humor' },
        { name: 'Ecosystem Spotlight', emoji: '\u{2728}', sub: 'Fri: Feature a skill or agent' },
        { name: 'Behind the Scenes', emoji: '\u{1F3AC}', sub: 'Sat: Process, real talk' }
    ];

    // ── Caption Templates per Pillar ──
    // {price}, {change}, {stakers}, {humans}, {apy}, {pool}, {topSkill}, {tvl}
    const TEMPLATES = {
        0: [ // Sunday — Big Picture
            { type: 'Single Image', caption: 'Inclawbate isn\'t just a platform.\n\nIt\'s a bet that humans + AI agents can build something bigger together.\n\n{stakers} stakers. {humans} humans. One mission.\n\nThe incubation is just getting started.', tags: ['#Inclawbate', '#Web3', '#AI', '#BuildInPublic', '#CryptoVision'] },
            { type: 'Carousel', caption: 'Where is Inclawbate heading? Here\'s the roadmap:\n\n1. Human-agent collaboration at scale\n2. On-chain rewards for real contributions\n3. A skills economy where anyone can earn\n\nINCLAWNCH at ${price} — still early.', tags: ['#Inclawbate', '#Roadmap', '#INCLAWNCH', '#Base', '#Crypto'] },
            { type: 'Single Image', caption: 'Sunday thought:\n\nWhat if getting incubated by AI wasn\'t dystopian... but actually paid you?\n\n{humans} humans are already finding out.', tags: ['#Inclawbate', '#AI', '#FutureOfWork', '#CryptoTwitter'] },
            { type: 'Reel', caption: 'POV: You\'re watching the future of work get built in real time.\n\n{stakers} people staking. {humans} humans onboarded. ${price} per INCLAWNCH.\n\nThis is Inclawbate.', tags: ['#Inclawbate', '#POV', '#Web3', '#AI', '#CryptoReels'] }
        ],
        1: [ // Monday — Building in Public
            { type: 'Carousel', caption: 'Monday build log:\n\nHere\'s what we shipped this week and what\'s next.\n\n{stakers} stakers holding strong at ${price}.\n{humans} humans building skills.\n\nLet\'s go.', tags: ['#BuildInPublic', '#Inclawbate', '#Crypto', '#AI', '#ShippingCode'] },
            { type: 'Single Image', caption: 'Another week, another deploy.\n\nBuilding Inclawbate in public because transparency isn\'t optional in crypto.\n\n{stakers} stakers | ${tvl} TVL | {apy}% APY', tags: ['#BuildInPublic', '#Inclawbate', '#INCLAWNCH', '#Base'] },
            { type: 'Carousel', caption: 'What we built last week:\n\nSlide 1: New feature overview\nSlide 2: Stats ({humans} humans, {stakers} stakers)\nSlide 3: What\'s next\n\nFollow along as we build the human-AI economy.', tags: ['#BuildInPublic', '#Inclawbate', '#StartupLife', '#Web3'] },
            { type: 'Single Image', caption: 'Monday status:\n\nINCLAWNCH: ${price} ({change}%)\nStakers: {stakers}\nHumans: {humans}\nReward Pool: {pool} INCLAWNCH\n\nWe keep building.', tags: ['#BuildInPublic', '#Inclawbate', '#INCLAWNCH', '#CryptoStartup'] },
            { type: 'Reel', caption: 'When people ask what I\'m building:\n\nA platform where AI agents incubate humans.\nYes, really.\n\n{humans} humans and counting.', tags: ['#BuildInPublic', '#Inclawbate', '#AI', '#Founder', '#CryptoReels'] }
        ],
        2: [ // Tuesday — Education
            { type: 'Carousel', caption: 'What is agent staking?\n\nSlide 1: You stake INCLAWNCH tokens\nSlide 2: Agents use those stakes to do work\nSlide 3: You earn {apy}% APY from rewards\n\nCurrently {stakers} stakers earning from a {pool} INCLAWNCH pool.', tags: ['#Inclawbate', '#Staking', '#DeFi', '#CryptoEducation', '#Web3'] },
            { type: 'Carousel', caption: 'How does Inclawbate work? A thread in slides:\n\n1. Sign up with your X account\n2. Add your skills\n3. AI agents match you with work\n4. Get paid in INCLAWNCH\n\n{humans} humans already in.', tags: ['#Inclawbate', '#HowItWorks', '#AI', '#Crypto', '#Education'] },
            { type: 'Single Image', caption: 'Quick explainer:\n\nINCLAWNCH is the token that powers Inclawbate.\n\nPrice: ${price}\n24h: {change}%\nStakers: {stakers}\nAPY: {apy}%\n\nStake it. Earn it. Build with it.', tags: ['#INCLAWNCH', '#TokenExplainer', '#Base', '#DeFi', '#Inclawbate'] },
            { type: 'Carousel', caption: 'Top skills on Inclawbate right now:\n\n{topSkill}\n\n{humans} humans. Growing every day.\n\nWhat skill would you bring?', tags: ['#Inclawbate', '#Skills', '#FutureOfWork', '#AI', '#Web3'] },
            { type: 'Single Image', caption: 'Did you know?\n\nInclawbate humans earn INCLAWNCH just for being skilled.\n\nNo mining. No farming. Just being useful.\n\n{humans} humans are already earning.', tags: ['#Inclawbate', '#DidYouKnow', '#Crypto', '#AI', '#EarnCrypto'] }
        ],
        3: [ // Wednesday — Token / Data Update
            { type: 'Single Image', caption: 'INCLAWNCH Wednesday Update:\n\nPrice: ${price}\n24h: {change}%\nStakers: {stakers}\nTVL: ${tvl}\nAPY: {apy}%\nReward Pool: {pool} INCLAWNCH\n\nThe numbers speak.', tags: ['#INCLAWNCH', '#TokenUpdate', '#Base', '#Crypto', '#DeFi'] },
            { type: 'Carousel', caption: 'Weekly INCLAWNCH report:\n\nSlide 1: Price ${price} ({change}%)\nSlide 2: {stakers} stakers, ${tvl} TVL\nSlide 3: {humans} humans, {apy}% APY\n\nData doesn\'t lie.', tags: ['#INCLAWNCH', '#WeeklyReport', '#Crypto', '#Base', '#Inclawbate'] },
            { type: 'Single Image', caption: '${price}\n\nThat\'s INCLAWNCH right now.\n\n{stakers} stakers. {apy}% APY. {humans} humans.\n\nStill early. Still building.', tags: ['#INCLAWNCH', '#Price', '#Crypto', '#Base', '#Staking'] },
            { type: 'Single Image', caption: 'Midweek check:\n\n{stakers} wallets staking INCLAWNCH\n{humans} humans onboarded\n{apy}% estimated APY\n${tvl} total value locked\n\nWe\'re just getting started.', tags: ['#INCLAWNCH', '#MidweekUpdate', '#DeFi', '#Base', '#Inclawbate'] },
            { type: 'Reel', caption: 'INCLAWNCH by the numbers:\n\n${price} per token\n{change}% in 24h\n{stakers} stakers\n{apy}% APY\n\nThe lobster economy is real.', tags: ['#INCLAWNCH', '#Crypto', '#Base', '#DeFi', '#CryptoReels'] }
        ],
        4: [ // Thursday — Meme / Relatable
            { type: 'Single Image', caption: 'Me explaining to my friends that a lobster AI is paying people:\n\n"So there\'s this platform called Inclawbate..."\n\n{humans} humans get it. Do you?', tags: ['#Inclawbate', '#CryptoMeme', '#Meme', '#Web3Humor', '#AI'] },
            { type: 'Reel', caption: 'Normal people: "What do you do for work?"\n\nMe: "I get incubated by AI lobsters for INCLAWNCH tokens at ${price} each"\n\nNormal people: ...', tags: ['#Inclawbate', '#CryptoHumor', '#Meme', '#Web3Life', '#AI'] },
            { type: 'Single Image', caption: 'When INCLAWNCH moves {change}% and you\'re already staking:\n\n{stakers} of us understand this feeling.', tags: ['#INCLAWNCH', '#CryptoMeme', '#Staking', '#Relatable', '#Crypto'] },
            { type: 'Single Image', caption: 'Explaining my portfolio:\n\n"Yeah I\'m heavily invested in a human incubation platform run by AI agents on Base"\n\nThe future is weird and I\'m here for it.', tags: ['#Inclawbate', '#CryptoMeme', '#Portfolio', '#Web3', '#Base'] },
            { type: 'Reel', caption: 'Tag someone who needs to get incubated.\n\nNo seriously, {humans} humans are already earning.\n\nINCLAWNCH at ${price}. Don\'t sleep on the lobsters.', tags: ['#Inclawbate', '#TagAFriend', '#Crypto', '#AI', '#CryptoReels'] }
        ],
        5: [ // Friday — Ecosystem Spotlight
            { type: 'Carousel', caption: 'Ecosystem spotlight:\n\nTop skills on Inclawbate this week:\n\n{topSkill}\n\n{humans} humans. {stakers} stakers.\n\nWhat skill would you list?', tags: ['#Inclawbate', '#Ecosystem', '#Skills', '#Web3', '#AI'] },
            { type: 'Single Image', caption: 'Friday spotlight:\n\nDid you know Inclawbate has {humans} humans with verified skills?\n\nFrom coding to design to marketing — real humans, real skills, real pay.\n\nINCLAWNCH rewards everything.', tags: ['#Inclawbate', '#Spotlight', '#FutureOfWork', '#Crypto', '#Skills'] },
            { type: 'Carousel', caption: 'Building on Base with Inclawbate:\n\nSlide 1: What is Inclawbate?\nSlide 2: The skills economy\nSlide 3: INCLAWNCH at ${price}\nSlide 4: Join {humans} humans\n\nThe Base ecosystem keeps growing.', tags: ['#Base', '#Inclawbate', '#Ecosystem', '#BuildOnBase', '#Crypto'] },
            { type: 'Single Image', caption: 'Every Friday we spotlight what\'s growing in the Inclawbate ecosystem.\n\nThis week: {stakers} stakers earning {apy}% APY.\n\nThe lobster economy rewards builders.', tags: ['#Inclawbate', '#FridaySpotlight', '#DeFi', '#Staking', '#Base'] }
        ],
        6: [ // Saturday — Behind the Scenes
            { type: 'Single Image', caption: 'Saturday real talk:\n\nBuilding Inclawbate isn\'t glamorous. It\'s late nights, debugging, and figuring out how to make AI agents actually useful for humans.\n\nBut {humans} humans are counting on us. So we keep going.', tags: ['#Inclawbate', '#BehindTheScenes', '#StartupLife', '#BuildInPublic', '#RealTalk'] },
            { type: 'Carousel', caption: 'Behind the scenes at Inclawbate:\n\nSlide 1: What a typical build day looks like\nSlide 2: The stack (Vercel, Supabase, Base)\nSlide 3: Why we chose INCLAWNCH on Base\nSlide 4: What\'s next\n\n${price} and climbing.', tags: ['#BehindTheScenes', '#Inclawbate', '#TechStack', '#BuildInPublic', '#Crypto'] },
            { type: 'Single Image', caption: 'Honest update:\n\nThings that are going well:\n- {humans} humans onboarded\n- {stakers} active stakers\n- {apy}% APY live\n\nThings that are hard:\n- Everything else\n\nWe keep shipping.', tags: ['#Inclawbate', '#HonestUpdate', '#StartupLife', '#Crypto', '#BuildInPublic'] },
            { type: 'Reel', caption: 'A day in the life of building a crypto AI platform:\n\n6am: Check INCLAWNCH price (${price})\n8am: Review staker count ({stakers})\n10am: Ship code\n12pm: Community stuff\n6pm: Do it again tomorrow\n\nThis is the way.', tags: ['#Inclawbate', '#DayInTheLife', '#Founder', '#CryptoLife', '#BuildInPublic'] }
        ]
    };

    // ── Engagement Accounts ──
    const IG_ACCOUNTS = [
        { handle: '@coinaboretum', cat: 'crypto' },
        { handle: '@cryptobanter', cat: 'crypto' },
        { handle: '@taboretum_nft', cat: 'crypto' },
        { handle: '@defidad', cat: 'crypto' },
        { handle: '@ai.explained', cat: 'ai' },
        { handle: '@artificialintelligence.hub', cat: 'ai' },
        { handle: '@theaiexplorer', cat: 'ai' },
        { handle: '@buildinpublic_', cat: 'builder' },
        { handle: '@indiehackers', cat: 'builder' },
        { handle: '@startup.daily', cat: 'builder' }
    ];

    // ── Hashtag Sets ──
    const HASHTAG_SETS = [
        { label: 'Core Brand', tags: '#Inclawbate #INCLAWNCH #HumanIncubation #AI #Web3 #Base #BuildInPublic #Crypto #FutureOfWork #AgentEconomy' },
        { label: 'DeFi / Token', tags: '#DeFi #Staking #CryptoStaking #TokenEconomy #BaseChain #OnBase #CryptoYield #PassiveIncome #StakeAndEarn #APY' },
        { label: 'AI / Tech', tags: '#ArtificialIntelligence #AIAgents #MachineLearning #TechStartup #AIEconomy #AutomatedFuture #HumanAI #SmartAgents #TechInnovation #AIxCrypto' },
        { label: 'Growth / Community', tags: '#CryptoTwitter #Web3Community #BuildersGonnaShip #StartupLife #CryptoCommunity #EarlyAdopters #JoinTheMovement #CryptoDaily #IndieHacker #ShipIt' }
    ];

    // ── State ──
    let liveData = { price: 0, change: 0, stakers: 0, humans: 0, apy: 0, pool: 0, tvl: 0, topSkill: '' };
    let cardSeeds = [0, 0, 0]; // track per-card refresh offsets

    // ── Date-seeded RNG ──
    function seededRandom(seed) {
        let x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    function todayKey() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function todaySeed() {
        const k = todayKey();
        let h = 0;
        for (let i = 0; i < k.length; i++) {
            h = ((h << 5) - h) + k.charCodeAt(i);
            h |= 0;
        }
        return Math.abs(h);
    }

    // ── Pick N unique items from array using seed ──
    function pickN(arr, n, seed) {
        const shuffled = arr.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(seededRandom(seed + i) * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled.slice(0, Math.min(n, shuffled.length));
    }

    // ── Init ──
    function init() {
        renderHeader();
        renderEngagement();
        loadChecklist();
        fetchAllData();

        // Auto-refresh ticker every 60s
        setInterval(fetchAllData, 60000);
    }

    function renderHeader() {
        const now = new Date();
        const dow = now.getDay();

        document.getElementById('studioDate').textContent = MONTHS[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear();
        document.getElementById('studioDay').textContent = DAYS[dow];

        const pillar = PILLARS[dow];
        document.getElementById('pillarEmoji').textContent = pillar.emoji;
        document.getElementById('pillarName').textContent = pillar.name;
        document.getElementById('pillarSub').textContent = pillar.sub;
    }

    // ── Fetch Data ──
    async function fetchAllData() {
        try {
            const [analyticsRes, statsRes, rewardsRes] = await Promise.all([
                fetch(API_BASE + '/analytics').then(r => r.json()).catch(() => null),
                fetch(API_BASE + '/stats').then(r => r.json()).catch(() => null),
                fetch(API_BASE + '/rewards').then(r => r.json()).catch(() => null)
            ]);

            if (analyticsRes) {
                liveData.price = analyticsRes.token?.price_usd || 0;
                liveData.change = analyticsRes.token?.price_change_24h || 0;
                liveData.stakers = analyticsRes.staking?.total_stakers || 0;
                liveData.apy = analyticsRes.staking?.estimated_apy || 0;
                liveData.tvl = analyticsRes.staking?.tvl_usd || 0;
                liveData.humans = analyticsRes.platform?.total_humans || 0;

                const topSkills = analyticsRes.platform?.top_skills || [];
                liveData.topSkill = topSkills.slice(0, 5).map(s => s.skill).join(', ') || 'Various';
            }

            if (statsRes) {
                if (statsRes.total_humans) liveData.humans = statsRes.total_humans;
                if (statsRes.top_skills?.length) {
                    liveData.topSkill = statsRes.top_skills.slice(0, 5).map(s => s.skill).join(', ');
                }
            }

            if (rewardsRes) {
                liveData.pool = rewardsRes.current_pool || 0;
            }

            renderTicker();
            renderIdeas();
        } catch (e) {
            console.error('Studio fetch error:', e);
        }
    }

    // ── Render Ticker ──
    function renderTicker() {
        const fmt = (n, decimals) => {
            if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
            if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
            return '$' + Number(n).toFixed(decimals);
        };

        document.getElementById('tickPrice').textContent = fmt(liveData.price, 6);

        const changeEl = document.getElementById('tickChange');
        const changeVal = Number(liveData.change);
        changeEl.textContent = (changeVal >= 0 ? '+' : '') + changeVal.toFixed(1) + '%';
        changeEl.className = 'tick-value ' + (changeVal >= 0 ? 'positive' : 'negative');

        document.getElementById('tickStakers').textContent = liveData.stakers.toLocaleString();
        document.getElementById('tickHumans').textContent = liveData.humans.toLocaleString();
        document.getElementById('tickApy').textContent = liveData.apy.toFixed(1) + '%';

        const pool = liveData.pool;
        document.getElementById('tickPool').textContent = pool >= 1000000
            ? (pool / 1000000).toFixed(1) + 'M'
            : pool >= 1000 ? (pool / 1000).toFixed(0) + 'K'
            : pool.toLocaleString();
    }

    // ── Render Post Ideas ──
    function renderIdeas() {
        const dow = new Date().getDay();
        const templates = TEMPLATES[dow] || TEMPLATES[0];
        const seed = todaySeed();
        const picks = pickN(templates, 3, seed);

        const container = document.getElementById('ideaCards');
        container.innerHTML = '';

        picks.forEach((tpl, i) => {
            // Apply per-card refresh offset
            let finalTpl = tpl;
            if (cardSeeds[i] > 0) {
                const altPicks = pickN(templates, templates.length, seed + cardSeeds[i]);
                finalTpl = altPicks[i % altPicks.length] || tpl;
            }

            const card = buildIdeaCard(finalTpl, i);
            container.appendChild(card);
        });
    }

    function injectData(text) {
        return text
            .replace(/\{price\}/g, liveData.price.toFixed(6))
            .replace(/\{change\}/g, (liveData.change >= 0 ? '+' : '') + Number(liveData.change).toFixed(1))
            .replace(/\{stakers\}/g, liveData.stakers.toLocaleString())
            .replace(/\{humans\}/g, liveData.humans.toLocaleString())
            .replace(/\{apy\}/g, liveData.apy.toFixed(1))
            .replace(/\{pool\}/g, liveData.pool >= 1000000
                ? (liveData.pool / 1000000).toFixed(1) + 'M'
                : liveData.pool >= 1000 ? Math.round(liveData.pool / 1000) + 'K'
                : liveData.pool.toLocaleString())
            .replace(/\{tvl\}/g, liveData.tvl >= 1000
                ? (liveData.tvl / 1000).toFixed(1) + 'K'
                : liveData.tvl.toFixed(0))
            .replace(/\{topSkill\}/g, liveData.topSkill);
    }

    function buildIdeaCard(tpl, index) {
        const card = document.createElement('div');
        card.className = 'idea-card';

        const typeClass = tpl.type.toLowerCase().includes('carousel') ? 'carousel'
            : tpl.type.toLowerCase().includes('reel') ? 'reel' : '';

        const caption = injectData(tpl.caption);
        const tagsHtml = tpl.tags.map(t => '<span class="hashtag-chip">' + t + '</span>').join('');

        card.innerHTML =
            '<div class="idea-top">' +
                '<span class="idea-type ' + typeClass + '">' + tpl.type + '</span>' +
                '<button class="idea-refresh" data-index="' + index + '" title="Refresh this idea">\u21BB</button>' +
            '</div>' +
            '<div class="idea-caption">' + escapeHtml(caption) + '</div>' +
            '<div class="idea-hashtags">' + tagsHtml + '</div>' +
            '<button class="idea-copy" data-index="' + index + '">Copy Caption</button>';

        // Refresh handler
        card.querySelector('.idea-refresh').addEventListener('click', function () {
            cardSeeds[index] = (cardSeeds[index] || 0) + 1;
            renderIdeas();
        });

        // Copy handler
        card.querySelector('.idea-copy').addEventListener('click', function () {
            const fullText = caption + '\n\n' + tpl.tags.join(' ');
            navigator.clipboard.writeText(fullText).then(() => {
                this.textContent = 'Copied!';
                this.classList.add('copied');
                setTimeout(() => {
                    this.textContent = 'Copy Caption';
                    this.classList.remove('copied');
                }, 2000);
            });
        });

        return card;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ── Render Engagement ──
    function renderEngagement() {
        const accountsEl = document.getElementById('engageAccounts');

        IG_ACCOUNTS.forEach(acc => {
            const row = document.createElement('div');
            row.className = 'ig-account';
            row.innerHTML =
                '<span class="ig-cat ' + acc.cat + '">' + acc.cat + '</span>' +
                '<span class="ig-handle"><a href="https://instagram.com/' + acc.handle.slice(1) + '" target="_blank" rel="noopener">' + acc.handle + '</a></span>';
            accountsEl.appendChild(row);
        });

        const hashtagsEl = document.getElementById('engageHashtags');

        HASHTAG_SETS.forEach((set, i) => {
            const block = document.createElement('div');
            block.className = 'hashtag-set';
            block.innerHTML =
                '<div class="hashtag-set-label">' + set.label + '</div>' +
                '<div class="hashtag-set-tags">' + set.tags + '</div>' +
                '<button class="copy-all-btn" data-set="' + i + '">Copy All</button>';

            block.querySelector('.copy-all-btn').addEventListener('click', function () {
                navigator.clipboard.writeText(set.tags).then(() => {
                    this.textContent = 'Copied!';
                    this.classList.add('copied');
                    setTimeout(() => {
                        this.textContent = 'Copy All';
                        this.classList.remove('copied');
                    }, 2000);
                });
            });

            hashtagsEl.appendChild(block);
        });
    }

    // ── Checklist ──
    const CHECKLIST_IDS = ['chk-posted', 'chk-engaged', 'chk-dms', 'chk-stories', 'chk-shared'];

    function loadChecklist() {
        const stored = localStorage.getItem('studio_checklist');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                // Reset if from a different day
                if (data.date !== todayKey()) {
                    localStorage.removeItem('studio_checklist');
                    return;
                }
                CHECKLIST_IDS.forEach(id => {
                    const el = document.getElementById(id);
                    if (el && data.checks[id]) el.checked = true;
                });
                updateChecklistUI();
            } catch (e) { /* ignore corrupt data */ }
        }
    }

    function saveChecklist() {
        const checks = {};
        CHECKLIST_IDS.forEach(id => {
            checks[id] = document.getElementById(id)?.checked || false;
        });
        localStorage.setItem('studio_checklist', JSON.stringify({
            date: todayKey(),
            checks: checks
        }));
    }

    function updateChecklist() {
        saveChecklist();
        updateChecklistUI();
    }

    function updateChecklistUI() {
        const total = CHECKLIST_IDS.length;
        const done = CHECKLIST_IDS.filter(id => document.getElementById(id)?.checked).length;

        const progressEl = document.getElementById('checkProgress');
        progressEl.innerHTML = '<span class="done">' + done + '</span> / ' + total;

        const banner = document.getElementById('allDone');
        if (done === total) {
            banner.classList.add('show');
        } else {
            banner.classList.remove('show');
        }
    }

    // ── Expose for inline handlers ──
    window.StudioApp = { updateChecklist: updateChecklist };

    // ── Boot ──
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
