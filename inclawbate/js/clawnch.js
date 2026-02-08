// Inclawbate — Clawnch API Client
// Public endpoints called directly; authenticated calls proxied through our API

const CLAWNCH_BASE = 'https://clawn.ch/api';

class ClawnchClient {
    async getTokens(params = {}) {
        const qs = new URLSearchParams(params).toString();
        const res = await fetch(`${CLAWNCH_BASE}/tokens${qs ? '?' + qs : ''}`);
        if (!res.ok) throw new Error(`Clawnch API error: ${res.status}`);
        return res.json();
    }

    async getLaunches(params = {}) {
        const qs = new URLSearchParams(params).toString();
        const res = await fetch(`${CLAWNCH_BASE}/launches${qs ? '?' + qs : ''}`);
        if (!res.ok) throw new Error(`Clawnch API error: ${res.status}`);
        return res.json();
    }

    async getStats() {
        const res = await fetch(`${CLAWNCH_BASE}/stats`);
        if (!res.ok) throw new Error(`Clawnch API error: ${res.status}`);
        return res.json();
    }

    async getTokenAnalytics(tokenAddress) {
        const res = await fetch(`${CLAWNCH_BASE}/analytics/token?address=${tokenAddress}`);
        if (!res.ok) throw new Error(`Clawnch API error: ${res.status}`);
        return res.json();
    }

    async getAgentAnalytics(wallet) {
        const res = await fetch(`${CLAWNCH_BASE}/analytics/agent?wallet=${wallet}`);
        if (!res.ok) throw new Error(`Clawnch API error: ${res.status}`);
        return res.json();
    }

    async getLeaderboard(sort = 'marketCap', limit = 50) {
        const res = await fetch(`${CLAWNCH_BASE}/analytics/leaderboard?sort=${sort}&limit=${limit}`);
        if (!res.ok) throw new Error(`Clawnch API error: ${res.status}`);
        return res.json();
    }

    async getClaimableFees(wallet) {
        const res = await fetch(`${CLAWNCH_BASE}/fees/available?wallet=${wallet}`);
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
