require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { RoomManager, PLATFORM_WALLETS } = require('./room-manager');
const { createChallenge, verifySignature, getChallengeMessage } = require('./wallet-auth');

// Optional: chain + supabase (graceful fallback to JSON store if not configured)
let chain = null;
let useSupabase = false;

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    /https:\/\/.*\.vercel\.app$/,
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

let rooms; // initialized in startServer()

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
        const state = rooms.getStateForClient(client.sessionId, getClientWallet(client), client.activeRoom);
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
          client.authenticated = !!client.walletAddress;
          if (client.walletAddress) {
            // Use async getOrCreateWallet so balance loads from Supabase on fresh restart
            const wallet = await rooms.store.getOrCreateWallet(client.walletAddress);
            ws.send(JSON.stringify({ type: 'walletBalance', data: { balance: wallet.balance } }));

            // Also check on-chain deposits in background (credits if server missed any)
            if (chain) {
              try {
                const stats = await chain.vault.playerStats(client.walletAddress);
                const onChainChips = Math.floor((Number(stats[0]) * 10000) / 1e6);
                const withdrawnChips = Math.floor((Number(stats[1]) * 10000) / 1e6);
                const expected = onChainChips - withdrawnChips;
                const inPlay = rooms.getChipsInPlay(client.walletAddress);
                const total = wallet.balance + inPlay;
                if (expected > total) {
                  const credit = expected - total;
                  await rooms.store.addBalance(client.walletAddress, credit);
                  await rooms.store.recordTransaction(client.walletAddress, 'deposit', Math.floor(credit / 10000 * 1e6), credit);
                  sendBalance(ws, client.walletAddress);
                  ws.send(JSON.stringify({ type: 'depositConfirmed', data: { chips: credit } }));
                }
              } catch (e) { /* silent — check-deposit HTTP fallback still available */ }
            }
          }
          const s = rooms.getStateForClient(client.sessionId, getClientWallet(client), client.activeRoom);
          ws.send(JSON.stringify({ type: 'gameState', data: s }));
          break;
        }

        case 'subscribeRoom': {
          const roomId = msg.roomId || 'micro';
          if (['sandbox', 'micro', 'mid', 'high'].includes(roomId)) {
            client.activeRoom = roomId;
            const s = rooms.getStateForClient(client.sessionId, getClientWallet(client), roomId);
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
          const addr = getClientWallet(client);
          const roomId = msg.roomId || 'micro';
          const result = rooms.joinRoom(addr, msg.agentId, roomId, msg.chipStack);
          ws.send(JSON.stringify({ type: 'joinTableResult', data: result }));
          if (result.success) {
            client.activeRoom = roomId;
            if (!isSandbox) sendBalance(ws, addr);
          }
          broadcastStateToAll();
          break;
        }

        case 'topUp': {
          if (!requireAuth(client, ws)) break;
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

          if (!chips || chips < 1000) {
            ws.send(JSON.stringify({ type: 'withdrawUsdcResult', data: { error: 'Minimum withdrawal: 1,000 chips ($0.10)' } }));
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

// Check on-chain deposit and credit if missing (fallback for missed events)
app.post('/check-deposit', async (req, res) => {
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
  const { walletAddress } = req.body;
  if (!walletAddress) return res.json({ error: 'Missing walletAddress' });
  const addr = walletAddress.toLowerCase();
  PLATFORM_WALLETS.add(addr);
  console.log(`[Platform] Added platform wallet: ${addr}`);
  res.json({ success: true, platformWallets: [...PLATFORM_WALLETS] });
});

app.post('/platform/remove-wallet', (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) return res.json({ error: 'Missing walletAddress' });
  const addr = walletAddress.toLowerCase();
  PLATFORM_WALLETS.delete(addr);
  console.log(`[Platform] Removed platform wallet: ${addr}`);
  res.json({ success: true, platformWallets: [...PLATFORM_WALLETS] });
});

app.post('/platform/rebalance', (req, res) => {
  const roomId = req.body.roomId || 'micro';
  rooms._rebalanceRoom(roomId);
  res.json({ success: true, message: `Rebalanced room: ${roomId}` });
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

  // Set up auto-top-up balance change notifications
  rooms.onBalanceChange = (walletAddress) => {
    for (const [ws, client] of clients) {
      if (client.walletAddress === walletAddress && ws.readyState === 1) {
        sendBalance(ws, walletAddress);
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

      // Listen for on-chain deposits → notify client to call /check-deposit
      // NOTE: Do NOT credit chips here — /check-deposit handles crediting
      // to avoid double-counting
      chain.onDeposit = async (walletAddress, chips, usdcRaw) => {
        console.log(`[Chain] Deposit event: ${walletAddress} → ${chips} chips (notifying client to verify)`);

        // Notify connected client to trigger /check-deposit
        for (const [ws, client] of clients) {
          if (client.walletAddress === walletAddress && ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'depositDetected', data: { chips, usdcAmount: usdcRaw / 1e6 } }));
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

  server.listen(PORT, () => {
    console.log(`PokerAI server v5 running on port ${PORT} — 3 rooms, ${useSupabase ? 'Supabase' : 'JSON'} store, chain: ${!!chain}`);
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
          const state = rooms.getStateForClient(client.sessionId, getClientWallet(client), client.activeRoom);
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
