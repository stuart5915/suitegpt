// Inclawbate — Portfolio Dashboard
import { clawnch } from './clawnch.js';
import { auth } from './auth.js';
import { escapeHtml, shortenAddress, timeAgo } from './utils.js';

// ── DOM refs ──
const connectGate = document.getElementById('connectGate');
const portfolioContent = document.getElementById('portfolioContent');
const connectBtn = document.getElementById('connectBtn');
const connectGateBtn = document.getElementById('connectGateBtn');
const walletDisplay = document.getElementById('walletDisplay');
const summaryTokens = document.getElementById('summaryTokens');
const tokenList = document.getElementById('tokenList');

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
        }).catch(() => {
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
        // Search for tokens deployed by this wallet
        const res = await clawnch.getTokens({ limit: 200 });
        const allTokens = res.tokens || [];
        const myTokens = allTokens.filter(t =>
            t.deployerWallet && t.deployerWallet.toLowerCase() === auth.wallet.toLowerCase()
        );

        summaryTokens.textContent = myTokens.length;

        if (myTokens.length === 0) {
            tokenList.innerHTML = `<div class="portfolio-loading">
                <p>No tokens found for this wallet.</p>
                <p style="font-size: 0.8rem; color: var(--text-dim); margin-top: var(--space-sm);">
                    Tokens you deploy on Clawnch will appear here.
                </p>
            </div>`;
        } else {
            tokenList.innerHTML = myTokens.map(tokenRow).join('');
        }

    } catch {
        tokenList.innerHTML = `<div class="portfolio-loading"><p>Failed to load portfolio data</p></div>`;
    }
}

function tokenRow(t) {
    const ticker = escapeHtml(t.symbol || '???');
    const name = escapeHtml(t.name || ticker);
    const source = escapeHtml(t.source || '');
    const age = t.launchedAt ? timeAgo(t.launchedAt) : '';

    return `<a href="/tokens/${ticker}" class="portfolio-token-row">
        <div class="portfolio-token-identity">
            <div class="portfolio-token-logo">${ticker.slice(0, 2)}</div>
            <div>
                <div class="portfolio-token-name">${name}</div>
                <div class="portfolio-token-ticker">$${ticker}</div>
            </div>
        </div>
        <div class="portfolio-token-value">${source}</div>
        <div class="portfolio-token-value">${age}</div>
    </a>`;
}

// ── Boot ──
init();
