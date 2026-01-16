import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODk3MTgsImV4cCI6MjA4MzM2NTcxOH0.DcLpWs8Lf1s4Flf54J5LubokSYrd7h-XvI_X0jj6bLM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Types
export interface App {
  id: string;
  name: string;
  slug: string;
  tagline?: string;
  description?: string;
  icon_url?: string;
  app_url?: string;
  category?: string;
  status: 'pending' | 'approved' | 'featured';
  rating?: number;
  created_at: string;
}

export interface UserCredits {
  discord_id: string;
  wallet_address?: string;
  suite_balance: number;
  discord_username?: string;
  discord_avatar?: string;
}

// Fetch all live apps
export async function fetchApps(): Promise<App[]> {
  const { data, error } = await supabase
    .from('apps')
    .select('*')
    .in('status', ['approved', 'featured'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching apps:', error);
    return [];
  }

  return data || [];
}

// Fetch user credits by Discord ID
export async function fetchUserCredits(discordId: string): Promise<UserCredits | null> {
  const { data, error } = await supabase
    .from('user_credits')
    .select('*')
    .eq('discord_id', discordId)
    .single();

  if (error) {
    console.error('Error fetching user credits:', error);
    return null;
  }

  return data;
}

// Get featured/new app of the day
export async function fetchFeaturedApp(): Promise<App | null> {
  const { data, error } = await supabase
    .from('apps')
    .select('*')
    .eq('status', 'featured')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    // Fall back to most recent approved app
    const { data: fallback } = await supabase
      .from('apps')
      .select('*')
      .in('status', ['approved', 'featured'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return fallback || null;
  }

  return data;
}
