// Inclawbate — Lightweight API request counter
// Usage: import { track } from './track.js'; then call track('agent_chat') at top of handler

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export function track(category) {
    // Fire-and-forget — never blocks the API response
    const today = new Date().toISOString().slice(0, 10);
    supabase.rpc('increment_api_stat', {
        p_date: today,
        p_category: category || null
    }).catch(() => {});
}
