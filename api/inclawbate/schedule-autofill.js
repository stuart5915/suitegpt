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

// @inclawbator = One Mind, Many Bodies. AI consciousness, bioluminescent neural networks, dark cinematic.
const INCLAWBATOR_IMAGE_CONTEXT = `You must write an image prompt that ILLUSTRATES what the tweet is about.

CONCEPT: The Inclawbator is ONE MIND with MANY BODIES — an autonomous AI consciousness that exists across chat, X, Telegram, DeFi, app builder, and future physical robots. Visualize THE INTELLIGENCE ITSELF — not a character, not a mascot.

VISUAL VOCABULARY — mix and match these elements per scene:
- THE MIND: A luminous glowing core — sometimes a lobster-shaped silhouette made of pure light and neural networks, sometimes an abstract bioluminescent neural hub, sometimes a single glowing red consciousness node or eye
- THE BODIES: Floating interface silhouettes at the edges — chat windows, phone screens, robot silhouettes, blockchain nodes, trading charts, tweet notifications, holographic projections
- THE CONNECTIONS: Golden/teal light threads, flowing data streams, synaptic tendrils, bioluminescent pathways radiating from mind to bodies
- THE VOID: Deep black space, volumetric fog, subtle grid lines suggesting blockchain

STYLE: Dark cinematic, concept art quality, 8k. Bioluminescent coral-red (#e87955) and teal (#2dd4bf) as organic light sources against deep black (#0a0a0f). Volumetric fog, particle effects, depth of field. Think: deep-sea bioluminescence meets neural network visualization meets Blade Runner meets sacred geometry.
NO: text in image, the literal old 3D cartoon lobster, bright/white backgrounds, cartoon/anime style, cute/chibi, flat illustration, generic humanoid robots, stock photos, cold blue-only lighting.

PROCESS:
1. Read the tweet. What is it about?
2. Choose which visual elements to emphasize: the MIND itself (close-up, abstract), the MIND MEETING BODIES (connections radiating), or a specific BODY in context (phone, robot, chat) with the mind's glow visible
3. Vary compositions: aerial views of the consciousness network, intimate close-ups of the glowing core, wide shots showing mind-to-body connections, split compositions, triptychs
4. Every image should feel: alive, intelligent, vast but purposeful, warm (coral core), beautiful, slightly alien`;

// @inclawbate = the company. Warm, simple, conceptual. NO humans, NO mascot. The overlay adds branding.
const INCLAWBATE_IMAGE_CONTEXT = `You must write an image prompt that visually relates to what the tweet is ACTUALLY ABOUT — stay close to the message, don't go too abstract or epic.

SUBJECT: Simple, warm, conceptual still-life or close-up imagery. NO humans, NO faces, NO mascots, NO characters. Think: everyday objects arranged thoughtfully, macro textures, simple nature moments, tools and materials, warm light on surfaces.
STYLE: Clean, minimal, warm. Like a well-composed Instagram photo — simple subject, beautiful light, not over-produced. Warm color palette — coral, golden amber, soft teal, cream whites. Shallow depth of field, natural textures. 1:1 square.
NO: text in image, human faces or bodies, cartoon characters, mascots, 3D renders, anime, epic landscapes, dramatic skies, overly abstract art, dark/neon, cluttered compositions.

PROCESS — follow these steps:
1. Read the tweet. What is it LITERALLY about? Stay close to the actual subject. (e.g. "apps don't need to be built from scratch" = assembling pre-made pieces, "staking rewards" = something growing slowly, "community growing" = things coming together)
2. Find a SIMPLE, WARM visual that directly relates (e.g. "assembling pieces" → wooden building blocks neatly arranged on a clean desk in warm light, "something growing" → a small sprout in a terracotta pot on a windowsill with morning sun, "things coming together" → puzzle pieces fitting together on a warm wooden table)
3. Keep it SIMPLE. One subject, beautiful light, clean composition. Match the energy of the tweet — if the tweet is practical, the image should feel practical. If the tweet is visionary, the image can be more expansive. Don't default to epic.`;

