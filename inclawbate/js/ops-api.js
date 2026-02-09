// Inclawbate — Ops Dashboard API Client
import { auth } from './auth.js';

const headers = () => auth.getHeaders();

export const opsApi = {
    async getMyTokens() {
        const res = await fetch('/api/inclawbate/my-tokens', { headers: headers() });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
    },

    async getBrandConfig(tokenAddress) {
        const res = await fetch(`/api/inclawbate/brand-config?token_address=${tokenAddress}`, { headers: headers() });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
    },

    async saveBrandConfig(config) {
        const res = await fetch('/api/inclawbate/brand-config', {
            method: 'PUT',
            headers: headers(),
            body: JSON.stringify(config)
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
    },

    async getPosts(tokenAddress, status) {
        let url = `/api/inclawbate/scheduled-posts?token_address=${tokenAddress}`;
        if (status) url += `&status=${status}`;
        const res = await fetch(url, { headers: headers() });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
    },

    async updatePost(postId, action, extra = {}) {
        const res = await fetch('/api/inclawbate/scheduled-posts', {
            method: 'PATCH',
            headers: headers(),
            body: JSON.stringify({ post_id: postId, action, ...extra })
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
    },

    async getActivityFeed(tokenAddress, limit = 30) {
        const res = await fetch(`/api/inclawbate/activity-feed?token_address=${tokenAddress}&limit=${limit}`, { headers: headers() });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
    }
};

export default opsApi;
