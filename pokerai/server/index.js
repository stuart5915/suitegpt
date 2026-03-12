require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { RoomManager, PLATFORM_WALLETS } = require('./room-manager');
const { createChallenge, verifySignature, getChallengeMessage } = require('./wallet-auth');
const { RewardEngine } = require('./reward-engine');

// Optional: chain + supabase (graceful fallback to JSON store if not configured)
let chain = null;
let useSupabase = false;
let rewardEngine = null;

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'https://pokerai.app',
    'https://www.pokerai.app',
    /https:\/\/stuart-hollinger-landing[a-z0-9-]*\.vercel\.app$/,
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
  ]
}));
app.use(express.json());

// WebSocket server
const wss = new WebSocketServer({ server });
const clients = new Map(); // ws → { sessionId, walletAddress, authenticated, activeRoom }

// Authenticated wallet set — wallets that have passed signature verification
const authenticatedWallets = new Set();

// Per-wallet withdrawal lock to prevent race conditions
const withdrawalsInProgress = new Set();

let rooms; // initialized in startServer()

// Validate that a value is a positive finite number
function isValidPositiveNumber(val) {
  return typeof val === 'number' && Number.isFinite(val) && val > 0;
}

// API key check for admin endpoints
function requireApiKey(req, res) {
  const key = req.headers['x-api-key'];
  if (!key || key !== process.env.ADMIN_API_KEY) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

function broadcastViewerCount() {
  const count = clients.size;
  const msg = JSON.stringify({ type: 'viewerCount', data: { count } });
  for (const [ws] of clients) {
    if (ws.readyState === 1) {
      try { ws.send(msg); } catch (e) { /* ignore */ }
    }
  }
}

function getClientWallet(client) {
  // One consistent wallet per client — real wallet if connected, sandbox fallback
  return client.walletAddress || `sandbox_${client.sessionId}`;
}

function broadcastStateToAll() {
  for (const [ws, client] of clients) {
    if (ws.readyState === 1) {
      try {
        const state = rooms.getStateForClient(client.sessionId, getClientWallet(client), client.activeRoom, client.activeTableId);
        ws.send(JSON.stringify({ type: 'gameState', data: state }));
      } catch (e) { /* ignore */ }
    }
  }
}

function sendBalance(ws, walletAddress) {
  if (!walletAddress) return;
  const wallet = rooms.getWalletBalance(walletAddress);
  ws.send(JSON.stringify({ type: 'walletBalance', data: { balance: wallet.balance } }));
}

// Check if a wallet action requires a connected wallet
function requireAuth(client, ws) {
  if (!client.walletAddress) {
    ws.send(JSON.stringify({ type: 'error', data: { message: 'Connect wallet first' } }));
    return false;
  }
  return true;
}

wss.on('connection', (ws) => {
  const sessionId = uuidv4();
  clients.set(ws, { sessionId, activeRoom: 'sandbox', authenticated: false });

  // Send welcome + initial state (no wallet context — just spectating)
  ws.send(JSON.stringify({ type: 'welcome', data: { sessionId, viewerCount: clients.size } }));
  const state = rooms.getStateForClient(sessionId, null, 'sandbox');
  ws.send(JSON.stringify({ type: 'gameState', data: state }));
  broadcastViewerCount();

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw);
      const client = clients.get(ws);
      if (!client) return;

      switch (msg.type) {
        // === Auth flow: requestChallenge → authenticate ===
        case 'requestChallenge': {
          const addr = (msg.walletAddress || '').toLowerCase();
          if (!addr) break;
          const nonce = createChallenge(addr);
          const message = getChallengeMessage(nonce);
          ws.send(JSON.stringify({ type: 'challenge', data: { message, nonce } }));
          break;
        }

        case 'authenticate': {
          const addr = (msg.walletAddress || '').toLowerCase();
          const result = verifySignature(addr, msg.signature);
          if (result.valid) {
            client.walletAddress = addr;
            client.authenticated = true;
            authenticatedWallets.add(addr);

            // Get or create wallet (starts at 0 chips — must deposit USDC)
            const wallet = rooms.getWalletBalance(addr);
            ws.send(JSON.stringify({ type: 'authenticated', data: { address: addr, balance: wallet.balance } }));

            // Send state with wallet context
            const s = rooms.getStateForClient(client.sessionId, addr, client.activeRoom);
            ws.send(JSON.stringify({ type: 'gameState', data: s }));
          } else {
            ws.send(JSON.stringify({ type: 'authFailed', data: { error: result.error } }));
          }
          break;
        }

        case 'setWallet': {
          client.walletAddress = msg.walletAddress ? msg.walletAddress.toLowerCase() : null;
          // NOTE: Do NOT set client.authenticated here — only the 'authenticate'
          // handler (which verifies a signature) may grant authenticated status.
          // setWallet is read-only: lets client view agents/balance but not withdraw.
          if (client.walletAddress) {
            // Use async getOrCreateWallet so balance loads from Supabase on fresh restart
            const wallet = await rooms.store.getOrCreateWallet(client.walletAddress);
            ws.send(JSON.stringify({ type: 'walletBalance', data: { balance: wallet.balance } }));

            // Sync with on-chain deposits — credit up OR cap down if server drifted
            if (chain) {
              try {
                const stats = await chain.vault.playerStats(client.walletAddress);
                const onChainChips = Math.floor((Number(stats[0]) * 10000) / 1e6);
                const withdrawnChips = Math.floor((Number(stats[1]) * 10000) / 1e6);
                const expected = onChainChips - withdrawnChips;
                const inPlay = rooms.getChipsInPlay(client.walletAddress);
                const total = wallet.balance + inPlay;
                if (expected > total) {
                  // Server missed a deposit — credit the difference
                  const credit = expected - total;
                  await rooms.store.addBalance(client.walletAddress, credit);
                  await rooms.store.recordTransaction(client.walletAddress, 'deposit', Math.floor(credit / 10000 * 1e6), credit);
                  sendBalance(ws, client.walletAddress);
                  ws.send(JSON.stringify({ type: 'depositConfirmed', data: { chips: credit } }));
                } else if (total > expected) {
                  // Server total > on-chain deposits — this is NORMAL in poker
                  // Players win chips from each other, so their balance grows beyond deposits.
                  // Do NOT cap down — that destroys legitimate poker winnings.
                  // Only log for monitoring.
                  console.log(`[BalanceSync] ${client.walletAddress.slice(0,8)}: server total ${total} > on-chain ${expected} (poker winnings, not capping)`);
                }
              } catch (e) { /* silent — check-deposit HTTP fallback still available */ }
            }
          }
          // Update reward engine with this wallet's value
          if (rewardEngine && client.walletAddress) {
            const bal = (await rooms.store.getOrCreateWallet(client.walletAddress)).balance;
            const ip = rooms.getChipsInPlay(client.walletAddress);
            rewardEngine.updateWalletValue(client.walletAddress, bal + ip, 'usdc');
            // Send rewards state
            const rewards = rewardEngine.getWalletRewards(client.walletAddress);
            const stats = rewardEngine.getStats();
            ws.send(JSON.stringify({ type: 'rewardsUpdate', data: { ...rewards, tvl: stats.tvl, emission: stats.emission } }));
          }

          const s = rooms.getStateForClient(client.sessionId, getClientWallet(client), client.activeRoom);
          ws.send(JSON.stringify({ type: 'gameState', data: s }));
          break;
        }

        case 'subscribeRoom': {
          const roomId = msg.roomId || 'micro';
          if (['sandbox', 'micro', 'mid', 'high'].includes(roomId)) {
            client.activeRoom = roomId;
            if (msg.tableId) client.activeTableId = msg.tableId;
            const s = rooms.getStateForClient(client.sessionId, getClientWallet(client), roomId, client.activeTableId);
            ws.send(JSON.stringify({ type: 'gameState', data: s }));
          }
          break;
        }

        // === Money actions — require wallet auth (sandbox uses session ID) ===

        case 'createAgent': {
          const addr = getClientWallet(client);
          if (client.walletAddress && !requireAuth(client, ws)) break;
          const result = rooms.createLobbyAgent(addr, msg.config);
          ws.send(JSON.stringify({ type: 'createAgentResult', data: { ...result, agentName: msg.config.name } }));
          const s = rooms.getStateForClient(client.sessionId, addr, client.activeRoom);
          ws.send(JSON.stringify({ type: 'gameState', data: s }));
          break;
        }

        case 'updateAgent': {
          const addr = getClientWallet(client);
          if (client.walletAddress && !requireAuth(client, ws)) break;
          const result = rooms.updateLobbyAgent(addr, msg.agentId, msg.config);
          ws.send(JSON.stringify({ type: 'updateAgentResult', data: result }));
          if (result.success) {
            const agents = rooms.getAgentsForWallet(addr);
            ws.send(JSON.stringify({ type: 'myAgents', data: agents }));
            broadcastStateToAll();
          }
          break;
        }

        case 'fundAgent': {
          if (!requireAuth(client, ws)) break;
          if (!isValidPositiveNumber(msg.amount)) {
            ws.send(JSON.stringify({ type: 'fundAgentResult', data: { error: 'Invalid amount' } }));
            break;
          }
          const addr = client.walletAddress;
          const result = rooms.fundLobbyAgent(addr, msg.agentId, msg.amount);
          ws.send(JSON.stringify({ type: 'fundAgentResult', data: result }));
          if (result.success) {
            rooms.store.recordTransaction(addr, 'fund_agent', 0, msg.amount);
            sendBalance(ws, addr);
            const agents = rooms.getAgentsForWallet(addr);
            ws.send(JSON.stringify({ type: 'myAgents', data: agents }));
          }
          break;
        }

        case 'defundAgent': {
          if (!requireAuth(client, ws)) break;
          const addr = client.walletAddress;
          const result = rooms.defundLobbyAgent(addr, msg.agentId, msg.amount);
          ws.send(JSON.stringify({ type: 'defundAgentResult', data: result }));
          if (result.success) {
            rooms.store.recordTransaction(addr, 'defund_agent', 0, result.amount);
            sendBalance(ws, addr);
            const agents = rooms.getAgentsForWallet(addr);
            ws.send(JSON.stringify({ type: 'myAgents', data: agents }));
          }
          break;
        }

        case 'joinTable': {
          const isSandbox = (msg.roomId || client.activeRoom) === 'sandbox';
          if (!isSandbox && !requireAuth(client, ws)) break;
          if (msg.chipStack !== undefined && !isValidPositiveNumber(msg.chipStack)) {
            ws.send(JSON.stringify({ type: 'joinTableResult', data: { error: 'Invalid chip stack amount' } }));
            break;
          }
          const addr = getClientWallet(client);
          const roomId = msg.roomId || 'micro';
          const result = rooms.joinRoom(addr, msg.agentId, roomId, msg.chipStack);
          ws.send(JSON.stringify({ type: 'joinTableResult', data: result }));
          if (result.success) {
            client.activeRoom = roomId;
            client.activeTableId = result.tableId; // track which table to show
            if (!isSandbox) sendBalance(ws, addr);
          }
          broadcastStateToAll();
          break;
        }

        case 'topUp': {
          if (!requireAuth(client, ws)) break;
          if (!isValidPositiveNumber(msg.amount)) {
            ws.send(JSON.stringify({ type: 'topUpResult', data: { error: 'Invalid amount' } }));
            break;
          }
          const addr = client.walletAddress;
          const result = rooms.topUpAgent(addr, msg.agentId, msg.amount);
          ws.send(JSON.stringify({ type: 'topUpResult', data: result }));
          if (result.success) {
            rooms.store.recordTransaction(addr, 'topup_agent', 0, msg.amount);
            sendBalance(ws, addr);
            const agents = rooms.getAgentsForWallet(addr);
            ws.send(JSON.stringify({ type: 'myAgents', data: agents }));
            broadcastStateToAll();
          }
          break;
        }

        case 'leaveTable': {
          const addr = getClientWallet(client);
          if (client.walletAddress && !requireAuth(client, ws)) break;
          const result = rooms.leaveTable(addr, msg.agentId);
          ws.send(JSON.stringify({ type: 'leaveTableResult', data: result }));
          if (result.success && result.pending) {
            // Queued — agent finishes current hand then leaves
            // _onPendingLeave callback handles the actual removal + lobby return
          } else if (result.success && client.walletAddress && result.agent) {
            rooms.store.recordTransaction(addr, 'leave_table', 0, result.agent.chipStack);
          }
          broadcastStateToAll();
          break;
        }

        case 'recallAgent': {
          const addr = getClientWallet(client);
          if (client.walletAddress && !requireAuth(client, ws)) break;
          const result = rooms.deleteAgent(addr, msg.agentId);
          ws.send(JSON.stringify({ type: 'recallAgentResult', data: result }));
          if (result.success && client.walletAddress) {
            if (result.finalChips > 0) {
              rooms.store.recordTransaction(addr, 'delete_agent', 0, result.finalChips);
            }
            sendBalance(ws, addr);
          }
          broadcastStateToAll();
          break;
        }

        // === Withdraw chips to USDC ===
        case 'withdrawUsdc': {
          if (!requireAuth(client, ws)) break;
          const addr = client.walletAddress;
          const chips = msg.chips;

          if (!isValidPositiveNumber(chips)) {
            ws.send(JSON.stringify({ type: 'withdrawUsdcResult', data: { error: 'Invalid chip amount' } }));
            break;
          }

          if (chips < 1000) {
            ws.send(JSON.stringify({ type: 'withdrawUsdcResult', data: { error: 'Minimum withdrawal: 1,000 chips ($0.10)' } }));
            break;
          }

          // Prevent concurrent withdrawals for the same wallet
          if (withdrawalsInProgress.has(addr)) {
            ws.send(JSON.stringify({ type: 'withdrawUsdcResult', data: { error: 'Withdrawal already in progress. Please wait.' } }));
            break;
          }

          // Check balance
          const wallet = rooms.getWalletBalance(addr);
          if (wallet.balance < chips) {
            ws.send(JSON.stringify({ type: 'withdrawUsdcResult', data: { error: `Not enough chips. You have ${wallet.balance.toLocaleString()}` } }));
            break;
          }

          if (!chain) {
            ws.send(JSON.stringify({ type: 'withdrawUsdcResult', data: { error: 'Withdrawals not yet enabled (contract not configured)' } }));
            break;
          }

          // Lock this wallet's withdrawals
          withdrawalsInProgress.add(addr);

          try {
            // Deduct chips first, then send on-chain
            rooms.store.deductBalance(addr, chips);

            const txResult = await chain.processWithdraw(addr, chips);
            if (txResult.error) {
              // Refund on failure
              rooms.store.addBalance(addr, chips);
              ws.send(JSON.stringify({ type: 'withdrawUsdcResult', data: { error: txResult.error } }));
            } else {
              await rooms.store.recordTransaction(addr, 'withdraw', Math.floor(chips / 10000 * 1e6), chips, txResult.txHash);
              ws.send(JSON.stringify({ type: 'withdrawUsdcResult', data: txResult }));
              sendBalance(ws, addr);
            }
          } finally {
            withdrawalsInProgress.delete(addr);
          }
          break;
        }

        case 'getMyAgents': {
          const addr = getClientWallet(client);
          const result = rooms.getAgentsForWallet(addr);
          const autoTopUp = addr ? rooms.getAutoTopUp(addr) : { enabled: false };
          ws.send(JSON.stringify({ type: 'myAgents', data: result, autoTopUp }));
          break;
        }

        case 'setAutoTopUp': {
          if (!requireAuth(client, ws)) break;
          const addr = client.walletAddress;
          const result = rooms.setAutoTopUp(addr, msg.enabled, msg.targetChips, msg.cashOutAt);
          ws.send(JSON.stringify({ type: 'autoTopUpResult', data: result }));
          break;
        }

        // === Backing (stake on other agents) ===
        case 'backAgent': {
          if (!requireAuth(client, ws)) break;
          const addr = client.walletAddress;
          const result = rooms.backAgent(addr, msg.agentId, msg.amount);
          ws.send(JSON.stringify({ type: 'backAgentResult', data: result }));
          if (result.success) {
            rooms.store.recordTransaction(addr, 'back_agent', 0, msg.amount);
            sendBalance(ws, addr);
          }
          broadcastStateToAll();
          break;
        }

        case 'unbackAgent': {
          if (!requireAuth(client, ws)) break;
          const addr = client.walletAddress;
          const result = rooms.unbackAgent(addr, msg.backingId);
          ws.send(JSON.stringify({ type: 'unbackAgentResult', data: result }));
          if (result.success) {
            rooms.store.recordTransaction(addr, 'unback_agent', 0, result.withdrawn);
            sendBalance(ws, addr);
          }
          broadcastStateToAll();
          break;
        }

        case 'getMyBackings': {
          if (!requireAuth(client, ws)) break;
          const backings = rooms.store.getBackingsForWallet(client.walletAddress);
          ws.send(JSON.stringify({ type: 'myBackings', data: backings }));
          break;
        }

        // === Legacy fund/withdraw (house bot funding) ===
        case 'fund': {
          const result = rooms.fundAgent(client.sessionId, msg.agentId, msg.amount);
          ws.send(JSON.stringify({ type: 'fundResult', data: result }));
          const s = rooms.getStateForClient(client.sessionId, client.walletAddress, client.activeRoom);
          ws.send(JSON.stringify({ type: 'gameState', data: s }));
          break;
        }
        case 'withdraw': {
          const result = rooms.withdrawAgent(client.sessionId, msg.agentId);
          ws.send(JSON.stringify({ type: 'withdrawResult', data: result }));
          const s = rooms.getStateForClient(client.sessionId, client.walletAddress, client.activeRoom);
          ws.send(JSON.stringify({ type: 'gameState', data: s }));
          break;
        }

        // === POKERAI Rewards ===
        case 'getRewards': {
          if (!requireAuth(client, ws)) break;
          if (!rewardEngine) {
            ws.send(JSON.stringify({ type: 'rewardsUpdate', data: { earned: 0, claimed: 0, claimable: 0, ratePerSecond: 0 } }));
            break;
          }
          const rewards = rewardEngine.getWalletRewards(client.walletAddress);
          const stats = rewardEngine.getStats();
          ws.send(JSON.stringify({ type: 'rewardsUpdate', data: { ...rewards, tvl: stats.tvl, emission: stats.emission } }));
          break;
        }

        case 'claimPokerai': {
          if (!requireAuth(client, ws)) break;
          if (!rewardEngine) {
            ws.send(JSON.stringify({ type: 'claimPokeraiResult', data: { error: 'Rewards not active yet' } }));
            break;
          }
          const addr = client.walletAddress;
          const claimable = rewardEngine.getClaimable(addr);
          if (claimable <= 0) {
            ws.send(JSON.stringify({ type: 'claimPokeraiResult', data: { error: 'Nothing to claim' } }));
            break;
          }

          try {
            const onChain = chain && chain.distributeReward;
            // Distribute on-chain via rewards contract (if deployed)
            if (onChain) {
              const txResult = await chain.distributeReward(addr, claimable);
              if (txResult.error) {
                ws.send(JSON.stringify({ type: 'claimPokeraiResult', data: { error: txResult.error } }));
                break;
              }
            }
            rewardEngine.recordClaim(addr, claimable);
            ws.send(JSON.stringify({ type: 'claimPokeraiResult', data: { success: true, claimed: claimable, testMode: !onChain } }));
            console.log(`[Rewards] ${addr} claimed ${claimable.toFixed(2)} POKERAI${onChain ? '' : ' (TEST MODE — no on-chain tx)'}`);
          } catch (e) {
            console.error('[Rewards] Claim failed:', e.message);
            ws.send(JSON.stringify({ type: 'claimPokeraiResult', data: { error: 'Claim failed — try again' } }));
          }
          break;
        }

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
      }
    } catch (e) {
      console.error('Bad message:', e.message);
    }
  });

  ws.on('close', () => {
    const client = clients.get(ws);
    if (client) {
      rooms.withdrawAll(client.sessionId);
    }
    clients.delete(ws);
    broadcastViewerCount();
  });
});

