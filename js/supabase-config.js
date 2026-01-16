// SUITE App Store - Supabase Configuration
// This file provides the Supabase client for the app store

// Main SUITE Ecosystem Database (primary source for all apps)
const SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODk3MTgsImV4cCI6MjA4MzM2NTcxOH0.DcLpWs8Lf1s4Flf54J5LubokSYrd7h-XvI_X0jj6bLM';

// Make available globally for other scripts
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

// Initialize Supabase client (using CDN version for static HTML)
function initSupabase() {
    if (typeof supabase === 'undefined') {
        console.error('Supabase library not loaded. Add the CDN script to your HTML.');
        return null;
    }
    return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Fetch LIVE apps from apps table (approved/featured only - for public display)
async function fetchAllSuiteApps() {
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

// Get app stats for public display (only live apps)
async function fetchAppStats() {
    const client = initSupabase();
    if (!client) return { stats: { total: 0, published: 0 }, apps: [] };

    try {
        // Fetch only live apps (approved and featured)
        const { data, error } = await client
            .from('apps')
            .select('*')
            .in('status', ['approved', 'featured'])
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching apps:', error);
            return { stats: { total: 0, published: 0 }, apps: [] };
        }

        const apps = data || [];

        // All fetched apps are live/published
        const mappedApps = apps.map(app => ({
            ...app,
            displayStatus: 'published'
        }));

        const stats = {
            total: apps.length,
            published: apps.length
        };

        return { stats, apps: mappedApps };
    } catch (err) {
        console.error('Failed to fetch apps:', err);
        return { stats: { total: 0, published: 0 }, apps: [] };
    }
}

// Fetch approved apps from the OLD apps table (fallback)
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

// Fetch a single app by slug from apps table (alias for consistency)
async function fetchSuiteAppBySlug(slug) {
    // Just use fetchAppBySlug - all apps are in the apps table now
    return await fetchAppBySlug(slug);
}

// Fetch a single app by slug (old table, fallback)
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
    incrementDownloadCount,
    // New functions for suite_apps
    fetchAllSuiteApps,
    fetchAppStats,
    fetchSuiteAppBySlug
};
