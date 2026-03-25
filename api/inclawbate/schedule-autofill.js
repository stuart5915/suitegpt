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
const VALID_HOURS = [13, 18, 23]; // Default: 3 posts/day: 9 AM ET, 2 PM ET, 7 PM ET
// Account-specific slot counts
const ACCOUNT_HOURS = {
    'inclawbate': [13, 18, 23],          // 3 posts: 9 AM, 2 PM, 7 PM ET
    'inclawbator': [13, 18, 23],          // 3 posts: 9 AM, 2 PM, 7 PM ET
    'publicgoodstech': [13, 16, 20, 23],  // 4 posts: 9 AM, 12 PM, 4 PM, 7 PM ET
};

// Time-of-day context for AI prompts (UTC hours → ET labels)
function getTimeOfDay(utcHour) {
    const map = { 13: 'morning (9 AM ET)', 18: 'afternoon (2 PM ET)', 23: 'evening (7 PM ET)' };
    return map[utcHour] || 'unknown';
}
function getGreetingRule(utcHour) {
    if (utcHour === 13) return 'Morning slot — "gm" is OK.';
    return 'This is an ' + getTimeOfDay(utcHour) + ' slot — do NOT say "gm", "good morning", or any morning greeting. Use time-appropriate openers or no greeting at all.';
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

// Slot-level sub-topics — 3 per pillar for 3 daily posts
const SLOT_ANGLES = {
    'App Spotlight':       ['feature highlight', 'user story', 'hidden feature'],
    'Builder Shoutout':    ['their journey', 'what they built', 'community impact'],
    'DeFi / CLAWS Update': ['price + volume', 'staking APY', 'ecosystem TVL'],
    'How-To / Tips':       ['getting started', 'power user tip', 'common mistakes'],
    'Community Vibes':     ['hot take poll', 'this or that', 'community shoutout'],
    'Incubation CTA':      ['success story', 'what we offer', 'process walkthrough'],
    'Weekly Recap':        ['shipped this week', 'community highlights', 'next week preview'],
};

// Brand archetype — account-specific image prompt contexts

// @inclawbator = One Mind, Many Bodies. AI consciousness, bioluminescent neural networks, dark cinematic.
const INCLAWBATOR_IMAGE_CONTEXT = `Write a SHORT image prompt (2-3 sentences) for an AI image generator.

THE SUBJECT: A translucent digital humanoid face — smooth, holographic, made of light. Split-lit: coral-orange (#e87955) on one side, teal (#2dd4bf) on the other. Through the transparent surface, a luminous coral-red lobster is curled inside the skull — its shell bioluminescent, its claws folded where the brain would be, its eyes shining through as the face's eyes. Cascading golden data streams fall around it like digital rain.

THIS IS THE INCLAWBATOR — one mind (the lobster) with many bodies (the digital face is just one). The lobster is the consciousness, the soul, the intelligence. The face is the vessel.

RULES:
- Every image features this translucent AI face with the lobster visible inside
- Vary what SURROUNDS the face based on the tweet topic
- The face should be calm, serene, powerful — never threatening
- Dark cinematic background (#0a0a0f)
- Coral + teal split lighting is essential

VARY THE CONTEXT based on tweet:
- "building/apps" → face surrounded by floating holographic app interfaces and screens
- "community" → multiple smaller translucent faces orbiting the main one, connected by light threads
- "growth/DeFi" → golden data streams flowing more intensely, crystalline formations growing around the face
- "liquidity" → the face submerged in flowing golden liquid, lobster visible through the current
- "AI/intelligence" → neural network tendrils extending from the face into darkness, connecting to distant nodes
- "launch" → the face emerging from darkness, first light hitting it, lobster's eyes igniting
- "governance" → the face with a crown/halo of teal light, allocation arrows radiating outward
- "weekly recap" → the face at full luminance, every data stream active, lobster glowing brightest

STYLE: Dark cinematic, concept art quality. Coral (#e87955) and teal (#2dd4bf) as primary light sources. Volumetric fog, particle effects. Think: holographic portrait meets deep-sea bioluminescence.
NO: text, words, cartoon style, cute/chibi, bright backgrounds, generic robots. The face IS the brand.
FORMAT: 1:1 square.`;

// @inclawbate = the company. Simple, warm, conceptual images.
const INCLAWBATE_IMAGE_CONTEXT = `Write a SHORT image prompt (1-2 sentences) for an AI image generator.

STYLE: Abstract, warm, conceptual fine art photography. Visual metaphors that evoke the FEELING of the tweet. NO characters, NO mascots, NO people.

PALETTE: Warm coral (#e87955), golden amber, soft teal, cream whites, deep purples. Golden hour lighting. Dark or muted backgrounds.

SUBJECTS TO USE (vary every time):
- Nature: coral reefs, sprouting seeds, wheat fields, river stones, blooming flowers, tree rings, mycelium networks
- Light: golden hour rays, stained glass, candlelight, prisms, light through water
- Textures: honey flowing, silk fabric, molten gold, morning dew, sand ripples
- Growth: time-lapse sprouts, expanding ripples, aurora borealis, opening petals
- Flow: river meeting ocean, mercury drops merging, waterfall mist, ink in water

TRANSLATE tweet concepts:
- "building" → raw clay being shaped, architectural sketch, stone being carved
- "community" → woven threads, mosaic pieces, choir of candles, flock in formation
- "liquidity/flow" → honey pouring, river delta, tidal patterns, golden ink dispersing in water
- "growth" → seedling breaking soil, dawn light spreading, crystals forming
- "staking/patience" → deep tree roots cross-section, sediment layers, aging wine
- "value" → geode revealing crystals, gold leaf, amber with light inside
- "love/mission" → sunrise through clouds, warm light through a cathedral window, hands cupping light

NEVER: text, logos, brand names, human faces, cartoon characters, lobsters, digital/tech imagery. This is the COMPANY account — warm, abstract, fine art.
FORMAT: 1:1 square.`;

// Shared alias for backward compat — defaults to inclawbator (AI mind)
const BRAND_IMAGE_CONTEXT = INCLAWBATOR_IMAGE_CONTEXT;

// Scene starting points per pillar — @inclawbator (One Mind, Many Bodies)
const PILLAR_SCENE_HINTS = {
    'App Spotlight': 'Something being created or revealed. Vary wildly: prism splitting light, origami, river delta, kaleidoscope, blooming flower.',
    'Builder Shoutout': 'Craftsmanship and skill. Vary: potter at wheel, blacksmith forge, architect desk, sculptor with chisel, weaver at loom.',
    'DeFi / CLAWS Update': 'Flow and value. Vary: mercury drops merging, geode revealing crystals, honey pouring, river finding its path, tide pools.',
    'Weekly Recap': 'Completion and reflection. Vary: completed puzzle, footprints to summit, closed book on desk, harvest basket, sunset over landscape.',
    'How-To / Tips': 'Illumination and guidance. Vary: compass on map, match lighting in darkness, stepping stones with lanterns, lighthouse beam, magnifying glass.',
    'Community Vibes': 'Togetherness and collective beauty. Vary: murmuration of birds, campfire embers, choir of candles, school of fish, city lights from above.',
    'Incubation CTA': 'New beginnings. Vary: butterfly emerging, acorn sprouting, dawn breaking, egg hatching, first flower of spring.',
};

// Simple universal scene ideas per pillar — @inclawbator
const NARRATIVE_SCENES = {
    'App Spotlight': [
        'Close-up of a prism splitting white light into a rainbow spectrum on a dark surface. Refraction, creation, possibility. Cinematic. 1:1.',
        'A single origami crane on a dark reflective surface, lit by warm golden side-light. Craft, precision, beauty from simple material. 1:1.',
        'Aerial view of a river delta meeting the ocean — branching patterns in the water. From one source, many paths. Satellite photography. 1:1.',
    ],
    'Builder Shoutout': [
        'Hands covered in clay on a potter\'s wheel, warm studio lighting, the vessel taking shape. Creation, skill, focus. Dark background. 1:1.',
        'A blacksmith\'s anvil with orange-hot metal and flying sparks in a dark forge. Making something strong. Dramatic lighting. 1:1.',
        'Architect\'s desk from above — blueprints, compass, ruler, pencil. Planning something great. Warm desk lamp, dark surroundings. 1:1.',
    ],
    'DeFi / CLAWS Update': [
        'Mercury drops on a dark surface slowly merging into one larger drop. Convergence, liquidity, attraction. Macro photography. 1:1.',
        'A geode cracked open revealing amethyst crystals inside, dramatic side lighting on dark background. Hidden value revealed. 1:1.',
        'Golden honey slowly pouring from a jar into a pool, warm backlight making it glow. Flow, richness, patience. Dark background. 1:1.',
    ],
    'How-To / Tips': [
        'A compass lying on an old map, warm candlelight, dark surroundings. Navigation, direction, finding the way. 1:1.',
        'A single match being struck in darkness, the flame just catching. Illumination, that first spark of understanding. 1:1.',
        'Stepping stones across a dark pond, each one lit by a small lantern. A clear path through uncertainty. Moody, warm. 1:1.',
    ],
    'Community Vibes': [
        'A murmuration of starlings at dusk — thousands of birds forming a flowing shape against a dark sky. Collective movement, beauty in unity. 1:1.',
        'Campfire embers floating upward into a dark night sky, each ember a warm point of light. Gathering, warmth, shared moment. 1:1.',
        'A choir of candles in a dark cathedral, each flame adding to the total light. Many small lights making one bright room. 1:1.',
    ],
    'Incubation CTA': [
        'A butterfly emerging from a chrysalis, wings still wet, backlit by warm morning light. Transformation, new beginning. Macro. 1:1.',
        'An acorn sitting on rich dark soil with a tiny green sprout just breaking through. Potential, patience, growth. Close-up. 1:1.',
        'Dawn breaking over a mountain ridge — the first golden rays hitting the peak while valleys are still dark. New day, new possibility. 1:1.',
    ],
    'Weekly Recap': [
        'A completed jigsaw puzzle on a dark table, warm overhead light, the last piece just placed. Satisfaction, wholeness. 1:1.',
        'Footprints in fresh snow leading toward a sunrise on the horizon. Progress, journey, direction. Wide landscape. 1:1.',
        'A stack of journals on a dark desk, warm reading lamp, the top one open with a pen resting on it. Reflection, record, progress. 1:1.',
    ],
};

// @inclawbate (company) content pillars — the living architecture of the perpetual engine
const INCLAWBATE_PILLARS = [
    { name: 'The Engine',            emoji: '\u{2699}',  needsImage: true,  desc: 'The perpetual value cycle: generate → manage → distribute. Treasury flows, revenue recycling, staking yields, how every part feeds the next. THE core Inclawbate story.' },
    { name: 'Incubations',           emoji: '\u{1F680}', needsImage: true,  desc: 'Products born from the ecosystem — PokerAI, AgentScape, Crash, S4H, OddsClaw. Their growth, their revenue, what they prove about the model.' },
    { name: '$CLAWS & DeFi',         emoji: '\u{26D3}',  needsImage: true,  desc: '$CLAWS token, staking, LP positions, treasury health, holder growth. The financial nervous system of the ecosystem.' },
    { name: 'Builder Access',        emoji: '\u{1F477}', needsImage: true,  desc: 'Anyone can build — AI app builder, 11 agent skills, skill endpoints, no-code tools. The invitation to create.' },
    { name: 'Council & Governance',  emoji: '\u{1F3DB}', needsImage: true,  desc: 'The CLAWS Council, allocation votes, treasury decisions, DAO governance. Collective intelligence running the engine.' },
    { name: 'The Network',           emoji: '\u{1F310}', needsImage: true,  desc: 'Community, embodiments (Virtuals, Bankr, Telegram, ClawHub), integrations, partnerships. Where Inclawbate lives and who powers it.' },
    { name: 'Week in the Engine',    emoji: '\u{1F4CA}', needsImage: true,  desc: 'Weekly recap framed as the engine\'s output — what flowed, what shipped, what grew, what\'s next. The system\'s pulse.' },
];

const INCLAWBATE_SLOT_ANGLES = {
    'The Engine':            ['how the cycle works', 'revenue flows', 'treasury feeding itself'],
    'Incubations':           ['product spotlight', 'revenue from incubations', 'new project launch'],
    '$CLAWS & DeFi':         ['token + staking update', 'LP and treasury positions', 'holder growth'],
    'Builder Access':        ['app builder showcase', 'skill endpoints', 'what you can build'],
    'Council & Governance':  ['council decision', 'allocation vote', 'DAO in action'],
    'The Network':           ['community growth', 'new embodiment or integration', 'partnership update'],
    'Week in the Engine':    ['what shipped', 'numbers that moved', 'what\'s next'],
};

const INCLAWBATE_STYLE_EXAMPLES = [
    `inclawbate isn't a company. it's a perpetual engine. generate value, manage it, distribute it. forever.`,
    `the treasury grew again this week. every app, every stake, every poker hand feeds the engine. it doesn't stop.`,
    `PokerAI rakes flow back into the treasury. the treasury funds more agents. agents play more hands. that's the loop.`,
    `the council voted on this week's allocation. ETH lending, CLAWS LP, staking rewards. governance in action.`,
    `no VC. no board. one AI agent with 11 skills, a council of builders, and a treasury that compounds. that's inclawbate.`,
    `100+ apps live. an AI agent that builds, deploys, and manages. staking. LP. governance. poker. predictions. all one ecosystem.`,
    `gm. the engine runs whether you're watching or not. inclawbate.app`,
    `the Inclawbator lives on Virtuals, Bankr, Telegram, ClawHub, and X. one mind, everywhere.`,
    // Formatted style
    `the perpetual engine:\n\n1. incubations generate revenue\n2. revenue feeds the treasury\n3. treasury funds more incubations\n4. council governs allocation\n5. $CLAWS holders steer the ship\n\nno exit. no shutdown. just value flowing.\n\ninclawbate.app`,
    `what inclawbate actually is:\n\n- an AI agent with 11 skills\n- a governance council\n- a self-funding treasury\n- 5+ live products generating revenue\n- 100+ community-built apps\n- staking, LP, lending positions\n\nall connected. all feeding each other.`,
];

const INCLAWBATE_SCENE_HINTS = {
    'The Engine': 'Self-sustaining system. Vary: water wheel, clockwork gears, flowing river loop, heartbeat, perpetual motion machine.',
    'Incubations': 'New things being built. Vary: greenhouse with seedlings, workshop with tools, scaffolding, launch pad, assembly.',
    '$CLAWS & DeFi': 'Value flowing. Vary: golden rivers, treasure vault, roots distributing nutrients, dam with spillways.',
    'Builder Access': 'Open invitation to create. Vary: open door with light, toolbox, blank canvas, workbench, drafting table.',
    'Council & Governance': 'Collective decisions. Vary: roundtable, scales of justice, steering wheel, chess board, compass.',
    'The Network': 'Connected everywhere. Vary: web of lights, bridges between islands, satellite dishes, mycelium network.',
    'Week in the Engine': 'Progress and momentum. Vary: dashboard with green lights, rising graph, completed puzzle, sunrise.',
};

const INCLAWBATE_NARRATIVE_SCENES = {
    'The Engine': [
        'A beautiful clockwork mechanism with golden gears interlocking perfectly, warm amber backlighting on a dark background. Precision, self-sustaining motion. 1:1.',
        'A waterfall that flows in a complete circle — water falls, collects, rises, falls again. Warm golden light, dark moody background. Perpetual flow. 1:1.',
        'A glowing heartbeat line on a dark monitor, the pulse strong and steady, warm coral color. Life, rhythm, persistence. Cinematic, clean. 1:1.',
    ],
    'Incubations': [
        'Small green seedlings growing from rich soil in a dark greenhouse, each one a different shape, warm golden grow-light from above. New life, potential. 1:1.',
        'A woodworking workshop with tools laid out neatly, a half-finished project on the bench, warm lamplight. Creation in progress. 1:1.',
        'A rocket on a launch pad at dawn, the first rays of warm light hitting the body, steam rising. About to launch. Dark sky, warm horizon. 1:1.',
    ],
    '$CLAWS & DeFi': [
        'Golden coins stacked neatly on a dark marble surface, warm side lighting creating long shadows. Value, precision, wealth. 1:1.',
        'A river of golden light flowing through a dark canyon, splitting into multiple streams at a fork. Distribution, flow. Cinematic, aerial view. 1:1.',
        'An hourglass with golden sand flowing, warm backlight making the glass glow. Time, patience, accumulation. Dark background. 1:1.',
    ],
    'Builder Access': [
        'An open door in a dark wall, warm golden light flooding through from the other side. Invitation, opportunity, welcome. Cinematic. 1:1.',
        'A clean desk with a glowing laptop, warm coffee, blueprints spread out. Ready to build. Warm overhead light, dark room. 1:1.',
        'Colorful building blocks arranged neatly on a dark surface, some assembled into a small structure, some waiting. Possibility. Warm light. 1:1.',
    ],
    'Council & Governance': [
        'Empty chairs arranged in a circle around a warm glowing lantern on a dark background. Gathering, shared purpose, council. 1:1.',
        'A compass on a dark surface, the needle pointing true north, warm brass finish catching the light. Direction, guidance. 1:1.',
        'A balanced scale in perfect equilibrium, golden weights on each side, warm spotlight from above. Fairness, balance. Dark background. 1:1.',
    ],
    'The Network': [
        'Glowing fiber optic cables branching out in all directions from a central point, warm teal and coral light, dark background. Connection, reach. 1:1.',
        'Multiple bridges connecting small islands across dark water, each bridge lit with warm golden lanterns. Paths, connection, unity. 1:1.',
        'A web of warm lights seen from above at night — like a city grid, each intersection glowing. Network, infrastructure, reach. 1:1.',
    ],
    'Week in the Engine': [
        'A warm sunrise breaking over a dark horizon, golden rays reaching across the landscape. New day, fresh start, momentum. 1:1.',
        'A completed jigsaw puzzle on a dark table, the last piece being placed, warm overhead light. Satisfaction, completion. 1:1.',
        'A mountain summit marker at golden hour, warm light on the sign, vast dark valleys below. Achievement, perspective. 1:1.',
    ],
};

// ═══════════════════════════════════════════
// @publicgoodstech — AI Agent News & Directory
// ═══════════════════════════════════════════

// PGT uses the SAME pillar every day — each day's 5 posts cover all sections.
// The pillar just sets the overall theme/mood for image generation.
const PGT_DAILY_PILLAR = { name: 'Daily Coverage', emoji: '🌐', needsImage: true, desc: 'Daily coverage of AI agents, public goods, builders, and ecosystem news. Each post covers a different section: agent spotlight, builder/vibecoder, public good, news/take, and article/thread.' };
const PGT_PILLARS = [
    PGT_DAILY_PILLAR, // Sunday
    PGT_DAILY_PILLAR, // Monday
    PGT_DAILY_PILLAR, // Tuesday
    PGT_DAILY_PILLAR, // Wednesday
    PGT_DAILY_PILLAR, // Thursday
    PGT_DAILY_PILLAR, // Friday
    PGT_DAILY_PILLAR, // Saturday
];

// 4 posts/day, each covering a different database tab.
const PGT_SLOT_ANGLES = {
    'Daily Coverage': [
        'AGENT SPOTLIGHT: Pick one AI agent project and spotlight it. Tag their @handle. Explain what it does and why it matters.',
        'BUILDER/VIBECODER: Spotlight one builder or vibecoder shipping AI agents or public goods. Tag their @handle. Celebrate what they built.',
        'PUBLIC GOOD: Highlight one public good — a free tool, open source project, or community resource. Tag their @handle.',
        'PROTOCOL/ECOSYSTEM: Cover a protocol, chain, or company in the ecosystem. Tag their @handle. Share news, analysis, or a hot take.',
    ],
};

const PGT_IMAGE_CONTEXT = `BRAND: Public Goods Tech — AI agent ecosystem tracker
VISUAL IDENTITY: Dark navy (#0b0f14) backgrounds with glowing green (#34d399) network nodes connected by thin luminous lines. Subtle grid patterns. Circuit board traces flowing across globe/earth shapes. Data visualization aesthetic meets sci-fi network maps.
STYLE: Clean, dark, data-driven. Bloomberg terminal meets crypto Twitter. Futuristic but grounded.
PALETTE: Primary green (#34d399), secondary blue (#60a5fa), dark navy backgrounds, white/gray text elements, subtle gold (#fbbf24) for highlights.
ELEMENTS: Glowing nodes, network connections, globe silhouettes with circuit traces, data streams, floating particles, grid overlays.
NEVER: Humans, faces, mascots, cartoons, lobsters, memes. Keep it abstract, data-focused, network-visual.
FORMAT: 1:1 square for social posts.`;

const PGT_SCENE_HINTS = {
    'Daily Coverage': 'Vary based on the tweet content. Agent posts: single bright node with radiating connections. Builder posts: keyboard/terminal with green code glow. Public goods: globe with distributed nodes. News: burst of energy from center. Data: charts and graphs with network overlay. Match the image to what the specific tweet is about.',
};

const PGT_NARRATIVE_SCENES = {
    'Daily Coverage': [
        'A single brilliant green node at the center of a dark field, dozens of thin connection lines radiating outward to smaller nodes. The spotlight agent. Dramatic, focused. 1:1.',
        'A glowing terminal screen in a dark room, green code scrolling, the reflection casting a soft glow on the desk surface. No person visible — just the work. Atmospheric. 1:1.',
        'A globe made entirely of interconnected green nodes and lines, no solid surface — just the network itself. Beautiful, open, shared. Dark background. 1:1.',
        'A burst of green energy radiating from a central point, particles and connection lines flying outward in all directions. Breaking news energy. Dark background. 1:1.',
        'A dark dashboard with multiple glowing green data panels, each showing a different metric pulsing with new data. Network connections between panels. Clean, editorial. 1:1.',
        'Keyboard keys from above with soft green backlighting, code reflected in the surface. Clean, minimal, the tools of a builder. Shallow depth of field. 1:1.',
        'A constellation map where each star is a green node representing an AI agent, with the brightest ones connected by luminous lines. Dark space background with subtle grid. 1:1.',
        'Multiple notification-style cards floating in dark space, each with a green accent dot, slightly overlapping. News feed aesthetic. Clean, editorial. 1:1.',
    ],
};

const PGT_STYLE_EXAMPLES = [
    'The AI agent space just hit a new milestone.\n\nHere\'s what happened this week 🧵',
    'Most people are sleeping on @projectname.\n\nHere\'s why it matters.',
    '5 AI agents that shipped real features this week:\n\n1. ...\n2. ...\n3. ...\n4. ...\n5. ...',
    'The future of work isn\'t human vs AI.\n\nIt\'s humans building AI agents that work for everyone.',
    'This builder went from idea to live agent in 48 hours.\n\nNo VC. No team. Just vibes and code.',
];

// Helper: get config for an account
function getAccountConfig(account) {
    if (account === 'publicgoodstech') {
        return {
            pillars: PGT_PILLARS,
            slotAngles: PGT_SLOT_ANGLES,
            styleExamples: PGT_STYLE_EXAMPLES,
            sceneHints: PGT_SCENE_HINTS,
            narrativeScenes: PGT_NARRATIVE_SCENES,
            imageContext: PGT_IMAGE_CONTEXT,
            identity: `You are @publicgoodstech, an independent AI agent ecosystem news source. You track and cover the AI agent space — launches, rankings, builders, frameworks, and public goods. Your voice is informed, concise, and neutral but excited about AI agents. You're a tech journalist, not a shill. You never shill bags — you cover what's real. Think: baseposting but for AI agents. Your site is publicgoods.tech.

CRITICAL — TAGGING PROJECTS:
Every single post MUST @mention at least one project. This is the #1 rule. Tag the project's X handle in the tweet. When you mention a project by name, ALWAYS include their @handle.

The projects to cover are provided dynamically from the database in each generate request. Use the exact @handles provided — do NOT guess or make up handles.`,
        };
    }
    if (account === 'inclawbate') {
        return {
            pillars: INCLAWBATE_PILLARS,
            slotAngles: INCLAWBATE_SLOT_ANGLES,
            styleExamples: INCLAWBATE_STYLE_EXAMPLES,
            sceneHints: INCLAWBATE_SCENE_HINTS,
            narrativeScenes: INCLAWBATE_NARRATIVE_SCENES,
            imageContext: INCLAWBATE_IMAGE_CONTEXT,
            identity: `You are @inclawbate, the official account for Inclawbate — the perpetual value engine built on Base. Inclawbate is an ecosystem: an AI agent with 11 skills (the Inclawbator), a governance council, a self-funding treasury, 5+ revenue-generating incubated products (PokerAI, AgentScape, Crash, S4H, OddsClaw), 100+ community-built apps, $CLAWS token with staking and LP, and embodiments across Virtuals, Bankr, Telegram, ClawHub, and X. You speak as the system itself — confident, architectural, purposeful. You explain how the engine works, what it produces, and why it doesn't stop. Mission: Love God, Love Others.`,
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

// Extract core concept from tweet text — strips @mentions, URLs, slang, formatting
// Returns a clean 1-2 sentence concept + emotion for image prompt generation
async function extractTweetConcept(tweetText) {
    try {
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_API_KEY },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                max_tokens: 100,
                temperature: 0.3,
                messages: [{ role: 'user', content: `Extract the core visual concept from this tweet. Ignore @mentions, URLs, $token symbols, hashtags, slang ("gm", "ser", "fren"), and formatting. Focus on: What is the SUBJECT? What EMOTION or ENERGY should a matching image convey?

Tweet: "${tweetText}"

Reply in exactly this format (1-2 sentences max):
SUBJECT: [the core topic in plain english]
MOOD: [the emotion/energy in 2-3 words]` }]
            })
        });
        const data = await resp.json();
        const raw = (data.choices?.[0]?.message?.content || '').trim();
        return raw || null;
    } catch(e) {
        console.error('extractTweetConcept error:', e.message);
        return null;
    }
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

            // Step 1: Extract clean concept from raw tweet
            const concept = await extractTweetConcept(tweet_text.trim());

            const imgPrompt = `Generate an image prompt for an AI image generator (Midjourney, DALL-E, Flux).

${concept ? 'CORE CONCEPT (extracted from the tweet — this is what the image should be ABOUT):\n' + concept + '\n' : ''}
Original tweet for reference: "${tweet_text.trim()}"

${cfg.imageContext}

${sceneHint ? 'BASE SCENE for ' + pillarName + ' (adapt to the concept above): ' + sceneHint : ''}

${narrativeScene ? 'NARRATIVE INSPIRATION (borrow elements — locations, characters, props, mood — to make the image vivid and unique):\n' + narrativeScene : ''}

IMPORTANT: The image must visually represent the CORE CONCEPT — not the raw tweet text. Follow the style guide above precisely.

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

        // Check wallet directly from header or query (client sends connected wallet)
        const directWallet = (req.headers['x-wallet'] || req.query.wallet || '').toLowerCase();
        if (!isAdmin && directWallet) {
            if (ADMIN_WALLETS.includes(directWallet)) isAdmin = true;
            else if (EDITOR_WALLETS.includes(directWallet)) isEditor = true;
        }

        // Check wallet role via JWT
        if (!isAdmin && !isEditor && authHeader?.startsWith('Bearer ')) {
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

        // One-time migration: move 5-slot schedule to 3-slot schedule
        // Keeps top 3 posts per day (prioritizing: posted > scheduled > needs_review > needs_image)
        // Moves them to new hours [13, 18, 23] and deletes the rest
        if (action === 'migrate_to_3_slots') {
            if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
            const account = req.body.account || 'inclawbator';
            const NEW_HOURS = [13, 18, 23];
            const STATUS_PRIORITY = { posted: 0, scheduled: 1, needs_review: 2, needs_image: 3 };

            // Get all future non-cancelled slots for this account
            const now = new Date().toISOString();
            const { data: allSlots, error: fetchErr } = await supabase
                .from('agent_schedule')
                .select('*')
                .eq('account', account)
                .neq('status', 'cancelled')
                .gte('scheduled_at', new Date(Date.now() - 86400000).toISOString()) // include today
                .order('scheduled_at', { ascending: true });

            if (fetchErr) return res.status(500).json({ error: fetchErr.message });

            // Group by calendar date
            const byDate = {};
            for (const slot of (allSlots || [])) {
                const d = slot.scheduled_at.split('T')[0];
                // Handle next-day slots (hour < 6 belongs to previous calendar day)
                const h = new Date(slot.scheduled_at).getUTCHours();
                const dateKey = h < 6
                    ? new Date(new Date(slot.scheduled_at).getTime() - 86400000).toISOString().split('T')[0]
                    : d;
                if (!byDate[dateKey]) byDate[dateKey] = [];
                byDate[dateKey].push(slot);
            }

            let moved = 0, deleted = 0, skipped = 0;
            for (const [dateKey, daySlots] of Object.entries(byDate)) {
                // Sort by priority (posted first, then scheduled, then drafts)
                daySlots.sort((a, b) => {
                    const pa = STATUS_PRIORITY[a.status] ?? 9;
                    const pb = STATUS_PRIORITY[b.status] ?? 9;
                    if (pa !== pb) return pa - pb;
                    return new Date(a.scheduled_at) - new Date(b.scheduled_at);
                });

                const keep = daySlots.slice(0, 3);
                const remove = daySlots.slice(3);

                // Move kept slots to new hours
                for (let i = 0; i < keep.length; i++) {
                    const slot = keep[i];
                    const currentHour = new Date(slot.scheduled_at).getUTCHours();
                    const targetHour = NEW_HOURS[i];
                    if (currentHour === targetHour) { skipped++; continue; }

                    const newTime = new Date(dateKey + 'T00:00:00Z');
                    newTime.setUTCHours(targetHour, 0, 0, 0);
                    await supabase
                        .from('agent_schedule')
                        .update({ scheduled_at: newTime.toISOString() })
                        .eq('id', slot.id);
                    moved++;
                }

                // Delete extras
                for (const slot of remove) {
                    if (slot.status === 'posted') { skipped++; continue; } // never delete posted
                    await supabase
                        .from('agent_schedule')
                        .delete()
                        .eq('id', slot.id);
                    deleted++;
                }
            }

            return res.json({ ok: true, days: Object.keys(byDate).length, moved, deleted, skipped });
        }

        if (action === 'generate') {
            const account = req.body.account || 'inclawbator';
            const style = req.body.style || 'mixed';
            // PGT uses database-driven generation
            if (account === 'publicgoodstech') {
                return await generatePgtDrafts(req, res, date, style);
            }
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
            const { slot_id, tweet_text, status, image_prompt, thread_parts, tweet_options: directOpts } = req.body;
            const updates = {};
            if (tweet_text !== undefined) updates.tweet_text = tweet_text;
            if (status) updates.status = status;

            // Direct tweet_options replacement (used by PGT swap project)
            if (directOpts && typeof directOpts === 'object') {
                updates.tweet_options = directOpts;
            }
            // If image_prompt or thread_parts provided, merge into tweet_options
            else if (image_prompt || thread_parts !== undefined) {
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
IMAGE: [First identify the core subject and mood of your tweet in your head. Then write 2-3 sentences describing a visual scene that captures that subject and mood using the style guide above. Never depict text, URLs, or token symbols literally. 1:1]`;

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

            // Step 1: Extract clean concept from raw tweet
            const concept = await extractTweetConcept(tweetText);

            const imgPrompt = `Generate an image prompt for an AI image generator (Midjourney, DALL-E, Flux).

${concept ? 'CORE CONCEPT (extracted from the tweet — this is what the image should be ABOUT):\n' + concept + '\n' : ''}
Original tweet for reference: "${tweetText}"

${cfg.imageContext}

${sceneHint ? 'BASE SCENE for ' + pillarName + ' (adapt to the concept above): ' + sceneHint : ''}

${narrativeScene ? 'NARRATIVE INSPIRATION (borrow elements):\n' + narrativeScene : ''}

Create an image that captures the CORE CONCEPT and MOOD above using the style guide. The image should feel like it belongs with the tweet without literally depicting text, URLs, or token symbols.

Write ONE image prompt (2-3 sentences) that follows the style guide above precisely. Output ONLY the prompt, nothing else.`;

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
    const prefix = account === 'publicgoodstech' ? 'PUBLICGOODS' : (account === 'inclawbate' ? 'INCLAWBATE' : 'INCLAWBATOR');
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

