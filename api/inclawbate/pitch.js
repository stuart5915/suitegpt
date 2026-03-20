// Inclawbate — Pitch / Contact Form
// POST /api/inclawbate/pitch
// No auth required — anyone can submit

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BOT_TOKEN = process.env.INCLAWBATE_TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.INCLAWBATE_ADMIN_CHAT_ID;

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'https://inclawbate.app',
    'https://www.inclawbate.app'
];

function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function notifyTelegram(message, contact) {
    if (!BOT_TOKEN || !ADMIN_CHAT_ID) return;
    try {
        const text = `📩 <b>New Pitch</b>\n\n${esc(message)}\n\n` +
            (contact ? `📱 <b>Contact:</b> ${esc(contact)}` : '<i>No contact info</i>');
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: ADMIN_CHAT_ID,
                text,
                parse_mode: 'HTML'
            })
        });
    } catch (e) {
        console.error('TG notify error:', e);
    }
}

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { message, contact } = req.body || {};

    if (!message || !message.trim() || message.trim().length < 5) {
        return res.status(400).json({ error: 'Please describe your idea (at least a few words)' });
    }

    if (message.length > 2000) {
        return res.status(400).json({ error: 'Message too long (2000 char max)' });
    }

    // Rate limit by IP — max 3 per hour
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count } = await supabase
        .from('pitches')
        .select('*', { count: 'exact', head: true })
        .eq('ip', ip)
        .gte('created_at', oneHourAgo);

    if (count >= 3) {
        return res.status(429).json({ error: 'Too many submissions. Try again later.' });
    }

    // Save to DB
    const { error } = await supabase
        .from('pitches')
        .insert({
            message: message.trim(),
            contact: (contact || '').trim() || null,
            ip
        });

    if (error) {
        console.error('pitch insert error:', error);
        return res.status(500).json({ error: 'Failed to save. Try again.' });
    }

    // Notify via Telegram (non-blocking)
    notifyTelegram(message.trim(), (contact || '').trim());

    return res.status(200).json({ ok: true });
}
