// Inclawbate — Token Landing Page Controller
// Extracts ticker from URL, fetches token data, renders page

import { clawnch } from './clawnch.js';
import { formatNumber, formatUSD, shortenAddress, timeAgo } from './utils.js';

const SECTIONS = {
    loading: document.getElementById('tokenLoading'),
    notFound: document.getElementById('tokenNotFound'),
    page: document.getElementById('tokenPage')
};

function getTicker() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    // URL: /tokens/TICKER
    const idx = parts.indexOf('tokens');
    return idx >= 0 && parts[idx + 1] ? parts[idx + 1].toUpperCase() : null;
}

function showSection(name) {
    Object.values(SECTIONS).forEach(el => { if (el) el.classList.add('hidden'); });
    if (SECTIONS[name]) SECTIONS[name].classList.remove('hidden');
}

function applyColors(primary, secondary) {
    document.documentElement.style.setProperty('--token-primary', primary || '#8b5cf6');
    document.documentElement.style.setProperty('--token-secondary', secondary || '#06b6d4');
}

function renderPage(data) {
    const t = data.token || data;

    // Apply brand colors
    applyColors(t.colorPrimary, t.colorSecondary);

    // Update page title
    document.title = `${t.name} ($${t.ticker}) — Inclawbate`;

    // Logo
    const logoEl = document.getElementById('tokenLogo');
    if (t.logoUrl) {
        logoEl.innerHTML = `<img src="${t.logoUrl}" alt="${t.name}">`;
    } else {
        logoEl.textContent = t.ticker ? t.ticker[0] : '?';
    }

    // Basic info
    document.getElementById('tokenName').textContent = t.name || 'Unknown Token';
    document.getElementById('tokenTicker').textContent = `$${t.ticker}`;
    document.getElementById('tokenTagline').textContent = t.tagline || '';

    // Stats
    const analytics = t.analytics || {};
    document.getElementById('statPrice').textContent = analytics.price ? formatUSD(analytics.price) : '--';
    document.getElementById('statMcap').textContent = analytics.marketCap ? '$' + formatNumber(analytics.marketCap) : '--';
    document.getElementById('statHolders').textContent = analytics.holders ? formatNumber(analytics.holders) : '--';
    document.getElementById('statVolume24h').textContent = analytics.volume24h ? '$' + formatNumber(analytics.volume24h) : '--';

    // Narrative
    const narrativeEl = document.getElementById('tokenNarrative');
    if (t.narrative) {
        narrativeEl.textContent = t.narrative;
    } else {
        narrativeEl.parentElement.classList.add('hidden');
    }

    // Trade link
    const tradeLink = document.getElementById('tradeLink');
    if (t.tokenAddress) {
        tradeLink.href = `https://app.uniswap.org/swap?outputCurrency=${t.tokenAddress}&chain=base`;
    }

    // DexScreener link
    const dexLink = document.getElementById('dexLink');
    if (t.tokenAddress) {
        dexLink.href = `https://dexscreener.com/base/${t.tokenAddress}`;
    }

    // Contract address
    const contractEl = document.getElementById('tokenContract');
    if (t.tokenAddress) {
        contractEl.textContent = shortenAddress(t.tokenAddress, 8);
        contractEl.href = `https://basescan.org/token/${t.tokenAddress}`;
    }

    // Chart embed
    const chartEl = document.getElementById('tokenChart');
    if (t.tokenAddress) {
        chartEl.innerHTML = `<iframe src="https://dexscreener.com/base/${t.tokenAddress}?embed=1&theme=dark&trades=0&info=0" loading="lazy"></iframe>`;
    } else {
        chartEl.classList.add('hidden');
    }

    // Social links
    const socialsEl = document.getElementById('tokenSocials');
    const socialLinks = t.socialLinks || {};
    let socialsHtml = '';
    if (socialLinks.twitter) socialsHtml += `<a href="https://x.com/${socialLinks.twitter.replace('@','')}" target="_blank" rel="noopener" class="token-social-link">X / Twitter</a>`;
    if (socialLinks.farcaster) socialsHtml += `<a href="${socialLinks.farcaster}" target="_blank" rel="noopener" class="token-social-link">Farcaster</a>`;
    if (socialLinks.website) socialsHtml += `<a href="${socialLinks.website}" target="_blank" rel="noopener" class="token-social-link">Website</a>`;
    if (socialLinks.telegram) socialsHtml += `<a href="${socialLinks.telegram}" target="_blank" rel="noopener" class="token-social-link">Telegram</a>`;
    if (socialsHtml) {
        socialsEl.innerHTML = socialsHtml;
    } else {
        socialsEl.parentElement.classList.add('hidden');
    }

    // Launch date
    const dateEl = document.getElementById('tokenLaunchDate');
    if (t.launchedAt) {
        dateEl.textContent = `Launched ${timeAgo(t.launchedAt)}`;
    }

    showSection('page');
}

async function init() {
    const ticker = getTicker();
    if (!ticker) {
        showSection('notFound');
        return;
    }

    showSection('loading');

    try {
        const data = await clawnch.getTokenPageData(ticker);
        if (!data || !data.success) {
            showSection('notFound');
            return;
        }
        renderPage(data);
    } catch (err) {
        console.error('Failed to load token data:', err);
        showSection('notFound');
    }
}

init();
