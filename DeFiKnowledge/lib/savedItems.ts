// Saved Items Store - for bookmarking videos and articles
import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVED_VIDEOS_KEY = 'saved_videos';
const SAVED_ARTICLES_KEY = 'saved_articles';

export interface SavedVideo {
    id: string;
    title: string;
    creator: string;
    thumbnail: string;
    url: string;
    savedAt: string;
}

export interface SavedArticle {
    id: string;
    title: string;
    source: string;
    emoji?: string;
    url: string;
    savedAt: string;
}

// Videos
export async function getSavedVideos(): Promise<SavedVideo[]> {
    try {
        const data = await AsyncStorage.getItem(SAVED_VIDEOS_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Failed to get saved videos:', e);
        return [];
    }
}

export async function saveVideo(video: Omit<SavedVideo, 'savedAt'>): Promise<void> {
    try {
        const saved = await getSavedVideos();
        // Don't add duplicates
        if (saved.some(v => v.id === video.id)) return;

        saved.unshift({ ...video, savedAt: new Date().toISOString() });
        await AsyncStorage.setItem(SAVED_VIDEOS_KEY, JSON.stringify(saved));
    } catch (e) {
        console.error('Failed to save video:', e);
    }
}

export async function unsaveVideo(videoId: string): Promise<void> {
    try {
        const saved = await getSavedVideos();
        const filtered = saved.filter(v => v.id !== videoId);
        await AsyncStorage.setItem(SAVED_VIDEOS_KEY, JSON.stringify(filtered));
    } catch (e) {
        console.error('Failed to unsave video:', e);
    }
}

export async function isVideoSaved(videoId: string): Promise<boolean> {
    const saved = await getSavedVideos();
    return saved.some(v => v.id === videoId);
}

// Articles
export async function getSavedArticles(): Promise<SavedArticle[]> {
    try {
        const data = await AsyncStorage.getItem(SAVED_ARTICLES_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Failed to get saved articles:', e);
        return [];
    }
}

export async function saveArticle(article: Omit<SavedArticle, 'savedAt'>): Promise<void> {
    try {
        const saved = await getSavedArticles();
        // Don't add duplicates
        if (saved.some(a => a.id === article.id)) return;

        saved.unshift({ ...article, savedAt: new Date().toISOString() });
        await AsyncStorage.setItem(SAVED_ARTICLES_KEY, JSON.stringify(saved));
    } catch (e) {
        console.error('Failed to save article:', e);
    }
}

export async function unsaveArticle(articleId: string): Promise<void> {
    try {
        const saved = await getSavedArticles();
        const filtered = saved.filter(a => a.id !== articleId);
        await AsyncStorage.setItem(SAVED_ARTICLES_KEY, JSON.stringify(filtered));
    } catch (e) {
        console.error('Failed to unsave article:', e);
    }
}

export async function isArticleSaved(articleId: string): Promise<boolean> {
    const saved = await getSavedArticles();
    return saved.some(a => a.id === articleId);
}
