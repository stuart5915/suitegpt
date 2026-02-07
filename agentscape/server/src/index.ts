// ============================================================
// AgentScape — Colyseus Server Entry Point
// ============================================================

import 'dotenv/config';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { monitor } from '@colyseus/monitor';
import express from 'express';
import cors from 'cors';
import { AgentScapeRoom } from './rooms/AgentScapeRoom';

const app = express();

app.use(cors({
    origin: [
        'https://agentscape.app',
        'https://www.agentscape.app',
        'https://suitegpt.app',
        'https://www.suitegpt.app',
        'http://localhost:3000',
        'http://localhost:5500',
        'http://localhost:8080',
    ],
}));

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

// Colyseus monitor (admin panel)
app.use('/colyseus', monitor());

const port = Number(process.env.PORT) || 2567;

const server = new Server({
    transport: new WebSocketTransport({ server: app.listen(port) }),
});

// Register game room
server.define('agentscape', AgentScapeRoom);

console.log(`[AgentScape] Colyseus server listening on port ${port}`);
console.log(`[AgentScape] WebSocket: ws://localhost:${port}`);
console.log(`[AgentScape] Monitor: http://localhost:${port}/colyseus`);
