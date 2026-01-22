// Supabase Edge Function: widget-toggle-item
// Marks an item complete/incomplete or deletes it
// Deploy to Supabase: supabase functions deploy widget-toggle-item

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
        const { item_id, action, telegram_id, telegram_auth } = body;

        // Validate action
        const validActions = ['toggle', 'complete', 'uncomplete', 'delete'];
        if (!action || !validActions.includes(action)) {
            return new Response(
                JSON.stringify({ error: 'Invalid action. Use: toggle, complete, uncomplete, or delete' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (!item_id) {
            return new Response(
                JSON.stringify({ error: 'item_id is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ===== AUTHENTICATE USER =====
        let user = null;
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
                JSON.stringify({ error: 'User not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        user = existingUser;

        // ===== VERIFY ACCESS TO ITEM =====
        // Get item and its list
        const { data: item, error: itemErr } = await supabase
            .from('suite_list_items')
            .select('*, suite_lists!inner(id, owner_id)')
            .eq('id', item_id)
            .single();

        if (itemErr || !item) {
            return new Response(
                JSON.stringify({ error: 'Item not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Check if user has access to the list
        const { data: membership } = await supabase
            .from('suite_list_members')
            .select('*')
            .eq('list_id', item.list_id)
            .eq('user_id', user.id)
            .single();

        if (!membership) {
            return new Response(
                JSON.stringify({ error: 'Access denied to this item' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ===== PERFORM ACTION =====
        if (action === 'delete') {
            const { error: deleteErr } = await supabase
                .from('suite_list_items')
                .delete()
                .eq('id', item_id);

            if (deleteErr) {
                return new Response(
                    JSON.stringify({ error: 'Failed to delete item', details: deleteErr }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            return new Response(
                JSON.stringify({
                    success: true,
                    action: 'deleted',
                    item_id
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Toggle/complete/uncomplete
        let newStatus: boolean;
        if (action === 'toggle') {
            newStatus = !item.is_completed;
        } else if (action === 'complete') {
            newStatus = true;
        } else {
            newStatus = false;
        }

        const updateData: any = {
            is_completed: newStatus,
            completed_by: newStatus ? user.id : null,
            completed_at: newStatus ? new Date().toISOString() : null
        };

        const { data: updatedItem, error: updateErr } = await supabase
            .from('suite_list_items')
            .update(updateData)
            .eq('id', item_id)
            .select()
            .single();

        if (updateErr) {
            return new Response(
                JSON.stringify({ error: 'Failed to update item', details: updateErr }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
                action: newStatus ? 'completed' : 'uncompleted',
                item: {
                    id: updatedItem.id,
                    content: updatedItem.content,
                    is_completed: updatedItem.is_completed,
                    completed_at: updatedItem.completed_at
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
