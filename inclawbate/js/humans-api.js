// Inclawbate — Human Profiles API Client

const API_BASE = '/api/inclawbate';

function authHeaders() {
    const token = localStorage.getItem('inclawbate_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

export const humansApi = {
    async listProfiles({ search, skill, availability, sort, offset, limit } = {}) {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (skill) params.set('skill', skill);
        if (availability) params.set('availability', availability);
        if (sort) params.set('sort', sort);
        if (offset) params.set('offset', offset);
        if (limit) params.set('limit', limit);

        const res = await fetch(`${API_BASE}/humans?${params}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
    },

    async getProfile(handle) {
        const res = await fetch(`${API_BASE}/humans?handle=${encodeURIComponent(handle)}`);
        if (!res.ok) {
            if (res.status === 404) return null;
            throw new Error(`API error: ${res.status}`);
        }
        return res.json();
    },

    async updateProfile(updates) {
        const res = await fetch(`${API_BASE}/humans`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(updates)
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `API error: ${res.status}`);
        }
        return res.json();
    }
};
