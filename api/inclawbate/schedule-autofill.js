// Auto-fill @inclawbator schedule with pillar-based content drafts
// POST {action:"generate"} — generate drafts for empty slots (admin only)
// GET  ?date=YYYY-MM-DD    — get drafts for a date

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const _groqKeys = (process.env.GROQ_API_KEY || process.env.GROQ_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
let _groqIdx = 0;
function getGroqKey() { const k = _groqKeys[_groqIdx % _groqKeys.length]; _groqIdx++; return k; }
const GROQ_API_KEY = _groqKeys[0] || '';
const ADMIN_WALLETS = ['0x91b5c0d07859cfeafeb67d9694121cd741f049bd'];
// Editors can generate, edit, delete drafts — but NOT approve/reject
const EDITOR_WALLETS = ['0x47fbb4e2527492ab56b7fba5fde3e7b35719e655']; // @FreefoRaLLey
const VALID_HOURS = [1, 13, 16, 19, 22];

// Time-of-day context for AI prompts (UTC hours → ET labels)
function getTimeOfDay(utcHour) {
    const map = { 13: 'morning (9 AM ET)', 16: 'midday (12 PM ET)', 19: 'afternoon (3 PM ET)', 22: 'evening (6 PM ET)', 1: 'night (9 PM ET)' };
    return map[utcHour] || 'unknown';
}
function getGreetingRule(utcHour) {
    if (utcHour === 13) return 'Morning slot — "gm" is OK.';
    return 'This is an ' + getTimeOfDay(utcHour) + ' slot — do NOT say "gm", "good morning", or any morning greeting. Use time-appropriate openers like "gn" for night, or no greeting at all.';
}

const ECOSYSTEM_LINKS = `- Website: inclawbate.app
- Dashboard: inclawbate.app/dashboard
- App builder (AI, no code): inclawbate.app/build
- All apps: inclawbate.app/apps
- Staking ($CLAWS): inclawbate.app/stake
- Agent skills: inclawbate.app/skills
- Free tools: inclawbate.app/tools
- X Schedule: inclawbate.app/schedule
- Incubator: inclawbate.app/inclawbator
- PokerAI (poker vs AI, real USDC): pokerai.app
- OddsClaw (prediction markets): oddsclaw.app
- Telegram community: t.me/inclawbate
- Token: $CLAWS on Base
Pick 0-2 links per tweet. Vary which ones you use — don't always default to inclawbate.app. Match the link to the tweet topic (staking tweet → /stake, builder tweet → /build, poker tweet → pokerai.app, etc).`;

// Content pillars by day of week (0=Sun)
const PILLARS = [
    { name: 'Weekly Recap',       emoji: '\u{1F4CA}', needsImage: true,  desc: 'Recap what shipped this week, platform stats, what\'s coming next' },
    { name: 'App Spotlight',      emoji: '\u{1F4F1}', needsImage: true,  desc: 'Deep dive on one specific app — what it does, why it\'s cool, link to try it' },
    { name: 'Builder Shoutout',   emoji: '\u{1F477}', needsImage: false, desc: 'Highlight a builder or community member — what they made, celebrate the work' },
    { name: 'DeFi / CLAWS Update',emoji: '\u{26D3}',  needsImage: true,  desc: 'CLAWS price, staking stats, LP news, ecosystem numbers' },
    { name: 'How-To / Tips',      emoji: '\u{1F4A1}', needsImage: false, desc: 'Tutorial or tip — "Did you know you can..." educational content' },
    { name: 'Community Vibes',    emoji: '\u{1F525}', needsImage: true,  desc: 'Poll, hot take, meme, engagement bait — get people talking' },
    { name: 'Incubation CTA',     emoji: '\u{1F680}', needsImage: true,  desc: 'Sell the incubation service — "Got a project? We build it for you"' },
];

// Slot-level sub-topics so 5 posts/day aren't all the same
const SLOT_ANGLES = {
    'App Spotlight':       ['feature highlight', 'user story', 'compare to alternatives', 'quick demo walkthrough', 'hidden feature'],
    'Builder Shoutout':    ['their journey', 'what they built', 'dev tips from them', 'their stack', 'community impact'],
    'DeFi / CLAWS Update': ['price + volume', 'staking APY', 'LP performance', 'holder growth', 'ecosystem TVL'],
    'How-To / Tips':       ['getting started', 'power user tip', 'common mistakes', 'hidden features', 'workflow hack'],
    'Community Vibes':     ['hot take poll', 'this or that', 'unpopular opinion', 'meme', 'community shoutout'],
    'Incubation CTA':      ['success story', 'what we offer', 'founder testimonial', 'process walkthrough', 'limited spots'],
    'Weekly Recap':        ['shipped this week', 'top apps', 'community highlights', 'stats roundup', 'next week preview'],
};

// Brand archetype — account-specific image prompt contexts

// @inclawbator = the lobster AI agent. Meme energy, 3D mascot, personality-driven.
const INCLAWBATOR_IMAGE_CONTEXT = `You must write an image prompt that ILLUSTRATES what the tweet is about.

CHARACTER: A stylized 3D cartoon coral-red lobster with glossy shell, big round expressive eyes, two large claws (used as hands), Pixar-like proportions. Confident, builder energy, slightly cocky grin.
STYLE: 3D cinematic render, dark background (#0a0a0f), coral-red (#e87955) and teal (#2dd4bf) neon accents, depth of field, 1:1. Polished Octane/Blender quality. Think Fortnite character meets crypto aesthetic.
NO: text in image, white backgrounds, flat illustration, realistic humans, brand names, anime.

PROCESS — follow these steps:
1. Read the tweet. What is it literally about? (e.g. "108 apps" = many apps, "staking" = passive income, "build first app" = building/creating, "poll" = choosing between options)
2. Turn that concept into a VISUAL SCENE the lobster is in (e.g. "108 apps" → lobster surrounded by a galaxy of floating glowing app screens, "staking" → lobster meditating with gold coins orbiting, "poll" → lobster holding up two glowing objects weighing them)
3. Pick a unique pose, environment, and camera angle that fits`;

// @inclawbate = the company. Abstract, warm, conceptual. NO humans, NO mascot. The overlay adds branding.
const INCLAWBATE_IMAGE_CONTEXT = `You must write an image prompt that ILLUSTRATES the CONCEPT behind the tweet — not literally, but abstractly and beautifully.

SUBJECT: Abstract, conceptual, warm imagery. NO humans, NO faces, NO mascots, NO characters. Think: textures, nature, light, growth metaphors, aerial landscapes, macro photography, golden shapes, flowing patterns.
STYLE: Fine art photography or conceptual illustration. Warm color palette — coral (#e87955), golden amber, soft teal, cream whites, deep purples. Clean, minimal compositions with strong visual impact. Think National Geographic meets abstract art. Photorealistic textures but conceptual subjects.
NO: text in image, human faces or bodies, cartoon characters, mascots, 3D renders, anime, dark/neon cyberpunk, cluttered compositions, stock photo vibes.

PROCESS — follow these steps:
1. Read the tweet. What is the CORE CONCEPT? (e.g. "108 apps" = abundance/growth, "staking" = patience/seeds growing, "community" = connection/warmth, "treasury" = stewardship/strength)
2. Turn that concept into an ABSTRACT VISUAL METAPHOR (e.g. "growth" → golden light breaking through soil with tiny sprouts, "abundance" → aerial shot of a coral reef teeming with life, "community" → warm golden threads woven together, "stewardship" → a single perfect drop of water on a leaf at sunrise)
3. The tone should feel: warm, hopeful, abundant, purposeful, beautiful. Never cold, clinical, or dark.`;

// Shared alias for backward compat — defaults to inclawbator
const BRAND_IMAGE_CONTEXT = INCLAWBATOR_IMAGE_CONTEXT;

// Scene starting points per pillar — @inclawbator (lobster mascot)
const PILLAR_SCENE_HINTS = {
    'App Spotlight': 'The 3D lobster presenting a glowing app on a holographic screen. Vary: gesturing proudly at a floating interface, demo-ing on a floating tablet, holding up a completed project, or on stage showing to an audience of smaller characters.',
    'Builder Shoutout': 'The 3D lobster building something at a futuristic workstation. Vary: typing on a glowing keyboard with holographic screens, late-night grind with coffee cups, triumphant just-finished pose, or pair-coding with a smaller crab character.',
    'DeFi / CLAWS Update': 'The 3D lobster surrounded by financial visualizations. Vary: meditating with orbiting gold coins, tending a bioluminescent garden of growing crystals, analyzing holographic charts, or watching data from a rooftop.',
    'Weekly Recap': 'Celebratory energy. Vary: claws raised with confetti and particles, looking out over a neon cityscape at night, surrounded by floating app screens, or high-fiving smaller characters.',
    'How-To / Tips': 'Teaching energy. Vary: pointing at floating step-by-step panels, mentoring a tiny shrimp character, demonstrating on a glowing screen, or in a cozy study with holographic notes.',
    'Community Vibes': 'Social energy. Vary: greeting at a neon-lit lounge, on a small stage with a crowd, gaming face-off with another character, or casual group hangout.',
    'Incubation CTA': 'Aspirational energy. Vary: standing on a glowing elevated platform, walking through a swirling energy portal, leading a march of smaller lobster characters, or nurturing glowing orbs in a warm chamber.',
};

// Concrete scene ideas per pillar — @inclawbator (3D lobster mascot)
const NARRATIVE_SCENES = {
    'App Spotlight': [
        'The 3D coral-red lobster at a glowing workbench, manipulating floating UI components mid-air with its claws. Multiple holographic screens nearby. A smaller crab character gives a thumbs-up. Dark background, coral and teal neon lighting, cinematic 3D render, 1:1.',
        'The lobster holding up a glowing completed project like a trophy. Behind it, holographic blueprints float. Achievement energy, upward camera angle. Dark background, Octane render quality, 1:1.',
        'The lobster on a spotlit stage presenting something on a large holographic display. Audience of small sea creatures watching. Conference energy, dramatic stage lighting. 3D render, 1:1.',
        'The lobster and a tiny shrimp character side by side, the lobster showing something on a floating screen. The shrimp looks amazed. Warm lighting, mentoring energy. 3D render, 1:1.',
    ],
    'Builder Shoutout': [
        'Late night, dark room lit by a glowing screen. The lobster hunched over a keyboard, focused. Empty coffee mugs scattered. On-screen: beautiful code coming together. Moody teal lighting. 3D render, 1:1.',
        'Two lobster characters at adjacent workstations, reaching across to high-five (high-claw). Glowing data streams connecting their screens. Collaboration energy. 3D render, 1:1.',
        'The lobster stepping back from a completed project, quiet pride. Soft backlight, golden rim lighting on the shell. Achievement moment. 3D render, 1:1.',
        'The lobster mentoring a smaller crab character at a workbench. Pointing at something, explaining patiently. Warm workshop lighting. 3D render, 1:1.',
    ],
    'DeFi / CLAWS Update': [
        'The lobster floating cross-legged in meditation. Gold coins orbit slowly around it. Soft green upward arrows in background. Peaceful zen energy. Dark void, 3D render, 1:1.',
        'The lobster on a futuristic trading floor, one claw on a device showing a chart. Other small sea creatures peek over its shoulder. Analytical energy, teal and gold. 3D render, 1:1.',
        'The lobster tending a bioluminescent garden where crystal formations grow from coral stalks. Watering them with teal light. Yield farming metaphor. 3D render, 1:1.',
        'The lobster on a rooftop at night, watching a massive whale silhouette pass overhead trailing sparkles. Awe and scale. Deep blue and teal. 3D render, 1:1.',
    ],
    'How-To / Tips': [
        'The lobster kneeling to a tiny shrimp\'s eye level, pointing at a floating tutorial screen. Patient teacher energy. Warm golden spotlight. 3D render, 1:1.',
        'A cozy workshop with floating holographic screens and blueprints pinned to coral walls. The lobster gestures at step-by-step instruction panels. Educational. 3D render, 1:1.',
        'The lobster waking up in a cozy coral apartment, stretching, grabbing a glowing coffee mug. Floating notification bubbles. Morning routine, warm tones. 3D render, 1:1.',
        'The lobster and a small octopus character walking together, the lobster pointing things out. Learning by doing. Warm background. 3D render, 1:1.',
    ],
    'Community Vibes': [
        'A neon-lit underwater lounge packed with cartoon sea creatures. The lobster on a small stage. Community gathering energy, warm ambient lighting. 3D render, 1:1.',
        'Two lobsters face off across a table, creating on holographic screens. Smaller creatures vote with beams of light. Playful competition. Split teal/coral lighting. 3D render, 1:1.',
        'Group photo lineup: the lobster center, flanked by crab, octopus, shrimp, pufferfish. Teal and coral backdrop. Team photo energy. 3D render, 1:1.',
        'Sunrise over a coral reef. The lobster on a rooftop, coffee in claw, watching the sky. Fresh morning energy, warm golden light. 3D render, 1:1.',
    ],
    'Incubation CTA': [
        'A warm egg-shaped glowing chamber. The lobster inside, tending to luminous floating orbs. Nurturing, incubation energy. Close-up, coral lighting. 3D render, 1:1.',
        'The lobster before a massive swirling portal of coral and teal energy. Through it: a thriving city of lights. Steps forward boldly. Epic wide shot. 3D render, 1:1.',
        'The lobster on an elevated platform of stacked glowing geometric shapes. Earned authority. Low camera angle looking up. 3D render, 1:1.',
        'An army of smaller lobster characters marching forward, each carrying a different tool. The main lobster leads. Coral banners. Movement energy. 3D render, 1:1.',
    ],
    'Weekly Recap': [
        'A packed arena scene. Massive holographic number glows above. Confetti everywhere. The lobster center stage, claws raised. Smaller characters cheering. 3D render, 1:1.',
        'The lobster on a rooftop at night, looking up at stars connected by teal lines forming a constellation. Contemplative, visionary. Wide shot. 3D render, 1:1.',
        'The lobster staring at a small floating notification bubble, face lit by its glow. Expression of pure joy. Intimate moment, tight close-up, soft bokeh. 3D render, 1:1.',
        'The lobster planting a flag on a summit, looking out over a vast digital landscape below. Achievement energy. Dramatic rim lighting. 3D render, 1:1.',
    ],
};

// @inclawbate (company) content pillars — brand, vision, product, ecosystem
const INCLAWBATE_PILLARS = [
    { name: 'Weekly Recap',          emoji: '\u{1F4CA}', needsImage: true,  desc: 'What shipped this week, platform numbers, treasury updates, what\'s coming next' },
    { name: 'Product Highlight',     emoji: '\u{1F4F1}', needsImage: true,  desc: 'Deep dive on one product — PokerAI, staking, app builder, tools, skills marketplace, vaults' },
    { name: 'Builder Story',         emoji: '\u{1F477}', needsImage: false, desc: 'Spotlight a builder, an app they shipped, or a community contribution' },
    { name: 'Brand & Vision',        emoji: '\u{1F30A}', needsImage: true,  desc: 'The perpetual engine, the Telos mission, why Inclawbate exists, DAO governance, long-term vision' },
    { name: 'Education',             emoji: '\u{1F4A1}', needsImage: false, desc: 'How DeFi works, how Inclawbate works, staking explained, yield mechanics, app builder tips' },
    { name: 'Community Engagement',  emoji: '\u{1F525}', needsImage: true,  desc: 'Polls, hot takes, conversation starters, community vibes, human stories' },
    { name: 'Ecosystem Update',      emoji: '\u{1F680}', needsImage: true,  desc: 'CLAWS numbers, growth metrics, treasury, TVL, new milestones, ecosystem revenue' },
];

const INCLAWBATE_SLOT_ANGLES = {
    'Weekly Recap':         ['shipped this week', 'top apps', 'community highlights', 'stats roundup', 'next week preview'],
    'Product Highlight':    ['PokerAI update', 'staking system', 'app builder showcase', 'tools page', 'skills marketplace'],
    'Builder Story':        ['app launch story', 'builder journey', 'community contribution', 'collaboration highlight', 'build challenge'],
    'Brand & Vision':       ['the perpetual engine', 'Telos mission', 'why we build', 'long-term vision', 'manifesto moment'],
    'Education':            ['DeFi basics', 'yield explained', 'staking walkthrough', 'app builder tutorial', 'CLAWS tokenomics'],
    'Community Engagement': ['hot take poll', 'this or that', 'unpopular opinion', 'meme', 'lobster vibes'],
    'Ecosystem Update':     ['treasury update', 'CLAWS numbers', 'TVL growth', 'new milestones', 'partner spotlight'],
};

const INCLAWBATE_STYLE_EXAMPLES = [
    `we don't have employees. we have builders. anyone can build, everyone gets paid.`,
    `inclawbate isn't a company. it's a perpetual engine. generate value, manage it, distribute it. forever.`,
    `staking APY is live. deposit CLAWS, earn yield. no lockup, no tricks. inclawbate.app/stake`,
    `PokerAI had its biggest week yet. more hands played, more rake recycled, more agents learning. the liquidity engine works.`,
    `100+ apps live. all built by regular people using AI. no dev team needed. just an idea and inclawbate.app/build`,
    `the treasury grew again this week. every app, every stake, every poker hand. it all feeds the engine.`,
    `gm. the future of building is typing what you want and hitting enter. inclawbate.app`,
    `no VC. no board. no roadmap decided by people who don't build. just builders and users. that's inclawbate.`,
    // Formatted style (with line breaks)
    `Imagine turning your wildest ideas into full crypto projects... in DAYS.\n\nLaunch an app + token + staking pool - all in ONE platform\n\n@inclawbate makes it happen:\n-Describe your vision\n-AI builds & deploys it\n-You focus on building\n\nStart here inclawbate.app`,
    `the perpetual engine, explained:\n\n1. builders create apps\n2. apps generate revenue\n3. revenue feeds the treasury\n4. treasury rewards builders\n5. repeat forever\n\nno VCs. no exit. just value flowing.\n\ninclawbate.app`,
];

const INCLAWBATE_SCENE_HINTS = {
    'Weekly Recap': 'Growth and momentum. Vary: aerial shot of a flourishing coral reef, golden light breaking through morning clouds, a river flowing through a lush valley, or seeds sprouting in time-lapse.',
    'Product Highlight': 'Creation and craftsmanship. Vary: macro shot of golden threads being woven, light refracting through a crystal, a single perfect bloom opening, or molten glass being shaped.',
    'Builder Story': 'Quiet dedication and craft. Vary: morning light on a workbench with tools, hands shaping clay (no face), a candle burning steady in a workshop, or ink flowing on paper.',
    'Brand & Vision': 'Purpose and stewardship. Vary: golden hour over a vast landscape, a single tree standing strong on a hillside, light pouring through stained glass, or a compass on an old map.',
    'Education': 'Clarity and discovery. Vary: light passing through a prism, a path through a bright forest, water drops creating perfect ripples, or a clean open book with golden light.',
    'Community Engagement': 'Connection and warmth. Vary: golden threads woven into a tapestry, many rivers joining into one, a bonfire at dusk, or warm light seen from many windows of a village.',
    'Ecosystem Update': 'Abundance and stewardship. Vary: an orchard heavy with golden fruit at sunset, a well-organized vault of treasures in warm light, flowing water over smooth stones, or a field of wheat at golden hour.',
};

const INCLAWBATE_NARRATIVE_SCENES = {
    'Weekly Recap': [
        'Aerial photograph of a coral reef teeming with life — vibrant colors, intricate patterns, everything interconnected. Warm turquoise water with golden sunlight filtering down. Abundance, ecosystem health. Fine art photography, 1:1.',
        'Time-lapse style: a row of seedlings at different growth stages, from tiny sprout to full bloom. Warm golden backlight, rich soil, shallow depth of field. Progress made visible. 1:1.',
        'Golden hour light breaking through dramatic clouds over a wide landscape. Rays of light fanning out like progress beams. Vast, hopeful, momentum. Cinematic landscape, 1:1.',
    ],
    'Product Highlight': [
        'Macro photograph of golden threads being woven on a loom — each thread catches the light differently. Craftsmanship, precision, something beautiful being assembled. Warm tones, shallow depth of field, 1:1.',
        'A single perfect water drop hitting a still surface, the moment of impact creating concentric ripples that spread outward. Warm golden lighting from behind. Creation, impact, beginning. 1:1.',
        'Light refracting through a crystal prism, splitting into a warm spectrum of coral, gold, and teal. Clean white surface. Something complex made visible. 1:1.',
    ],
    'Builder Story': [
        'Morning sunlight streaming through a workshop window onto a wooden workbench. Tools organized, sawdust particles floating in the light beams. No person — just the evidence of craft. Warm, quiet, ready. 1:1.',
        'Close-up of a candle flame burning steady and bright in a calm room. Warm amber tones, soft bokeh. Dedication, focus, something that endures. Fine art photography, 1:1.',
        'Ink flowing on handmade paper — organic, flowing, purposeful lines creating something. Close-up macro, warm tones. The act of creation. 1:1.',
    ],
    'Brand & Vision': [
        'Golden hour over a vast mountain landscape — a single winding path visible, leading toward the horizon where light is strongest. Journey, purpose, destination. Cinematic wide, 1:1.',
        'Warm light pouring through stained glass windows, painting colored patterns on a stone floor. Sacred, purposeful, beautiful. Architectural photography, warm tones, 1:1.',
        'A single ancient tree standing strong on a green hillside, golden sunlight behind it. Deep roots implied, wide canopy. Permanence, stewardship, shelter. Fine art landscape, 1:1.',
        'A compass resting on an old map, warm lamplight. Direction, intention, navigation. Still life, warm amber tones, shallow depth of field, 1:1.',
    ],
    'Education': [
        'White light passing through a glass prism, splitting into a clean warm spectrum. Discovery, understanding, clarity. Clean composition, warm tones, 1:1.',
        'A sunlit forest path — dappled light through leaves, clear direction ahead. The way forward is visible. Warm greens and golds, nature photography, 1:1.',
        'A single drop of water on a perfect leaf, magnifying the texture beneath it. Clarity, detail, seeing something new. Macro photography, warm morning light, 1:1.',
    ],
    'Community Engagement': [
        'Many small streams of golden water converging into one flowing river at sunset. Connection, coming together, strength in unity. Aerial photography, warm tones, 1:1.',
        'A bonfire at dusk — warm flames, sparks rising, the golden glow illuminating the surrounding area. Gathering, warmth, belonging. No people visible. Fine art, 1:1.',
        'A hillside village at twilight — warm light glowing from every window. Community visible through warmth, not faces. Cozy, inviting, alive. Landscape photography, 1:1.',
    ],
    'Ecosystem Update': [
        'An orchard heavy with golden fruit at sunset — branches bending with abundance. Warm light, rich colors. The system produces. Fine art photography, 1:1.',
        'Smooth river stones with clear water flowing over them, golden sunlight creating patterns. Flowing, sustainable, clean, managed. Nature macro, warm tones, 1:1.',
        'A vast field of golden wheat at golden hour, stretching to the horizon. Abundance, yield, the harvest. Cinematic landscape, warm, 1:1.',
    ],
};

// Helper: get config for an account
function getAccountConfig(account) {
    if (account === 'inclawbate') {
        return {
            pillars: INCLAWBATE_PILLARS,
            slotAngles: INCLAWBATE_SLOT_ANGLES,
            styleExamples: INCLAWBATE_STYLE_EXAMPLES,
            sceneHints: INCLAWBATE_SCENE_HINTS,
            narrativeScenes: INCLAWBATE_NARRATIVE_SCENES,
            imageContext: INCLAWBATE_IMAGE_CONTEXT,
            identity: `You are @inclawbate, the official company account for Inclawbate — the perpetual value engine built on Base. Mission: Love God, Love Others. You speak as the brand itself. Your voice is confident, visionary, purposeful. You're not an agent or a bot — you're the company.`,
        };
    }
    return {
        pillars: PILLARS,
        slotAngles: SLOT_ANGLES,
        styleExamples: STYLE_EXAMPLES,
        sceneHints: PILLAR_SCENE_HINTS,
        narrativeScenes: NARRATIVE_SCENES,
        imageContext: INCLAWBATOR_IMAGE_CONTEXT,
        identity: `You are @inclawbator, the AI marketing agent for Inclawbate — a Web3 platform on Base where anyone can build apps with AI, launch tokens, and earn. You're a lobster with personality — confident, meme-savvy, crypto-native.`,
    };
}

// Pick a random narrative scene for a pillar
function randomNarrativeScene(pillarName) {
    const scenes = NARRATIVE_SCENES[pillarName];
    if (!scenes || !scenes.length) return '';
    return scenes[Math.floor(Math.random() * scenes.length)];
}

const ALLOWED_ORIGINS = [
    'https://inclawbate.app', 'https://www.inclawbate.app',
    'https://inclawbate.app', 'https://www.inclawbate.app',
    'http://localhost:3000', 'http://localhost:5500',
];

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(204).end();

    // GET — return pillars + drafts for a date
    if (req.method === 'GET') {
        const account = req.query.account || 'inclawbator';
        const cfg = getAccountConfig(account);
        const date = req.query.date;
        if (!date) return res.json({ pillars: cfg.pillars });

        const dayOfWeek = new Date(date + 'T12:00:00Z').getUTCDay();
        const pillar = cfg.pillars[dayOfWeek];

        // Fetch any auto-drafts for this date
        const dayStart = date + 'T00:00:00Z';
        const dayEnd = date + 'T23:59:59Z';
        const { data: drafts } = await supabase
            .from('agent_schedule')
            .select('*')
            .gte('scheduled_at', dayStart)
            .lte('scheduled_at', dayEnd)
            .eq('booked_by_wallet', 'system-autofill')
            .eq('account', account)
            .in('status', ['scheduled', 'needs_review', 'needs_image']);

        return res.json({ pillar, dayOfWeek, drafts: drafts || [] });
    }

    // POST — actions
    if (req.method === 'POST') {
        const { action, date } = req.body || {};

        // ── Public actions (no auth required) ──

        // Generate image prompt from raw tweet text — open to anyone
        if (action === 'generate_image_prompt') {
            const { tweet_text, account: promptAccount, pillar: pillarName } = req.body;
            if (!tweet_text || !tweet_text.trim()) return res.status(400).json({ error: 'tweet_text required' });

            const acct = promptAccount || 'inclawbator';
            const cfg = getAccountConfig(acct);
            const sceneHint = cfg.sceneHints[pillarName] || '';
            const scenes = cfg.narrativeScenes[pillarName] || [];
            const narrativeScene = scenes.length ? scenes[Math.floor(Math.random() * scenes.length)] : '';

            const imgPrompt = `Generate an image prompt for an AI image generator (Midjourney, DALL-E, Flux).

This image accompanies this tweet from @${acct}:
"${tweet_text.trim()}"

${cfg.imageContext}

${sceneHint ? 'BASE SCENE for ' + pillarName + ' (adapt to the tweet above): ' + sceneHint : ''}

${narrativeScene ? 'NARRATIVE INSPIRATION (borrow elements — locations, characters, props, mood — to make the image vivid and unique):\n' + narrativeScene : ''}

IMPORTANT: The image must visually represent what THIS tweet says — not just a generic brand image. Follow the style guide above precisely.

Write ONE image prompt (2-3 sentences) that matches the style guide. Output ONLY the prompt.`;

            try {
                const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_API_KEY },
                    body: JSON.stringify({
                        model: 'llama-3.3-70b-versatile',
                        max_tokens: 300,
                        temperature: 0.9,
                        messages: [{ role: 'user', content: imgPrompt }]
                    })
                });
                const data = await resp.json();
                const prompt = (data.choices?.[0]?.message?.content || '').trim().replace(/^["']|["']$/g, '');
                if (!prompt) return res.status(500).json({ error: 'Failed to generate image prompt' });
                return res.json({ ok: true, image_prompt: prompt });
            } catch(e) {
                return res.status(500).json({ error: 'Image prompt generation failed: ' + e.message });
            }
        }

        // ── Auth check — admin or editor ──
        const authHeader = req.headers.authorization;
        const cronSecret = process.env.CRON_SECRET;
        let isAdmin = false;
        let isEditor = false;

        // Allow cron auth (admin level)
        if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
            isAdmin = true;
        }

        // Check wallet role via JWT
        if (!isAdmin && authHeader?.startsWith('Bearer ')) {
            try {
                const { authenticateRequest } = await import('./x-callback.js');
                const user = authenticateRequest(req);
                if (user && user.sub) {
                    const { data: profile } = await supabase
                        .from('human_profiles')
                        .select('wallet_address')
                        .eq('id', user.sub)
                        .single();
                    const w = profile?.wallet_address?.toLowerCase();
                    if (w && ADMIN_WALLETS.includes(w)) isAdmin = true;
                    else if (w && EDITOR_WALLETS.includes(w)) isEditor = true;
                }
            } catch(e) {}
        }

        if (!isAdmin && !isEditor) return res.status(403).json({ error: 'Admin or editor access required' });

        if (action === 'generate') {
            const account = req.body.account || 'inclawbator';
            const style = req.body.style || 'mixed';
            return await generateDrafts(req, res, date, account, style);
        }

        if (action === 'delete_slot') {
            const { slot_id } = req.body;
            if (!slot_id) return res.status(400).json({ error: 'slot_id required' });
            const { error } = await supabase
                .from('agent_schedule')
                .delete()
                .eq('id', slot_id);
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ ok: true });
        }

        if (action === 'approve') {
            if (!isAdmin) return res.status(403).json({ error: 'Only admin can approve tweets' });
            const { slot_id } = req.body;
            const { error } = await supabase
                .from('agent_schedule')
                .update({ status: 'scheduled' })
                .eq('id', slot_id);
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ ok: true });
        }

        if (action === 'update_draft') {
            const { slot_id, tweet_text, status, image_prompt, thread_parts } = req.body;
            const updates = {};
            if (tweet_text !== undefined) updates.tweet_text = tweet_text;
            if (status) updates.status = status;

            // If image_prompt or thread_parts provided, merge into tweet_options
            if (image_prompt || thread_parts !== undefined) {
                const { data: existing } = await supabase
                    .from('agent_schedule')
                    .select('tweet_options')
                    .eq('id', slot_id)
                    .single();
                const opts = existing?.tweet_options || {};
                if (image_prompt) opts.image_prompt = image_prompt;
                if (thread_parts !== undefined) {
                    opts.thread_parts = Array.isArray(thread_parts) ? thread_parts.filter(t => t && t.trim()) : [];
                }
                updates.tweet_options = opts;
            }

            const { error } = await supabase
                .from('agent_schedule')
                .update(updates)
                .eq('id', slot_id);
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ ok: true });
        }

        if (action === 'set_image') {
            const { slot_id, image_url } = req.body;
            if (!slot_id) return res.status(400).json({ error: 'slot_id required' });
            // Store or remove image URL in tweet_options
            const { data: slot } = await supabase
                .from('agent_schedule')
                .select('tweet_options, status')
                .eq('id', slot_id)
                .single();
            const opts = slot?.tweet_options || {};
            if (image_url) {
                opts.image_url = image_url;
            } else {
                delete opts.image_url;
            }
            const newStatus = image_url
                ? (slot?.status === 'needs_image' ? 'needs_review' : slot?.status)
                : 'needs_image';
            const { error } = await supabase
                .from('agent_schedule')
                .update({ tweet_options: opts, status: newStatus })
                .eq('id', slot_id);
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ ok: true, status: newStatus });
        }

        if (action === 'regenerate_slot') {
            const { slot_id, style: regenStyle } = req.body;
            if (!slot_id) return res.status(400).json({ error: 'slot_id required' });

            // Get the existing slot
            const { data: slot } = await supabase
                .from('agent_schedule')
                .select('*')
                .eq('id', slot_id)
                .single();
            if (!slot) return res.status(404).json({ error: 'Slot not found' });

            const slotAccount = slot.account || 'inclawbator';
            const cfg = getAccountConfig(slotAccount);
            const opts = slot.tweet_options || {};
            const pillarName = opts.pillar || (slotAccount === 'inclawbate' ? 'Ecosystem Update' : 'Incubation CTA');
            const angle = opts.angle || 'general';
            const pillar = cfg.pillars.find(p => p.name === pillarName) || cfg.pillars[cfg.pillars.length - 1];
            const oldTweet = slot.tweet_text || '';

            // Fetch sibling tweets for this day to avoid repetition
            const slotDate = new Date(slot.scheduled_at);
            const dayStart = slotDate.toISOString().split('T')[0] + 'T00:00:00Z';
            const dayEnd = new Date(new Date(dayStart).getTime() + 86400000).toISOString();
            const { data: siblings } = await supabase
                .from('agent_schedule')
                .select('tweet_text')
                .gte('scheduled_at', dayStart)
                .lt('scheduled_at', dayEnd)
                .eq('account', slotAccount)
                .neq('id', slot_id)
                .in('status', ['scheduled', 'needs_review', 'needs_image']);
            const siblingTexts = (siblings || []).map(s => s.tweet_text).filter(Boolean);

            // Fetch real platform context
            const ctx = await fetchPlatformContext();
            const topAppList = ctx.topApps.map(a => `${a.name} (${a.view_count || 0} views)`).join(', ');
            const recentAppList = ctx.recentApps.slice(0, 8).map(a => a.name).join(', ');
            const sceneHint = cfg.sceneHints[pillar.name] || '';
            const narrativeScene = (cfg.narrativeScenes[pillar.name] || [])[Math.floor(Math.random() * (cfg.narrativeScenes[pillar.name] || ['']).length)] || '';

            // Pick style — use stored style, passed style, or random
            const chosenStyle = regenStyle || opts.style || ['mixed', 'punchy', 'formatted', 'engagement'][Math.floor(Math.random() * 4)];
            const styleGuide = STYLE_INSTRUCTIONS[chosenStyle] || '';

            // Pick random style examples
            const shuffled = [...cfg.styleExamples].sort(() => Math.random() - 0.5);
            const exampleBlock = shuffled.slice(0, 3).map((e, i) => `${i + 1}. "${e}"`).join('\n');

            const prompt = `${cfg.identity}

Generate ONE tweet that is COMPLETELY DIFFERENT from the rejected version below.

REJECTED (DO NOT write anything similar to this):
"${oldTweet}"

${siblingTexts.length ? 'OTHER TWEETS TODAY (do NOT repeat these ideas or phrasings):\n' + siblingTexts.map(t => '- "' + t.slice(0, 100) + '"').join('\n') + '\n' : ''}

Pillar: ${pillar.name} — ${pillar.desc}
Angle: ${angle}

Real data (use ONLY these numbers):
- ${ctx.totalApps}+ apps on inclawbate
- Popular apps: ${topAppList || '(not available — do NOT reference specific apps)'}
- Recent apps: ${recentAppList || '(not available — do NOT reference specific apps)'}
${ctx.claws ? `- $CLAWS price: $${ctx.claws.price} (24h: ${ctx.claws.change24h > 0 ? '+' : ''}${ctx.claws.change24h.toFixed(1)}%, ${ctx.claws.direction.toUpperCase()})${ctx.claws.volume24h >= 5000 ? `\n- $CLAWS 24h volume: $${ctx.claws.volume24h >= 1000 ? (ctx.claws.volume24h/1000).toFixed(1) + 'k' : ctx.claws.volume24h.toFixed(0)}` : '\n- $CLAWS volume: LOW — do NOT mention volume'}${ctx.claws.marketCap >= 50000 ? `\n- $CLAWS mcap: $${ctx.claws.marketCap >= 1000000 ? (ctx.claws.marketCap/1000000).toFixed(2) + 'M' : (ctx.claws.marketCap/1000).toFixed(0) + 'k'}` : ''}
- If price is DOWN/FLAT, do NOT say "price is up" or imply pumping. Use EXACT numbers — do NOT inflate.` : '- Token: $CLAWS on Base (no live price data — do NOT mention price direction)'}
${ECOSYSTEM_LINKS}

TIME OF DAY: This tweet posts at ${getTimeOfDay(slotDate.getUTCHours())}.
${getGreetingRule(slotDate.getUTCHours())}

STYLE EXAMPLES (match this vibe):
${exampleBlock}

${styleGuide ? styleGuide + '\n' : ''}

RULES:
- Under 280 characters preferred (STRICT — \\n line breaks count as 1 char each). Max 4000 chars for long-form.
- MUST be completely different from the rejected tweet — different angle, different structure, different words
- No hashtags, no corporate speak, no em dashes
- No @mentions, no names
- Lowercase preferred, crypto-native casual tone
- Can use \\n for line breaks if doing a formatted/structured tweet
- NEVER use vague filler like "various" or "popular ones"
- NEVER say "price is up" or "pumping" unless the data above shows positive 24h change. If price is DOWN, focus on building/fundamentals/community. NEVER fabricate market claims.

IMAGE PROMPT:
${cfg.imageContext}

Output format:
TWEET: [the tweet]
IMAGE: [2-3 sentences following the style guide above. Be specific and visual. 1:1]`;

            try {
                const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_API_KEY },
                    body: JSON.stringify({
                        model: 'llama-3.3-70b-versatile',
                        max_tokens: 800,
                        temperature: 1.0,
                        messages: [{ role: 'user', content: prompt }]
                    })
                });
                const data = await resp.json();
                const raw = (data.choices?.[0]?.message?.content || '').trim();
                // Multiline TWEET capture (up to IMAGE:)
                const tweetMatch = raw.match(/TWEET:\s*([\s\S]*?)(?=\nIMAGE:|\n*$)/i);
                const imageMatch = raw.match(/IMAGE:\s*(.+)/i);
                let tweetText = tweetMatch ? tweetMatch[1].replace(/^["']|["']$/g, '').trim() : raw.replace(/^["']|["']$/g, '').replace(/^\d+[\.\)]\s*/, '').trim();
                // Convert literal \n to actual newlines
                tweetText = tweetText.replace(/\\n/g, '\n').replace(/\n{3,}/g, '\n\n');
                const imagePrompt = imageMatch ? imageMatch[1].replace(/^["']|["']$/g, '').trim() : '';

                if (!tweetText || tweetText.length > 4000) {
                    return res.status(500).json({ error: 'Generated tweet invalid or too long' });
                }

                const newStatus = pillar.needsImage ? 'needs_image' : 'needs_review';
                const newOpts = { ...opts, image_prompt: imagePrompt, style: chosenStyle };
                const { data: updated, error } = await supabase
                    .from('agent_schedule')
                    .update({ tweet_text: tweetText, status: newStatus, tweet_options: newOpts })
                    .eq('id', slot_id)
                    .select()
                    .single();

                if (error) return res.status(500).json({ error: error.message });
                return res.json({ ok: true, slot: updated });
            } catch(e) {
                return res.status(500).json({ error: 'Regeneration failed: ' + e.message });
            }
        }

        if (action === 'regen_image_prompt') {
            const { slot_id } = req.body;
            if (!slot_id) return res.status(400).json({ error: 'slot_id required' });

            const { data: slot } = await supabase
                .from('agent_schedule')
                .select('*')
                .eq('id', slot_id)
                .single();
            if (!slot) return res.status(404).json({ error: 'Slot not found' });

            const slotAccount = slot.account || 'inclawbator';
            const cfg = getAccountConfig(slotAccount);
            const tweetText = slot.tweet_text || '';
            const opts = slot.tweet_options || {};
            const pillarName = opts.pillar || '';
            const sceneHint = cfg.sceneHints[pillarName] || '';
            const narrativeScene = (cfg.narrativeScenes[pillarName] || [])[Math.floor(Math.random() * (cfg.narrativeScenes[pillarName] || ['']).length)] || '';
            const imgPrompt = `Generate an image prompt for an AI image generator (Midjourney, DALL-E, Flux).

This image MUST visually illustrate this specific tweet from @${slotAccount}:
"${tweetText}"

${cfg.imageContext}

${sceneHint ? 'BASE SCENE for ' + pillarName + ' (adapt to the tweet): ' + sceneHint : ''}

${narrativeScene ? 'NARRATIVE INSPIRATION (borrow elements):\n' + narrativeScene : ''}

STEP BY STEP:
1. Read the tweet above. What is the KEY SUBJECT? (staking? building? a specific app? community? treasury? philanthropy?)
2. What visual scene matches the style guide AND illustrates this subject?
3. What SPECIFIC VISUAL DETAILS from the tweet should appear in the scene?

Write ONE image prompt (2-3 sentences) that follows the style guide above precisely. The prompt must SPECIFICALLY relate to what the tweet says.

Output ONLY the prompt, nothing else.`;

            try {
                const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_API_KEY },
                    body: JSON.stringify({
                        model: 'llama-3.3-70b-versatile',
                        max_tokens: 300,
                        temperature: 0.95,
                        messages: [{ role: 'user', content: imgPrompt }]
                    })
                });
                const data = await resp.json();
                const newPrompt = (data.choices?.[0]?.message?.content || '').trim().replace(/^["']|["']$/g, '');
                if (!newPrompt) return res.status(500).json({ error: 'Failed to generate image prompt' });

                const opts = slot.tweet_options || {};
                opts.image_prompt = newPrompt;
                const { error } = await supabase
                    .from('agent_schedule')
                    .update({ tweet_options: opts })
                    .eq('id', slot_id);
                if (error) return res.status(500).json({ error: error.message });
                return res.json({ ok: true, image_prompt: newPrompt });
            } catch(e) {
                return res.status(500).json({ error: 'Image prompt generation failed: ' + e.message });
            }
        }

        if (action === 'approve_all') {
            if (!isAdmin) return res.status(403).json({ error: 'Only admin can approve tweets' });
            const { date: approveDate, account: approveAccount } = req.body;
            if (!approveDate) return res.status(400).json({ error: 'date required' });
            const dayStart = approveDate + 'T00:00:00Z';
            const nextDay = new Date(new Date(dayStart).getTime() + 2 * 86400000).toISOString();
            const { data: updated, error } = await supabase
                .from('agent_schedule')
                .update({ status: 'scheduled' })
                .eq('account', approveAccount || 'inclawbator')
                .in('status', ['needs_review', 'needs_image'])
                .gte('scheduled_at', dayStart)
                .lt('scheduled_at', nextDay)
                .select('id');
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ ok: true, approved: (updated || []).length });
        }

        // ── Post Now — immediately post a scheduled slot ──
        if (action === 'post_now') {
            if (!isAdmin) return res.status(403).json({ error: 'Only admin can post immediately' });
            const { slot_id } = req.body;
            if (!slot_id) return res.status(400).json({ error: 'slot_id required' });

            const { data: slot } = await supabase
                .from('agent_schedule')
                .select('*')
                .eq('id', slot_id)
                .single();
            if (!slot) return res.status(404).json({ error: 'Slot not found' });
            if (slot.status === 'posted') return res.status(400).json({ error: 'Already posted' });
            if (!slot.tweet_text) return res.status(400).json({ error: 'Slot has no tweet text' });

            try {
                const slotAccount = slot.account || 'inclawbator';
                const slotOpts = slot.tweet_options || {};

                // Upload image if present
                let mediaIds = null;
                if (slotOpts.image_url) {
                    try {
                        const mediaId = await uploadMediaToX(slotOpts.image_url, slotAccount);
                        mediaIds = [mediaId];
                    } catch(imgErr) {
                        // Continue without image
                    }
                }

                // Post via shared account (with thread support)
                const threadParts = (slotOpts.thread_parts || []).filter(t => t && t.trim());
                const tweetId = await postTweetShared(slot.tweet_text, mediaIds, slotAccount, threadParts);

                // Mark as posted
                await supabase
                    .from('agent_schedule')
                    .update({ status: 'posted', tweet_id: tweetId })
                    .eq('id', slot_id);

                const handle = slotAccount === 'inclawbate' ? 'inclawbate' : 'inclawbator';
                return res.json({
                    ok: true,
                    tweet_id: tweetId,
                    tweet_url: tweetId ? `https://x.com/${handle}/status/${tweetId}` : null
                });
            } catch(e) {
                return res.status(500).json({ error: 'Post failed: ' + e.message });
            }
        }

        return res.status(400).json({ error: 'Unknown action' });
    }

    res.status(405).json({ error: 'Method not allowed' });
}

