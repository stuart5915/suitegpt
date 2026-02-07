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
import { SupabaseAdapter } from './persistence/SupabaseAdapter';

const app = express();

app.use(cors({
    origin: [
        'https://play.agentscape.app',
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

// Redirect root to game client (play.agentscape.app → agentscape.app/play)
app.get('/', (req, res) => {
    const qs = Object.keys(req.query).length ? '?' + new URLSearchParams(req.query as any).toString() : '';
    res.redirect(302, 'https://agentscape.app/play' + qs);
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

// Verify agent API key endpoint
const supabaseAdapter = new SupabaseAdapter();
app.post('/verify-agent', async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) {
        return res.status(400).json({ error: 'Missing apiKey' });
    }
    const agent = await supabaseAdapter.authenticateAgent(apiKey);
    if (!agent) {
        return res.status(401).json({ error: 'Invalid API key' });
    }
    res.json(agent);
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
