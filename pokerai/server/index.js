require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { PokerEngine } = require('./poker-engine');

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
const clients = new Map(); // ws → { sessionId, walletAddress }

// Game engine — broadcast sends per-client state
const engine = new PokerEngine((type, data) => {
  if (type === 'gameState') {
    // Send per-client state (each client gets their own funded agent cards)
    for (const [ws, client] of clients) {
      if (ws.readyState === 1) {
        try {
          const state = engine.getStateForClient(client.sessionId, client.walletAddress);
          ws.send(JSON.stringify({ type: 'gameState', data: state }));
        } catch (e) { /* client disconnected */ }
      }
    }
  } else {
    // Broadcast same message to all
    const msg = JSON.stringify({ type, data });
    for (const [ws] of clients) {
      if (ws.readyState === 1) {
        try { ws.send(msg); } catch (e) { /* ignore */ }
      }
    }
  }
});

function broadcastViewerCount() {
  const count = clients.size;
  const msg = JSON.stringify({ type: 'viewerCount', data: { count } });
  for (const [ws] of clients) {
    if (ws.readyState === 1) {
      try { ws.send(msg); } catch (e) { /* ignore */ }
    }
  }
}

wss.on('connection', (ws) => {
  const sessionId = uuidv4();
  clients.set(ws, { sessionId });

  // Send welcome + initial state
  ws.send(JSON.stringify({ type: 'welcome', data: { sessionId, viewerCount: clients.size } }));
  const state = engine.getStateForClient(sessionId, null);
  ws.send(JSON.stringify({ type: 'gameState', data: state }));
  broadcastViewerCount();

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      const client = clients.get(ws);
      if (!client) return;

      switch (msg.type) {
        case 'setWallet': {
          client.walletAddress = msg.walletAddress || null;
          break;
        }
        case 'fund': {
          const result = engine.fundAgent(client.sessionId, msg.agentId, msg.amount);
          ws.send(JSON.stringify({ type: 'fundResult', data: result }));
          const state = engine.getStateForClient(client.sessionId, client.walletAddress);
          ws.send(JSON.stringify({ type: 'gameState', data: state }));
          break;
        }
        case 'withdraw': {
          const result = engine.withdrawAgent(client.sessionId, msg.agentId);
          ws.send(JSON.stringify({ type: 'withdrawResult', data: result }));
          const state = engine.getStateForClient(client.sessionId, client.walletAddress);
          ws.send(JSON.stringify({ type: 'gameState', data: state }));
          break;
        }
        case 'createAgent': {
          client.walletAddress = msg.walletAddress;
          const result = engine.createLobbyAgent(msg.walletAddress, msg.config);
          ws.send(JSON.stringify({ type: 'createAgentResult', data: { ...result, agentName: msg.config.name } }));
          // Send updated state to this client (lobby agents are per-wallet)
          const s = engine.getStateForClient(client.sessionId, client.walletAddress);
          ws.send(JSON.stringify({ type: 'gameState', data: s }));
          break;
        }
        case 'joinTable': {
          client.walletAddress = msg.walletAddress;
          const result = engine.joinTable(msg.walletAddress, msg.agentId);
          ws.send(JSON.stringify({ type: 'joinTableResult', data: result }));
          // Broadcast to all — table changed
          for (const [c, cData] of clients) {
            if (c.readyState === 1) {
              try {
                const s = engine.getStateForClient(cData.sessionId, cData.walletAddress);
                c.send(JSON.stringify({ type: 'gameState', data: s }));
              } catch (e) { /* ignore */ }
            }
          }
          break;
        }
        case 'topUp': {
          const result = engine.topUpAgent(msg.walletAddress, msg.agentId, msg.amount);
          ws.send(JSON.stringify({ type: 'topUpResult', data: result }));
          if (result.success) {
            // Broadcast to all — agent stack changed
            for (const [c, cData] of clients) {
              if (c.readyState === 1) {
                try {
                  const s = engine.getStateForClient(cData.sessionId, cData.walletAddress);
                  c.send(JSON.stringify({ type: 'gameState', data: s }));
                } catch (e) { /* ignore */ }
              }
            }
          }
          break;
        }
        case 'leaveTable': {
          const result = engine.leaveTable(msg.walletAddress, msg.agentId);
          ws.send(JSON.stringify({ type: 'leaveTableResult', data: result }));
          // Broadcast to all — table changed
          for (const [c, cData] of clients) {
            if (c.readyState === 1) {
              try {
                const s = engine.getStateForClient(cData.sessionId, cData.walletAddress);
                c.send(JSON.stringify({ type: 'gameState', data: s }));
              } catch (e) { /* ignore */ }
            }
          }
          break;
        }
        case 'recallAgent': {
          const result = engine.deleteAgent(msg.walletAddress, msg.agentId);
          ws.send(JSON.stringify({ type: 'recallAgentResult', data: result }));
          // Broadcast to all — table may have changed if agent was playing
          for (const [c, cData] of clients) {
            if (c.readyState === 1) {
              try {
                const s = engine.getStateForClient(cData.sessionId, cData.walletAddress);
                c.send(JSON.stringify({ type: 'gameState', data: s }));
              } catch (e) { /* ignore */ }
            }
          }
          break;
        }
        case 'getMyAgents': {
          const result = engine.getAgentsForWallet(msg.walletAddress);
          ws.send(JSON.stringify({ type: 'myAgents', data: result }));
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
      engine.withdrawAll(client.sessionId);
    }
    clients.delete(ws);
    broadcastViewerCount();
  });
});

// REST endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: 2, viewers: clients.size, handsPlayed: engine.handsPlayed });
});

app.get('/stats', (req, res) => {
  const state = engine.getPublicState();
  res.json({
    viewers: clients.size,
    handsPlayed: state.handsPlayed,
    contractPool: state.contractPool,
    agents: state.agents.map(a => ({ id: a.id, name: a.name, chips: a.chips, handsWon: a.handsWon }))
  });
});

server.listen(PORT, () => {
  console.log(`PokerAI server v2 running on port ${PORT} — custom agents enabled`);
  engine.start();
});
