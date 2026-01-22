// Supabase Edge Function: widget-get-lists
// Fetches user's lists for widget display
// Deploy to Supabase: supabase functions deploy widget-get-lists

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

// CORS headers - allow widget requests
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',  // Widgets need broader CORS
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

        // Support both GET (with query params) and POST (with body)
        let telegram_id: string | null = null;
        let telegram_auth: any = null;

        if (req.method === 'GET') {
            const url = new URL(req.url);
            telegram_id = url.searchParams.get('telegram_id');
        } else {
            const body = await req.json();
            telegram_id = body.telegram_id;
            telegram_auth = body.telegram_auth;
        }

        // ===== AUTHENTICATE USER =====
        let user = null;

        if (telegram_auth?.id) {
            // Full auth verification
            if (!verifyTelegramAuth(telegram_auth)) {
                return new Response(
                    JSON.stringify({ error: 'Invalid Telegram authentication' }),
                    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
            telegram_id = telegram_auth.id.toString();
        }

        if (!telegram_id) {
            return new Response(
                JSON.stringify({ error: 'telegram_id or telegram_auth required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Find user by Telegram ID
        const { data: existingUser, error: userErr } = await supabase
            .from('factory_users')
            .select('*')
            .eq('telegram_id', telegram_id)
            .single();

        if (userErr || !existingUser) {
            return new Response(
                JSON.stringify({ error: 'User not found. Please set up your account at getsuite.app first.' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        user = existingUser;

        // ===== FETCH USER'S LISTS =====
        // Get lists user owns or is a member of
        const { data: memberships, error: memberErr } = await supabase
            .from('suite_list_members')
            .select('list_id, role')
            .eq('user_id', user.id);

        if (memberErr) {
            return new Response(
                JSON.stringify({ error: 'Failed to fetch memberships', details: memberErr }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const listIds = memberships?.map(m => m.list_id) || [];

        if (listIds.length === 0) {
            // User has no lists - return empty
            return new Response(
                JSON.stringify({ lists: [] }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Fetch lists with items
        const { data: lists, error: listsErr } = await supabase
            .from('suite_lists')
            .select(`
                id,
                name,
                type,
                icon,
                is_shared,
                owner_id,
                created_at
            `)
            .in('id', listIds)
            .order('created_at', { ascending: true });

        if (listsErr) {
            return new Response(
                JSON.stringify({ error: 'Failed to fetch lists', details: listsErr }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Fetch items for all lists
        const { data: allItems, error: itemsErr } = await supabase
            .from('suite_list_items')
            .select(`
                id,
                list_id,
                content,
                is_completed,
                added_by,
                created_at,
                completed_at,
                position
            `)
            .in('list_id', listIds)
            .order('position', { ascending: true })
            .order('created_at', { ascending: false });

        if (itemsErr) {
            return new Response(
                JSON.stringify({ error: 'Failed to fetch items', details: itemsErr }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Fetch shared list members for display names
        const { data: allMembers } = await supabase
            .from('suite_list_members')
            .select(`
                list_id,
                user_id,
                role,
                factory_users (
                    id,
                    display_name
                )
            `)
            .in('list_id', listIds);

        // Group items by list
        const itemsByList = (allItems || []).reduce((acc: any, item: any) => {
            if (!acc[item.list_id]) acc[item.list_id] = [];
            acc[item.list_id].push({
                id: item.id,
                content: item.content,
                is_completed: item.is_completed,
                created_at: item.created_at,
                completed_at: item.completed_at
            });
            return acc;
        }, {});

        // Group members by list
        const membersByList = (allMembers || []).reduce((acc: any, member: any) => {
            if (!acc[member.list_id]) acc[member.list_id] = [];
            if (member.user_id !== user.id) {  // Don't include self
                acc[member.list_id].push({
                    id: member.user_id,
                    name: member.factory_users?.display_name || 'Unknown',
                    role: member.role
                });
            }
            return acc;
        }, {});

        // Format response
        const result = (lists || []).map((list: any) => ({
            id: list.id,
            name: list.name,
            type: list.type,
            icon: list.icon,
            is_shared: list.is_shared,
            is_owner: list.owner_id === user.id,
            items: itemsByList[list.id] || [],
            shared_with: membersByList[list.id] || [],
            incomplete_count: (itemsByList[list.id] || []).filter((i: any) => !i.is_completed).length
        }));

        return new Response(
            JSON.stringify({
                success: true,
                lists: result,
                user: {
                    id: user.id,
                    display_name: user.display_name
                }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (err) {
        console.error('Edge function error:', err);
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
