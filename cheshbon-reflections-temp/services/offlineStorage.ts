
import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'cheshbon_offline.db';
const CACHE_LIMIT = 50; // Keep only 50 most recent chapters

export interface CachedScripture {
    reference: string;
    text: string;
    versionId: string;
    timestamp: number;
}

let db: SQLite.SQLiteDatabase | null = null;

export const OfflineStorageService = {
    // Initialize Database (Native)
    async init() {
        if (Platform.OS === 'web') return; // Double check safety, though this file shouldn't load on web

        try {
            db = await SQLite.openDatabaseAsync(DB_NAME);
            await db.execAsync(`
                CREATE TABLE IF NOT EXISTS cached_scriptures (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    reference TEXT NOT NULL,
                    version_id TEXT NOT NULL,
                    content TEXT NOT NULL,
                    last_accessed INTEGER NOT NULL,
                    UNIQUE(reference, version_id)
                );
            `);
            // console.log('Offline DB initialized');
        } catch (e) {
            console.error('Failed to init offline DB:', e);
        }
    },

    // Get Scripture from Cache (Native)
    async getCachedScripture(reference: string, versionId: string = 'base'): Promise<CachedScripture | null> {
        try {
            if (!db) await this.init();
            if (!db) return null;

            const result = await db.getFirstAsync<{ content: string; last_accessed: number }>(
                'SELECT content, last_accessed FROM cached_scriptures WHERE reference = ? AND version_id = ?',
                [reference, versionId]
            );

            if (result) {
                // Update last accessed time asynchronously
                const now = Date.now();
                db.runAsync(
                    'UPDATE cached_scriptures SET last_accessed = ? WHERE reference = ? AND version_id = ?',
                    [now, reference, versionId]
                ).catch(e => console.warn('Failed to update cache access time', e));

                return {
                    reference,
                    versionId,
                    text: result.content,
                    timestamp: result.last_accessed
                };
            }
        } catch (e) {
            console.error('SQLite get error:', e);
        }
        return null;
    },

    // Save Scripture to Cache (Native)
    async saveCachedScripture(reference: string, text: string, versionId: string = 'base') {
        const now = Date.now();

        try {
            if (!db) await this.init();
            if (!db) return;

            await db.runAsync(
                `INSERT INTO cached_scriptures (reference, version_id, content, last_accessed)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(reference, version_id) DO UPDATE SET
                 content = excluded.content,
                 last_accessed = excluded.last_accessed`,
                [reference, versionId, text, now]
            );

            // Trigger cleanup
            this.pruneCache();
        } catch (e) {
            console.error('SQLite save error:', e);
        }
    },

    // Prune Cache (Native)
    async pruneCache() {
        if (!db) return;

        try {
            // Delete entries that are NOT in the top N most recently used
            await db.runAsync(`
                DELETE FROM cached_scriptures
                WHERE id NOT IN (
                    SELECT id FROM cached_scriptures
                    ORDER BY last_accessed DESC
                    LIMIT ?
                )
            `, [CACHE_LIMIT]);
        } catch (e) {
            console.error('Cache pruning error:', e);
        }
    },

    // Clear ALL cached scriptures (useful after API format change)
    async clearAllCache() {
        try {
            if (!db) await this.init();
            if (!db) return;

            await db.runAsync('DELETE FROM cached_scriptures');
            console.log('[OfflineStorage] All scripture cache cleared');
        } catch (e) {
            console.error('Cache clear error:', e);
        }
    }
};
