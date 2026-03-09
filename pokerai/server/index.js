require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { RoomManager } = require('./room-manager');

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
const clients = new Map(); // ws → { sessionId, walletAddress, activeRoom }

// Room manager — 3 rooms (micro/mid/high), auto-spawns tables
const rooms = new RoomManager((type, data) => {
  if (type === 'gameState') {
    const sourceRoom = data ? data.roomId : null;
    for (const [ws, client] of clients) {
      if (ws.readyState === 1) {
        // Only send state updates for the room the client is watching
        if (sourceRoom && client.activeRoom !== sourceRoom) continue;
        try {
          const state = rooms.getStateForClient(client.sessionId, client.walletAddress, client.activeRoom);
          ws.send(JSON.stringify({ type: 'gameState', data: state }));
        } catch (e) { /* client disconnected */ }
      }
    }
  } else {
    // Tag with room/table, let client filter
    const msg = JSON.stringify({ type, data });
    for (const [ws, client] of clients) {
      if (ws.readyState === 1) {
        // Only send log/action messages for the room the client is watching
        if (data && data.roomId && client.activeRoom !== data.roomId) continue;
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

function broadcastStateToAll() {
  for (const [ws, client] of clients) {
    if (ws.readyState === 1) {
      try {
        const state = rooms.getStateForClient(client.sessionId, client.walletAddress, client.activeRoom);
        ws.send(JSON.stringify({ type: 'gameState', data: state }));
      } catch (e) { /* ignore */ }
    }
  }
}

wss.on('connection', (ws) => {
  const sessionId = uuidv4();
  clients.set(ws, { sessionId, activeRoom: 'micro' });

  // Send welcome + initial state
  ws.send(JSON.stringify({ type: 'welcome', data: { sessionId, viewerCount: clients.size } }));
  const state = rooms.getStateForClient(sessionId, null, 'micro');
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
        case 'subscribeRoom': {
          const roomId = msg.roomId || 'micro';
          if (['micro', 'mid', 'high'].includes(roomId)) {
            client.activeRoom = roomId;
            const s = rooms.getStateForClient(client.sessionId, client.walletAddress, roomId);
            ws.send(JSON.stringify({ type: 'gameState', data: s }));
          }
          break;
        }
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
        case 'createAgent': {
          client.walletAddress = msg.walletAddress;
          const result = rooms.createLobbyAgent(msg.walletAddress, msg.config);
          ws.send(JSON.stringify({ type: 'createAgentResult', data: { ...result, agentName: msg.config.name } }));
          const s = rooms.getStateForClient(client.sessionId, client.walletAddress, client.activeRoom);
          ws.send(JSON.stringify({ type: 'gameState', data: s }));
          break;
        }
        case 'joinTable': {
          client.walletAddress = msg.walletAddress;
          const roomId = msg.roomId || 'micro';
          const result = rooms.joinRoom(msg.walletAddress, msg.agentId, roomId);
          ws.send(JSON.stringify({ type: 'joinTableResult', data: result }));
          // Switch client to the room they joined
          if (result.success) {
            client.activeRoom = roomId;
          }
          broadcastStateToAll();
          break;
        }
        case 'topUp': {
          const result = rooms.topUpAgent(msg.walletAddress, msg.agentId, msg.amount);
          ws.send(JSON.stringify({ type: 'topUpResult', data: result }));
          if (result.success) broadcastStateToAll();
          break;
        }
        case 'leaveTable': {
          const result = rooms.leaveTable(msg.walletAddress, msg.agentId);
          ws.send(JSON.stringify({ type: 'leaveTableResult', data: result }));
          broadcastStateToAll();
          break;
        }
        case 'recallAgent': {
          const result = rooms.deleteAgent(msg.walletAddress, msg.agentId);
          ws.send(JSON.stringify({ type: 'recallAgentResult', data: result }));
          broadcastStateToAll();
          break;
        }
        case 'getMyAgents': {
          const result = rooms.getAgentsForWallet(msg.walletAddress);
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
      rooms.withdrawAll(client.sessionId);
    }
    clients.delete(ws);
    broadcastViewerCount();
  });
});

// REST endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: 3,
    viewers: clients.size,
    handsPlayed: rooms.totalHandsPlayed,
    rooms: rooms.getRoomsSummary()
  });
});

app.get('/stats', (req, res) => {
  res.json({
    viewers: clients.size,
    handsPlayed: rooms.totalHandsPlayed,
    rooms: rooms.getRoomsSummary()
  });
});

server.listen(PORT, () => {
  console.log(`PokerAI server v3 running on port ${PORT} — 3 rooms (micro/mid/high)`);
  rooms.start();
});
