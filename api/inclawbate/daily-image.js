// Inclawbate — Daily Stats Card Image
// Square 1080x1080 for max X display. BIG text, minimal chrome.

import satori from 'satori';
import sharp from 'sharp';

const WIDTH = 1080;
const HEIGHT = 1080;

const BG = '#0d0d14';
const CARD = '#16162a';
const WHITE = '#ffffff';
const GRAY = '#8888a0';
const GREEN = '#22c55e';
const RED = '#ef4444';

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

function statLine(label, value, color) {
    return h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 } },
        h('span', { style: { fontSize: 44, color: GRAY } }, label),
        h('span', { style: { fontSize: 44, color: color || WHITE, fontWeight: 700 } }, String(value))
    );
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
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 } },
                h('div', { style: { fontSize: 64, fontWeight: 700 } }, '$CLAWS Daily'),
                h('div', { style: { fontSize: 38, color: GRAY } }, p('date', ''))
            ),

            // Price + change
            h('div', { style: { display: 'flex', alignItems: 'baseline', marginBottom: 12 } },
                h('span', { style: { fontSize: 88, fontWeight: 700 } }, p('price', '—')),
                h('span', { style: { fontSize: 44, color: chColor, marginLeft: 20 } }, chText)
            ),

            // Treasury line
            h('div', { style: { display: 'flex', alignItems: 'baseline', marginBottom: 8 } },
                h('span', { style: { fontSize: 44, color: GRAY } }, 'Treasury'),
                h('span', { style: { fontSize: 64, fontWeight: 700, marginLeft: 20 } }, p('treasury', '—')),
                td ? h('span', { style: { fontSize: 36, color: tdColor, marginLeft: 14 } }, '(' + td + ')') : null,
            ),
            // Treasury sub
            h('div', { style: { display: 'flex', fontSize: 30, color: GRAY, marginBottom: 32 } },
                h('span', null, 'LP ' + p('treasuryLp', '—')),
                h('span', { style: { marginLeft: 28, marginRight: 28 } }, '|'),
                h('span', null, 'ETH ' + p('treasuryEth', '—')),
                p('treasuryEthDaily') ? h('span', { style: { color: GREEN, marginLeft: 8 } }, p('treasuryEthDaily')) : null,
                h('span', { style: { marginLeft: 28, marginRight: 28 } }, '|'),
                h('span', null, p('treasuryClaws', '—')),
            ),

            // Divider
            h('div', { style: { display: 'flex', height: 2, backgroundColor: '#2a2a3e', marginBottom: 28 } }),

            // CLAWS Staking
            h('div', { style: { display: 'flex', fontSize: 48, fontWeight: 700, marginBottom: 14 } }, 'CLAWS Staking'),
            statLine('Total Staked', p('stakingTotal', '—')),
            statLine('Distribution', p('stakingRate', '—')),
            statLine('APY', p('stakingApy', '—') + '%', GREEN),
            statLine('Stakers', p('stakers', '—')),

            // Spacer
            h('div', { style: { display: 'flex', height: 2, backgroundColor: '#2a2a3e', marginTop: 22, marginBottom: 28 } }),

            // Angel NFT
            h('div', { style: { display: 'flex', fontSize: 48, fontWeight: 700, marginBottom: 14 } }, 'Angel NFT Rewards'),
            statLine('Distribution', p('angelRate', '—')),
            statLine('Annual', p('angelAnnual', '—')),
            statLine('Floor / APY', p('angelFloor', '—') + (p('angelApy') && p('angelApy') !== '—' ? '  |  ' + p('angelApy') + '%' : ''), p('angelApy') && p('angelApy') !== '—' ? GREEN : WHITE),
            statLine('Holders', p('angelHolders', '—')),

            // Footer
            h('div', { style: { display: 'flex', flex: 1 } }),
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '2px solid #2a2a3e' } },
                h('span', { style: { fontSize: 34, fontWeight: 700 } }, p('locked', '—') + '% locked'),
                h('span', { style: { fontSize: 34, color: GRAY } }, p('incubations', '0') + ' incubations'),
                h('span', { style: { fontSize: 34, color: GRAY } }, 'inclawbate.com')
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
