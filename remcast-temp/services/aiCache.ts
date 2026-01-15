import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache keys
const TLDR_CACHE_KEY = '@ai_cache_tldr';
const NUANCE_CACHE_KEY = '@ai_cache_nuance';
const EXPANDED_TLDR_CACHE_KEY = '@ai_cache_expanded_tldr';

interface CachedContent {
    content: string;
    timestamp: number;
}

interface CachedNuance {
    prompts: { title: string; description: string }[];
    timestamp: number;
}

// Cache expiry: 30 days (in milliseconds)
const CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000;

/**
 * Get cached TL;DR for a scripture reference
 */
export async function getCachedTLDR(reference: string): Promise<string | null> {
    try {
        const cacheKey = `${TLDR_CACHE_KEY}_${reference}`;
        const cached = await AsyncStorage.getItem(cacheKey);
        if (!cached) return null;

        const parsed: CachedContent = JSON.parse(cached);

        // Check if cache is still valid
        if (Date.now() - parsed.timestamp > CACHE_EXPIRY) {
            await AsyncStorage.removeItem(cacheKey);
            return null;
        }

        return parsed.content;
    } catch (error) {
        console.error('Error reading TL;DR cache:', error);
        return null;
    }
}

/**
 * Save TL;DR to cache
 */
export async function cacheTLDR(reference: string, content: string): Promise<void> {
    try {
        const cacheKey = `${TLDR_CACHE_KEY}_${reference}`;
        const data: CachedContent = {
            content,
            timestamp: Date.now(),
        };
        await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (error) {
        console.error('Error saving TL;DR cache:', error);
    }
}

/**
 * Get cached expanded TL;DR
 */
export async function getCachedExpandedTLDR(reference: string): Promise<string | null> {
    try {
        const cacheKey = `${EXPANDED_TLDR_CACHE_KEY}_${reference}`;
        const cached = await AsyncStorage.getItem(cacheKey);
        if (!cached) return null;

        const parsed: CachedContent = JSON.parse(cached);

        if (Date.now() - parsed.timestamp > CACHE_EXPIRY) {
            await AsyncStorage.removeItem(cacheKey);
            return null;
        }

        return parsed.content;
    } catch (error) {
        console.error('Error reading expanded TL;DR cache:', error);
        return null;
    }
}

/**
 * Save expanded TL;DR to cache
 */
export async function cacheExpandedTLDR(reference: string, content: string): Promise<void> {
    try {
        const cacheKey = `${EXPANDED_TLDR_CACHE_KEY}_${reference}`;
        const data: CachedContent = {
            content,
            timestamp: Date.now(),
        };
        await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (error) {
        console.error('Error saving expanded TL;DR cache:', error);
    }
}

/**
 * Get cached nuance prompts
 */
export async function getCachedNuance(reference: string): Promise<{ title: string; description: string }[] | null> {
    try {
        const cacheKey = `${NUANCE_CACHE_KEY}_${reference}`;
        const cached = await AsyncStorage.getItem(cacheKey);
        if (!cached) return null;

        const parsed: CachedNuance = JSON.parse(cached);

        if (Date.now() - parsed.timestamp > CACHE_EXPIRY) {
            await AsyncStorage.removeItem(cacheKey);
            return null;
        }

        return parsed.prompts;
    } catch (error) {
        console.error('Error reading nuance cache:', error);
        return null;
    }
}

/**
 * Save nuance prompts to cache
 */
export async function cacheNuance(reference: string, prompts: { title: string; description: string }[]): Promise<void> {
    try {
        const cacheKey = `${NUANCE_CACHE_KEY}_${reference}`;
        const data: CachedNuance = {
            prompts,
            timestamp: Date.now(),
        };
        await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (error) {
        console.error('Error saving nuance cache:', error);
    }
}

/**
 * Clear all AI caches (for debugging/reset)
 */
export async function clearAllAICaches(): Promise<void> {
    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const cacheKeys = allKeys.filter(key =>
            key.startsWith(TLDR_CACHE_KEY) ||
            key.startsWith(NUANCE_CACHE_KEY) ||
            key.startsWith(EXPANDED_TLDR_CACHE_KEY)
        );
        await AsyncStorage.multiRemove(cacheKeys);
        console.log(`Cleared ${cacheKeys.length} AI cache entries`);
    } catch (error) {
        console.error('Error clearing AI caches:', error);
    }
}
