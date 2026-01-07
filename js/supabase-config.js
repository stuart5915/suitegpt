// SUITE App Store - Supabase Configuration
// This file provides the Supabase client for the app store

const SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODk3MTgsImV4cCI6MjA4MzM2NTcxOH0.DcLpWs8Lf1s4Flf54J5LubokSYrd7h-XvI_X0jj6bLM';

// Initialize Supabase client (using CDN version for static HTML)
// Include this script in your HTML: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

function initSupabase() {
    if (typeof supabase === 'undefined') {
        console.error('Supabase library not loaded. Add the CDN script to your HTML.');
        return null;
    }
    return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Fetch approved apps from the database
async function fetchApprovedApps() {
    const client = initSupabase();
    if (!client) return [];

    try {
        const { data, error } = await client
            .from('apps')
            .select('*')
            .in('status', ['approved', 'featured'])
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching apps:', error);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error('Failed to fetch apps:', err);
        return [];
    }
}

// Fetch a single app by slug
async function fetchAppBySlug(slug) {
    const client = initSupabase();
    if (!client) return null;

    try {
        const { data, error } = await client
            .from('apps')
            .select('*')
            .eq('slug', slug)
            .single();

        if (error) {
            console.error('Error fetching app:', error);
            return null;
        }

        return data;
    } catch (err) {
        console.error('Failed to fetch app:', err);
        return null;
    }
}

// Increment download count for an app
async function incrementDownloadCount(appId) {
    const client = initSupabase();
    if (!client) return;

    try {
        await client.rpc('increment_download_count', { app_id: appId });
    } catch (err) {
        console.error('Failed to increment download count:', err);
    }
}

// Export for use in apps.html
window.SuiteAppStore = {
    fetchApprovedApps,
    fetchAppBySlug,
    incrementDownloadCount
};
