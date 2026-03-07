// Angel NFT Airdrop Tool — Inclawbate
// Airdrop any ERC-20 token to all Angel NFT holders via Disperse.app

(function() {
    'use strict';

    // ── Addresses ──
    var ANGEL_NFT = '0x14d44d4d9f7898be1b9e1184a116502061eff5e7';
    var DISPERSE = '0xD152f549545093347A162Dce210e7293f1452150';
    var BASE_CHAIN_ID = '0x2105';
    var RPC_URLS = ['https://base.drpc.org', 'https://mainnet.base.org', 'https://base.llamarpc.com'];

    // ── Function selectors ──
    var SEL_TOTAL_MINTED = '0xa2309ff8';      // totalMinted()
    var SEL_OWNER_OF = '0x6352211e';          // ownerOf(uint256)
    var SEL_NAME = '0x06fdde03';              // name()
    var SEL_SYMBOL = '0x95d89b41';            // symbol()
    var SEL_DECIMALS = '0x313ce567';          // decimals()
    var SEL_BALANCE_OF = '0x70a08231';        // balanceOf(address)
    var SEL_ALLOWANCE = '0xdd62ed3e';         // allowance(address,address)
    var SEL_APPROVE = '0x095ea7b3';           // approve(address,uint256)
    // disperseToken(address,address[],uint256[])
    var SEL_DISPERSE_TOKEN = '0xc73a2d60';

    var MAX_UINT256 = '0x' + 'f'.repeat(64);

    var API_BASE = 'https://www.inclawbate.com/api/inclawbate';

    // ── State ──
    var state = {
        provider: null,
        account: null,
        holders: [],
        myTokens: [],         // from inclawbator_projects
        tokenAddr: null,
        tokenName: '',
        tokenSymbol: '',
        tokenDecimals: 18,
        tokenBalance: BigInt(0),
        mode: 'per-holder',   // 'per-holder' or 'total-split'
        initialized: false,
        rpcIndex: 0
    };

    // ── Helpers ──
    function pad32(hex) {
        return hex.replace('0x', '').padStart(64, '0');
    }

    function safeHex(v) { return (!v || v === '0x') ? '0x0' : v; }

    function decodeString(hex) {
        if (!hex || hex === '0x' || hex.length < 130) return '';
        try {
            var offset = parseInt(hex.slice(2, 66), 16) * 2;
            var len = parseInt(hex.slice(offset + 2, offset + 66), 16);
            var data = hex.slice(offset + 66, offset + 66 + len * 2);
            var bytes = [];
            for (var i = 0; i < data.length; i += 2) {
                bytes.push(parseInt(data.substr(i, 2), 16));
            }
            return new TextDecoder().decode(new Uint8Array(bytes));
        } catch (e) {
            return '';
        }
    }

    function fmtBalance(raw, decimals) {
        var s = raw.toString();
        if (s.length <= decimals) s = '0'.repeat(decimals - s.length + 1) + s;
        var whole = s.slice(0, s.length - decimals);
        var frac = s.slice(s.length - decimals, s.length - decimals + 4);
        return Number(whole + '.' + frac).toLocaleString(undefined, { maximumFractionDigits: 4 });
    }

    function fmtNum(n) {
        return Number(n).toLocaleString();
    }

    async function rpcFetch(url, body) {
        var res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (res.status === 429 || res.status === 503) throw new Error('Rate limited');
        return await res.json();
    }

    async function contractRead(to, data) {
        // Use wallet provider first (more reliable, no rate limits)
        if (state.provider) {
            try {
                var result = await state.provider.request({
                    method: 'eth_call',
                    params: [{ to: to, data: data }, 'latest']
                });
                if (result && result !== '0x') return result;
            } catch (e) { /* fall through to public RPCs */ }
        }
        var body = { jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: to, data: data }, 'latest'] };
        for (var i = 0; i < RPC_URLS.length; i++) {
            try {
                var json = await rpcFetch(RPC_URLS[i], body);
                if (json.result && json.result !== '0x') return json.result;
            } catch (e) { /* try next */ }
        }
        return '0x0';
    }

    async function batchRead(calls) {
        // Try wallet provider first (individual calls, but reliable)
        if (state.provider) {
            try {
                var providerResults = [];
                for (var k = 0; k < calls.length; k++) {
                    var r = await state.provider.request({
                        method: 'eth_call',
                        params: [{ to: calls[k].to, data: calls[k].data }, 'latest']
                    });
                    providerResults.push(r || '0x0');
                }
                return providerResults;
            } catch (e) { /* fall through to public RPCs */ }
        }
        // Try batch RPC
        var batch = calls.map(function(c, i) {
            return { jsonrpc: '2.0', id: i + 1, method: 'eth_call', params: [{ to: c.to, data: c.data }, 'latest'] };
        });
        for (var i = 0; i < RPC_URLS.length; i++) {
            try {
                var json = await rpcFetch(RPC_URLS[i], batch);
                if (Array.isArray(json)) {
                    json.sort(function(a, b) { return a.id - b.id; });
                    return json.map(function(r) { return safeHex(r.result); });
                }
            } catch (e) { /* try next */ }
        }
        // Fallback: individual calls via public RPCs
        var results = [];
        for (var j = 0; j < calls.length; j++) {
            results.push(await contractRead(calls[j].to, calls[j].data));
        }
        return results;
    }

    async function ensureBase() {
        if (!state.provider) return;
        try {
            await state.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID }] });
        } catch (e) {
            if (e.code === 4902) {
                await state.provider.request({ method: 'wallet_addEthereumChain', params: [{
                    chainId: BASE_CHAIN_ID, chainName: 'Base',
                    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                    rpcUrls: ['https://mainnet.base.org'],
                    blockExplorerUrls: ['https://basescan.org']
                }] });
            }
        }
    }

    async function waitReceipt(txHash, maxWait) {
        maxWait = maxWait || 90;
        var body = { jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [txHash] };
        for (var i = 0; i < maxWait; i++) {
            await new Promise(function(r) { setTimeout(r, 2000); });
            for (var r = 0; r < RPC_URLS.length; r++) {
                try {
                    var json = await rpcFetch(RPC_URLS[r], body);
                    if (json.result && json.result.status) return json.result;
                    break; // got response but no receipt yet, wait and retry
                } catch (e) { /* try next RPC */ }
            }
        }
        return null;
    }

    // ── Public-RPC-only reads (always Base, ignores wallet provider) ──
    async function publicContractRead(to, data) {
        var body = { jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: to, data: data }, 'latest'] };
        for (var i = 0; i < RPC_URLS.length; i++) {
            try {
                var json = await rpcFetch(RPC_URLS[i], body);
                if (json.result && json.result !== '0x') return json.result;
            } catch (e) { /* try next */ }
        }
        return '0x0';
    }

    async function publicBatchRead(calls) {
        var batch = calls.map(function(c, i) {
            return { jsonrpc: '2.0', id: i + 1, method: 'eth_call', params: [{ to: c.to, data: c.data }, 'latest'] };
        });
        for (var i = 0; i < RPC_URLS.length; i++) {
            try {
                var json = await rpcFetch(RPC_URLS[i], batch);
                if (Array.isArray(json)) {
                    json.sort(function(a, b) { return a.id - b.id; });
                    return json.map(function(r) { return safeHex(r.result); });
                }
            } catch (e) { /* try next */ }
        }
        // Fallback: individual calls
        var results = [];
        for (var j = 0; j < calls.length; j++) {
            results.push(await publicContractRead(calls[j].to, calls[j].data));
        }
        return results;
    }

    // ── Enumerate Holders ──
    async function enumerateHolders() {
        var totalHex = await contractRead(ANGEL_NFT, SEL_TOTAL_MINTED);
        var totalMinted = Number(BigInt(totalHex));
        if (totalMinted === 0) return [];

        var holders = {};
        var CHUNK = 50;

        for (var start = 1; start <= totalMinted; start += CHUNK) {
            var calls = [];
            var end = Math.min(start + CHUNK - 1, totalMinted);
            for (var id = start; id <= end; id++) {
                calls.push({ to: ANGEL_NFT, data: SEL_OWNER_OF + pad32('0x' + id.toString(16)) });
            }
            var results = await batchRead(calls);
            for (var j = 0; j < results.length; j++) {
                if (results[j].length < 66) continue; // skip invalid/empty results
                var owner = '0x' + results[j].slice(26);
                if (owner !== '0x0000000000000000000000000000000000000000') {
                    holders[owner.toLowerCase()] = true;
                }
            }
        }

        return Object.keys(holders);
    }

    // ── Fetch Token Info ──
    async function fetchTokenInfo(tokenAddr, userAddr) {
        var results = await batchRead([
            { to: tokenAddr, data: SEL_NAME },
            { to: tokenAddr, data: SEL_SYMBOL },
            { to: tokenAddr, data: SEL_DECIMALS },
            { to: tokenAddr, data: SEL_BALANCE_OF + pad32(userAddr) }
        ]);

        return {
            name: decodeString(results[0]) || 'Unknown',
            symbol: decodeString(results[1]) || '???',
            decimals: Number(BigInt(results[2])),
            balance: BigInt(results[3])
        };
    }

    // ── Build Disperse Calldata ──
    function buildDisperseCalldata(tokenAddr, recipients, amountPerRecipient) {
        // disperseToken(address token, address[] recipients, uint256[] values)
        // Head: token(32) + recipientsOffset(32) + valuesOffset(32) = 96 bytes
        var data = SEL_DISPERSE_TOKEN;
        // token address
        data += pad32(tokenAddr);
        // offset to recipients array = 96 (0x60) — after 3 head words
        data += pad32('0x' + (96).toString(16));
        // offset to values array = 96 + 32 (array length) + N*32 (addresses)
        var valuesOffset = 96 + 32 + recipients.length * 32;
        data += pad32('0x' + valuesOffset.toString(16));
        // recipients array
        data += pad32('0x' + recipients.length.toString(16)); // length
        for (var i = 0; i < recipients.length; i++) {
            data += pad32(recipients[i]);
        }
        // values array
        data += pad32('0x' + recipients.length.toString(16)); // length
        var amtHex = '0x' + amountPerRecipient.toString(16);
        for (var j = 0; j < recipients.length; j++) {
            data += pad32(amtHex);
        }
        return data;
    }

    // ── Execute Airdrop ──
    async function executeAirdrop() {
        var btn = document.getElementById('airdropExecute');
        var statusEl = document.getElementById('airdropTxStatus');
        btn.disabled = true;

        try {
            await ensureBase();

            var amount = parseAmount();
            if (!amount || amount <= BigInt(0)) {
                statusEl.textContent = 'Enter a valid amount.';
                btn.disabled = false;
                return;
            }

            var perHolder = state.mode === 'per-holder'
                ? amount
                : amount / BigInt(state.holders.length);

            var totalNeeded = perHolder * BigInt(state.holders.length);

            if (totalNeeded > state.tokenBalance) {
                statusEl.textContent = 'Insufficient token balance.';
                btn.disabled = false;
                return;
            }

            // Check allowance
            statusEl.textContent = 'Checking allowance...';
            var allowanceHex = await contractRead(state.tokenAddr,
                SEL_ALLOWANCE + pad32(state.account) + pad32(DISPERSE));
            var allowance = BigInt(allowanceHex);

            if (allowance < totalNeeded) {
                statusEl.textContent = 'Approving Disperse contract...';
                var approveTx = await state.provider.request({
                    method: 'eth_sendTransaction',
                    params: [{
                        from: state.account,
                        to: state.tokenAddr,
                        data: SEL_APPROVE + pad32(DISPERSE) + MAX_UINT256.slice(2)
                    }]
                });
                statusEl.innerHTML = 'Approval tx sent. <a href="https://basescan.org/tx/' + approveTx + '" target="_blank">View</a> — Waiting for confirmation...';
                var receipt = await waitReceipt(approveTx);
                if (!receipt || receipt.status === '0x0') {
                    statusEl.textContent = 'Approval failed. Please try again.';
                    btn.disabled = false;
                    return;
                }
                statusEl.textContent = 'Approved! Sending airdrop...';
            }

            // Disperse in batches of 500
            var BATCH = 500;
            var batches = [];
            for (var i = 0; i < state.holders.length; i += BATCH) {
                batches.push(state.holders.slice(i, i + BATCH));
            }

            for (var b = 0; b < batches.length; b++) {
                var batchLabel = batches.length > 1 ? ' (batch ' + (b + 1) + '/' + batches.length + ')' : '';
                statusEl.textContent = 'Sending airdrop' + batchLabel + '...';

                var calldata = buildDisperseCalldata(state.tokenAddr, batches[b], perHolder);

                var disperseTx = await state.provider.request({
                    method: 'eth_sendTransaction',
                    params: [{
                        from: state.account,
                        to: DISPERSE,
                        data: calldata
                    }]
                });

                statusEl.innerHTML = 'Airdrop tx sent' + batchLabel + '. <a href="https://basescan.org/tx/' + disperseTx + '" target="_blank">View</a> — Waiting...';
                var dReceipt = await waitReceipt(disperseTx);
                if (!dReceipt || dReceipt.status === '0x0') {
                    statusEl.textContent = 'Airdrop transaction failed' + batchLabel + '. Check Basescan for details.';
                    btn.disabled = false;
                    return;
                }
            }

            statusEl.innerHTML = 'Airdrop complete! Tokens sent to ' + state.holders.length + ' holders. <a href="https://basescan.org/tx/' + disperseTx + '" target="_blank">View tx</a>';
            btn.textContent = 'Done!';

        } catch (e) {
            if (e.code === 4001) {
                statusEl.textContent = 'Transaction rejected.';
            } else {
                statusEl.textContent = 'Error: ' + (e.message || e);
            }
            btn.disabled = false;
        }
    }

    function parseAmount() {
        var raw = document.getElementById('airdropAmount').value.trim();
        if (!raw || isNaN(raw) || Number(raw) <= 0) return null;
        // Convert to wei-equivalent based on decimals
        var parts = raw.split('.');
        var whole = parts[0] || '0';
        var frac = (parts[1] || '').slice(0, state.tokenDecimals).padEnd(state.tokenDecimals, '0');
        return BigInt(whole + frac);
    }

    // ── UI Updates ──
    function updateSteps() {
        var steps = [
            document.getElementById('airdropStep1'),
            document.getElementById('airdropStep2'),
            document.getElementById('airdropStep3'),
            document.getElementById('airdropStep4')
        ];

        // Determine active step
        var activeStep = 0;
        if (state.account) activeStep = 1;
        if (state.account && state.tokenAddr) activeStep = 2;
        if (state.account && state.tokenAddr && state.holders.length > 0) activeStep = 3;

        steps.forEach(function(step, i) {
            step.classList.remove('active', 'completed');
            if (i < activeStep) step.classList.add('completed');
            else if (i === activeStep) step.classList.add('active');
        });
    }

    function updateSummary() {
        var amount = parseAmount();
        if (!amount || !state.holders.length || !state.tokenAddr) {
            document.getElementById('airdropSummary').style.display = 'none';
            document.getElementById('airdropExecute').disabled = true;
            return;
        }

        var perHolder = state.mode === 'per-holder'
            ? amount
            : amount / BigInt(state.holders.length);
        var total = perHolder * BigInt(state.holders.length);

        document.getElementById('sumToken').textContent = state.tokenSymbol;
        document.getElementById('sumHolders').textContent = fmtNum(state.holders.length);
        document.getElementById('sumPerHolder').textContent = fmtBalance(perHolder, state.tokenDecimals) + ' ' + state.tokenSymbol;
        document.getElementById('sumTotal').textContent = fmtBalance(total, state.tokenDecimals) + ' ' + state.tokenSymbol;
        document.getElementById('sumBalance').textContent = fmtBalance(state.tokenBalance, state.tokenDecimals) + ' ' + state.tokenSymbol;
        document.getElementById('airdropSummary').style.display = '';

        var insufficient = total > state.tokenBalance;
        document.getElementById('airdropBalanceWarning').style.display = insufficient ? '' : 'none';
        document.getElementById('airdropExecute').disabled = insufficient;
    }

    // ── Fetch user's launched tokens ──
    async function fetchMyTokens(wallet) {
        var loadingEl = document.getElementById('airdropMyTokensLoading');
        loadingEl.style.display = '';
        try {
            var res = await fetch(API_BASE + '/inclawbator?wallet=' + encodeURIComponent(wallet.toLowerCase()));
            var data = await res.json();
            var projects = (data.projects || []).filter(function(p) { return p.token_address; });
            state.myTokens = projects;
            loadingEl.style.display = 'none';

            if (projects.length > 0) {
                var container = document.getElementById('airdropMyTokensList');
                container.innerHTML = '';
                projects.forEach(function(p) {
                    var btn = document.createElement('button');
                    btn.className = 'airdrop-my-token';
                    btn.dataset.addr = p.token_address;
                    btn.innerHTML = p.token_name + ' <span class="token-symbol">' + p.token_symbol + '</span>';
                    btn.addEventListener('click', function() { selectMyToken(p); });
                    container.appendChild(btn);
                });
                document.getElementById('airdropMyTokens').style.display = '';
            }
        } catch (e) {
            loadingEl.style.display = 'none';
        }
    }

    async function selectMyToken(project) {
        // Highlight selected
        document.querySelectorAll('.airdrop-my-token').forEach(function(b) {
            b.classList.toggle('selected', b.dataset.addr === project.token_address);
        });

        // Fill the address input
        document.getElementById('airdropTokenAddr').value = project.token_address;

        // Auto-load token info
        var statusEl = document.getElementById('airdropTokenStatus');
        statusEl.textContent = 'Loading ' + project.token_symbol + '...';

        try {
            var info = await fetchTokenInfo(project.token_address, state.account);
            state.tokenAddr = project.token_address;
            state.tokenName = info.name;
            state.tokenSymbol = info.symbol;
            state.tokenDecimals = info.decimals;
            state.tokenBalance = info.balance;

            document.getElementById('airdropTokenName').textContent = info.name;
            document.getElementById('airdropTokenSymbol').textContent = info.symbol;
            document.getElementById('airdropTokenDecimals').textContent = info.decimals;
            document.getElementById('airdropTokenBalance').textContent = fmtBalance(info.balance, info.decimals);
            document.getElementById('airdropTokenInfo').style.display = '';
            statusEl.textContent = '';
            updateSteps();
        } catch (e) {
            statusEl.textContent = 'Failed to load token info.';
        }
    }

    // ── Event Handlers ──
    function setupEvents() {
        // Connect wallet
        document.getElementById('airdropConnect').addEventListener('click', async function() {
            var statusEl = document.getElementById('airdropWalletStatus');
            try {
                var p = window.ethereum;
                if (!p) { statusEl.textContent = 'No wallet found. Install MetaMask or similar.'; return; }
                state.provider = p;
                await ensureBase();
                var accounts = await p.request({ method: 'eth_requestAccounts' });
                state.account = accounts[0];
                statusEl.textContent = 'Connected: ' + state.account.slice(0, 6) + '...' + state.account.slice(-4);
                this.textContent = 'Connected';
                this.disabled = true;
                document.getElementById('airdropLoadToken').disabled = false;
                updateSteps();
                fetchMyTokens(state.account);
            } catch (e) {
                statusEl.textContent = e.code === 4001 ? 'Connection rejected.' : 'Error: ' + e.message;
            }
        });

        // Load token
        document.getElementById('airdropLoadToken').addEventListener('click', async function() {
            var addr = document.getElementById('airdropTokenAddr').value.trim();
            var statusEl = document.getElementById('airdropTokenStatus');
            if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
                statusEl.textContent = 'Enter a valid contract address.';
                return;
            }
            statusEl.textContent = 'Loading token info...';
            this.disabled = true;

            try {
                var info = await fetchTokenInfo(addr, state.account);
                state.tokenAddr = addr;
                state.tokenName = info.name;
                state.tokenSymbol = info.symbol;
                state.tokenDecimals = info.decimals;
                state.tokenBalance = info.balance;

                document.getElementById('airdropTokenName').textContent = info.name;
                document.getElementById('airdropTokenSymbol').textContent = info.symbol;
                document.getElementById('airdropTokenDecimals').textContent = info.decimals;
                document.getElementById('airdropTokenBalance').textContent = fmtBalance(info.balance, info.decimals);
                document.getElementById('airdropTokenInfo').style.display = '';
                statusEl.textContent = '';
                updateSteps();
            } catch (e) {
                statusEl.textContent = 'Failed to load token. Check the address.';
            }
            this.disabled = false;
        });

        // Amount input → update summary
        document.getElementById('airdropAmount').addEventListener('input', updateSummary);

        // Execute
        document.getElementById('airdropExecute').addEventListener('click', executeAirdrop);
    }

    async function enumerateHoldersAsync() {
        var countEl = document.getElementById('airdropHolderCount');
        countEl.innerHTML = 'Enumerating Angel NFT holders...';
        try {
            // Use server-side API (no CORS / wallet-chain issues)
            var res = await fetch(API_BASE + '/angel-holders');
            var data = await res.json();
            if (data.holders && data.holders.length > 0) {
                state.holders = data.holders;
            } else {
                // Fallback to on-chain enumeration
                state.holders = await enumerateHolders();
            }
            countEl.innerHTML = 'Found <strong>' + state.holders.length + '</strong> unique Angel NFT holders.';
            updateSteps();
            updateSummary();
        } catch (e) {
            // Fallback to on-chain enumeration
            try {
                state.holders = await enumerateHolders();
                countEl.innerHTML = 'Found <strong>' + state.holders.length + '</strong> unique Angel NFT holders.';
                updateSteps();
                updateSummary();
            } catch (e2) {
                countEl.textContent = 'Error enumerating holders. Please refresh.';
            }
        }
    }

    // ── Distribution Mode ──
    window.setAirdropMode = function(mode) {
        state.mode = mode;
        document.querySelectorAll('.airdrop-mode-btn').forEach(function(b) {
            b.classList.toggle('active', b.dataset.mode === mode);
        });
        var hint = document.getElementById('airdropAmountHint');
        var input = document.getElementById('airdropAmount');
        if (mode === 'per-holder') {
            input.placeholder = 'Amount per holder';
            hint.textContent = 'Enter the amount each holder will receive.';
        } else {
            input.placeholder = 'Total amount to split';
            hint.textContent = 'Total will be split equally among all holders.';
        }
        updateSummary();
    };

    // ── Init ──
    window.initAirdropTab = async function() {
        if (state.initialized) return;
        state.initialized = true;
        setupEvents();

        // Auto-detect wallet FIRST and switch to Base before enumerating
        if (window.ethereum && window.ethereum.selectedAddress) {
            state.provider = window.ethereum;
            state.account = window.ethereum.selectedAddress;
            document.getElementById('airdropWalletStatus').textContent = 'Connected: ' + state.account.slice(0, 6) + '...' + state.account.slice(-4);
            document.getElementById('airdropConnect').textContent = 'Connected';
            document.getElementById('airdropConnect').disabled = true;
            document.getElementById('airdropLoadToken').disabled = false;
            updateSteps();
            try { await ensureBase(); } catch (e) { /* user may decline chain switch */ }
            fetchMyTokens(state.account);
        }

        // Now enumerate — wallet is on Base (or absent), so reads are correct
        enumerateHoldersAsync();
    };

})();
