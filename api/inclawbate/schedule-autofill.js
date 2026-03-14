// Auto-fill @inclawbator schedule with pillar-based content drafts
// POST {action:"generate"} — generate drafts for empty slots (admin only)
// GET  ?date=YYYY-MM-DD    — get drafts for a date

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ADMIN_WALLETS = ['0x91b5c0d07859cfeafeb67d9694121cd741f049bd'];
const VALID_HOURS = [1, 13, 16, 19, 22];

// Content pillars by day of week (0=Sun)
const PILLARS = [
    { name: 'Weekly Recap',       emoji: '\u{1F4CA}', needsImage: true,  desc: 'Recap what shipped this week, platform stats, what\'s coming next' },
    { name: 'App Spotlight',      emoji: '\u{1F4F1}', needsImage: true,  desc: 'Deep dive on one specific app — what it does, why it\'s cool, link to try it' },
    { name: 'Builder Shoutout',   emoji: '\u{1F477}', needsImage: false, desc: 'Highlight a builder or community member — what they made, tag them' },
    { name: 'DeFi / CLAWS Update',emoji: '\u{26D3}',  needsImage: true,  desc: 'CLAWS price, staking stats, LP news, ecosystem numbers' },
    { name: 'How-To / Tips',      emoji: '\u{1F4A1}', needsImage: false, desc: 'Tutorial or tip — "Did you know you can..." educational content' },
    { name: 'Community Vibes',    emoji: '\u{1F525}', needsImage: true,  desc: 'Poll, hot take, meme, engagement bait — get people talking' },
    { name: 'Incubation CTA',     emoji: '\u{1F680}', needsImage: true,  desc: 'Sell the incubation service — "Got a project? We build it for you"' },
];

// Slot-level sub-topics so 5 posts/day aren't all the same
const SLOT_ANGLES = {
    'App Spotlight':       ['feature highlight', 'user story', 'compare to alternatives', 'quick demo walkthrough', 'hidden feature'],
    'Builder Shoutout':    ['their journey', 'what they built', 'dev tips from them', 'their stack', 'community impact'],
    'DeFi / CLAWS Update': ['price + volume', 'staking APY', 'LP performance', 'holder growth', 'ecosystem TVL'],
    'How-To / Tips':       ['getting started', 'power user tip', 'common mistakes', 'hidden features', 'workflow hack'],
    'Community Vibes':     ['hot take poll', 'this or that', 'unpopular opinion', 'meme', 'community shoutout'],
    'Incubation CTA':      ['success story', 'what we offer', 'founder testimonial', 'process walkthrough', 'limited spots'],
    'Weekly Recap':        ['shipped this week', 'top apps', 'community highlights', 'stats roundup', 'next week preview'],
};

const ALLOWED_ORIGINS = [
    'https://inclawbate.com', 'https://www.inclawbate.com',
    'http://localhost:3000', 'http://localhost:5500',
];

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(204).end();

    // GET — return pillars + drafts for a date
    if (req.method === 'GET') {
        const date = req.query.date;
        if (!date) return res.json({ pillars: PILLARS });

        const dayOfWeek = new Date(date + 'T12:00:00Z').getUTCDay();
        const pillar = PILLARS[dayOfWeek];

        // Fetch any auto-drafts for this date
        const dayStart = date + 'T00:00:00Z';
        const dayEnd = date + 'T23:59:59Z';
        const { data: drafts } = await supabase
            .from('agent_schedule')
            .select('*')
            .gte('scheduled_at', dayStart)
            .lte('scheduled_at', dayEnd)
            .eq('booked_by_wallet', 'system-autofill')
            .in('status', ['scheduled', 'needs_review', 'needs_image']);

        return res.json({ pillar, dayOfWeek, drafts: drafts || [] });
    }

    // POST — generate drafts
    if (req.method === 'POST') {
        const { action, date } = req.body || {};

        // Auth check — admin only
        const authHeader = req.headers.authorization;
        const cronSecret = process.env.CRON_SECRET;
        let isAdmin = false;

        // Allow cron auth
        if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
            isAdmin = true;
        }

        // Allow admin wallet via JWT (same auth as agent-schedule.js)
        if (!isAdmin && authHeader?.startsWith('Bearer ')) {
            try {
                const { authenticateRequest } = await import('./x-callback.js');
                const user = authenticateRequest(req);
                if (user && user.sub) {
                    const { data: profile } = await supabase
                        .from('human_profiles')
                        .select('wallet_address')
                        .eq('id', user.sub)
                        .single();
                    if (profile && ADMIN_WALLETS.includes(profile.wallet_address?.toLowerCase())) {
                        isAdmin = true;
                    }
                }
            } catch(e) {}
        }

        if (!isAdmin) return res.status(403).json({ error: 'Admin only' });

        if (action === 'generate') {
            return await generateDrafts(req, res, date);
        }

        if (action === 'approve') {
            const { slot_id } = req.body;
            const { error } = await supabase
                .from('agent_schedule')
                .update({ status: 'scheduled' })
                .eq('id', slot_id)
                .eq('booked_by_wallet', 'system-autofill');
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ ok: true });
        }

        if (action === 'update_draft') {
            const { slot_id, tweet_text, status } = req.body;
            const updates = {};
            if (tweet_text !== undefined) updates.tweet_text = tweet_text;
            if (status) updates.status = status;
            const { error } = await supabase
                .from('agent_schedule')
                .update(updates)
                .eq('id', slot_id)
                .eq('booked_by_wallet', 'system-autofill');
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ ok: true });
        }

        return res.status(400).json({ error: 'Unknown action' });
    }

    res.status(405).json({ error: 'Method not allowed' });
}

