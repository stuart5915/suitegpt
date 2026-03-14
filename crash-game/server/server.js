const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const http = require('http');
const { ethers } = require('ethers');
const { createClient } = require('@supabase/supabase-js');

// ── Config ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
const COUNTDOWN_SECS = 5;
const CRASH_PAUSE_MS = 3000;
const TICK_MS = 50;
const MAX_MULTIPLIER = 1000;
const HOUSE_EDGE = 0.99; // 1% house edge
const TEST_BALANCE = 0; // real mode — must deposit CLAWS to play

const CLAWS_ADDRESS = '0x7ca47B141639B893C6782823C0b219f872056379';
const VAULT_ADDRESS = process.env.CRASH_VAULT_ADDRESS || '0xBe124C211bE4614C451a5C2E0758B8Bc90517f19';
const OPERATOR_KEY = process.env.OPERATOR_PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL || 'https://mainnet.base.org';

// ── External Services ───────────────────────────────────────────────
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const provider = new ethers.JsonRpcProvider(RPC_URL);
const operatorWallet = OPERATOR_KEY ? new ethers.Wallet(OPERATOR_KEY, provider) : null;

// Minimal ABI — just the events/functions we need
const VAULT_ABI = [
    'event Deposit(address indexed player, uint256 clawsAmount, uint256 chips)',
    'event Withdraw(address indexed player, uint256 clawsAmount, uint256 chips, uint256 nonce)',
    'function processWithdraw(address player, uint256 chips) external',
];
const vaultContract = (VAULT_ADDRESS && operatorWallet)
    ? new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, operatorWallet)
    : null;

const VAULT_IFACE = new ethers.Interface(VAULT_ABI);

// ── Provably Fair ───────────────────────────────────────────────────
function generateCrashPoint(seed) {
  const hash = seed
    ? crypto.createHash('sha256').update(seed).digest('hex')
    : crypto.randomBytes(32).toString('hex');
  const hexValue = hash.substring(0, 8);
  const intValue = parseInt(hexValue, 16);
  const normalized = intValue / 0xffffffff;
  const crashPoint = Math.max(1, Math.floor((HOUSE_EDGE / (1 - normalized)) * 100) / 100);
  return { crashPoint: Math.min(crashPoint, MAX_MULTIPLIER), hash };
}

// ── In-Memory State ─────────────────────────────────────────────────
const users = new Map(); // wallet -> { wallet, username, balance }
const walletToUsername = new Map(); // wallet -> username (display only)

const leaderboard = {
  topProfit: [],
  biggestWins: [],
};

// Load user balance from Supabase, or create with 0
async function getOrCreateUser(wallet, username, forceSync) {
  const key = wallet.toLowerCase();

  // If cached and not forcing sync, return cached (used during gameplay for speed)
  if (!forceSync && users.has(key)) {
    const u = users.get(key);
    if (username && !u.username) u.username = username;
    return u;
  }

  // Always read from Supabase on auth/sync to pick up deposits credited elsewhere
  const { data } = await supabase
    .from('crash_balances')
    .select('chips, username')
    .eq('wallet', key)
    .single();

  const dbChips = data && data.chips;

  if (users.has(key)) {
    // User exists in cache — use whichever balance is higher
    // (cache may have in-flight bets deducted, DB may have new deposits)
    const u = users.get(key);
    if (dbChips != null && dbChips > u.balance) u.balance = dbChips;
    if (username) u.username = username;
    return u;
  }

  const user = {
    wallet: key,
    username: username || (data && data.username) || key.slice(0, 8),
    balance: dbChips != null ? dbChips : TEST_BALANCE,
  };
  users.set(key, user);
  walletToUsername.set(key, user.username);
  return user;
}

// Persist balance to Supabase
async function persistBalance(wallet, chips, username) {
  const key = wallet.toLowerCase();
  await supabase
    .from('crash_balances')
    .upsert({ wallet: key, chips, username, updated_at: new Date().toISOString() }, { onConflict: 'wallet' });
}

