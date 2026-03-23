// App Store API — list apps (GET) + upvote/unlock/tip (POST)

import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const JWT_SECRET = process.env.INCLAWBATE_JWT_SECRET;
const SUPER_ADMIN = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';

// On-chain verification constants (CLAWS on Base)
const CLAWS_ADDRESS = '0x7ca47B141639B893C6782823C0b219f872056379'.toLowerCase();
const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const BASE_RPCS = [
    'https://mainnet.base.org',
    'https://base.llamarpc.com',
    'https://base.drpc.org'
];

async function rpcCall(method, params) {
    for (let i = 0; i < BASE_RPCS.length; i++) {
        try {
            const resp = await fetch(BASE_RPCS[i], {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
            });
            if (resp.status === 429) continue;
            const data = await resp.json();
            if (data.result !== undefined) return data.result;
        } catch (e) { /* try next */ }
    }
    return null;
}

async function verifyClawsTransfer(txHash, expectedRecipient, minAmount) {
    // Retry up to 10 times (20s total) waiting for tx to be mined
    let receipt = null;
    for (let attempt = 0; attempt < 10; attempt++) {
        receipt = await rpcCall('eth_getTransactionReceipt', [txHash]);
        if (receipt) break;
        await new Promise(r => setTimeout(r, 2000));
    }
    if (!receipt || receipt.status !== '0x1') {
        return { valid: false, reason: 'Transaction failed or not found' };
    }

    const transferLog = (receipt.logs || []).find(log =>
        log.address.toLowerCase() === CLAWS_ADDRESS &&
        log.topics[0] === ERC20_TRANSFER_TOPIC
    );
    if (!transferLog) {
        return { valid: false, reason: 'No CLAWS transfer found in transaction' };
    }

    const to = '0x' + transferLog.topics[2].slice(26).toLowerCase();
    const amount = Number(BigInt(transferLog.data)) / 1e18;

    if (to !== expectedRecipient.toLowerCase()) {
        return { valid: false, reason: 'Transfer recipient does not match creator wallet' };
    }

    if (minAmount > 0 && amount < minAmount) {
        return { valid: false, reason: `Transfer amount (${amount}) is less than required (${minAmount})` };
    }

    if (amount <= 0) {
        return { valid: false, reason: 'Transfer amount is zero' };
    }

    return { valid: true, amount };
}

function verifyJwt(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const expectedSig = createHmac('sha256', JWT_SECRET)
            .update(`${parts[0]}.${parts[1]}`)
            .digest('base64url');
        if (parts[2] !== expectedSig) return null;
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
        return payload;
    } catch { return null; }
}

function getUser(req) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return null;
    return verifyJwt(auth.replace('Bearer ', ''));
}