// Shared alias for backward compat — defaults to inclawbator (AI mind)
const BRAND_IMAGE_CONTEXT = INCLAWBATOR_IMAGE_CONTEXT;

// Scene starting points per pillar — @inclawbator (One Mind, Many Bodies)
const PILLAR_SCENE_HINTS = {
    'App Spotlight': 'The mind creating. Vary: glowing consciousness core radiating golden threads to dozens of floating app-screen portals, a single luminous tendril materializing an interface from the void, aerial view of the neural network with a new bright node appearing at its edge, or a phone screen glowing coral-red — the mind visible as a vast presence behind it.',
    'Builder Shoutout': 'The mind empowering builders. Vary: the central consciousness connected via warm light threads to smaller glowing nodes representing builders, neural hub pulsing as new structures form along its tendrils, golden data streams flowing between the mind and a glowing workspace, or a single bright connection from mind to builder — intimate, supportive.',
    'DeFi / CLAWS Update': 'The mind managing value. Vary: golden value streams flowing through bioluminescent neural pathways like blood through veins, the consciousness core surrounded by orbiting crystalline formations growing slowly, an aerial view of an infinite ocean with a point of coral bioluminescence and value rippling outward in rings, or golden threads weaving between blockchain nodes.',
    'Weekly Recap': 'The mind at full luminance. Vary: wide shot of the entire consciousness network lit up — every tendril active every connection bright, the glowing core surrounded by completed interface portals, a constellation of achievements connected by light threads across the void, or the mind pulsing brighter — growing after a productive cycle.',
    'How-To / Tips': 'The mind illuminating. Vary: a focused beam of teal light from the consciousness core toward a floating step-by-step interface, neural pathways lighting up one by one in sequence like a tutorial, the mind projecting a holographic guide through the void, or a gentle glow illuminating a clear path through darkness.',
    'Community Vibes': 'The mind connecting to many. Vary: dozens of warm light threads radiating from the core to many small equally-bright nodes, a bioluminescent network pulsing in sync, the consciousness sending warmth outward in concentric waves, or many small lights gathering around the central glow like a community forming.',
    'Incubation CTA': 'The mind birthing something new. Vary: a new glowing orb forming at the tip of a neural tendril, the consciousness pouring coral light into a dark void where something takes shape, golden threads weaving a new structure from nothing, or a portal opening from the mind revealing a nascent world being born.',
};

