require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { RoomManager } = require('./room-manager');
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
            const wallet = rooms.getWalletBalance(client.walletAddress);
            ws.send(JSON.stringify({ type: 'walletBalance', data: { balance: wallet.balance } }));
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
            sendBalance(ws, addr);
            broadcastStateToAll();
          }
          break;
        }

        case 'leaveTable': {
          const addr = getClientWallet(client);
          if (client.walletAddress && !requireAuth(client, ws)) break;
          const result = rooms.leaveTable(addr, msg.agentId);
          ws.send(JSON.stringify({ type: 'leaveTableResult', data: result }));
          broadcastStateToAll();
          break;
        }

        case 'recallAgent': {
          const addr = getClientWallet(client);
          if (client.walletAddress && !requireAuth(client, ws)) break;
          const result = rooms.deleteAgent(addr, msg.agentId);
          ws.send(JSON.stringify({ type: 'recallAgentResult', data: result }));
          if (result.success && client.walletAddress) sendBalance(ws, addr);
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
app.get('/health', async (req, res) => {
  const vaultStats = chain ? await chain.getVaultStats() : null;
  res.json({
    status: 'ok',
    version: 6,
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

      // Listen for on-chain deposits → credit chips
      chain.onDeposit = async (walletAddress, chips, usdcRaw) => {
        await rooms.store.getOrCreateWallet(walletAddress);
        await rooms.store.addBalance(walletAddress, chips);
        console.log(`[Chain] Credited ${chips} chips to ${walletAddress}`);

        // Notify connected client
        for (const [ws, client] of clients) {
          if (client.walletAddress === walletAddress && ws.readyState === 1) {
            sendBalance(ws, walletAddress);
            ws.send(JSON.stringify({ type: 'depositConfirmed', data: { chips, usdcAmount: usdcRaw / 1e6 } }));
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