// ── Deposit Verification ────────────────────────────────────────────
async function verifyDeposit(txHash, wallet) {
  const key = wallet.toLowerCase();

  // 1. Check if already credited
  const { data: existing } = await supabase
    .from('crash_deposits')
    .select('id')
    .eq('tx_hash', txHash)
    .single();

  if (existing) return { ok: false, error: 'Deposit already credited' };

  // 2. Fetch tx receipt from chain
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) return { ok: false, error: 'Transaction not found — wait for confirmation' };
  if (receipt.status !== 1) return { ok: false, error: 'Transaction failed on chain' };

  // 3. Check it went to our vault
  if (!VAULT_ADDRESS || receipt.to.toLowerCase() !== VAULT_ADDRESS.toLowerCase()) {
    return { ok: false, error: 'Transaction not sent to vault contract' };
  }

  // 4. Parse Deposit event from logs
  let depositEvent = null;
  for (const log of receipt.logs) {
    try {
      const parsed = VAULT_IFACE.parseLog({ topics: log.topics, data: log.data });
      if (parsed && parsed.name === 'Deposit') {
        depositEvent = parsed;
        break;
      }
    } catch {}
  }

  if (!depositEvent) return { ok: false, error: 'No Deposit event found in transaction' };

  // 5. Verify the depositor matches
  const depositor = depositEvent.args[0].toLowerCase();
  if (depositor !== key) return { ok: false, error: 'Deposit wallet does not match' };

  const clawsAmount = depositEvent.args[1];
  const chips = Number(depositEvent.args[2]);

  if (chips <= 0) return { ok: false, error: 'Zero chips deposited' };

  // 6. Record in Supabase (idempotent via unique tx_hash)
  const { error: insertErr } = await supabase
    .from('crash_deposits')
    .insert({
      tx_hash: txHash,
      wallet: key,
      claws_amount: clawsAmount.toString(),
      chips_credited: chips,
    });

  if (insertErr) {
    // Unique constraint = already credited (race condition safety)
    if (insertErr.code === '23505') return { ok: false, error: 'Deposit already credited' };
    return { ok: false, error: 'Database error' };
  }

  // 7. Credit chips
  const user = await getOrCreateUser(key);
  user.balance += chips;
  await persistBalance(key, user.balance, user.username);

  return { ok: true, chips, balance: user.balance };
}

// ── Withdrawal Processing ───────────────────────────────────────────
async function processWithdraw(wallet, chips) {
  const key = wallet.toLowerCase();
  const user = users.get(key);
  if (!user) return { ok: false, error: 'User not found' };
  if (chips <= 0) return { ok: false, error: 'Invalid amount' };
  if (user.balance < chips) return { ok: false, error: 'Insufficient balance' };
  if (!vaultContract) return { ok: false, error: 'Withdrawals not configured' };

  // Optimistically deduct to prevent double-withdraw during tx
  user.balance -= chips;
  await persistBalance(key, user.balance, user.username);

  // Record pending withdrawal
  const { data: record } = await supabase
    .from('crash_withdrawals')
    .insert({ wallet: key, chips, claws_amount: (BigInt(chips) * BigInt(1e18)).toString(), status: 'pending' })
    .select('id')
    .single();

  try {
    // Call vault contract
    const tx = await vaultContract.processWithdraw(wallet, chips);
    const receipt = await tx.wait();

    // Mark confirmed
    await supabase
      .from('crash_withdrawals')
      .update({ tx_hash: receipt.hash, status: 'confirmed' })
      .eq('id', record.id);

    return { ok: true, txHash: receipt.hash, balance: user.balance };
  } catch (err) {
    // Refund on failure
    user.balance += chips;
    await persistBalance(key, user.balance, user.username);
    await supabase
      .from('crash_withdrawals')
      .update({ status: 'failed' })
      .eq('id', record.id);

    return { ok: false, error: 'Withdrawal tx failed: ' + (err.reason || err.message) };
  }
}

