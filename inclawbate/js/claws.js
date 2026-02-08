// Inclawbate — CLAWS Memory API Client
// All CLAWS calls go through our API proxy (server adds auth)

const API_BASE = '/api/inclawbate';

class ClawsClient {
    constructor() {
        this.token = null;
    }

    setToken(token) {
        this.token = token;
    }

    _headers() {
        const h = { 'Content-Type': 'application/json' };
        if (this.token) h['Authorization'] = `Bearer ${this.token}`;
        return h;
    }

    // Store a project document in CLAWS
    async storeProject(project) {
        const res = await fetch(`${API_BASE}/projects`, {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify(project)
        });
        if (!res.ok) throw new Error(`Failed to create project: ${res.status}`);
        return res.json();
    }

    // Get full project state
    async getProject(projectId) {
        const res = await fetch(`${API_BASE}/project-status?projectId=${projectId}`, {
            headers: this._headers()
        });
        if (!res.ok) throw new Error(`Failed to get project: ${res.status}`);
        return res.json();
    }

    // Submit brand options
    async submitBrandOptions(projectId, options) {
        const res = await fetch(`${API_BASE}/brand-options`, {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify({ projectId, options })
        });
        if (!res.ok) throw new Error(`Failed to submit brand options: ${res.status}`);
        return res.json();
    }

    // Approve or reject a phase gate
    async approvePhase(projectId, phase, action, selectedOptionId, feedback) {
        const res = await fetch(`${API_BASE}/approve`, {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify({ projectId, phase, action, selectedOptionId, feedback })
        });
        if (!res.ok) throw new Error(`Failed to approve: ${res.status}`);
        return res.json();
    }

    // Stage a launch asset
    async stageAsset(projectId, assetType, content, metadata) {
        const res = await fetch(`${API_BASE}/assets`, {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify({ projectId, assetType, content, metadata })
        });
        if (!res.ok) throw new Error(`Failed to stage asset: ${res.status}`);
        return res.json();
    }

    // Trigger launch
    async triggerLaunch(projectId) {
        const res = await fetch(`${API_BASE}/launch`, {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify({ projectId })
        });
        if (!res.ok) throw new Error(`Failed to trigger launch: ${res.status}`);
        return res.json();
    }

    // Post-launch grow action
    async growAction(projectId, actionType, content) {
        const res = await fetch(`${API_BASE}/grow`, {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify({ projectId, actionType, content })
        });
        if (!res.ok) throw new Error(`Failed to submit grow action: ${res.status}`);
        return res.json();
    }

    // Create retrofit project
    async createRetrofit(tokenAddress, ticker, existingAssets) {
        const res = await fetch(`${API_BASE}/retrofit`, {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify({ tokenAddress, ticker, existingAssets })
        });
        if (!res.ok) throw new Error(`Failed to create retrofit: ${res.status}`);
        return res.json();
    }
}

export const claws = new ClawsClient();
export default claws;