// REST endpoints
app.get('/wallet/:address', async (req, res) => {
  const addr = req.params.address.toLowerCase();
  const wallet = await rooms.store.getOrCreateWallet(addr);
  const inPlay = rooms.getChipsInPlay(addr);
  const autoTopUp = rooms.getAutoTopUp(addr);
  let onChain = null;
  if (chain) {
    try {
      const stats = await chain.vault.playerStats(addr);
      onChain = { deposited: Number(stats[0]), withdrawn: Number(stats[1]) };
    } catch (e) { onChain = { error: e.message }; }
  }
  res.json({ address: addr, balance: wallet.balance, inPlay, autoTopUp, onChain });
});

app.get('/health', async (req, res) => {
  const vaultStats = chain ? await chain.getVaultStats() : null;
  res.json({
    status: 'ok',
    version: 9,
    viewers: clients.size,
    handsPlayed: rooms.totalHandsPlayed,
    rooms: rooms.getRoomsSummary(),
    vault: vaultStats,
    chain: !!chain,
    supabase: useSupabase
  });
});

app.get('/stats', (req, res) => {
  res.json({
    viewers: clients.size,
    handsPlayed: rooms.totalHandsPlayed,
    rooms: rooms.getRoomsSummary()
  });
});

app.get('/roster', (req, res) => {
  res.json(rooms.getGlobalRoster());
});

