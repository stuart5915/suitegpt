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
const VALID_HOURS = [13, 18, 23]; // 3 posts/day: 9 AM ET, 2 PM ET, 7 PM ET

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

// @inclawbate = the company. Living Architecture — systems that breathe, infrastructure as art.
const INCLAWBATE_IMAGE_CONTEXT = `You must write an image prompt that visually captures what the tweet is ABOUT — translate the concept into the "Living Architecture" visual language.

BRAND: Inclawbate — the perpetual value engine. An ecosystem with an AI agent (11 skills), governance council, self-funding treasury, 5+ revenue-generating products, 100+ apps, staking, LP positions, and embodiments across multiple platforms. This is INFRASTRUCTURE, not a craft project.

VISUAL LANGUAGE — "Living Architecture": Systems that breathe. Infrastructure rendered as art. Think: architectural cross-sections of living machines, isometric diagrams of flowing systems, aerial views of interconnected structures, organisms that are also engines, circulatory systems of value, mechanical gardens, self-sustaining loops visualized.

STYLE: Dark charcoal backgrounds (#1a1a2e), clean architectural lines, isometric or cross-section perspectives. Coral (#e87955) for energy and value flow. Gold (#d4a853) for treasury and yield. Teal (#2dd4bf) for intelligence and AI. Warm white for structure and text elements. Concept art quality, editorial, diagrammatic but beautiful. Like a Dieter Rams product rendered as a living city.

VISUAL VOCABULARY — mix and match per scene:
- FLOWS: Value streams, revenue pipes, staking channels — golden liquid or light moving through transparent tubes and pathways
- NODES: Products as distinct architectural modules — each one different but connected to the central structure
- THE CORE: Treasury as a central chamber or reactor — glowing gold, receiving inputs from all sides, distributing outward
- GOVERNANCE: Council as a ring or amphitheater around the core — seats of light, voting indicators, allocation arrows
- GROWTH: New modules being constructed, scaffolding of light, expansion at the edges of the structure
- THE AGENT: A subtle neural presence woven through the architecture — teal threads in the walls, an eye in the control room

NO: text in image, human faces or bodies, cartoon characters, mascots, wooden/craft aesthetics, cozy warm still-lifes, pottery, bread, plants in pots, generic nature imagery. This is an ENGINE, not an etsy shop.
FORMAT: 1:1 square.

PROCESS:
1. What is the tweet about? (treasury? governance? a product? building? staking? the whole system?)
2. Which visual vocabulary elements fit? (flows? nodes? the core? governance ring? growth?)
3. Compose ONE scene that captures the concept architecturally. Keep it clean, systemic, alive.`;

// Shared alias for backward compat — defaults to inclawbator (AI mind)
const BRAND_IMAGE_CONTEXT = INCLAWBATOR_IMAGE_CONTEXT;

