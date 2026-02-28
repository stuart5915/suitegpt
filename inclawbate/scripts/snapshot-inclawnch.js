#!/usr/bin/env node
// Snapshot $INCLAWNCH holders + stakers for migration to $INCLAW
// Usage: node snapshot-inclawnch.js
// Output: snapshot-YYYY-MM-DD.json

const INCLAWNCH = '0xB0b6e0E9da530f68D713cC03a813B506205aC808';
const STAKING_CONTRACT = '0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6';

// Token was deployed at block 42,069,609 (binary search via eth_getCode)
const START_BLOCK = 42_069_600;

// Addresses to exclude from airdrop (system contracts, not humans)
const EXCLUDE = new Set([
    '0x0000000000000000000000000000000000000000',
    '0x000000000000000000000000000000000000dead',
    INCLAWNCH.toLowerCase(),
    STAKING_CONTRACT.toLowerCase(),
]);

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// RPCs that support eth_getLogs (tested — mainnet.base.org and llamarpc don't work)
const RPCS = [
    'https://base.drpc.org',
    'https://base-mainnet.public.blastapi.io',
    'https://mainnet.base.org',
];

const CHUNK = 2000; // blocks per query (Base RPCs limit to 10k, 2k is safe)

// ── RPC helpers ──

let rpcIdx = 0;

async function rpc(method, params) {
    for (let attempt = 0; attempt < RPCS.length; attempt++) {
        const url = RPCS[(rpcIdx + attempt) % RPCS.length];
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
                signal: controller.signal,
            });
            clearTimeout(timeout);
            const json = await res.json();
            if (json.error) continue;
            rpcIdx = (rpcIdx + attempt) % RPCS.length;
            return json.result;
        } catch (e) { continue; }
    }
    throw new Error(`All RPCs failed for ${method}`);
}

async function getBlockNumber() {
    const hex = await rpc('eth_blockNumber', []);
    return parseInt(hex, 16);
}

async function getLogs(fromBlock, toBlock) {
    return rpc('eth_getLogs', [{
        address: INCLAWNCH,
        topics: [TRANSFER_TOPIC],
        fromBlock: '0x' + fromBlock.toString(16),
        toBlock: '0x' + toBlock.toString(16),
    }]);
}

async function ethCall(to, data) {
    const result = await rpc('eth_call', [{ to, data }, 'latest']);
    return result || '0x0';
}

function fromWei(hex) {
    if (!hex || hex === '0x' || hex === '0x0') return 0;
    return Number(BigInt(hex)) / 1e18;
}

function pad32(addr) {
    return addr.replace('0x', '').padStart(64, '0');
}

// ── Step 1: Scan Transfer events ──

async function findAllAddresses() {
    const latestBlock = await getBlockNumber();
    const addresses = new Set();
    const totalRange = latestBlock - START_BLOCK;
    const totalQueries = Math.ceil(totalRange / CHUNK);

    console.log(`Scanning blocks ${START_BLOCK} to ${latestBlock} (${totalRange.toLocaleString()} blocks, ${totalQueries} queries)`);

    let totalLogs = 0;
    let queryCount = 0;

    for (let from = START_BLOCK; from <= latestBlock; from += CHUNK) {
        const to = Math.min(from + CHUNK - 1, latestBlock);
        queryCount++;

        try {
            const logs = await getLogs(from, to);
            if (logs && logs.length > 0) {
                for (const log of logs) {
                    if (log.topics.length >= 3) {
                        addresses.add('0x' + log.topics[1].slice(26).toLowerCase());
                        addresses.add('0x' + log.topics[2].slice(26).toLowerCase());
                    }
                }
                totalLogs += logs.length;
            }
        } catch (e) {
            console.error(`  Query ${queryCount} failed (block ${from}-${to}): ${e.message}`);
        }

        if (queryCount % 5 === 0 || from + CHUNK > latestBlock) {
            const pct = Math.min(100, (queryCount / totalQueries * 100)).toFixed(0);
            process.stdout.write(`\r  ${pct}% — ${addresses.size} addresses, ${totalLogs} transfers`);
        }
    }

    console.log('');
    console.log(`Scan complete: ${addresses.size} unique addresses from ${totalLogs} transfers`);

    // Remove excluded
    for (const addr of EXCLUDE) addresses.delete(addr);

    return addresses;
}

// ── Step 2: Query balances ──

async function getBalances(addresses) {
    const BAL_SEL = '0x70a08231';
    const results = [];
    const addrList = [...addresses];

    console.log(`\nQuerying balances for ${addrList.length} addresses...`);

    for (let i = 0; i < addrList.length; i++) {
        const addr = addrList[i];
        const calldata = BAL_SEL + pad32(addr);

        try {
            const [walletHex, stakedHex] = await Promise.all([
                ethCall(INCLAWNCH, calldata),
                ethCall(STAKING_CONTRACT, calldata),
            ]);

            const wallet = fromWei(walletHex);
            const staked = fromWei(stakedHex);
            const total = wallet + staked;

            if (total > 0) {
                results.push({ address: addr, wallet_balance: wallet, staked_balance: staked, total });
            }
        } catch (e) {
            console.error(`  Error querying ${addr}: ${e.message}`);
        }

        if ((i + 1) % 20 === 0 || i === addrList.length - 1) {
            process.stdout.write(`\r  ${i + 1}/${addrList.length} — ${results.length} with balance`);
        }
    }
    console.log('');
    return results;
}

// ── Step 3: Tag contracts + classify type ──