async function generateDrafts(req, res, targetDate) {
    // Default to tomorrow
    const date = targetDate || new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const dayOfWeek = new Date(date + 'T12:00:00Z').getUTCDay();
    const pillar = PILLARS[dayOfWeek];
    const angles = SLOT_ANGLES[pillar.name] || ['general'];

    // Check which slots are already booked
    const dayStart = date + 'T00:00:00Z';
    const nextDay = new Date(new Date(date + 'T00:00:00Z').getTime() + 86400000).toISOString();
    const { data: existing } = await supabase
        .from('agent_schedule')
        .select('scheduled_at, status')
        .gte('scheduled_at', dayStart)
        .lt('scheduled_at', nextDay)
        .in('status', ['scheduled', 'posted', 'needs_review', 'needs_image']);

    const bookedHours = new Set((existing || []).map(s => new Date(s.scheduled_at).getUTCHours()));

    // Find empty slots
    const emptyHours = VALID_HOURS.filter(h => !bookedHours.has(h));
    if (!emptyHours.length) {
        return res.json({ message: 'All slots filled', date, pillar: pillar.name });
    }

    // Fetch real platform data for context
    const [appsResult, statsResult] = await Promise.allSettled([
        supabase.from('user_apps').select('name, slug, category, upvote_count, description, creator_x_handle')
            .eq('is_public', true).order('created_at', { ascending: false }).limit(20),
        supabase.from('user_apps').select('*', { count: 'exact', head: true }).eq('is_public', true),
    ]);

    const recentApps = appsResult.status === 'fulfilled' ? (appsResult.value.data || []) : [];
    const totalApps = statsResult.status === 'fulfilled' ? (statsResult.value.count || 0) : 0;

    const appContext = recentApps.slice(0, 10).map(a =>
        `- ${a.name} (${a.category}, ${a.upvote_count || 0} upvotes)${a.creator_x_handle ? ' by @' + a.creator_x_handle : ''}`
    ).join('\n');

    // Generate tweets for empty slots
    const drafts = [];

    for (let i = 0; i < emptyHours.length; i++) {
        const hour = emptyHours[i];
        const angle = angles[i % angles.length];

        const slotTime = new Date(date + 'T00:00:00Z');
        if (hour < 6) slotTime.setDate(slotTime.getDate() + 1);
        slotTime.setUTCHours(hour, 0, 0, 0);

        // Generate tweet with Claude
        const prompt = `Generate a tweet for @inclawbator (the AI marketing agent for Inclawbate platform).

Today's content pillar: ${pillar.name} — ${pillar.desc}
Angle for this slot: ${angle}

Platform context:
- Inclawbate has ${totalApps}+ free apps
- Token: $CLAWS on Base chain
- Website: inclawbate.com
- Recent apps:\n${appContext}

Rules:
- Under 280 characters (STRICT)
- No hashtags
- No "excited to announce" or corporate speak
- No em dashes
- Be authentic, crypto-native, conversational
- Vary tone: sometimes degen, sometimes chill, sometimes hype
- Mention specific app names or stats when relevant
- Output ONLY the tweet text`;

        try {
            const resp = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-haiku-4-5-20251001',
                    max_tokens: 300,
                    messages: [{ role: 'user', content: prompt }]
                })
            });
            const data = await resp.json();
            const tweetText = data.content?.[0]?.text?.trim().replace(/^["']|["']$/g, '') || '';

            if (tweetText && tweetText.length <= 280) {
                const status = pillar.needsImage ? 'needs_image' : 'needs_review';
                const { data: inserted, error } = await supabase
                    .from('agent_schedule')
                    .insert({
                        scheduled_at: slotTime.toISOString(),
                        booked_by_wallet: 'system-autofill',
                        content_angle: `${pillar.emoji} ${pillar.name}: ${angle}`,
                        tone: 'default',
                        status: status,
                        tweet_text: tweetText,
                        tweet_options: { pillar: pillar.name, angle, needs_image: pillar.needsImage },
                    })
                    .select()
                    .single();

                if (!error && inserted) drafts.push(inserted);
            }
        } catch(e) {
            // Skip this slot on error
        }
    }

    return res.json({
        date,
        pillar: pillar.name,
        generated: drafts.length,
        empty_slots: emptyHours.length,
        drafts,
    });
}
