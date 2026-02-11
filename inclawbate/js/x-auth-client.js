// Inclawbate — X OAuth 2.0 PKCE Client Helper

function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const arr = new Uint8Array(length);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => chars[b % chars.length]).join('');
}

async function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return await crypto.subtle.digest('SHA-256', data);
}

function base64urlEncode(buffer) {
    const bytes = new Uint8Array(buffer);
    let str = '';
    for (const b of bytes) str += String.fromCharCode(b);
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function startXAuth({ forceLogin = false } = {}) {
    const codeVerifier = generateRandomString(128);
    const challengeBuffer = await sha256(codeVerifier);
    const codeChallenge = base64urlEncode(challengeBuffer);
    const state = generateRandomString(32);

    sessionStorage.setItem('x_code_verifier', codeVerifier);
    sessionStorage.setItem('x_auth_state', state);

    let url = `/api/inclawbate/x-auth?code_challenge=${encodeURIComponent(codeChallenge)}&state=${encodeURIComponent(state)}`;
    if (forceLogin) url += '&force_login=true';
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || !data.url) {
        throw new Error(data.error || 'Failed to get auth URL');
    }

    window.location.href = data.url;
}

export async function handleXCallback(code, state) {
    const savedState = sessionStorage.getItem('x_auth_state');
    if (state && savedState && state !== savedState) {
        throw new Error('State mismatch — possible CSRF attack');
    }

    const codeVerifier = sessionStorage.getItem('x_code_verifier');
    if (!codeVerifier) {
        throw new Error('Missing code verifier — please try connecting again');
    }

    const res = await fetch('/api/inclawbate/x-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            code,
            code_verifier: codeVerifier,
            redirect_uri: 'https://inclawbate.com/launch'
        })
    });

    const data = await res.json();

    // Clean up
    sessionStorage.removeItem('x_code_verifier');
    sessionStorage.removeItem('x_auth_state');

    if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed');
    }

    // Store JWT
    localStorage.setItem('inclawbate_token', data.token);
    localStorage.setItem('inclawbate_profile', JSON.stringify(data.profile));

    return data;
}

export function getStoredAuth() {
    const token = localStorage.getItem('inclawbate_token');
    const profile = localStorage.getItem('inclawbate_profile');
    if (!token || !profile) return null;
    try {
        return { token, profile: JSON.parse(profile) };
    } catch {
        return null;
    }
}

export function logout() {
    localStorage.removeItem('inclawbate_token');
    localStorage.removeItem('inclawbate_profile');
}

export function isLoggedIn() {
    return !!localStorage.getItem('inclawbate_token');
}
