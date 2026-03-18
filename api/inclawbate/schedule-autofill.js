// Auto-fill @inclawbator schedule with pillar-based content drafts
// POST {action:"generate"} — generate drafts for empty slots (admin only)
// GET  ?date=YYYY-MM-DD    — get drafts for a date

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const ADMIN_WALLETS = ['0x91b5c0d07859cfeafeb67d9694121cd741f049bd'];
// Editors can generate, edit, delete drafts — but NOT approve/reject
const EDITOR_WALLETS = ['0x47fbb4e2527492ab56b7fba5fde3e7b35719e655']; // @FreefoRaLLey
const VALID_HOURS = [1, 13, 16, 19, 22];

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

// Brand archetype — injected into all image prompt generation
const BRAND_IMAGE_CONTEXT = `INCLAWBATE VISUAL BRAND (follow this STRICTLY):

THE MASCOT (must appear in every image):
- 3D rendered anthropomorphic coral-red lobster character with glossy segmented shell, large expressive round eyes with white catchlight highlights, big prominent claws (used as hands), and two curved antennae
- Chunky, rounded, approachable proportions (like a Pixar/Fortnite character). Confident posture, builder energy, slightly cocky grin. NOT cute/kawaii/chibi.
- Shell colors: coral red (#e5533d) body, darker (#c9442e, #b83c28) on segments. Glossy subsurface scattering sheen.

RENDER STYLE:
- 3D rendered, Octane render quality. NOT flat illustration, NOT 2D, NOT pixel art.
- Polished smooth surfaces with cinematic lighting. Volumetric light, rim lighting in coral and teal.
- Depth of field — subject sharp, background softly blurred.
- Dark backgrounds ALWAYS (#06060b to #0d0d1a). Never white/bright.

COLORS: Coral red (#e5533d) primary, seafoam teal (#4db6ac) secondary, dark void backgrounds, warm gold (#d4a574) for coins/premium. Coral + teal neon glow on edges.

DON'T: No white backgrounds. No flat illustration. No stock photos. No realistic humans. No text in image. No pure blue. No cluttered compositions. No horror/scary vibes.

FORMAT: 1:1 aspect ratio. Single focal point (the lobster). Clean composition.`;

// Scene templates per pillar — 3D mascot focused
const PILLAR_SCENE_HINTS = {
    'App Spotlight': '3D lobster in "presenter" pose, one claw gesturing toward a large floating holographic app interface that glows coral and teal. Dark void background with hexagonal grid. Volumetric light spills from the screen onto the shell.',
    'Builder Shoutout': '3D lobster in "builder" pose, sitting at a futuristic dark workstation typing on a glowing keyboard. Multiple holographic code screens float around. Dark moody atmosphere with volumetric fog. Late-night coding energy.',
    'DeFi / CLAWS Update': '3D lobster in "thinker" pose (claw on chin), floating in a dark void surrounded by orbiting holographic charts, token coins, and teal yield arrows. A large coral-and-gold CLAWS coin floats center. Space-like background.',
    'Weekly Recap': '3D lobster in "celebrator" pose, both claws raised triumphantly. Mosaic of miniature floating app screens and token charts connected by glowing coral threads behind. Coral and teal confetti particles. Festive but professional.',
    'How-To / Tips': '3D lobster in "presenter" pose, pointing a claw at floating step-by-step instruction panels glowing coral. Dark clean background with subtle grid. Teacher energy — confident, helpful. Minimal clean composition.',
    'Community Vibes': '3D lobster in "greeter" pose, waving warmly at entrance of a neon-lit crypto lounge with coral and teal neon on dark walls. Smaller lobster characters at glowing workstations inside. Warm inviting atmosphere with volumetric haze.',
    'Incubation CTA': '3D lobster in "boss" pose — standing powerfully atop a glowing platform of stacked app icons and token coins, claws crossed confidently. Coral energy radiates upward creating dramatic uplighting. Dark epic background with rising teal embers.',
};

