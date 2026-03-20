// Inclawbate — Daily Stats Card Image
// Square 1080x1080 for max X display. BIG text, full-width rows.

import satori from 'satori';
import sharp from 'sharp';

const WIDTH = 1080;
const HEIGHT = 1080;

const BG = '#0d0d14';
const WHITE = '#ffffff';
const GRAY = '#7a7a90';
const GREEN = '#22c55e';
const RED = '#ef4444';
const DIVIDER = '#2a2a3e';

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
    return { type, props: { ...(props || {}), children: flat.length === 0 ? undefined : flat.length === 1 ? flat[0] : flat } };
}

function stat(label, value, color) {
    return h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 } },
        h('span', { style: { fontSize: 38, color: GRAY } }, label),
        h('span', { style: { fontSize: 38, color: color || WHITE, fontWeight: 700 } }, String(value))
    );
}

function divider() {
    return h('div', { style: { display: 'flex', height: 2, backgroundColor: DIVIDER, marginTop: 16, marginBottom: 16 } });
}

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

    try {
        const url = new URL(req.url, `https://${req.headers.host}`);
        const p = (k, fb) => url.searchParams.get(k) || fb || '';

        const ch = parseFloat(p('change', '0'));
        const chColor = ch >= 0 ? GREEN : RED;
        const chText = (ch >= 0 ? '+' : '') + ch.toFixed(1) + '%';
        const td = p('treasuryDelta');
        const tdColor = td.startsWith('+') ? GREEN : td.startsWith('-') ? RED : GRAY;

        const element = h('div', {
            style: {
                display: 'flex', flexDirection: 'column',
                width: '100%', height: '100%',
                backgroundColor: BG, padding: 48,
                color: WHITE, fontFamily: 'Inter',
            }
        },
            // Header
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 } },
                h('div', { style: { fontSize: 58, fontWeight: 700 } }, '$CLAWS Daily'),
                h('div', { style: { fontSize: 34, color: GRAY } }, p('date', ''))
            ),

            // Price
            h('div', { style: { display: 'flex', alignItems: 'baseline', marginBottom: 10 } },
                h('span', { style: { fontSize: 82, fontWeight: 700 } }, p('price', '—')),
                h('span', { style: { fontSize: 40, color: chColor, marginLeft: 16 } }, chText)
            ),

            // Treasury
            h('div', { style: { display: 'flex', alignItems: 'baseline', marginBottom: 6 } },
                h('span', { style: { fontSize: 38, color: GRAY } }, 'Treasury'),
                h('span', { style: { fontSize: 58, fontWeight: 700, marginLeft: 16 } }, p('treasury', '—')),
                td ? h('span', { style: { fontSize: 32, color: tdColor, marginLeft: 12 } }, td) : null,
            ),
            h('div', { style: { display: 'flex', fontSize: 26, color: GRAY, marginBottom: 6 } },
                h('span', null, 'LP ' + p('treasuryLp', '—')),
                h('span', { style: { marginLeft: 20, marginRight: 20 } }, '|'),
                h('span', null, 'ETH ' + p('treasuryEth', '')),
                p('treasuryEthDaily') ? h('span', { style: { color: GREEN, marginLeft: 6 } }, p('treasuryEthDaily')) : null,
                h('span', { style: { marginLeft: 20, marginRight: 20 } }, '|'),
                h('span', null, p('treasuryClaws', '—')),
            ),

            divider(),

            // CLAWS Staking — full width
            h('div', { style: { display: 'flex', fontSize: 42, fontWeight: 700, marginBottom: 20 } }, 'CLAWS Staking'),
            stat('Total Staked', p('stakingTotal', '—')),
            stat('Distribution', p('stakingRate', '—')),
            stat('APY', p('stakingApy', '—') + '%', GREEN),
            stat('Stakers', p('stakers', '—')),

            divider(),

            // Angel NFT — full width
            h('div', { style: { display: 'flex', fontSize: 42, fontWeight: 700, marginBottom: 20 } }, 'Angel NFT Rewards'),
            stat('Distribution', p('angelRate', '—')),
            stat('Annual', p('angelAnnual', '—')),
            stat('NFT Floor', p('angelFloor', '—')),
            p('angelApy') && p('angelApy') !== '—' ? stat('APY', p('angelApy') + '%', GREEN) : null,
            stat('Holders', p('angelHolders', '—')),

            // Spacer
            h('div', { style: { display: 'flex', flex: 1 } }),

            // Footer
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '2px solid #2a2a3e' } },
                h('span', { style: { fontSize: 30, fontWeight: 700 } }, p('locked', '—') + '% locked'),
                h('span', { style: { fontSize: 30, color: GRAY } }, p('incubations', '0') + ' incubations'),
                h('span', { style: { fontSize: 30, color: GRAY } }, 'inclawbate.app')
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
        return res.status(500).json({ error: err.message });
    }
}