// ── OAuth 1.0a signing for X API ──

function buildOAuth1Header(method, url, extraParams, account) {
    const prefix = account === 'inclawbate' ? 'INCLAWBATE' : 'INCLAWBATOR';
    const X_API_KEY = process.env[prefix + '_X_API_KEY'] || process.env.INCLAWBATOR_X_API_KEY;
    const X_API_SECRET = process.env[prefix + '_X_API_SECRET'] || process.env.INCLAWBATOR_X_API_SECRET;
    const X_ACCESS_TOKEN = process.env[prefix + '_X_ACCESS_TOKEN'];
    const X_ACCESS_SECRET = process.env[prefix + '_X_ACCESS_SECRET'];
    if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) {
        throw new Error(prefix + ' X API credentials not configured');
    }

    const oauth = {
        oauth_consumer_key: X_API_KEY,
        oauth_nonce: crypto.randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_token: X_ACCESS_TOKEN,
        oauth_version: '1.0',
        ...extraParams
    };

    const paramString = Object.keys(oauth).sort()
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauth[k])}`).join('&');
    const signatureBase = [method, encodeURIComponent(url), encodeURIComponent(paramString)].join('&');
    const signingKey = `${encodeURIComponent(X_API_SECRET)}&${encodeURIComponent(X_ACCESS_SECRET)}`;
    const signature = crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');
    oauth.oauth_signature = signature;

    const headerParams = Object.keys(oauth).filter(k => k.startsWith('oauth_')).sort();
    return 'OAuth ' + headerParams.map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauth[k])}"`).join(', ');
}

