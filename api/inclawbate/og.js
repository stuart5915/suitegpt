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
                            { type: 'span', props: { style: { fontSize: '16px', color: '#333', letterSpacing: '0.1em', textTransform: 'uppercase' }, children: 'inclawbate.com' } },
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
                        { type: 'span', props: { style: { fontSize: '16px', color: '#333', letterSpacing: '0.1em', textTransform: 'uppercase' }, children: 'inclawbate.com' } },
                    ] } },
                ].filter(Boolean),
            },
        },
        { width: 1200, height: 630 }
    );
}