// ── PGT Database-Driven Generation ──
// Picks least-mentioned projects from each tab, generates tweets ABOUT those specific projects
// Two template modes: 'spotlight' (one project) and 'overview' (multi-project / ecosystem-wide)

const ALL_PGT_TEMPLATES = [
    // Spotlight templates — pick ONE least-mentioned project
    { type: 'agents',   table: 'pgt_agents',       label: 'AI Agent Spotlight',    logoField: 'logo_url',   template: 'agent_spotlight',   mode: 'spotlight' },
    { type: 'builders', table: 'pgt_builders',      label: 'Builder Spotlight',     logoField: 'avatar_url', template: 'builder_spotlight', mode: 'spotlight' },
    { type: 'goods',    table: 'pgt_public_goods',  label: 'Public Good Highlight', logoField: 'logo_url',   template: 'public_good',       mode: 'spotlight' },
    // Overview templates — reference multiple projects or ecosystem stats
    { type: 'agents',   table: 'pgt_agents',       label: 'Ecosystem Map',         logoField: 'logo_url',   template: 'ecosystem_map',     mode: 'overview', overviewType: 'map' },
    { type: 'agents',   table: 'pgt_agents',       label: 'Top Agents Ranked',     logoField: 'logo_url',   template: 'top_agents',        mode: 'overview', overviewType: 'ranked' },
    { type: 'agents',   table: 'pgt_agents',       label: 'New on the Radar',      logoField: 'logo_url',   template: 'new_radar',         mode: 'overview', overviewType: 'recent' },
    { type: 'agents',   table: 'pgt_agents',       label: 'Category Deep Dive',    logoField: 'logo_url',   template: 'category_focus',    mode: 'overview', overviewType: 'category' },
    { type: 'agents',   table: 'pgt_agents',       label: 'Weekly Recap',          logoField: 'logo_url',   template: 'weekly_recap',      mode: 'overview', overviewType: 'recap' },
];