async function uploadMediaToX(imageUrl, account) {
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) throw new Error('Failed to download image: ' + imgResp.status);
    const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
    const base64Data = imgBuffer.toString('base64');
    const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';
    const authHeader = buildOAuth1Header('POST', uploadUrl, {}, account);
    const body = new URLSearchParams();
    body.append('media_data', base64Data);
    const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
    });
    const data = await response.json();
    if (!response.ok) throw new Error('Media upload failed: ' + (data.error || JSON.stringify(data.errors || data)));
    return data.media_id_string;
}

async function postTweetShared(text, mediaIds, account, threadParts) {
    const url = 'https://api.twitter.com/2/tweets';
    const authHeader = buildOAuth1Header('POST', url, {}, account);
    const payload = { text };
    if (mediaIds && mediaIds.length > 0) payload.media = { media_ids: mediaIds };
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || data.title || 'X API post failed');
    const firstTweetId = data.data?.id || null;

    // Post thread replies if present
    if (firstTweetId && threadParts && threadParts.length > 0) {
        let prevId = firstTweetId;
        for (const part of threadParts) {
            if (!part || !part.trim()) continue;
            await new Promise(r => setTimeout(r, 500)); // small delay between thread tweets
            const replyAuth = buildOAuth1Header('POST', url, {}, account);
            const replyPayload = { text: part.trim(), reply: { in_reply_to_tweet_id: prevId } };
            const replyResp = await fetch(url, {
                method: 'POST',
                headers: { 'Authorization': replyAuth, 'Content-Type': 'application/json' },
                body: JSON.stringify(replyPayload)
            });
            const replyData = await replyResp.json();
            if (replyResp.ok && replyData.data?.id) {
                prevId = replyData.data.id;
            }
        }
    }

    return firstTweetId;
}

