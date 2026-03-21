// Inclawbate — GitHub Push → Telegram Dev Updates Topic
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
];

function shouldSkip(message) {
    return SKIP_PATTERNS.some(p => p.test(message));
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

    // Filter out trivial commits
    const commits = payload.commits.filter(c => !shouldSkip(c.message.split('\n')[0]));
    if (commits.length === 0) return res.status(200).json({ ok: true, skipped: 'all trivial' });

    const branch = (payload.ref || '').replace('refs/heads/', '');
    const pusher = payload.pusher?.name || 'unknown';
    const repoName = payload.repository?.name || 'repo';

    // Build message
    let msg = `🔨 <b>New Push</b> → ${branch}\n`;
    msg += `by ${pusher}\n\n`;

    for (const commit of commits.slice(0, 5)) {
        const short = commit.id.slice(0, 7);
        const firstLine = commit.message.split('\n')[0];
        // Strip Co-Authored-By lines
        const clean = firstLine.replace(/Co-Authored-By:.*/i, '').trim();
        const filesChanged = (commit.added?.length || 0) + (commit.modified?.length || 0) + (commit.removed?.length || 0);
        msg += `<code>${short}</code> ${clean}`;
        if (filesChanged > 0) msg += ` <i>(${filesChanged} files)</i>`;
        msg += `\n`;
    }

    if (commits.length > 5) {
        msg += `<i>+${commits.length - 5} more commits</i>\n`;
    }

    msg += `\n🔗 <a href="${payload.compare}">View changes</a>`;

    try {
        await sendToTopic(msg);
        return res.status(200).json({ ok: true, posted: commits.length });
    } catch (err) {
        console.error('GitHub webhook TG error:', err);
        return res.status(500).json({ error: err.message });
    }
}
