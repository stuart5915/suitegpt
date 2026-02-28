// Angel NFT Mint — Inclawbate
// Connect wallet → check Merkle eligibility → approve INCLAWNCH → mint Angel NFT

// ── Addresses (update after deploy) ──
const ANGEL_NFT_ADDRESS = '0x14d44d4d9f7898be1b9e1184a116502061eff5e7';
const INCLAWNCH_ADDRESS = '0xB0b6e0E9da530f68D713cC03a813B506205aC808';
const BASE_CHAIN_ID = '0x2105';
const BASE_RPC = 'https://mainnet.base.org';

// ── Function selectors ──
const APPROVE_SELECTOR = '0x095ea7b3';           // approve(address,uint256)
const ALLOWANCE_SELECTOR = '0xdd62ed3e';          // allowance(address,address)
const BALANCE_SELECTOR = '0x70a08231';             // balanceOf(address)
const HAS_MINTED_SELECTOR = '0x38e21cce';         // hasMinted(address)
const TOTAL_MINTED_SELECTOR = '0xa2309ff8';        // totalMinted()
const MAX_UINT256 = '0x' + 'f'.repeat(64);

// mint(uint256,bytes32[]) selector
const MINT_SELECTOR = '0xba41b0c6';  // bytes4(keccak256("mint(uint256,bytes32[])"))

// ── Helpers ──
function pad32(hex) {
    return hex.replace('0x', '').padStart(64, '0');
}
function toHex(n) {
    return '0x' + BigInt(n).toString(16);
}
function fromWei(hex) {
    if (!hex || hex === '0x' || hex === '0x0') return 0;
    return Number(BigInt(hex)) / 1e18;
}
function fmtNum(n) {
    return Math.round(Number(n) || 0).toLocaleString();
}

async function contractRead(to, data) {
    var res = await fetch(BASE_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call',
            params: [{ to, data }, 'latest'] })
    });
    var json = await res.json();
    return json.result || '0x0';
}

async function contractReadBatch(calls) {
    var batch = calls.map(function(c, i) {
        return { jsonrpc: '2.0', id: i + 1, method: 'eth_call',
            params: [{ to: c.to, data: c.data }, 'latest'] };
    });
    var res = await fetch(BASE_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch)
    });
    var results = await res.json();
    results.sort(function(a, b) { return a.id - b.id; });
    return results.map(function(r) { return r.result || '0x0'; });
}

async function ensureBase(p) {
    try {
        await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID }] });
    } catch (e) {
        if (e.code === 4902) {
            await p.request({ method: 'wallet_addEthereumChain', params: [{
                chainId: BASE_CHAIN_ID, chainName: 'Base',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://mainnet.base.org'],
                blockExplorerUrls: ['https://basescan.org']
            }] });
        }
    }
}

async function waitForReceipt(provider, txHash, maxWait) {
    maxWait = maxWait || 60;
    for (var i = 0; i < maxWait; i++) {
        await new Promise(function(r) { setTimeout(r, 2000); });
        var receipt = await provider.request({
            method: 'eth_getTransactionReceipt',
            params: [txHash]
        });
        if (receipt) {
            if (receipt.status === '0x1') return receipt;
            throw new Error('Transaction reverted');
        }
    }
    throw new Error('Transaction timed out');
}

// ── State ──
var provider = null;
var userAddress = null;
var merkleData = null; // loaded from merkle-proofs.json
var userProof = null;  // proof for connected wallet

// ── DOM ──
var stateConnect = document.getElementById('stateConnect');
var stateChecking = document.getElementById('stateChecking');
var stateNotEligible = document.getElementById('stateNotEligible');
var stateEligible = document.getElementById('stateEligible');
var stateMinted = document.getElementById('stateMinted');
var btnConnect = document.getElementById('btnConnect');
var btnMint = document.getElementById('btnMint');
var mintAmount = document.getElementById('mintAmount');
var txStatus = document.getElementById('txStatus');
var statMinted = document.getElementById('statMinted');
var statRemaining = document.getElementById('statRemaining');
var statCollected = document.getElementById('statCollected');

function showState(id) {
    [stateConnect, stateChecking, stateNotEligible, stateEligible, stateMinted].forEach(function(el) {
        el.style.display = 'none';
    });
    document.getElementById(id).style.display = '';
}