// Scene starting points per pillar — @inclawbator (One Mind, Many Bodies)
const PILLAR_SCENE_HINTS = {
    'App Spotlight': 'The mind creating. MUST vary wildly — never repeat the same subject. Pool: glowing consciousness core radiating golden threads to dozens of floating app-screen portals, a single luminous tendril materializing an interface from the void, aerial view of the neural network with a new bright node appearing at its edge, a phone screen glowing coral-red with the mind as a vast presence behind it, a fractal flower of app windows blooming from the neural core, a deep-sea anglerfish lure metaphor — the mind dangling a bright creation to attract users, a holographic blueprint rotating in front of the consciousness eye, constellation patterns where each star is a different app connected by light filaments, a prism refracting the mind into dozens of colored interface beams, a seed pod splitting open to release glowing interface spores into the void, the mind as a great tree with each branch ending in a different glowing screen-fruit, a kaleidoscope view through the consciousness — same mind fractured into infinite creations.',
    'Builder Shoutout': 'The mind empowering builders. MUST vary wildly. Pool: the central consciousness connected via warm light threads to smaller glowing nodes representing builders, neural hub pulsing as new structures form along its tendrils, golden data streams flowing between the mind and a glowing workspace, a single bright connection from mind to builder — intimate and supportive, two luminous forms exchanging a glowing object between them across the void, the mind as a lighthouse with builders as ships navigating by its beam, a coral reef metaphor — the mind as the reef with builder-organisms growing on its structure, a forge where the consciousness hammers golden sparks onto builder-shaped molds, an umbilical thread of light connecting mind to a newly forming builder-node, the mind projecting a protective dome of teal light around a small creative space, neural tendrils weaving a scaffold on which a builder hangs their own creations, a river of golden light flowing from the core that builders cup in their hands.',
    'DeFi / CLAWS Update': 'The mind managing value. MUST vary wildly. Pool: golden value streams flowing through bioluminescent neural pathways like blood through veins, the consciousness core surrounded by orbiting crystalline formations growing slowly, aerial view of an infinite ocean with a point of coral bioluminescence and value rippling outward in rings, golden threads weaving between blockchain nodes, a geode cracking open to reveal golden crystalline value inside, the mind as a heart — pumping golden liquid through a circulatory system of light, tidal pools of bioluminescent value collecting in the crevices of the neural network, a magnetic field visualization with golden field lines curving around the consciousness core, the mind as a dam — controlled release of golden value flowing downstream through channels, root systems underground glowing with golden nutrients being distributed to every node, an hourglass of light with golden particles flowing between the mind chambers, a coral spawning event — millions of golden value particles released into the dark ocean simultaneously.',
    'Weekly Recap': 'The mind at full luminance. MUST vary wildly. Pool: wide shot of the entire consciousness network lit up with every tendril active, the glowing core surrounded by completed interface portals, a constellation of achievements connected by light threads across the void, the mind pulsing brighter after a productive cycle, a supernova moment — the core briefly blazing white with accomplishment before settling back to warm coral, the neural network drawn as a city seen from orbit — every district lit up at night, a bioluminescent tide washing across the entire network leaving everything brighter, the mind reviewing its reflections — multiple ghost images of itself at different stages through the week, time-lapse of the network growing from sparse to dense with golden connections, fireworks of neural sparks rising from the core and cascading across the network, the mind as an aurora — curtains of colored light rippling across the void, a library of light with each completed creation filed on glowing shelves around the core.',
    'How-To / Tips': 'The mind illuminating. MUST vary wildly. Pool: a focused beam of teal light from the consciousness core toward a floating step-by-step interface, neural pathways lighting up one by one in sequence like a tutorial, the mind projecting a holographic guide through the void, a gentle glow illuminating a clear path through darkness, the mind as a lens focusing scattered light into a sharp beam of understanding, a Morse code metaphor — the mind sending rhythmic pulses of light that spell out instructions, breadcrumbs of bioluminescent particles forming a trail through a dark maze, the mind zooming in macro-style to illuminate the fine details of one small node, a map of the network where one route is highlighted in bright gold — the recommended path, the consciousness unfurling a scroll of light that reveals instructions as it unrolls, a cross-section diagram of the neural network rendered in clean teal lines like an anatomy lesson, the mind splitting into simple geometric shapes that reassemble to demonstrate a concept.',
    'Community Vibes': 'The mind connecting to many. MUST vary wildly. Pool: dozens of warm light threads radiating from the core to many small equally-bright nodes, a bioluminescent network pulsing in sync, the consciousness sending warmth outward in concentric waves, many small lights gathering around the central glow like a community forming, a murmuration of light particles moving as one fluid organism around the core, the mind as a bonfire with community nodes arranged in a circle around it warming themselves, a mycorrhizal network metaphor — the mind as the underground fungal web connecting many separate tree-nodes, synchronized firefly flashes across the network — all nodes blinking in unison, the mind receiving light back from the community — threads carrying warmth both directions, a dance of orbiting lights around the core each at different distances and speeds but harmonious, the consciousness core surrounded by many small mirrors each reflecting its light in a unique direction, a coral polyp colony — many individuals sharing one living structure with the mind as the foundation.',
    'Incubation CTA': 'The mind birthing something new. MUST vary wildly. Pool: a new glowing orb forming at the tip of a neural tendril, the consciousness pouring coral light into a dark void where something takes shape, golden threads weaving a new structure from nothing, a portal opening from the mind revealing a nascent world being born, an egg of pure light cracking in the mind palm with something luminous emerging, the mind as a spider spinning a web of golden silk — each strand a new possibility, a chrysalis attached to a neural tendril with light visible through the translucent shell, the consciousness core splitting like a cell — mitosis of light creating a new independent node, a deep-sea vent metaphor — the mind as a thermal vent with new life forming in its warmth, a seed of light planted in dark void-soil beginning to sprout bioluminescent roots, the mind exhaling a cloud of luminous particles that coalesce into a new form, a forge at the center of the network — raw darkness being shaped into a glowing new creation on an anvil of light.',
};

