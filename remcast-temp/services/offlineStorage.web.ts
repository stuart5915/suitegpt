
export interface CachedScripture {
    reference: string;
    text: string;
    versionId: string;
    timestamp: number;
}

export const OfflineStorageService = {
    // No-op for web initialization since localStorage is always available
    async init() { },

    // Get Scripture from Web LocalStorage
    async getCachedScripture(reference: string, versionId: string = 'base'): Promise<CachedScripture | null> {
        try {
            const key = `offline_scripture_${versionId}_${reference}`;
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.warn('Web cache error:', e);
            return null;
        }
    },

    // Save Scripture to Web LocalStorage
    async saveCachedScripture(reference: string, text: string, versionId: string = 'base') {
        try {
            const now = Date.now();
            const key = `offline_scripture_${versionId}_${reference}`;
            const data: CachedScripture = { reference, text, versionId, timestamp: now };
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.warn('Web save error:', e);
        }
    },

    // Web LocalStorage doesn't strictly need pruning for small text, but we could implement it if needed.
    // For now, no-op to match interface.
    async pruneCache() { }
};
