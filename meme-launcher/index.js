// MemeClaw — Automated meme token launcher
// Polls Know Your Meme RSS for newly certified memes
// Launches token via agent-chat + publishes template site with voting
// By 0xGrantE × Inclawbate

import http from 'http';
import { createClient } from '@supabase/supabase-js';

// ── Supabase ──

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Config ──

const KYM_RSS = 'https://knowyourmeme.com/memes.rss';
const AGENT_CHAT_URL = process.env.AGENT_CHAT_URL || 'https://www.inclawbate.app/api/inclawbate/agent-chat';
const PUBLISH_API_URL = process.env.PUBLISH_API_URL || 'https://www.inclawbate.app/api/publish-site';
const TEMPLATE_URL = process.env.TEMPLATE_URL || 'https://raw.githubusercontent.com/stuart5915/suitegpt/master/inclawbate/memeclaw-template.html';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const CREATOR_WALLET = process.env.CREATOR_WALLET; // Grant's wallet — receives 80% LP fees
const INCLAWBATE_TREASURY = '0x91B5C0D07859CFeAfEB67d9694121CD741F049bd';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS) || 4 * 60 * 60 * 1000; // 4 hours
let AUTO_LAUNCH = process.env.AUTO_LAUNCH === 'true'; // mutable — toggled via /toggle-auto endpoint
const MAX_PER_POLL = parseInt(process.env.MAX_PER_POLL) || 3; // Max memes to process per poll

const ACCENT_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6'];

// In-memory dedup set — loaded from DB on startup, prevents duplicate inserts within a poll cycle
const processedGuids = new Set();
// Keep launchQueue for backwards compat — populated from DB
let launchQueue = [];
let totalLaunched = 0;
let lastPollTime = null;

// ── DB Helpers ──

async function loadStateFromDB() {
    try {
        // Load all known guids so we don't re-process them
        const { data: allMemes, error } = await supabase
            .from('memeclaw_memes')
            .select('kym_guid, status');
        if (error) throw error;

        for (const m of (allMemes || [])) {
            if (m.kym_guid) processedGuids.add(m.kym_guid);
        }

        // Count launched
        const launched = (allMemes || []).filter(m => m.status === 'launched');
        totalLaunched = launched.length;

        // Load recent entries into launchQueue for /queue endpoint compat
        const { data: recent, error: recentErr } = await supabase
            .from('memeclaw_memes')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
        if (recentErr) throw recentErr;

        launchQueue = (recent || []).map(row => ({
            meme: row.meme_name,
            link: row.meme_link,
            symbol: row.symbol,
            status: row.status,
            tokenAddress: row.token_address,
            siteUrl: row.site_url,
            siteSlug: row.site_slug,
            error: row.error_message,
            timestamp: row.created_at,
            launchedAt: row.launched_at,
            id: row.id
        }));

        console.log(`[MemeClaw] DB state loaded — ${processedGuids.size} guids tracked, ${totalLaunched} launched`);
    } catch (err) {
        console.error('[MemeClaw] Failed to load state from DB:', err.message);
        console.warn('[MemeClaw] Continuing with empty state — will rebuild from polls');
    }
}

async function upsertMeme(meme, extraFields = {}) {
    const imageUrl = extractImage(meme.description || '');
    const desc = extractDescription(meme.description || '');
    const row = {
        meme_name: meme.title,
        meme_link: meme.link || null,
        kym_guid: meme.guid || null,
        description: desc,
        image_url: imageUrl,
        status: 'queued',
        ...extraFields
    };

    const { data, error } = await supabase
        .from('memeclaw_memes')
        .upsert(row, { onConflict: 'kym_guid' })
        .select()
        .single();

    if (error) {
        console.error('[MemeClaw] DB upsert error:', error.message);
        return null;
    }
    return data;
}

async function updateMemeStatus(kymGuid, fields) {
    const { error } = await supabase
        .from('memeclaw_memes')
        .update(fields)
        .eq('kym_guid', kymGuid);
    if (error) {
        console.error('[MemeClaw] DB update error:', error.message);
    }
}

async function updateMemeStatusById(id, fields) {
    const { error } = await supabase
        .from('memeclaw_memes')
        .update(fields)
        .eq('id', id);
    if (error) {
        console.error('[MemeClaw] DB update by id error:', error.message);
    }
}

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