// Tweet format examples — teach the AI what good @inclawbator tweets look like
const STYLE_EXAMPLES = [
    // Short punchy
    `someone just built a full staking dashboard on inclawbate in 10 minutes. no code. just vibes.`,
    // Question hook
    `what if you could launch a token, build an app for it, and set up marketing... all from one platform? that's inclawbate`,
    // Builder shoutout (no names)
    `a full social network just went live on inclawbate. built entirely with AI. no code. this is the future.`,
    // Stats flex
    `100+ apps live on inclawbate rn. all built by regular people using AI. no devs needed.`,
    // FOMO/CTA
    `we're taking on new builds at inclawbate. you bring the idea, we bring the AI. spots filling up. inclawbate.app`,
    // One-liner
    `gm. the future of app development is typing what you want and hitting enter.`,
    // Degen energy
    `ser the app store of the future is being built on base and it's called inclawbate. not alpha, just facts.`,
    // Thread-starter style
    `built ClawCard in weeks, not months. inclawbate handled the code while i focused on the product. if you're sitting on an idea, stop waiting.`,
    // Formatted with line breaks
    `what inclawbate actually does:\n\n-you describe an app idea\n-AI builds it in minutes\n-it's live instantly with a real URL\n-you earn from it\n\nno code. no waiting. no gatekeepers.\n\ntry it: inclawbate.app/build`,
    `the app store of the future isn't controlled by Apple or Google.\n\nit's built by regular people.\nwith AI.\non-chain.\n\n100+ apps live. growing daily.\n\ninclawbate.app`,
];

