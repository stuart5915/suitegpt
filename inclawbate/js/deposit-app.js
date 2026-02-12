// Inclawbate — Deposit Page Logic
(function () {
    'use strict';

    const CLAWNCH_ADDRESS = '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be';
    const PROTOCOL_WALLET = '0x91B5C0D07859CFeAfEB67d9694121CD741F049bd';
    const CLAWNCH_PER_CREDIT = 50;
    const BASE_CHAIN_ID = '0x2105';

    let jwt = null;
    let connectedAccount = null;
    let provider = null;
    let clawnchPrice = 0; // USD per CLAWNCH

    // ── Init ──
    const stored = localStorage.getItem('inclawbate_token');
    if (stored) {
        try {
            const parts = stored.split('.');
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            if (payload.exp && payload.exp > Date.now() / 1000) {
                jwt = stored;
            }
        } catch (e) { /* expired or invalid */ }
    }

    if (jwt) {
        document.getElementById('depositUI').classList.remove('hidden');
        document.getElementById('loginGate').classList.add('hidden');
    } else {
        document.getElementById('loginGate').classList.remove('hidden');
        document.getElementById('depositUI').classList.add('hidden');
    }

    // Reveal body
    document.body.style.opacity = '1';

    // ── Fetch CLAWNCH price ──
    async function fetchPrice() {
        try {
            const resp = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + CLAWNCH_ADDRESS);
            const data = await resp.json();
            if (data.pairs && data.pairs.length > 0) {
                clawnchPrice = parseFloat(data.pairs[0].priceUsd) || 0;
            }
        } catch (e) {
            console.warn('Could not fetch CLAWNCH price:', e);
        }
        updateEstimates();
    }
    fetchPrice();

    // ── Amount input + presets ──
    const amountInput = document.getElementById('amountInput');
    const usdEstimate = document.getElementById('usdEstimate');
    const creditsEstimate = document.getElementById('creditsEstimate');
    const depositBtn = document.getElementById('depositBtn');

    function updateEstimates() {
        const amount = parseInt(amountInput.value) || 0;
        const credits = Math.floor(amount / CLAWNCH_PER_CREDIT);

        if (amount > 0 && clawnchPrice > 0) {
            usdEstimate.textContent = '$' + (amount * clawnchPrice).toFixed(2);
        } else if (amount > 0) {
            usdEstimate.textContent = '(price unavailable)';
        } else {
            usdEstimate.textContent = '\u2014';
        }

        creditsEstimate.textContent = credits > 0 ? credits.toLocaleString() + ' replies' : '\u2014';
        depositBtn.disabled = !(connectedAccount && credits > 0);
    }

    amountInput.addEventListener('input', updateEstimates);

    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            amountInput.value = btn.dataset.amount;
            updateEstimates();
        });
    });

    // ── Wallet connect ──
    function getProvider() {
        if (window.ethereum) return window.ethereum;
        return null;
    }

    document.getElementById('connectWalletBtn').addEventListener('click', connectWallet);

    async function connectWallet() {
        const p = getProvider();
        if (!p) {
            showError('No wallet detected. Install MetaMask or Coinbase Wallet.');
            return;
        }
        provider = p;

        try {
            const accounts = await provider.request({ method: 'eth_requestAccounts' });
            connectedAccount = accounts[0];

            // Switch to Base
            try {
                await provider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: BASE_CHAIN_ID }]
                });
            } catch (switchErr) {
                if (switchErr.code === 4902) {
                    await provider.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: BASE_CHAIN_ID,
                            chainName: 'Base',
                            rpcUrls: ['https://mainnet.base.org'],
                            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                            blockExplorerUrls: ['https://basescan.org']
                        }]
                    });
                } else {
                    throw switchErr;
                }
            }

            // Show connected state
            document.getElementById('walletSection').classList.add('hidden');
            document.getElementById('walletConnected').classList.remove('hidden');
            document.getElementById('walletAddr').textContent =
                connectedAccount.slice(0, 6) + '...' + connectedAccount.slice(-4);
            updateEstimates();
        } catch (err) {
            if (err.code !== 4001) {
                showError('Wallet connection failed: ' + (err.message || 'Unknown error'));
            }
        }
    }

    document.getElementById('disconnectWalletBtn').addEventListener('click', () => {
        connectedAccount = null;
        provider = null;
        document.getElementById('walletSection').classList.remove('hidden');
        document.getElementById('walletConnected').classList.add('hidden');
        updateEstimates();
    });

    // ── Deposit flow ──
    depositBtn.addEventListener('click', executeDeposit);

    async function executeDeposit() {
        const amount = parseInt(amountInput.value) || 0;
        const credits = Math.floor(amount / CLAWNCH_PER_CREDIT);
        if (!connectedAccount || !provider || credits <= 0) return;

        hideError();
        showStep('progress');
        setProgress('Confirm in your wallet...', '');

        try {
            // Build ERC-20 transfer calldata
            const amountWei = BigInt(Math.floor(amount)) * BigInt('1000000000000000000');
            const transferData = '0xa9059cbb' +
                PROTOCOL_WALLET.slice(2).toLowerCase().padStart(64, '0') +
                amountWei.toString(16).padStart(64, '0');

            const txHash = await provider.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: connectedAccount,
                    to: CLAWNCH_ADDRESS,
                    data: transferData
                }]
            });

            setProgress('Waiting for confirmation...', txHash.slice(0, 10) + '...');

            // Wait for receipt
            const receipt = await waitForReceipt(provider, txHash);
            if (!receipt || receipt.status === '0x0') {
                showStep('form');
                showError('Transaction failed on-chain. Please try again.');
                return;
            }

            setProgress('Adding credits to your account...', '');

            // Call deposit API
            const resp = await fetch('/api/inclawbate/credits', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + jwt
                },
                body: JSON.stringify({ action: 'deposit', tx_hash: txHash })
            });

            const data = await resp.json();

            if (!resp.ok) {
                showStep('form');
                showError(data.error || 'Failed to credit deposit');
                return;
            }

            // Success
            document.getElementById('successCredits').textContent = '+' + data.credits_added;
            document.getElementById('successDetail').textContent =
                Math.floor(data.clawnch_deposited).toLocaleString() + ' CLAWNCH deposited \u00B7 ' +
                data.credits_total + ' total credits';
            document.getElementById('txLink').href = 'https://basescan.org/tx/' + txHash;
            showStep('success');

        } catch (err) {
            showStep('form');
            if (err.code !== 4001) {
                showError('Deposit failed: ' + (err.message || 'Unknown error'));
            }
        }
    }

    async function waitForReceipt(p, txHash, maxAttempts = 30) {
        for (let i = 0; i < maxAttempts; i++) {
            const receipt = await p.request({
                method: 'eth_getTransactionReceipt',
                params: [txHash]
            });
            if (receipt) return receipt;
            await new Promise(r => setTimeout(r, 2000));
        }
        return null;
    }

    // ── Deposit again ──
    document.getElementById('depositAgainBtn').addEventListener('click', () => {
        amountInput.value = '';
        updateEstimates();
        showStep('form');
    });

    // ── UI helpers ──
    function showStep(step) {
        document.getElementById('stepForm').classList.toggle('hidden', step !== 'form');
        document.getElementById('stepProgress').classList.toggle('hidden', step !== 'progress');
        document.getElementById('stepSuccess').classList.toggle('hidden', step !== 'success');
    }

    function setProgress(text, sub) {
        document.getElementById('progressText').textContent = text;
        document.getElementById('progressSub').textContent = sub;
    }

    function showError(msg) {
        const box = document.getElementById('errorBox');
        box.textContent = msg;
        box.classList.remove('hidden');
    }

    function hideError() {
        document.getElementById('errorBox').classList.add('hidden');
    }
})();
