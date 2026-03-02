// CLAWS SDK — auto-injected into every app served by Inclawbate
// Exposes window.CLAWS for web3 superpowers: pay, balance, tipCreator, gate
(function() {
    'use strict';

    var CLAWS_ADDRESS = '0x7ca47B141639B893C6782823C0b219f872056379';
    var CLAWS_DECIMALS = 18;
    var CHAIN_ID = '0x2105'; // Base (8453)

    // Read creator wallet from the script tag's data attribute
    var scriptTag = document.currentScript || document.querySelector('script[data-creator-wallet]');
    var creatorWallet = scriptTag ? scriptTag.getAttribute('data-creator-wallet') : null;
    var appId = scriptTag ? scriptTag.getAttribute('data-app-id') : null;

    // ERC20 transfer ABI: transfer(address,uint256)
    var TRANSFER_SIG = '0xa9059cbb';

    function toHex(n) {
        return '0x' + BigInt(n).toString(16);
    }

    function toWei(amount) {
        return BigInt(Math.floor(amount * 1e8)) * BigInt(1e10);
    }

    function padAddress(addr) {
        return '0x' + addr.replace('0x', '').toLowerCase().padStart(64, '0');
    }

    function padUint256(val) {
        return '0x' + val.toString(16).padStart(64, '0');
    }

    async function ensureBase() {
        if (!window.ethereum) throw new Error('No wallet detected');
        var chainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (chainId !== CHAIN_ID) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: CHAIN_ID }]
                });
            } catch (e) {
                if (e.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: CHAIN_ID,
                            chainName: 'Base',
                            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                            rpcUrls: ['https://mainnet.base.org'],
                            blockExplorerUrls: ['https://basescan.org']
                        }]
                    });
                } else {
                    throw e;
                }
            }
        }
    }

    async function getAccount() {
        var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        return accounts[0];
    }

    // ── pay(amount, recipient) — initiate CLAWS ERC20 transfer ──
    async function pay(amount, recipient) {
        if (!window.ethereum) throw new Error('No wallet detected. Install MetaMask.');
        if (!recipient) throw new Error('Recipient address required');
        if (!amount || amount <= 0) throw new Error('Amount must be positive');

        await ensureBase();
        var from = await getAccount();
        var wei = toWei(amount);

        var data = TRANSFER_SIG +
            padAddress(recipient).slice(2) +
            padUint256(wei).slice(2);

        var txHash = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{
                from: from,
                to: CLAWS_ADDRESS,
                data: data
            }]
        });

        return txHash;
    }

    // ── balance() — check user's CLAWS balance ──
    async function balance() {
        if (!window.ethereum) return 0;
        var account = await getAccount();

        // balanceOf(address) = 0x70a08231
        var data = '0x70a08231' + padAddress(account).slice(2);

        var result = await window.ethereum.request({
            method: 'eth_call',
            params: [{ to: CLAWS_ADDRESS, data: data }, 'latest']
        });

        return Number(BigInt(result)) / Math.pow(10, CLAWS_DECIMALS);
    }

    // ── tipCreator(amount) — tip the app's creator ──
    async function tipCreator(amount) {
        if (!creatorWallet) throw new Error('No creator wallet configured for this app');
        return pay(amount || 10, creatorWallet);
    }

    // ── gate(amount, callback) — paywall a feature ──
    async function gate(amount, callback) {
        if (!amount || amount <= 0) throw new Error('Gate amount required');
        if (typeof callback !== 'function') throw new Error('Callback function required');

        try {
            var txHash = await pay(amount, creatorWallet || await getAccount());
            callback(null, txHash);
        } catch (e) {
            callback(e, null);
        }
    }

    // ── Expose ──
    window.CLAWS = {
        pay: pay,
        balance: balance,
        tipCreator: tipCreator,
        gate: gate,
        address: CLAWS_ADDRESS,
        creatorWallet: creatorWallet,
        appId: appId
    };
})();
