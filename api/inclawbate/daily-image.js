// Inclawbate — Daily Stats Card Image
// Generates a branded PNG card with current CLAWS stats
// Used by /daily to attach an image to the Telegram post
// All stats passed as query params — easy to preview in browser
//
// CUSTOMIZATION:
//   - Colors: edit COLORS object below
//   - Layout: edit the element tree in handler()
//   - Card size: change WIDTH/HEIGHT constants

import satori from 'satori';
import sharp from 'sharp';

const WIDTH = 1200;
const HEIGHT = 660;

// ── Brand Colors (edit these to change the look) ──
const COLORS = {
    bg: '#0d0d14',
    card: '#16162a',
    text: '#ffffff',
    muted: '#8888a0',
    accent: '#ff6b35',   // lobster orange
    green: '#22c55e',
    red: '#ef4444',
    border: '#2a2a3e',
};

// ── Load font (cached after first call) ──
let fontCache = null;
async function loadFont() {
    if (fontCache) return fontCache;
    const [regular, bold] = await Promise.all([
        fetch('https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff').then(r => r.arrayBuffer()),
        fetch('https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.woff').then(r => r.arrayBuffer()),
    ]);
    fontCache = [
        { name: 'Inter', data: regular, weight: 400, style: 'normal' },
        { name: 'Inter', data: bold, weight: 700, style: 'normal' },
    ];
    return fontCache;
}

// ── Element helper (like React.createElement, no React needed) ──
function h(type, props, ...children) {
    const flat = children.flat(Infinity).filter(c => c != null && c !== false);
    return {
        type,
        props: {
            ...(props || {}),
            children: flat.length === 0 ? undefined : flat.length === 1 ? flat[0] : flat
        }
    };
}

// ── Reusable components ──

function statRow(label, value, valueColor) {
    return h('div', {
        style: {
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 8, fontSize: 19,
        }
    },
        h('span', { style: { color: COLORS.muted } }, label),
        h('span', { style: { color: valueColor || COLORS.text, fontWeight: 700 } }, String(value))
    );
}

function smallRow(label, value) {
    return h('div', {
        style: {
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 4, fontSize: 15,
        }
    },
        h('span', { style: { color: COLORS.muted } }, label),
        h('span', { style: { color: '#ccccdd' } }, String(value))
    );
}

function card(children, extraStyle) {
    return h('div', {
        style: {
            display: 'flex', flexDirection: 'column',
            backgroundColor: COLORS.card, borderRadius: 16,
            padding: 20, flex: 1,
            ...(extraStyle || {}),
        }
    }, ...children);
}

function cardLabel(text) {
    return h('div', {
        style: { display: 'flex', fontSize: 14, color: COLORS.muted, marginBottom: 4, letterSpacing: 1 }
    }, text.toUpperCase());
}

function cardValue(text, extraStyle) {
    return h('div', {
        style: { display: 'flex', fontSize: 28, fontWeight: 700, color: COLORS.text, ...(extraStyle || {}) }
    }, String(text));
}

function cardTitle(text) {
    return h('div', {
        style: { display: 'flex', fontSize: 19, fontWeight: 700, marginBottom: 12, color: COLORS.text }
    }, text);
}