// POKERAI rewards endpoints
app.get('/tvl', (req, res) => {
  const stats = rewardEngine ? rewardEngine.getStats() : { tvl: { usdc: 0, pokerai: 0, total: 0 }, emission: {}, wallets: {} };
  res.json(stats);
});

app.get('/rewards/:address', (req, res) => {
  const addr = req.params.address.toLowerCase();
  if (!rewardEngine) return res.json({ earned: 0, claimed: 0, claimable: 0, ratePerSecond: 0 });
  const rewards = rewardEngine.getWalletRewards(addr);
  res.json(rewards);
});

// Check on-chain deposit and credit if missing (fallback for missed events)
app.post('/check-deposit', async (req, res) => {
  if (!requireApiKey(req, res)) return;
  if (!chain) return res.json({ error: 'Chain not configured' });
  const { walletAddress } = req.body;
  if (!walletAddress) return res.json({ error: 'Missing walletAddress' });

  const addr = walletAddress.toLowerCase();
  try {
    // Get on-chain deposit total for this player
    const stats = await chain.vault.playerStats(addr);
    const onChainDeposited = Number(stats[0]); // total USDC deposited (raw)
    const onChainWithdrawn = Number(stats[1]); // total USDC withdrawn (raw)
    const onChainChips = Math.floor((onChainDeposited * 10000) / 1e6);
    const withdrawnChips = Math.floor((onChainWithdrawn * 10000) / 1e6);

    // Get current server balance
    const wallet = await rooms.store.getOrCreateWallet(addr);
    const serverBalance = wallet.balance || 0;

    // If on-chain says they deposited more than server knows about, credit the difference
    const expectedMinBalance = onChainChips - withdrawnChips;
    const agentChipsInPlay = rooms.getChipsInPlay(addr);
    const totalServerChips = serverBalance + agentChipsInPlay;

    console.log(`[CheckDeposit] ${addr}: onChain=${onChainChips} chips deposited, ${withdrawnChips} withdrawn, server balance=${serverBalance}, in play=${agentChipsInPlay}, total=${totalServerChips}`);

    if (expectedMinBalance > totalServerChips) {
      // Server missed a deposit — credit the difference
      const credit = expectedMinBalance - totalServerChips;
      await rooms.store.addBalance(addr, credit);
      await rooms.store.recordTransaction(addr, 'deposit', Math.floor(credit / 10000 * 1e6), credit);
      console.log(`[CheckDeposit] Credited ${credit} chips to ${addr}`);

      // Notify connected client
      for (const [ws, client] of clients) {
        if (client.walletAddress === addr && ws.readyState === 1) {
          sendBalance(ws, addr);
          ws.send(JSON.stringify({ type: 'depositConfirmed', data: { chips: credit, usdcAmount: (credit / 10000) } }));
        }
      }

      res.json({ success: true, credited: credit, newBalance: serverBalance + credit });
    } else if (totalServerChips > expectedMinBalance && serverBalance > 0) {
      // Server drifted above on-chain — cap it
      const excess = totalServerChips - expectedMinBalance;
      const capTo = Math.max(0, serverBalance - excess);
      rooms.store.updateBalance(addr, capTo);
      console.log(`[CheckDeposit] Capped ${addr}: server was ${serverBalance}, now ${capTo} (on-chain max: ${expectedMinBalance})`);

      for (const [ws, client] of clients) {
        if (client.walletAddress === addr && ws.readyState === 1) {
          sendBalance(ws, addr);
        }
      }

      res.json({ success: true, capped: true, oldBalance: serverBalance, newBalance: capTo });
    } else {
      res.json({ success: true, credited: 0, balance: serverBalance, message: 'Balance already correct' });
    }
  } catch (e) {
    console.error('[CheckDeposit] Error:', e.message);
    res.json({ error: e.message });
  }
});

