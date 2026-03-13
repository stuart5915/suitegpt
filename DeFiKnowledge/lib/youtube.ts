// YouTube Data API v3 Service
const YOUTUBE_API_KEY = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeVideo {
    id: string;
    title: string;
    creator: string;
    thumbnail: string;
    duration?: string;
    url: string;
    publishedAt: string;
}

interface YouTubeSearchResponse {
    items: Array<{
        id: { videoId: string };
        snippet: {
            title: string;
            channelTitle: string;
            thumbnails: {
                high?: { url: string };
                medium?: { url: string };
                default?: { url: string };
            };
            publishedAt: string;
        };
    }>;
    nextPageToken?: string;
}

// Search for DeFi-related videos
export async function searchYouTubeVideos(
    query: string = 'DeFi explained',
    pageToken?: string,
    maxResults: number = 10
): Promise<{ videos: YouTubeVideo[]; nextPageToken?: string }> {
    if (!YOUTUBE_API_KEY) {
        console.warn('YouTube API key not configured');
        return { videos: [] };
    }

    try {
        const params = new URLSearchParams({
            part: 'snippet',
            q: `${query} crypto blockchain`,
            type: 'video',
            maxResults: maxResults.toString(),
            order: 'relevance',
            videoDuration: 'medium', // 4-20 minutes (best for tutorials)
            safeSearch: 'strict',
            key: YOUTUBE_API_KEY,
        });

        if (pageToken) {
            params.append('pageToken', pageToken);
        }

        const response = await fetch(`${YOUTUBE_API_BASE}/search?${params}`);

        if (!response.ok) {
            console.error('YouTube API error:', response.status);
            return { videos: [] };
        }

        const data: YouTubeSearchResponse = await response.json();

        const videos: YouTubeVideo[] = data.items.map((item) => ({
            id: item.id.videoId,
            title: item.snippet.title,
            creator: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails.high?.url ||
                item.snippet.thumbnails.medium?.url ||
                item.snippet.thumbnails.default?.url || '',
            url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
            publishedAt: item.snippet.publishedAt,
        }));

        return {
            videos,
            nextPageToken: data.nextPageToken,
        };
    } catch (error) {
        console.error('Failed to fetch YouTube videos:', error);
        return { videos: [] };
    }
}

// Pre-defined search terms for DeFi content discovery
export const DEFI_SEARCH_TERMS = [
    'DeFi explained beginner',
    'cryptocurrency tutorial',
    'how DEX works',
    'liquidity pool explained',
    'yield farming tutorial',
    'crypto wallet security',
    'ethereum defi',
    'staking crypto explained',
];

// Get random search term for variety
export function getRandomSearchTerm(): string {
    return DEFI_SEARCH_TERMS[Math.floor(Math.random() * DEFI_SEARCH_TERMS.length)];
}