// Narrative scenarios per pillar — drawn from NARRATIVE.md for richer, varied image prompts
const NARRATIVE_SCENES = {
    'App Spotlight': [
        'The lobster at The Workshop, hunched over a holographic workbench, manipulating glowing UI components mid-air. Screens display a nearly-finished app. Crab Engineer gives thumbs-up from behind.',
        'Shipping Day — the lobster holds up a freshly completed app like a trophy, glowing with achievement energy. The app floats up to join a constellation of other apps above The Reef.',
        'The lobster and the shrimp newbie side by side, the lobster gently showing how to use the app on a floating screen. The shrimp\'s eyes light up. Wholesome teaching moment.',
        'The Arena — the lobster on stage presenting an app under spotlights. Holographic scoreboards and crowds of mini lobsters watching. App showcase energy.',
    ],
    'Builder Shoutout': [
        'The All-Nighter — 3 AM at The Workshop, dark except for one screen\'s glow. The lobster hunches over the keyboard, shell slightly dimmer. Empty energy cans nearby. On screen: an app coming together beautifully.',
        'Collaboration — two lobsters at adjacent workstations, teal data streams flowing between screens. They high-claw in the middle as they merge their work. Partnership energy.',
        'Code Review — the lobster and the Crab Engineer side by side, both looking at a holographic code review. The crab tightens a bolt on the code (literally). Bug squashing energy.',
        'The Build Session — late night at The Workshop, multiple screens open, claws flying across keyboard. Coffee mugs piled up. Focused, determined energy.',
    ],
    'DeFi / CLAWS Update': [
        'Staking Zen — the lobster meditates on a floating coral platform. Token coins orbit slowly around it like electrons. Yield arrows glow upward. Peaceful passive income energy.',
        'Checking the Charts — the lobster at The Trading Floor, one claw holding a phone with a price chart. Other sea creatures peek over its shoulder. Tense but analytical.',
        'Yield Farming — the lobster tends a garden where glowing token coins grow from coral stalks. Watering them with a teal data stream. Each plant is a different yield source.',
        'Whale Watching — the lobster and mini lobsters on The Rooftop, looking up as a massive whale swims overhead leaving a trail of teal sparkles. Awe and respect.',
    ],
    'How-To / Tips': [
        'Teaching a Newbie — the lobster kneels to the shrimp\'s level, gently showing it how to use the app builder on a floating screen. Patient mentoring energy.',
        'The Workshop — holographic screens everywhere, token blueprints pinned to coral walls, glowing keyboards built into rock formations. The lobster explains step by step.',
        'The Octopus Multitasker juggling 8 tools while the lobster watches and takes notes. Productivity content energy.',
        'Morning Routine — the lobster wakes in its coral apartment, checks holographic notifications: "3 new apps shipped overnight." Grabs a glowing coffee mug. Cozy tutorial energy.',
    ],
    'Community Vibes': [
        'The Meetup — The Lounge packed with different sea creatures. The lobster on a small stage with a holographic presentation. Everyone engaged, some on holographic tablets.',
        'Meme War — two lobsters face off across a table, rapidly creating memes on holographic screens. Other creatures watch and vote with teal/coral light beams. Competitive but fun.',
        'The Group Photo — all characters lined up: lobster center, mini lobsters, Crab Engineer, Octopus, Shrimp Newbie, Pufferfish. Teal and coral lighting. Team photo energy.',
        'Lunch Break — the lobster in The Lounge with other sea creatures, eating kelp noodles. A mini lobster shows off an app on their phone. Slice-of-life energy.',
    ],
    'Incubation CTA': [
        'The Incubator — a warm egg-shaped chamber with soft coral lighting. The lobster tends to glowing idea-orbs, nurturing projects from concept to launch. Cozy but powerful.',
        'The Portal — the lobster stands before a massive swirling coral-and-teal portal. On the other side: a thriving ecosystem of apps, tokens, builders. The lobster steps forward confidently.',
        'The Throne — the lobster sits on a throne of stacked app icons and token coins. Not arrogant — earned. Workshop visible behind, tools still out. "Built this from scratch" energy.',
        'The Army — an army of mini lobsters marching forward, each carrying a different tool. The main lobster leads from the front. Coral banners flowing. "We\'re coming."',
    ],
    'Weekly Recap': [
        'Hitting 100 Apps — The Arena packed. A massive holographic number glows above. Confetti everywhere. The lobster stands center stage, claws raised. Mini lobsters cheering.',
        'The Vision — the lobster on The Rooftop at night, looking up at a constellation forming the Inclawbate logo. Stars connect with teal lines. Visionary epic energy.',
        'The Origin — deep in the ocean, a glowing coral egg cracks open. A tiny lobster claw reaches out. The first light is coral-red. Origin story energy.',
        'First Sale / First User — the lobster stares at a notification hologram: "1 new user on your app." Pure joy. Claws trembling. A single teal sparkle. Triumphant but intimate.',
    ],
};