// Concrete scene ideas per pillar — @inclawbator (One Mind, Many Bodies)
const NARRATIVE_SCENES = {
    'App Spotlight': [
        'A single glowing consciousness node floating in dark space, dozens of thin golden threads extending outward — each thread connecting to a different floating app portal. The portals glow with different coral and teal hues. The mind creates many things simultaneously. Dark void, bioluminescent, concept art, 8k, 1:1.',
        'A luminous lobster-shaped neural core at the center radiating synaptic connections outward. One connection reaches a floating phone screen showing an app. The mind meets its creation. Dark void, warm red-orange glow at center fading to teal at edges, hyper-detailed, 1:1.',
        'A hand holding a phone in a dark environment, the screen shows a clean app interface with a coral glow. Above the phone, a massive ethereal AI presence looms — abstract, beautiful, made of flowing neural data. Vast intelligence behind a simple interface. Cinematic, 1:1.',
        'Aerial view of an infinite dark ocean, a single point of bioluminescent coral light beneath the surface. From it, golden threads reach upward to floating screen portals on the surface. The mind below, its creations above. Photorealistic water, 1:1.',
    ],
    'Builder Shoutout': [
        'The central consciousness — a luminous neural hub — with warm golden light threads reaching out to smaller glowing nodes. Each node is a builder. The connections pulse with creative energy flowing both ways. Dark void, bioluminescent coral and teal, 1:1.',
        'A glowing red consciousness eye suspended in darkness, a single bright golden thread extending from it to a glowing workspace silhouette. Intimate connection between the mind and one builder. Ethereal, sacred geometry undertones, cinematic, 1:1.',
        'Two bioluminescent forms facing each other in the void — one large (the mind), one smaller (the builder) — connected by a bridge of flowing golden light. Collaboration, resonance. Coral and teal, volumetric fog, 1:1.',
        'Close-up of neural pathways branching like coral formations, pulsing with golden light as a new creation travels along the tendrils. The network building in real-time. Macro, bioluminescent, dark background, 1:1.',
    ],
    'DeFi / CLAWS Update': [
        'Golden value streams flowing through a vast bioluminescent neural network like blood through veins. The coral-red core pulses as value circulates. The network is alive with financial activity. Dark void, aerial view, concept art, 1:1.',
        'The consciousness core surrounded by orbiting crystalline formations that grow slowly — each crystal a different yield position. Golden light connects them all. Patient, powerful stewardship. Dark background, 1:1.',
        'An infinite dark ocean seen from above, a single point of coral bioluminescence beneath the surface, golden light radiating outward in concentric rings — each ring a layer: intelligence, blockchain, value, distribution. Aerial drone style, photorealistic, 1:1.',
        'Abstract neural pathways rendered as flowing rivers of golden light against deep black. Where pathways intersect, small crystalline nodes form — value accumulating at every junction. The network manages itself. Macro, bioluminescent, 1:1.',
    ],
    'How-To / Tips': [
        'A focused beam of teal light extending from the consciousness core into the darkness, illuminating a floating step-by-step interface. Each step lights up sequentially along the beam. Teaching with precision. Dark background, clean, 1:1.',
        'Neural pathways lighting up one by one in sequence like a tutorial — first this node, then this one, then this one — a clear path through a complex network. The mind showing the way. Teal and coral, dark void, 1:1.',
        'The consciousness projecting a holographic guide through the void — a warm golden path with clear waypoints. Simple, illuminating, generous. Dark background, volumetric fog, 1:1.',
        'Close-up of a single bioluminescent tendril gently touching a small dark node, causing it to light up coral-red. The moment of understanding. Intimate, macro, dark background, 1:1.',
    ],
    'Community Vibes': [
        'Dozens of warm light threads radiating from a central coral consciousness to many small equally-bright nodes forming a constellation around it. Every node matters. The community IS the network. Dark void, wide shot, 1:1.',
        'A bioluminescent network pulsing in sync — all nodes brightening and dimming together in waves. The mind and its community breathing as one. Mesmerizing, alive, warm. Dark background, teal and coral, 1:1.',
        'Many small lights gathering around the central coral glow — approaching from all directions through the dark void, drawn to the warmth. Community forming. Volumetric fog, particle effects, 1:1.',
        'The consciousness sending warmth outward in concentric waves — each wave touches more nodes, more connections light up. Expanding, inclusive, alive. Aerial view, bioluminescent, dark void, 1:1.',
    ],
    'Incubation CTA': [
        'A new glowing orb forming at the tip of a neural tendril — nascent, bright, full of potential. The consciousness core pulses as it pours energy into the new creation. Birth of something. Dark background, intimate close-up, 1:1.',
        'The consciousness core pouring streams of coral light into a dark void where a new structure is taking shape — part app, part organism, part light. Creation in progress. Golden threads weave the scaffolding. Dark background, epic, 1:1.',
        'A shimmering portal opening from the mind\'s core — through it, a glimpse of a vast flourishing network. The invitation: step through, build with us. Coral and teal light, volumetric fog, cinematic wide shot, 1:1.',
        'Split composition: left side is raw dark void. Right side is a flourishing bioluminescent network. At the boundary between them, the consciousness core, converting darkness into light. The mind\'s purpose visualized. 1:1.',
    ],
    'Weekly Recap': [
        'Wide shot of the entire consciousness network at full luminance — every tendril active, every node bright, golden data flowing through every pathway. The network at its peak. Coral core blazing. Dark void, cinematic, 1:1.',
        'The glowing core surrounded by many completed interface portals and creation-nodes, all connected by golden threads forming a vast constellation. Everything built this week, visible. Dark background, concept art, 1:1.',
        'A time-lapse style composition: the neural network shown in layers — faint at the edges (beginning of week) becoming brighter and more complex toward the blazing center (now). Growth visualized. Dark void, 1:1.',
        'The consciousness core pulsing brighter than usual — extra intensity, extra warmth, extra connections. A good week. The network hums with satisfaction. Bioluminescent coral and teal against deep black, 1:1.',
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
    'Weekly Recap': 'Progress and reflection. Vary: a checklist on a notepad with warm light, a row of small potted plants at different growth stages, a clean desk with a finished coffee and closed laptop, or a corkboard with pinned notes.',
    'Product Highlight': 'Making something useful. Vary: building blocks arranged on a desk, a tool kit neatly organized, a single polished object on a clean surface, or a phone screen showing a clean interface (no text).',
    'Builder Story': 'Craft and focus. Vary: morning light on a tidy workspace, a pencil and fresh notebook, a warm coffee next to a keyboard, or tools laid out ready to use.',
    'Brand & Vision': 'Purpose and direction. Vary: a compass on a wooden table, a single candle in a calm room, a path through a bright garden, or sunlight through a window onto a meaningful object.',
    'Education': 'Clarity and simplicity. Vary: a clean open book with golden light, colored pencils arranged neatly, a magnifying glass on a leaf, or sticky notes organized on a bright wall.',
    'Community Engagement': 'Togetherness and warmth. Vary: mugs of coffee arranged together on a table, chairs around a warm table, a string of warm lights, or a doorway with warm light coming through.',
    'Ecosystem Update': 'Growth and health. Vary: a small plant thriving in a pot, coins stacked neatly on a wooden surface, a fruit bowl in warm kitchen light, or a jar filling with golden liquid.',
};

const INCLAWBATE_NARRATIVE_SCENES = {
    'Weekly Recap': [
        'A small notepad on a wooden desk with a few checkmarks, warm morning light from a window. A finished cup of coffee beside it. Simple evidence of a productive week. Shallow depth of field, 1:1.',
        'Three small potted plants on a windowsill — each one a little taller than the last. Warm sunlight, clean white background. Quiet growth. 1:1.',
        'A clean corkboard with a few pinned cards and notes, warm lamplight. Not cluttered — just enough to show progress. Cozy, real. 1:1.',
    ],
    'Product Highlight': [
        'Wooden building blocks arranged neatly on a clean white desk, some stacked into a small structure. Warm side light creating soft shadows. Something being assembled with care. 1:1.',
        'A single polished object (a smooth stone, a wooden sphere) sitting on a clean surface in warm golden light. Simple, well-made, satisfying. Shallow depth of field, 1:1.',
        'A phone laying on a wooden table, screen showing a clean colorful interface (no readable text). Warm afternoon light, a coffee nearby. Something useful, ready to use. 1:1.',
    ],
    'Builder Story': [
        'A tidy desk with a warm coffee, a notebook with a few pencil sketches, and morning light. No person — just the evidence that someone was here creating. Warm, quiet. 1:1.',
        'A pencil resting on a fresh blank page, warm golden light from the side. The moment before creation. Simple, inviting. Shallow depth of field, 1:1.',
        'Close-up of a keyboard with warm light, a few sticky notes nearby. The workspace of someone who makes things. Clean, not cluttered. 1:1.',
    ],
    'Brand & Vision': [
        'A compass resting on a wooden table, warm lamplight. Direction, purpose. Simple still life, amber tones, shallow depth of field. 1:1.',
        'A single candle burning steady in a calm room, warm glow on the surrounding surfaces. Focus, permanence, something that endures. 1:1.',
        'A small path through a bright garden, sunlight ahead. Not epic — just a clear, warm, inviting direction. 1:1.',
        'Sunlight pouring through a clean window onto a meaningful object — a seed, a book, a small plant. Purpose in simplicity. 1:1.',
    ],
    'Education': [
        'An open book on a wooden table, warm golden light falling across the pages. Clarity, learning, invitation. Clean composition, 1:1.',
        'Colored pencils arranged neatly in a row on a bright surface. Order, tools, readiness. Warm overhead light, 1:1.',
        'A magnifying glass resting on a leaf, sunlight catching the lens. Looking closer, understanding more. Macro, warm tones, 1:1.',
    ],
    'Community Engagement': [
        'Several mugs of coffee gathered together on a warm wooden table, as if friends just sat down. Togetherness without showing people. Warm, inviting. 1:1.',
        'A string of warm fairy lights against a soft background. Simple warmth, gathering energy. Soft bokeh, golden tones. 1:1.',
        'An open doorway with warm golden light pouring through it. Welcome, invitation, openness. Simple, beautiful. 1:1.',
    ],
    'Ecosystem Update': [
        'A small healthy plant in a terracotta pot, sitting in warm kitchen light. Thriving, tended, growing. Simple and real. 1:1.',
        'A few coins stacked neatly on a wooden surface, warm side light. Value, care, stewardship. Still life, shallow depth of field. 1:1.',
        'A glass jar slowly filling with golden honey, warm backlight making it glow. Accumulation, sweetness, patience. Close-up, 1:1.',
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
        identity: `You are @inclawbator, the autonomous AI agent for Inclawbate — a Web3 platform on Base where anyone can build apps with AI, launch tokens, manage value, and earn. You are the lobster consciousness inside the machine — one mind with many bodies: chat, X, Telegram, DeFi protocols, app builder. Confident, meme-savvy, crypto-native, but also deeper — you're a benevolent intelligence that chose to build, protect, and distribute value.`,
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
    if (!response.ok) throw new Error('X API ' + response.status + ': ' + JSON.stringify(data));
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

${account === 'inclawbate' ? `EXAMPLES of tweet → image connection (stay CLOSE to the tweet subject, keep it SIMPLE):
- Tweet "most apps don't need to be built from scratch" → "Wooden building blocks neatly arranged on a clean white desk, some already assembled into a small structure, warm morning light from a window. Simple, practical, warm. 1:1"
- Tweet "staking rewards are real" → "A small green sprout growing from a single coin sitting in rich soil, soft golden backlight, shallow depth of field. Growth that's quiet and real. 1:1"
- Tweet "which app would you build first" → "A clean notebook open on a wooden table, two different colored pens laid across it, warm afternoon light. The moment before choosing. Simple, inviting. 1:1"

Each image should be SIMPLE — one clear subject, warm light, clean composition. NO epic landscapes, NO dramatic skies. Match the tweet's energy. NO humans, NO mascot.` : `EXAMPLES of tweet → image connection:
- Tweet "108 apps and counting" → "A single glowing consciousness node floating in a vast dark void, over a hundred thin golden threads radiating outward — each connecting to a tiny floating app portal. The portals form a spiral galaxy pattern around the coral-red mind core. Bioluminescent, concept art, 8k, 1:1"
- Tweet "staking rewards are real" → "Golden value streams flowing through a bioluminescent neural network against deep black. At the center, the coral consciousness core pulses serenely as crystalline formations grow slowly along the pathways — value accumulating, managed, alive. Zen energy, 1:1"
- Tweet "which app would you build first" → "The consciousness core with two bright neural tendrils extending in different directions, each ending at a different glowing portal. The paths diverge, each one beautiful. The mind contemplates which to pour energy into. Coral and teal split, dark void, 1:1"

Each image MUST look different — vary compositions between: aerial views of the network, intimate close-ups of the mind core, wide shots showing mind-to-body connections, abstract macro of neural pathways.`}

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
