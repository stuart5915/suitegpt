import Privy, { getUserEmbeddedEthereumWallet, LocalStorage } from '@privy-io/js-sdk-core';
import { base } from '@privy-io/chains';

const APP_ID = 'cmmnycsrr00du0dky2doq2bgl';
const CLIENT_ID = 'client-WY6Wux5jKR7waiKg7VZGX3PEv4Y33zpXnLaRBbMriDASx';
const CALLBACK_URL = window.location.origin + '/login-callback';

let privy = null;
let iframe = null;
let initialized = false;

function getPrivy() {
    if (privy) return privy;
    privy = new Privy({
        appId: APP_ID,
        clientId: CLIENT_ID,
        storage: new LocalStorage(),
        supportedChains: [base]
    });
    return privy;
}

async function ensureInit() {
    if (initialized) return;
    var p = getPrivy();
    // Create hidden iframe for embedded wallet
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.src = p.embeddedWallet.getURL();
        iframe.style.display = 'none';
        iframe.id = 'privy-iframe';
        document.body.appendChild(iframe);
        iframe.addEventListener('load', function() {
            try { p.setMessagePoster(iframe.contentWindow); } catch(e) {}
        });
        window.addEventListener('message', function(e) {
            try { if (p.embeddedWallet && p.embeddedWallet.onMessage) p.embeddedWallet.onMessage(e.data); } catch(e) {}
        });
    }
    try {
        await p.initialize();
    } catch(e) {
        console.log('[Privy] init error (non-fatal):', e.message);
    }
    initialized = true;
}

// Get embedded wallet address from a Privy user
function getWalletAddress(user) {
    var w = getUserEmbeddedEthereumWallet(user);
    return w ? w.address : null;
}

// Store Privy login info for nav/dashboard display
function storeLoginInfo(method, email) {
    localStorage.setItem('privy_login_info', JSON.stringify({ method: method, email: email || null }));
}

// Extract email from Privy user's linked accounts
function extractEmail(user) {
    if (!user || !user.linked_accounts) return null;
    for (var i = 0; i < user.linked_accounts.length; i++) {
        var a = user.linked_accounts[i];
        if (a.type === 'google_oauth' && a.email) return a.email;
        if (a.type === 'email' && a.address) return a.address;
    }
    return null;
}

// Authenticate with Inclawbate backend
async function authWithBackend(address) {
    var resp = await fetch('/api/inclawbate/wallet-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: address })
    });
    var data = await resp.json();
    if (!resp.ok || !data.success) throw new Error(data.error || 'Connection failed');
    localStorage.setItem('inclawbate_token', data.token);
    localStorage.setItem('inclawbate_profile', JSON.stringify(data.profile));
    document.cookie = 'inclawbate_token=' + encodeURIComponent(data.token) + '; path=/; max-age=2592000; SameSite=Lax';
    if (data.profile.api_key) {
        window.postMessage({ type: 'inclawbate-auth', apiKey: data.profile.api_key }, '*');
    }
    return data;
}

window.PrivyAuth = {
    // Email: send OTP code
    async sendEmailCode(email) {
        await ensureInit();
        return getPrivy().auth.email.sendCode(email);
    },

    // Email: verify code, create wallet, return address
    async verifyEmailCode(email, code) {
        await ensureInit();
        var p = getPrivy();
        var result = await p.auth.email.loginWithCode(email, code, 'login-or-sign-up', {
            embedded: { ethereum: { createOnLogin: 'users-without-wallets' } }
        });
        var user = result.user;
        var address = getWalletAddress(user);
        if (!address) {
            var created = await p.embeddedWallet.create({});
            user = created.user;
            address = getWalletAddress(user);
        }
        if (!address) throw new Error('Could not create embedded wallet');
        storeLoginInfo('email', email);
        await authWithBackend(address);
        return address;
    },

    // OAuth: redirect to Google
    async loginWithGoogle() {
        await ensureInit();
        localStorage.setItem('privy_return_url', window.location.href);
        var result = await getPrivy().auth.oauth.generateURL('google', CALLBACK_URL);
        window.location.href = result.url;
    },

    // OAuth: redirect to Apple
    async loginWithApple() {
        await ensureInit();
        localStorage.setItem('privy_return_url', window.location.href);
        var result = await getPrivy().auth.oauth.generateURL('apple', CALLBACK_URL);
        window.location.href = result.url;
    },

    // OAuth callback: exchange code for user
    async handleOAuthCallback() {
        await ensureInit();
        var params = new URLSearchParams(window.location.search);
        var authCode = params.get('privy_oauth_code');
        var stateCode = params.get('privy_oauth_state');
        var provider = params.get('privy_oauth_provider') || 'google';
        if (!authCode || !stateCode) throw new Error('Missing OAuth parameters');

        var p = getPrivy();
        var result = await p.auth.oauth.loginWithCode(authCode, stateCode, provider, undefined, 'login-or-sign-up', {
            embedded: { ethereum: { createOnLogin: 'users-without-wallets' } }
        });
        var user = result.user;
        var address = getWalletAddress(user);
        if (!address) {
            var created = await p.embeddedWallet.create({});
            user = created.user;
            address = getWalletAddress(user);
        }
        if (!address) throw new Error('Could not create embedded wallet');
        storeLoginInfo(provider, extractEmail(user));
        await authWithBackend(address);
        return address;
    },

    // Check for existing Privy session
    async getExistingSession() {
        try {
            await ensureInit();
            var result = await getPrivy().user.get();
            if (result && result.user) return getWalletAddress(result.user);
        } catch(e) {}
        return null;
    },

    // Get login info
    getLoginInfo() {
        try { return JSON.parse(localStorage.getItem('privy_login_info') || 'null'); } catch(e) { return null; }
    },

    // Logout
    async logout() {
        localStorage.removeItem('privy_login_info');
        try {
            if (privy) await privy.auth.logout();
        } catch(e) {}
    }
};
