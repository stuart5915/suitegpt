// Inclawbate — Daily Stats Card Image
// Generates a branded PNG card with current CLAWS stats
// Used by /daily to attach an image to the Telegram post
// All stats passed as query params — easy to preview in browser
//
// CUSTOMIZATION:
//   - Colors: edit COLORS object below
//   - Layout: edit the element tree in handler()
//   - Card size: change width/height in ImageResponse options

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

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
            alignItems: 'center', marginBottom: 10, fontSize: 21,
        }
    },
        h('span', { style: { color: COLORS.muted } }, label),
        h('span', { style: { color: valueColor || COLORS.text, fontWeight: 600 } }, String(value))
    );
}

function card(children, extraStyle) {
    return h('div', {
        style: {
            display: 'flex', flexDirection: 'column',
            backgroundColor: COLORS.card, borderRadius: 16,
            padding: 24, flex: 1,
            ...(extraStyle || {}),
        }
    }, ...children);
}

function cardLabel(text) {
    return h('div', {
        style: { display: 'flex', fontSize: 15, color: COLORS.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }
    }, text);
}

function cardValue(text) {
    return h('div', {
        style: { display: 'flex', fontSize: 32, fontWeight: 800, color: COLORS.text }
    }, String(text));
}

function cardTitle(text) {
    return h('div', {
        style: { display: 'flex', fontSize: 21, fontWeight: 700, marginBottom: 16, color: COLORS.text }
    }, text);
}

// ── Handler ──

export default async function handler(req) {
    const url = new URL(req.url);
    const p = (key, fallback) => url.searchParams.get(key) || fallback || '\u2014';

    const changeNum = parseFloat(p('change', '0'));
    const changeColor = changeNum >= 0 ? COLORS.green : COLORS.red;
    const changeText = (changeNum >= 0 ? '+' : '') + changeNum.toFixed(1) + '% today';

    const element = h('div', {
        style: {
            display: 'flex', flexDirection: 'column',
            width: '100%', height: '100%',
            backgroundColor: COLORS.bg, padding: 40,
            color: COLORS.text, fontFamily: 'sans-serif',
        }
    },
        // ── Header ──
        h('div', {
            style: {
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: 28,
            }
        },
            h('div', { style: { display: 'flex', alignItems: 'center', fontSize: 36, fontWeight: 800 } },
                h('span', { style: { marginRight: 12 } }, '\uD83E\uDD9E'),
                '$CLAWS Daily'
            ),
            h('div', { style: { display: 'flex', fontSize: 22, color: COLORS.muted } }, p('date'))
        ),

        // ── Top row: Price / Treasury / Incubations ──
        h('div', { style: { display: 'flex', marginBottom: 20 } },
            card([
                cardLabel('\uD83D\uDCB0 Price'),
                cardValue(p('price')),
                h('div', { style: { display: 'flex', fontSize: 18, color: changeColor, marginTop: 4 } }, changeText),
            ], { marginRight: 16 }),

            card([
                cardLabel('\uD83C\uDFE6 Treasury'),
                cardValue(p('treasury')),
            ], { marginRight: 16 }),

            card([
                cardLabel('\uD83E\uDD9E Incubations'),
                cardValue(p('incubations')),
                h('div', { style: { display: 'flex', fontSize: 18, color: COLORS.muted, marginTop: 4 } }, 'active'),
            ])
        ),

        // ── Bottom row: Staking / Angel ──
        h('div', { style: { display: 'flex', flex: 1 } },
            card([
                cardTitle('\uD83D\uDCCA Staking Rewards'),
                statRow('Rate', p('stakingRate') + ' /day'),
                statRow('Annual', '~' + p('stakingAnnual') + '/yr'),
                statRow('APY', p('stakingApy') + '%', COLORS.green),
                statRow('Value Staked', '~' + p('stakedValue')),
                statRow('Stakers', p('stakers')),
            ], { marginRight: 16 }),

            card([
                cardTitle('\uD83D\uDE07 Angel NFT Rewards'),
                statRow('Rate', p('angelRate') + ' /day'),
                statRow('Annual', '~' + p('angelAnnual') + '/yr'),
                statRow('NFT Floor', p('angelFloor')),
                statRow('Holders', p('angelHolders')),
            ])
        ),

        // ── Footer ──
        h('div', {
            style: {
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginTop: 20, paddingTop: 16,
                borderTop: '1px solid ' + COLORS.border, fontSize: 20,
            }
        },
            h('span', null, '\uD83D\uDD12 ' + p('locked') + '% out of circulation'),
            h('span', { style: { color: COLORS.muted } }, 'inclawbate.com')
        )
    );

    return new ImageResponse(element, { width: 1200, height: 630 });
}