// ── Load Merkle proofs ──
async function loadMerkleData() {
    try {
        var res = await fetch('/scripts/merkle-proofs.json');
        merkleData = await res.json();
    } catch (e) {
        console.error('Failed to load merkle proofs:', e);
    }
}

// ── RPC with fallback ──
var ANGEL_RPCS = ['https://base.drpc.org', 'https://mainnet.base.org', 'https://base.llamarpc.com'];

async function angelRpc(method, params) {
    for (var i = 0; i < ANGEL_RPCS.length; i++) {
        try {
            var resp = await fetch(ANGEL_RPCS[i], {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params })
            });
            if (resp.status === 503 || resp.status === 429) continue;
            var data = await resp.json();
            if (data.result !== undefined) return data.result;
        } catch (e) { /* try next */ }
    }
    return null;
}

// ── Load global stats ──
async function loadStats() {
    if (!ANGEL_NFT_ADDRESS) return;

    try {
        var mintedHex = await angelRpc('eth_call', [{ to: ANGEL_NFT_ADDRESS, data: TOTAL_MINTED_SELECTOR }, 'latest']);
        var minted = Number(BigInt(mintedHex || '0x0'));

        document.getElementById('statMinted').textContent = minted;
        document.getElementById('statRemaining').textContent = (828 - minted);

        // Total INCLAWNCH used to mint — scan Minted events
        var MINTED_TOPIC = '0x25b428dfde728ccfaddad7e29e4ac23c24ed7fd1a6e3e3f91894a9a073f5dfff';
        var blockHex = await angelRpc('eth_blockNumber', []);
        if (blockHex && minted > 0) {
            var currentBlock = Number(BigInt(blockHex));
            var totalUsed = 0;
            var found = 0;
            for (var off = 0; off < 2000000 && found < minted; off += 10000) {
                var toBlock = currentBlock - off;
                var fromBlock = toBlock - 10000;
                var logs = await angelRpc('eth_getLogs', [{
                    address: ANGEL_NFT_ADDRESS,
                    fromBlock: '0x' + fromBlock.toString(16),
                    toBlock: '0x' + toBlock.toString(16),
                    topics: [MINTED_TOPIC]
                }]);
                if (logs && Array.isArray(logs)) {
                    logs.forEach(function(log) {
                        totalUsed += Number(BigInt('0x' + log.data.slice(66))) / 1e18;
                        found++;
                    });
                }
            }
            document.getElementById('statCollected').textContent = fmtNum(Math.round(totalUsed));
        } else {
            document.getElementById('statCollected').textContent = '0';
        }
    } catch (e) {
        console.error('Stats error:', e);
    }
}

// ── Connect ──
async function connectWallet() {
    provider = window.ethereum;
    if (!provider) {
        alert('No wallet found. Install MetaMask or Coinbase Wallet.');
        return;
    }

    var accounts = await provider.request({ method: 'eth_requestAccounts' });
    userAddress = accounts[0].toLowerCase();
    await ensureBase(provider);

    showState('stateChecking');
    await checkEligibility();
}

// ── Check eligibility ──
async function checkEligibility() {
    if (!merkleData) {
        await loadMerkleData();
    }

    if (!merkleData || !merkleData.proofs) {
        showState('stateNotEligible');
        return;
    }

    userProof = merkleData.proofs[userAddress];

    if (!userProof) {
        showState('stateNotEligible');
        return;
    }

    // Check if already minted on-chain
    if (ANGEL_NFT_ADDRESS) {
        var hasMinted = await contractRead(
            ANGEL_NFT_ADDRESS,
            HAS_MINTED_SELECTOR + pad32(userAddress)
        );
        if (BigInt(hasMinted) !== 0n) {
            showState('stateMinted');
            return;
        }
    }

    // Show eligible
    var amountFloat = fromWei('0x' + BigInt(userProof.amount).toString(16));
    mintAmount.textContent = fmtNum(amountFloat) + ' INCLAWNCH';
    showState('stateEligible');
}