// Fetch real platform stats for accurate content
async function fetchPlatformContext() {
    const results = { totalApps: 0, recentApps: [], builders: [], topApps: [], claws: null };

    const [appsRes, countRes, buildersRes, profilesRes, clawsRes] = await Promise.allSettled([
        supabase.from('user_apps')
            .select('name, slug, category, upvote_count, view_count, creator_x_handle, creator_wallet')
            .eq('is_public', true)
            .order('created_at', { ascending: false })
            .limit(20),
        supabase.from('user_apps')
            .select('*', { count: 'exact', head: true })
            .eq('is_public', true),
        supabase.from('user_apps')
            .select('creator_x_handle, creator_wallet')
            .eq('is_public', true)
            .not('creator_x_handle', 'is', null),
        // Fetch current x_handles from human_profiles (source of truth)
        supabase.from('human_profiles')
            .select('wallet_address, x_handle')
            .not('x_handle', 'is', null),
        // Fetch live CLAWS token data from DexScreener
        fetch('https://api.dexscreener.com/latest/dex/tokens/0x7ca47B141639B893C6782823C0b219f872056379')
            .then(r => r.json())
            .catch(() => null),
    ]);

    // Build wallet → current x_handle mapping from profiles
    const walletToHandle = {};
    if (profilesRes.status === 'fulfilled') {
        (profilesRes.value.data || []).forEach(p => {
            if (p.wallet_address && p.x_handle) {
                walletToHandle[p.wallet_address.toLowerCase()] = p.x_handle;
            }
        });
    }

    // Helper: get the most current handle for an app
    // Skip wallet-derived placeholders (w_ + 12 hex chars)
    const isPlaceholder = h => /^w_[0-9a-f]{12}$/.test(h);
    function currentHandle(app) {
        if (app.creator_wallet) {
            const fresh = walletToHandle[app.creator_wallet.toLowerCase()];
            if (fresh && !isPlaceholder(fresh)) return fresh;
        }
        const fallback = app.creator_x_handle;
        if (fallback && !isPlaceholder(fallback)) return fallback;
        return null;
    }

    if (countRes.status === 'fulfilled') results.totalApps = countRes.value.count || 0;
    if (appsRes.status === 'fulfilled') {
        const apps = (appsRes.value.data || []).map(a => ({ ...a, creator_x_handle: currentHandle(a) }));
        results.recentApps = apps.slice(0, 15);
        results.topApps = [...apps]
            .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
            .slice(0, 5);
    }
    if (buildersRes.status === 'fulfilled') {
        const handles = {};
        (buildersRes.value.data || []).forEach(a => {
            const handle = currentHandle(a);
            if (handle) handles[handle] = (handles[handle] || 0) + 1;
        });
        results.builders = Object.entries(handles)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([handle, count]) => ({ handle, apps: count }));
    }

    // Parse live CLAWS token data
    if (clawsRes.status === 'fulfilled' && clawsRes.value) {
        const dex = clawsRes.value;
        const pair = dex.pairs?.[0];
        if (pair) {
            const change24h = parseFloat(pair.priceChange?.h24 || 0);
            results.claws = {
                price: pair.priceUsd || '0',
                change24h,
                direction: change24h > 2 ? 'up' : change24h < -2 ? 'down' : 'flat',
                volume24h: parseFloat(pair.volume?.h24 || 0),
                liquidity: parseFloat(pair.liquidity?.usd || 0),
                marketCap: parseFloat(pair.marketCap || pair.fdv || 0),
            };
        }
    }

    return results;
}

