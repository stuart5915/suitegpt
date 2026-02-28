async function test() {
    const TOKEN = '0xB0b6e0E9da530f68D713cC03a813B506205aC808';
    const TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

    const RPCS = [
        'https://base.llamarpc.com',
        'https://base.drpc.org',
        'https://base-mainnet.public.blastapi.io',
        'https://mainnet.base.org',
    ];

    let rpcIdx = 0;

    async function call(method, params) {
        for (let attempt = 0; attempt < RPCS.length; attempt++) {
            const url = RPCS[(rpcIdx + attempt) % RPCS.length];
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 8000);
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({jsonrpc:'2.0', id:1, method, params}),
                    signal: controller.signal,
                });
                clearTimeout(timeout);
                const json = await res.json();
                if (json.error) {
                    // If range too large, that's not a retry-able error
                    if (json.error.code === -32614) return json;
                    continue;
                }
                rpcIdx = (rpcIdx + attempt) % RPCS.length; // prefer working RPC
                return json;
            } catch (e) { continue; }
        }
        return { error: { message: 'All RPCs failed' } };
    }

    const latest = parseInt((await call('eth_blockNumber', [])).result, 16);
    console.log('Latest block:', latest);

    // Test which RPCs support getLogs and what block ranges
    console.log('\nTesting RPC getLogs support...');
    for (const url of RPCS) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({jsonrpc:'2.0', id:1, method: 'eth_getLogs', params: [{
                    address: TOKEN, topics: [TOPIC],
                    fromBlock: '0x' + (latest - 2000).toString(16),
                    toBlock: '0x' + latest.toString(16),
                }]}),
            });
            const json = await res.json();
            if (json.error) {
                console.log(`  ${url}: ERROR - ${json.error.message}`);
            } else {
                console.log(`  ${url}: OK - ${(json.result||[]).length} logs in 2k range`);
            }
        } catch (e) {
            console.log(`  ${url}: TIMEOUT/FAIL`);
        }
    }

    // Try with the first working RPC and 2k block range
    console.log('\nScanning backwards (2k block chunks)...');
    let foundStart = false;

    for (let to = latest; to > latest - 500000 && !foundStart; to -= 2000) {
        const from = to - 1999;
        const r = await call('eth_getLogs', [{
            address: TOKEN, topics: [TOPIC],
            fromBlock: '0x' + from.toString(16),
            toBlock: '0x' + to.toString(16),
        }]);

        if (r.error) {
            // skip
        } else if (r.result && r.result.length > 0) {
            console.log(`  ${from}-${to}: ${r.result.length} logs`);
        } else {
            console.log(`  ${from}-${to}: 0 logs — deploy is after this block`);
            console.log(`  Token deployed around block ${to}`);
            console.log(`  Blocks to scan: ${latest - to}`);
            console.log(`  Queries (2k chunks): ${Math.ceil((latest - to) / 2000)}`);
            foundStart = true;
        }
    }
}
test().catch(console.error);
