// Bug Report → Telegram Council Chat
// POST /api/inclawbate/bug-report
// Requires wallet connection, rate limited 1 per 5 minutes per wallet

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BOT_TOKEN = process.env.INCLAWBATE_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes
const recentReports = new Map(); // wallet → timestamp (in-memory, resets on cold start)

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'https://inclawbate.app',
    'https://www.inclawbate.app',
    'http://localhost:3000',
    'http://localhost:5500'
];

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { wallet, page, message, category } = req.body || {};

        // Validate
        if (!wallet || typeof wallet !== 'string' || !wallet.startsWith('0x') || wallet.length !== 42) {
            return res.status(400).json({ error: 'Wallet connection required' });
        }
        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }
        if (message.length > 2000) {
            return res.status(400).json({ error: 'Message too long (max 2000 chars)' });
        }

        const walletLower = wallet.toLowerCase();

        // Rate limit
        const lastReport = recentReports.get(walletLower);
        if (lastReport && Date.now() - lastReport < RATE_LIMIT_MS) {
            const waitSec = Math.ceil((RATE_LIMIT_MS - (Date.now() - lastReport)) / 1000);
            return res.status(429).json({ error: `Please wait ${waitSec}s before submitting another report` });
        }

        // Look up display name from profile
        let displayName = wallet.slice(0, 6) + '...' + wallet.slice(-4);
        try {
            const { data: profile } = await supabase
                .from('human_profiles')
                .select('display_name, x_handle')
                .eq('wallet_address', walletLower)
                .maybeSingle();
            if (profile) {
                displayName = profile.display_name || (profile.x_handle ? '@' + profile.x_handle : displayName);
            }
        } catch (e) { /* silent */ }

        // Format TG message
        const categoryEmoji = {
            bug: '🐛',
            ui: '🎨',
            feature: '💡',
            security: '🔒',
            other: '📝'
        };
        const emoji = categoryEmoji[category] || '📝';
        const shortWallet = wallet.slice(0, 6) + '...' + wallet.slice(-4);
        const cleanMsg = message.trim().replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
        const cleanPage = (page || 'unknown').replace(/[<>&]/g, '');

        const tgText = `${emoji} <b>Bug Report</b>\n`
            + `<b>From:</b> ${displayName} (<code>${shortWallet}</code>)\n`
            + `<b>Page:</b> ${cleanPage}\n`
            + `<b>Type:</b> ${category || 'other'}\n`
            + `━━━━━━━━━━━━━━\n`
            + `${cleanMsg}`;

        // Send to TG
        if (!BOT_TOKEN || !CHAT_ID) {
            return res.status(500).json({ error: 'Bot not configured' });
        }

        const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: tgText,
                parse_mode: 'HTML'
            })
        });

        const tgData = await tgRes.json();
        if (!tgData.ok) {
            console.error('TG send error:', tgData);
            return res.status(502).json({ error: 'Failed to send report' });
        }

        // Update rate limit
        recentReports.set(walletLower, Date.now());

        // Clean up old entries (prevent memory leak)
        if (recentReports.size > 1000) {
            const now = Date.now();
            for (const [k, v] of recentReports) {
                if (now - v > RATE_LIMIT_MS) recentReports.delete(k);
            }
        }

        return res.status(200).json({ ok: true, message: 'Report sent! Thank you.' });

    } catch (err) {
        console.error('Bug report error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
}