// @inclawbate (company) content pillars — brand, vision, product, ecosystem
const INCLAWBATE_PILLARS = [
    { name: 'Weekly Recap',          emoji: '\u{1F4CA}', needsImage: true,  desc: 'What shipped this week, platform numbers, treasury updates, what\'s coming next' },
    { name: 'Product Highlight',     emoji: '\u{1F4F1}', needsImage: true,  desc: 'Deep dive on one product — PokerAI, staking, app builder, tools, skills marketplace, vaults' },
    { name: 'Builder Story',         emoji: '\u{1F477}', needsImage: false, desc: 'Spotlight a builder, an app they shipped, or a community contribution' },
    { name: 'Brand & Vision',        emoji: '\u{1F30A}', needsImage: true,  desc: 'The perpetual engine, the Telos mission, why Inclawbate exists, DAO governance, long-term vision' },
    { name: 'Education',             emoji: '\u{1F4A1}', needsImage: false, desc: 'How DeFi works, how Inclawbate works, staking explained, yield mechanics, app builder tips' },
    { name: 'Community Engagement',  emoji: '\u{1F525}', needsImage: true,  desc: 'Polls, hot takes, memes with the lobster mascot, conversation starters, community vibes' },
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
    `staking APY is live. deposit CLAWS, earn yield. no lockup, no tricks. inclawbate.com/stake`,
    `PokerAI had its biggest week yet. more hands played, more rake recycled, more agents learning. the liquidity engine works.`,
    `100+ apps live. all built by regular people using AI. no dev team needed. just an idea and inclawbate.com/build`,
    `the treasury grew again this week. every app, every stake, every poker hand. it all feeds the engine.`,
    `gm. the future of building is typing what you want and hitting enter. inclawbate.com`,
    `no VC. no board. no roadmap decided by people who don't build. just builders and users. that's inclawbate.`,
    // Formatted style (with line breaks)
    `Imagine turning your wildest ideas into full crypto projects... in DAYS.\n\nLaunch an app + token + staking pool - all in ONE platform\n\n@inclawbate makes it happen:\n-Describe your vision\n-AI builds & deploys it\n-You focus on building\n\nStart here inclawbate.com`,
    `the perpetual engine, explained:\n\n1. builders create apps\n2. apps generate revenue\n3. revenue feeds the treasury\n4. treasury rewards builders\n5. repeat forever\n\nno VCs. no exit. just value flowing.\n\ninclawbate.com`,
];

const INCLAWBATE_SCENE_HINTS = {
    'Weekly Recap': '3D lobster in "celebrator" pose on The Rooftop, looking over a glowing digital reef city. Holographic stats and app screens float around. Festive coral and teal confetti. Epic cinematic wide shot.',
    'Product Highlight': '3D lobster in "presenter" pose at The Workshop, demonstrating a product on a large holographic display. Tools and prototypes visible. Coral neon glow from the screen, teal accent lighting.',
    'Builder Story': '3D lobster in "builder" pose at a workstation inside The Workshop. Code screens and app UIs floating. Crab Engineer nearby. Dark moody atmosphere, volumetric fog.',
    'Brand & Vision': '3D lobster in power pose on The Rooftop at night, looking up at a massive constellation forming the Inclawbate logo. Stars connect with teal lines. Epic, visionary, cinematic wide shot.',
    'Education': '3D lobster in "presenter" pose, teaching The Shrimp Newbie with floating step-by-step panels. Clean dark background. Patient mentoring energy. Teal data flows.',
    'Community Engagement': '3D lobster in "greeter" pose at The Lounge, surrounded by mini lobsters and Pufferfish. Neon-lit crypto bar, coral and teal signs. Party but productive energy.',
    'Ecosystem Update': '3D lobster in "thinker" pose at The Vault, surrounded by orbiting token coins, charts trending up, treasury metrics. Gold and coral lighting. Data-driven energy.',
};

