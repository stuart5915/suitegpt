// Inclawbate — Dev Daily Generator
// POST /api/inclawbate/dev-daily
// Fetches today's commits, groups them with AI, returns formatted post

const GROQ_KEYS = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
const GITHUB_REPO = 'stuart5915/suitegpt';

function getGroqKey() {
    return GROQ_KEYS[Math.floor(Math.random() * GROQ_KEYS.length)];
}

function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function fetchTodaysCommits() {
    // Get today's date range in ISO format
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const since = startOfDay.toISOString();

    let allCommits = [];
    let page = 1;

    while (page <= 5) { // max 5 pages = 500 commits
        const url = `https://api.github.com/repos/${GITHUB_REPO}/commits?sha=master&since=${since}&per_page=100&page=${page}`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'inclawbate-bot' }
        });
        if (!res.ok) break;
        const commits = await res.json();
        if (!Array.isArray(commits) || commits.length === 0) break;
        allCommits = allCommits.concat(commits);
        if (commits.length < 100) break;
        page++;
    }

    return allCommits.map(c => ({
        sha: c.sha?.slice(0, 7),
        message: (c.commit?.message || '').split('\n')[0].replace(/Co-Authored-By:.*/i, '').trim(),
        author: c.commit?.author?.name || 'unknown'
    })).filter(c => {
        // Filter out trivial commits
        const msg = c.message.toLowerCase();
        return !msg.startsWith('merge ') && msg !== 'wip' && !msg.startsWith('typo');
    });
}

async function groupCommitsWithAI(commits) {
    if (!GROQ_KEYS.length) return null;

    const commitList = commits.map(c => c.message).join('\n');

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getGroqKey()}`
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            temperature: 0.4,
            max_tokens: 800,
            messages: [
                {
                    role: 'system',
                    content: `You summarize git commits into 4-7 plain-English bullet points for a Telegram dev update. Each bullet is 1-2 sentences max — what was built/fixed and why it matters to users. Write for a general audience, not developers.

Output ONLY a JSON array of objects: [{"emoji":"📈","text":"Built a more reliable token deployment system"},...]

Rules:
- NO jargon (no "refactored", "migrated", "endpoint", "component", "CSS", "API")
- NO commit-style language — translate into what the USER experiences
- Each bullet should feel like telling a friend what you worked on today
- Start each text with a verb: Built, Updated, Fixed, Added, Improved, Launched
- If many small commits are related, merge them into one bullet
- Pick a relevant emoji for each bullet
- Good: "Fixed several issues with the launch process"
- Good: "Updated templates to make it easier for users to create their own content — it includes new layouts and design options"
- Bad: "Refactored nav component CSS media queries for mobile breakpoints"
- Bad: "Fixed edge case in token vault contract interaction"`
                },
                {
                    role: 'user',
                    content: `Summarize these ${commits.length} commits into 4-7 bullets:\n\n${commitList}`
                }
            ]
        })
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';

    try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch (e) {}
    return null;
}

// Also fetch today's API stats from Supabase
async function fetchApiStats() {
    try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
            process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        const today = new Date().toISOString().slice(0, 10);
        const { data } = await supabase
            .from('api_daily_stats')
            .select('*')
            .eq('stat_date', today)
            .single();
        return data || null;
    } catch (e) { return null; }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    try {
        const [commits, apiStats] = await Promise.all([
            fetchTodaysCommits(),
            fetchApiStats()
        ]);

        if (commits.length === 0) {
            return res.status(200).json({ error: 'No commits today yet.' });
        }

        const groups = await groupCommitsWithAI(commits);
        const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });

        // Build Telegram post (HTML)
        let post = `🦞 <b>Dev Daily — ${esc(dateStr)}</b>\n`;
        post += `${commits.length} commits shipped today.\n\n`;

        if (groups && groups.length > 0) {
            for (const g of groups) {
                post += `${g.emoji} ${esc(g.text)}\n`;
            }
        } else {
            // Fallback: just list commits
            for (const c of commits.slice(0, 15)) {
                post += `• ${esc(c.message)}\n`;
            }
            if (commits.length > 15) post += `<i>+${commits.length - 15} more</i>\n`;
        }

        // Generate X post — narrative style, shows value not just changelog
        let tweet = '';
        try {
            const groupSummary = groups ? groups.map(g => `${g.emoji} ${g.text}`).join('\n') : commits.slice(0, 15).map(c => c.message).join('\n');

            const xRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getGroqKey()}`
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    temperature: 0.7,
                    max_tokens: 600,
                    messages: [
                        {
                            role: 'system',
                            content: `You write X/Twitter posts for a solo dev documenting daily work on Inclawbate (AI platform for building apps, launching tokens, earning) and SpawnMemes (meme tokens that become living AI agents). Write for a general audience — anyone should understand what was built and why it matters.

Rules:
- NO feelings, NO motivation, NO "momentum", NO "let's go", NO "feeling good about"
- NO jargon without explanation. If you say "staking pool" explain what it does in plain English
- Start with 🦞 Dev Daily — [date]
- 3-6 bullet points with emoji, each 2-3 sentences
- Each bullet: what was built, what it means for users, why it matters. Write like you're explaining to a friend who's curious but not technical
- End with commit count, inclawbate.app, and t.me/inclawbator
- No hashtags, no @mentions
- Tone: a builder sharing what they made today in plain language. Conversational but factual
- Example bullet: "📱 Rebuilt the mobile menu — it was ugly and hard to use. Now it's a clean dark overlay with everything organized in a grid. Way easier to navigate on your phone."
- Example bullet: "🤔 SpawnMemes now creates a chat persona for every meme token. You can literally talk to the Chuck Norris meme and ask it about its origin story."
- NOT: "Refactored nav component CSS media queries for mobile breakpoints"
- NOT: "Feeling great about today's progress"`
                        },
                        {
                            role: 'user',
                            content: `Write an X post for today's dev work. ${commits.length} commits shipped on ${dateStr}.\n\nGrouped work:\n${groupSummary}`
                        }
                    ]
                })
            });

            if (xRes.ok) {
                const xData = await xRes.json();
                tweet = (xData.choices?.[0]?.message?.content || '').trim();
                tweet = tweet.replace(/^["']|["']$/g, '').trim();
            }
        } catch (e) {
            console.error('X post generation error:', e);
        }

        // Fallback if AI fails
        if (!tweet) {
            tweet = `🦞 Dev Daily — ${dateStr}\n${commits.length} commits shipped today.\n\n`;
            if (groups && groups.length > 0) {
                for (const g of groups) {
                    tweet += `${g.emoji} ${g.text}\n`;
                }
            }
            tweet += `\ninclawbate.app · t.me/inclawbator`;
        }

        return res.status(200).json({ post, tweet, commitCount: commits.length });
    } catch (e) {
        console.error('Dev daily error:', e);
        return res.status(500).json({ error: e.message });
    }
}