async function tagContracts(entries) {
    console.log(`Checking ${entries.length} addresses for contract type...`);
    for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        try {
            const code = await rpc('eth_getCode', [e.address, 'latest']);
            const isContract = code && code !== '0x' && code !== '0x0';
            e.is_contract = isContract;

            if (!isContract) {
                e.contract_type = null;
                e.airdrop_eligible = true;
                continue;
            }

            // Classify contract type
            const codeSize = (code.length - 2) / 2;

            // EIP-7702 delegated EOAs — real users
            if (code.startsWith('0xef01')) {
                e.contract_type = 'eip7702_wallet';
                e.airdrop_eligible = true;
                continue;
            }

            // Smart Wallets (ERC-4337) — check entryPoint()
            try {
                const ep = await ethCall(e.address, '0xb0d691fe');
                if (ep && ep !== '0x' && ep !== '0x0' && ep.length >= 66) {
                    e.contract_type = 'smart_wallet';
                    e.airdrop_eligible = true;
                    continue;
                }
            } catch (_) {}

            // Minimal proxies (170b) — staking pool clones
            if (codeSize <= 200 && !code.startsWith('0xef01')) {
                e.contract_type = 'staking_pool';
                e.airdrop_eligible = false;
                continue;
            }

            // Large unknown contracts — likely LP pools or system contracts
            e.contract_type = 'unknown';
            e.airdrop_eligible = false;
        } catch (err) {
            e.is_contract = false;
            e.contract_type = null;
            e.airdrop_eligible = true;
        }

        if ((i + 1) % 50 === 0 || i === entries.length - 1) {
            process.stdout.write(`\r  ${i + 1}/${entries.length}`);
        }
    }
    console.log('');
    return entries;
}

// ── Main ──

async function main() {
    console.log('=== INCLAWNCH Snapshot ===');
    console.log(`Token: ${INCLAWNCH}`);
    console.log(`Staking: ${STAKING_CONTRACT}\n`);

    const snapshotBlock = await getBlockNumber();

    const addresses = await findAllAddresses();
    let entries = await getBalances(addresses);
    entries = await tagContracts(entries);
    entries.sort((a, b) => b.total - a.total);

    // Split into airdrop-eligible vs excluded
    const eligible = entries.filter(e => e.airdrop_eligible);
    const excluded = entries.filter(e => !e.airdrop_eligible);

    const eoas = eligible.filter(e => !e.is_contract);
    const smartWallets = eligible.filter(e => e.contract_type === 'smart_wallet');
    const eip7702 = eligible.filter(e => e.contract_type === 'eip7702_wallet');
    const stakingPools = excluded.filter(e => e.contract_type === 'staking_pool');
    const unknownContracts = excluded.filter(e => e.contract_type === 'unknown');

    const totalEligible = eligible.reduce((s, e) => s + e.total, 0);
    const totalExcluded = excluded.reduce((s, e) => s + e.total, 0);
    const totalHeld = entries.reduce((s, e) => s + e.total, 0);
    const totalWallet = entries.reduce((s, e) => s + e.wallet_balance, 0);
    const totalStaked = entries.reduce((s, e) => s + e.staked_balance, 0);

    console.log('\n=== RESULTS ===');
    console.log(`Snapshot block: ${snapshotBlock}`);
    console.log(`Total addresses with balance: ${entries.length}`);
    console.log(`INCLAWNCH held: ${Math.round(totalHeld).toLocaleString()}`);
    console.log(`  In wallets: ${Math.round(totalWallet).toLocaleString()}`);
    console.log(`  Staked:     ${Math.round(totalStaked).toLocaleString()}`);

    console.log(`\n--- Airdrop Eligible: ${eligible.length} addresses — ${Math.round(totalEligible).toLocaleString()} INCLAWNCH ---`);
    console.log(`  EOA wallets:    ${eoas.length}`);
    console.log(`  Smart Wallets:  ${smartWallets.length} (ERC-4337 / Coinbase)`);
    console.log(`  EIP-7702 EOAs:  ${eip7702.length} (delegated)`);

    console.log(`\n--- Excluded: ${excluded.length} addresses — ${Math.round(totalExcluded).toLocaleString()} INCLAWNCH ---`);
    console.log(`  Staking pools:  ${stakingPools.length}`);
    console.log(`  Unknown/LP:     ${unknownContracts.length}`);

    if (excluded.length > 0) {
        console.log('\nExcluded contracts (LP pools, staking pools, system):');
        excluded.sort((a, b) => b.total - a.total);
        excluded.forEach(c => console.log(`  ${c.address} — ${Math.round(c.total).toLocaleString()} [${c.contract_type}]`));
    }

    console.log(`\nTop 20 eligible holders:`);
    eligible.sort((a, b) => b.total - a.total);
    eligible.slice(0, 20).forEach((e, i) => {
        const tag = e.contract_type ? ` [${e.contract_type}]` : '';
        console.log(`  ${i + 1}. ${e.address}${tag} — ${Math.round(e.total).toLocaleString()}`);
    });

    const snapshot = {
        token: INCLAWNCH,
        staking_contract: STAKING_CONTRACT,
        timestamp: new Date().toISOString(),
        block: snapshotBlock,
        summary: {
            eligible_count: eligible.length,
            excluded_count: excluded.length,
            eligible_inclawnch: totalEligible,
            excluded_inclawnch: totalExcluded,
            total_inclawnch: totalHeld,
            total_wallet: totalWallet,
            total_staked: totalStaked,
        },
        eligible: eligible,
        excluded: excluded,
    };

    const date = new Date().toISOString().slice(0, 10);
    const filename = `snapshot-${date}.json`;
    const fs = await import('fs');
    fs.writeFileSync(filename, JSON.stringify(snapshot, null, 2));
    console.log(`\nSaved to ${filename}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
