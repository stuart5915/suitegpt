// SUITE App Store - Supabase Configuration
// This file provides the Supabase client for the app store

// App Store Database (original)
const SUPABASE_URL = 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODk3MTgsImV4cCI6MjA4MzM2NTcxOH0.DcLpWs8Lf1s4Flf54J5LubokSYrd7h-XvI_X0jj6bLM';

// Cadence Database (for suite_apps table with status tracking)
const CADENCE_SUPABASE_URL = 'https://tbfpopablanksrzyxaxj.supabase.co';
const CADENCE_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiZnBvcGFibGFua3Nyenl4YXhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNDcxMjAsImV4cCI6MjA4MjkyMzEyMH0.S6MPS-VOdwZ9_2L7Yb4fkOh_OT-Q1--t1ZSKy9hXatU';

// Initialize Supabase client (using CDN version for static HTML)
function initSupabase() {
    if (typeof supabase === 'undefined') {
        console.error('Supabase library not loaded. Add the CDN script to your HTML.');
        return null;
    }
    return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Initialize Cadence Supabase client
function initCadenceSupabase() {
    if (typeof supabase === 'undefined') {
        console.error('Supabase library not loaded. Add the CDN script to your HTML.');
        return null;
    }
    return supabase.createClient(CADENCE_SUPABASE_URL, CADENCE_SUPABASE_KEY);
}

// Fetch ALL apps from suite_apps table (primary source)
async function fetchAllSuiteApps() {
    const client = initCadenceSupabase();
    if (!client) return [];

    try {
        const { data, error } = await client
            .from('suite_apps')
            .select('*')
            .order('published_at', { ascending: false, nullsFirst: false });

        if (error) {
            console.error('Error fetching suite apps:', error);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error('Failed to fetch suite apps:', err);
        return [];
    }
}

// Get app status stats (Live, Development, Beta, etc.)
async function fetchAppStats() {
    const apps = await fetchAllSuiteApps();

    const stats = {
        total: apps.length,
        published: apps.filter(a => a.status === 'published').length,
        development: apps.filter(a => a.status === 'development').length,
        beta: apps.filter(a => a.status === 'beta').length,
        deprecated: apps.filter(a => a.status === 'deprecated').length
    };

    return { stats, apps };
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

// Fetch a single app by slug from suite_apps
async function fetchSuiteAppBySlug(slug) {
    const client = initCadenceSupabase();
    if (!client) return null;

    try {
        const { data, error } = await client
            .from('suite_apps')
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
