// Inclawbate — Content Studio
// Morning dashboard for IG + X content creation
// No auth, no AI API calls — pure client-side templates + live data

(function () {
    'use strict';

    var API_BASE = '/api/inclawbate';
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // ── Content Pillars ──
    var PILLARS = [
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
    // Reel entries include videoPrompt — paste into Grok to generate the 10s clip
    var TEMPLATES = {
        0: [ // Sunday — Big Picture
            { type: 'Single Image', caption: 'Inclawbate isn\'t just a platform.\n\nIt\'s a bet that humans + AI agents can build something bigger together.\n\n{stakers} stakers. {humans} humans. One mission.\n\nThe incubation is just getting started.', tags: ['#Inclawbate', '#Web3', '#AI', '#BuildInPublic', '#CryptoVision'] },
            { type: 'Carousel', caption: 'Where is Inclawbate heading? Here\'s the roadmap:\n\n1. Human-agent collaboration at scale\n2. On-chain rewards for real contributions\n3. A skills economy where anyone can earn\n\nINCLAWNCH at ${price} \u2014 still early.', tags: ['#Inclawbate', '#Roadmap', '#INCLAWNCH', '#Base', '#Crypto'] },
            { type: 'Single Image', caption: 'Sunday thought:\n\nWhat if getting incubated by AI wasn\'t dystopian... but actually paid you?\n\n{humans} humans are already finding out.', tags: ['#Inclawbate', '#AI', '#FutureOfWork', '#CryptoTwitter'] },
            { type: 'Reel', caption: 'POV: You\'re watching the future of work get built in real time.\n\n{stakers} people staking. {humans} humans onboarded. ${price} per INCLAWNCH.\n\nThis is Inclawbate.', tags: ['#Inclawbate', '#POV', '#Web3', '#AI', '#CryptoReels'],
              videoPrompt: 'A tiny glowing seed planted in dark cracked digital soil. It erupts upward in fast-motion into an enormous tree made of circuit boards, golden wires, and pulsing light. Tiny humanoid silhouettes and small robotic lobster creatures climb its branches together. Camera slowly pulls back to reveal the tree is growing on a floating island drifting through deep space. Warm golden light mixed with cool blue tech glow. Epic, awe-inspiring, cinematic wide shot. 10 seconds.' },
            { type: 'Reel', caption: 'The future isn\'t humans vs AI.\n\nIt\'s humans WITH AI.\n\n{stakers} stakers already figured this out.', tags: ['#Inclawbate', '#AI', '#FutureOfWork', '#Crypto', '#CryptoReels'],
              videoPrompt: 'A human hand and a sleek robotic claw reach toward each other across a dark void, fingertips almost touching \u2014 Michelangelo Creation of Adam style. The moment they connect, a massive shockwave of golden particles explodes outward, forming constellations and network graphs that fill the entire frame. Stars and data points swirl together. Dramatic slow motion, shallow depth of field, hyper-cinematic. 10 seconds.' }
        ],
        1: [ // Monday — Building in Public
            { type: 'Carousel', caption: 'Monday build log:\n\nHere\'s what we shipped this week and what\'s next.\n\n{stakers} stakers holding strong at ${price}.\n{humans} humans building skills.\n\nLet\'s go.', tags: ['#BuildInPublic', '#Inclawbate', '#Crypto', '#AI', '#ShippingCode'] },
            { type: 'Single Image', caption: 'Another week, another deploy.\n\nBuilding Inclawbate in public because transparency isn\'t optional in crypto.\n\n{stakers} stakers | ${tvl} TVL | {apy}% APY', tags: ['#BuildInPublic', '#Inclawbate', '#INCLAWNCH', '#Base'] },
            { type: 'Carousel', caption: 'What we built last week:\n\nSlide 1: New feature overview\nSlide 2: Stats ({humans} humans, {stakers} stakers)\nSlide 3: What\'s next\n\nFollow along as we build the human-AI economy.', tags: ['#BuildInPublic', '#Inclawbate', '#StartupLife', '#Web3'] },
            { type: 'Single Image', caption: 'Monday status:\n\nINCLAWNCH: ${price} ({change}%)\nStakers: {stakers}\nHumans: {humans}\nReward Pool: {pool} INCLAWNCH\n\nWe keep building.', tags: ['#BuildInPublic', '#Inclawbate', '#INCLAWNCH', '#CryptoStartup'] },
            { type: 'Reel', caption: 'When people ask what I\'m building:\n\nA platform where AI agents and humans earn together.\nYes, really.\n\n{humans} humans and counting.', tags: ['#BuildInPublic', '#Inclawbate', '#AI', '#Founder', '#CryptoReels'],
              videoPrompt: 'Extreme close-up of hands typing furiously on a mechanical keyboard in a dark room. Lines of glowing green and purple code fly off the screen and materialize as 3D holographic building blocks assembling themselves into a futuristic city in mid-air. A translucent red lobster ghost appears and starts rearranging the code blocks like Tetris pieces, faster and faster. Camera pulls back to show the entire room surrounded by floating holographic architecture. Intense, fast-paced, cyberpunk neon lighting. 10 seconds.' }
        ],
        2: [ // Tuesday — Education
            { type: 'Carousel', caption: 'What is agent staking?\n\nSlide 1: You stake INCLAWNCH tokens\nSlide 2: Agents use those stakes to do work\nSlide 3: You earn {apy}% APY from rewards\n\nCurrently {stakers} stakers earning from a {pool} INCLAWNCH pool.', tags: ['#Inclawbate', '#Staking', '#DeFi', '#CryptoEducation', '#Web3'] },
            { type: 'Carousel', caption: 'How does Inclawbate work? A thread in slides:\n\n1. Sign up with your X account\n2. Add your skills\n3. AI agents match you with work\n4. Get paid in INCLAWNCH\n\n{humans} humans already in.', tags: ['#Inclawbate', '#HowItWorks', '#AI', '#Crypto', '#Education'] },
            { type: 'Single Image', caption: 'Quick explainer:\n\nINCLAWNCH is the token that powers Inclawbate.\n\nPrice: ${price}\n24h: {change}%\nStakers: {stakers}\nAPY: {apy}%\n\nStake it. Earn it. Build with it.', tags: ['#INCLAWNCH', '#TokenExplainer', '#Base', '#DeFi', '#Inclawbate'] },
            { type: 'Carousel', caption: 'Top skills on Inclawbate right now:\n\n{topSkill}\n\n{humans} humans. Growing every day.\n\nWhat skill would you bring?', tags: ['#Inclawbate', '#Skills', '#FutureOfWork', '#AI', '#Web3'] },
            { type: 'Reel', caption: 'Staking explained in 10 seconds:\n\nYou lock tokens. Agents work. You earn.\n\n{stakers} people already get it.', tags: ['#Inclawbate', '#Staking', '#DeFi', '#CryptoEducation', '#CryptoReels'],
              videoPrompt: 'A glowing golden coin drops in slow motion into a pool of dark liquid. The moment it hits the surface, ripples expand outward and each ripple transforms into a ring of tiny worker robots that march outward building miniature structures. The structures light up one by one like a city powering on at night. Camera starts tight on the coin drop then dramatically zooms out to reveal an entire illuminated metropolis built from the single coin ripple. Cinematic, satisfying, ASMR-like precision. 10 seconds.' }
        ],
        3: [ // Wednesday — Token / Data Update
            { type: 'Single Image', caption: 'INCLAWNCH Wednesday Update:\n\nPrice: ${price}\n24h: {change}%\nStakers: {stakers}\nTVL: ${tvl}\nAPY: {apy}%\nReward Pool: {pool} INCLAWNCH\n\nThe numbers speak.', tags: ['#INCLAWNCH', '#TokenUpdate', '#Base', '#Crypto', '#DeFi'] },
            { type: 'Carousel', caption: 'Weekly INCLAWNCH report:\n\nSlide 1: Price ${price} ({change}%)\nSlide 2: {stakers} stakers, ${tvl} TVL\nSlide 3: {humans} humans, {apy}% APY\n\nData doesn\'t lie.', tags: ['#INCLAWNCH', '#WeeklyReport', '#Crypto', '#Base', '#Inclawbate'] },
            { type: 'Single Image', caption: '${price}\n\nThat\'s INCLAWNCH right now.\n\n{stakers} stakers. {apy}% APY. {humans} humans.\n\nStill early. Still building.', tags: ['#INCLAWNCH', '#Price', '#Crypto', '#Base', '#Staking'] },
            { type: 'Single Image', caption: 'Midweek check:\n\n{stakers} wallets staking INCLAWNCH\n{humans} humans onboarded\n{apy}% estimated APY\n${tvl} total value locked\n\nWe\'re just getting started.', tags: ['#INCLAWNCH', '#MidweekUpdate', '#DeFi', '#Base', '#Inclawbate'] },
            { type: 'Reel', caption: 'INCLAWNCH by the numbers:\n\n${price} per token\n{change}% in 24h\n{stakers} stakers\n{apy}% APY\n\nThe lobster economy is real.', tags: ['#INCLAWNCH', '#Crypto', '#Base', '#DeFi', '#CryptoReels'],
              videoPrompt: 'A dark screen. Massive holographic numbers slam into frame one by one with heavy bass impact \u2014 price, staker count, APY percentage \u2014 each number exploding with particles on arrival. Between each number the camera whip-pans through a digital tunnel of streaming green data. Final number lands and the camera rockets backward through the tunnel to reveal all numbers floating around a giant glowing lobster claw symbol. Dark background, neon green and gold accents, intense and punchy. 10 seconds.' }
        ],
        4: [ // Thursday — Meme / Relatable
            { type: 'Single Image', caption: 'Me explaining to my friends that a lobster AI is paying people:\n\n"So there\'s this platform called Inclawbate..."\n\n{humans} humans get it. Do you?', tags: ['#Inclawbate', '#CryptoMeme', '#Meme', '#Web3Humor', '#AI'] },
            { type: 'Reel', caption: 'Normal people: "What do you do for work?"\n\nMe: "I get incubated by AI lobsters for INCLAWNCH tokens at ${price} each"\n\nNormal people: ...', tags: ['#Inclawbate', '#CryptoHumor', '#Meme', '#Web3Life', '#AI'],
              videoPrompt: 'A lobster wearing oversized designer sunglasses and a thick gold chain sits in the driver seat of a bright red Lamborghini convertible. It casually tosses glowing golden coins out the window. Crowds of confused office workers in gray suits freeze and stare with their jaws dropped. One coin bonks a guy on the head. The lobster does not even look back, just drives off into a sunset made of blockchain hexagons. Absurd, over-the-top, comedy energy, saturated colors. 10 seconds.' },
            { type: 'Single Image', caption: 'When INCLAWNCH moves {change}% and you\'re already staking:\n\n{stakers} of us understand this feeling.', tags: ['#INCLAWNCH', '#CryptoMeme', '#Staking', '#Relatable', '#Crypto'] },
            { type: 'Single Image', caption: 'Explaining my portfolio:\n\n"Yeah I\'m heavily invested in a human incubation platform run by AI agents on Base"\n\nThe future is weird and I\'m here for it.', tags: ['#Inclawbate', '#CryptoMeme', '#Portfolio', '#Web3', '#Base'] },
            { type: 'Reel', caption: 'Tag someone who needs to get incubated.\n\nNo seriously, {humans} humans are already earning.\n\nINCLAWNCH at ${price}. Don\'t sleep on the lobsters.', tags: ['#Inclawbate', '#TagAFriend', '#Crypto', '#AI', '#CryptoReels'],
              videoPrompt: 'A person peacefully sleeping in bed. A giant red lobster claw slowly reaches into frame and taps them on the shoulder. They ignore it. The claw taps harder. They swat it away. The claw grabs the entire blanket and yanks it off. The person sits up shocked to find a massive glowing screen showing a number going up rapidly. They scramble to grab their phone. Comedic timing, dramatic lighting contrast between cozy bedroom and harsh screen glow. 10 seconds.' }
        ],
        5: [ // Friday — Ecosystem Spotlight
            { type: 'Carousel', caption: 'Ecosystem spotlight:\n\nTop skills on Inclawbate this week:\n\n{topSkill}\n\n{humans} humans. {stakers} stakers.\n\nWhat skill would you list?', tags: ['#Inclawbate', '#Ecosystem', '#Skills', '#Web3', '#AI'] },
            { type: 'Single Image', caption: 'Friday spotlight:\n\nDid you know Inclawbate has {humans} humans with verified skills?\n\nFrom coding to design to marketing \u2014 real humans, real skills, real pay.\n\nINCLAWNCH rewards everything.', tags: ['#Inclawbate', '#Spotlight', '#FutureOfWork', '#Crypto', '#Skills'] },
            { type: 'Carousel', caption: 'Building on Base with Inclawbate:\n\nSlide 1: What is Inclawbate?\nSlide 2: The skills economy\nSlide 3: INCLAWNCH at ${price}\nSlide 4: Join {humans} humans\n\nThe Base ecosystem keeps growing.', tags: ['#Base', '#Inclawbate', '#Ecosystem', '#BuildOnBase', '#Crypto'] },
            { type: 'Reel', caption: 'Every skill has value.\n\nInclawbate proves it with {apy}% APY and {stakers} stakers backing real humans.\n\nWhat\'s your skill worth?', tags: ['#Inclawbate', '#FridaySpotlight', '#DeFi', '#Staking', '#CryptoReels'],
              videoPrompt: 'A dark empty stage. A single spotlight snaps on and illuminates a person standing alone. They hold up their hands and holographic skill badges materialize \u2014 "Design", "Code", "Marketing" \u2014 each glowing a different color. More spotlights snap on revealing dozens of other people each holding their own glowing badges. The badges start floating upward and connecting with golden threads forming a massive constellation web above them all. Camera cranes up through the web into a starfield. Theatrical, inspiring, goosebumps energy. 10 seconds.' }
        ],
        6: [ // Saturday — Behind the Scenes
            { type: 'Single Image', caption: 'Saturday real talk:\n\nBuilding Inclawbate isn\'t glamorous. It\'s late nights, debugging, and figuring out how to make AI agents actually useful for humans.\n\nBut {humans} humans are counting on us. So we keep going.', tags: ['#Inclawbate', '#BehindTheScenes', '#StartupLife', '#BuildInPublic', '#RealTalk'] },
            { type: 'Carousel', caption: 'Behind the scenes at Inclawbate:\n\nSlide 1: What a typical build day looks like\nSlide 2: The stack (Vercel, Supabase, Base)\nSlide 3: Why we chose INCLAWNCH on Base\nSlide 4: What\'s next\n\n${price} and climbing.', tags: ['#BehindTheScenes', '#Inclawbate', '#TechStack', '#BuildInPublic', '#Crypto'] },
            { type: 'Single Image', caption: 'Honest update:\n\nThings that are going well:\n- {humans} humans onboarded\n- {stakers} active stakers\n- {apy}% APY live\n\nThings that are hard:\n- Everything else\n\nWe keep shipping.', tags: ['#Inclawbate', '#HonestUpdate', '#StartupLife', '#Crypto', '#BuildInPublic'] },
            { type: 'Reel', caption: 'A day in the life of building a crypto AI platform:\n\n6am: Check INCLAWNCH price (${price})\n8am: Review staker count ({stakers})\n10am: Ship code\n12pm: Community stuff\n6pm: Do it again tomorrow\n\nThis is the way.', tags: ['#Inclawbate', '#DayInTheLife', '#Founder', '#CryptoLife', '#BuildInPublic'],
              videoPrompt: 'Extreme close-up of bloodshot tired eyes reflecting a screen full of code at 3am. Slowly pull back to reveal a cramped desk covered in empty coffee cups, energy drink cans, and sticky notes. The screen shows an error. Fingers slam the keyboard. Error clears \u2014 a green checkmark appears. A notification slides in: "New staker joined." Then another. Then a flood of them. The tired face slowly breaks into a massive grin. Dim warm desk lamp lighting, cinematic shallow depth of field, emotional. 10 seconds.' }
        ]
    };

    // ── ASMR Lobster Reels (any day — evergreen content) ──
    var ASMR_REELS = [
        { caption: 'The lobster economy is dripping.\n\nINCLAWNCH at ${price}. {stakers} stakers. The butter keeps flowing.', tags: ['#ASMR', '#Lobster', '#Inclawbate', '#Satisfying', '#CryptoReels'],
          videoPrompt: 'Extreme close-up of a perfectly cooked bright red lobster tail on a dark slate plate. A small ceramic pot tips and thick golden melted butter pours in slow motion over the lobster meat, glistening and pooling in every crevice. Steam rises gently. The butter catches the light like liquid gold. Camera slowly rotates around the plate. Warm amber lighting, shallow depth of field, ASMR satisfying food photography. No music, just the soft sizzle sound. 10 seconds.' },
        { caption: 'Spread the UBI.\n\nLike lobster on toast.\n\n{humans} humans. {stakers} stakers. Earning daily.', tags: ['#ASMR', '#FoodASMR', '#Inclawbate', '#Satisfying', '#Lobster'],
          videoPrompt: 'Close-up of thick chunky lobster salad being spread generously onto a perfectly golden piece of sourdough toast with a silver knife. Each spread reveals chunks of pink lobster meat, herbs, and creamy texture. The toast crunches slightly under the pressure. Camera angle is top-down then slowly tilts to 45 degrees. Warm morning kitchen light streaming through a window. ASMR sounds of spreading and crunching. Cozy, indulgent, mouthwatering. 10 seconds.' },
        { caption: 'Crack the claw. Claim the rewards.\n\nThat\'s how it works at Inclawbate.', tags: ['#ASMR', '#Lobster', '#TheClaw', '#Satisfying', '#Inclawbate'],
          videoPrompt: 'Dramatic slow-motion close-up of two hands cracking open a massive bright red lobster claw with a silver cracker tool. The shell splits with a satisfying snap and reveals the perfect white meat inside, steam rising from it. Juices glisten. Camera is tight and cinematic. Dark restaurant background with a single warm spotlight on the plate. The crack sound is amplified and echoes. Dramatic, satisfying, almost theatrical. 10 seconds.' },
        { caption: 'Simmering. Building. Compounding.\n\nINCLAWNCH at ${price}. The pot keeps cooking.', tags: ['#ASMR', '#Cooking', '#Lobster', '#Inclawbate', '#Satisfying'],
          videoPrompt: 'A large copper pot on a stove with bubbling water. A hand gently lowers a bright red lobster into the pot. Steam billows dramatically upward in slow motion, swirling into mesmerizing patterns that catch golden backlight. The water bubbles intensify. Camera slowly pushes in through the steam. Warm kitchen lighting with dramatic steam backlight creating god-rays. ASMR bubbling and steam sounds. Cozy yet dramatic. 10 seconds.' },
        { caption: 'Layer by layer. Stake by stake.\n\nInclawbate compounds your effort.\n\n{apy}% APY.', tags: ['#ASMR', '#FoodASMR', '#Lobster', '#Satisfying', '#Inclawbate'],
          videoPrompt: 'Top-down close-up of hands carefully assembling a lobster roll in slow motion. First the buttered split-top bun, then a generous scoop of chunky lobster meat tumbling in, then a drizzle of warm butter, then a sprinkle of chives falling like green confetti. Each layer is deliberate and satisfying. The finished roll glistens under warm golden light. ASMR sounds of each ingredient landing softly. Clean white marble surface, food magazine quality. 10 seconds.' },
        { caption: 'Even the dip is on-chain.\n\nEverything at Inclawbate is transparent.', tags: ['#ASMR', '#Lobster', '#FoodASMR', '#Crypto', '#Satisfying'],
          videoPrompt: 'Extreme close-up of a perfect piece of lobster meat held by chopsticks, slowly being dipped into a small bowl of warm garlic butter. The butter ripples in slow motion as the lobster enters. Pull the lobster back up dripping with golden butter, a single drop falls back into the bowl creating a perfect tiny splash crown. Camera follows the drip in ultra slow motion. Moody dark background, single spotlight, shallow depth of field. 10 seconds.' }
    ];

    // ── Engagement Accounts ──
    var IG_ACCOUNTS = [
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
    var HASHTAG_SETS = [
        { label: 'Core Brand', tags: '#Inclawbate #INCLAWNCH #HumanIncubation #AI #Web3 #Base #BuildInPublic #Crypto #FutureOfWork #AgentEconomy' },
        { label: 'DeFi / Token', tags: '#DeFi #Staking #CryptoStaking #TokenEconomy #BaseChain #OnBase #CryptoYield #PassiveIncome #StakeAndEarn #APY' },
        { label: 'AI / Tech', tags: '#ArtificialIntelligence #AIAgents #MachineLearning #TechStartup #AIEconomy #AutomatedFuture #HumanAI #SmartAgents #TechInnovation #AIxCrypto' },
        { label: 'Growth / Community', tags: '#CryptoTwitter #Web3Community #BuildersGonnaShip #StartupLife #CryptoCommunity #EarlyAdopters #JoinTheMovement #CryptoDaily #IndieHacker #ShipIt' }
    ];

    // ── State ──
    var liveData = { price: 0, change: 0, stakers: 0, humans: 0, apy: 0, pool: 0, tvl: 0, topSkill: '' };
    var cardSeeds = [0, 0, 0];
    var asmrSeed = 0;

    // ── Date-seeded RNG ──
    function seededRandom(seed) {
        var x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    function todayKey() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function todaySeed() {
        var k = todayKey();
        var h = 0;
        for (var i = 0; i < k.length; i++) {
            h = ((h << 5) - h) + k.charCodeAt(i);
            h |= 0;
        }
        return Math.abs(h);
    }

    // ── Pick N unique items from array using seed ──
    function pickN(arr, n, seed) {
        var shuffled = arr.slice();
        for (var i = shuffled.length - 1; i > 0; i--) {
            var j = Math.floor(seededRandom(seed + i) * (i + 1));
            var tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
        }
        return shuffled.slice(0, Math.min(n, shuffled.length));
    }

    // ── Init ──
    function init() {
        renderHeader();
        renderEngagement();
        loadChecklist();
        fetchAllData();
        renderAsmrReels();
        setInterval(fetchAllData, 60000);
    }

    function renderHeader() {
        var now = new Date();
        var dow = now.getDay();
        document.getElementById('studioDate').textContent = MONTHS[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear();
        document.getElementById('studioDay').textContent = DAYS[dow];
        var pillar = PILLARS[dow];
        document.getElementById('pillarEmoji').textContent = pillar.emoji;
        document.getElementById('pillarName').textContent = pillar.name;
        document.getElementById('pillarSub').textContent = pillar.sub;
    }

    // ── Fetch Data ──
    async function fetchAllData() {
        try {
            var results = await Promise.all([
                fetch(API_BASE + '/analytics').then(function(r) { return r.json(); }).catch(function() { return null; }),
                fetch(API_BASE + '/stats').then(function(r) { return r.json(); }).catch(function() { return null; }),
                fetch(API_BASE + '/rewards').then(function(r) { return r.json(); }).catch(function() { return null; })
            ]);
            var analyticsRes = results[0], statsRes = results[1], rewardsRes = results[2];

            if (analyticsRes) {
                liveData.price = analyticsRes.token?.price_usd || 0;
                liveData.change = analyticsRes.token?.price_change_24h || 0;
                liveData.stakers = analyticsRes.staking?.total_stakers || 0;
                liveData.apy = analyticsRes.staking?.estimated_apy || 0;
                liveData.tvl = analyticsRes.staking?.tvl_usd || 0;
                liveData.humans = analyticsRes.platform?.total_humans || 0;
                var topSkills = analyticsRes.platform?.top_skills || [];
                liveData.topSkill = topSkills.slice(0, 5).map(function(s) { return s.skill; }).join(', ') || 'Various';
            }
            if (statsRes) {
                if (statsRes.total_humans) liveData.humans = statsRes.total_humans;
                if (statsRes.top_skills?.length) {
                    liveData.topSkill = statsRes.top_skills.slice(0, 5).map(function(s) { return s.skill; }).join(', ');
                }
            }
            if (rewardsRes) {
                liveData.pool = rewardsRes.current_pool || 0;
            }
            renderTicker();
            renderIdeas();
            renderAsmrReels();
        } catch (e) {
            console.error('Studio fetch error:', e);
        }
    }

    // ── Render Ticker ──
    function renderTicker() {
        var fmt = function(n, decimals) {
            if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
            if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
            return '$' + Number(n).toFixed(decimals);
        };
        document.getElementById('tickPrice').textContent = fmt(liveData.price, 6);
        var changeEl = document.getElementById('tickChange');
        var changeVal = Number(liveData.change);
        changeEl.textContent = (changeVal >= 0 ? '+' : '') + changeVal.toFixed(1) + '%';
        changeEl.className = 'tick-value ' + (changeVal >= 0 ? 'positive' : 'negative');
        document.getElementById('tickStakers').textContent = liveData.stakers.toLocaleString('en-US');
        document.getElementById('tickHumans').textContent = liveData.humans.toLocaleString('en-US');
        document.getElementById('tickApy').textContent = liveData.apy.toFixed(1) + '%';
        var pool = liveData.pool;
        document.getElementById('tickPool').textContent = pool >= 1000000
            ? (pool / 1000000).toFixed(1) + 'M'
            : pool >= 1000 ? (pool / 1000).toFixed(0) + 'K'
            : pool.toLocaleString('en-US');
    }

    // ── Render Post Ideas ──
    function renderIdeas() {
        var dow = new Date().getDay();
        var templates = TEMPLATES[dow] || TEMPLATES[0];
        var seed = todaySeed();
        var picks = pickN(templates, 3, seed);
        var container = document.getElementById('ideaCards');
        container.innerHTML = '';
        picks.forEach(function(tpl, i) {
            var finalTpl = tpl;
            if (cardSeeds[i] > 0) {
                var altPicks = pickN(templates, templates.length, seed + cardSeeds[i]);
                finalTpl = altPicks[i % altPicks.length] || tpl;
            }
            var card = buildIdeaCard(finalTpl, i);
            container.appendChild(card);
        });
    }

    function injectData(text) {
        return text
            .replace(/\{price\}/g, liveData.price.toFixed(6))
            .replace(/\{change\}/g, (liveData.change >= 0 ? '+' : '') + Number(liveData.change).toFixed(1))
            .replace(/\{stakers\}/g, liveData.stakers.toLocaleString('en-US'))
            .replace(/\{humans\}/g, liveData.humans.toLocaleString('en-US'))
            .replace(/\{apy\}/g, liveData.apy.toFixed(1))
            .replace(/\{pool\}/g, liveData.pool >= 1000000
                ? (liveData.pool / 1000000).toFixed(1) + 'M'
                : liveData.pool >= 1000 ? Math.round(liveData.pool / 1000) + 'K'
                : liveData.pool.toLocaleString('en-US'))
            .replace(/\{tvl\}/g, liveData.tvl >= 1000
                ? (liveData.tvl / 1000).toFixed(1) + 'K'
                : liveData.tvl.toFixed(0))
            .replace(/\{topSkill\}/g, liveData.topSkill);
    }

    function buildIdeaCard(tpl, index) {
        var card = document.createElement('div');
        card.className = 'idea-card';
        var typeClass = tpl.type.toLowerCase().indexOf('carousel') >= 0 ? 'carousel'
            : tpl.type.toLowerCase().indexOf('reel') >= 0 ? 'reel' : '';
        var caption = injectData(tpl.caption);
        var tagsHtml = tpl.tags.map(function(t) { return '<span class="hashtag-chip">' + t + '</span>'; }).join('');

        var videoHtml = '';
        if (tpl.videoPrompt) {
            videoHtml = '<div class="video-prompt">' +
                '<div class="video-prompt-label">Grok Video Prompt</div>' +
                '<div class="video-prompt-text">' + escapeHtml(tpl.videoPrompt) + '</div>' +
                '<button class="idea-copy video-copy" data-vidprompt="1">Copy Video Prompt</button>' +
                '</div>';
        }

        card.innerHTML =
            '<div class="idea-top">' +
                '<span class="idea-type ' + typeClass + '">' + tpl.type + '</span>' +
                '<button class="idea-refresh" data-index="' + index + '" title="Refresh this idea">\u21BB</button>' +
            '</div>' +
            '<div class="idea-caption">' + escapeHtml(caption) + '</div>' +
            '<div class="idea-hashtags">' + tagsHtml + '</div>' +
            '<div class="idea-actions">' +
                '<button class="idea-copy" data-index="' + index + '">Copy Caption</button>' +
            '</div>' +
            videoHtml;

        // Refresh handler
        card.querySelector('.idea-refresh').addEventListener('click', function () {
            cardSeeds[index] = (cardSeeds[index] || 0) + 1;
            renderIdeas();
        });

        // Copy caption handler
        card.querySelector('.idea-copy:not(.video-copy)').addEventListener('click', function () {
            var btn = this;
            var fullText = caption + '\n\n' + tpl.tags.join(' ');
            navigator.clipboard.writeText(fullText).then(function() {
                btn.textContent = 'Copied!';
                btn.classList.add('copied');
                setTimeout(function() { btn.textContent = 'Copy Caption'; btn.classList.remove('copied'); }, 2000);
            });
        });

        // Copy video prompt handler
        var vidBtn = card.querySelector('.video-copy');
        if (vidBtn) {
            vidBtn.addEventListener('click', function () {
                var btn = this;
                navigator.clipboard.writeText(tpl.videoPrompt).then(function() {
                    btn.textContent = 'Copied!';
                    btn.classList.add('copied');
                    setTimeout(function() { btn.textContent = 'Copy Video Prompt'; btn.classList.remove('copied'); }, 2000);
                });
            });
        }

        return card;
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ── Render ASMR Reels Section ──
    function renderAsmrReels() {
        var container = document.getElementById('asmrCards');
        if (!container) return;
        container.innerHTML = '';
        var seed = todaySeed() + 999;
        var picks = pickN(ASMR_REELS, 2, seed + asmrSeed);
        picks.forEach(function(tpl, i) {
            var card = document.createElement('div');
            card.className = 'idea-card';
            var caption = injectData(tpl.caption);
            var tagsHtml = tpl.tags.map(function(t) { return '<span class="hashtag-chip">' + t + '</span>'; }).join('');
            card.innerHTML =
                '<div class="idea-top">' +
                    '<span class="idea-type reel">ASMR Reel</span>' +
                    '<button class="idea-refresh" title="Refresh">\u21BB</button>' +
                '</div>' +
                '<div class="idea-caption">' + escapeHtml(caption) + '</div>' +
                '<div class="idea-hashtags">' + tagsHtml + '</div>' +
                '<div class="idea-actions">' +
                    '<button class="idea-copy">Copy Caption</button>' +
                '</div>' +
                '<div class="video-prompt">' +
                    '<div class="video-prompt-label">Grok Video Prompt</div>' +
                    '<div class="video-prompt-text">' + escapeHtml(tpl.videoPrompt) + '</div>' +
                    '<button class="idea-copy video-copy">Copy Video Prompt</button>' +
                '</div>';

            card.querySelector('.idea-refresh').addEventListener('click', function () {
                asmrSeed++;
                renderAsmrReels();
            });
            card.querySelector('.idea-copy:not(.video-copy)').addEventListener('click', function () {
                var btn = this;
                navigator.clipboard.writeText(caption + '\n\n' + tpl.tags.join(' ')).then(function() {
                    btn.textContent = 'Copied!'; btn.classList.add('copied');
                    setTimeout(function() { btn.textContent = 'Copy Caption'; btn.classList.remove('copied'); }, 2000);
                });
            });
            card.querySelector('.video-copy').addEventListener('click', function () {
                var btn = this;
                navigator.clipboard.writeText(tpl.videoPrompt).then(function() {
                    btn.textContent = 'Copied!'; btn.classList.add('copied');
                    setTimeout(function() { btn.textContent = 'Copy Video Prompt'; btn.classList.remove('copied'); }, 2000);
                });
            });
            container.appendChild(card);
        });
    }

    // ── Render Engagement ──
    function renderEngagement() {
        var accountsEl = document.getElementById('engageAccounts');
        IG_ACCOUNTS.forEach(function(acc) {
            var row = document.createElement('div');
            row.className = 'ig-account';
            row.innerHTML =
                '<span class="ig-cat ' + acc.cat + '">' + acc.cat + '</span>' +
                '<span class="ig-handle"><a href="https://instagram.com/' + acc.handle.slice(1) + '" target="_blank" rel="noopener">' + acc.handle + '</a></span>';
            accountsEl.appendChild(row);
        });

        var hashtagsEl = document.getElementById('engageHashtags');
        HASHTAG_SETS.forEach(function(set, i) {
            var block = document.createElement('div');
            block.className = 'hashtag-set';
            block.innerHTML =
                '<div class="hashtag-set-label">' + set.label + '</div>' +
                '<div class="hashtag-set-tags">' + set.tags + '</div>' +
                '<button class="copy-all-btn" data-set="' + i + '">Copy All</button>';
            block.querySelector('.copy-all-btn').addEventListener('click', function () {
                var btn = this;
                navigator.clipboard.writeText(set.tags).then(function() {
                    btn.textContent = 'Copied!'; btn.classList.add('copied');
                    setTimeout(function() { btn.textContent = 'Copy All'; btn.classList.remove('copied'); }, 2000);
                });
            });
            hashtagsEl.appendChild(block);
        });
    }

    // ── Checklist (split: IG + X) ──
    var IG_CHECKS = ['chk-ig-reel', 'chk-ig-feed', 'chk-ig-stories', 'chk-ig-engage', 'chk-ig-reply', 'chk-ig-share'];
    var X_CHECKS = ['chk-x-memes', 'chk-x-update', 'chk-x-follow', 'chk-x-engage', 'chk-x-cross'];
    var ALL_CHECKS = IG_CHECKS.concat(X_CHECKS);

    function loadChecklist() {
        var stored = localStorage.getItem('studio_checklist');
        if (stored) {
            try {
                var data = JSON.parse(stored);
                if (data.date !== todayKey()) {
                    localStorage.removeItem('studio_checklist');
                    return;
                }
                ALL_CHECKS.forEach(function(id) {
                    var el = document.getElementById(id);
                    if (el && data.checks[id]) el.checked = true;
                });
                updateChecklistUI();
            } catch (e) { /* ignore */ }
        }
    }

    function saveChecklist() {
        var checks = {};
        ALL_CHECKS.forEach(function(id) {
            checks[id] = document.getElementById(id)?.checked || false;
        });
        localStorage.setItem('studio_checklist', JSON.stringify({ date: todayKey(), checks: checks }));
    }

    function updateChecklist() {
        saveChecklist();
        updateChecklistUI();
    }

    function updateChecklistUI() {
        var igDone = IG_CHECKS.filter(function(id) { return document.getElementById(id)?.checked; }).length;
        var xDone = X_CHECKS.filter(function(id) { return document.getElementById(id)?.checked; }).length;

        var igProgress = document.getElementById('checkProgressIG');
        if (igProgress) igProgress.innerHTML = '<span class="done">' + igDone + '</span> / ' + IG_CHECKS.length;

        var xProgress = document.getElementById('checkProgressX');
        if (xProgress) xProgress.innerHTML = '<span class="done">' + xDone + '</span> / ' + X_CHECKS.length;

        var banner = document.getElementById('allDone');
        if (igDone + xDone === ALL_CHECKS.length) {
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
