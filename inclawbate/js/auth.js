// Inclawbate — Wallet Authentication
// Connects MetaMask (or other EVM wallets), signs challenge, gets JWT

const AUTH_ENDPOINT = '/api/inclawbate/auth-verify';
const STORAGE_KEY = 'inclawbate_auth';

class Auth {
    constructor() {
        this.wallet = null;
        this.token = null;
        this.expiresAt = null;
        this._restore();
    }

    get isConnected() {
        return this.wallet && this.token && this.expiresAt > Date.now();
    }

    _restore() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return;
            const data = JSON.parse(stored);
            if (data.expiresAt > Date.now()) {
                this.wallet = data.wallet;
                this.token = data.token;
                this.expiresAt = data.expiresAt;
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch {
            localStorage.removeItem(STORAGE_KEY);
        }
    }

    _save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            wallet: this.wallet,
            token: this.token,
            expiresAt: this.expiresAt
        }));
    }

    async connect() {
        if (!window.ethereum) {
            throw new Error('No wallet detected. Please install MetaMask or another EVM wallet.');
        }

        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (!accounts || accounts.length === 0) {
            throw new Error('No accounts available.');
        }

        const wallet = accounts[0].toLowerCase();
        const timestamp = Date.now();
        const message = `inclawbate-auth:${timestamp}`;

        // Sign the message
        const signature = await window.ethereum.request({
            method: 'personal_sign',
            params: [message, wallet]
        });

        // Verify with our API and get JWT
        const res = await fetch(AUTH_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wallet, message, signature, chain: 'evm' })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Authentication failed');
        }

        const data = await res.json();
        this.wallet = wallet;
        this.token = data.token;
        this.expiresAt = new Date(data.expiresAt).getTime();
        this._save();

        return { wallet: this.wallet, token: this.token };
    }

    disconnect() {
        this.wallet = null;
        this.token = null;
        this.expiresAt = null;
        localStorage.removeItem(STORAGE_KEY);
    }

    getHeaders() {
        const h = { 'Content-Type': 'application/json' };
        if (this.token) h['Authorization'] = `Bearer ${this.token}`;
        return h;
    }
}

export const auth = new Auth();
export default auth;