// Extract clean description text from RSS HTML
function extractDescription(descHtml) {
    if (!descHtml) return 'A certified meme with a real token on Base.';
    // Strip HTML tags
    let text = descHtml.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();
    // Remove "Read More" suffix
    text = text.replace(/\s*Read More\s*$/, '').trim();
    // Cap at ~300 chars
    if (text.length > 300) text = text.slice(0, 297) + '...';
    return text || 'A certified meme with a real token on Base.';
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

// ── Template Cache ──

let templateCache = null;
let templateFetchedAt = 0;
const TEMPLATE_CACHE_MS = 10 * 60 * 1000; // Re-fetch template every 10 min

async function getTemplate() {
    if (templateCache && Date.now() - templateFetchedAt < TEMPLATE_CACHE_MS) {
        return templateCache;
    }
    try {
        const resp = await fetch(TEMPLATE_URL);
        if (!resp.ok) throw new Error(`Template fetch failed: ${resp.status}`);
        templateCache = await resp.text();
        templateFetchedAt = Date.now();
        console.log(`[MemeClaw] Template loaded (${templateCache.length} bytes)`);
        return templateCache;
    } catch (err) {
        console.error('[MemeClaw] Template fetch error:', err.message);
        if (templateCache) return templateCache; // Use stale cache
        throw err;
    }
}

// ── Generate Voting Ideas via Groq ──

async function generateVotingIdeas(memeName) {
    if (!GROQ_API_KEY) {
        console.warn('[MemeClaw] GROQ_API_KEY not set — using default ideas');
        return [
            { title: 'Community Game', desc: `A multiplayer game themed around ${memeName} where players compete for prizes.` },
            { title: 'Meme Dashboard', desc: `A real-time dashboard tracking ${memeName} memes, virality, and community stats.` },
            { title: 'Charity Drive', desc: `Donate a portion of trading fees to a cause the ${memeName} community votes on.` },
            { title: 'NFT Collection', desc: `Launch a generative art collection inspired by ${memeName} with holder rewards.` }
        ];
    }

    try {
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    {
                        role: 'system',
                        content: 'Generate 4 short app/feature ideas for a meme token community. Each idea should be 1 sentence. Mix of: fun/game, utility, philanthropic, creative. Output as JSON array of 4 objects with "title" (3-5 words) and "desc" (1 sentence). Output ONLY valid JSON, no markdown.'
                    },
                    {
                        role: 'user',
                        content: `The meme is: ${memeName}`
                    }
                ],
                temperature: 0.8,
                max_tokens: 400
            })
        });

        if (!resp.ok) throw new Error(`Groq API ${resp.status}`);

        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content || '';

        // Parse JSON from response (handle potential markdown wrapping)
        const jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        const ideas = JSON.parse(jsonStr);

        if (Array.isArray(ideas) && ideas.length >= 4) {
            return ideas.slice(0, 4);
        }
        throw new Error('Invalid ideas format');
    } catch (err) {
        console.error('[MemeClaw] Groq ideas error:', err.message, '— using defaults');
        return [
            { title: 'Community Game', desc: `A multiplayer game themed around ${memeName} where players compete for prizes.` },
            { title: 'Meme Dashboard', desc: `A real-time dashboard tracking ${memeName} memes, virality, and community stats.` },
            { title: 'Charity Drive', desc: `Donate a portion of trading fees to a cause the ${memeName} community votes on.` },
            { title: 'NFT Collection', desc: `Launch a generative art collection inspired by ${memeName} with holder rewards.` }
        ];
    }
}

// ── Build & Publish Template Site ──

