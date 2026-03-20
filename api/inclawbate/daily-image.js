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

// Square = X shows it largest in feed
const WIDTH = 1080;
const HEIGHT = 1080;

const COLORS = {
    bg: '#0d0d14',
    card: '#16162a',
    text: '#ffffff',
    muted: '#8888a0',
    green: '#22c55e',
    red: '#ef4444',
    border: '#2a2a3e',
};

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

function row(label, value, valueColor) {
    return h('div', {
        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }
    },
        h('span', { style: { fontSize: 32, color: COLORS.muted } }, label),
        h('span', { style: { fontSize: 32, color: valueColor || COLORS.text, fontWeight: 700 } }, String(value))
    );
}

function bigRow(label, value, valueColor) {
    return h('div', {
        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }
    },
        h('span', { style: { fontSize: 36, color: COLORS.muted } }, label),
        h('span', { style: { fontSize: 36, color: valueColor || COLORS.text, fontWeight: 700 } }, String(value))
    );
}

function section(title, children) {
    return h('div', {
        style: {
            display: 'flex', flexDirection: 'column',
            backgroundColor: COLORS.card, borderRadius: 20,
            padding: '20px 28px', flex: 1,
        }
    },
        h('div', { style: { fontSize: 30, fontWeight: 700, marginBottom: 14, color: COLORS.text } }, title),
        ...children
    );
}

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

    try {
        const url = new URL(req.url, `https://${req.headers.host}`);
        const p = (key, fb) => url.searchParams.get(key) || fb || '';

        const changeNum = parseFloat(p('change', '0'));
        const changeColor = changeNum >= 0 ? COLORS.green : COLORS.red;
        const changeText = (changeNum >= 0 ? '+' : '') + changeNum.toFixed(1) + '%';
        const td = p('treasuryDelta');
        const tdColor = td.startsWith('+') ? COLORS.green : td.startsWith('-') ? COLORS.red : COLORS.muted;

        const element = h('div', {
            style: {
                display: 'flex', flexDirection: 'column',
                width: '100%', height: '100%',
                backgroundColor: COLORS.bg, padding: '36px 40px',
                color: COLORS.text, fontFamily: 'Inter',
            }
        },
            // ── Header ──
            h('div', {
                style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }
            },
                h('div', { style: { fontSize: 52, fontWeight: 700 } }, '$CLAWS Daily'),
                h('div', { style: { fontSize: 32, color: COLORS.muted } }, p('date', 'Today'))
            ),

            // ── Price row ──
            h('div', {
                style: {
                    display: 'flex', alignItems: 'center', marginBottom: 24,
                    backgroundColor: COLORS.card, borderRadius: 20, padding: '18px 28px',
                }
            },
                h('span', { style: { fontSize: 56, fontWeight: 700, marginRight: 20 } }, p('price', '—')),
                h('span', { style: { fontSize: 36, color: changeColor } }, changeText),
                h('div', { style: { display: 'flex', flex: 1 } }),
                h('span', { style: { fontSize: 36, color: COLORS.muted } }, 'Treasury '),
                h('span', { style: { fontSize: 48, fontWeight: 700, marginLeft: 8, marginRight: 10 } }, p('treasury', '—')),
                td ? h('span', { style: { fontSize: 30, color: tdColor } }, '(' + td + ')') : null,
            ),

            // ── Treasury breakdown (compact) ──
            h('div', {
                style: {
                    display: 'flex', justifyContent: 'space-between', marginBottom: 20,
                    padding: '0 10px', fontSize: 26, color: COLORS.muted,
                }
            },
                h('span', null, 'LP: ' + p('treasuryLp', '—')),
                h('span', null, 'ETH: ' + p('treasuryEth', '—') + (p('treasuryEthDaily') ? ' (' + p('treasuryEthDaily') + ')' : '')),
                h('span', null, 'CLAWS: ' + p('treasuryClaws', '—')),
                h('span', null, p('incubations', '0') + ' incubations'),
            ),

            // ── Staking + Angel side by side ──
            h('div', { style: { display: 'flex', flex: 1, marginBottom: 16 } },
                h('div', {
                    style: {
                        display: 'flex', flexDirection: 'column',
                        backgroundColor: COLORS.card, borderRadius: 20,
                        padding: '20px 28px', flex: 1, marginRight: 16,
                    }
                },
                    h('div', { style: { fontSize: 34, fontWeight: 700, marginBottom: 16 } }, 'CLAWS Staking'),
                    bigRow('Total Staked', p('stakingTotal', '—')),
                    bigRow('Distribution', p('stakingRate', '—')),
                    bigRow('Annual', p('stakingAnnual', '—')),
                    bigRow('APY', p('stakingApy', '—') + '%', COLORS.green),
                    bigRow('Stakers', p('stakers', '—')),
                ),

                h('div', {
                    style: {
                        display: 'flex', flexDirection: 'column',
                        backgroundColor: COLORS.card, borderRadius: 20,
                        padding: '20px 28px', flex: 1,
                    }
                },
                    h('div', { style: { fontSize: 34, fontWeight: 700, marginBottom: 16 } }, 'Angel NFT Rewards'),
                    bigRow('Distribution', p('angelRate', '—')),
                    bigRow('Annual', p('angelAnnual', '—')),
                    bigRow('NFT Floor', p('angelFloor', '—')),
                    p('angelApy') && p('angelApy') !== '—' ? bigRow('APY', p('angelApy') + '%', COLORS.green) : null,
                    bigRow('Holders', p('angelHolders', '—')),
                ),
            ),

            // ── Footer ──
            h('div', {
                style: {
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    paddingTop: 14, borderTop: '2px solid #2a2a3e',
                }
            },
                h('span', { style: { fontSize: 28, fontWeight: 700 } }, p('locked', '—') + '% locked'),
                p('votes') ? h('span', { style: { color: COLORS.muted, fontSize: 22 } },
                    'Community (' + p('voteCount', '0') + '): ' + p('votes')
                ) : null,
                h('span', { style: { color: COLORS.muted, fontSize: 28 } }, 'inclawbate.com')
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