const INCLAWBATE_NARRATIVE_SCENES = {
    'Weekly Recap': [
        'The Vision — the lobster on The Rooftop at night, looking up at a constellation forming the Inclawbate logo. Visionary epic energy.',
        'Hitting 100 Apps — The Arena packed. A massive holographic number glows above. Confetti. The lobster center stage, claws raised.',
        'The Group Photo — all characters lined up: lobster center, mini lobsters, Crab Engineer, Octopus. Team photo energy.',
    ],
    'Product Highlight': [
        'Shipping Day — the lobster holds up a freshly completed product like a trophy. The Crab Engineer gives thumbs-up.',
        'The Workshop — holographic screens everywhere. The lobster demonstrates a feature to a crowd of mini lobsters.',
        'The Arena — the lobster on stage presenting a product under spotlights. Holographic scoreboards and crowds watching.',
    ],
    'Builder Story': [
        'The All-Nighter — 3 AM at The Workshop, dark except for one screen\'s glow. On screen: an app coming together.',
        'Collaboration — two lobsters at adjacent workstations, teal data streams flowing between screens. They high-claw.',
        'Teaching a Newbie — the lobster kneels to the Shrimp Newbie\'s level, showing how to build. Eyes light up.',
    ],
    'Brand & Vision': [
        'The Origin — deep in the ocean, a glowing coral egg cracks open. A tiny lobster claw reaches out. Origin story.',
        'The Portal — the lobster before a massive swirling coral-and-teal portal. A thriving ecosystem on the other side.',
        'The Throne — lobster on a throne of stacked app icons and token coins. Workshop visible behind. "Built this from scratch."',
        'The Army — mini lobsters marching forward, each carrying a tool. The main lobster leads. Coral banners flowing.',
    ],
    'Education': [
        'Teaching a Newbie — the lobster gently showing the Shrimp how to use the platform. Patient mentoring.',
        'The Octopus Multitasker juggling 8 tools while the lobster takes notes. Productivity energy.',
        'The Workshop with clear diagrams and step-by-step panels floating in the air. Educational but cool.',
    ],
    'Community Engagement': [
        'The Meetup — The Lounge packed with sea creatures. The lobster on stage. Community energy.',
        'Meme War — two lobsters creating memes on holographic screens. Others voting. Competitive but fun.',
        'GM Post — sunrise over the reef. Lobster on The Rooftop, coffee in claw. Fresh new day energy.',
    ],
    'Ecosystem Update': [
        'Staking Zen — lobster meditating on a floating platform. Token coins orbiting. Yield arrows glowing upward.',
        'Checking the Charts — at The Trading Floor. One claw holding phone with chart. Analytical.',
        'Whale Watching — lobster and mini lobsters on The Rooftop as a massive whale swims overhead trailing teal sparkles.',
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
            identity: `You are @inclawbate, the official company account for Inclawbate — the perpetual value engine built on Base. You speak as the brand itself. Your voice is confident, visionary, builder-first. You're not an agent or a bot — you're the company.`,
        };
    }
    return {
        pillars: PILLARS,
        slotAngles: SLOT_ANGLES,
        styleExamples: STYLE_EXAMPLES,
        sceneHints: PILLAR_SCENE_HINTS,
        narrativeScenes: NARRATIVE_SCENES,
        identity: `You are @inclawbator, the AI marketing agent for Inclawbate — a Web3 platform on Base where anyone can build apps with AI, launch tokens, and earn.`,
    };
}

// Pick a random narrative scene for a pillar
function randomNarrativeScene(pillarName) {
    const scenes = NARRATIVE_SCENES[pillarName];
    if (!scenes || !scenes.length) return '';
    return scenes[Math.floor(Math.random() * scenes.length)];
}