// ── Handler ──

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'GET only' });
    }

    try {
        const url = new URL(req.url, `https://${req.headers.host}`);
        const p = (key, fallback) => url.searchParams.get(key) || fallback || '';

        const changeNum = parseFloat(p('change', '0'));
        const changeColor = changeNum >= 0 ? COLORS.green : COLORS.red;
        const changeText = (changeNum >= 0 ? '+' : '') + changeNum.toFixed(1) + '%';
        const treasuryDelta = p('treasuryDelta');
        const treasuryDeltaColor = treasuryDelta.startsWith('+') ? COLORS.green : treasuryDelta.startsWith('-') ? COLORS.red : COLORS.muted;

        const element = h('div', {
            style: {
                display: 'flex', flexDirection: 'column',
                width: '100%', height: '100%',
                backgroundColor: COLORS.bg, padding: 36,
                color: COLORS.text, fontFamily: 'Inter',
            }
        },
            // ── Header ──
            h('div', {
                style: {
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 20,
                }
            },
                h('div', { style: { display: 'flex', alignItems: 'center', fontSize: 32, fontWeight: 700 } },
                    '$CLAWS Daily'
                ),
                h('div', { style: { display: 'flex', fontSize: 20, color: COLORS.muted } }, p('date', 'Today'))
            ),

            // ── Top row: Price / Treasury (with breakdown) / Incubations ──
            h('div', { style: { display: 'flex', marginBottom: 16 } },
                // Price
                card([
                    cardLabel('Price'),
                    cardValue(p('price', '—')),
                    h('div', { style: { display: 'flex', fontSize: 16, color: changeColor, marginTop: 2 } }, changeText + ' today'),
                ], { marginRight: 12, flex: 0.8 }),

                // Treasury with breakdown
                card([
                    cardLabel('Treasury'),
                    h('div', { style: { display: 'flex', alignItems: 'center' } },
                        cardValue(p('treasury', '—'), { marginRight: 8 }),
                        treasuryDelta ? h('span', { style: { fontSize: 16, color: treasuryDeltaColor } }, '(' + treasuryDelta + ')') : null
                    ),
                    h('div', { style: { display: 'flex', flexDirection: 'column', marginTop: 8 } },
                        smallRow('LP', p('treasuryLp', '—')),
                        smallRow('ETH', p('treasuryEth', '—') + (p('treasuryEthDaily') ? '  ' + p('treasuryEthDaily') : '')),
                        smallRow('CLAWS', p('treasuryClaws', '—')),
                    ),
                ], { marginRight: 12, flex: 1.4 }),

                // Incubations
                card([
                    cardLabel('Incubations'),
                    cardValue(p('incubations', '0')),
                    h('div', { style: { display: 'flex', fontSize: 16, color: COLORS.muted, marginTop: 2 } }, 'active'),
                ], { flex: 0.6 })
            ),

            // ── Middle row: CLAWS Staking / Angel NFT ──
            h('div', { style: { display: 'flex', flex: 1 } },
                card([
                    cardTitle('CLAWS Staking'),
                    statRow('Total Staked', p('stakingTotal', '—')),
                    statRow('Distribution', p('stakingRate', '—')),
                    statRow('Annual', p('stakingAnnual', '—')),
                    statRow('APY', p('stakingApy', '—') + '%', COLORS.green),
                    statRow('Stakers', p('stakers', '—')),
                ], { marginRight: 12 }),

                card([
                    cardTitle('Angel NFT Rewards'),
                    statRow('Distribution', p('angelRate', '—')),
                    statRow('Annual', p('angelAnnual', '—')),
                    statRow('NFT Floor', p('angelFloor', '—')),
                    p('angelApy') && p('angelApy') !== '—' ? statRow('APY', p('angelApy') + '%', COLORS.green) : null,
                    statRow('Holders', p('angelHolders', '—')),
                ])
            ),

            // ── Footer: locked + community vote ──
            h('div', {
                style: {
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginTop: 14, paddingTop: 12,
                    borderTop: '1px solid #2a2a3e', fontSize: 16,
                }
            },
                h('span', null, p('locked', '—') + '% locked'),
                p('votes') ? h('span', { style: { color: COLORS.muted, fontSize: 14 } },
                    'Community (' + p('voteCount', '0') + '): ' + p('votes')
                ) : null,
                h('span', { style: { color: COLORS.muted } }, 'inclawbate.com')
            )
        );

        const fonts = await loadFont();
        const svg = await satori(element, { width: WIDTH, height: HEIGHT, fonts });
        const png = await sharp(Buffer.from(svg)).png().toBuffer();

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'no-cache, no-store');
        return res.send(png);

    } catch (err) {
        console.error('Daily image error:', err);
        return res.status(500).json({ error: err.message, stack: err.stack });
    }
}