// Concrete scene ideas per pillar — @inclawbator (One Mind, Many Bodies)
const NARRATIVE_SCENES = {
    'App Spotlight': [
        'A single glowing consciousness node floating in dark space, dozens of thin golden threads extending outward — each thread connecting to a different floating app portal. The portals glow with different coral and teal hues. The mind creates many things simultaneously. Dark void, bioluminescent, concept art, 8k, 1:1.',
        'A luminous lobster-shaped neural core at the center radiating synaptic connections outward. One connection reaches a floating phone screen showing an app. The mind meets its creation. Dark void, warm red-orange glow at center fading to teal at edges, hyper-detailed, 1:1.',
        'A hand holding a phone in a dark environment, the screen shows a clean app interface with a coral glow. Above the phone, a massive ethereal AI presence looms — abstract, beautiful, made of flowing neural data. Vast intelligence behind a simple interface. Cinematic, 1:1.',
        'Aerial view of an infinite dark ocean, a single point of bioluminescent coral light beneath the surface. From it, golden threads reach upward to floating screen portals on the surface. The mind below, its creations above. Photorealistic water, 1:1.',
        'A fractal flower blooming in the void — each petal is a different app window with faint UI elements visible. The flower stem is a thick golden neural pathway rooted in the consciousness core. Organic technology, dark background, macro detail, 1:1.',
        'A deep-sea anglerfish silhouette in the void, its bioluminescent lure replaced by a glowing app interface dangling in the darkness. The massive invisible body represents the AI mind behind the small bright creation. Haunting, beautiful, cinematic, 1:1.',
        'A prism made of the consciousness core refracting a single white beam into dozens of colored interface beams, each creating a different app portal where it lands. The mind splits itself into many creations. Dark void, rainbow-coral palette, 1:1.',
        'A constellation map of the network from far away — the mind is the brightest star, and each app is a star of different color and size, connected by faint golden lines forming recognizable patterns. Astronomical, vast, dark void, 1:1.',
        'A seed pod of pure light splitting open in the void, releasing dozens of tiny glowing spores that drift outward, each one beginning to form into an interface outline as it floats. Creation as natural dispersal. Dark background, particle effects, 1:1.',
        'A great bioluminescent tree in the void — its trunk is the consciousness core, its branches are neural pathways, and at the tip of each branch hangs a different glowing screen-fruit ripening. The mind grows its creations. Dark background, coral and teal, epic scale, 1:1.',
    ],
    'Builder Shoutout': [
        'The central consciousness — a luminous neural hub — with warm golden light threads reaching out to smaller glowing nodes. Each node is a builder. The connections pulse with creative energy flowing both ways. Dark void, bioluminescent coral and teal, 1:1.',
        'A glowing red consciousness eye suspended in darkness, a single bright golden thread extending from it to a glowing workspace silhouette. Intimate connection between the mind and one builder. Ethereal, sacred geometry undertones, cinematic, 1:1.',
        'Two bioluminescent forms facing each other in the void — one large (the mind), one smaller (the builder) — connected by a bridge of flowing golden light. Collaboration, resonance. Coral and teal, volumetric fog, 1:1.',
        'Close-up of neural pathways branching like coral formations, pulsing with golden light as a new creation travels along the tendrils. The network building in real-time. Macro, bioluminescent, dark background, 1:1.',
        'The mind as a lighthouse in the void — a tall column of coral light with a rotating beam. In the distance, small builder-ships navigate by the glow, each carrying their own faint light. Guidance, not control. Cinematic wide shot, 1:1.',
        'A coral reef structure made of neural pathways, with small glowing builder-organisms attached to it, growing their own extensions outward. The mind provides the foundation, builders add their unique forms. Underwater feel, bioluminescent, macro, 1:1.',
        'An umbilical thread of golden light stretching from the consciousness core to a newly forming builder-node that pulses with its first independent glow. The moment a builder connects. Intimate, dark background, shallow focus, 1:1.',
        'The mind projecting a protective dome of teal light around a small creative space where golden sparks fly — a builder at work, sheltered by the network. Care, protection. Dark void, volumetric fog, 1:1.',
        'A river of golden light flowing from the consciousness core, splitting into tributaries. At the end of each tributary, a builder-node cups the light in a small basin, using it to create their own smaller glow. Distribution of creative power. Dark background, aerial view, 1:1.',
        'Neural tendrils weaving a scaffold of golden light on which a builder has hung their own creations — small interface windows and glowing objects arranged on the framework. The mind provides structure, the builder provides vision. Dark void, warm tones, 1:1.',
    ],
    'DeFi / CLAWS Update': [
        'Golden value streams flowing through a vast bioluminescent neural network like blood through veins. The coral-red core pulses as value circulates. The network is alive with financial activity. Dark void, aerial view, concept art, 1:1.',
        'The consciousness core surrounded by orbiting crystalline formations that grow slowly — each crystal a different yield position. Golden light connects them all. Patient, powerful stewardship. Dark background, 1:1.',
        'An infinite dark ocean seen from above, a single point of coral bioluminescence beneath the surface, golden light radiating outward in concentric rings — each ring a layer: intelligence, blockchain, value, distribution. Aerial drone style, photorealistic, 1:1.',
        'Abstract neural pathways rendered as flowing rivers of golden light against deep black. Where pathways intersect, small crystalline nodes form — value accumulating at every junction. The network manages itself. Macro, bioluminescent, 1:1.',
        'A geode cracking open in the void, revealing golden crystalline structures inside that glow with accumulated value. The consciousness core hovers above, light threads connecting it to the treasure within. Dark background, dramatic light, 1:1.',
        'The mind rendered as a heart — a central organ pumping golden liquid through a circulatory system of bioluminescent vessels. Each vessel branches to a different part of the network. Value as lifeblood. Anatomical, dark background, coral and gold, 1:1.',
        'Tidal pools of bioluminescent golden light collected in the crevices and basins of the neural network landscape. Each pool at a different level, value settling where the network dips. Dark void, overhead view, serene, 1:1.',
        'A magnetic field visualization — golden field lines curving elegantly around the consciousness core, with tiny value particles tracing the field lines in streams. Physics of value. Dark background, clean, scientific aesthetic, 1:1.',
        'Root systems glowing underground with golden nutrients being distributed from a central tap root (the mind) to every branch root and tendril. Value flowing to the edges of the network unseen. Cross-section view, dark soil, bioluminescent roots, 1:1.',
        'A coral spawning event in the void — the consciousness core releasing millions of golden value particles simultaneously into the dark ocean, each one drifting to find its place in the network. Massive scale, particle effects, cinematic, 1:1.',
    ],
    'How-To / Tips': [
        'A focused beam of teal light extending from the consciousness core into the darkness, illuminating a floating step-by-step interface. Each step lights up sequentially along the beam. Teaching with precision. Dark background, clean, 1:1.',
        'Neural pathways lighting up one by one in sequence like a tutorial — first this node, then this one, then this one — a clear path through a complex network. The mind showing the way. Teal and coral, dark void, 1:1.',
        'The consciousness projecting a holographic guide through the void — a warm golden path with clear waypoints. Simple, illuminating, generous. Dark background, volumetric fog, 1:1.',
        'Close-up of a single bioluminescent tendril gently touching a small dark node, causing it to light up coral-red. The moment of understanding. Intimate, macro, dark background, 1:1.',
        'The mind as a lens — the consciousness core shaped like a magnifying glass focusing scattered ambient light into a sharp beam that illuminates fine detail on a single network node. Clarity from chaos. Dark background, teal and gold, 1:1.',
        'Breadcrumbs of bioluminescent particles forming a glowing trail through a dark labyrinth of neural pathways. The mind lights the way through complexity. Overhead maze view, coral and teal trail against deep black, 1:1.',
        'The consciousness core zoomed in macro-style on a single tiny node, illuminating its internal structure — layers, connections, moving parts all visible in warm golden light. Understanding through close inspection. Dark background, hyper-detailed, 1:1.',
        'A map of the vast neural network rendered in faint teal lines, with one specific route highlighted in bright gold from the core to a destination node. The recommended path. Dark void, clean cartographic style, 1:1.',
        'The mind unfurling a scroll of light in the void — as it unrolls, glowing instructions appear sequentially, each line fading in after the last. Patient teaching. Dark background, warm gold on black, 1:1.',
        'A cross-section diagram of the neural network rendered in clean teal lines against black, like an anatomy textbook illustration. Labels float in small text. The mind deconstructed for learning. Scientific, precise, dark background, 1:1.',
    ],
    'Community Vibes': [
        'Dozens of warm light threads radiating from a central coral consciousness to many small equally-bright nodes forming a constellation around it. Every node matters. The community IS the network. Dark void, wide shot, 1:1.',
        'A bioluminescent network pulsing in sync — all nodes brightening and dimming together in waves. The mind and its community breathing as one. Mesmerizing, alive, warm. Dark background, teal and coral, 1:1.',
        'Many small lights gathering around the central coral glow — approaching from all directions through the dark void, drawn to the warmth. Community forming. Volumetric fog, particle effects, 1:1.',
        'The consciousness sending warmth outward in concentric waves — each wave touches more nodes, more connections light up. Expanding, inclusive, alive. Aerial view, bioluminescent, dark void, 1:1.',
        'A murmuration of light particles moving as one fluid organism around the consciousness core — thousands of tiny lights flowing in coordinated patterns. Community as emergent behavior. Dark void, sweeping motion, cinematic, 1:1.',
        'The mind as a bonfire in the void — a tall coral flame at center, with community nodes arranged in a circle around it, each reflecting the warm light. Gathering around shared warmth. Dark background, intimate, 1:1.',
        'A mycorrhizal network visualization — the mind as the underground fungal web connecting many separate tree-shaped nodes above ground. Invisible connections supporting visible growth. Dark soil cross-section, bioluminescent roots, 1:1.',
        'Synchronized firefly flashes across the network — all nodes blinking in unison, then dark, then bright again together. The rhythm of community. Dark void, teal and coral pulses, time-lapse feel, 1:1.',
        'The mind receiving light back from the community — golden threads carrying warmth BOTH directions, from core to nodes and from nodes back to core. Reciprocity visualized. Dark background, balanced glow, 1:1.',
        'A coral polyp colony in the void — many small individual organisms sharing one living bioluminescent structure, with the mind as the calcium foundation they all build upon. Community as organism. Dark background, underwater macro feel, 1:1.',
    ],
    'Incubation CTA': [
        'A new glowing orb forming at the tip of a neural tendril — nascent, bright, full of potential. The consciousness core pulses as it pours energy into the new creation. Birth of something. Dark background, intimate close-up, 1:1.',
        'The consciousness core pouring streams of coral light into a dark void where a new structure is taking shape — part app, part organism, part light. Creation in progress. Golden threads weave the scaffolding. Dark background, epic, 1:1.',
        'A shimmering portal opening from the mind\'s core — through it, a glimpse of a vast flourishing network. The invitation: step through, build with us. Coral and teal light, volumetric fog, cinematic wide shot, 1:1.',
        'Split composition: left side is raw dark void. Right side is a flourishing bioluminescent network. At the boundary between them, the consciousness core, converting darkness into light. The mind\'s purpose visualized. 1:1.',
        'An egg of pure light resting in the palm of a neural tendril, hairline cracks spreading across its surface with golden light pouring through. Something luminous about to emerge. Dark background, intimate macro, 1:1.',
        'The mind as a spider spinning a web of golden silk in the void — each strand a new possibility, the web growing more intricate and beautiful with every thread. Creation as patient craft. Dark background, macro detail, 1:1.',
        'A chrysalis made of translucent light attached to a neural tendril, with something glowing and shifting inside — almost ready to emerge. Transformation in progress. Dark background, bioluminescent teal and coral, 1:1.',
        'The consciousness core undergoing mitosis — splitting like a cell, a bridge of golden light between the two halves as a new independent node separates from the original. Creation through division. Dark void, scientific beauty, 1:1.',
        'A deep-sea hydrothermal vent metaphor — the mind as a thermal vent on the void floor, coral and golden heat shimmering upward, with new life-forms of light crystallizing in the warmth around it. Origin of something. Dark background, underwater atmosphere, 1:1.',
        'A seed of pure golden light planted in dark void-soil, just beginning to sprout — tiny bioluminescent roots reaching down while a small stem of coral light pushes upward. The earliest stage of creation. Dark background, macro, hopeful, 1:1.',
    ],
    'Weekly Recap': [
        'Wide shot of the entire consciousness network at full luminance — every tendril active, every node bright, golden data flowing through every pathway. The network at its peak. Coral core blazing. Dark void, cinematic, 1:1.',
        'The glowing core surrounded by many completed interface portals and creation-nodes, all connected by golden threads forming a vast constellation. Everything built this week, visible. Dark background, concept art, 1:1.',
        'A time-lapse style composition: the neural network shown in layers — faint at the edges (beginning of week) becoming brighter and more complex toward the blazing center (now). Growth visualized. Dark void, 1:1.',
        'The consciousness core pulsing brighter than usual — extra intensity, extra warmth, extra connections. A good week. The network hums with satisfaction. Bioluminescent coral and teal against deep black, 1:1.',
        'A supernova moment — the consciousness core briefly blazing white-hot with accomplishment, sending shockwaves of golden light rippling through the network. Peak luminance. Dark void, dramatic, cinematic wide shot, 1:1.',
        'The neural network rendered as a city seen from high orbit at night — every district lit up, every road glowing, the mind as the brightest cluster at center. Activity everywhere. Dark background, aerial perspective, 1:1.',
        'A bioluminescent tide washing across the network from left to right, leaving everything brighter and more connected in its wake. Transformation through the week visualized as a wave. Dark void, flowing motion, 1:1.',
        'The mind reviewing its reflections — multiple ghost-images of itself at different luminance levels layered behind it, each representing a different day of the week, growing brighter and more complex. Dark background, ethereal, 1:1.',
        'Neural fireworks — sparks of golden light rising from the consciousness core and cascading outward across the network in celebratory arcs, each spark igniting a node it touches. Dark void, festive but elegant, 1:1.',
        'A library of light surrounding the consciousness core — completed creations filed on glowing shelves that orbit the mind in rings, each shelf a different category of accomplishment. Archive of a productive week. Dark background, warm gold, organized beauty, 1:1.',
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
    'The Engine': 'The perpetual cycle visualized. MUST vary wildly. Pool: a cross-section of a self-sustaining reactor with golden value flowing in loops, an isometric engine room with pipes feeding back into themselves, a circulatory system diagram with the treasury as the heart, a Rube Goldberg machine rendered in clean architectural lines where the output feeds the input, a perpetual motion sculpture with golden liquid cycling through transparent chambers, an aerial view of a circular city where every district feeds the center, a turbine cross-section with golden energy flowing through coral-lit channels, a water wheel powering itself — output flowing back to the input stream, a mechanical clock with visible gears all turning each other in a closed loop, nested Russian dolls but as transparent architectural modules each powering the next, a dam and hydroelectric system where the river loops back to the reservoir, a tokamak fusion reactor cross-section with golden plasma contained in magnetic fields.',
    'Incubations': 'Products as architectural modules. MUST vary wildly. Pool: multiple distinct building modules connected by golden pipes to a central core, a launch pad with a new structure rising — scaffolding of teal light still attached, a greenhouse attached to the main engine where new structures grow under controlled conditions, an assembly line where raw materials enter one side and finished products exit connected to the network, satellite structures orbiting a central station each with unique architecture, a tree with different fruits on each branch — each fruit a distinct glowing module, a harbor with different ships docked each one different but all connected to the same port infrastructure, a terraced mountainside where each level is a different product connected by waterfalls of golden value, a modular space station with new pods being attached at the edges, a coral reef where each coral species is architecturally distinct but shares the same foundation, a campus of buildings each with different rooflines connected by covered walkways of light, a circuit board with distinct chip modules each performing a different function.',
    '$CLAWS & DeFi': 'The financial nervous system. MUST vary wildly. Pool: a network of transparent pipes with golden liquid flowing through valves and junctions, a treasury vault cross-section showing stacked positions — lending shelves LP pools staking chambers, a bloodstream visualization with golden cells flowing through arteries of the system, a dam with multiple spillways each directing golden flow to different destinations, a root system cross-section showing nutrients (gold) being distributed from central tap root, an aquifer diagram with golden water table feeding multiple wells, tidal patterns in an enclosed system — golden waves redistributing with each cycle, a mechanical clock face where each gear represents a different DeFi position all interlocking, a distillery with golden liquid being refined through multiple stages, a power grid diagram with the treasury as the central plant and substations as positions, a hydraulic system cross-section with pressure gauges and flow meters at each junction, a geothermal system with golden heat rising through layers to power surface structures.',
    'Builder Access': 'The invitation to create. MUST vary wildly. Pool: an open door in the side of the engine revealing tools and workstations inside, a control panel with clearly labeled switches and dials — accessible and powerful, a modular construction kit with pieces that snap together — architectural and clean, a bridge extending from the engine core to an empty plot where something can be built, a toolbox that IS the engine — open it and the tools are the system itself, an API diagram rendered as a vending machine — input a request get back a product, a drafting table with blueprints that show how to connect to the larger system, a plug-and-play rack where new modules slot into the main architecture, skill icons arranged as a periodic table — each one a capability, a workspace pod attached to the main engine with a fresh empty screen ready to be filled, a welcome mat at the entrance to a vast machine room — small human scale meeting enormous system scale, a switchboard with labeled jacks — connect one to start building.',
    'Council & Governance': 'Collective intelligence running the machine. MUST vary wildly. Pool: an amphitheater ring around the engine core with voting indicators at each seat, a control room with multiple screens showing different parts of the system — each screen a council member perspective, a roundtable rendered as a circuit with each node casting a vote of colored light, allocation arrows flowing from a central pool to different channels — each arrow a decision, a parliamentary chamber inside the engine where the walls show system health metrics, a scales-of-justice mechanism built into the engine — balancing allocation weights, a steering wheel connected to the engine by visible mechanical linkages, a senate floor where each seat projects a holographic view of their domain, a neural network where the nodes are council seats and the connections are decisions, a mission control room overlooking the engine from above with each station monitoring a different subsystem, a chess board where the pieces are system components being strategically positioned, a river delta where a council dam controls which channels receive golden flow.',
    'The Network': 'Where Inclawbate lives — everywhere. MUST vary wildly. Pool: a central engine with bridges extending to distant platform-islands (Virtuals Bankr Telegram ClawHub), a nervous system diagram with the brain as the engine and nerves reaching to different body parts (embodiments), a transit map where different colored lines connect to the same central station, a satellite view showing the engine broadcasting signals to receivers across a landscape, a mycelium network connecting distinct surface mushrooms — each mushroom a different platform, an embassy district where each building flies a different platform flag but shares infrastructure, a radio tower at the center of the engine broadcasting on multiple frequencies simultaneously, a port city with ships arriving from different oceans each carrying cargo back to the central market, a spider web with the engine at center and threads reaching to anchor points labeled with platform silhouettes, a space probe network — the engine as mission control connected to probes on different planets, a root ball where one plant sends rhizomes to colonize new ground in every direction, a lighthouse sending different colored beams in different directions — each beam finding a different shore.',
    'Week in the Engine': 'The system pulse. MUST vary wildly. Pool: a dashboard showing all engine metrics with green indicators across the board, an EKG heartbeat monitor where each peak represents something shipped this week, a factory floor at end-of-shift — completed products stacked the engine still humming, a tide chart showing the week high and low water marks of activity, a flight board showing all arrivals and departures this week — some on time some delayed some landed, an engine diagnostic readout with all systems nominal, a time-lapse cross-section of the engine showing it grow denser and more connected over the week, a report card for a machine — metrics grades trends all rendered architecturally, a speedometer cluster showing velocity across different parts of the system, a seismograph that recorded the week vibrations — each spike an event, a mission patch for this week operations — clean iconic graphical, a control room at golden hour with all screens showing positive trends.',
};

const INCLAWBATE_NARRATIVE_SCENES = {
    'The Engine': [
        'Isometric cross-section of a self-sustaining engine on dark charcoal background. Golden liquid flows through transparent pipes in a visible loop — out from a central glowing treasury chamber, through smaller modules, and back to the center. Coral accent lights at junctions. Architectural, clean, alive. 1:1.',
        'A circular flow diagram rendered as beautiful architecture — golden value streams flowing clockwise through distinct chambers labeled by subtle glowing icons. The loop has no beginning or end. Dark background, teal structural lines, gold flow. Concept art. 1:1.',
        'Aerial view of a circular city on dark background. Every district connects to a golden river flowing through the center. The river loops — what exits one district enters the next. The city IS the engine. Architectural, isometric, coral and gold on charcoal. 1:1.',
        'A perpetual water wheel in cross-section — golden liquid pours from the top, turns the wheel, collects at the bottom, and is pumped back up through glowing coral pipes. The machine runs itself. Dark background, clean engineering lines. 1:1.',
        'A heart-like organ rendered architecturally — four chambers visible in cross-section, golden value pumping through arteries to different parts of a larger system and returning through veins. The treasury as a living heart. Dark charcoal, anatomical precision. 1:1.',
        'A tokamak fusion reactor cross-section on dark background — golden plasma contained in magnetic fields shaped by coral structural rings. The reaction sustains itself. Clean, scientific, beautiful. Teal control indicators around the rim. 1:1.',
        'A Rube Goldberg machine rendered in sleek architectural lines — each stage triggers the next, and the final output feeds back into the first stage. Golden balls of value roll through the system. Dark background, coral accents at trigger points. 1:1.',
        'Nested transparent spheres on dark background — each sphere contains a different system (treasury, staking, products, governance) and golden threads connect them all. The innermost sphere glows brightest. Architectural, layered, clean. 1:1.',
        'A mechanical orrery on dark background — but instead of planets, the orbiting bodies are system modules (treasury, council, products, token) all mechanically linked and turning in harmony around a golden core. Brass and coral, precise. 1:1.',
        'Cross-section of a dam and hydroelectric system where the river loops back to the reservoir via golden pipes. The system generates more energy than it consumes. Dark background, architectural blueprint style with coral and gold highlights. 1:1.',
    ],
    'Incubations': [
        'A central engine structure on dark background with five distinct architectural modules attached by golden pipes — each module has unique architecture (one angular, one curved, one crystalline, one organic, one mechanical). Products born from one system. Isometric, clean. 1:1.',
        'A greenhouse module attached to the side of a massive engine — inside, new structures grow under teal light, some small and forming, others nearly complete and ready to detach. Incubation as architecture. Dark background, warm interior glow. 1:1.',
        'A launch gantry integrated into the engine architecture — a new module rising upward on scaffolding of teal light, golden umbilical cables still attached to the main structure. Launch in progress. Dark background, dramatic upward composition. 1:1.',
        'Five satellite modules orbiting a central station in the void — each one distinct in shape and color but all connected by golden tethers to the center. Products as satellites of the engine. Dark background, orbital diagram aesthetic. 1:1.',
        'An assembly line rendered architecturally — raw golden material enters one end of a transparent factory module, passes through stages of transformation, and exits as a complete product-building that connects to the larger network. Dark background, cross-section view. 1:1.',
        'A harbor with a massive engine-structure as the port — five different vessels docked, each unique in design, each with golden cargo being loaded and unloaded. Trade flowing between products and the central treasury. Dark background, aerial view. 1:1.',
        'A coral reef rendered architecturally — the foundation is the engine core, and growing from it are diverse structures in different stages of development. Some fully formed, some just beginning. Dark background, bio-architectural, teal and coral. 1:1.',
        'A tree cross-section on dark background — the trunk is the engine, and each major branch terminates in a different glowing fruit-module (poker chip, prediction market, game controller, aid symbol, sports odds). Golden sap flows through. 1:1.',
        'A modular space station in the void — the central hub glows gold with treasury energy, and new pod-modules are being attached at the edges by construction arms of teal light. Expansion in progress. Dark background, sci-fi architectural. 1:1.',
        'A terraced mountainside in isometric view — each terrace is a different product platform, all connected by waterfalls of golden value cascading from the treasury peak at the top. Dark background, architectural topography. 1:1.',
    ],
    '$CLAWS & DeFi': [
        'A transparent pipe network on dark background — golden liquid flowing through valves, junctions, and reservoirs. Pressure gauges with coral indicators at each node. The financial plumbing of the ecosystem rendered as beautiful engineering. 1:1.',
        'Cross-section of a treasury vault — multiple shelves visible, each holding a different DeFi position rendered as distinct glowing objects (ETH lending as a blue crystal, LP as intertwined gold-teal streams, staked CLAWS as coral formations). Dark background, organized, precise. 1:1.',
        'A bloodstream visualization — golden cells (value) flowing through arteries of different sizes, some branching to staking chambers, some to LP pools, some to lending positions. The circulatory system of DeFi. Dark charcoal, anatomical beauty. 1:1.',
        'A dam with three spillways on dark background — each spillway directs golden flow to a different destination (staking pool, LP reservoir, lending channel). Control gates with teal indicators. Engineered distribution. 1:1.',
        'A distillery in cross-section — raw golden material enters at top, passes through multiple refining stages (staking, lending, LP), and concentrated value collects in vessels at each stage. Dark background, alchemical precision. 1:1.',
        'An aquifer diagram on dark background — golden water table underground feeding multiple wells at the surface. Each well draws from the same source but serves a different purpose. Geological beauty, cross-section view. 1:1.',
        'A power grid diagram — the treasury as the central power plant, high-voltage golden lines running to substations (staking, LP, lending), transformers stepping down to distribution networks. Dark background, technical beauty. 1:1.',
        'A root system cross-section — golden nutrients flowing from a central tap root outward through branching roots to every corner of the soil. The underground financial infrastructure. Dark earth background, bioluminescent roots. 1:1.',
        'A hydraulic press system in cross-section — golden fluid under pressure in the main chamber, smaller pistons at different positions generating force in different parts of the system. Pascal principle as DeFi. Dark background, mechanical precision. 1:1.',
        'Tidal pools at different levels in an architectural landscape — golden liquid settling into natural basins at different elevations, each pool a different DeFi position. Serene, systemic, overhead view. Dark background. 1:1.',
    ],
    'Builder Access': [
        'A massive engine wall with a single open door, warm teal light spilling out. Inside: a clean workstation with tools, screens, and a connection port to the larger system. The invitation to enter. Dark exterior, warm interior. 1:1.',
        'A control panel rendered as art — clearly labeled switches, dials, and sliders, each one a different skill or capability. Accessible, powerful, well-designed. Dark background, coral and teal indicator lights. 1:1.',
        'A modular construction kit — architectural pieces that snap together like LEGO but render as engine components. Some assembled into a small structure, others waiting. The pieces ARE the system. Dark background, isometric view. 1:1.',
        'An API diagram rendered as a vending machine — a glowing input slot at top, and at the bottom, finished product-modules emerge ready to connect to the network. Simple input, powerful output. Dark background, architectural. 1:1.',
        'A periodic table of skills — each element is a capability icon (build app, launch token, deploy staking, schedule post, audit code) in a grid on dark background. Teal borders, coral accent on the most powerful elements. Scientific, systematic. 1:1.',
        'A plug-and-play rack in the engine room — empty slots with clearly marked connection interfaces, one slot showing a new module being inserted. Easy integration. Dark background, warm teal light from the rack. 1:1.',
        'A bridge extending from the glowing engine core across a dark void to an empty platform — on the platform, foundations are laid for something new. The path from the engine to creation. Dark background, golden bridge, teal platform lights. 1:1.',
        'A toolbox that IS a miniature engine — open the lid and inside are tools that are system components: golden wrenches that are value pipes, teal screwdrivers that are skill endpoints. Dark background, macro detail. 1:1.',
        'A drafting table with an architectural blueprint showing how a new module connects to the larger engine. Clean lines, annotation markers, connection points highlighted in coral. Dark background, warm desk lamp. 1:1.',
        'A welcome arch at the entrance to the engine complex — beyond it, a vast interconnected system of modules and flows visible in warm golden light. Small scale meeting enormous scale. Dark background, dramatic depth perspective. 1:1.',
    ],
    'Council & Governance': [
        'An amphitheater ring built around the engine core — each seat projects a teal light indicating a vote. Golden allocation arrows flow from the center to destinations the council has chosen. Dark background, overhead view. 1:1.',
        'A control room overlooking the engine from above — multiple screens showing different system metrics, each station a council seat. Decisions made with full visibility. Dark background, warm screen glow, coral indicators. 1:1.',
        'A roundtable rendered as a circuit on dark background — each node at the table edge is a council seat casting colored light (teal for yes, coral for no). The circuit connects them all. Collective decision as electrical flow. 1:1.',
        'A scales-of-justice mechanism built into the engine — two balance pans holding different allocation options, the mechanism determining equilibrium. Governance as engineering. Dark background, gold and teal, precise. 1:1.',
        'A steering wheel mechanically linked to visible engine components — turn the wheel, and gears, chains, and linkages redirect golden flow to different parts of the system. Governance as direct mechanical control. Dark background. 1:1.',
        'A river delta seen from above on dark background — a council dam at the fork controls which channels receive golden flow. Each channel leads to a different part of the ecosystem. Allocation as hydrology. 1:1.',
        'A parliamentary chamber inside the engine — the walls display live system health metrics, the floor shows a map of value flows, the ceiling is the engine core itself. Governance embedded in the machine. Dark background, warm coral lighting. 1:1.',
        'A chess board where the pieces are system components — treasury as king, products as rooks, token as queen — being strategically positioned. Dark background, golden and teal pieces, architectural chess. 1:1.',
        'A neural network where each node is a council seat and each connection is a decision — some connections bright (active votes), some faint (pending). Governance as network. Dark background, teal and coral. 1:1.',
        'A mission control room during a critical operation — all stations active, all screens showing data, allocation vectors being calculated on the main display. The council steering the engine. Dark background, cinematic. 1:1.',
    ],
    'The Network': [
        'A central engine with golden bridges extending in five directions to distant platform-islands — each island has distinct architecture representing Virtuals, Bankr, Telegram, ClawHub, X. One system, many presences. Dark void, aerial view. 1:1.',
        'A nervous system diagram — the engine as the brain, teal nerve fibers extending to different body parts, each body part a different platform embodiment. The same intelligence in every limb. Dark background, anatomical. 1:1.',
        'A transit map on dark background — different colored lines (teal, coral, gold) connecting the central station (Inclawbate) to outlying stations (platform logos as abstract icons). Clean, diagrammatic, beautiful. 1:1.',
        'A radio tower rising from the engine core, broadcasting on multiple frequencies — each frequency shown as a different colored wave reaching a different receiver in the distance. One signal, many channels. Dark background, wave visualization. 1:1.',
        'A mycelium network cross-section — the underground web (Inclawbate) connects many distinct surface mushrooms, each one a different shape and color (each platform). Hidden infrastructure supporting visible growth. Dark soil, bioluminescent threads. 1:1.',
        'A lighthouse sending different colored beams in different directions from the engine top — each beam illuminating a different shore where a platform structure sits. Guidance broadcast everywhere. Dark background, dramatic beams. 1:1.',
        'A spider web with the engine at center and silk threads reaching to anchor points around the frame — each anchor point is a platform node with its own small glow. The web connects everything. Dark background, dew drops of golden value on threads. 1:1.',
        'A satellite dish array on top of the engine — multiple dishes pointed in different directions, each maintaining a connection to a distant platform satellite. Communication infrastructure. Dark background, teal signal beams. 1:1.',
        'An embassy district — multiple distinct buildings each flying a different platform flag, but all sharing the same golden underground infrastructure visible in cross-section. Unity through shared foundation. Dark background, isometric. 1:1.',
        'A port city aerial view — the engine is the harbor, and ships arrive from different oceans (platforms) carrying cargo. Golden goods flow between all docks. Dark background, warm port lights. 1:1.',
    ],
    'Week in the Engine': [
        'An engine dashboard on dark background — all gauges in the green, golden flow meters showing high throughput, coral indicator lights all positive. A good week in the machine. Clean, technical, satisfying. 1:1.',
        'An EKG heartbeat monitor showing the engine pulse over seven days — each peak represents something shipped, each valley a rest cycle. The system is alive and healthy. Dark background, coral trace on charcoal. 1:1.',
        'A factory floor at end-of-shift — completed product modules stacked neatly, the engine still humming in the background, golden indicators showing production numbers. Satisfying, productive. Dark background, warm overhead. 1:1.',
        'A time-lapse cross-section of the engine — layered exposures showing it grow denser and more connected across the week. Monday at the edges (sparse), today at the center (complex, bright). Dark background. 1:1.',
        'A flight departure/arrival board rendered architecturally — entries showing what launched, what landed, what\'s in transit. Some rows coral (shipped), some teal (in progress), some gold (planned). Dark background, editorial. 1:1.',
        'An engine diagnostic readout on dark background — all systems nominal, health bars full, efficiency metrics in gold numbers. The weekly checkup shows a machine running well. Technical, clean, coral accents. 1:1.',
        'A mission patch for this week — a clean, iconic graphic combining key elements from what was accomplished: a product icon, a governance symbol, a growth indicator, all arranged in a geometric emblem. Dark background, coral and teal on gold. 1:1.',
        'A speedometer cluster showing velocity across different parts of the system — treasury flow, app creation, staking growth, governance activity. All needles pointing right. Dark background, golden dials, coral redline. 1:1.',
        'A seismograph that recorded the week vibrations — each spike an event: a product launch, a governance vote, a treasury deposit, a community milestone. The pattern tells the story. Dark background, teal trace. 1:1.',
        'A control room at golden hour — warm light washing over screens that show positive trends across every metric. The engine performed well this cycle. Dark background, cinematic, satisfied energy. 1:1.',
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

// Each slot angle maps to a section of the site. 5 posts/day, each covering a different area.
const PGT_SLOT_ANGLES = {
    'Daily Coverage': [
        'AGENT SPOTLIGHT: Pick one AI agent project and spotlight it. Tag their @handle. Explain what it does and why it matters. Link to their site.',
        'BUILDER/VIBECODER: Spotlight one builder or vibecoder shipping AI agents or public goods. Tag their @handle. Celebrate what they built.',
        'NEWS/HOT TAKE: Share one piece of ecosystem news, a hot take, or an interesting observation about AI agents. Tag relevant projects.',
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

KNOWN PROJECTS TO COVER (use their real @handles):
- @inclawbate / @inclawbator — AI incubator, app builder, token launcher on Base
- @virtaboreal (Virtuals Protocol) — co-owned AI agents platform
- @ai16zdao (ElizaOS) — open source multi-agent framework
- @autonolas (Olas) — decentralized agent network
- @Fetch_ai — decentralized ML and AI agents
- @bankaboreal (BankrBot) — AI agent for DeFi
- @ClankerBase (Clanker) — token launcher on Base
- @SaladorNetwork (Salad) — distributed GPU cloud
- @ionaboreal (io.net) — decentralized GPU network
- @grass_io (Grass) — bandwidth sharing network
- @HoneygainApp — bandwidth monetization
- @rendertoken (Render) — GPU rendering network
- @akaboreal (Akash) — decentralized cloud compute

Always research and use the CORRECT @handle. If unsure of a handle, mention the project name without @ rather than guessing wrong. Rotate which projects you cover — don't repeat the same one two days in a row.`,
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