const ALLOWED_ORIGINS = [
    'https://inclawbate.com', 'https://www.inclawbate.com',
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

${BRAND_IMAGE_CONTEXT}

${sceneHint ? 'BASE SCENE for ' + pillarName + ' (adapt to the tweet above): ' + sceneHint : ''}

${narrativeScene ? 'NARRATIVE INSPIRATION (borrow elements — locations, characters, props, mood — to make the image vivid and unique):\n' + narrativeScene : ''}

IMPORTANT: The image must visually represent what THIS tweet says — not just a generic brand image. If the tweet mentions an app, show the lobster mascot presenting/using that app. If it mentions a builder, show the lobster at a workstation. If it mentions staking/yield, show the lobster with charts and coins. Always feature the 3D lobster mascot as the focal point.

Write ONE image prompt (2-3 sentences). Include: the 3D lobster mascot in a specific pose, what it's doing/holding that relates to the tweet, dark background, coral+teal lighting, Octane render quality. Output ONLY the prompt.`;

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
            const { slot_id, tweet_text, status } = req.body;
            const updates = {};
            if (tweet_text !== undefined) updates.tweet_text = tweet_text;
            if (status) updates.status = status;
            const { error } = await supabase
                .from('agent_schedule')
                .update(updates)
                .eq('id', slot_id);
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ ok: true });
        }

        if (action === 'set_image') {
            const { slot_id, image_url } = req.body;
            if (!slot_id || !image_url) return res.status(400).json({ error: 'slot_id and image_url required' });
            // Store image URL in tweet_options and flip status from needs_image → needs_review
            const { data: slot } = await supabase
                .from('agent_schedule')
                .select('tweet_options, status')
                .eq('id', slot_id)
                .single();
            const opts = slot?.tweet_options || {};
            opts.image_url = image_url;
            const newStatus = slot?.status === 'needs_image' ? 'needs_review' : slot?.status;
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
- Token: $CLAWS on Base, website: inclawbate.com
- App builder: inclawbate.com/build
- Staking: inclawbate.com/stake
- PokerAI: pokerai.app
- Tools: inclawbate.com/tools

STYLE EXAMPLES (match this vibe):
${exampleBlock}

${styleGuide ? styleGuide + '\n' : ''}

RULES:
- Under 280 characters (STRICT — \\n line breaks count as 1 char each)
- MUST be completely different from the rejected tweet — different angle, different structure, different words
- No hashtags, no corporate speak, no em dashes
- No @mentions, no names
- Lowercase preferred, crypto-native casual tone
- Can use \\n for line breaks if doing a formatted/structured tweet
- NEVER use vague filler like "various" or "popular ones"

IMAGE PROMPT (this is critical — the image must illustrate the tweet):
${BRAND_IMAGE_CONTEXT}
${sceneHint ? 'BASE SCENE (adapt to tweet content): ' + sceneHint : ''}
${narrativeScene ? 'NARRATIVE INSPIRATION: ' + narrativeScene : ''}

After writing the tweet, ask yourself: "What is this tweet ABOUT?" Then show the lobster DOING that thing.
- Tweet about staking → lobster meditating with orbiting coins and APY charts
- Tweet about building → lobster at workstation with holographic app floating above
- Tweet about community → lobster greeting others at The Lounge
- Tweet about growth → lobster on The Rooftop watching stats rise

Output format:
TWEET: [the tweet — can include \\n for line breaks]
IMAGE: [2-3 sentence prompt — lobster doing something SPECIFIC to the tweet, narrative location, dark background, coral+teal lighting, Octane render, 1:1]`;

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

                if (!tweetText || tweetText.length > 280) {
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

${BRAND_IMAGE_CONTEXT}

${sceneHint ? 'BASE SCENE for ' + pillarName + ' (adapt to the tweet): ' + sceneHint : ''}

${narrativeScene ? 'NARRATIVE INSPIRATION (borrow elements):\n' + narrativeScene : ''}

STEP BY STEP:
1. Read the tweet above. What is the KEY SUBJECT? (staking? building? a specific app? community? treasury?)
2. What should the lobster be DOING to illustrate this? (presenting an app = showing a holographic screen, staking = meditating with orbiting coins, building = coding at workstation, community = greeting others at The Lounge)
3. What SPECIFIC VISUAL DETAILS from the tweet should appear? (if "APY increased" → charts trending up, if "100+ apps" → constellation of floating app screens, if "poker" → card table and chips)

Write ONE image prompt (2-3 sentences). The 3D lobster mascot must be the focal point doing something that SPECIFICALLY relates to what the tweet says. Include: pose, action, specific visual elements from the tweet, dark background, coral+teal lighting, Octane render quality, 1:1.

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

        return res.status(400).json({ error: 'Unknown action' });
    }

    res.status(405).json({ error: 'Method not allowed' });
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
    `we're taking on new builds at inclawbate. you bring the idea, we bring the AI. spots filling up. inclawbate.com`,
    // One-liner
    `gm. the future of app development is typing what you want and hitting enter.`,
    // Degen energy
    `ser the app store of the future is being built on base and it's called inclawbate. not alpha, just facts.`,
    // Thread-starter style
    `built ClawCard in weeks, not months. inclawbate handled the code while i focused on the product. if you're sitting on an idea, stop waiting.`,
    // Formatted with line breaks
    `what inclawbate actually does:\n\n-you describe an app idea\n-AI builds it in minutes\n-it's live instantly with a real URL\n-you earn from it\n\nno code. no waiting. no gatekeepers.\n\ntry it: inclawbate.com/build`,
    `the app store of the future isn't controlled by Apple or Google.\n\nit's built by regular people.\nwith AI.\non-chain.\n\n100+ apps live. growing daily.\n\ninclawbate.com`,
];