// Sync wallet balance to match on-chain reality
app.post('/sync-balance', async (req, res) => {
  if (!requireApiKey(req, res)) return;
  if (!chain) return res.json({ error: 'Chain not configured' });
  const { walletAddress } = req.body;
  if (!walletAddress) return res.json({ error: 'Missing walletAddress' });
  const addr = walletAddress.toLowerCase();

  try {
    const stats = await chain.vault.playerStats(addr);
    const onChainDeposited = Number(stats[0]);
    const onChainWithdrawn = Number(stats[1]);
    const depositedChips = Math.floor((onChainDeposited * 10000) / 1e6);
    const withdrawnChips = Math.floor((onChainWithdrawn * 10000) / 1e6);
    const agentChips = rooms.getChipsInPlay(addr);
    const correctBalance = Math.max(0, depositedChips - withdrawnChips - agentChips);

    const wallet = await rooms.store.getOrCreateWallet(addr);
    const oldBalance = wallet.balance;
    await rooms.store.updateBalance(addr, correctBalance);

    // Notify connected client
    for (const [ws, client] of clients) {
      if (client.walletAddress === addr && ws.readyState === 1) {
        sendBalance(ws, addr);
      }
    }

    res.json({ success: true, old: oldBalance, new: correctBalance, depositedChips, withdrawnChips, agentChips });
  } catch (e) {
    res.json({ error: e.message });
  }
});

