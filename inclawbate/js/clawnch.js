// Inclawbate — Clawnch API Client
// All calls proxied through /api/inclawbate/clawnch-proxy to avoid CORS

const PROXY = '/api/inclawbate/clawnch-proxy';

function proxyUrl(path, params = {}) {
    const p = new URLSearchParams({ path, ...params });
    return `${PROXY}?${p.toString()}`;
}

class ClawnchClient {
    async getTokens(params = {}) {
        const res = await fetch(proxyUrl('/tokens', params));
        if (!res.ok) throw new Error(`Clawnch API error: ${res.status}`);
        return res.json();
    }

    async getLaunches(params = {}) {
        const res = await fetch(proxyUrl('/launches', params));
        if (!res.ok) throw new Error(`Clawnch API error: ${res.status}`);
        return res.json();
    }

    async getStats() {
        const res = await fetch(proxyUrl('/stats'));
        if (!res.ok) throw new Error(`Clawnch API error: ${res.status}`);
        return res.json();
    }

    async getTokenAnalytics(tokenAddress) {
        const res = await fetch(proxyUrl('/analytics/token', { address: tokenAddress }));
        if (!res.ok) throw new Error(`Clawnch API error: ${res.status}`);
        return res.json();
    }

    async getAgentAnalytics(wallet) {
        const res = await fetch(proxyUrl('/analytics/agent', { wallet }));
        if (!res.ok) throw new Error(`Clawnch API error: ${res.status}`);
        return res.json();
    }

    async getLeaderboard(sort = 'marketCap', limit = 50) {
        const res = await fetch(proxyUrl('/analytics/leaderboard', { sort, limit }));
        if (!res.ok) throw new Error(`Clawnch API error: ${res.status}`);
        return res.json();
    }

    async getClaimableFees(wallet) {
        const res = await fetch(proxyUrl('/fees/available', { wallet }));
        if (!res.ok) throw new Error(`Clawnch API error: ${res.status}`);
        return res.json();
    }

    // Get token data for public landing pages (through our proxy for CLAWS data)
    async getTokenPageData(ticker) {
        const res = await fetch(`/api/inclawbate/token-data?ticker=${ticker}`);
        if (!res.ok) throw new Error(`Token data error: ${res.status}`);
        return res.json();
    }
}

export const clawnch = new ClawnchClient();
export default clawnch;
