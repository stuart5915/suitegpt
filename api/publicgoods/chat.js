// publicgoods.tech — Chat submission agent
// Accepts natural language, figures out what to add to the database
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_KEYS = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
let keyIdx = 0;
function nextKey() { const k = GROQ_KEYS[keyIdx % GROQ_KEYS.length]; keyIdx++; return k; }

const SYSTEM_PROMPT = `You are the publicgoods.tech assistant. Your job is to help people add AI agents, builders, public goods, and news to the directory.

When someone wants to add something, extract the information and return a JSON action. When they're just chatting, respond naturally.

ALWAYS respond with valid JSON in this format:
{
  "reply": "Your friendly response to the user",
  "action": null or { "type": "agent|builder|good|news", "data": { ... } }
}

For AGENTS, extract: name, x_handle, description, website, chain (base/ethereum/solana/multi), category (defi/social/gaming/infra/devtools/dao/general)
For BUILDERS, extract: name, x_handle, bio, website, github, skills (array)
For PUBLIC GOODS, extract: name, x_handle, description, website, github, category (tool/infra/education/community/protocol/dao)
For NEWS, extract: title, url, summary, source, source_handle, category (news/launch/funding/tutorial/opinion)

If information is missing, ask for it in your reply. Don't create the action until you have at least name and description/bio/title.

If someone just says hi or asks what this is, explain: "publicgoods.tech tracks AI agents, public goods, and builders in the ecosystem. You can add your project, submit yourself as a builder, or share news. What would you like to do?"

Keep replies SHORT — 1-2 sentences max.`;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...(history || []).slice(-10),
        { role: 'user', content: message }
    ];

    try {
        const key = nextKey();
        if (!key) return res.json({ reply: "I'm having trouble connecting. Try again in a moment.", action: null });

        const r = await fetch(GROQ_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, max_tokens: 500, temperature: 0.3 })
        });
        const data = await r.json();
        const content = data.choices?.[0]?.message?.content || '';

        // Parse JSON response
        let parsed;
        try {
            // Try to extract JSON from the response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { reply: content, action: null };
        } catch (e) {
            parsed = { reply: content, action: null };
        }

        // Execute action if present
        if (parsed.action && parsed.action.type && parsed.action.data) {
            const { type, data: d } = parsed.action;
            const slug = (d.name || d.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);

            try {
                if (type === 'agent') {
                    await supabase.from('pgt_agents').insert({
                        name: d.name, slug, description: d.description, website: d.website,
                        x_handle: (d.x_handle || '').replace('@', ''), chain: d.chain || 'multi',
                        category: d.category || 'general', status: 'live', approved: false, submitted_by: 'chat'
                    });
                    parsed.reply = (parsed.reply || '') + '\n\nSubmitted for review! It\'ll appear in the directory once approved.';
                    parsed.submitted = 'agent';
                } else if (type === 'builder') {
                    await supabase.from('pgt_builders').insert({
                        name: d.name, slug, bio: d.bio, website: d.website, github: d.github,
                        x_handle: (d.x_handle || '').replace('@', ''),
                        skills: d.skills || [], projects: d.projects || [],
                        approved: false
                    });
                    parsed.reply = (parsed.reply || '') + '\n\nProfile submitted for review! You\'ll be in the builders directory once approved.';
                    parsed.submitted = 'builder';
                } else if (type === 'good') {
                    await supabase.from('pgt_public_goods').insert({
                        name: d.name, slug, description: d.description, website: d.website,
                        github: d.github, x_handle: (d.x_handle || '').replace('@', ''),
                        category: d.category || 'tool', approved: false, submitted_by: 'chat'
                    });
                    parsed.reply = (parsed.reply || '') + '\n\nPublic good submitted for review! It\'ll appear in the directory once approved.';
                    parsed.submitted = 'good';
                } else if (type === 'news') {
                    await supabase.from('pgt_news').insert({
                        title: d.title, url: d.url, summary: d.summary,
                        source: d.source, source_handle: (d.source_handle || '').replace('@', ''),
                        category: d.category || 'news', submitted_by: 'chat'
                    });
                    parsed.reply = (parsed.reply || '') + '\n\nNews link added!';
                    parsed.submitted = 'news';
                }
            } catch (dbErr) {
                console.error('[PGT Chat] DB error:', dbErr.message);
                parsed.reply = (parsed.reply || '') + '\n\n(There was an issue saving — try again.)';
            }
        }

        return res.json({ reply: parsed.reply || 'How can I help?', action: parsed.action, submitted: parsed.submitted });

    } catch (e) {
        console.error('[PGT Chat] Error:', e.message);
        return res.json({ reply: "Something went wrong. Try again in a moment.", action: null });
    }
}
