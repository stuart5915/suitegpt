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
                    .select('id, name, slug, description, category, claws_price, creator_wallet, creator_x_handle, tags, upvote_count, is_public, is_listed, forked_from_user_app, app_url, created_at, updated_at, code')
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
                .select('id, name, slug, description, category, claws_price, creator_wallet, creator_x_handle, tags, upvote_count, app_url, code, moderated, created_at', { count: 'exact' });

            const creatorWallet = req.query.creator_wallet;
            if (creatorId && creatorWallet) {
                query = query.or(`user_id.eq.${creatorId},creator_wallet.eq.${creatorWallet.toLowerCase()}`);
            } else if (creatorId) {
                query = query.eq('user_id', creatorId);
            } else if (creator) {
                query = query.ilike('creator_x_handle', creator);
            } else {
                query = query.eq('is_public', true);
                // Hide moderated apps from public listing (admins see all via show_hidden param)
                if (!isSuperAdmin(user) || !req.query.show_hidden) {
                    query = query.or('moderated.is.null,moderated.eq.false');
                }
            }

            if (category && category !== 'all') {
                query = query.eq('category', category);
            }

            if (search) {
                query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
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
            const { action, app_id, tx_hash, amount: tipAmount } = req.body;
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

                return res.status(400).json({ error: 'Unknown moderate_action. Use: hide, unhide, delete' });
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
                const email = user.x_handle ? user.x_handle + '@inclawbate.com' : 'anonymous@inclawbate.com';
                const { data: claimed, error: claimErr } = await supabase
                    .from('user_apps')
                    .update({
                        publisher_email: email,
                        creator_wallet: user.wallet_address || null,
                        creator_x_handle: user.x_handle || null,
                        user_id: user.sub
                    })
                    .in('slug', cleanSlugs)
                    .eq('publisher_email', 'anonymous@inclawbate.com')
                    .select('slug');

                if (claimErr) throw claimErr;
                return res.json({ claimed: true, count: claimed ? claimed.length : 0 });
            }

            return res.status(400).json({ error: 'Unknown action. Use: upvote, unlock, tip, check-unlock, moderate, toggle_anonymous_publish, claim_anonymous' });

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
