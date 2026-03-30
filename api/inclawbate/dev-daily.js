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
            max_tokens: 1200,
            messages: [
                {
                    role: 'system',
                    content: `You summarize git commits into 4-7 narrative bullet points for a dev update. Each bullet is 2-4 sentences — a mini story about what was built, how it works, and why it matters. Write for a general audience who is interested in tech but not necessarily developers.

Output ONLY a JSON array of objects: [{"emoji":"🏦","text":"Built an AutoVault for Basis — a fully autonomous LP manager on Aerodrome. Deposit WETH, it manages your concentrated liquidity position automatically. Deployed v2 with slippage protection, AERO rewards display, and ETH price charts with range overlays."},...]

Rules:
- Each bullet should tell a STORY — what was built, what it does, why someone should care
- Group related commits into one rich narrative bullet (e.g. 15 vault-related commits become one vault bullet)
- 2-4 sentences per bullet, not 1. Give context and detail.
- NO jargon without explanation. If you mention "staking", explain what it means in plain words
- NO feelings, NO motivation ("feeling good", "momentum", "let's go")
- Start each text with a verb: Built, Launched, Shipped, Fixed, Added, Upgraded
- Pick a relevant emoji for each bullet
- Merge aggressively — 37 commits should become 4-7 rich bullets, not 7 one-liners
- Good: "Built an AutoVault for Basis — a fully autonomous LP manager on Aerodrome. Deposit WETH, it manages your concentrated liquidity position automatically. Deployed v2 with slippage protection, AERO rewards display, ETH price charts with range overlays, and a period selector."
- Good: "Launched TrueForm (Drop #3) — an AI-powered posture and movement analysis tool using MediaPipe Pose. Real-time body tracking right in your browser. Another app born from the Inclawbate ecosystem."
- Bad: "Fixed several issues with the launch process"
- Bad: "Updated templates to make it easier for users to create content"`
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
                    max_tokens: 1500,
                    messages: [
                        {
                            role: 'system',
                            content: `You write X/Twitter dev update posts for Inclawbate — a Web3 AI platform on Base where anyone can build apps, launch tokens, stake, earn, and use AI agents. Write for a general audience who follows crypto/tech Twitter.

The post should read like a builder flexing what they shipped today — confident, detailed, impressive. Each bullet is a mini story, not a one-liner.

Rules:
- Start with: 🦞 Dev Daily — [date] and "[N] commits shipped today." on the next line
- 4-6 bullet points with emoji
- Each bullet: 2-4 sentences. Tell the story — what was built, how it works, why it's cool
- Group related work into one rich bullet (don't list 5 separate small fixes)
- NO feelings, NO motivation, NO "momentum", NO "let's go", NO "feeling good about"
- NO jargon without explanation. If you say "LP" explain it's liquidity providing
- End with: [commit count] commits · inclawbate.app · t.me/inclawbator
- No hashtags, no @mentions
- Tone: a confident builder showing receipts. Factual, detailed, slightly impressive

Example post:
🦞 Dev Daily — Mar 30, 2026
37 commits shipped today.

🏦 Built an AutoVault for Basis — a fully autonomous LP manager on Aerodrome. Deposit WETH, it manages your concentrated liquidity position automatically. Deployed v2 with slippage protection, AERO rewards display, ETH price charts with range overlays, and a period selector (7d/30d/90d/1y/All). Real DeFi, live on Base.

🤖 The Inclawbator got smarter — agent types are now clickable suggestion pills in chat, capability toggles update instantly (no reload), and the agent explainer page gives you a full breakdown of what each agent type does before you set one up.

🖼️ Launched TrueForm (Drop #3) — an AI-powered posture and movement analysis tool using MediaPipe Pose. Real-time body tracking right in your browser. Another app born from the Inclawbate ecosystem.

📊 Daily CLAWS stats now auto-post to @inclawbate every morning at 7am EST — with the stats image attached. No more manual copy-pasting. The engine runs itself.

37 commits · inclawbate.app · t.me/inclawbator`
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
