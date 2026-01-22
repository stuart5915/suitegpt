// Supabase Edge Function: list-share
// Handles sharing lists: create share link, join via link, remove member
// Deploy to Supabase: supabase functions deploy list-share

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts'

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';

// SECURITY: Verify Telegram auth data is genuine
function verifyTelegramAuth(authData: any): boolean {
    if (!authData || !authData.hash || !TELEGRAM_BOT_TOKEN) return false;

    const { hash, ...data } = authData;
    const checkString = Object.keys(data)
        .sort()
        .map(k => `${k}=${data[k]}`)
        .join('\n');

    const secretKey = createHmac('sha256', 'WebAppData')
        .update(TELEGRAM_BOT_TOKEN)
        .digest();

    const hmac = createHmac('sha256', secretKey)
        .update(checkString)
        .digest('hex');

    return hmac === hash;
}

// Generate random share code
function generateShareCode(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const body = await req.json();
        const { action, list_id, share_code, user_id_to_remove, telegram_id, telegram_auth } = body;

        // Validate action
        const validActions = ['create_link', 'get_link_info', 'join', 'leave', 'remove_member', 'disable_sharing'];
        if (!action || !validActions.includes(action)) {
            return new Response(
                JSON.stringify({ error: 'Invalid action. Use: create_link, get_link_info, join, leave, remove_member, disable_sharing' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ===== AUTHENTICATE USER (except for get_link_info) =====
        let user = null;

        if (action !== 'get_link_info') {
            let tgId = telegram_id;

            if (telegram_auth?.id) {
                if (!verifyTelegramAuth(telegram_auth)) {
                    return new Response(
                        JSON.stringify({ error: 'Invalid Telegram authentication' }),
                        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }
                tgId = telegram_auth.id.toString();
            }

            if (!tgId) {
                return new Response(
                    JSON.stringify({ error: 'telegram_id or telegram_auth required' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Find user
            const { data: existingUser, error: userErr } = await supabase
                .from('factory_users')
                .select('*')
                .eq('telegram_id', tgId)
                .single();

            if (userErr || !existingUser) {
                return new Response(
                    JSON.stringify({ error: 'User not found. Please set up your account at getsuite.app first.' }),
                    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            user = existingUser;
        }

        // ===== ACTION: GET_LINK_INFO =====
        // Public endpoint - shows list info before joining
        if (action === 'get_link_info') {
            if (!share_code) {
                return new Response(
                    JSON.stringify({ error: 'share_code is required' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            const { data: list, error: listErr } = await supabase
                .from('suite_lists')
                .select(`
                    id, name, type, icon,
                    factory_users!owner_id (display_name)
                `)
                .eq('share_code', share_code)
                .single();

            if (listErr || !list) {
                return new Response(
                    JSON.stringify({ error: 'Invalid or expired share link' }),
                    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Get member count
            const { count: memberCount } = await supabase
                .from('suite_list_members')
                .select('*', { count: 'exact', head: true })
                .eq('list_id', list.id);

            return new Response(
                JSON.stringify({
                    success: true,
                    list: {
                        name: list.name,
                        type: list.type,
                        icon: list.icon,
                        owner_name: (list.factory_users as any)?.display_name || 'Unknown',
                        member_count: memberCount || 1
                    }
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ===== ACTION: CREATE_LINK =====
        if (action === 'create_link') {
            if (!list_id) {
                return new Response(
                    JSON.stringify({ error: 'list_id is required' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Verify user owns this list
            const { data: list, error: listErr } = await supabase
                .from('suite_lists')
                .select('*')
                .eq('id', list_id)
                .eq('owner_id', user!.id)
                .single();

            if (listErr || !list) {
                return new Response(
                    JSON.stringify({ error: 'List not found or you are not the owner' }),
                    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Generate or return existing share code
            let shareCode = list.share_code;
            if (!shareCode) {
                shareCode = generateShareCode();

                const { error: updateErr } = await supabase
                    .from('suite_lists')
                    .update({ share_code: shareCode, is_shared: true })
                    .eq('id', list_id);

                if (updateErr) {
                    return new Response(
                        JSON.stringify({ error: 'Failed to generate share link', details: updateErr }),
                        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }
            }

            return new Response(
                JSON.stringify({
                    success: true,
                    share_code: shareCode,
                    share_url: `https://getsuite.app/join/${shareCode}`
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ===== ACTION: JOIN =====
        if (action === 'join') {
            if (!share_code) {
                return new Response(
                    JSON.stringify({ error: 'share_code is required' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Find list by share code
            const { data: list, error: listErr } = await supabase
                .from('suite_lists')
                .select('*')
                .eq('share_code', share_code)
                .single();

            if (listErr || !list) {
                return new Response(
                    JSON.stringify({ error: 'Invalid or expired share link' }),
                    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Check if already a member
            const { data: existingMember } = await supabase
                .from('suite_list_members')
                .select('*')
                .eq('list_id', list.id)
                .eq('user_id', user!.id)
                .single();

            if (existingMember) {
                return new Response(
                    JSON.stringify({
                        success: true,
                        already_member: true,
                        list: { id: list.id, name: list.name }
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Add as member
            const { error: joinErr } = await supabase
                .from('suite_list_members')
                .insert({
                    list_id: list.id,
                    user_id: user!.id,
                    role: 'member'
                });

            if (joinErr) {
                return new Response(
                    JSON.stringify({ error: 'Failed to join list', details: joinErr }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            return new Response(
                JSON.stringify({
                    success: true,
                    joined: true,
                    list: { id: list.id, name: list.name, type: list.type }
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ===== ACTION: LEAVE =====
        if (action === 'leave') {
            if (!list_id) {
                return new Response(
                    JSON.stringify({ error: 'list_id is required' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Can't leave if you're the owner
            const { data: list } = await supabase
                .from('suite_lists')
                .select('owner_id')
                .eq('id', list_id)
                .single();

            if (list?.owner_id === user!.id) {
                return new Response(
                    JSON.stringify({ error: 'Owners cannot leave their own lists. Delete the list instead.' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            const { error: leaveErr } = await supabase
                .from('suite_list_members')
                .delete()
                .eq('list_id', list_id)
                .eq('user_id', user!.id);

            if (leaveErr) {
                return new Response(
                    JSON.stringify({ error: 'Failed to leave list', details: leaveErr }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            return new Response(
                JSON.stringify({ success: true, left: true }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ===== ACTION: REMOVE_MEMBER =====
        if (action === 'remove_member') {
            if (!list_id || !user_id_to_remove) {
                return new Response(
                    JSON.stringify({ error: 'list_id and user_id_to_remove are required' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Verify user owns this list
            const { data: list } = await supabase
                .from('suite_lists')
                .select('owner_id')
                .eq('id', list_id)
                .single();

            if (list?.owner_id !== user!.id) {
                return new Response(
                    JSON.stringify({ error: 'Only the list owner can remove members' }),
                    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Can't remove yourself (the owner)
            if (user_id_to_remove === user!.id) {
                return new Response(
                    JSON.stringify({ error: 'Cannot remove yourself. Delete the list instead.' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            const { error: removeErr } = await supabase
                .from('suite_list_members')
                .delete()
                .eq('list_id', list_id)
                .eq('user_id', user_id_to_remove);

            if (removeErr) {
                return new Response(
                    JSON.stringify({ error: 'Failed to remove member', details: removeErr }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            return new Response(
                JSON.stringify({ success: true, removed: true }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ===== ACTION: DISABLE_SHARING =====
        if (action === 'disable_sharing') {
            if (!list_id) {
                return new Response(
                    JSON.stringify({ error: 'list_id is required' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Verify user owns this list
            const { data: list } = await supabase
                .from('suite_lists')
                .select('owner_id')
                .eq('id', list_id)
                .single();

            if (list?.owner_id !== user!.id) {
                return new Response(
                    JSON.stringify({ error: 'Only the list owner can disable sharing' }),
                    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Clear share code (existing members stay, but no new joins)
            const { error: updateErr } = await supabase
                .from('suite_lists')
                .update({ share_code: null })
                .eq('id', list_id);

            if (updateErr) {
                return new Response(
                    JSON.stringify({ error: 'Failed to disable sharing', details: updateErr }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            return new Response(
                JSON.stringify({ success: true, sharing_disabled: true }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({ error: 'Unknown action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (err) {
        console.error('Edge function error:', err);
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
