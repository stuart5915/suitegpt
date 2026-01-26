/**
 * SUITE Data Sync Module
 *
 * Enables offline-first data storage with cloud sync for logged-in users.
 * Used by SUITE apps to persist user data across devices.
 *
 * Usage:
 *   const sync = new SuiteDataSync('hydrotrack', 'hydrotrack-data');
 *   await sync.saveData({ logs: [...] });
 *   const data = await sync.loadData();
 */

class SuiteDataSync {
    constructor(appSlug, localStorageKey) {
        this.appSlug = appSlug;
        this.localStorageKey = localStorageKey;
        this.supabaseUrl = 'https://ooewnlpacianfnpwavmj.supabase.co';
        this.supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vZXdubHBhY2lhbmZucHdhdm1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI0NjcyMzMsImV4cCI6MjA0ODA0MzIzM30.yugJpC8cS9SFhRBNxeYwUKBzRFxeKShvWiHiJP4jgmg';
        this._supabase = null;
        this._userId = null;
        this._syncEnabled = null;
    }

    /**
     * Get or initialize Supabase client
     */
    async getSupabase() {
        if (this._supabase) return this._supabase;

        // Check if Supabase is available (from CDN or already loaded)
        if (typeof supabase !== 'undefined' && supabase.createClient) {
            this._supabase = supabase.createClient(this.supabaseUrl, this.supabaseAnonKey);
            return this._supabase;
        }

        // Try to load from parent window (if in iframe/shell)
        if (window.parent !== window && window.parent.supabase) {
            this._supabase = window.parent.supabase;
            return this._supabase;
        }

        // Supabase not available - will use localStorage only
        console.warn('[SuiteDataSync] Supabase not available, using localStorage only');
        return null;
    }

    /**
     * Get current user ID if logged in
     */
    async getUserId() {
        if (this._userId !== null) return this._userId;

        const supabase = await this.getSupabase();
        if (!supabase) {
            this._userId = false;
            return null;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            this._userId = user?.id || false;
            return user?.id || null;
        } catch (e) {
            console.warn('[SuiteDataSync] Could not get user:', e.message);
            this._userId = false;
            return null;
        }
    }

    /**
     * Check if user has cloud sync enabled
     */
    async isSyncEnabled() {
        if (this._syncEnabled !== null) return this._syncEnabled;

        const userId = await this.getUserId();
        if (!userId) {
            this._syncEnabled = false;
            return false;
        }

        const supabase = await this.getSupabase();
        if (!supabase) {
            this._syncEnabled = false;
            return false;
        }

        try {
            const { data, error } = await supabase
                .from('user_ai_settings')
                .select('data_sync_enabled')
                .eq('user_id', userId)
                .single();

            this._syncEnabled = data?.data_sync_enabled || false;
            return this._syncEnabled;
        } catch (e) {
            this._syncEnabled = false;
            return false;
        }
    }

    /**
     * Save data (always saves locally, syncs to cloud if enabled)
     */
    async saveData(data) {
        // Always save locally (offline-first)
        try {
            localStorage.setItem(this.localStorageKey, JSON.stringify(data));
        } catch (e) {
            console.warn('[SuiteDataSync] localStorage save failed:', e.message);
        }

        // Sync to cloud if user is logged in and has sync enabled
        const syncEnabled = await this.isSyncEnabled();
        if (syncEnabled) {
            await this.syncToCloud(data);
        }

        return data;
    }

    /**
     * Sync data to Supabase
     */
    async syncToCloud(data) {
        const userId = await this.getUserId();
        const supabase = await this.getSupabase();

        if (!userId || !supabase) return false;

        try {
            const { error } = await supabase.rpc('upsert_app_data', {
                p_user_id: userId,
                p_app_slug: this.appSlug,
                p_data: data
            });

            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[SuiteDataSync] Cloud sync failed:', e.message);
            return false;
        }
    }

    /**
     * Load data (tries cloud first if synced, falls back to localStorage)
     */
    async loadData() {
        const localData = this.loadLocalData();

        // If user has sync enabled, try to load from cloud
        const syncEnabled = await this.isSyncEnabled();
        if (syncEnabled) {
            const cloudData = await this.loadFromCloud();
            if (cloudData !== null) {
                // Cloud data is newer or exists - use it and update local
                localStorage.setItem(this.localStorageKey, JSON.stringify(cloudData));
                return cloudData;
            }
        }

        return localData;
    }

    /**
     * Load data from localStorage
     */
    loadLocalData() {
        try {
            const stored = localStorage.getItem(this.localStorageKey);
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            console.warn('[SuiteDataSync] localStorage load failed:', e.message);
            return {};
        }
    }

    /**
     * Load data from Supabase
     */
    async loadFromCloud() {
        const userId = await this.getUserId();
        const supabase = await this.getSupabase();

        if (!userId || !supabase) return null;

        try {
            const { data, error } = await supabase
                .from('user_app_data')
                .select('data')
                .eq('user_id', userId)
                .eq('app_slug', this.appSlug)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No data found - not an error
                    return null;
                }
                throw error;
            }

            return data?.data || null;
        } catch (e) {
            console.warn('[SuiteDataSync] Cloud load failed:', e.message);
            return null;
        }
    }

    /**
     * Clear all data for this app
     */
    async clearData() {
        localStorage.removeItem(this.localStorageKey);

        const userId = await this.getUserId();
        const supabase = await this.getSupabase();

        if (userId && supabase) {
            try {
                await supabase
                    .from('user_app_data')
                    .delete()
                    .eq('user_id', userId)
                    .eq('app_slug', this.appSlug);
            } catch (e) {
                console.warn('[SuiteDataSync] Cloud clear failed:', e.message);
            }
        }
    }

    /**
     * Force sync from local to cloud (useful for migration)
     */
    async forceSyncToCloud() {
        const localData = this.loadLocalData();
        if (Object.keys(localData).length > 0) {
            return await this.syncToCloud(localData);
        }
        return false;
    }

    /**
     * Reset cached state (call when user logs in/out)
     */
    resetCache() {
        this._userId = null;
        this._syncEnabled = null;
    }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SuiteDataSync;
}

// Make available globally for browser scripts
if (typeof window !== 'undefined') {
    window.SuiteDataSync = SuiteDataSync;
}
