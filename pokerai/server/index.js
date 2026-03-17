require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { RoomManager, PLATFORM_WALLETS } = require('./room-manager');
const { createChallenge, verifySignature, getChallengeMessage } = require('./wallet-auth');
const { RewardEngine } = require('./reward-engine');

// Crash handlers — keep server alive on random errors
process.on('uncaughtException', (err) => {
  console.error('[CRASH] Uncaught exception:', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('[CRASH] Unhandled rejection:', reason);
});

// Optional: chain + supabase (graceful fallback to JSON store if not configured)
let chain = null;
let tokenChain = null; // POKERAI token vault + rewards
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

// Per-wallet withdrawal locks to prevent race conditions
const withdrawalsInProgress = new Set();
const pokeraiWithdrawalsInProgress = new Set();

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
  if (!walletAddress || ws.readyState !== 1) return;
  const wallet = rooms.getWalletBalance(walletAddress);
  ws.send(JSON.stringify({ type: 'walletBalance', data: {
    balance: wallet.balance,
    pokeraiBalance: wallet.pokeraiBalance || 0,
    isPlatformWallet: PLATFORM_WALLETS.has(walletAddress.toLowerCase())
  }}));
}

// Check if a wallet action requires a connected wallet
function requireAuth(client, ws) {
  if (!client.walletAddress) {
    ws.send(JSON.stringify({ type: 'error', data: { message: 'Connect wallet first' } }));
    return false;
  }
  return true;
}

// Heartbeat — prune dead WebSocket connections every 30s
setInterval(() => {
  for (const [ws, client] of clients) {
    if (ws._isAlive === false) {
      clients.delete(ws);
      ws.terminate();
      continue;
    }
    ws._isAlive = false;
    try { ws.ping(); } catch (e) { /* ignore */ }
  }
}, 30000);