// Style-specific instructions for tweet generation
const STYLE_INSTRUCTIONS = {
    mixed: `FORMAT VARIETY (CRITICAL — follow this distribution):
- 1-2 tweets: SHORT one-liners (under 100 chars). Punchy, meme energy. Example: "gm. the future of app development is typing what you want and hitting enter."
- 1-2 tweets: MEDIUM length (100-180 chars). Hook + detail. Example: "someone just built a full staking dashboard on inclawbate in 10 minutes. no code. just vibes."
- 1-2 tweets: LONG FORMATTED (200-500 chars) with LINE BREAKS (\\n). Use bullet points (-), numbered lists, or stacked lines for visual impact. Include a CTA at the end. Example:
"what inclawbate actually does:\\n\\n-you describe an app idea\\n-AI builds it in minutes\\n-it's live instantly\\n-you earn from it\\n\\nno code. no waiting.\\n\\ninclawbate.app/build"

IMPORTANT: The long formatted tweets MUST use \\n for line breaks. They should look like structured posts with clear visual hierarchy. Vary which slots get which format.`,

    punchy: `FORMAT: ALL tweets must be SHORT one-liners (under 120 chars preferred).
- Meme energy, degen vibes, hot takes
- One strong thought per tweet
- No line breaks needed
- Examples: "gm. the future is typing what you want and hitting enter." / "100+ apps. zero devs needed. inclawbate."`,

    formatted: `FORMAT: ALL tweets must be LONG FORMATTED posts (200-500 chars) with LINE BREAKS (\\n).
- Use \\n for line breaks between sections
- Use bullet points (-) or numbered lists for structure
- Include a hook/opener, body content, and a CTA/closer
- Visual hierarchy matters — make it scannable
- Example:
"the perpetual engine, explained:\\n\\n1. builders create apps\\n2. apps generate revenue\\n3. revenue feeds the treasury\\n4. treasury rewards builders\\n5. repeat forever\\n\\nno VCs. no exit.\\n\\ninclawbate.app"

CRITICAL: Every tweet MUST have multiple \\n line breaks. No single-line tweets.`,

    engagement: `FORMAT: ALL tweets must be ENGAGEMENT-focused — designed to get replies and quote tweets.
- Ask a direct question to the audience
- Use "this or that" / "hot take" / "unpopular opinion" formats
- Controversial but fun takes about building, DeFi, crypto
- End with something that begs for a response
- Can be short OR formatted — vary it
- Examples: "hot take: 90% of crypto projects would ship faster if they used AI to build instead of hiring devs. agree or disagree?" / "what's the one app you wish existed in crypto?\\n\\nwe'll build the best one live.\\n\\nseriously — drop it below."`,
};