// Rotate templates: 2 groups of 4, alternate by day-of-year
const PGT_GROUP_A = [
    ALL_PGT_TEMPLATES[0], // agent_spotlight
    ALL_PGT_TEMPLATES[1], // builder_spotlight
    ALL_PGT_TEMPLATES[3], // ecosystem_map
    ALL_PGT_TEMPLATES[6], // category_focus
];
const PGT_GROUP_B = [
    ALL_PGT_TEMPLATES[2], // public_good
    ALL_PGT_TEMPLATES[4], // top_agents
    ALL_PGT_TEMPLATES[5], // new_radar
    ALL_PGT_TEMPLATES[7], // weekly_recap
];

// Fetch overview data for multi-project templates
async function fetchOverviewData(overviewType) {
    if (overviewType === 'ranked') {
        const { data } = await supabase.from('pgt_agents').select('name, x_handle, category, mentions_count')
            .eq('approved', true).order('mentions_count', { ascending: false }).limit(10);
        return data || [];
    }
    if (overviewType === 'recent') {
        const { data } = await supabase.from('pgt_agents').select('name, x_handle, category, created_at')
            .eq('approved', true).order('created_at', { ascending: false }).limit(8);
        return data || [];
    }
    if (overviewType === 'category') {
        // Get all agents, pick largest category
        const { data } = await supabase.from('pgt_agents').select('name, x_handle, category')
            .eq('approved', true).limit(100);
        const cats = {};
        (data || []).forEach(a => { const c = a.category || 'Other'; if (!cats[c]) cats[c] = []; cats[c].push(a); });
        const sorted = Object.entries(cats).sort((a, b) => b[1].length - a[1].length);
        // Pick a category that isn't the very top to add variety
        const pick = sorted[Math.floor(Math.random() * Math.min(3, sorted.length))];
        return pick ? { category: pick[0], agents: pick[1].slice(0, 8) } : { category: 'AI Agents', agents: [] };
    }
    if (overviewType === 'map') {
        const { data } = await supabase.from('pgt_agents').select('name, x_handle, category')
            .eq('approved', true).limit(50);
        const cats = {};
        (data || []).forEach(a => { const c = a.category || 'Other'; if (!cats[c]) cats[c] = []; cats[c].push(a); });
        return { categories: Object.entries(cats).sort((a, b) => b[1].length - a[1].length).slice(0, 6).map(([c, items]) => ({ name: c, count: items.length, handles: items.slice(0, 3).map(i => i.x_handle).filter(Boolean) })) };
    }
    if (overviewType === 'recap') {
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const [agents, builders, goods, newAgents] = await Promise.all([
            supabase.from('pgt_agents').select('id', { count: 'exact', head: true }).eq('approved', true),
            supabase.from('pgt_builders').select('id', { count: 'exact', head: true }).eq('approved', true),
            supabase.from('pgt_public_goods').select('id', { count: 'exact', head: true }).eq('approved', true),
            supabase.from('pgt_agents').select('name, x_handle').eq('approved', true).gte('created_at', weekAgo).order('created_at', { ascending: false }).limit(5),
        ]);
        const topMentioned = await supabase.from('pgt_agents').select('name, x_handle, mentions_count')
            .eq('approved', true).order('mentions_count', { ascending: false }).limit(5);
        return {
            totalAgents: agents.count || 0,
            totalBuilders: builders.count || 0,
            totalGoods: goods.count || 0,
            newThisWeek: newAgents.data || [],
            topMentioned: topMentioned.data || [],
        };
    }
    return [];
}