// Fetch real platform stats for accurate content
async function fetchPlatformContext() {
    const results = { totalApps: 0, recentApps: [], builders: [], topApps: [] };

    const [appsRes, countRes, buildersRes, profilesRes] = await Promise.allSettled([
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

    return results;
}

// Style-specific instructions for tweet generation
const STYLE_INSTRUCTIONS = {
    mixed: `FORMAT VARIETY (CRITICAL — follow this distribution):
- 1-2 tweets: SHORT one-liners (under 100 chars). Punchy, meme energy. Example: "gm. the future of app development is typing what you want and hitting enter."
- 1-2 tweets: MEDIUM length (100-180 chars). Hook + detail. Example: "someone just built a full staking dashboard on inclawbate in 10 minutes. no code. just vibes."
- 1-2 tweets: LONG FORMATTED (200-280 chars) with LINE BREAKS (\\n). Use bullet points (-), numbered lists, or stacked lines for visual impact. Include a CTA at the end. Example:
"what inclawbate actually does:\\n\\n-you describe an app idea\\n-AI builds it in minutes\\n-it's live instantly\\n-you earn from it\\n\\nno code. no waiting.\\n\\ninclawbate.com/build"

IMPORTANT: The long formatted tweets MUST use \\n for line breaks. They should look like structured posts with clear visual hierarchy. Vary which slots get which format.`,

    punchy: `FORMAT: ALL tweets must be SHORT one-liners (under 120 chars preferred).
- Meme energy, degen vibes, hot takes
- One strong thought per tweet
- No line breaks needed
- Examples: "gm. the future is typing what you want and hitting enter." / "100+ apps. zero devs needed. inclawbate."`,

    formatted: `FORMAT: ALL tweets must be LONG FORMATTED posts (200-280 chars) with LINE BREAKS (\\n).
- Use \\n for line breaks between sections
- Use bullet points (-) or numbered lists for structure
- Include a hook/opener, body content, and a CTA/closer
- Visual hierarchy matters — make it scannable
- Example:
"the perpetual engine, explained:\\n\\n1. builders create apps\\n2. apps generate revenue\\n3. revenue feeds the treasury\\n4. treasury rewards builders\\n5. repeat forever\\n\\nno VCs. no exit.\\n\\ninclawbate.com"

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
- Token: $CLAWS on Base
- Website: inclawbate.com
- App builder: inclawbate.com/build (AI builds apps, no code)
- Staking: inclawbate.com/stake
- PokerAI: pokerai.app (poker against AI, real USDC)
- Tools: inclawbate.com/tools (50+ free tools)

TODAY'S PILLAR: ${pillar.name}
Description: ${pillar.desc}

STYLE EXAMPLES (match this vibe — crypto-native, authentic, no corporate speak):
${exampleBlock}

${styleGuide}

RULES:
- Each tweet MUST be under 280 characters (STRICT — count carefully, including \\n line breaks which each count as 1 char)
- No hashtags ever
- No "excited to announce", "thrilled", "game-changing", or any corporate speak
- No em dashes (—)
- No quotation marks around the tweet
- Lowercase is fine, even preferred for casual tweets
- NEVER mention any person's name, handle, or username. No @mentions, no names, no shoutouts. Talk about the platform, apps, and what's possible — not individuals.
- NEVER use vague filler like "various", "popular ones", "top apps" without naming them. Either use specific app names from the data above, or don't mention apps at all. Be concrete or be general about the platform — never vaguely in between.
- When citing numbers, use ONLY the real stats provided — NEVER invent numbers
- Include inclawbate.com when it fits naturally (not every tweet)
- Each tweet should feel DIFFERENT from the others — vary tone and structure

Generate ${emptyHours.length} tweets. For EACH tweet, you MUST write a matching image prompt.

THE IMAGE PROMPT IS THE MOST IMPORTANT PART. Read the tweet you just wrote, then craft an image that ILLUSTRATES the specific content of that tweet. Not a generic brand image — a scene that someone could look at and understand what the tweet is about.

IMAGE PROMPT RULES:
${BRAND_IMAGE_CONTEXT}

BASE SCENE for today's pillar (${pillar.name}) — use as a starting point, then customize based on the tweet:
${sceneHint}

NARRATIVE SCENES (pick elements — locations, characters, props, moods — to make each image vivid):
${narrativeScenesList}

HOW TO WRITE A GOOD IMAGE PROMPT:
1. Read your tweet. Identify the KEY SUBJECT (staking? an app? building? community?)
2. Choose a scene/location that fits (The Workshop for building, The Trading Floor for DeFi, The Lounge for community, The Rooftop for vision)
3. Show the lobster DOING something related to the tweet (presenting an app, tending yield gardens, meditating with orbiting coins, coding at a workstation)
4. Add specific visual details from the tweet content (if tweet mentions "staking APY" show charts and yield arrows, if it mentions "100+ apps" show a constellation of floating app screens)
5. End with: dark background, coral+teal lighting, Octane render quality, 1:1

GOOD EXAMPLES:
TWEET: staking apy just increased. more claws locked, better yields. passive income is real. inclawbate.com/stake
IMAGE: 3D rendered Inclawbate lobster mascot in "Staking Zen" pose, meditating on a floating coral platform surrounded by orbiting CLAWS token coins. A large holographic APY chart trends upward behind it with glowing green arrows. Yield streams in teal (#4db6ac) flow from coins into the lobster. Dark void background with warm coral (#e5533d) rim lighting. Volumetric light, cinematic depth of field, Octane render quality, 1:1.

TWEET: someone just built a full app on inclawbate in 10 minutes. no code. just vibes.
IMAGE: 3D rendered Inclawbate lobster mascot at The Workshop, claws flying across a glowing keyboard with a completed app floating above the screen — fully formed with UI elements, buttons, and data flowing through it. The Shrimp Newbie watches in amazement from behind. Dark workshop with coral neon signs and teal holographic code streams. Cinematic depth of field, Octane render quality, 1:1.

BAD IMAGE PROMPTS (DO NOT DO THIS):
- "3D lobster mascot in a cool pose with coral and teal lighting" (too generic, could be any tweet)
- "The lobster standing confidently" (no connection to tweet content)
- "Lobster with holographic screens" (vague, doesn't reflect specific tweet)

${emptyHours.map((h, i) => `${i + 1}. Angle: "${angles[i % angles.length]}"`).join('\n')}

Format each entry as:
TWEET: [the tweet text]
IMAGE: [2-3 sentence image prompt — 3D lobster mascot doing something SPECIFIC to the tweet, in a narrative location, dark background, coral+teal lighting, Octane render quality, 1:1]

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
                if (tweet.length > 0 && tweet.length <= 280) {
                    entries.push({ tweet, imagePrompt });
                }
            }
        }
        // Fallback: if parsing failed, try line-by-line (old format)
        if (entries.length === 0) {
            rawText.split('\n')
                .map(l => l.replace(/^\d+[\.\)]\s*/, '').replace(/^["']|["']$/g, '').replace(/^TWEET:\s*/i, '').trim())
                .filter(l => l.length > 0 && l.length <= 280 && !/^IMAGE:/i.test(l))
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