async function publishTemplateSite(meme, symbol, tokenAddress, stakingAddress) {
    const template = await getTemplate();
    const imageUrl = extractImage(meme.description || '') || '';
    const slug = meme.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-token';
    const accent = ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)];

    // Generate voting ideas
    const ideas = await generateVotingIdeas(meme.title);

    // Escape HTML entities in user-facing strings
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // Extract lore/description
    const description = extractDescription(meme.description || '');
    const kymLink = meme.link || 'https://knowyourmeme.com';
    const pubDate = meme.pubDate ? new Date(meme.pubDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Recently';

    // Replace all template variables
    let html = template
        .replace(/\{\{MEME_NAME\}\}/g, esc(meme.title))
        .replace(/\{\{TOKEN_SYMBOL\}\}/g, esc(symbol))
        .replace(/\{\{MEME_IMAGE\}\}/g, esc(imageUrl))
        .replace(/\{\{TOKEN_ADDRESS\}\}/g, esc(tokenAddress || '0x0000000000000000000000000000000000000000'))
        .replace(/\{\{ACCENT_COLOR\}\}/g, accent)
        .replace(/\{\{SLUG\}\}/g, esc(slug))
        .replace(/\{\{MEME_DESCRIPTION\}\}/g, esc(description))
        .replace(/\{\{KYM_LINK\}\}/g, esc(kymLink))
        .replace(/\{\{PUB_DATE\}\}/g, esc(pubDate))
        .replace(/\{\{IDEA_1_TITLE\}\}/g, esc(ideas[0].title))
        .replace(/\{\{IDEA_1_DESC\}\}/g, esc(ideas[0].desc))
        .replace(/\{\{IDEA_2_TITLE\}\}/g, esc(ideas[1].title))
        .replace(/\{\{IDEA_2_DESC\}\}/g, esc(ideas[1].desc))
        .replace(/\{\{IDEA_3_TITLE\}\}/g, esc(ideas[2].title))
        .replace(/\{\{IDEA_3_DESC\}\}/g, esc(ideas[2].desc))
        .replace(/\{\{IDEA_4_TITLE\}\}/g, esc(ideas[3].title))
        .replace(/\{\{IDEA_4_DESC\}\}/g, esc(ideas[3].desc))
        .replace(/\{\{STAKING_ADDRESS\}\}/g, esc(stakingAddress || ''));

    // Publish via publish-site API
    const publishResp = await fetch(PUBLISH_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: `${meme.title} Token`,
            slug,
            code: html,
            email: 'memeclaw@inclawbate.app',
            description: `Community token for the certified meme: ${meme.title}. Vote on what it becomes.`,
            source: 'memeclaw',
            category: 'finance',
            creator_wallet: CREATOR_WALLET,
            creator_x_handle: 'inclawbate',
            tags: ['memeclaw', 'meme-token', 'voting'],
            is_listed: true,
            update: true
        })
    });

    const publishData = await publishResp.json();
    console.log(`[MemeClaw] Site published:`, publishData.url || publishData.error);
    return { slug, url: publishData.url, ideas };
}

// ── Inclawbator Integration ──

