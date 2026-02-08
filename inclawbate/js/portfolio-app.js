// Inclawbate — Portfolio Dashboard
import { clawnch } from './clawnch.js';
import { auth } from './auth.js';
import { formatNumber, formatUSD, formatETH, escapeHtml, shortenAddress } from './utils.js';

// ── DOM refs ──
const connectGate = document.getElementById('connectGate');
const portfolioContent = document.getElementById('portfolioContent');
const connectBtn = document.getElementById('connectBtn');
const connectGateBtn = document.getElementById('connectGateBtn');
const walletDisplay = document.getElementById('walletDisplay');
const summaryTokens = document.getElementById('summaryTokens');
const summaryFees = document.getElementById('summaryFees');
const tokenList = document.getElementById('tokenList');
const feesValue = document.getElementById('feesValue');

// ── Init ──
function init() {
    setupAuth();
    if (auth.isConnected) {
        showPortfolio();
    } else {
        showConnectGate();
    }
}

function setupAuth() {
    function handleConnect() {
        if (auth.isConnected) {
            auth.disconnect();
            showConnectGate();
            updateConnectBtn();
            return;
        }

        if (!window.ethereum) {
            connectBtn.textContent = 'No Wallet Found';
            connectBtn.classList.remove('btn-primary');
            connectBtn.classList.add('btn-danger');
            setTimeout(() => {
                connectBtn.textContent = 'Connect Wallet';
                connectBtn.classList.add('btn-primary');
                connectBtn.classList.remove('btn-danger');
            }, 2500);
            return;
        }

        connectBtn.textContent = 'Connecting...';
        connectBtn.disabled = true;
        auth.connect().then(() => {
            updateConnectBtn();
            showPortfolio();
        }).catch(err => {
            connectBtn.textContent = 'Connect Wallet';
            connectBtn.disabled = false;
        });
    }

    connectBtn.addEventListener('click', handleConnect);
    if (connectGateBtn) connectGateBtn.addEventListener('click', handleConnect);
    updateConnectBtn();
}

function updateConnectBtn() {
    if (auth.isConnected) {
        connectBtn.textContent = shortenAddress(auth.wallet);
        connectBtn.classList.remove('btn-primary');
        connectBtn.classList.add('btn-secondary');
    } else {
        connectBtn.textContent = 'Connect Wallet';
        connectBtn.classList.add('btn-primary');
        connectBtn.classList.remove('btn-secondary');
    }
    connectBtn.disabled = false;
}

// ── Views ──
function showConnectGate() {
    connectGate.classList.remove('hidden');
    portfolioContent.classList.add('hidden');
}

async function showPortfolio() {
    connectGate.classList.add('hidden');
    portfolioContent.classList.remove('hidden');
    walletDisplay.textContent = shortenAddress(auth.wallet);

    tokenList.innerHTML = '<div class="portfolio-loading"><div class="spinner spinner-lg"></div><p>Loading portfolio...</p></div>';

    try {
        const [analyticsRes, feesRes] = await Promise.all([
            clawnch.getAgentAnalytics(auth.wallet).catch(() => null),
            clawnch.getClaimableFees(auth.wallet).catch(() => null)
        ]);

        const analytics = analyticsRes?.data || analyticsRes || {};
        const tokens = analytics.tokens || [];
        const fees = feesRes?.data || feesRes || {};

        // Summary
        summaryTokens.textContent = tokens.length;
        const totalFees = fees.totalEarned || analytics.totalFeesEarned || 0;
        summaryFees.textContent = formatETH(totalFees);

        // Token list
        if (tokens.length === 0) {
            tokenList.innerHTML = `<div class="portfolio-loading"><p>No tokens found for this wallet</p></div>`;
        } else {
            tokenList.innerHTML = tokens.map(t => tokenRow(t)).join('');
        }

        // Claimable fees
        const claimable = fees.claimable || 0;
        feesValue.textContent = formatETH(claimable);

    } catch (err) {
        tokenList.innerHTML = `<div class="portfolio-loading"><p>Failed to load portfolio data</p></div>`;
    }
}

function tokenRow(t) {
    const ticker = escapeHtml(t.symbol || t.ticker || '???');
    const name = escapeHtml(t.name || ticker);
    const logo = t.logoUrl
        ? `<img src="${escapeHtml(t.logoUrl)}" alt="${ticker}" onerror="this.parentElement.textContent='${ticker.slice(0,2)}'">`
        : ticker.slice(0, 2);
    const price = t.price != null ? formatUSD(t.price) : '--';
    const mcap = t.marketCap != null ? '$' + formatNumber(t.marketCap) : '--';
    const vol = t.volume24h != null ? '$' + formatNumber(t.volume24h) : '--';
    const holders = t.holders != null ? formatNumber(t.holders) : '--';

    return `<a href="/tokens/${ticker}" class="portfolio-token-row">
        <div class="portfolio-token-identity">
            <div class="portfolio-token-logo">${logo}</div>
            <div>
                <div class="portfolio-token-name">${name}</div>
                <div class="portfolio-token-ticker">$${ticker}</div>
            </div>
        </div>
        <div class="portfolio-token-value">${price}</div>
        <div class="portfolio-token-value">${mcap}</div>
        <div class="portfolio-token-value">${vol}</div>
        <div class="portfolio-token-value">${holders} holders</div>
    </a>`;
}

// ── Boot ──
init();
