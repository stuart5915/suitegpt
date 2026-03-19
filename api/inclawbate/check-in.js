// Inclawbate — Daily Team Check-in
// Reads each person's responsibilities from team_state
// Generates personalized questions for TG copy-paste
// GET → returns check-in message
// POST with send=true → posts directly to council TG group

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BOT_TOKEN = process.env.INCLAWBATE_TELEGRAM_BOT_TOKEN;
const COUNCIL_CHAT_ID = process.env.INCLAWBATE_COUNCIL_CHAT_ID;

function getDateStr() {
    return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
}

// Turn a responsibility into a short question
function toQuestion(content) {
    // Strip trailing " - @handle" suffixes and punctuation
    let clean = content.replace(/\s*-\s*@\w+$/i, '').replace(/[.!?]+$/, '').trim();
    const c = clean.toLowerCase();

    // Truncate overly long descriptions to first clause
    if (clean.length > 60) {
        const dash = clean.indexOf(' — ');
        const comma = clean.indexOf(', ');
        const cut = dash > 10 ? dash : (comma > 10 ? comma : 60);
        clean = clean.slice(0, cut).trim();
    }

    // Pattern: "Fix X" → "X fix — progress?"
    if (c.startsWith('fix ')) return clean.replace(/^fix /i, '') + ' fix — progress?';
    // Pattern: "Launch X" / "Publish X" → "X — status?"
    if (c.startsWith('launch ') || c.startsWith('publish ')) return clean + ' — status?';
    // Pattern: "Managing X" → "X — updates?"
    if (c.startsWith('managing ')) return clean.replace(/^managing /i, '') + ' — updates?';
    // Pattern: "Addressing X" → "X — progress?"
    if (c.startsWith('addressing ')) return clean.replace(/^addressing /i, '') + ' — progress?';
    // Pattern contains "awaiting" → "any movement?"
    if (c.includes('awaiting')) return clean + ' — any movement?';
    // Default: just ask for update
    return clean + '?';
}

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Fetch responsibilities and incubations
        const [respRes, incRes] = await Promise.all([
            supabase.from('team_state').select('content, author').eq('category', 'responsibility').order('created_at', { ascending: true }),
            supabase.from('team_state').select('content, author').eq('category', 'incubation').order('created_at', { ascending: true })
        ]);

        const responsibilities = respRes.data || [];
        const incubations = incRes.data || [];

        // Group responsibilities by person
        const byPerson = {};
        for (const r of responsibilities) {
            const person = r.author || 'unassigned';
            if (!byPerson[person]) byPerson[person] = { tasks: [], incubations: [] };
            byPerson[person].tasks.push(r.content);
        }

        // Add incubations to their owners
        for (const inc of incubations) {
            const person = inc.author || '';
            if (person && person !== 'admin') {
                if (!byPerson[person]) byPerson[person] = { tasks: [], incubations: [] };
                byPerson[person].incubations.push(inc.content);
            }
        }

        // Skip Stuart's own entries
        const skipAuthors = ['@StuartDeFi', 'admin', 'unassigned'];

        const date = getDateStr();
        let msg = `📋 Daily Check-in — ${date}\n\n`;

        const entries = [];

        for (const [person, data] of Object.entries(byPerson)) {
            if (skipAuthors.includes(person)) continue;

            // Pick the top 1-2 responsibilities as questions
            const questions = data.tasks.slice(0, 2).map(t => toQuestion(t));

            // If they have incubations but no responsibilities, ask about the incubation
            if (questions.length === 0 && data.incubations.length > 0) {
                questions.push(data.incubations[0] + ' — how is it going?');
            }

            if (questions.length === 0) continue;

            const handle = person.startsWith('@') ? person : `@${person}`;
            entries.push(`${handle} — ${questions.join(' / ')}`);
        }

        // Add people who might not have responsibilities yet
        const knownHandles = ['@ItsEvilDuck', '@Grantecrypto', '@SwapBae', '@FreefoRaLLey',
            '@LIQUIDITYD13', '@S4HMinistries', '@unknownking7', '@justcallmemantoworld',
            '@FightFarmNFT', '@HevalYucedag'];

        const coveredHandles = new Set(Object.keys(byPerson).map(p => p.toLowerCase()));
        for (const handle of knownHandles) {
            if (!coveredHandles.has(handle.toLowerCase())) {
                entries.push(`${handle} — what are you working on?`);
            }
        }

        msg += entries.join('\n');
        msg += '\n\nReply with what you got done + what you\'re working on today 🦞';

        // Optionally post to TG
        const shouldSend = req.method === 'POST' && req.body?.send === true;
        if (shouldSend && BOT_TOKEN && COUNCIL_CHAT_ID) {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: COUNCIL_CHAT_ID,
                    text: msg,
                    disable_web_page_preview: true
                })
            });
        }

        return res.status(200).json({ ok: true, message: msg, send: shouldSend });

    } catch (err) {
        console.error('Check-in error:', err);
        return res.status(500).json({ error: err.message });
    }
}