async function launchMemeToken(meme) {
    const symbol = generateSymbol(meme.title);
    const sessionId = `memeclaw-${meme.guid}-${Date.now().toString(36)}`;

    console.log(`[MemeClaw] Launching: ${meme.title} (${symbol})`);

    // Mark as launching in DB
    await updateMemeStatus(meme.guid, { status: 'launching', symbol });

    const imageUrl = extractImage(meme.description || '');
    const slug = meme.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-token';
    const siteUrl = `https://inclawbate.app/s/${slug}`;

    // Step 1: Build & publish template site FIRST (so we have the URL for token metadata)
    let siteResult = { slug: null, url: null, ideas: [] };
    try {
        siteResult = await publishTemplateSite(meme, symbol, null); // null address for now, updated after launch
    } catch (err) {
        console.error(`[MemeClaw] Site publish failed:`, err.message);
    }

    // Step 2: Launch the token via direct API (no AI parsing — structured JSON)
    const LAUNCH_API = (process.env.AGENT_CHAT_URL || 'https://www.inclawbate.app/api/inclawbate/agent-chat').replace('/agent-chat', '/launch-token');
    let tokenAddress = null;
    let stakingAddress = null;
    try {
        const launchResp = await fetch(LAUNCH_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: meme.title,
                symbol: symbol.replace('$', ''),
                creator_wallet: CREATOR_WALLET,
                description: `Certified meme token for ${meme.title}. Community votes on what it becomes. Powered by MemeClaw × Inclawbate.`,
                image_url: imageUrl || '',
                website_url: siteResult.url || siteUrl,
                reward_recipients: [CREATOR_WALLET, INCLAWBATE_TREASURY],
                reward_bps: [8000, 2000]
            })
        });
        const launchData = await launchResp.json();
        console.log(`[MemeClaw] Token launch response:`, JSON.stringify(launchData).slice(0, 300));
        tokenAddress = launchData.token_address || null;
        stakingAddress = launchData.staking_address || null;
        if (launchData.error) console.error(`[MemeClaw] Launch error:`, launchData.error);
    } catch (err) {
        console.error(`[MemeClaw] Launch API call failed:`, err.message);
    }

    // Step 3: Re-publish site with the actual token address + staking address
    if (tokenAddress) {
        try {
            console.log(`[MemeClaw] Re-publishing site with token: ${tokenAddress}, staking: ${stakingAddress || 'none'}`);
            siteResult = await publishTemplateSite(meme, symbol, tokenAddress, stakingAddress);
            console.log(`[MemeClaw] Site re-published:`, siteResult.url);
        } catch (err) {
            console.error(`[MemeClaw] Site re-publish failed:`, err.message);
        }
    } else {
        console.error(`[MemeClaw] No token address — site will have 0x000 placeholder`);
    }

    totalLaunched++;

    // Update DB with launch results
    if (tokenAddress) {
        await updateMemeStatus(meme.guid, {
            status: 'launched',
            symbol,
            token_address: tokenAddress,
            site_url: siteResult.url || siteUrl,
            site_slug: siteResult.slug || slug,
            launched_at: new Date().toISOString()
        });
    } else {
        await updateMemeStatus(meme.guid, {
            status: 'failed',
            symbol,
            site_url: siteResult.url || null,
            site_slug: siteResult.slug || null,
            error_message: 'No token address returned from agent'
        });
    }

    // Step 4: Auto-announce on @inclawbator X account
    if (tokenAddress) {
        try {
            const siteLink = siteResult.url || `https://inclawbate.app/s/${meme.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
            const tweetText = `🦞 New MemeClaw launch: ${meme.title} (${symbol})\n\nCertified meme → real token on Base. Community votes on what it becomes.\n\n${siteLink}`;
            const announceUrl = (process.env.AGENT_CHAT_URL || 'https://www.inclawbate.app/api/inclawbate/agent-chat').replace('/agent-chat', '/announce');
            await fetch(announceUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: tweetText })
            });
            console.log(`[MemeClaw] Announcement tweeted for ${meme.title}`);
        } catch (e) {
            console.error(`[MemeClaw] Announcement tweet failed:`, e.message);
        }
    }

    return {
        meme: meme.title,
        symbol,
        tokenAddress,
        siteUrl: siteResult.url || null,
        siteSlug: siteResult.slug || null,
        ideas: siteResult.ideas || [],
        tokenResponse: launchResp?.reply || 'no response',
        timestamp: new Date().toISOString()
    };
}

async function callAgent(message, sessionId) {
    try {
        const resp = await fetch(AGENT_CHAT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                session_id: sessionId,
                wallet: CREATOR_WALLET,
                reward_recipients: [CREATOR_WALLET, INCLAWBATE_TREASURY],
                reward_bps: [8000, 2000]
            })
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
                // Upsert as queued first, then launch
                await upsertMeme(item, { status: 'queued' });
                try {
                    const result = await launchMemeToken(item);
                    // Update in-memory queue
                    launchQueue.unshift({
                        meme: result.meme,
                        symbol: result.symbol,
                        status: result.tokenAddress ? 'launched' : 'failed',
                        tokenAddress: result.tokenAddress,
                        siteUrl: result.siteUrl,
                        siteSlug: result.siteSlug,
                        timestamp: result.timestamp
                    });
                } catch (err) {
                    console.error(`[MemeClaw] Launch failed for "${item.title}":`, err.message);
                    await updateMemeStatus(item.guid, {
                        status: 'failed',
                        error_message: err.message
                    });
                    launchQueue.unshift({
                        meme: item.title,
                        status: 'failed',
                        error: err.message,
                        timestamp: new Date().toISOString()
                    });
                }
            } else {
                // Queue mode — track in DB with queued status
                const statusText = AUTO_LAUNCH ? 'skipped' : 'queued';
                await upsertMeme(item, { status: statusText });
                launchQueue.unshift({
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
http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    if (req.url === '/health') {
        // Query DB for live counts
        let dbTracked = processedGuids.size;
        let dbLaunched = totalLaunched;
        let dbQueued = 0;
        try {
            const { count: trackedCount } = await supabase
                .from('memeclaw_memes')
                .select('*', { count: 'exact', head: true });
            const { count: launchedCount } = await supabase
                .from('memeclaw_memes')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'launched');
            const { count: queuedCount } = await supabase
                .from('memeclaw_memes')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'queued');
            dbTracked = trackedCount ?? dbTracked;
            dbLaunched = launchedCount ?? dbLaunched;
            dbQueued = queuedCount ?? 0;
        } catch (e) {
            console.error('[MemeClaw] Health DB query error:', e.message);
        }
        res.writeHead(200);
        res.end(JSON.stringify({
            status: 'ok',
            service: 'memeclaw',
            autoLaunch: AUTO_LAUNCH,
            totalLaunched: dbLaunched,
            tracked: dbTracked,
            queueLength: dbQueued,
            lastPoll: lastPollTime,
            uptime: Math.floor(process.uptime())
        }));
    } else if (req.url === '/queue') {
        // Read from Supabase
        try {
            const { data, error } = await supabase
                .from('memeclaw_memes')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);
            if (error) throw error;
            const queue = (data || []).map(row => ({
                meme: row.meme_name,
                link: row.meme_link,
                symbol: row.symbol,
                status: row.status,
                tokenAddress: row.token_address,
                siteUrl: row.site_url,
                siteSlug: row.site_slug,
                imageUrl: row.image_url,
                error: row.error_message,
                timestamp: row.created_at,
                launchedAt: row.launched_at
            }));
            res.writeHead(200);
            res.end(JSON.stringify({ queue }));
        } catch (err) {
            console.error('[MemeClaw] Queue endpoint DB error:', err.message);
            // Fallback to in-memory
            res.writeHead(200);
            res.end(JSON.stringify({ queue: launchQueue.slice(0, 20) }));
        }
    } else if (req.url === '/toggle-auto' && req.method === 'POST') {
        AUTO_LAUNCH = !AUTO_LAUNCH;
        console.log(`[MemeClaw] Auto-launch toggled to: ${AUTO_LAUNCH}`);
        res.writeHead(200);
        res.end(JSON.stringify({ autoLaunch: AUTO_LAUNCH }));
    } else if (req.url.startsWith('/launch/') && req.method === 'POST') {
        // Launch a specific meme by name: POST /launch/Chuck%20Norris
        const memeName = decodeURIComponent(req.url.slice('/launch/'.length));

        // Look up in Supabase first
        let memeData = null;
        try {
            const { data } = await supabase
                .from('memeclaw_memes')
                .select('*')
                .eq('meme_name', memeName)
                .limit(1)
                .single();
            if (data) {
                memeData = {
                    title: data.meme_name,
                    link: data.meme_link || '',
                    guid: data.kym_guid || data.meme_name,
                    description: data.description || ''
                };
            }
        } catch (e) { /* not found in DB, fine */ }

        // Fallback to in-memory queue, then bare name
        if (!memeData) {
            const queued = launchQueue.find(q => q.meme === memeName);
            memeData = queued
                ? { title: queued.meme, link: queued.link || '', guid: queued.meme, description: queued.description || '' }
                : { title: memeName, link: '', guid: memeName, description: '' };
        }

        if (!CREATOR_WALLET) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'CREATOR_WALLET not set' }));
        } else {
            // Return immediately, launch in background — prevents Railway 503 timeout
            res.writeHead(202);
            res.end(JSON.stringify({ status: 'launching', meme: memeName }));
            launchMemeToken(memeData)
                .then(result => console.log(`[MemeClaw] ${memeName} launched:`, result.tokenAddress || 'no address'))
                .catch(err => console.error(`[MemeClaw] ${memeName} failed:`, err.message));
        }
    } else if (req.url === '/launch-next' && req.method === 'POST') {
        // Find oldest queued meme from Supabase
        if (!CREATOR_WALLET) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'CREATOR_WALLET not set' }));
            return;
        }
        try {
            const { data: next, error } = await supabase
                .from('memeclaw_memes')
                .select('*')
                .eq('status', 'queued')
                .order('created_at', { ascending: true })
                .limit(1)
                .single();

            if (error || !next) {
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'No queued memes' }));
                return;
            }

            const memeData = {
                title: next.meme_name,
                link: next.meme_link || '',
                guid: next.kym_guid || next.meme_name,
                description: next.description || ''
            };

            launchMemeToken(memeData)
                .then(result => { res.writeHead(200); res.end(JSON.stringify(result)); })
                .catch(err => { res.writeHead(500); res.end(JSON.stringify({ error: err.message })); });
        } catch (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
        }
    } else {
        res.writeHead(200);
        res.end(JSON.stringify({ service: 'MemeClaw — Automated Meme Token Launcher', docs: '/health, /queue, POST /launch-next' }));
    }
}).listen(PORT, () => console.log(`[MemeClaw] Health check on :${PORT}`));

// ── Start ──

console.log(`[MemeClaw] Starting — auto-launch: ${AUTO_LAUNCH}, poll every ${POLL_INTERVAL_MS / 1000 / 60} min`);
console.log(`[MemeClaw] Creator wallet: ${CREATOR_WALLET || 'NOT SET (queue-only mode)'}`);

// Load state from DB, then start polling
loadStateFromDB().then(() => {
    // First poll immediately
    pollKYM();
    // Then poll on interval
    setInterval(pollKYM, POLL_INTERVAL_MS);
});