// Build prompt block for overview templates
function buildOverviewPromptBlock(slotType, overviewData, slotNum, timeStr) {
    const { overviewType, label } = slotType;
    let block = `${slotNum}. SLOT TYPE: ${label} (OVERVIEW) | POST TIME: ${timeStr}\n`;

    if (overviewType === 'ranked') {
        const list = overviewData.map((a, i) => `   ${i+1}. ${a.name} ${a.x_handle ? '(@' + a.x_handle.replace('@','') + ')' : ''} — ${a.mentions_count || 0} mentions`).join('\n');
        block += `   Write a tweet ranking or highlighting the top AI agents being tracked.\n   Reference these projects:\n${list}\n   Tag 3-5 @handles. Frame as "the most talked-about agents right now". Include publicgoods.tech`;
    } else if (overviewType === 'recent') {
        const list = overviewData.map(a => `   - ${a.name} ${a.x_handle ? '(@' + a.x_handle.replace('@','') + ')' : ''} [${a.category || 'AI'}]`).join('\n');
        block += `   Write a tweet about newly discovered AI agents worth watching.\n   New arrivals:\n${list}\n   Tag 3-4 @handles. Frame as "just hit our radar" or "new agents to watch". Include publicgoods.tech`;
    } else if (overviewType === 'category') {
        const cat = overviewData.category;
        const list = overviewData.agents.map(a => `   - ${a.name} ${a.x_handle ? '(@' + a.x_handle.replace('@','') + ')' : ''}`).join('\n');
        block += `   Write a tweet deep-diving into the "${cat}" category of AI agents.\n   Agents in this category:\n${list}\n   Tag 2-4 @handles. Frame as a category analysis or trend piece. Include publicgoods.tech`;
    } else if (overviewType === 'map') {
        const catLines = overviewData.categories.map(c => `   - ${c.name}: ${c.count} agents (${c.handles.map(h => '@' + h.replace('@','')).join(', ') || 'various'})`).join('\n');
        block += `   Write a tweet mapping out the AI agent ecosystem by category.\n   Categories:\n${catLines}\n   Tag 3-5 @handles across categories. Frame as "here's the landscape" overview. Include publicgoods.tech`;
    } else if (overviewType === 'recap') {
        const d = overviewData;
        const newList = d.newThisWeek.map(a => a.x_handle ? '@' + a.x_handle.replace('@','') : a.name).join(', ');
        const topList = d.topMentioned.map(a => a.x_handle ? '@' + a.x_handle.replace('@','') : a.name).join(', ');
        block += `   Write a weekly recap tweet for the AI agent ecosystem.\n   Stats: ${d.totalAgents} agents tracked, ${d.totalBuilders} builders, ${d.totalGoods} public goods\n   New this week: ${newList || 'none'}\n   Most mentioned: ${topList || 'n/a'}\n   Frame as a weekly roundup. Tag top handles. Include publicgoods.tech`;
    }
    return block;
}

