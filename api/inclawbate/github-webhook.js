// Inclawbate — GitHub Push → Telegram Dev Updates Topic (community)
// POST /api/inclawbate/github-webhook
// Receives GitHub webhook push events, posts to TG community topic

const BOT_TOKEN = process.env.INCLAWBATE_TELEGRAM_BOT_TOKEN;
const COMMUNITY_CHAT_ID = '-1003756242979';
const DEV_UPDATES_THREAD_ID = 10548;

// Skip trivial commits
const SKIP_PATTERNS = [
    /^merge /i,
    /^wip$/i,
    /^typo/i,
    /^fix whitespace/i,
    /^fix spacing/i,
    /^test:/i,
];

// Redact commits that might contain sensitive info
const SENSITIVE_WORDS = /secret|api.key|private.key|password|token|credential|\.env|wallet.key|mnemonic|seed.phrase/i;

function shouldSkip(message) {
    return SKIP_PATTERNS.some(p => p.test(message));
}

// Clean up commit messages for public display
function sanitizeMessage(msg) {
    // Strip Co-Authored-By
    let clean = msg.split('\n')[0].replace(/Co-Authored-By:.*/i, '').trim();
    // If message contains sensitive words, redact it
    if (SENSITIVE_WORDS.test(clean)) {
        return 'Internal update';
    }
    // Soften scary-sounding messages
    clean = clean.replace(/critical\s+(security\s+)?vulnerability/i, 'security improvement');
    clean = clean.replace(/delete\s+database/i, 'database maintenance');
    clean = clean.replace(/remove\s+user\s+data/i, 'data cleanup');
    return clean;
}

async function sendToTopic(text) {
    if (!BOT_TOKEN) return;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: COMMUNITY_CHAT_ID,
            message_thread_id: DEV_UPDATES_THREAD_ID,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: true
        })
    });
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const event = req.headers['x-github-event'];
    if (event !== 'push') return res.status(200).json({ ok: true, skipped: 'not a push event' });

    const payload = req.body;
    if (!payload || !payload.commits) return res.status(200).json({ ok: true, skipped: 'no commits' });

    const branch = (payload.ref || '').replace('refs/heads/', '');

    // Filter out trivial commits and only show master branch
    if (branch !== 'master' && branch !== 'main') {
        return res.status(200).json({ ok: true, skipped: 'non-default branch' });
    }
    const commits = payload.commits.filter(c => !shouldSkip(c.message.split('\n')[0]));
    if (commits.length === 0) return res.status(200).json({ ok: true, skipped: 'all trivial' });
    const pusher = payload.pusher?.name || 'unknown';
    const repoName = payload.repository?.name || 'repo';

    // Build message — one line per commit, compact
    let msg = '';
    for (const commit of commits.slice(0, 5)) {
        const short = commit.id.slice(0, 7);
        const clean = sanitizeMessage(commit.message);
        msg += `🔨 <code>${short}</code> ${clean}\n`;
    }
    if (commits.length > 5) {
        msg += `<i>+${commits.length - 5} more</i>\n`;
    }
    msg += `🔗 <a href="${payload.compare}">View changes</a>`;

    try {
        await sendToTopic(msg);
        return res.status(200).json({ ok: true, posted: commits.length });
    } catch (err) {
        console.error('GitHub webhook TG error:', err);
        return res.status(500).json({ error: err.message });
    }
}
