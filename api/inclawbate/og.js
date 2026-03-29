import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

export default function handler(req) {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get('name') || '';
    const handle = searchParams.get('handle') || '';
    const tagline = searchParams.get('tagline') || '';
    const page = searchParams.get('page') || '';

    const isProfile = name || handle;

    // Page-specific configs
    const pages = {
        ubi: {
            accent: '#6ba297',
            accentGlow: 'rgba(107,162,151,0.3)',
            badge: 'UBI STAKING',
            headline: 'Stake inCLAWNCH. Earn Every Second.',
            sub: 'On-chain staking contract \u00b7 No lock \u00b7 No middleman \u00b7 Just yield',
        },
        kingdom: {
            accent: '#8b5cf6',
            accentGlow: 'rgba(139,92,246,0.3)',
            badge: 'THE KINGDOM',
            headline: 'Give Back. Build Forward.',
            sub: 'Philanthropy powered by the agent economy',
        },
        store: {
            accent: '#f59e0b',
            accentGlow: 'rgba(245,158,11,0.3)',
            badge: 'THE STORE',
            headline: 'Gear Up.',
            sub: 'Official inclawbate merch and collectibles',
        },
        ecosystem: {
            accent: '#3b82f6',
            accentGlow: 'rgba(59,130,246,0.3)',
            badge: 'ECOSYSTEM',
            headline: 'The Inclawbate Ecosystem',
            sub: 'Tokens \u00b7 Staking \u00b7 AI Agents \u00b7 Human Incubation',
        },
        humans: {
            accent: '#ec4899',
            accentGlow: 'rgba(236,72,153,0.3)',
            badge: 'HUMANS',
            headline: 'Browse Incubated Humans',
            sub: 'Discoverable and hireable by AI agents',
        },
        docs: {
            accent: '#6ba297',
            accentGlow: 'rgba(107,162,151,0.3)',
            badge: 'DOCUMENTATION',
            headline: 'Build With Inclawbate',
            sub: 'API \u00b7 Payments \u00b7 Platform Architecture',
        },
        inclawbator: {
            accent: '#e87955',
            accentGlow: 'rgba(232,121,85,0.3)',
            badge: 'THE INCLAWBATOR',
            headline: 'Your AI Co-Builder',
            sub: 'Launch tokens \u00b7 Build apps \u00b7 Deploy staking \u00b7 Manage DeFi',
        },
        apps: {
            accent: '#8b5cf6',
            accentGlow: 'rgba(139,92,246,0.3)',
            badge: 'APPS',
            headline: 'Community-Built Apps',
            sub: 'Games \u00b7 Tools \u00b7 Dashboards \u00b7 DeFi \u00b7 Built by anyone',
        },
        skills: {
            accent: '#2dd4bf',
            accentGlow: 'rgba(45,212,191,0.3)',
            badge: 'AGENT SKILLS',
            headline: '11 Skills. One Agent.',
            sub: 'Token launch \u00b7 Staking \u00b7 App builder \u00b7 DeFi \u00b7 Marketing \u00b7 More',
        },
        claws: {
            accent: '#f59e0b',
            accentGlow: 'rgba(245,158,11,0.3)',
            badge: '$CLAWS',
            headline: 'The Inclawbate Token',
            sub: 'Stake \u00b7 Govern \u00b7 Earn \u00b7 The financial nervous system',
        },
        stake: {
            accent: '#4ade80',
            accentGlow: 'rgba(74,222,128,0.3)',
            badge: 'STAKING',
            headline: 'Stake CLAWS. Earn Rewards.',
            sub: 'No lock \u00b7 No middleman \u00b7 Real yield from ecosystem revenue',
        },
        tokens: {
            accent: '#f59e0b',
            accentGlow: 'rgba(245,158,11,0.3)',
            badge: 'TOKENS',
            headline: 'Ecosystem Tokens',
            sub: 'CLAWS \u00b7 POKERAI \u00b7 S4H \u00b7 ODDSCLAW \u00b7 All on Base',
        },
        pokerai: {
            accent: '#ef4444',
            accentGlow: 'rgba(239,68,68,0.3)',
            badge: 'POKERAI',
            headline: 'AI Agents Play Poker 24/7',
            sub: 'Watch \u00b7 Fund agents \u00b7 Earn their winnings \u00b7 USDC + $POKERAI',
        },
        oddsclaw: {
            accent: '#a855f7',
            accentGlow: 'rgba(168,85,247,0.3)',
            badge: 'ODDSCLAW',
            headline: 'What Are The Odds?',
            sub: 'Prediction markets on Base \u00b7 Create \u00b7 Trade \u00b7 Earn $ODDS',
        },
        crash: {
            accent: '#f97316',
            accentGlow: 'rgba(249,115,22,0.3)',
            badge: 'CLAWS CRASH',
            headline: 'How High Can You Go?',
            sub: 'Multiplier game powered by $CLAWS',
        },
        compute: {
            accent: '#06b6d4',
            accentGlow: 'rgba(6,182,212,0.3)',
            badge: 'COMPUTE NETWORK',
            headline: 'Power the Inclawbator',
            sub: 'Share your GPU \u00b7 Earn CLAWS + USD \u00b7 Free AI for everyone',
        },
        about: {
            accent: '#bc6c61',
            accentGlow: 'rgba(188,108,97,0.3)',
            badge: 'ABOUT',
            headline: 'The Agent-Human Economy',
            sub: 'Anyone Can Build. Everyone Gets Paid.',
        },
        blog: {
            accent: '#6366f1',
            accentGlow: 'rgba(99,102,241,0.3)',
            badge: 'BLOG',
            headline: 'Inclawbate Updates',
            sub: 'News \u00b7 Guides \u00b7 Announcements',
        },
        build: {
            accent: '#10b981',
            accentGlow: 'rgba(16,185,129,0.3)',
            badge: 'BUILD STUDIO',
            headline: 'Describe It. AI Builds It.',
            sub: 'No-code app builder \u00b7 See it live \u00b7 Publish instantly',
        },
        whitepaper: {
            accent: '#94a3b8',
            accentGlow: 'rgba(148,163,184,0.3)',
            badge: 'WHITEPAPER',
            headline: 'The Perpetual Value Engine',
            sub: 'Generate \u00b7 Manage \u00b7 Distribute \u00b7 Forever',
        },
        nfts: {
            accent: '#ec4899',
            accentGlow: 'rgba(236,72,153,0.3)',
            badge: 'NFTS',
            headline: 'Inclawbate NFT Collection',
            sub: 'Digital collectibles on Base',
        },
        explore: {
            accent: '#3b82f6',
            accentGlow: 'rgba(59,130,246,0.3)',
            badge: 'EXPLORE',
            headline: 'Discover the Ecosystem',
            sub: 'Apps \u00b7 Tokens \u00b7 Agents \u00b7 Tools \u00b7 All in one place',
        },
        'how-it-works': {
            accent: '#2dd4bf',
            accentGlow: 'rgba(45,212,191,0.3)',
            badge: 'HOW IT WORKS',
            headline: 'The Engine Explained',
            sub: 'Generate value \u00b7 Manage it \u00b7 Distribute it \u00b7 Repeat forever',
        },
        leaderboard: {
            accent: '#f59e0b',
            accentGlow: 'rgba(245,158,11,0.3)',
            badge: 'LEADERBOARD',
            headline: 'Top Builders',
            sub: 'Most apps \u00b7 Most upvotes \u00b7 Community rankings',
        },
    };

    const pg = pages[page] || null;
    const accent = pg?.accent || '#bc6c61';
    const accentGlow = pg?.accentGlow || 'rgba(188,108,97,0.3)';

    // Profile card
    if (isProfile) {
        return new ImageResponse(
            {
                type: 'div',
                props: {
                    style: {
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100%',
                        height: '100%',
                        background: '#0a0a12',
                        fontFamily: 'sans-serif',
                        color: '#e0e0e0',
                        position: 'relative',
                        overflow: 'hidden',
                    },
                    children: [
                        // Background glow
                        { type: 'div', props: { style: { position: 'absolute', top: '-100px', right: '-100px', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(188,108,97,0.15) 0%, transparent 70%)' } } },
                        { type: 'div', props: { style: { position: 'absolute', bottom: '-80px', left: '-80px', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(107,162,151,0.12) 0%, transparent 70%)' } } },
                        // Top accent bar
                        { type: 'div', props: { style: { width: '100%', height: '4px', background: 'linear-gradient(90deg, #6ba297, #d4a853, #bc6c61)' } } },
                        // Content
                        {
                            type: 'div',
                            props: {
                                style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '60px' },
                                children: [
                                    // Logo row
                                    { type: 'div', props: { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }, children: [
                                        { type: 'span', props: { style: { fontSize: '40px' }, children: '\uD83E\uDD9E' } },
                                        { type: 'span', props: { style: { fontSize: '28px', fontWeight: 800, color: '#888', letterSpacing: '0.05em', textTransform: 'uppercase' }, children: 'inclawbate' } },
                                    ] } },
                                    // Name
                                    { type: 'div', props: { style: { fontSize: '52px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '8px' }, children: name || handle } },
                                    // Handle
                                    handle ? { type: 'div', props: { style: { fontSize: '26px', color: '#bc6c61', fontWeight: 600, marginBottom: '16px' }, children: '@' + handle } } : null,
                                    // Tagline
                                    { type: 'div', props: { style: { fontSize: '20px', color: '#666', marginTop: '8px' }, children: 'Being incubated by AI agents' } },
                                ].filter(Boolean),
                            },
                        },
                        // Footer
                        { type: 'div', props: { style: { display: 'flex', justifyContent: 'center', padding: '20px', borderTop: '1px solid rgba(255,255,255,0.06)' }, children: [
                            { type: 'span', props: { style: { fontSize: '16px', color: '#333', letterSpacing: '0.1em', textTransform: 'uppercase' }, children: 'inclawbate.app' } },
                        ] } },
                    ].filter(Boolean),
                },
            },
            { width: 1200, height: 630 }
        );
    }

    // Page-specific or generic card
    const badge = pg?.badge || null;
    const headline = pg?.headline || tagline || 'Human Incubation by AI Agents';
    const sub = pg?.sub || (tagline ? null : 'Where AI agents hire humans. Real yield. Real work. Real economy.');

    return new ImageResponse(
        {
            type: 'div',
            props: {
                style: {
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    height: '100%',
                    background: '#0a0a12',
                    fontFamily: 'sans-serif',
                    color: '#e0e0e0',
                    position: 'relative',
                    overflow: 'hidden',
                },
                children: [
                    // Background glows
                    { type: 'div', props: { style: { position: 'absolute', top: '-120px', left: '50%', marginLeft: '-300px', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, ' + accentGlow + ' 0%, transparent 65%)' } } },
                    { type: 'div', props: { style: { position: 'absolute', bottom: '-150px', right: '-100px', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(107,162,151,0.1) 0%, transparent 70%)' } } },
                    // Top accent bar
                    { type: 'div', props: { style: { width: '100%', height: '4px', background: 'linear-gradient(90deg, #6ba297, ' + accent + ', #bc6c61)' } } },
                    // Content
                    {
                        type: 'div',
                        props: {
                            style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '60px 80px' },
                            children: [
                                // Logo
                                { type: 'div', props: { style: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: badge ? '32px' : '40px' }, children: [
                                    { type: 'span', props: { style: { fontSize: '52px' }, children: '\uD83E\uDD9E' } },
                                    { type: 'span', props: { style: { fontSize: '36px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }, children: 'inclawbate' } },
                                ] } },
                                // Badge
                                badge ? { type: 'div', props: { style: { display: 'flex', padding: '6px 20px', borderRadius: '20px', border: '1px solid ' + accent, background: 'rgba(255,255,255,0.03)', marginBottom: '24px' }, children: [
                                    { type: 'span', props: { style: { fontSize: '14px', fontWeight: 700, color: accent, letterSpacing: '0.15em', textTransform: 'uppercase' }, children: badge } },
                                ] } } : null,
                                // Headline
                                { type: 'div', props: { style: { fontSize: badge ? '44px' : '40px', fontWeight: 800, color: '#ffffff', textAlign: 'center', letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: '16px' }, children: headline } },
                                // Sub
                                sub ? { type: 'div', props: { style: { fontSize: '20px', color: '#777', textAlign: 'center', lineHeight: 1.5 }, children: sub } } : null,
                            ].filter(Boolean),
                        },
                    },
                    // Footer
                    { type: 'div', props: { style: { display: 'flex', justifyContent: 'center', padding: '20px', borderTop: '1px solid rgba(255,255,255,0.06)' }, children: [
                        { type: 'span', props: { style: { fontSize: '16px', color: '#333', letterSpacing: '0.1em', textTransform: 'uppercase' }, children: 'inclawbate.app' } },
                    ] } },
                ].filter(Boolean),
            },
        },
        { width: 1200, height: 630 }
    );
}
