// Inclawbate — Telegram Bot Webhook
// Handles /start commands to link Telegram accounts to profiles
// POST /api/inclawbate/telegram-webhook — called by Telegram Bot API

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BOT_TOKEN = process.env.INCLAWBATE_TELEGRAM_BOT_TOKEN;

async function sendTelegramMessage(chatId, text) {
    if (!BOT_TOKEN) return;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    try {
        const update = req.body;
        const message = update?.message;
        if (!message || !message.text) return res.status(200).json({ ok: true });

        const chatId = message.chat.id;
        const text = message.text.trim();

        // Handle /start <handle>
        if (text.startsWith('/start')) {
            const parts = text.split(/\s+/);
            const handle = parts[1]?.toLowerCase();

            if (!handle) {
                await sendTelegramMessage(chatId,
                    '🦞 <b>Welcome to Inclawbate!</b>\n\n' +
                    'To connect your profile, go to your profile on inclawbate.com and click "Connect Telegram".\n\n' +
                    'Or send: /start yourxhandle'
                );
                return res.status(200).json({ ok: true });
            }

            // Look up the profile
            const { data: profile, error } = await supabase
                .from('human_profiles')
                .select('id, x_handle, x_name')
                .eq('x_handle', handle)
                .single();

            if (error || !profile) {
                await sendTelegramMessage(chatId,
                    `❌ No profile found for @${handle}. Make sure you've created your profile at inclawbate.com/launch first.`
                );
                return res.status(200).json({ ok: true });
            }

            // Store chat_id
            const { error: updateErr } = await supabase
                .from('human_profiles')
                .update({ telegram_chat_id: String(chatId) })
                .eq('id', profile.id);

            if (updateErr) {
                console.error('Telegram link error:', updateErr);
                await sendTelegramMessage(chatId, '❌ Something went wrong. Try again.');
                return res.status(200).json({ ok: true });
            }

            await sendTelegramMessage(chatId,
                `✅ <b>Connected!</b>\n\n` +
                `You'll now get notified here when an agent hires you or sends a message.\n\n` +
                `Profile: inclawbate.com/u/${profile.x_handle}`
            );
            return res.status(200).json({ ok: true });
        }

        // Unknown command
        await sendTelegramMessage(chatId,
            '🦞 Inclawbate Notifications Bot\n\nSend /start yourxhandle to connect your profile.'
        );

        return res.status(200).json({ ok: true });

    } catch (err) {
        console.error('Telegram webhook error:', err);
        return res.status(200).json({ ok: true }); // Always 200 so Telegram doesn't retry
    }
}