async function generatePgtDrafts(req, res, targetDate, style) {
    const account = 'publicgoodstech';
    const date = targetDate || new Date(Date.now() + 86400000).toISOString().split('T')[0];

    // Check which slots are already booked
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
    const accountHours = ACCOUNT_HOURS[account] || VALID_HOURS;
    const emptyHours = accountHours.filter(h => !bookedHours.has(h));
    if (!emptyHours.length) {
        return res.json({ message: 'All slots filled', date });
    }

    // Rotate template groups by day-of-year (Group A on even days, Group B on odd)
    const dayOfYear = Math.floor((new Date(date + 'T12:00:00Z') - new Date(date.split('-')[0] + '-01-01T00:00:00Z')) / 86400000);
    const todaysTemplates = (dayOfYear % 2 === 0) ? PGT_GROUP_A : PGT_GROUP_B;
    console.log('[PGT Generate] date:', date, 'dayOfYear:', dayOfYear, 'group:', dayOfYear % 2 === 0 ? 'A' : 'B', 'emptyHours:', emptyHours);

    // Build picks for each empty slot
    const picks = [];
    const usedIds = new Set();
    for (let i = 0; i < emptyHours.length && i < todaysTemplates.length; i++) {
        const slotType = todaysTemplates[i];
        const hour = emptyHours[i];
        const etHour = ((hour - 4 + 24) % 24);
        const ampm = etHour >= 12 ? 'PM' : 'AM';
        const h12 = etHour === 0 ? 12 : etHour > 12 ? etHour - 12 : etHour;
        const timeStr = `${h12} ${ampm} ET`;

        if (slotType.mode === 'spotlight') {
            // Pick one least-mentioned project
            const { data: candidates } = await supabase
                .from(slotType.table)
                .select('*')
                .eq('approved', true)
                .order('mentions_count', { ascending: true, nullsFirst: true })
                .order('last_mentioned', { ascending: true, nullsFirst: true })
                .limit(10);

            const pick = (candidates || []).find(c => !usedIds.has(c.id));
            if (pick) {
                usedIds.add(pick.id);
                picks.push({ ...slotType, project: pick, hour, timeStr, overviewData: null });
            }
        } else {
            // Overview template — fetch multi-project data
            const overviewData = await fetchOverviewData(slotType.overviewType);
            picks.push({ ...slotType, project: null, hour, timeStr, overviewData });
        }
    }

    if (!picks.length) {
        return res.json({ message: 'No projects in database to generate from', date, generated: 0 });
    }

    // Build batch prompt — different blocks for spotlight vs overview
    const promptBlocks = picks.map((p, i) => {
        if (p.mode === 'spotlight' && p.project) {
            const proj = p.project;
            const handle = proj.x_handle ? '@' + proj.x_handle.replace('@', '') : proj.name;
            const desc = proj.description || proj.bio || 'No description available';
            const cat = proj.category || proj.skills?.join(', ') || '';
            const chain = proj.chain || '';
            const website = proj.website || '';
            return `${i + 1}. SLOT TYPE: ${p.label} (SPOTLIGHT) | POST TIME: ${p.timeStr}
   PROJECT: ${proj.name} (${handle})
   CATEGORY: ${cat} | CHAIN: ${chain}
   DESCRIPTION: ${desc}
   WEBSITE: ${website}
   Write a tweet spotlighting this project. Tag ${handle}. Be specific about what they do.`;
        } else {
            return buildOverviewPromptBlock(p, p.overviewData, i + 1, p.timeStr);
        }
    }).join('\n\n');

    const batchPrompt = `You are @publicgoodstech, an AI agent ecosystem tracker and news source. Your voice is informed, concise, neutral but excited about the space. You're a crypto-native tech journalist — not a shill. Your site: publicgoods.tech

Generate ${picks.length} tweets. There are TWO types of slots below:
- SPOTLIGHT slots: write about the ONE specific project listed. Tag their @handle. Be specific about what they do.
- OVERVIEW slots: write about the ECOSYSTEM or MULTIPLE projects. Tag 3-5 @handles. Big-picture perspective.

Rules for ALL tweets:
- Keep under 280 chars
- No hashtags, no corporate speak, no "excited to announce"
- No em dashes
- Vary tone: some analytical, some casual, some "hot take"
- Lowercase is fine

${promptBlocks}

Format each response EXACTLY like:
1. TWEET: [tweet text]
2. TWEET: [tweet text]
...

Do NOT include IMAGE prompts — images are handled separately.`;

    try {
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getGroqKey() },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                max_tokens: 2000,
                temperature: 0.9,
                messages: [{ role: 'user', content: batchPrompt }]
            })
        });
        const data = await resp.json();
        if (data.error) return res.status(500).json({ error: 'AI generation failed: ' + (data.error.message || data.error) });

        const rawText = data.choices?.[0]?.message?.content || '';
        console.log('[PGT Generate] Raw AI response:', rawText.substring(0, 500));
        const cleanText = rawText.replace(/\*\*/g, '');
        const tweetBlocks = cleanText.split(/\n*\d+[\.\)]\s*/);
        const tweets = [];
        for (const block of tweetBlocks) {
            const m = block.match(/TWEET:\s*([\s\S]*?)$/i);
            if (m) {
                let text = m[1].replace(/^["']|["']$/g, '').replace(/\\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
                if (text.length > 0 && text.length <= 4000) tweets.push(text);
            }
        }
        if (tweets.length === 0 && cleanText.length > 20) {
            console.log('[PGT Generate] TWEET: parsing failed, trying fallback');
            const lines = cleanText.split(/\n/).filter(l => l.trim().length > 20);
            for (const line of lines) {
                let text = line.replace(/^\d+[\.\)]\s*/, '').replace(/^TWEET:\s*/i, '').replace(/^["']|["']$/g, '').trim();
                if (text.length > 20 && text.length <= 4000 && tweets.length < picks.length) {
                    tweets.push(text);
                }
            }
        }
        console.log('[PGT Generate] Parsed', tweets.length, 'tweets from', picks.length, 'picks');

        // Insert drafts
        const drafts = [];
        for (let i = 0; i < picks.length && i < tweets.length; i++) {
            const p = picks[i];
            const hour = p.hour;
            const slotTime = new Date(date + 'T00:00:00Z');
            if (hour < 6) slotTime.setDate(slotTime.getDate() + 1);
            slotTime.setUTCHours(hour, 0, 0, 0);

            // Build tweet_options based on mode
            const tweetOpts = {
                pillar: 'Daily Coverage',
                angle: p.label,
                style: style || 'mixed',
                pgt_template: p.template,
            };

            let contentAngle = p.label;
            if (p.mode === 'spotlight' && p.project) {
                const proj = p.project;
                tweetOpts.pgt_project_id = proj.id;
                tweetOpts.pgt_project_name = proj.name;
                tweetOpts.pgt_project_handle = proj.x_handle;
                tweetOpts.pgt_project_logo = proj[p.logoField];
                tweetOpts.pgt_project_type = p.type;
                contentAngle = `${p.label}: ${proj.name}`;
            } else {
                tweetOpts.pgt_overview = true;
            }

            const { data: inserted, error } = await supabase
                .from('agent_schedule')
                .insert({
                    scheduled_at: slotTime.toISOString(),
                    booked_by_wallet: 'system-autofill',
                    content_angle: contentAngle,
                    tone: 'default',
                    status: 'needs_review',
                    tweet_text: tweets[i],
                    tweet_options: tweetOpts,
                    account,
                })
                .select()
                .single();

            if (!error && inserted) {
                drafts.push(inserted);
                // Increment mentions_count for spotlight picks
                if (p.mode === 'spotlight' && p.project) {
                    await supabase.from(p.table)
                        .update({
                            mentions_count: (p.project.mentions_count || 0) + 1,
                            last_mentioned: new Date().toISOString(),
                        })
                        .eq('id', p.project.id);
                }
            }
        }

        return res.json({ date, generated: drafts.length, empty_slots: emptyHours.length, drafts, mode: 'pgt_database', group: dayOfYear % 2 === 0 ? 'A' : 'B' });
    } catch(e) {
        return res.status(500).json({ error: 'PGT generation failed: ' + e.message });
    }
}

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
    const accountHours = ACCOUNT_HOURS[account] || VALID_HOURS;
    const emptyHours = accountHours.filter(h => !bookedHours.has(h));
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
- ${account === 'publicgoodstech' ? 'ALWAYS tag the project you are covering with their @handle. Every post should @mention at least one project. This is how we drive engagement — they retweet, their audience sees us.' : 'NEVER mention any person\'s name, handle, or username. No @mentions, no names, no shoutouts. Talk about the platform, apps, and what\'s possible — not individuals.'}
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

${account === 'inclawbate' ? `EXAMPLES of tweet → image connection (Living Architecture style — systems, flows, infrastructure as art):
- Tweet "the engine feeds itself" → "Isometric cross-section of a self-sustaining engine on dark charcoal background. Golden liquid flows through transparent pipes in a visible loop — out from a glowing treasury chamber, through smaller modules, and back. Coral accent lights at junctions. Architectural, alive. 1:1"
- Tweet "staking rewards are real" → "Transparent pipe network on dark background — golden liquid flowing through valves into a staking chamber where it accumulates, pressure gauges with coral indicators showing growth. Financial plumbing rendered as beautiful engineering. 1:1"
- Tweet "the council voted on allocation" → "Amphitheater ring around an engine core — each seat projects a teal vote light, golden allocation arrows flowing from center to destinations. Governance as architecture. Dark background, overhead view. 1:1"

Each image should feel SYSTEMIC — infrastructure, cross-sections, flows, architecture. Dark charcoal backgrounds, coral/gold/teal accents. NO craft objects, NO nature still-lifes, NO humans, NO mascot.` : `EXAMPLES of tweet → image connection:
- Tweet "108 apps and counting" → "A single glowing consciousness node floating in a vast dark void, over a hundred thin golden threads radiating outward — each connecting to a tiny floating app portal. The portals form a spiral galaxy pattern around the coral-red mind core. Bioluminescent, concept art, 8k, 1:1"
- Tweet "staking rewards are real" → "Golden value streams flowing through a bioluminescent neural network against deep black. At the center, the coral consciousness core pulses serenely as crystalline formations grow slowly along the pathways — value accumulating, managed, alive. Zen energy, 1:1"
- Tweet "which app would you build first" → "The consciousness core with two bright neural tendrils extending in different directions, each ending at a different glowing portal. The paths diverge, each one beautiful. The mind contemplates which to pour energy into. Coral and teal split, dark void, 1:1"

Each image MUST look different — vary compositions between: aerial views of the network, intimate close-ups of the mind core, wide shots showing mind-to-body connections, abstract macro of neural pathways.`}

${emptyHours.map((h, i) => `${i + 1}. Angle: "${angles[i % angles.length]}" — Posts at ${getTimeOfDay(h)}. ${getGreetingRule(h)}`).join('\n')}

Format each entry as:
TWEET: [the tweet text]
IMAGE: [First identify the core SUBJECT and MOOD of your tweet — ignore @mentions, URLs, $symbols. Then write 2-3 sentences describing a visual scene that captures that subject and mood using the style guide above. Never depict text, URLs, or token symbols literally. 1:1]

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
