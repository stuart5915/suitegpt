// MemeClaw — Automated meme token launcher
// Polls Know Your Meme RSS for newly certified memes
// Launches token + site + staking via Inclawbator API
// By 0xGrantE × Inclawbate

import http from 'http';

// ── Config ──

const KYM_RSS = 'https://knowyourmeme.com/memes.rss';
const AGENT_CHAT_URL = process.env.AGENT_CHAT_URL || 'https://www.inclawbate.app/api/inclawbate/agent-chat';
const CREATOR_WALLET = process.env.CREATOR_WALLET; // Grant's wallet — receives 80% LP fees
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS) || 4 * 60 * 60 * 1000; // 4 hours
const AUTO_LAUNCH = process.env.AUTO_LAUNCH === 'true'; // false = queue only, true = auto-launch
const MAX_PER_POLL = parseInt(process.env.MAX_PER_POLL) || 3; // Max memes to process per poll

// Track what we've already processed
const processedGuids = new Set();
const launchQueue = [];
let totalLaunched = 0;
let lastPollTime = null;

// ── RSS Parser (simple, no deps) ──

function parseRSS(xml) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
        const block = match[1];
        const get = (tag) => {
            const m = block.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${tag}>`, 's'));
            return m ? m[1].trim() : '';
        };
        items.push({
            title: get('title'),
            link: get('link'),
            guid: get('guid'),
            pubDate: get('pubDate'),
            description: get('description')
        });
    }
    return items;
}

// Extract a clean image URL from the RSS description HTML
function extractImage(descHtml) {
    const match = descHtml.match(/src=["']([^"']+\.(jpg|jpeg|png|gif|webp))/i);
    return match ? match[1] : null;
}

// Generate a ticker symbol from meme name
function generateSymbol(name) {
    // Take first letters of words, or first 5 chars if single word
    const words = name.replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/);
    let symbol;
    if (words.length >= 2) {
        symbol = words.map(w => w[0]).join('').toUpperCase().slice(0, 5);
    } else {
        symbol = name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 5);
    }
    // Ensure at least 3 chars
    if (symbol.length < 3) symbol = symbol + 'X'.repeat(3 - symbol.length);
    return '$' + symbol;
}

// ── Inclawbator Integration ──

async function launchMemeToken(meme) {
    const symbol = generateSymbol(meme.title);
    const sessionId = `memeclaw-${meme.guid}-${Date.now().toString(36)}`;

    console.log(`[MemeClaw] Launching: ${meme.title} (${symbol})`);

    // Step 1: Launch the token
    const launchMsg = `Launch a token called "${meme.title}" with symbol ${symbol.replace('$', '')} to wallet ${CREATOR_WALLET}. Description: "Memecoin for the certified meme: ${meme.title}. Launched automatically by MemeClaw × Inclawbate when certified on Know Your Meme."`;

    const launchResp = await callAgent(launchMsg, sessionId);
    console.log(`[MemeClaw] Token launch response:`, launchResp?.reply?.slice(0, 200));

    // Step 2: Build a landing page
    const imageUrl = extractImage(meme.description || '');
    const buildMsg = `Build me an app called "${meme.title.toLowerCase().replace(/\s+/g, '-')}-token". It should be a landing page for the ${meme.title} memecoin. Include: the meme name as the hero title, a description saying this is the official memecoin for the "${meme.title}" meme (certified on Know Your Meme), ${imageUrl ? 'display this image: ' + imageUrl + ',' : ''} a link to the token on Base chain, and a section explaining that LP fees fund the Inclawbate ecosystem. Dark theme, fun, memey but not scammy.`;

    const buildResp = await callAgent(buildMsg, sessionId);
    console.log(`[MemeClaw] Site build response:`, buildResp?.reply?.slice(0, 200));

    totalLaunched++;

    return {
        meme: meme.title,
        symbol,
        tokenResponse: launchResp?.reply || 'no response',
        siteResponse: buildResp?.reply || 'no response',
        timestamp: new Date().toISOString()
    };
}

async function callAgent(message, sessionId) {
    try {
        const resp = await fetch(AGENT_CHAT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, session_id: sessionId, wallet: CREATOR_WALLET })
        });
        return await resp.json();
    } catch (err) {
        console.error('[MemeClaw] Agent call failed:', err.message);
        return { reply: 'Error: ' + err.message };
    }
}

// ── Polling ──

async function pollKYM() {
    console.log(`[MemeClaw] Polling Know Your Meme...`);
    lastPollTime = new Date().toISOString();

    try {
        const resp = await fetch(KYM_RSS);
        if (!resp.ok) {
            console.error(`[MemeClaw] RSS fetch failed: ${resp.status}`);
            return;
        }
        const xml = await resp.text();
        const items = parseRSS(xml);

        console.log(`[MemeClaw] Found ${items.length} memes in RSS`);

        let newCount = 0;
        for (const item of items) {
            if (processedGuids.has(item.guid)) continue;
            processedGuids.add(item.guid);
            newCount++;

            if (AUTO_LAUNCH && CREATOR_WALLET && newCount <= MAX_PER_POLL) {
                try {
                    const result = await launchMemeToken(item);
                    launchQueue.push(result);
                } catch (err) {
                    console.error(`[MemeClaw] Launch failed for "${item.title}":`, err.message);
                    launchQueue.push({ meme: item.title, error: err.message, timestamp: new Date().toISOString() });
                }
            } else {
                // Queue mode — just track it
                launchQueue.push({
                    meme: item.title,
                    link: item.link,
                    pubDate: item.pubDate,
                    status: AUTO_LAUNCH ? 'skipped (max per poll)' : 'queued (auto-launch off)',
                    timestamp: new Date().toISOString()
                });
            }
        }

        console.log(`[MemeClaw] ${newCount} new memes found, ${processedGuids.size} total tracked`);
    } catch (err) {
        console.error('[MemeClaw] Poll error:', err.message);
    }
}

// ── Health Check Server ──

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    if (req.url === '/health') {
        res.writeHead(200);
        res.end(JSON.stringify({
            status: 'ok',
            service: 'memeclaw',
            autoLaunch: AUTO_LAUNCH,
            totalLaunched,
            tracked: processedGuids.size,
            queueLength: launchQueue.length,
            lastPoll: lastPollTime,
            uptime: Math.floor(process.uptime())
        }));
    } else if (req.url === '/queue') {
        res.writeHead(200);
        res.end(JSON.stringify({ queue: launchQueue.slice(-20) }));
    } else if (req.url === '/launch-next' && req.method === 'POST') {
        // Manual trigger: launch the next queued meme
        const next = launchQueue.find(q => q.status === 'queued (auto-launch off)');
        if (!next) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'No queued memes' }));
        } else if (!CREATOR_WALLET) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'CREATOR_WALLET not set' }));
        } else {
            launchMemeToken({ title: next.meme, link: next.link, guid: next.meme, description: '' })
                .then(result => { res.writeHead(200); res.end(JSON.stringify(result)); })
                .catch(err => { res.writeHead(500); res.end(JSON.stringify({ error: err.message })); });
        }
    } else {
        res.writeHead(200);
        res.end(JSON.stringify({ service: 'MemeClaw — Automated Meme Token Launcher', docs: '/health, /queue, POST /launch-next' }));
    }
}).listen(PORT, () => console.log(`[MemeClaw] Health check on :${PORT}`));

// ── Start ──

console.log(`[MemeClaw] Starting — auto-launch: ${AUTO_LAUNCH}, poll every ${POLL_INTERVAL_MS / 1000 / 60} min`);
console.log(`[MemeClaw] Creator wallet: ${CREATOR_WALLET || 'NOT SET (queue-only mode)'}`);

// First poll immediately
pollKYM();

// Then poll on interval
setInterval(pollKYM, POLL_INTERVAL_MS);