function isSuperAdmin(user) {
    return user?.wallet_address?.toLowerCase() === SUPER_ADMIN;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // ── GET — list apps ──
    if (req.method === 'GET') {
        try {
            // Saved apps for authenticated user
            if (req.query.saved === 'true') {
                const user = getUser(req);
                if (!user) return res.status(401).json({ error: 'Login required' });
                const { data: saved, error: savedErr } = await supabase
                    .from('user_saved_apps')
                    .select('app_slug')
                    .eq('user_id', user.sub);
                if (savedErr) throw savedErr;
                if (!saved || !saved.length) return res.json({ apps: [] });
                const slugs = saved.map(s => s.app_slug);
                const { data: apps, error: appsErr } = await supabase
                    .from('user_apps')
                    .select('id, name, slug, description, category, app_url, created_at')
                    .in('slug', slugs);
                if (appsErr) throw appsErr;
                return res.json({ apps: apps || [] });
            }

            // Platform settings (public)
            if (req.query.get_settings) {
                const { data: settings } = await supabase
                    .from('platform_settings')
                    .select('key, value');
                const result = {};
                if (settings) settings.forEach(s => { result[s.key] = s.value; });
                return res.json({ settings: result });
            }

            const { category, search, sort, page, limit: rawLimit, id } = req.query;
            const user = getUser(req);

            // Single app detail (include code for fork)
            if (id) {
                const { data: app, error } = await supabase
                    .from('user_apps')
                    .select('id, name, slug, description, category, claws_price, creator_wallet, creator_x_handle, tags, upvote_count, is_public, is_listed, forkable, forked_from_user_app, app_url, created_at, updated_at, code')
                    .eq('id', id)
                    .maybeSingle();

                if (error || !app) return res.status(404).json({ error: 'App not found' });

                let has_upvoted = false;
                const lookups = [];
                if (user) {
                    lookups.push(supabase.from('app_upvotes').select('id').eq('profile_id', user.sub).eq('app_id', id).maybeSingle());
                }
                if (app.creator_x_handle) {
                    lookups.push(supabase.from('human_profiles').select('display_name').eq('x_handle', app.creator_x_handle.toLowerCase()).maybeSingle());
                }
                const lookupResults = await Promise.all(lookups);
                if (user) has_upvoted = !!lookupResults[0]?.data;
                const creatorProfile = app.creator_x_handle ? lookupResults[user ? 1 : 0]?.data : null;

                return res.json({ app: { ...app, has_upvoted, creator_display_name: creatorProfile?.display_name || null } });
            }

            // List apps
            const pageNum = Math.max(1, parseInt(page) || 1);
            const limitNum = Math.min(50, Math.max(1, parseInt(rawLimit) || 20));
            const offset = (pageNum - 1) * limitNum;

            const creator = req.query.creator;
            const creatorId = req.query.creator_id;
            let query = supabase
                .from('user_apps')
                .select('id, name, slug, description, category, claws_price, creator_wallet, creator_x_handle, tags, upvote_count, app_url, code, moderated, forkable, is_public, user_id, created_at', { count: 'exact' });

            const creatorWallet = req.query.creator_wallet;
            const creatorXHandle = req.query.creator_x_handle;
            // Build OR conditions from all available identifiers
            const orParts = [];
            if (creatorId) orParts.push(`user_id.eq.${creatorId}`);
            if (creatorWallet) orParts.push(`creator_wallet.ilike.${creatorWallet.toLowerCase()}`);
            if (creatorXHandle) orParts.push(`creator_x_handle.ilike.${creatorXHandle}`);

            if (orParts.length > 1) {
                query = query.or(orParts.join(','));
            } else if (orParts.length === 1) {
                // Single identifier — use exact match
                if (creatorId) query = query.eq('user_id', creatorId);
                else if (creatorWallet) query = query.ilike('creator_wallet', creatorWallet.toLowerCase());
                else if (creatorXHandle) query = query.ilike('creator_x_handle', creatorXHandle);
            } else if (creator) {
                query = query.ilike('creator_x_handle', creator);
            } else {
                query = query.eq('is_public', true);
                // Hide unlisted apps from public store (creators can still see their own via creator filters above)
                query = query.eq('is_listed', true);
                // Hide moderated apps from public listing (admins see all via show_hidden param)
                if (!isSuperAdmin(user) || !req.query.show_hidden) {
                    query = query.or('moderated.is.null,moderated.eq.false');
                }

                // Only filter to inclawbators when explicitly requested (e.g. inclawbators directory page)
                // Default: show ALL public apps regardless of creator profile status
                if (req.query.inclawbators_only === 'true') {
                    const { data: profiles } = await supabase
                        .from('human_profiles')
                        .select('x_handle, wallet_address, tagline, skills')
                        .not('x_handle', 'is', null);
                    // Council wallets — always included
                    const COUNCIL_WALLETS = new Set([
                        '0x91b5c0d07859cfeafeb67d9694121cd741f049bd',
                        '0x18b18e245122f4bda5f2ee4f25c702e05c241d49',
                        '0x496f68438493eb1cc632f7cec6634f042c95e333',
                        '0x3392f862de3a2918c774cdc5c1662e2c02b9e5a3',
                        '0xc2599f1009669f4cda7ac2493de06d450fc79ef9'
                    ]);
                    if (profiles && profiles.length > 0) {
                        // Seed with known council handles (may not have profiles)
                        const handles = new Set(['artstu', 'itsEvilDuck', '0xgrante']);
                        profiles.forEach(p => {
                            if (!p.x_handle) return;
                            const isCouncil = COUNCIL_WALLETS.has((p.wallet_address || '').toLowerCase());
                            const hasTagline = p.tagline && p.tagline.trim().length > 0 && p.tagline.trim().toLowerCase() !== 'none';
                            const hasSkills = p.skills && p.skills.length > 0;
                            if (isCouncil || hasTagline || hasSkills) handles.add(p.x_handle);
                        });
                        if (handles.size > 0) {
                            query = query.in('creator_x_handle', [...handles]);
                        }
                    }
                }
            }

            // Featured filter
            if (req.query.featured === 'true') {
                query = query.eq('featured', true);
            }

            if (category && category !== 'all') {
                query = query.eq('category', category);
            }

            // Pricing filter
            const pricing = req.query.pricing;
            if (pricing === 'free') {
                query = query.or('claws_price.is.null,claws_price.eq.0');
            } else if (pricing === 'paid') {
                query = query.gt('claws_price', 0);
            }

            if (search) {
                query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,creator_x_handle.ilike.%${search}%`);
            }

            // Sort
            if (sort === 'newest') {
                query = query.order('created_at', { ascending: false });
            } else if (sort === 'popular') {
                query = query.order('upvote_count', { ascending: false });
            } else {
                // trending: upvotes weighted by recency (simple: order by upvotes then date)
                query = query.order('upvote_count', { ascending: false }).order('created_at', { ascending: false });
            }

            query = query.range(offset, offset + limitNum - 1);

            const { data: apps, error, count } = await query;
            if (error) {
                console.error('apps query error:', JSON.stringify(error));
                return res.status(500).json({ error: 'Query failed', detail: error.message, code: error.code });
            }

            // Backfill user_id on apps matched by wallet/handle but missing user_id
            if (user && creatorId && apps.length > 0) {
                const orphanIds = apps.filter(a => !a.user_id).map(a => a.id);
                if (orphanIds.length > 0) {
                    supabase.from('user_apps')
                        .update({ user_id: creatorId })
                        .in('id', orphanIds)
                        .then(() => {});
                }
            }

            // Check upvotes and unlocks for authenticated user
            let upvotedSet = new Set();
            let unlockedSet = new Set();
            if (user && apps.length > 0) {
                const appIds = apps.map(a => a.id);
                const [{ data: uvs }, { data: ulks }] = await Promise.all([
                    supabase.from('app_upvotes').select('app_id').eq('profile_id', user.sub).in('app_id', appIds),
                    supabase.from('app_unlocks').select('app_id').eq('profile_id', user.sub).in('app_id', appIds)
                ]);
                if (uvs) uvs.forEach(u => upvotedSet.add(u.app_id));
                if (ulks) ulks.forEach(u => unlockedSet.add(u.app_id));
            }

            // Batch-lookup display_name for app creators
            let displayNameMap = {};
            if (apps.length > 0) {
                const handles = [...new Set(apps.map(a => a.creator_x_handle).filter(Boolean).map(h => h.toLowerCase()))];
                if (handles.length > 0) {
                    const { data: profiles } = await supabase
                        .from('human_profiles')
                        .select('x_handle, display_name')
                        .in('x_handle', handles);
                    if (profiles) {
                        profiles.forEach(p => {
                            if (p.display_name) displayNameMap[p.x_handle] = p.display_name;
                        });
                    }
                }
            }

            // Enrich with token/staking data from inclawbator_projects
            let projectByAppId = {};
            let projectByWallet = {};
            if (apps.length > 0) {
                const appIds = apps.map(a => a.id);
                const creatorWallets = [...new Set(apps.map(a => a.creator_wallet).filter(Boolean))];

                const orFilters = [];
                if (appIds.length) orFilters.push(`website_url.in.(${appIds.join(',')})`);
                if (creatorWallets.length) orFilters.push(`creator_wallet.in.(${creatorWallets.join(',')})`);

                if (orFilters.length) {
                    const { data: projects } = await supabase
                        .from('inclawbator_projects')
                        .select('id, website_url, creator_wallet, token_address, token_symbol, staking_address')
                        .eq('status', 'active')
                        .or(orFilters.join(','));

                    if (projects) {
                        projects.forEach(p => {
                            if (p.website_url) projectByAppId[p.website_url] = p;
                            if (p.creator_wallet) projectByWallet[p.creator_wallet] = p;
                        });
                    }
                }
            }

            const results = apps.map(a => {
                const { code, ...rest } = a;
                const proj = projectByAppId[a.id] || projectByWallet[a.creator_wallet] || null;
                const entry = {
                    ...rest,
                    has_code: !!code,
                    has_upvoted: upvotedSet.has(a.id),
                    has_unlocked: unlockedSet.has(a.id),
                    creator_display_name: a.creator_x_handle ? (displayNameMap[a.creator_x_handle.toLowerCase()] || null) : null,
                    token_symbol: proj ? proj.token_symbol : null,
                    token_address: proj ? proj.token_address : null,
                    staking_address: proj ? proj.staking_address : null
                };
                // Include code when creator is fetching their own apps (for edit)
                if ((creator || creatorId) && code) entry.code = code;
                return entry;
            });

            // Count unique builders across all public apps
            let builders = 0;
            if (!creator && !creatorId) {
                const { data: allCreators } = await supabase
                    .from('user_apps')
                    .select('creator_wallet, creator_x_handle')
                    .eq('is_public', true);
                if (allCreators) {
                    const builderSet = new Set();
                    allCreators.forEach(a => {
                        if (a.creator_wallet) builderSet.add(a.creator_wallet.toLowerCase());
                        else if (a.creator_x_handle) builderSet.add(a.creator_x_handle.toLowerCase());
                    });
                    builders = builderSet.size;
                }
            }

            return res.json({
                apps: results,
                total: count,
                page: pageNum,
                pages: Math.ceil((count || 0) / limitNum),
                builders
            });

        } catch (err) {
            console.error('apps list error:', err);
            return res.status(500).json({ error: 'Failed to load apps' });
        }
    }

    // ── POST — upvote / unlock / tip ──
    if (req.method === 'POST') {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Login required' });

        try {
            const { action, app_id, app_slug, tx_hash, amount: tipAmount } = req.body;

            // ── Save app ──
            if (action === 'save') {
                if (!app_slug) return res.status(400).json({ error: 'app_slug required' });
                const { error: upsErr } = await supabase
                    .from('user_saved_apps')
                    .upsert({ user_id: user.sub, app_slug }, { onConflict: 'user_id,app_slug' });
                if (upsErr) throw upsErr;
                return res.json({ saved: true });
            }

            // ── Unsave app ──
            if (action === 'unsave') {
                if (!app_slug) return res.status(400).json({ error: 'app_slug required' });
                await supabase
                    .from('user_saved_apps')
                    .delete()
                    .eq('user_id', user.sub)
                    .eq('app_slug', app_slug);
                return res.json({ unsaved: true });
            }

            // ── Get saved slugs ──
            if (action === 'get_saved') {
                const { data: saved, error: gsErr } = await supabase
                    .from('user_saved_apps')
                    .select('app_slug')
                    .eq('user_id', user.sub);
                if (gsErr) throw gsErr;
                return res.json({ slugs: (saved || []).map(s => s.app_slug) });
            }

            if (!app_id) return res.status(400).json({ error: 'app_id required' });

            // ── Upvote ──
            if (action === 'upvote') {
                const { data: existing } = await supabase
                    .from('app_upvotes')
                    .select('id')
                    .eq('profile_id', user.sub)
                    .eq('app_id', app_id)
                    .maybeSingle();

                if (existing) {
                    await supabase.from('app_upvotes').delete().eq('id', existing.id);
                    const { data: app } = await supabase.from('user_apps').select('upvote_count').eq('id', app_id).maybeSingle();
                    if (app) {
                        const newCount = Math.max(0, (app.upvote_count || 0) - 1);
                        await supabase.from('user_apps').update({ upvote_count: newCount }).eq('id', app_id);
                        return res.json({ upvoted: false, upvote_count: newCount });
                    }
                    return res.json({ upvoted: false });
                } else {
                    await supabase.from('app_upvotes').insert({ profile_id: user.sub, app_id });
                    const { data: app } = await supabase.from('user_apps').select('upvote_count').eq('id', app_id).maybeSingle();
                    if (app) {
                        const newCount = (app.upvote_count || 0) + 1;
                        await supabase.from('user_apps').update({ upvote_count: newCount }).eq('id', app_id);
                        return res.json({ upvoted: true, upvote_count: newCount });
                    }
                    return res.json({ upvoted: true });
                }
            }

            // ── Unlock ──
            if (action === 'unlock') {
                if (!tx_hash || !/^0x[a-fA-F0-9]{64}$/.test(tx_hash)) {
                    return res.status(400).json({ error: 'Valid tx_hash required' });
                }

                // Check duplicate
                const { data: dup } = await supabase.from('app_unlocks').select('id').eq('tx_hash', tx_hash.toLowerCase()).maybeSingle();
                if (dup) return res.status(409).json({ error: 'Transaction already used' });

                // Get app details
                const { data: app } = await supabase.from('user_apps')
                    .select('id, claws_price, creator_wallet')
                    .eq('id', app_id).maybeSingle();
                if (!app) return res.status(404).json({ error: 'App not found' });
                if (!app.creator_wallet) return res.status(400).json({ error: 'App has no creator wallet' });
                if (!app.claws_price || app.claws_price <= 0) return res.status(400).json({ error: 'App is free' });

                // Verify on-chain
                const verification = await verifyClawsTransfer(tx_hash, app.creator_wallet, app.claws_price);
                if (!verification.valid) {
                    return res.status(400).json({ error: verification.reason });
                }

                // Record unlock
                const { error: insErr } = await supabase.from('app_unlocks').insert({
                    profile_id: user.sub,
                    app_id,
                    tx_hash: tx_hash.toLowerCase(),
                    amount: verification.amount
                });
                if (insErr) {
                    if (insErr.code === '23505') return res.status(409).json({ error: 'Transaction already used' });
                    throw insErr;
                }

                return res.json({ unlocked: true, amount: verification.amount });
            }

            // ── Tip ──
            if (action === 'tip') {
                if (!tx_hash || !/^0x[a-fA-F0-9]{64}$/.test(tx_hash)) {
                    return res.status(400).json({ error: 'Valid tx_hash required' });
                }

                // Check duplicate
                const { data: dup } = await supabase.from('app_tips').select('id').eq('tx_hash', tx_hash.toLowerCase()).maybeSingle();
                if (dup) return res.status(409).json({ error: 'Transaction already used' });

                // Get app creator wallet
                const { data: app } = await supabase.from('user_apps')
                    .select('id, creator_wallet')
                    .eq('id', app_id).maybeSingle();
                if (!app) return res.status(404).json({ error: 'App not found' });
                if (!app.creator_wallet) return res.status(400).json({ error: 'App has no creator wallet' });

                // Verify on-chain — any positive amount
                const verification = await verifyClawsTransfer(tx_hash, app.creator_wallet, 0);
                if (!verification.valid) {
                    return res.status(400).json({ error: verification.reason });
                }

                // Record tip
                const { error: insErr } = await supabase.from('app_tips').insert({
                    profile_id: user.sub,
                    app_id,
                    tx_hash: tx_hash.toLowerCase(),
                    amount: verification.amount
                });
                if (insErr) {
                    if (insErr.code === '23505') return res.status(409).json({ error: 'Transaction already used' });
                    throw insErr;
                }

                return res.json({ tipped: true, amount: verification.amount });
            }

            // ── Check unlock status ──
            if (action === 'check-unlock') {
                const { data: unlock } = await supabase.from('app_unlocks')
                    .select('id')
                    .eq('profile_id', user.sub)
                    .eq('app_id', app_id)
                    .maybeSingle();
                return res.json({ unlocked: !!unlock });
            }

            // ── Moderate (SUPER_ADMIN only) ──
            if (action === 'moderate') {
                if (!isSuperAdmin(user)) {
                    return res.status(403).json({ error: 'Unauthorized' });
                }

                const { moderate_action } = req.body;

                if (moderate_action === 'hide') {
                    const { error: modErr } = await supabase
                        .from('user_apps')
                        .update({ moderated: true })
                        .eq('id', app_id);
                    if (modErr) throw modErr;
                    return res.json({ moderated: true, action: 'hidden' });
                }

                if (moderate_action === 'unhide') {
                    const { error: modErr } = await supabase
                        .from('user_apps')
                        .update({ moderated: false })
                        .eq('id', app_id);
                    if (modErr) throw modErr;
                    return res.json({ moderated: false, action: 'unhidden' });
                }

                if (moderate_action === 'delete') {
                    const { error: delErr } = await supabase
                        .from('user_apps')
                        .delete()
                        .eq('id', app_id);
                    if (delErr) throw delErr;
                    return res.json({ deleted: true, action: 'deleted' });
                }

                if (moderate_action === 'feature') {
                    const { error: featErr } = await supabase
                        .from('user_apps')
                        .update({ featured: true })
                        .eq('id', app_id);
                    if (featErr) throw featErr;
                    return res.json({ featured: true, action: 'featured' });
                }

                if (moderate_action === 'unfeature') {
                    const { error: featErr } = await supabase
                        .from('user_apps')
                        .update({ featured: false })
                        .eq('id', app_id);
                    if (featErr) throw featErr;
                    return res.json({ featured: false, action: 'unfeatured' });
                }

                return res.status(400).json({ error: 'Unknown moderate_action. Use: hide, unhide, delete, feature, unfeature' });
            }

            // ── Toggle anonymous publishing (SUPER_ADMIN only) ──
            if (action === 'toggle_anonymous_publish') {
                if (!isSuperAdmin(user)) {
                    return res.status(403).json({ error: 'Unauthorized' });
                }
                const { enabled } = req.body;
                const value = enabled ? 'true' : 'false';
                const { error: upsertErr } = await supabase
                    .from('platform_settings')
                    .upsert({ key: 'allow_anonymous_publish', value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
                if (upsertErr) throw upsertErr;
                return res.json({ success: true, allow_anonymous_publish: value });
            }

            // ── Claim anonymous apps after wallet connect ──
            if (action === 'claim_anonymous') {
                const { slugs } = req.body;
                if (!Array.isArray(slugs) || !slugs.length) {
                    return res.status(400).json({ error: 'slugs array required' });
                }

                // Only claim apps that are still anonymous
                const cleanSlugs = slugs.slice(0, 20).map(s => s.toLowerCase().trim());
                const email = user.x_handle ? user.x_handle + '@inclawbate.app' : 'anonymous@inclawbate.app';
                const { data: claimed, error: claimErr } = await supabase
                    .from('user_apps')
                    .update({
                        publisher_email: email,
                        creator_wallet: user.wallet_address || null,
                        creator_x_handle: user.x_handle || null,
                        user_id: user.sub
                    })
                    .in('slug', cleanSlugs)
                    .eq('publisher_email', 'anonymous@inclawbate.app')
                    .select('slug');

                if (claimErr) throw claimErr;
                return res.json({ claimed: true, count: claimed ? claimed.length : 0 });
            }

            // ── Rename app (owner only) ──
            if (action === 'rename') {
                const { new_name } = req.body;
                if (!app_id) return res.status(400).json({ error: 'app_id required' });
                if (!new_name || !new_name.trim()) return res.status(400).json({ error: 'new_name required' });
                const trimmed = new_name.trim().slice(0, 100);

                // Verify ownership
                const { data: app } = await supabase
                    .from('user_apps')
                    .select('id, user_id, creator_x_handle')
                    .eq('id', app_id)
                    .single();
                if (!app) return res.status(404).json({ error: 'App not found' });
                const ownsById = app.user_id && app.user_id === user.sub;
                const ownsByHandle = app.creator_x_handle && user.x_handle &&
                    app.creator_x_handle.toLowerCase() === user.x_handle.toLowerCase();
                if (!ownsById && !ownsByHandle && !isSuperAdmin(user)) {
                    return res.status(403).json({ error: 'You can only rename your own apps' });
                }

                const { error: renameErr } = await supabase
                    .from('user_apps')
                    .update({ name: trimmed, updated_at: new Date().toISOString() })
                    .eq('id', app_id);
                if (renameErr) throw renameErr;
                return res.json({ renamed: true, name: trimmed });
            }

            // ── Update app details (owner only) ──
            if (action === 'update-details') {
                if (!app_id) return res.status(400).json({ error: 'app_id required' });

                const { data: app } = await supabase
                    .from('user_apps')
                    .select('id, user_id, creator_x_handle')
                    .eq('id', app_id)
                    .single();
                if (!app) return res.status(404).json({ error: 'App not found' });
                const ownsById = app.user_id && app.user_id === user.sub;
                const ownsByHandle = app.creator_x_handle && user.x_handle &&
                    app.creator_x_handle.toLowerCase() === user.x_handle.toLowerCase();
                if (!ownsById && !ownsByHandle && !isSuperAdmin(user)) {
                    return res.status(403).json({ error: 'You can only edit your own apps' });
                }

                // Backfill user_id if matched by handle but missing
                if (!app.user_id && ownsByHandle) {
                    supabase.from('user_apps').update({ user_id: user.sub }).eq('id', app_id).then(() => {});
                }

                const updates = { updated_at: new Date().toISOString() };
                const { new_name, description, category, tags, forkable, new_slug } = req.body;
                if (new_name !== undefined) updates.name = (new_name || '').trim().slice(0, 100) || 'Untitled App';
                if (description !== undefined) updates.description = (description || '').trim().slice(0, 500);
                if (category !== undefined) {
                    const allowed = ['games', 'defi', 'social', 'tools', 'creative', 'other'];
                    updates.category = allowed.includes(category) ? category : 'other';
                }
                if (tags !== undefined) updates.tags = (tags || '').split(',').map(t => t.trim()).filter(Boolean);
                if (forkable !== undefined) updates.forkable = !!forkable;

                // Slug change
                if (new_slug !== undefined) {
                    const slug = (new_slug || '').toLowerCase().trim().replace(/[^a-z0-9-]/g, '').slice(0, 80);
                    if (!slug || slug.length < 2) return res.status(400).json({ error: 'Slug must be at least 2 characters (letters, numbers, hyphens only)' });
                    // Check uniqueness
                    const { data: existing } = await supabase
                        .from('user_apps')
                        .select('id')
                        .eq('slug', slug)
                        .neq('id', app_id)
                        .maybeSingle();
                    if (existing) return res.status(409).json({ error: 'That slug is already taken' });
                    updates.slug = slug;
                }

                const { error: updErr } = await supabase
                    .from('user_apps')
                    .update(updates)
                    .eq('id', app_id);
                if (updErr) throw updErr;
                return res.json({ updated: true, ...updates });
            }

            // ── Toggle publish (owner only) ──
            if (action === 'toggle-publish') {
                if (!app_id) return res.status(400).json({ error: 'app_id required' });

                const { data: app } = await supabase
                    .from('user_apps')
                    .select('id, user_id, creator_x_handle, is_public')
                    .eq('id', app_id)
                    .single();
                if (!app) return res.status(404).json({ error: 'App not found' });
                const ownsById = app.user_id && app.user_id === user.sub;
                const ownsByHandle = app.creator_x_handle && user.x_handle &&
                    app.creator_x_handle.toLowerCase() === user.x_handle.toLowerCase();
                if (!ownsById && !ownsByHandle && !isSuperAdmin(user)) {
                    return res.status(403).json({ error: 'You can only manage your own apps' });
                }

                const newVal = !app.is_public;
                const { error: updErr } = await supabase
                    .from('user_apps')
                    .update({ is_public: newVal, updated_at: new Date().toISOString() })
                    .eq('id', app_id);
                if (updErr) throw updErr;
                return res.json({ toggled: true, is_public: newVal });
            }

            return res.status(400).json({ error: 'Unknown action. Use: upvote, unlock, tip, check-unlock, moderate, toggle_anonymous_publish, claim_anonymous, save, unsave, get_saved, rename, update-details, toggle-publish' });

        } catch (err) {
            console.error('apps POST error:', err);
            return res.status(500).json({ error: 'Something went wrong' });
        }
    }

    // ── DELETE — remove own app ──
    if (req.method === 'DELETE') {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Login required' });

        try {
            const { app_id } = req.body;
            if (!app_id) return res.status(400).json({ error: 'app_id required' });

            const { data: app, error: lookupErr } = await supabase
                .from('user_apps')
                .select('id, user_id, creator_x_handle')
                .eq('id', app_id)
                .maybeSingle();

            if (lookupErr || !app) return res.status(404).json({ error: 'App not found' });

            // Verify ownership
            const ownsById = app.user_id && app.user_id === user.sub;
            const ownsByHandle = app.creator_x_handle && user.x_handle &&
                app.creator_x_handle.toLowerCase() === user.x_handle.toLowerCase();
            if (!ownsById && !ownsByHandle) {
                return res.status(403).json({ error: 'You do not own this app' });
            }

            const { error: delErr } = await supabase
                .from('user_apps')
                .delete()
                .eq('id', app_id);

            if (delErr) throw delErr;

            return res.json({ deleted: true });
        } catch (err) {
            console.error('apps DELETE error:', err);
            return res.status(500).json({ error: 'Failed to delete app' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
