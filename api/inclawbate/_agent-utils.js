// Shared agent tweet generation utilities
// Prefixed with _ so Vercel does not expose as API route

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export const TONE_DESCRIPTIONS = {
    hype: 'High energy, bullish, uses exclamation marks. Excited but not cringey.',
    chill: 'Laid back, casual, lowercase vibes. Calm and collected.',
    degen: 'Crypto native, uses slang (gm, ser, lfg, ngmi), meme-aware.',
    professional: 'Informative, clean, data-driven. No slang.',
    meme: 'Funny, ironic, shitpost energy. Absurdist humor.'
};

export const DEFAULT_TOPICS = ['community', 'utility', 'staking', 'milestones', 'memes', 'market vibes'];

export function parsePersona(persona) {
    const result = { tone: '', topics: [], catchphrase: '' };
    if (!persona) return result;
    const toneMatch = persona.match(/Tone:\s*(\w+)/i);
    if (toneMatch) result.tone = toneMatch[1].toLowerCase();
    const topicMatch = persona.match(/Topics:\s*([^|]+)/i);
    if (topicMatch) result.topics = topicMatch[1].split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    const catchMatch = persona.match(/Catchphrase:\s*(.+)/i);
    if (catchMatch) result.catchphrase = catchMatch[1].trim();
    return result;
}

export async function generateTweet(project) {
    // Use structured fields if available, fall back to parsing persona string
    let tone, topics, catchphrase;

    if (project.agent_tone) {
        tone = project.agent_tone;
        topics = project.agent_topics || DEFAULT_TOPICS;
        catchphrase = project.agent_catchphrase || '';
    } else {
        const persona = parsePersona(project.agent_persona);
        tone = persona.tone;
        topics = persona.topics.length ? persona.topics : DEFAULT_TOPICS;
        catchphrase = persona.catchphrase;
    }

    const pillar = topics[Math.floor(Math.random() * topics.length)];
    const toneDesc = TONE_DESCRIPTIONS[tone] || 'Natural, authentic, conversational.';

    const hasOwnX = project.x_access_token && project.x_refresh_token;
    const accountNote = hasOwnX && project.x_handle
        ? `You tweet as @${project.x_handle}.`
        : `You tweet from @inclawbator on behalf of this project.`;

    const symbol = project.token_symbol;
    const projectName = project.name || 'this project';
    const tokenRef = symbol ? `$${symbol}` : projectName;

    const systemPrompt = `You are an AI agent for ${tokenRef}${symbol ? ' (' + projectName + ')' : ''}. ${accountNote}

Tone: ${toneDesc}
${catchphrase ? 'Signature style: ' + catchphrase : ''}
${project.description ? 'Project: ' + project.description : ''}
${project.website_url ? 'Website: ' + project.website_url : ''}

Rules:
- Under 280 characters (STRICT)
${symbol ? '- Mention $' + symbol + ' naturally' : '- Mention the project name naturally'}
- No hashtags
- No "excited to announce" or any corporate speak
- No em dashes
- No quotation marks around the tweet
- NEVER say "buy", "invest", "financial advice", "guaranteed returns", or "not financial advice"
- No price predictions or promises of gains
- Output ONLY the tweet text, nothing else
- Be creative, varied, and authentic`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 300,
            system: systemPrompt,
            messages: [{ role: 'user', content: `Today's content angle: ${pillar}\n\nWrite a tweet:` }]
        })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Claude API error');

    let text = (data.content?.[0]?.text || '').trim();
    return { text, content_angle: pillar };
}