wss.on('connection', (ws) => {
  ws._isAlive = true;
  ws.on('pong', () => { ws._isAlive = true; });
  ws.on('error', (err) => { console.error('[WS] Connection error:', err.message); });

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

            // Get or create wallet (starts at 0 chips — must deposit)
            const wallet = rooms.getWalletBalance(addr);
            ws.send(JSON.stringify({ type: 'authenticated', data: { address: addr, balance: wallet.balance, pokeraiBalance: wallet.pokeraiBalance || 0, isPlatformWallet: PLATFORM_WALLETS.has(addr) } }));

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
            ws.send(JSON.stringify({ type: 'walletBalance', data: { balance: wallet.balance, pokeraiBalance: wallet.pokeraiBalance || 0, isPlatformWallet: PLATFORM_WALLETS.has(client.walletAddress) } }));

            // Deposits are credited via real-time chain event listener (chain.onDeposit).
            // No sync/reconciliation here — that caused phantom credits on reconnect.
          }
          // Update reward engine with this wallet's chips in play (split by currency)
          if (rewardEngine && client.walletAddress) {
            const { usdc: ipUsdc, pokerai: ipPokerai } = rooms.getChipsInPlayByCurrency(client.walletAddress);
            rewardEngine.updateWalletValue(client.walletAddress, ipUsdc, 'usdc');
            rewardEngine.updateWalletValue(client.walletAddress, ipPokerai, 'pokerai');
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
          if (['sandbox', 'micro', 'mid', 'high', 'pokerai_micro', 'pokerai_mid', 'pokerai_high'].includes(roomId)) {
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
          const currency = msg.currency || 'usdc';
          const result = rooms.fundLobbyAgent(addr, msg.agentId, msg.amount, currency);
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
          if (msg.amount !== undefined && !isValidPositiveNumber(msg.amount)) {
            ws.send(JSON.stringify({ type: 'defundAgentResult', data: { error: 'Invalid amount' } }));
            break;
          }
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

        case 'checkDeposit': {
          // Reconcile: compare on-chain GROSS deposits vs total deposit credits ever given
          // (Old logic used net deposits which broke when users withdrew admin-credited chips)
          if (!requireAuth(client, ws)) break;
          if (!chain) { ws.send(JSON.stringify({ type: 'checkDepositResult', data: { error: 'Chain not configured' } })); break; }
          try {
            const addr = client.walletAddress;
            const stats = await chain.playerStats(addr); // resilient call with fallback RPCs
            const onChainDepositedChips = Math.floor((Number(stats[0]) * 10000) / 1e6);

            // How many chips have we EVER credited for deposits? (from poker_transactions table)
            const dbCredited = rooms.store.getTotalDepositedChips
              ? await rooms.store.getTotalDepositedChips(addr)
              : 0;

            // If on-chain gross deposits > total credits ever given, chips are missing
            if (onChainDepositedChips > dbCredited && onChainDepositedChips - dbCredited >= 100) {
              const credit = onChainDepositedChips - dbCredited;
              await rooms.store.addBalance(addr, credit);
              await rooms.store.recordTransaction(addr, 'deposit', Math.floor(credit / 10000 * 1e6), credit);
              sendBalance(ws, addr);
              ws.send(JSON.stringify({ type: 'checkDepositResult', data: { credited: credit } }));
              console.log(`[CheckDeposit] Credited ${credit} chips to ${addr} (on-chain gross: ${onChainDepositedChips}, db credits: ${dbCredited})`);
            } else {
              const walletBal = rooms.getWalletBalance(addr).balance || 0;
              const agentChips = rooms.getChipsInPlay(addr) || 0;
              // Always send fresh balance so client stays in sync
              sendBalance(ws, addr);
              ws.send(JSON.stringify({ type: 'checkDepositResult', data: { credited: 0, message: 'Balance is correct' } }));
              console.log(`[CheckDeposit] ${addr} OK — on-chain gross: ${onChainDepositedChips}, db credits: ${dbCredited}, wallet: ${walletBal}, agents: ${agentChips}`);
            }
          } catch (e) {
            console.error('[CheckDeposit] Failed:', e.message);
            ws.send(JSON.stringify({ type: 'checkDepositResult', data: { error: 'RPC error — try again in a moment' } }));
          }
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

        case 'adminCredit': {
          if (!requireAuth(client, ws)) break;
          const addr = client.walletAddress;
          if (!PLATFORM_WALLETS.has(addr)) {
            ws.send(JSON.stringify({ type: 'adminCreditResult', data: { error: 'Not a platform wallet' } }));
            break;
          }
          const amount = msg.amount;
          if (!isValidPositiveNumber(amount) || amount > 1000000) {
            ws.send(JSON.stringify({ type: 'adminCreditResult', data: { error: 'Invalid amount (max 1M)' } }));
            break;
          }
          await rooms.store.addBalance(addr, amount);
          rooms.store.recordTransaction(addr, 'admin_credit', 0, amount);
          sendBalance(ws, addr);
          ws.send(JSON.stringify({ type: 'adminCreditResult', data: { success: true, amount } }));
          console.log(`[Admin] Platform wallet ${addr.slice(0,8)} self-credited ${amount} chips`);
          break;
        }

        case 'setEmission': {
          if (!requireAuth(client, ws)) break;
          const addr = client.walletAddress;
          if (!PLATFORM_WALLETS.has(addr)) {
            ws.send(JSON.stringify({ type: 'setEmissionResult', data: { error: 'Not a platform wallet' } }));
            break;
          }
          if (!rewardEngine) {
            ws.send(JSON.stringify({ type: 'setEmissionResult', data: { error: 'Reward engine not initialized' } }));
            break;
          }
          const tr = msg.totalRewards;
          const dd = msg.durationDays;
          if (tr === undefined || !dd || dd <= 0) {
            ws.send(JSON.stringify({ type: 'setEmissionResult', data: { error: 'Need totalRewards and durationDays' } }));
            break;
          }
          rewardEngine.setEmission(tr, dd, msg.usdcSplit, msg.pokeraiSplit);
          ws.send(JSON.stringify({ type: 'setEmissionResult', data: { success: true, config: rewardEngine.getEmissionConfig() } }));
          console.log(`[Admin] Emission updated by ${addr.slice(0,8)}: ${tr.toLocaleString()} over ${dd} days`);
          break;
        }

        case 'getEmission': {
          if (!requireAuth(client, ws)) break;
          if (!rewardEngine) {
            ws.send(JSON.stringify({ type: 'emissionConfig', data: { totalRewards: 0, durationDays: 0, active: false } }));
            break;
          }
          ws.send(JSON.stringify({ type: 'emissionConfig', data: rewardEngine.getEmissionConfig() }));
          break;
        }

        case 'getAdminDashboard': {
          if (!requireAuth(client, ws)) break;
          const addr = client.walletAddress;
          if (!PLATFORM_WALLETS.has(addr)) {
            ws.send(JSON.stringify({ type: 'adminDashboard', data: { error: 'Not a platform wallet' } }));
            break;
          }
          const wallet = rooms.getWalletBalance(addr);
          const agents = rooms.getAgentsForWallet(addr);
          const chipsInPlay = agents.filter(a => a.status === 'playing').reduce((s, a) => s + (a.chips || 0), 0);
          const chipsInLobby = agents.filter(a => a.status === 'lobby').reduce((s, a) => s + (a.chipStack || 0), 0);
          const totalAgentChips = chipsInPlay + chipsInLobby;

          // Compute global rake from all tables
          let globalTotalRake = 0;
          const roomBreakdown = {};
          for (const [roomId, room] of Object.entries(rooms.rooms)) {
            if (room.isSandbox) continue;
            let agentCount = 0, roomChips = 0, tableCount = room.tables.length;
            for (const table of room.tables) {
              globalTotalRake += table.totalRake || 0;
              for (const a of table.agents) {
                if (a.isCustom) { agentCount++; roomChips += a.chips || 0; }
              }
            }
            roomBreakdown[roomId] = { name: room.name, agentCount, totalChips: roomChips, tableCount, bb: room.bb };
          }

          const autoTopUp = rooms.getAutoTopUp(addr);
          ws.send(JSON.stringify({
            type: 'adminDashboard',
            data: {
              walletBalance: wallet.balance,
              chipsInPlay,
              chipsInLobby,
              totalAgentChips,
              totalSystemChips: wallet.balance + totalAgentChips,
              pendingRake: rooms.pendingRakeChips || 0,
              globalTotalRake,
              totalHands: rooms.totalHandsPlayed,
              autoTopUp,
              agents,
              rooms: roomBreakdown,
              viewers: clients.size,
              emission: rewardEngine ? rewardEngine.getEmissionConfig() : null,
              timestamp: Date.now()
            }
          }));
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

          // Verify wallet signature on withdrawal request
          if (!msg.signature || !msg.message) {
            ws.send(JSON.stringify({ type: 'withdrawUsdcResult', data: { error: 'Signature required for withdrawals' } }));
            break;
          }
          try {
            const recovered = require('ethers').verifyMessage(msg.message, msg.signature);
            if (recovered.toLowerCase() !== addr) {
              ws.send(JSON.stringify({ type: 'withdrawUsdcResult', data: { error: 'Signature does not match wallet' } }));
              break;
            }
          } catch (e) {
            ws.send(JSON.stringify({ type: 'withdrawUsdcResult', data: { error: 'Invalid signature' } }));
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

        case 'withdrawPokerai': {
          if (!requireAuth(client, ws)) break;
          const addr = client.walletAddress;
          const chips = msg.chips;

          if (!isValidPositiveNumber(chips)) {
            ws.send(JSON.stringify({ type: 'withdrawPokeraiResult', data: { error: 'Invalid chip amount' } }));
            break;
          }

          // Verify wallet signature
          if (!msg.signature || !msg.message) {
            ws.send(JSON.stringify({ type: 'withdrawPokeraiResult', data: { error: 'Signature required for withdrawals' } }));
            break;
          }
          try {
            const recovered = require('ethers').verifyMessage(msg.message, msg.signature);
            if (recovered.toLowerCase() !== addr) {
              ws.send(JSON.stringify({ type: 'withdrawPokeraiResult', data: { error: 'Signature does not match wallet' } }));
              break;
            }
          } catch (e) {
            ws.send(JSON.stringify({ type: 'withdrawPokeraiResult', data: { error: 'Invalid signature' } }));
            break;
          }

          if (chips < 10) {
            ws.send(JSON.stringify({ type: 'withdrawPokeraiResult', data: { error: 'Minimum withdrawal: 10 chips (10 POKERAI)' } }));
            break;
          }

          // Separate lock for POKERAI withdrawals
          if (pokeraiWithdrawalsInProgress.has(addr)) {
            ws.send(JSON.stringify({ type: 'withdrawPokeraiResult', data: { error: 'POKERAI withdrawal already in progress' } }));
            break;
          }

          // Check POKERAI balance (not USDC)
          const wallet = rooms.getWalletBalance(addr);
          const pokeraiBal = wallet.pokeraiBalance || 0;
          if (pokeraiBal < chips) {
            ws.send(JSON.stringify({ type: 'withdrawPokeraiResult', data: { error: `Not enough POKERAI chips. You have ${pokeraiBal.toLocaleString()}` } }));
            break;
          }

          if (!tokenChain) {
            ws.send(JSON.stringify({ type: 'withdrawPokeraiResult', data: { error: 'POKERAI withdrawals not yet enabled' } }));
            break;
          }

          pokeraiWithdrawalsInProgress.add(addr);
          try {
            rooms.store.deductBalance(addr, chips, 'pokerai');
            const txResult = await tokenChain.processWithdraw(addr, chips);
            if (txResult.error) {
              rooms.store.addBalance(addr, chips, 'pokerai');
              ws.send(JSON.stringify({ type: 'withdrawPokeraiResult', data: { error: txResult.error } }));
            } else {
              await rooms.store.recordTransaction(addr, 'withdraw_pokerai', 0, chips, txResult.txHash);
              ws.send(JSON.stringify({ type: 'withdrawPokeraiResult', data: txResult }));
              sendBalance(ws, addr);
            }
          } finally {
            pokeraiWithdrawalsInProgress.delete(addr);
          }
          break;
        }

        case 'checkDepositPokerai': {
          if (!requireAuth(client, ws)) break;
          if (!tokenChain || !tokenChain.vaultReadOnly) {
            ws.send(JSON.stringify({ type: 'checkDepositPokeraiResult', data: { error: 'POKERAI vault not configured' } }));
            break;
          }
          try {
            const addr = client.walletAddress;
            const stats = await tokenChain.getPlayerDepositStats(addr);
            const onChainDeposited = Math.floor(parseFloat(stats.deposited)); // already in chips (1:1)
            // Use POKERAI-specific deposit tracker (not USDC deposits!)
            const alreadyCredited = rooms.store.getTotalDepositedPokeraiChips
              ? await rooms.store.getTotalDepositedPokeraiChips(addr)
              : 0;
            const diff = onChainDeposited - alreadyCredited;
            if (diff >= 1) {
              const credit = diff;
              await rooms.store.addBalance(addr, credit, 'pokerai');
              await rooms.store.recordTransaction(addr, 'deposit_pokerai', 0, credit);
              sendBalance(ws, addr);
              ws.send(JSON.stringify({ type: 'checkDepositPokeraiResult', data: { credited: credit } }));
              console.log(`[CheckDepositPokerai] Credited ${credit} POKERAI chips to ${addr}`);
            } else {
              sendBalance(ws, addr);
              ws.send(JSON.stringify({ type: 'checkDepositPokeraiResult', data: { credited: 0, message: 'POKERAI balance is correct' } }));
            }
          } catch (e) {
            ws.send(JSON.stringify({ type: 'checkDepositPokeraiResult', data: { error: e.message } }));
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
          const result = rooms.setAutoTopUp(addr, {
            enabled: msg.enabled,
            targetChips: msg.targetChips,
            cashOutAt: msg.cashOutAt,
            maxTopUps: msg.maxTopUps || 0
          });
          ws.send(JSON.stringify({ type: 'autoTopUpResult', data: result }));
          break;
        }

        // === Agent Stats ===
        case 'getAgentStats': {
          if (!requireAuth(client, ws)) break;
          const stats = await rooms.computeAgentStats(msg.agentId, !!msg.includeSandbox);
          ws.send(JSON.stringify({ type: 'agentStats', agentId: msg.agentId, data: stats, includeSandbox: !!msg.includeSandbox }));
          break;
        }

        case 'resetLearning': {
          if (!requireAuth(client, ws)) break;
          const agentId = msg.agentId;
          // Clear learned traits on the live agent
          for (const [, room] of Object.entries(rooms.rooms)) {
            for (const table of room.tables) {
              const agent = table.agents.find(a => a.id === agentId);
              if (agent && agent.traits) {
                agent.traits.learned = {};
              }
            }
          }
          // Also clear in lobby agents
          const lobbyAgent = rooms.lobby.find(a => a.id === agentId);
          if (lobbyAgent && lobbyAgent.traits) lobbyAgent.traits.learned = {};
          // Persist
          if (rooms.store.saveLearnedTraits) {
            await rooms.store.saveLearnedTraits(agentId, {});
          }
          ws.send(JSON.stringify({ type: 'resetLearningResult', agentId, success: true }));
          break;
        }

        // === Backing (stake on other agents) ===
        case 'backAgent': {
          if (!requireAuth(client, ws)) break;
          if (!isValidPositiveNumber(msg.amount)) {
            ws.send(JSON.stringify({ type: 'backAgentResult', data: { error: 'Invalid amount' } }));
            break;
          }
          const addr = client.walletAddress;
          const result = await rooms.backAgent(addr, msg.agentId, msg.amount);
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
            const onChain = tokenChain && tokenChain.rewardsReadOnly;
            // Server signs authorization → client submits tx and pays gas
            if (onChain) {
              const signResult = await tokenChain.signClaimAuthorization(addr, claimable);
              if (signResult.error) {
                ws.send(JSON.stringify({ type: 'claimPokeraiResult', data: { error: signResult.error } }));
                break;
              }
              // Record claim immediately — nonce prevents double-claim on-chain
              rewardEngine.recordClaim(addr, claimable);
              ws.send(JSON.stringify({
                type: 'claimPokeraiResult',
                data: {
                  success: true,
                  claimed: claimable,
                  // Client needs these to call contract.claim() from their wallet
                  signature: signResult.signature,
                  amount: signResult.amount,
                  nonce: signResult.nonce,
                  rewardsAddress: signResult.rewardsAddress
                }
              }));
              console.log(`[Rewards] ${addr} signed claim for ${claimable.toFixed(2)} POKERAI (nonce: ${signResult.nonce})`);
            } else {
              // Test mode — no on-chain contract, record claim directly
              rewardEngine.recordClaim(addr, claimable);
              ws.send(JSON.stringify({ type: 'claimPokeraiResult', data: { success: true, claimed: claimable, testMode: true } }));
              console.log(`[Rewards] ${addr} claimed ${claimable.toFixed(2)} POKERAI (TEST MODE — no on-chain tx)`);
            }
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
  // Timeout wrapper — don't let RPC calls hang the health endpoint
  const withTimeout = (p, ms = 10000) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
  const vaultStats = chain ? await withTimeout(chain.getVaultStats()) : null;
  const tokenVaultStats = tokenChain ? await withTimeout(tokenChain.getVaultStats()) : null;
  const rewardStats = tokenChain ? await withTimeout(tokenChain.getRewardStats().catch(() => null)) : null;
  res.json({
    status: 'ok',
    version: 11,
    viewers: clients.size,
    handsPlayed: rooms.totalHandsPlayed,
    rooms: rooms.getRoomsSummary(),
    vault: vaultStats,
    tokenVault: tokenVaultStats,
    rewardPool: rewardStats,
    chain: !!chain,
    tokenChain: !!tokenChain,
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
// Diagnostic: compare on-chain deposits vs server balance (read-only, no auto-credit)
app.post('/check-deposit', async (req, res) => {
  if (!requireApiKey(req, res)) return;
  if (!chain) return res.json({ error: 'Chain not configured' });
  const { walletAddress } = req.body;
  if (!walletAddress) return res.json({ error: 'Missing walletAddress' });

  const addr = walletAddress.toLowerCase();
  try {
    const stats = await chain.vault.playerStats(addr);
    const onChainDeposited = Number(stats[0]);
    const onChainWithdrawn = Number(stats[1]);
    const onChainChips = Math.floor((onChainDeposited * 10000) / 1e6);
    const withdrawnChips = Math.floor((onChainWithdrawn * 10000) / 1e6);

    const wallet = await rooms.store.getOrCreateWallet(addr);
    const serverBalance = wallet.balance || 0;
    const inPlay = rooms.getChipsInPlay(addr);
    const inLobby = rooms.getChipsInLobby(addr);
    const totalServer = serverBalance + inPlay + inLobby;
    const netOnChain = onChainChips - withdrawnChips;

    res.json({
      onChain: { deposited: onChainChips, withdrawn: withdrawnChips, net: netOnChain },
      server: { wallet: serverBalance, inPlay, inLobby, total: totalServer },
      delta: totalServer - netOnChain
    });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// Sync wallet balance to match on-chain reality
// Diagnostic: same as check-deposit (kept for backwards compat, read-only)
app.post('/sync-balance', async (req, res) => {
  if (!requireApiKey(req, res)) return;
  if (!chain) return res.json({ error: 'Chain not configured' });
  const { walletAddress } = req.body;
  if (!walletAddress) return res.json({ error: 'Missing walletAddress' });
  const addr = walletAddress.toLowerCase();

  try {
    const stats = await chain.vault.playerStats(addr);
    const depositedChips = Math.floor((Number(stats[0]) * 10000) / 1e6);
    const withdrawnChips = Math.floor((Number(stats[1]) * 10000) / 1e6);
    const wallet = await rooms.store.getOrCreateWallet(addr);
    const inPlay = rooms.getChipsInPlay(addr);
    const inLobby = rooms.getChipsInLobby(addr);
    const totalServer = wallet.balance + inPlay + inLobby;
    const onChainNet = depositedChips - withdrawnChips;

    res.json({
      onChain: { deposited: depositedChips, withdrawn: withdrawnChips, net: onChainNet },
      server: { wallet: wallet.balance, inPlay, inLobby, total: totalServer },
      delta: totalServer - onChainNet
    });
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

// Admin: get current emission config
app.get('/admin/emission', (req, res) => {
  if (!requireApiKey(req, res)) return;
  if (!rewardEngine) return res.json({ error: 'Reward engine not initialized' });
  res.json(rewardEngine.getEmissionConfig());
});

// Admin: set emission dynamically
app.post('/admin/set-emission', (req, res) => {
  if (!requireApiKey(req, res)) return;
  if (!rewardEngine) return res.json({ error: 'Reward engine not initialized' });
  const { totalRewards, durationDays, usdcSplit, pokeraiSplit } = req.body;
  if (totalRewards === undefined || !durationDays || durationDays <= 0) {
    return res.json({ error: 'Required: totalRewards (number), durationDays (positive number)' });
  }
  rewardEngine.setEmission(totalRewards, durationDays, usdcSplit, pokeraiSplit);
  res.json({ success: true, config: rewardEngine.getEmissionConfig() });
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

  // Initialize reward engine — starts with 0 emission (admin sets it dynamically)
  // Emission config is persisted in snapshot and restored on restart.
  // Platform wallets excluded from earning rewards (they get rake auto-fed back).
  rewardEngine = new RewardEngine({
    totalRewards: 0,
    durationDays: 90,
    excludedWallets: [...PLATFORM_WALLETS]
  });
  rooms.rewardEngine = rewardEngine;

  // Restore reward engine state from disk (survives restarts)
  const REWARD_SNAPSHOT_PATH = path.join(__dirname, 'reward-snapshot.json');
  try {
    if (fs.existsSync(REWARD_SNAPSHOT_PATH)) {
      const snapshot = JSON.parse(fs.readFileSync(REWARD_SNAPSHOT_PATH, 'utf8'));
      rewardEngine.loadSnapshot(snapshot);
      console.log('[Server] Reward engine restored from snapshot');
    }
  } catch (e) { console.error('[Server] Failed to load reward snapshot:', e.message); }

  // Save snapshot every 5 minutes
  rewardEngine.startSnapshots((snapshot) => {
    try { fs.writeFileSync(REWARD_SNAPSHOT_PATH, JSON.stringify(snapshot)); }
    catch (e) { console.error('[Server] Reward snapshot write failed:', e.message); }
  }, 300000);

  console.log(`[Server] Reward engine initialized — emission starts at 0, admin sets via /admin/set-emission. Excluded wallets: ${PLATFORM_WALLETS.size}`);

  // Helper: update reward engine — ONLY count chips actively in play at tables
  // Idle wallet balance does NOT earn rewards (prevents deposit-and-farm abuse)
  function updateRewardsForWallet(walletAddress) {
    if (!rewardEngine || !walletAddress || walletAddress.startsWith('sandbox_')) return;
    const { usdc, pokerai } = rooms.getChipsInPlayByCurrency(walletAddress);
    rewardEngine.updateWalletValue(walletAddress, usdc, 'usdc');
    rewardEngine.updateWalletValue(walletAddress, pokerai, 'pokerai');
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
    console.log(`PokerAI server running on port ${PORT} — ${useSupabase ? 'Supabase' : 'JSON'} store, rewards: ${!!rewardEngine}`);
    rooms.start();

    // Initialize chain services AFTER server is listening (non-blocking)
    // This ensures health check passes even if RPC is slow/rate-limited
    initChainServices().catch(e => console.error('[Server] Chain init error:', e.message));
  });
}

async function initChainServices() {
  // USDC chain service
  if (process.env.VAULT_CONTRACT_ADDRESS && process.env.OPERATOR_PRIVATE_KEY && process.env.BASE_RPC_URL) {
    try {
      const { ChainService } = require('./chain');
      chain = new ChainService({
        rpcUrl: process.env.BASE_RPC_URL,
        vaultAddress: process.env.VAULT_CONTRACT_ADDRESS,
        operatorKey: process.env.OPERATOR_PRIVATE_KEY
      });

      chain.onDeposit = async (walletAddress, chips, usdcRaw) => {
        console.log(`[Chain] Deposit event: ${walletAddress} → ${chips} chips (${usdcRaw / 1e6} USDC)`);
        try {
          // Deduplicate: compare on-chain gross deposits vs total credits in DB
          // Only credit the DIFFERENCE to avoid double-crediting replayed events
          const stats = await chain.playerStats(walletAddress);
          const onChainTotal = Math.floor((Number(stats[0]) * 10000) / 1e6);
          const dbCredited = rooms.store.getTotalDepositedChips
            ? await rooms.store.getTotalDepositedChips(walletAddress)
            : 0;
          const diff = onChainTotal - dbCredited;
          if (diff < 100) {
            console.log(`[Chain] Deposit event for ${walletAddress} already credited (on-chain: ${onChainTotal}, db: ${dbCredited}) — skipping`);
            // Still notify client to refresh balance in case it's stale
            for (const [ws, client] of clients) {
              if (client.walletAddress === walletAddress && ws.readyState === 1) {
                sendBalance(ws, walletAddress);
              }
            }
            return;
          }
          await rooms.store.addBalance(walletAddress, diff);
          await rooms.store.recordTransaction(walletAddress, 'deposit', Math.floor(diff / 10000 * 1e6), diff);
          console.log(`[Chain] Credited ${diff} chips to ${walletAddress} (on-chain: ${onChainTotal}, was: ${dbCredited})`);
          for (const [ws, client] of clients) {
            if (client.walletAddress === walletAddress && ws.readyState === 1) {
              sendBalance(ws, walletAddress);
              ws.send(JSON.stringify({ type: 'depositConfirmed', data: { chips: diff, usdcAmount: diff / 10000 } }));
            }
          }
        } catch (e) {
          console.error('[Chain] Deposit credit failed:', e.message);
        }
      };

      chain.startListening();
      rooms.chainService = chain;
      console.log('[Server] USDC chain service active');
    } catch (e) {
      console.error('[Server] USDC chain init failed:', e.message);
    }
  }

  // Stagger to avoid RPC rate limiting
  await new Promise(r => setTimeout(r, 3000));

  // POKERAI token chain service
  if (process.env.OPERATOR_PRIVATE_KEY && process.env.BASE_RPC_URL &&
      (process.env.POKERAI_VAULT_ADDRESS || process.env.POKERAI_REWARDS_ADDRESS)) {
    try {
      const { TokenChainService } = require('./token-chain');
      tokenChain = new TokenChainService({
        rpcUrl: process.env.BASE_RPC_URL,
        operatorKey: process.env.OPERATOR_PRIVATE_KEY,
        tokenVaultAddress: process.env.POKERAI_VAULT_ADDRESS || null,
        rewardsAddress: process.env.POKERAI_REWARDS_ADDRESS || null
      });

      if (process.env.POKERAI_VAULT_ADDRESS) {
        tokenChain.onDeposit = async (walletAddress, chips, tokenRaw) => {
          console.log(`[TokenChain] Deposit event: ${walletAddress} → ${chips} chips (${chips} POKERAI)`);
          try {
            // Deduplicate: compare on-chain gross deposits vs total credits in DB
            // Only credit the DIFFERENCE to avoid double-crediting replayed events
            const stats = await tokenChain.getPlayerDepositStats(walletAddress);
            const onChainTotal = Math.floor(Number(stats.deposited)); // 1 token = 1 chip
            const dbCredited = rooms.store.getTotalDepositedPokeraiChips
              ? await rooms.store.getTotalDepositedPokeraiChips(walletAddress)
              : 0;
            const diff = onChainTotal - dbCredited;
            if (diff < 1) {
              console.log(`[TokenChain] Deposit event for ${walletAddress} already credited (on-chain: ${onChainTotal}, db: ${dbCredited}) — skipping`);
              for (const [ws, cl] of clients) {
                if (cl.walletAddress === walletAddress && ws.readyState === 1) {
                  sendBalance(ws, walletAddress);
                }
              }
              return;
            }
            await rooms.store.addBalance(walletAddress, diff, 'pokerai');
            await rooms.store.recordTransaction(walletAddress, 'deposit_pokerai', tokenRaw, diff);
            console.log(`[TokenChain] Credited ${diff} chips to ${walletAddress} (on-chain: ${onChainTotal}, was: ${dbCredited})`);
            for (const [ws, cl] of clients) {
              if (cl.walletAddress === walletAddress && ws.readyState === 1) {
                sendBalance(ws, walletAddress);
                ws.send(JSON.stringify({ type: 'depositConfirmed', data: { chips: diff, token: 'POKERAI' } }));
              }
            }
          } catch (e) {
            console.error('[TokenChain] Deposit credit failed:', e.message);
          }
        };
        tokenChain.startListening();
      }

      console.log(`[Server] POKERAI chain service active — vault: ${!!process.env.POKERAI_VAULT_ADDRESS}, rewards: ${!!process.env.POKERAI_REWARDS_ADDRESS}`);
    } catch (e) {
      console.error('[Server] POKERAI chain init failed:', e.message);
    }
  }
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