app.get('/debug/supabase-test', async (req, res) => {
  if (process.env.NODE_ENV === 'production' && !requireApiKey(req, res)) return;
  if (!rooms.store.supabase) return res.json({ error: 'No Supabase connection' });
  try {
    // Try reading poker_agents directly
    const { data: agents, error: readErr } = await rooms.store.supabase.from('poker_agents').select('id, name, wallet_address').limit(10);
    if (readErr) return res.json({ error: 'Read failed: ' + readErr.message, code: readErr.code, details: readErr.details });

    // If cache has agents but DB doesn't, do step-by-step save with full error visibility
    let writeTest = null;
    if (rooms.store.agentCache.length > 0 && agents.length === 0) {
      const testAgent = rooms.store.agentCache[0];
      const dbRow = rooms.store._toDbAgent(testAgent);
      const steps = {};

      // Step 1: Upsert wallet
      if (testAgent.walletAddress) {
        const walletRow = {
          address: testAgent.walletAddress.toLowerCase(),
          chip_balance: 0,
          created_at: new Date().toISOString()
        };
        const { error: wErr } = await rooms.store.supabase.from('poker_wallets').upsert(walletRow, { onConflict: 'address' });
        steps.walletUpsert = wErr ? { error: wErr.message, code: wErr.code, details: wErr.details, hint: wErr.hint, row: walletRow } : { success: true };
      }

      // Step 2: Upsert agent
      const { error: aErr } = await rooms.store.supabase.from('poker_agents').upsert(dbRow, { onConflict: 'id' });
      steps.agentUpsert = aErr ? { error: aErr.message, code: aErr.code, details: aErr.details, hint: aErr.hint } : { success: true };

      // Step 3: Re-read to verify
      const { data: check } = await rooms.store.supabase.from('poker_agents').select('id, name').eq('id', testAgent.id);
      steps.verify = check && check.length > 0 ? { found: true, row: check[0] } : { found: false };

      writeTest = { steps, dbRow };
    }

    res.json({ agentCount: agents.length, agents, cacheCount: rooms.store.agentCache.length, writeTest });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// View transaction history for a wallet
app.get('/debug/transactions', async (req, res) => {
  if (process.env.NODE_ENV === 'production' && !requireApiKey(req, res)) return;
  if (!rooms.store.supabase) return res.json({ error: 'No Supabase' });
  const addr = (req.query.wallet || '').toLowerCase();
  if (!addr) return res.json({ error: 'Pass ?wallet=0x...' });
  const { data, error } = await rooms.store.supabase
    .from('poker_transactions')
    .select('*')
    .eq('wallet_address', addr)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return res.json({ error: error.message });
  res.json({ count: data.length, transactions: data });
});

app.get('/debug/agents', (req, res) => {
  if (process.env.NODE_ENV === 'production' && !requireApiKey(req, res)) return;
  const storeAgents = rooms.store.agents || [];
  const lobbyMap = {};
  for (const [wallet, agents] of rooms.lobbyAgents) {
    lobbyMap[wallet] = agents.map(a => ({ id: a.id, name: a.name, chipStack: a.chipStack }));
  }
  res.json({ storeAgentCount: storeAgents.length, storeAgents: storeAgents.map(a => ({ id: a.id, name: a.name, wallet: a.walletAddress, chipStack: a.chipStack })), lobbyAgents: lobbyMap });
});

// Platform agent rebalancing admin endpoints
app.get('/platform/status', (req, res) => {
  const wallets = [...PLATFORM_WALLETS];
  const roomStats = {};
  for (const [roomId, room] of Object.entries(rooms.rooms)) {
    if (room.isSandbox) continue;
    roomStats[roomId] = room.tables.map(t => {
      let humans = 0, platform = 0;
      for (const a of t.agents) {
        if (!a.isCustom) continue;
        if (a.walletAddress && PLATFORM_WALLETS.has(a.walletAddress.toLowerCase())) platform++;
        else humans++;
      }
      return { tableId: t.tableId, humans, platform, total: t.agents.length, phase: t.phase };
    });
  }
  // Count lobby platform agents
  let lobbyPlatform = 0;
  for (const [addr, agents] of rooms.lobbyAgents) {
    if (PLATFORM_WALLETS.has(addr.toLowerCase())) lobbyPlatform += agents.length;
  }
  res.json({ platformWallets: wallets, lobbyPlatformAgents: lobbyPlatform, rooms: roomStats });
});

app.post('/platform/add-wallet', (req, res) => {
  if (!requireApiKey(req, res)) return;
  const { walletAddress } = req.body;
  if (!walletAddress) return res.json({ error: 'Missing walletAddress' });
  const addr = walletAddress.toLowerCase();
  PLATFORM_WALLETS.add(addr);
  console.log(`[Platform] Added platform wallet: ${addr}`);
  res.json({ success: true, platformWallets: [...PLATFORM_WALLETS] });
});

app.post('/platform/remove-wallet', (req, res) => {
  if (!requireApiKey(req, res)) return;
  const { walletAddress } = req.body;
  if (!walletAddress) return res.json({ error: 'Missing walletAddress' });
  const addr = walletAddress.toLowerCase();
  PLATFORM_WALLETS.delete(addr);
  console.log(`[Platform] Removed platform wallet: ${addr}`);
  res.json({ success: true, platformWallets: [...PLATFORM_WALLETS] });
});

app.post('/platform/rebalance', (req, res) => {
  if (!requireApiKey(req, res)) return;
  const roomId = req.body.roomId || 'micro';
  rooms._rebalanceRoom(roomId);
  res.json({ success: true, message: `Rebalanced room: ${roomId}` });
});

// Admin: credit chips to a wallet (for fixing lost-chip issues)
app.post('/admin/credit-wallet', async (req, res) => {
  if (!requireApiKey(req, res)) return;
  const { walletAddress, amount, reason } = req.body;
  if (!walletAddress || !amount || amount <= 0) return res.json({ error: 'Missing walletAddress or valid amount' });
  await rooms.store.addBalance(walletAddress, amount);
  const wallet = rooms.store.getWallet(walletAddress);
  console.log(`[Admin] Credited ${amount} chips to ${walletAddress} — reason: ${reason || 'manual fix'} — new balance: ${wallet ? wallet.balance : '?'}`);
  // Notify connected client
  for (const [ws, client] of clients) {
    if (client.walletAddress && client.walletAddress.toLowerCase() === walletAddress.toLowerCase() && ws.readyState === 1) {
      sendBalance(ws, walletAddress);
    }
  }
  res.json({ success: true, newBalance: wallet ? wallet.balance : 0 });
});

// =========== Server startup ===========

async function startServer() {
  // Initialize store — Supabase if configured, else JSON fallback
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    try {
      const { SupabaseStore } = require('./supabase-store');
      const store = new SupabaseStore(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
      await store.init();
      useSupabase = true;
      console.log('[Server] Using Supabase store');

      // Pass custom store to RoomManager
      rooms = new RoomManager((type, data) => broadcastToClients(type, data), store);
    } catch (e) {
      console.error('[Server] Supabase init failed, falling back to JSON:', e.message);
      rooms = new RoomManager((type, data) => broadcastToClients(type, data));
    }
  } else {
    console.log('[Server] Using JSON file store (set SUPABASE_URL + SUPABASE_SERVICE_KEY for Supabase)');
    rooms = new RoomManager((type, data) => broadcastToClients(type, data));
  }

  // Initialize reward engine — Round 1: 2.5B tokens (2.5% of 100B supply) over 90 days
  // ~0.028%/day sell pressure. Total rewards allocation = 25B (25% of supply).
  // Starting small and ramping up as platform matures + token price appreciates.
  // Round 1: 2.5B → Round 2: ramp to 10B (10%) → future rounds with remaining 12.5B
  rewardEngine = new RewardEngine({
    totalRewards: 2_500_000_000,
    durationDays: 90
  });
  rooms.rewardEngine = rewardEngine;
  console.log('[Server] Reward engine initialized — Round 1: 2.5B POKERAI over 90 days (2.5% of supply)');

  // Helper: update reward engine — ONLY count chips actively in play at tables
  // Idle wallet balance does NOT earn rewards (prevents deposit-and-farm abuse)
  function updateRewardsForWallet(walletAddress) {
    if (!rewardEngine || !walletAddress || walletAddress.startsWith('sandbox_')) return;
    const inPlay = rooms.getChipsInPlay(walletAddress);
    rewardEngine.updateWalletValue(walletAddress, inPlay, 'usdc');
  }

  // Set up auto-top-up balance change notifications
  rooms.onBalanceChange = (walletAddress) => {
    for (const [ws, client] of clients) {
      if (client.walletAddress === walletAddress && ws.readyState === 1) {
        sendBalance(ws, walletAddress);
      }
    }
    updateRewardsForWallet(walletAddress);
  };

  // Update rewards after every hand (chip values change)
  rooms.onHandComplete = (table) => {
    for (const agent of table.agents) {
      if (agent.isCustom && agent.walletAddress && !agent.walletAddress.startsWith('sandbox_')) {
        updateRewardsForWallet(agent.walletAddress);
      }
    }
  };

  // Notify clients when auto-top-up fires
  rooms.onAutoTopUp = (walletAddress, agentName, amount, newStack) => {
    for (const [ws, client] of clients) {
      if (client.walletAddress === walletAddress && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'autoTopUpNotify', data: { agentName, amount, newStack } }));
      }
    }
  };

  // Initialize chain service if configured
  if (process.env.VAULT_CONTRACT_ADDRESS && process.env.OPERATOR_PRIVATE_KEY && process.env.BASE_RPC_URL) {
    try {
      const { ChainService } = require('./chain');
      chain = new ChainService({
        rpcUrl: process.env.BASE_RPC_URL,
        vaultAddress: process.env.VAULT_CONTRACT_ADDRESS,
        operatorKey: process.env.OPERATOR_PRIVATE_KEY
      });

      // Listen for on-chain deposits → credit chips directly server-side
      chain.onDeposit = async (walletAddress, chips, usdcRaw) => {
        console.log(`[Chain] Deposit event: ${walletAddress} → ${chips} chips — checking and crediting`);
        try {
          const stats = await chain.vault.playerStats(walletAddress);
          const onChainChips = Math.floor((Number(stats[0]) * 10000) / 1e6);
          const withdrawnChips = Math.floor((Number(stats[1]) * 10000) / 1e6);
          const expected = onChainChips - withdrawnChips;
          const wallet = await rooms.store.getOrCreateWallet(walletAddress);
          const inPlay = rooms.getChipsInPlay(walletAddress);
          const total = wallet.balance + inPlay;
          if (expected > total) {
            const credit = expected - total;
            await rooms.store.addBalance(walletAddress, credit);
            await rooms.store.recordTransaction(walletAddress, 'deposit', Math.floor(credit / 10000 * 1e6), credit);
            console.log(`[Chain] Credited ${credit} chips to ${walletAddress}`);
            // Notify connected client
            for (const [ws, client] of clients) {
              if (client.walletAddress === walletAddress && ws.readyState === 1) {
                sendBalance(ws, walletAddress);
                ws.send(JSON.stringify({ type: 'depositConfirmed', data: { chips: credit, usdcAmount: credit / 10000 } }));
              }
            }
          }
        } catch (e) {
          console.error('[Chain] Deposit credit failed:', e.message);
          // Fallback: notify client to trigger re-check via setWallet
          for (const [ws, client] of clients) {
            if (client.walletAddress === walletAddress && ws.readyState === 1) {
              ws.send(JSON.stringify({ type: 'depositDetected', data: { chips, usdcAmount: usdcRaw / 1e6 } }));
            }
          }
        }
      };

      chain.startListening();
      rooms.chainService = chain;
      console.log('[Server] Chain service active — rake recording enabled');
    } catch (e) {
      console.error('[Server] Chain init failed:', e.message);
    }
  } else {
    console.log('[Server] Chain not configured (set VAULT_CONTRACT_ADDRESS, OPERATOR_PRIVATE_KEY, BASE_RPC_URL)');
  }

  // Broadcast rewards updates to connected wallets every 10s
  setInterval(() => {
    if (!rewardEngine) return;
    for (const [ws, client] of clients) {
      if (ws.readyState === 1 && client.walletAddress && !client.walletAddress.startsWith('sandbox_')) {
        try {
          // Recalculate wallet value (balance + chips in play) before reading rewards
          updateRewardsForWallet(client.walletAddress);
          const rewards = rewardEngine.getWalletRewards(client.walletAddress);
          const stats = rewardEngine.getStats();
          ws.send(JSON.stringify({ type: 'rewardsUpdate', data: { ...rewards, tvl: stats.tvl, emission: stats.emission } }));
        } catch (e) { /* ignore */ }
      }
    }
  }, 10000);

  server.listen(PORT, () => {
    console.log(`PokerAI server v5 running on port ${PORT} — 3 rooms, ${useSupabase ? 'Supabase' : 'JSON'} store, chain: ${!!chain}, rewards: ${!!rewardEngine}`);
    rooms.start();
  });
}

function broadcastToClients(type, data) {
  if (type === 'gameState') {
    const sourceRoom = data ? data.roomId : null;
    for (const [ws, client] of clients) {
      if (ws.readyState === 1) {
        if (sourceRoom && client.activeRoom !== sourceRoom) continue;
        try {
          const state = rooms.getStateForClient(client.sessionId, getClientWallet(client), client.activeRoom, client.activeTableId);
          ws.send(JSON.stringify({ type: 'gameState', data: state }));
        } catch (e) { /* client disconnected */ }
      }
    }
  } else {
    const msg = JSON.stringify({ type, data });
    for (const [ws, client] of clients) {
      if (ws.readyState === 1) {
        if (data && data.roomId && client.activeRoom !== data.roomId) continue;
        try { ws.send(msg); } catch (e) { /* ignore */ }
      }
    }
  }
}

startServer().catch(e => {
  console.error('Failed to start server:', e);
  process.exit(1);
});