// ── Game Engine ─────────────────────────────────────────────────────
const game = {
  phase: 'waiting',
  multiplier: 1.0,
  crashPoint: null,
  countdown: COUNTDOWN_SECS,
  bets: [],
  history: [],
  gameId: 0,
  hash: '',
};

let nextCrashPoint = 1;
let nextHash = '';
let flyStartTime = 0;
let flyInterval = null;
let running = false;

function getPublicState() {
  return {
    type: 'state',
    phase: game.phase,
    multiplier: game.multiplier,
    crashPoint: game.phase === 'crashed' ? game.crashPoint : null,
    countdown: game.countdown,
    bets: game.bets.map(b => ({
      wallet: b.wallet,
      username: b.username,
      amount: b.amount,
      autoCashout: b.autoCashout,
      cashedOutAt: b.cashedOutAt,
      profit: b.profit,
    })),
    history: game.history,
    gameId: game.gameId,
    hash: game.phase === 'crashed' ? game.hash : null,
    playerCount: clients.size,
  };
}

function broadcast(data) {
  const msg = JSON.stringify(data || getPublicState());
  for (const [ws] of clients) {
    try { if (ws.readyState === 1) ws.send(msg); } catch {}
  }
}

function broadcastState() { broadcast(getPublicState()); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function startRound() {
  running = true;
  const result = generateCrashPoint();
  nextCrashPoint = result.crashPoint;
  nextHash = result.hash;
  game.gameId++;
  game.hash = nextHash;

  game.phase = 'waiting';
  game.multiplier = 1.0;
  game.crashPoint = null;
  game.bets = [];
  game.countdown = COUNTDOWN_SECS;
  broadcastState();

  game.phase = 'countdown';
  for (let i = COUNTDOWN_SECS; i > 0; i--) {
    game.countdown = i;
    broadcastState();
    await sleep(1000);
  }

  game.phase = 'flying';
  game.multiplier = 1.0;
  flyStartTime = Date.now();
  broadcastState();

  await flyLoop();

  game.phase = 'crashed';
  game.multiplier = nextCrashPoint;
  game.crashPoint = nextCrashPoint;

  // Process losing bets
  for (const bet of game.bets) {
    if (bet.cashedOutAt === null) {
      bet.profit = -bet.amount;
    }
  }

  game.history.push({ crashPoint: nextCrashPoint, hash: nextHash });
  if (game.history.length > 30) game.history.shift();
  updateLeaderboard();
  broadcastState();

  // Persist all balances after round
  for (const bet of game.bets) {
    const user = users.get(bet.wallet);
    if (user) {
      sendToWallet(bet.wallet, { type: 'balance', balance: user.balance });
      persistBalance(bet.wallet, user.balance, user.username);
    }
  }

  await sleep(CRASH_PAUSE_MS);

  if (clients.size > 0) {
    startRound();
  } else {
    running = false;
  }
}

function flyLoop() {
  return new Promise(resolve => {
    flyInterval = setInterval(() => {
      const elapsed = (Date.now() - flyStartTime) / 1000;
      game.multiplier = Math.floor(Math.pow(Math.E, 0.06 * elapsed) * 100) / 100;

      for (const bet of game.bets) {
        if (bet.cashedOutAt === null && bet.autoCashout !== null && game.multiplier >= bet.autoCashout) {
          processCashout(bet, bet.autoCashout);
        }
      }

      if (game.multiplier >= nextCrashPoint) {
        clearInterval(flyInterval);
        flyInterval = null;
        resolve();
      } else {
        broadcastState();
      }
    }, TICK_MS);
  });
}

function processCashout(bet, multiplier) {
  const cashoutMultiplier = Math.floor(multiplier * 100) / 100;
  bet.cashedOutAt = cashoutMultiplier;
  const winnings = Math.floor(bet.amount * cashoutMultiplier);
  bet.profit = winnings - bet.amount;

  const user = users.get(bet.wallet);
  if (user) {
    user.balance += winnings;
    sendToWallet(bet.wallet, { type: 'balance', balance: user.balance });
  }
}

function placeBet(wallet, username, amount, autoCashout) {
  if (game.phase !== 'waiting' && game.phase !== 'countdown') {
    return { ok: false, error: 'Cannot bet now' };
  }
  if (game.bets.find(b => b.wallet === wallet)) {
    return { ok: false, error: 'Already bet this round' };
  }
  const user = users.get(wallet);
  if (!user) return { ok: false, error: 'Not logged in' };
  if (amount < 1 || amount > 100000) {
    return { ok: false, error: 'Bet must be 1-100,000' };
  }
  if (user.balance < amount) {
    return { ok: false, error: 'Insufficient balance — deposit CLAWS first' };
  }

  user.balance -= amount;
  game.bets.push({
    wallet,
    username,
    amount,
    autoCashout: autoCashout && autoCashout >= 1.01 ? autoCashout : null,
    cashedOutAt: null,
    profit: null,
  });

  broadcastState();
  return { ok: true, balance: user.balance };
}

function cashout(wallet) {
  if (game.phase !== 'flying') {
    return { ok: false, error: 'Not flying' };
  }
  const bet = game.bets.find(b => b.wallet === wallet);
  if (!bet || bet.cashedOutAt !== null) {
    return { ok: false, error: 'No active bet' };
  }
  processCashout(bet, game.multiplier);
  broadcastState();
  const user = users.get(wallet);
  return { ok: true, cashedOutAt: bet.cashedOutAt, profit: bet.profit, balance: user ? user.balance : 0 };
}

function updateLeaderboard() {
  const profitMap = new Map();
  for (const [, user] of users) {
    if (user.balance > 0) profitMap.set(user.username, user.balance);
  }

  leaderboard.topProfit = [...profitMap.entries()]
    .map(([username, totalProfit]) => ({ username, totalProfit }))
    .sort((a, b) => b.totalProfit - a.totalProfit)
    .slice(0, 20);

  for (const bet of game.bets) {
    if (bet.profit !== null && bet.profit > 0) {
      leaderboard.biggestWins.push({
        username: bet.username,
        win: bet.profit,
        multiplier: bet.cashedOutAt,
      });
    }
  }
  leaderboard.biggestWins.sort((a, b) => b.win - a.win);
  leaderboard.biggestWins = leaderboard.biggestWins.slice(0, 20);
}

// ── Chat ────────────────────────────────────────────────────────────
const chatHistory = [];

function handleChat(username, message) {
  if (!message || message.length > 200) return;
  const entry = { username, message, time: Date.now() };
  chatHistory.push(entry);
  if (chatHistory.length > 50) chatHistory.shift();
  broadcast({ type: 'chat', ...entry });
}

// ── WebSocket Server ────────────────────────────────────────────────
const clients = new Map(); // ws -> { username, wallet }

function sendToUser(username, data) {
  const msg = JSON.stringify(data);
  for (const [ws, info] of clients) {
    if (info.username === username && ws.readyState === 1) {
      try { ws.send(msg); } catch {}
    }
  }
}

function sendToWallet(wallet, data) {
  const msg = JSON.stringify(data);
  const key = wallet.toLowerCase();
  for (const [ws, info] of clients) {
    if (info.wallet === key && ws.readyState === 1) {
      try { ws.send(msg); } catch {}
    }
  }
}

// HTTP server for health checks
const httpServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      players: clients.size,
      phase: game.phase,
      vault: !!vaultContract,
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Claws Crash Server');
  }
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  clients.set(ws, { username: null, wallet: null });

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    const info = clients.get(ws);

    switch (msg.type) {
      // Auth with wallet address + display name
      case 'auth': {
        const wallet = (msg.wallet || '').trim().toLowerCase();
        const username = (msg.username || '').trim().substring(0, 20) || wallet.slice(0, 8);
        if (!wallet || !ethers.isAddress(wallet)) {
          ws.send(JSON.stringify({ type: 'error', error: 'Valid wallet address required' }));
          return;
        }

        // Disconnect old connections for this wallet
        for (const [otherWs, otherInfo] of clients) {
          if (otherWs !== ws && otherInfo.wallet === wallet) {
            otherWs.close();
            clients.delete(otherWs);
          }
        }

        info.wallet = wallet;
        info.username = username;
        const user = await getOrCreateUser(wallet, username, true); // force sync from DB on auth
        ws.send(JSON.stringify({
          type: 'auth_ok',
          username: user.username,
          wallet,
          balance: user.balance,
        }));
        ws.send(JSON.stringify(getPublicState()));
        ws.send(JSON.stringify({ type: 'chat_history', messages: chatHistory.slice(-20) }));

        if (!running) startRound();
        break;
      }

      // Verify a deposit tx hash
      case 'deposit': {
        if (!info.wallet) {
          ws.send(JSON.stringify({ type: 'error', error: 'Not logged in' }));
          return;
        }
        const txHash = (msg.txHash || '').trim();
        if (!txHash || txHash.length !== 66) {
          ws.send(JSON.stringify({ type: 'deposit_result', ok: false, error: 'Invalid tx hash' }));
          return;
        }
        const result = await verifyDeposit(txHash, info.wallet);
        ws.send(JSON.stringify({ type: 'deposit_result', ...result }));
        break;
      }

      // Request withdrawal
      case 'withdraw': {
        if (!info.wallet) {
          ws.send(JSON.stringify({ type: 'error', error: 'Not logged in' }));
          return;
        }
        const chips = Math.floor(Number(msg.chips) || 0);
        if (chips <= 0) {
          ws.send(JSON.stringify({ type: 'withdraw_result', ok: false, error: 'Invalid amount' }));
          return;
        }
        ws.send(JSON.stringify({ type: 'withdraw_pending', chips }));
        const result = await processWithdraw(info.wallet, chips);
        ws.send(JSON.stringify({ type: 'withdraw_result', ...result }));
        if (result.ok) {
          ws.send(JSON.stringify({ type: 'balance', balance: result.balance }));
        }
        break;
      }

      case 'bet': {
        if (!info.wallet) {
          ws.send(JSON.stringify({ type: 'error', error: 'Not logged in' }));
          return;
        }
        const result = placeBet(
          info.wallet,
          info.username,
          Math.floor(Number(msg.amount) || 0),
          msg.autoCashout ? Number(msg.autoCashout) : null
        );
        ws.send(JSON.stringify({ type: 'bet_result', ...result }));
        if (result.ok) {
          ws.send(JSON.stringify({ type: 'balance', balance: result.balance }));
        }
        break;
      }

      case 'cashout': {
        if (!info.wallet) {
          ws.send(JSON.stringify({ type: 'error', error: 'Not logged in' }));
          return;
        }
        const result = cashout(info.wallet);
        ws.send(JSON.stringify({ type: 'cashout_result', ...result }));
        break;
      }

      case 'chat': {
        if (!info.username) return;
        handleChat(info.username, (msg.message || '').trim());
        break;
      }

      case 'leaderboard': {
        ws.send(JSON.stringify({ type: 'leaderboard', ...leaderboard }));
        break;
      }
    }
  });

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('close', () => { clients.delete(ws); });
  ws.on('error', () => { clients.delete(ws); });
});

// Ping all clients every 25s to keep connections alive through Railway proxy
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) { ws.terminate(); return; }
    ws.isAlive = false;
    ws.ping();
  });
}, 25000);

wss.on('close', () => clearInterval(pingInterval));

httpServer.listen(PORT, () => {
  console.log(`Claws Crash server running on port ${PORT}`);
  console.log(`Vault: ${VAULT_ADDRESS || 'NOT SET — deposits/withdrawals disabled'}`);
  console.log(`Operator: ${operatorWallet ? operatorWallet.address : 'NOT SET'}`);
  console.log(`Health: http://localhost:${PORT}/health`);
});
