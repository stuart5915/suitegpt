import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// App types for the shared apps table
export interface App {
    id: string;
    name: string;
    creator_discord_id?: string;
    creator_name?: string;
    code: string;
    status: 'draft' | 'pending' | 'published';
    live_url?: string;
    created_at: string;
    updated_at: string;
}

// Save app draft
export async function saveAppDraft(app: Partial<App>) {
    const { data, error } = await supabase
        .from('apps')
        .upsert(app)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// Get user's apps
export async function getUserApps(creatorId: string) {
    const { data, error } = await supabase
        .from('apps')
        .select('*')
        .eq('creator_discord_id', creatorId)
        .order('updated_at', { ascending: false });

    if (error) throw error;
    return data;
}

// Get app by ID
export async function getAppById(id: string) {
    const { data, error } = await supabase
        .from('apps')
        .select('*')
        .eq('id', id)
        .single();

    if (error) throw error;
    return data;
}
