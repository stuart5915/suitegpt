// NewsData.io API for news with images
const NEWSDATA_API_KEY = process.env.EXPO_PUBLIC_NEWSDATA_API_KEY;
const NEWSDATA_BASE = 'https://newsdata.io/api/1/news';

export interface NewsArticle {
    id: string;
    title: string;
    source: string;
    url: string;
    publishedAt: string;
    domain: string;
    imageUrl?: string;
    description?: string;
}

interface NewsDataResponse {
    status: string;
    totalResults: number;
    results: Array<{
        article_id: string;
        title: string;
        link: string;
        source_id: string;
        source_name?: string;
        pubDate: string;
        source_url?: string;
        image_url?: string;
        description?: string;
    }>;
    nextPage?: string;
}

// Store for pagination and deduplication
let nextPageToken: string | null = null;
const seenArticleIds = new Set<string>();

// Reset seen articles (call when doing fresh search)
export function resetNewsState() {
    nextPageToken = null;
    seenArticleIds.clear();
}

// Curated fallback articles
const curatedArticles: NewsArticle[] = [
    { id: 'cur-1', title: 'What Is DeFi and How Does It Work?', source: 'Investopedia', url: 'https://www.investopedia.com/decentralized-finance-defi-5113835', publishedAt: new Date().toISOString(), domain: 'investopedia.com', imageUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400' },
    { id: 'cur-2', title: 'Beginner\'s Guide to Decentralized Finance', source: 'Binance Academy', url: 'https://academy.binance.com/en/articles/the-complete-beginners-guide-to-decentralized-finance-defi', publishedAt: new Date().toISOString(), domain: 'binance.com', imageUrl: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=400' },
    { id: 'cur-3', title: 'Understanding Crypto Wallets', source: 'Coinbase Learn', url: 'https://www.coinbase.com/learn/crypto-basics/what-is-a-crypto-wallet', publishedAt: new Date().toISOString(), domain: 'coinbase.com', imageUrl: 'https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=400' },
    { id: 'cur-4', title: 'What Are Gas Fees?', source: 'Ethereum.org', url: 'https://ethereum.org/en/developers/docs/gas/', publishedAt: new Date().toISOString(), domain: 'ethereum.org', imageUrl: 'https://images.unsplash.com/photo-1516245834210-c4c142787335?w=400' },
    { id: 'cur-5', title: 'What Is a DEX?', source: 'Binance Academy', url: 'https://academy.binance.com/en/articles/what-is-a-decentralized-exchange-dex', publishedAt: new Date().toISOString(), domain: 'binance.com', imageUrl: 'https://images.unsplash.com/photo-1642751227050-feb02d648136?w=400' },
    { id: 'cur-6', title: 'Liquidity Pools Explained', source: 'Binance Academy', url: 'https://academy.binance.com/en/articles/what-are-liquidity-pools-in-defi', publishedAt: new Date().toISOString(), domain: 'binance.com', imageUrl: 'https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?w=400' },
];

// Fetch latest news
export async function fetchCryptoNews(
    filter: string = 'hot',
    page: number = 1
): Promise<{ articles: NewsArticle[]; hasMore: boolean }> {
    if (!NEWSDATA_API_KEY) {
        console.warn('NewsData API key not configured - using fallback');
        return { articles: curatedArticles, hasMore: false };
    }

    try {
        let url: string;

        if (page === 1) {
            // Reset state for fresh search
            resetNewsState();
            url = `${NEWSDATA_BASE}?apikey=${NEWSDATA_API_KEY}&q=cryptocurrency%20OR%20bitcoin%20OR%20ethereum%20OR%20defi&language=en&image=1`;
        } else if (nextPageToken) {
            url = `${NEWSDATA_BASE}?apikey=${NEWSDATA_API_KEY}&q=cryptocurrency%20OR%20bitcoin%20OR%20ethereum%20OR%20defi&language=en&image=1&page=${nextPageToken}`;
        } else {
            return { articles: [], hasMore: false };
        }

        const response = await fetch(url);

        if (!response.ok) {
            console.warn('NewsData API error:', response.status);
            return { articles: curatedArticles, hasMore: false };
        }

        const data: NewsDataResponse = await response.json();

        if (data.status !== 'success' || !data.results) {
            return { articles: curatedArticles, hasMore: false };
        }

        nextPageToken = data.nextPage || null;

        // Filter and deduplicate
        const articles: NewsArticle[] = data.results
            .filter(item => {
                if (!item.title || !item.link) return false;
                if (seenArticleIds.has(item.article_id)) return false;
                seenArticleIds.add(item.article_id);
                return true;
            })
            .map(item => ({
                id: item.article_id || `news-${Date.now()}-${Math.random()}`,
                title: item.title,
                source: item.source_name || item.source_id || 'News',
                url: item.link,
                publishedAt: item.pubDate || new Date().toISOString(),
                domain: item.source_url ? new URL(item.source_url).hostname : item.source_id || 'news',
                imageUrl: item.image_url || undefined,
                description: item.description || undefined,
            }));

        return {
            articles,
            hasMore: !!data.nextPage,
        };
    } catch (error) {
        console.error('Failed to fetch news:', error);
        return { articles: curatedArticles, hasMore: false };
    }
}

// Get emoji based on source
export function getSourceEmoji(domain: string): string {
    const domainLower = domain.toLowerCase();
    const emojiMap: Record<string, string> = {
        'coindesk': '📰', 'cointelegraph': '📡', 'decrypt': '🔓',
        'theblock': '🧱', 'bitcoinmagazine': '₿', 'bankless': '🏦',
        'coinbase': '💰', 'binance': '🔶', 'investopedia': '📚',
        'cryptoslate': '💎', 'newsbtc': '📈', 'beincrypto': '🐝',
        'dailyhodl': '🗞️', 'yahoo': '📱', 'bloomberg': '📊',
        'reuters': '🌐', 'forbes': '💼', 'cnbc': '📺',
    };

    for (const [key, emoji] of Object.entries(emojiMap)) {
        if (domainLower.includes(key)) return emoji;
    }
    return '📄';
}

// Format relative time
export function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}