// ── Mint flow ──
async function doMint() {
    if (!userProof || !ANGEL_NFT_ADDRESS) return;

    btnMint.disabled = true;
    txStatus.textContent = '';

    var amount = userProof.amount; // already in wei as string
    var proof = userProof.proof;

    try {
        // 1. Check INCLAWNCH balance
        txStatus.textContent = 'Checking INCLAWNCH balance...';
        var balHex = await provider.request({
            method: 'eth_call',
            params: [{ to: INCLAWNCH_ADDRESS, data: BALANCE_SELECTOR + pad32(userAddress) }, 'latest']
        });
        var balance = BigInt(balHex || '0x0');
        var amountBN = BigInt(amount);

        if (balance < amountBN) {
            txStatus.textContent = 'Insufficient INCLAWNCH balance. Need ' + fmtNum(fromWei('0x' + amountBN.toString(16)));
            btnMint.disabled = false;
            return;
        }

        // 2. Check allowance
        txStatus.textContent = 'Checking approval...';
        var allowHex = await provider.request({
            method: 'eth_call',
            params: [{
                to: INCLAWNCH_ADDRESS,
                data: ALLOWANCE_SELECTOR + pad32(userAddress) + pad32(ANGEL_NFT_ADDRESS)
            }, 'latest']
        });
        var allowance = BigInt(allowHex || '0x0');

        if (allowance < amountBN) {
            // 3. Approve
            txStatus.textContent = 'Requesting INCLAWNCH approval...';
            var approveData = APPROVE_SELECTOR + pad32(ANGEL_NFT_ADDRESS) + pad32(MAX_UINT256);
            var approveTx = await provider.request({
                method: 'eth_sendTransaction',
                params: [{ from: userAddress, to: INCLAWNCH_ADDRESS, data: approveData }]
            });
            txStatus.innerHTML = 'Approving... <a href="https://basescan.org/tx/' + approveTx + '" target="_blank">tx</a>';
            await waitForReceipt(provider, approveTx);
            txStatus.textContent = 'Approved! Now minting...';
        }

        // 4. Build mint calldata: mint(uint256 amount, bytes32[] proof)
        var n = proof.length;
        // ABI encode: amount (32 bytes) + offset to proof array (32 bytes) + proof length (32 bytes) + proof items
        var data = MINT_SELECTOR;
        data += pad32(toHex(amountBN));         // amount
        data += pad32(toHex(64));                // offset to bytes32[] (2 * 32 = 64)
        data += pad32(toHex(n));                 // proof.length
        for (var i = 0; i < n; i++) {
            data += pad32(proof[i]);             // each proof element
        }

        txStatus.textContent = 'Requesting mint transaction...';
        var mintTx = await provider.request({
            method: 'eth_sendTransaction',
            params: [{ from: userAddress, to: ANGEL_NFT_ADDRESS, data: data }]
        });
        txStatus.innerHTML = 'Minting... <a href="https://basescan.org/tx/' + mintTx + '" target="_blank">tx</a>';
        await waitForReceipt(provider, mintTx);

        // Success!
        txStatus.textContent = '';
        showState('stateMinted');
        loadStats();

    } catch (err) {
        if (err.code === 4001) {
            txStatus.textContent = 'Transaction cancelled.';
        } else {
            txStatus.textContent = 'Error: ' + (err.message || err);
        }
        btnMint.disabled = false;
    }
}

// ── Init ──
btnConnect.addEventListener('click', connectWallet);
btnMint.addEventListener('click', doMint);

// Populate market links (top + bottom)
function updateMarketLinks() {
    if (!ANGEL_NFT_ADDRESS) return;
    var osUrl = 'https://opensea.io/assets/base/' + ANGEL_NFT_ADDRESS;
    var elUrl = 'https://element.market/collections/base/' + ANGEL_NFT_ADDRESS;
    var bsUrl = 'https://basescan.org/address/' + ANGEL_NFT_ADDRESS;
    // Top links (by id)
    var os = document.getElementById('linkOpenSea');
    var el = document.getElementById('linkElement');
    var bs = document.getElementById('linkBasescan');
    if (os) os.href = osUrl;
    if (el) el.href = elUrl;
    if (bs) bs.href = bsUrl;
    // Bottom links (by class)
    var osB = document.querySelector('.angel-link-os');
    var elB = document.querySelector('.angel-link-el');
    var bsB = document.querySelector('.angel-link-bs');
    if (osB) osB.href = osUrl;
    if (elB) elB.href = elUrl;
    if (bsB) bsB.href = bsUrl;
    // Contract address
    var ca = document.getElementById('angelContractAddr');
    if (ca) ca.textContent = ANGEL_NFT_ADDRESS;
}

loadMerkleData();
loadStats();
updateMarketLinks();

// Auto-connect if wallet already connected
if (window.ethereum) {
    window.ethereum.request({ method: 'eth_accounts' }).then(function(accounts) {
        if (accounts.length > 0) {
            connectWallet();
        }
    });
}
