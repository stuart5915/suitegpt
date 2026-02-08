// Inclawbate — Clawnch API Client
// All calls go through /api/inclawbate/clawnch-proxy (our serverless proxy)

const PROXY = '/api/inclawbate/clawnch-proxy';

class ClawnchClient {
    async getTokens({ offset = 0, limit = 48, search, sort } = {}) {
        const params = new URLSearchParams({ offset, limit });
        if (search) params.set('search', search);
        if (sort) params.set('sort', sort);
        const res = await fetch(`${PROXY}?${params}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
    }

    async getStats() {
        const res = await fetch(`${PROXY}?action=stats`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
    }

    // Get token data for public landing pages (through token-data proxy for CLAWS data)
    async getTokenPageData(ticker) {
        const res = await fetch(`/api/inclawbate/token-data?ticker=${ticker}`);
        if (!res.ok) throw new Error(`Token data error: ${res.status}`);
        return res.json();
    }
}

export const clawnch = new ClawnchClient();
export default clawnch;
