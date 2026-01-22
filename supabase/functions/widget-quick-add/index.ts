// Supabase Edge Function: widget-quick-add
// Adds items to lists with AI auto-categorization
// Deploy to Supabase: supabase functions deploy widget-quick-add

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts'

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';

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

// Common grocery keywords for fallback categorization
const GROCERY_KEYWORDS = [
    'milk', 'eggs', 'bread', 'butter', 'cheese', 'yogurt', 'cream',
    'chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'shrimp',
    'apple', 'banana', 'orange', 'grape', 'strawberry', 'blueberry',
    'lettuce', 'tomato', 'onion', 'garlic', 'potato', 'carrot', 'broccoli',
    'rice', 'pasta', 'cereal', 'oatmeal', 'flour', 'sugar', 'salt',
    'coffee', 'tea', 'juice', 'soda', 'water', 'wine', 'beer',
    'soap', 'shampoo', 'toothpaste', 'toilet paper', 'paper towels',
    'detergent', 'dish soap', 'sponge', 'trash bags',
    'snacks', 'chips', 'cookies', 'crackers', 'candy', 'chocolate',
    'frozen', 'pizza', 'ice cream',
    'buy', 'get', 'pick up', 'grocery', 'groceries', 'food', 'store'
];

// Use Gemini to categorize and parse items
async function categorizeWithAI(text: string): Promise<{ items: { content: string; type: 'tasks' | 'groceries' }[] }> {
    if (!GEMINI_API_KEY) {
        return fallbackCategorize(text);
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Parse this text and categorize each item as either "tasks" or "groceries".
Rules:
- Food items, household supplies, things you buy at a store = "groceries"
- Actions, appointments, reminders, things to do = "tasks"
- If input contains multiple items (comma-separated, "and", or new lines), split them

Input: "${text}"

Respond ONLY with valid JSON array:
[{"content": "item text", "type": "tasks"}, {"content": "milk", "type": "groceries"}]`
                    }]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 500
                }
            })
        });

        if (response.ok) {
            const data = await response.json();
            const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            // Extract JSON from response (handle markdown code blocks)
            const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
            if (jsonMatch) {
                const items = JSON.parse(jsonMatch[0]);
                // Validate structure
                if (Array.isArray(items) && items.every((i: any) => i.content && i.type)) {
                    return { items: items.map((i: any) => ({
                        content: i.content.trim(),
                        type: i.type === 'groceries' ? 'groceries' : 'tasks'
                    })) };
                }
            }
        }
    } catch (e) {
        console.error('Gemini error:', e);
    }

    // Fallback if AI fails
    return fallbackCategorize(text);
}

// Fallback categorization using keywords
function fallbackCategorize(text: string): { items: { content: string; type: 'tasks' | 'groceries' }[] } {
    // Split by common separators
    const rawItems = text
        .split(/[,\n]|(?:\s+and\s+)/i)
        .map(s => s.trim())
        .filter(s => s.length > 0);

    const items = rawItems.map(content => {
        const lower = content.toLowerCase();
        const isGrocery = GROCERY_KEYWORDS.some(keyword => lower.includes(keyword));
        return {
            content,
            type: isGrocery ? 'groceries' as const : 'tasks' as const
        };
    });

    return { items };
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
        const { text, telegram_id, telegram_auth, list_id } = body;

        if (!text || text.trim().length === 0) {
            return new Response(
                JSON.stringify({ error: 'Text is required' }),
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
                JSON.stringify({ error: 'User not found. Please set up your account at getsuite.app first.' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        user = existingUser;

        // ===== GET USER'S LISTS =====
        const { data: memberships } = await supabase
            .from('suite_list_members')
            .select('list_id')
            .eq('user_id', user.id);

        const memberListIds = memberships?.map(m => m.list_id) || [];

        const { data: userLists } = await supabase
            .from('suite_lists')
            .select('id, name, type')
            .in('id', memberListIds);

        // Find default lists or create them
        let tasksList = userLists?.find(l => l.type === 'tasks');
        let groceriesList = userLists?.find(l => l.type === 'groceries');

        // Create default lists if they don't exist
        if (!tasksList) {
            const { data: newList } = await supabase
                .from('suite_lists')
                .insert({ name: 'Today', type: 'tasks', icon: '✅', owner_id: user.id })
                .select()
                .single();

            if (newList) {
                await supabase.from('suite_list_members').insert({
                    list_id: newList.id,
                    user_id: user.id,
                    role: 'owner'
                });
                tasksList = newList;
            }
        }

        if (!groceriesList) {
            const { data: newList } = await supabase
                .from('suite_lists')
                .insert({ name: 'Groceries', type: 'groceries', icon: '🛒', owner_id: user.id })
                .select()
                .single();

            if (newList) {
                await supabase.from('suite_list_members').insert({
                    list_id: newList.id,
                    user_id: user.id,
                    role: 'owner'
                });
                groceriesList = newList;
            }
        }

        // ===== CATEGORIZE AND ADD ITEMS =====
        let itemsToAdd: { content: string; type: 'tasks' | 'groceries' }[];

        if (list_id) {
            // If specific list provided, add all items there
            const targetList = userLists?.find(l => l.id === list_id);
            if (!targetList) {
                return new Response(
                    JSON.stringify({ error: 'List not found or access denied' }),
                    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
            // Split text but don't categorize
            const rawItems = text
                .split(/[,\n]|(?:\s+and\s+)/i)
                .map((s: string) => s.trim())
                .filter((s: string) => s.length > 0);

            itemsToAdd = rawItems.map((content: string) => ({
                content,
                type: targetList.type as 'tasks' | 'groceries'
            }));
        } else {
            // Auto-categorize with AI
            const categorized = await categorizeWithAI(text);
            itemsToAdd = categorized.items;
        }

        // Add items to appropriate lists
        const added: { list: string; item: string; id: string }[] = [];

        for (const item of itemsToAdd) {
            const targetListId = list_id || (item.type === 'groceries' ? groceriesList?.id : tasksList?.id);
            const targetListName = list_id
                ? userLists?.find(l => l.id === list_id)?.name
                : (item.type === 'groceries' ? 'Groceries' : 'Today');

            if (!targetListId) continue;

            // Get next position
            const { data: maxPos } = await supabase
                .from('suite_list_items')
                .select('position')
                .eq('list_id', targetListId)
                .order('position', { ascending: false })
                .limit(1)
                .single();

            const nextPosition = (maxPos?.position || 0) + 1;

            const { data: newItem, error: insertErr } = await supabase
                .from('suite_list_items')
                .insert({
                    list_id: targetListId,
                    content: item.content,
                    added_by: user.id,
                    position: nextPosition
                })
                .select()
                .single();

            if (!insertErr && newItem) {
                added.push({
                    list: targetListName || item.type,
                    item: item.content,
                    id: newItem.id
                });
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                added,
                message: added.length === 1
                    ? `Added "${added[0].item}" to ${added[0].list}`
                    : `Added ${added.length} items`
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