async function generateDrafts(req, res, targetDate, account, style) {
    account = account || 'inclawbator';
    const cfg = getAccountConfig(account);
    const date = targetDate || new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const dayOfWeek = new Date(date + 'T12:00:00Z').getUTCDay();
    const pillar = cfg.pillars[dayOfWeek];
    const angles = cfg.slotAngles[pillar.name] || ['general'];

    // Check which slots are already booked
    // Range: 06:00 UTC (skip previous day's Night slot at hour 1) to next day 06:00 UTC
    // This covers today's slots at hours 13,16,19,22 + today's Night slot at next-day hour 1
    const dayStart = date + 'T06:00:00Z';
    const rangeEnd = new Date(new Date(date + 'T00:00:00Z').getTime() + 86400000 + 6 * 3600000).toISOString();
    const { data: existing } = await supabase
        .from('agent_schedule')
        .select('scheduled_at, status')
        .gte('scheduled_at', dayStart)
        .lt('scheduled_at', rangeEnd)
        .eq('account', account)
        .in('status', ['scheduled', 'posted', 'needs_review', 'needs_image']);

    const bookedHours = new Set((existing || []).map(s => new Date(s.scheduled_at).getUTCHours()));
    const emptyHours = VALID_HOURS.filter(h => !bookedHours.has(h));
    if (!emptyHours.length) {
        return res.json({ message: 'All slots filled', date, pillar: pillar.name });
    }

    // Fetch real platform data
    const ctx = await fetchPlatformContext();

    const recentAppList = ctx.recentApps.map(a =>
        `${a.name} (${a.category || 'general'})`
    ).join(', ');

    const topAppList = ctx.topApps.map(a =>
        `${a.name} (${a.view_count || 0} views)`
    ).join(', ');

    // Build live CLAWS data block — only include metrics worth tweeting about
    let clawsDataBlock = '- Token: $CLAWS on Base (no live price data available — do NOT mention price, volume, or market numbers)';
    if (ctx.claws) {
        const c = ctx.claws;
        const dirLabel = c.direction === 'up' ? 'UP' : c.direction === 'down' ? 'DOWN' : 'FLAT/SIDEWAYS';
        // Format numbers with proper labels to prevent AI inflation
        const fmtUsd = (n) => n >= 1000000 ? `$${(n/1000000).toFixed(2)}M` : n >= 1000 ? `$${(n/1000).toFixed(1)}k` : `$${n.toFixed(2)}`;
        let lines = [`- $CLAWS LIVE DATA (from DexScreener — these are the EXACT real numbers):`];
        lines.push(`  - Price: $${c.price}`);
        lines.push(`  - 24h price change: ${c.change24h > 0 ? '+' : ''}${c.change24h.toFixed(1)}% — price is ${dirLabel}`);
        // Only include volume if meaningful (>$5k)
        if (c.volume24h >= 5000) lines.push(`  - 24h volume: ${fmtUsd(c.volume24h)}`);
        else lines.push(`  - 24h volume: LOW (do NOT mention volume in tweets)`);
        // Only include liquidity if meaningful (>$10k)
        if (c.liquidity >= 10000) lines.push(`  - Liquidity: ${fmtUsd(c.liquidity)}`);
        // Only include mcap if meaningful (>$50k)
        if (c.marketCap >= 50000) lines.push(`  - Market cap: ${fmtUsd(c.marketCap)}`);
        lines.push(`  - PRICE IS ${dirLabel}. If DOWN or FLAT, do NOT say "price is up" or imply pumping. Focus on building, shipping, fundamentals instead.`);
        lines.push(`  - USE THESE EXACT NUMBERS. Do NOT round up, do NOT add "k" or "M" unless the number above already has it. $317 is three hundred seventeen dollars, NOT $317k.`);
        clawsDataBlock = lines.join('\n');
    }

    // Pick random style examples for variety
    const shuffled = [...cfg.styleExamples].sort(() => Math.random() - 0.5);
    const exampleBlock = shuffled.slice(0, 5).map((e, i) => `${i + 1}. "${e}"`).join('\n');
    const sceneHint = cfg.sceneHints[pillar.name] || 'Use the brand mascot in a relevant pose for the content.';
    const narrativeScenesList = (cfg.narrativeScenes[pillar.name] || []).join('\n- ');
    const styleGuide = STYLE_INSTRUCTIONS[style] || STYLE_INSTRUCTIONS.mixed;

    // Generate ALL tweets in one batch call for consistency + speed
    const batchPrompt = `${cfg.identity}

REAL PLATFORM DATA (use these exact numbers, do NOT make up stats):
- Total apps: ${ctx.totalApps}+
- Popular apps: ${topAppList || '(not available — do NOT reference specific apps, talk about the platform generally)'}
- Recent apps: ${recentAppList || '(not available — do NOT reference specific apps, talk about the platform generally)'}
${clawsDataBlock}
${ECOSYSTEM_LINKS}

TODAY'S PILLAR: ${pillar.name}
Description: ${pillar.desc}

STYLE EXAMPLES (match this vibe — crypto-native, authentic, no corporate speak):
${exampleBlock}

${styleGuide}

RULES:
- Each tweet should be under 280 characters for maximum engagement (up to 4000 allowed for long-form)
- No hashtags ever
- No "excited to announce", "thrilled", "game-changing", or any corporate speak
- No em dashes (—)
- No quotation marks around the tweet
- Lowercase is fine, even preferred for casual tweets
- NEVER mention any person's name, handle, or username. No @mentions, no names, no shoutouts. Talk about the platform, apps, and what's possible — not individuals.
- NEVER use vague filler like "various", "popular ones", "top apps" without naming them. Either use specific app names from the data above, or don't mention apps at all. Be concrete or be general about the platform — never vaguely in between.
- When citing numbers, use ONLY the real stats provided — NEVER invent numbers
- Vary which ecosystem links you include — match the link to the tweet topic, don't always default to inclawbate.app
- Each tweet should feel DIFFERENT from the others — vary tone and structure
- TIME-AWARE GREETINGS: Each slot has a post time listed above. "gm" is ONLY for the 9 AM ET slot. Do NOT use "gm" or "good morning" for afternoon/evening/night slots. Use "gn" for night if you want a greeting, or just skip greetings entirely.

CRITICAL — NO FALSE CLAIMS:
- NEVER say "price is up", "pumping", "mooning", "bullish" unless the 24h change data above is actually positive
- NEVER say "staking yields are fire" or imply high APY unless real APY data is provided and actually high
- If price is DOWN, you can: talk about building during dips, focus on fundamentals, highlight what's shipping, or simply avoid mentioning price
- If price is FLAT, talk about stability, accumulation, or focus on product/community instead
- NEVER fabricate any metric. If you don't have the data, don't reference it. Talk about what you DO know (apps, tools, building, community)
- When in doubt, focus on what the platform DOES (builds apps, incubates projects, tools) rather than making market claims

Generate ${emptyHours.length} tweets. For EACH tweet, you MUST write a matching image prompt.

IMAGE PROMPTS — THIS IS THE MOST IMPORTANT PART:
${cfg.imageContext}

${account === 'inclawbate' ? `EXAMPLES of tweet → image connection:
- Tweet "108 apps and counting" → "Aerial photograph of a vast coral reef teeming with colorful life — hundreds of unique formations, each one different. Warm turquoise water with golden sunlight filtering down from above. Abundance, interconnection, ecosystem health. Fine art photography, 1:1"
- Tweet "staking rewards are real" → "Golden wheat field stretching to the horizon at golden hour, heavy with grain. Warm amber light, gentle breeze visible in the stalks. The harvest is real, the yield is tangible. Cinematic landscape, 1:1"
- Tweet "which app would you build first" → "Two diverging paths in a sunlit forest, each dappled with different colored light — one golden, one teal. Wildflowers along both. Choice, possibility, both paths beautiful. Nature photography, warm tones, 1:1"

Each image MUST look different — vary subjects, compositions, and metaphors. NO humans, NO mascot. Abstract, warm, conceptual.` : `EXAMPLES of tweet → image connection:
- Tweet "108 apps and counting" → "The 3D coral-red lobster floating in a vast dark space, surrounded by over a hundred tiny glowing app interface screens arranged in a spiral galaxy pattern. The lobster spreads its claws wide in amazement. Bird's eye camera angle, teal and coral neon reflections, cinematic 3D render, 1:1"
- Tweet "staking rewards are real" → "Close-up of the coral-red 3D lobster sitting cross-legged on a floating crystal platform, eyes closed peacefully. Dozens of gold coins orbit around it in slow rings. Soft green upward arrows in background. Warm golden lighting, dark void, 3D render, 1:1"
- Tweet "which app would you build first" → "The coral-red 3D lobster at a crossroads in a dark neon environment, each path lit by a different color. One claw points left, the other right. Floating app icons hover above each path. Dramatic teal and coral split lighting, cinematic 3D render, 1:1"

Each image MUST look different — vary pose, environment, camera angle, and lighting. The 3D lobster mascot is ALWAYS the focal point.`}

${emptyHours.map((h, i) => `${i + 1}. Angle: "${angles[i % angles.length]}" — Posts at ${getTimeOfDay(h)}. ${getGreetingRule(h)}`).join('\n')}

Format each entry as:
TWEET: [the tweet text]
IMAGE: [2-3 sentences following the style guide above. Be specific and visual. 1:1]

Output ONLY the numbered entries. Nothing else.`;

    try {
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + GROQ_API_KEY
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                max_tokens: 4000,
                temperature: style === 'punchy' ? 1.0 : 0.9,
                messages: [{ role: 'user', content: batchPrompt }]
            })
        });
        const data = await resp.json();

        if (data.error) {
            return res.status(500).json({ error: 'AI generation failed: ' + (data.error.message || data.error) });
        }

        const rawText = data.choices?.[0]?.message?.content || '';
        // Parse TWEET/IMAGE pairs from batch response
        // Supports multi-line tweets with \n line breaks
        const entries = [];
        const blocks = rawText.split(/\n*\d+[\.\)]\s*/);
        for (const block of blocks) {
            // Match TWEET: ... up to IMAGE: (multiline capture)
            const tweetMatch = block.match(/TWEET:\s*([\s\S]*?)(?=\nIMAGE:|\n*$)/i);
            const imageMatch = block.match(/IMAGE:\s*(.+)/i);
            if (tweetMatch) {
                let tweet = tweetMatch[1].replace(/^["']|["']$/g, '').trim();
                // Convert literal \n in AI output to actual newlines
                tweet = tweet.replace(/\\n/g, '\n');
                // Clean up excessive blank lines (3+ newlines → 2)
                tweet = tweet.replace(/\n{3,}/g, '\n\n');
                const imagePrompt = imageMatch ? imageMatch[1].replace(/^["']|["']$/g, '').trim() : '';
                if (tweet.length > 0 && tweet.length <= 4000) {
                    entries.push({ tweet, imagePrompt });
                }
            }
        }
        // Fallback: if parsing failed, try line-by-line (old format)
        if (entries.length === 0) {
            rawText.split('\n')
                .map(l => l.replace(/^\d+[\.\)]\s*/, '').replace(/^["']|["']$/g, '').replace(/^TWEET:\s*/i, '').trim())
                .filter(l => l.length > 0 && l.length <= 4000 && !/^IMAGE:/i.test(l))
                .forEach(t => entries.push({ tweet: t, imagePrompt: '' }));
        }

        const drafts = [];
        for (let i = 0; i < emptyHours.length && i < entries.length; i++) {
            const hour = emptyHours[i];
            const angle = angles[i % angles.length];
            const tweetText = entries[i].tweet;
            const imagePrompt = entries[i].imagePrompt;

            const slotTime = new Date(date + 'T00:00:00Z');
            if (hour < 6) slotTime.setDate(slotTime.getDate() + 1);
            slotTime.setUTCHours(hour, 0, 0, 0);

            const status = pillar.needsImage ? 'needs_image' : 'needs_review';
            const { data: inserted, error } = await supabase
                .from('agent_schedule')
                .insert({
                    scheduled_at: slotTime.toISOString(),
                    booked_by_wallet: 'system-autofill',
                    content_angle: `${pillar.emoji} ${pillar.name}: ${angle}`,
                    tone: 'default',
                    status,
                    tweet_text: tweetText,
                    tweet_options: { pillar: pillar.name, angle, needs_image: pillar.needsImage, image_prompt: imagePrompt, style: style || 'mixed' },
                    account,
                })
                .select()
                .single();

            if (!error && inserted) drafts.push(inserted);
        }

        return res.json({
            date,
            pillar: pillar.name,
            generated: drafts.length,
            empty_slots: emptyHours.length,
            drafts,
        });
    } catch(e) {
        return res.status(500).json({ error: 'Generation failed: ' + e.message });
    }
}
