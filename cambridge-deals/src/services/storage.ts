// AsyncStorage wrapper for persistent data

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Deal, UserPreferences, WatchListItem } from '../types';
import { CAMBRIDGE_AREAS } from '../constants/categories';

const STORAGE_KEYS = {
    DEALS: '@cambridge_deals:deals',
    PREFERENCES: '@cambridge_deals:preferences',
    LAST_SYNC: '@cambridge_deals:last_sync',
    SAVED_SEARCHES: '@cambridge_deals:saved_searches',
};

// Default user preferences
const DEFAULT_PREFERENCES: UserPreferences = {
    notificationsEnabled: true,
    notificationTime: '09:00',
    preferredAreas: [CAMBRIDGE_AREAS.GALT, CAMBRIDGE_AREAS.PRESTON, CAMBRIDGE_AREAS.HESPELER],
    watchList: [],
};

// Deals
export async function getDeals(): Promise<Deal[]> {
    try {
        const json = await AsyncStorage.getItem(STORAGE_KEYS.DEALS);
        if (!json) return [];
        const deals = JSON.parse(json);
        // Convert date strings back to Date objects
        return deals.map((deal: any) => ({
            ...deal,
            createdAt: new Date(deal.createdAt),
            expiresAt: deal.expiresAt ? new Date(deal.expiresAt) : undefined,
        }));
    } catch (error) {
        console.error('Error loading deals:', error);
        return [];
    }
}

export async function saveDeals(deals: Deal[]): Promise<void> {
    try {
        await AsyncStorage.setItem(STORAGE_KEYS.DEALS, JSON.stringify(deals));
    } catch (error) {
        console.error('Error saving deals:', error);
        throw error;
    }
}

export async function addDeal(deal: Deal): Promise<void> {
    const deals = await getDeals();
    deals.unshift(deal); // Add to beginning
    await saveDeals(deals);
}

export async function removeDeal(dealId: string): Promise<void> {
    const deals = await getDeals();
    const filtered = deals.filter(d => d.id !== dealId);
    await saveDeals(filtered);
}

export async function updateDeal(dealId: string, updates: Partial<Deal>): Promise<void> {
    const deals = await getDeals();
    const index = deals.findIndex(d => d.id === dealId);
    if (index !== -1) {
        deals[index] = { ...deals[index], ...updates };
        await saveDeals(deals);
    }
}

// Preferences
export async function getPreferences(): Promise<UserPreferences> {
    try {
        const json = await AsyncStorage.getItem(STORAGE_KEYS.PREFERENCES);
        if (!json) return DEFAULT_PREFERENCES;
        return JSON.parse(json);
    } catch (error) {
        console.error('Error loading preferences:', error);
        return DEFAULT_PREFERENCES;
    }
}

export async function savePreferences(preferences: UserPreferences): Promise<void> {
    try {
        await AsyncStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(preferences));
    } catch (error) {
        console.error('Error saving preferences:', error);
        throw error;
    }
}

// Watch list helpers
export async function addToWatchList(item: WatchListItem): Promise<void> {
    const prefs = await getPreferences();
    prefs.watchList.push(item);
    await savePreferences(prefs);
}

export async function removeFromWatchList(itemId: string): Promise<void> {
    const prefs = await getPreferences();
    prefs.watchList = prefs.watchList.filter(item => item.id !== itemId);
    await savePreferences(prefs);
}

// Sync timestamp
export async function getLastSync(): Promise<Date | null> {
    try {
        const timestamp = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
        return timestamp ? new Date(timestamp) : null;
    } catch {
        return null;
    }
}

export async function setLastSync(date: Date): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, date.toISOString());
}

// Clear all data (for debugging/reset)
export async function clearAllData(): Promise<void> {
    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
}

// Saved Search type
export interface SavedSearch {
    id: string;
    query: string;
    maxPrice?: number;
    savedAt: Date;
    listings: any[]; // LiveListing type
}

// Get saved searches
export async function getSavedSearches(): Promise<SavedSearch[]> {
    try {
        const json = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_SEARCHES);
        if (!json) return [];
        const searches = JSON.parse(json);
        return searches.map((s: any) => ({
            ...s,
            savedAt: new Date(s.savedAt),
        }));
    } catch (error) {
        console.error('Error loading saved searches:', error);
        return [];
    }
}

// Save a search
export async function saveSearch(query: string, listings: any[], maxPrice?: number): Promise<void> {
    const searches = await getSavedSearches();
    const newSearch: SavedSearch = {
        id: `search_${Date.now()}`,
        query,
        maxPrice,
        savedAt: new Date(),
        listings,
    };
    searches.unshift(newSearch); // Add to beginning
    // Keep only last 20 saved searches
    const trimmed = searches.slice(0, 20);
    await AsyncStorage.setItem(STORAGE_KEYS.SAVED_SEARCHES, JSON.stringify(trimmed));
}

// Delete a saved search
export async function deleteSavedSearch(id: string): Promise<void> {
    const searches = await getSavedSearches();
    const filtered = searches.filter(s => s.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.SAVED_SEARCHES, JSON.stringify(filtered));
}
