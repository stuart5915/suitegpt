/**
 * SUITE SDK v1.0
 * Universal payment gate and wallet authentication for SUITE ecosystem apps
 * Include this script in any app: <script src="https://getsuite.app/js/suite-sdk.js"></script>
 */

(function () {
    'use strict';

    // ==========================================
    // CONFIGURATION
    // ==========================================
    const SUITE_CONFIG = {
        SUPABASE_URL: 'https://rdsmdywbdiskxknluiym.supabase.co',
        SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODk3MTgsImV4cCI6MjA4MzM2NTcxOH0.DcLpWs8Lf1s4Flf54J5LubokSYrd7h-XvI_X0jj6bLM',
        STRIPE_PUBLISH_KEY: '', // Add when ready
        AD_REWARD_CREDITS: 10, // Credits earned per ad watch
        // SuiteYieldVault contract (Base mainnet)
        VAULT_ADDRESS: '0x72d28EEA52ab54448f0A8CCEd2E3d224De759D42',
        VAULT_ABI: ['function userCredits(address) view returns (uint256)', 'function getSpendableCredits(address) view returns (uint256)'],
    };

    // Dynamically load ethers.js if needed
    let ethersLoaded = typeof ethers !== 'undefined';
    async function ensureEthers() {
        if (ethersLoaded || typeof ethers !== 'undefined') {
            ethersLoaded = true;
            return true;
        }
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/ethers@6.9.0/dist/ethers.umd.min.js';
            script.onload = () => { ethersLoaded = true; resolve(true); };
            script.onerror = () => resolve(false);
            document.head.appendChild(script);
        });
    }

    // ==========================================
    // STATE
    // ==========================================
    let currentWallet = null;
    let userCredits = 0;

    // ==========================================
    // STYLES (injected into page)
    // ==========================================
    const SUITE_STYLES = `
        .suite-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
        }
        .suite-modal-overlay.active {
            opacity: 1;
            visibility: visible;
        }
        .suite-modal {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border-radius: 24px;
            padding: 32px;
            max-width: 400px;
            width: 90%;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
            transform: scale(0.9);
            transition: transform 0.3s ease;
        }
        .suite-modal-overlay.active .suite-modal {
            transform: scale(1);
        }
        .suite-modal-header {
            text-align: center;
            margin-bottom: 24px;
        }
        .suite-modal-icon {
            font-size: 48px;
            margin-bottom: 12px;
        }
        .suite-modal-title {
            font-size: 1.5rem;
            font-weight: 800;
            color: white;
            margin-bottom: 8px;
        }
        .suite-modal-subtitle {
            font-size: 0.9rem;
            color: rgba(255, 255, 255, 0.6);
        }
        .suite-modal-feature {
            background: rgba(255, 149, 0, 0.1);
            border: 1px solid rgba(255, 149, 0, 0.3);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 20px;
            text-align: center;
        }
        .suite-modal-feature-name {
            font-size: 1rem;
            font-weight: 700;
            color: #ff9500;
        }
        .suite-modal-feature-cost {
            font-size: 0.85rem;
            color: rgba(255, 255, 255, 0.7);
            margin-top: 4px;
        }
        .suite-modal-options {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 20px;
        }
        .suite-option-btn {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 16px 20px;
            border-radius: 16px;
            border: 2px solid rgba(255, 255, 255, 0.1);
            background: rgba(255, 255, 255, 0.05);
            cursor: pointer;
            transition: all 0.2s;
            text-align: left;
        }
        .suite-option-btn:hover {
            border-color: rgba(255, 255, 255, 0.3);
            background: rgba(255, 255, 255, 0.1);
            transform: translateY(-2px);
        }
        .suite-option-btn.primary {
            border-color: #22c55e;
            background: rgba(34, 197, 94, 0.1);
        }
        .suite-option-btn.primary:hover {
            background: rgba(34, 197, 94, 0.2);
        }
        .suite-option-icon {
            font-size: 28px;
        }
        .suite-option-content {
            flex: 1;
        }
        .suite-option-title {
            font-size: 1rem;
            font-weight: 700;
            color: white;
            margin-bottom: 2px;
        }
        .suite-option-desc {
            font-size: 0.8rem;
            color: rgba(255, 255, 255, 0.6);
        }
        .suite-option-arrow {
            color: rgba(255, 255, 255, 0.4);
            font-size: 20px;
        }
        .suite-cancel-btn {
            width: 100%;
            padding: 14px;
            border-radius: 12px;
            border: none;
            background: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.7);
            font-size: 0.95rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .suite-cancel-btn:hover {
            background: rgba(255, 255, 255, 0.15);
        }
        .suite-credits-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: linear-gradient(135deg, #ff9500, #ff6b9d);
            color: white;
            padding: 6px 12px;
            border-radius: 100px;
            font-size: 0.8rem;
            font-weight: 700;
        }
        .suite-wallet-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: 100%;
            padding: 16px;
            border-radius: 16px;
            border: none;
            background: linear-gradient(135deg, #8b5cf6, #6366f1);
            color: white;
            font-size: 1rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
        }
        .suite-wallet-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(139, 92, 246, 0.4);
        }
        .suite-wallet-btn.connected {
            background: linear-gradient(135deg, #22c55e, #10b981);
        }
        
        /* Ad watching view */
        .suite-ad-container {
            background: #000;
            border-radius: 16px;
            aspect-ratio: 16/9;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 20px;
            position: relative;
            overflow: hidden;
        }
        .suite-ad-timer {
            position: absolute;
            top: 12px;
            right: 12px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 6px 12px;
            border-radius: 100px;
            font-size: 0.85rem;
            font-weight: 600;
        }
        .suite-ad-placeholder {
            color: rgba(255,255,255,0.5);
            text-align: center;
        }
    `;

    // ==========================================
    // INJECT STYLES
    // ==========================================
    function injectStyles() {
        if (document.getElementById('suite-sdk-styles')) return;
        const style = document.createElement('style');
        style.id = 'suite-sdk-styles';
        style.textContent = SUITE_STYLES;
        document.head.appendChild(style);
    }

    // ==========================================
    // WALLET CONNECTION
    // ==========================================
    async function connectWallet() {
        if (typeof window.ethereum === 'undefined') {
            // Show install prompt
            if (confirm('MetaMask required. Would you like to install it?')) {
                window.open('https://metamask.io/download/', '_blank');
            }
            return null;
        }

        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (accounts.length > 0) {
                currentWallet = accounts[0];
                localStorage.setItem('suiteWalletAddress', currentWallet);
                await loadUserCredits();
                return currentWallet;
            }
        } catch (error) {
            console.error('SUITE SDK: Wallet connection failed', error);
            return null;
        }
        return null;
    }

    function getWallet() {
        if (currentWallet) return currentWallet;
        currentWallet = localStorage.getItem('suiteWalletAddress');
        return currentWallet;
    }

    function disconnectWallet() {
        currentWallet = null;
        userCredits = 0;
        localStorage.removeItem('suiteWalletAddress');
    }

    // ==========================================
    // CREDITS MANAGEMENT
    // ==========================================
    async function loadUserCredits() {
        const wallet = getWallet();
        if (!wallet) return 0;

        try {
            // Load ethers if needed
            await ensureEthers();

            if (window.ethereum && typeof ethers !== 'undefined') {
                const provider = new ethers.BrowserProvider(window.ethereum);
                const vaultContract = new ethers.Contract(
                    SUITE_CONFIG.VAULT_ADDRESS,
                    SUITE_CONFIG.VAULT_ABI,
                    provider
                );

                // Get spendable credits (total - used)
                const creditsRaw = await vaultContract.getSpendableCredits(wallet);
                // Contract stores credits as (rawUSDC * 1000), divide by 1e6 for display
                userCredits = Math.floor(Number(creditsRaw) / 1e6);
                console.log('SUITE SDK: Credits loaded from contract:', userCredits);
                return userCredits;
            }
        } catch (error) {
            console.error('SUITE SDK: Failed to load credits from contract', error);
        }

        // Fallback to cached
        return userCredits || 0;
    }

    async function deductCredits(amount, featureName, appId) {
        const wallet = getWallet();
        if (!wallet) return false;

        // Check if user has enough credits first
        if (userCredits < amount) {
            console.error('SUITE SDK: Not enough credits');
            return false;
        }

        try {
            // Call Supabase Edge Function to deduct credits via admin contract call
            // The edge function will call useCredits() on the contract as admin
            const response = await fetch(
                `${SUITE_CONFIG.SUPABASE_URL}/functions/v1/deduct-credits`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${SUITE_CONFIG.SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        wallet: wallet.toLowerCase(),
                        amount: amount, // Display amount (will be converted to raw in function)
                        featureName: featureName,
                        appId: appId
                    })
                }
            );

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    userCredits -= amount;
                    console.log('SUITE SDK: Credits deducted:', amount, 'for', featureName);
                    return true;
                }
            }

            // If edge function not deployed yet, log for manual tracking
            console.warn('SUITE SDK: Edge function not available. Credits usage logged for manual processing.');

            // Record usage in Supabase for manual processing
            await fetch(`${SUITE_CONFIG.SUPABASE_URL}/rest/v1/credit_usage_log`, {
                method: 'POST',
                headers: {
                    'apikey': SUITE_CONFIG.SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUITE_CONFIG.SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    wallet_address: wallet.toLowerCase(),
                    amount: amount,
                    feature_name: featureName,
                    app_id: appId,
                    status: 'pending_contract_call'
                })
            });

            // For now, allow the feature (optimistic) - admin will sync later
            userCredits -= amount;
            return true;

        } catch (error) {
            console.error('SUITE SDK: Failed to deduct credits', error);
        }
        return false;
    }

    // ==========================================
    // PAYMENT GATE MODAL
    // ==========================================
    let paymentResolver = null;
    let currentPaymentConfig = null;

    function showPaymentGate(config) {
        return new Promise((resolve) => {
            paymentResolver = resolve;
            currentPaymentConfig = config;

            injectStyles();

            // Remove existing modal
            const existing = document.getElementById('suite-payment-modal');
            if (existing) existing.remove();

            const wallet = getWallet();
            const shortAddr = wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : null;

            const modal = document.createElement('div');
            modal.id = 'suite-payment-modal';
            modal.className = 'suite-modal-overlay';
            modal.innerHTML = `
                <div class="suite-modal">
                    <div class="suite-modal-header">
                        <div class="suite-modal-icon">✨</div>
                        <div class="suite-modal-title">Premium Feature</div>
                        <div class="suite-modal-subtitle">Choose how to unlock</div>
                    </div>
                    
                    <div class="suite-modal-feature">
                        <div class="suite-modal-feature-name">${config.featureName || 'AI Feature'}</div>
                        <div class="suite-modal-feature-cost">
                            ${config.creditCost || 10} credits • ~$${((config.creditCost || 10) * 0.01).toFixed(2)} USD
                        </div>
                    </div>

                    ${wallet ? `
                        <div style="text-align: center; margin-bottom: 16px;">
                            <span class="suite-credits-badge">🪙 ${userCredits} credits</span>
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.5); margin-top: 6px;">
                                Connected: ${shortAddr}
                            </div>
                        </div>
                    ` : ''}

                    <div class="suite-modal-options">
                        ${userCredits >= (config.creditCost || 10) ? `
                            <button class="suite-option-btn primary" onclick="SUITE._handlePaymentOption('credits')">
                                <span class="suite-option-icon">🪙</span>
                                <div class="suite-option-content">
                                    <div class="suite-option-title">Use Credits</div>
                                    <div class="suite-option-desc">Deduct ${config.creditCost || 10} from balance</div>
                                </div>
                                <span class="suite-option-arrow">→</span>
                            </button>
                        ` : ''}
                        
                        <button class="suite-option-btn" onclick="SUITE._handlePaymentOption('card')">
                            <span class="suite-option-icon">💳</span>
                            <div class="suite-option-content">
                                <div class="suite-option-title">Pay with Card</div>
                                <div class="suite-option-desc">One-time payment via Stripe</div>
                            </div>
                            <span class="suite-option-arrow">→</span>
                        </button>

                        <button class="suite-option-btn" onclick="SUITE._handlePaymentOption('crypto')">
                            <span class="suite-option-icon">💎</span>
                            <div class="suite-option-content">
                                <div class="suite-option-title">Pay with Crypto</div>
                                <div class="suite-option-desc">Send SUITE, ETH, or USDC</div>
                            </div>
                            <span class="suite-option-arrow">→</span>
                        </button>

                        <button class="suite-option-btn" onclick="SUITE._handlePaymentOption('ad')">
                            <span class="suite-option-icon">📺</span>
                            <div class="suite-option-content">
                                <div class="suite-option-title">Watch an Ad</div>
                                <div class="suite-option-desc">Free! Earn ${SUITE_CONFIG.AD_REWARD_CREDITS} credits</div>
                            </div>
                            <span class="suite-option-arrow">→</span>
                        </button>
                    </div>

                    ${!wallet ? `
                        <button class="suite-wallet-btn" onclick="SUITE._connectFromModal()">
                            🔗 Connect Wallet for Credits
                        </button>
                        <div style="text-align: center; margin-top: 12px;">
                            <span style="font-size: 0.75rem; color: rgba(255,255,255,0.5);">
                                Connect to use your SUITE credit balance
                            </span>
                        </div>
                    ` : ''}

                    <button class="suite-cancel-btn" onclick="SUITE._closePaymentModal(false)" style="margin-top: 16px;">
                        Cancel
                    </button>
                </div>
            `;

            document.body.appendChild(modal);

            // Trigger animation
            requestAnimationFrame(() => {
                modal.classList.add('active');
            });

            // Close on overlay click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closePaymentModal(false);
                }
            });
        });
    }

    async function handlePaymentOption(option) {
        const modal = document.getElementById('suite-payment-modal');

        switch (option) {
            case 'credits':
                const success = await deductCredits(
                    currentPaymentConfig.creditCost || 10,
                    currentPaymentConfig.featureName,
                    currentPaymentConfig.appId
                );
                closePaymentModal(success);
                break;

            case 'card':
                // TODO: Integrate Stripe
                alert('Card payments coming soon! Please use another option.');
                break;

            case 'crypto':
                // TODO: Integrate crypto payments
                alert('Crypto payments coming soon! Please use another option.');
                break;

            case 'ad':
                // Show ad watching view
                showAdView();
                break;
        }
    }

    function showAdView() {
        const modal = document.querySelector('#suite-payment-modal .suite-modal');
        if (!modal) return;

        modal.innerHTML = `
            <div class="suite-modal-header">
                <div class="suite-modal-icon">📺</div>
                <div class="suite-modal-title">Watch to Earn</div>
                <div class="suite-modal-subtitle">Earn ${SUITE_CONFIG.AD_REWARD_CREDITS} credits</div>
            </div>

            <div class="suite-ad-container">
                <div class="suite-ad-timer" id="suiteAdTimer">0:30</div>
                <div class="suite-ad-placeholder">
                    <div style="font-size: 48px; margin-bottom: 12px;">📺</div>
                    <div>Ad loading...</div>
                </div>
            </div>

            <button class="suite-cancel-btn" onclick="SUITE._closePaymentModal(false)">
                Cancel
            </button>
        `;

        // Simulate ad timer (30 seconds)
        let seconds = 30;
        const timer = setInterval(() => {
            seconds--;
            const timerEl = document.getElementById('suiteAdTimer');
            if (timerEl) {
                timerEl.textContent = `0:${seconds.toString().padStart(2, '0')}`;
            }
            if (seconds <= 0) {
                clearInterval(timer);
                // Award credits and close
                userCredits += SUITE_CONFIG.AD_REWARD_CREDITS;
                // TODO: Record ad watch in Supabase
                closePaymentModal(true);
            }
        }, 1000);
    }

    async function connectFromModal() {
        const wallet = await connectWallet();
        if (wallet) {
            // Refresh modal with wallet connected
            closePaymentModal(false);
            showPaymentGate(currentPaymentConfig);
        }
    }

    function closePaymentModal(success) {
        const modal = document.getElementById('suite-payment-modal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }
        if (paymentResolver) {
            paymentResolver({ success, credits: userCredits });
            paymentResolver = null;
        }
    }

    // ==========================================
    // QUICK AUTH CHECK
    // ==========================================
    async function requireWallet() {
        let wallet = getWallet();
        if (!wallet) {
            wallet = await connectWallet();
        }
        return wallet;
    }

    // ==========================================
    // PUBLIC API
    // ==========================================
    window.SUITE = {
        // Wallet
        connect: connectWallet,
        disconnect: disconnectWallet,
        getWallet: getWallet,
        requireWallet: requireWallet,

        // Credits
        getCredits: () => userCredits,
        loadCredits: loadUserCredits,

        // Payment Gate
        pay: showPaymentGate,

        // Internal handlers (called from modal HTML)
        _handlePaymentOption: handlePaymentOption,
        _closePaymentModal: closePaymentModal,
        _connectFromModal: connectFromModal,

        // Config
        config: SUITE_CONFIG,

        // Version
        version: '1.0.0'
    };

    // Auto-init: Load wallet from localStorage
    (async () => {
        const savedWallet = localStorage.getItem('suiteWalletAddress');
        if (savedWallet) {
            currentWallet = savedWallet;
            await loadUserCredits();
        }
        console.log('✨ SUITE SDK v1.0.0 loaded');
    })();

})();
