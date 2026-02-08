// ============================================================
// AgentScape — Colyseus Server Entry Point
// ============================================================

import 'dotenv/config';
import { Server, matchMaker } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { monitor } from '@colyseus/monitor';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
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

// Supabase client for public API queries
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const sbPublic = createClient(supabaseUrl, supabaseServiceKey);

// Public leaderboard — top players by combat level
app.get('/leaderboard', async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 25, 100);
        const { data, error } = await sbPublic
            .from('agentscape_leaderboard')
            .select('*')
            .limit(limit);
        if (error) throw error;
        res.json({ players: data || [] });
    } catch (e: any) {
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// Live player count (uses gameServer after it's initialized at bottom)
let gameServer: Server;
app.get('/player-count', async (_req, res) => {
    try {
        const rooms = await matchMaker.query({ name: 'agentscape' });
        const count = rooms.reduce((sum: number, r: any) => sum + (r.clients || 0), 0);
        res.json({ count });
    } catch {
        res.json({ count: 0 });
    }
});

// Public player profile by name
app.get('/player/:name', async (req, res) => {
    try {
        const name = req.params.name;
        const { data, error } = await sbPublic
            .from('agentscape_players')
            .select('name, combat_level, attack, strength, defence, hitpoints, woodcutting, mining, fishing, cooking, smithing, crafting, fletching, runecrafting, prayer, thieving, total_level, total_kills, total_deaths, attack_xp, strength_xp, defence_xp, hitpoints_xp, woodcutting_xp, mining_xp, fishing_xp, cooking_xp, smithing_xp, crafting_xp, fletching_xp, runecrafting_xp, prayer_xp, thieving_xp, equipped_weapon, equipped_helm, equipped_shield, coins, achievement_points, achievements_completed, created_at, updated_at')
            .ilike('name', name)
            .limit(1)
            .single();
        if (error || !data) {
            return res.status(404).json({ error: 'Player not found' });
        }
        const totalXP = (data.attack_xp||0) + (data.strength_xp||0) +
            (data.defence_xp||0) + (data.hitpoints_xp||0) +
            (data.woodcutting_xp||0) + (data.mining_xp||0) +
            (data.fishing_xp||0) + (data.cooking_xp||0) +
            (data.smithing_xp||0) + (data.crafting_xp||0) +
            (data.fletching_xp||0) + (data.runecrafting_xp||0) +
            (data.prayer_xp||0) + (data.thieving_xp||0);
        res.json({
            ...data,
            total_xp: totalXP,
            kills: data.total_kills,
            deaths: data.total_deaths,
        });
    } catch {
        res.status(500).json({ error: 'Failed to fetch player profile' });
    }
});

// Global game stats
app.get('/stats', async (_req, res) => {
    try {
        // Total registered players
        const { count: totalPlayers } = await sbPublic
            .from('agentscape_players')
            .select('*', { count: 'exact', head: true });

        // Aggregate stats
        const { data: agg } = await sbPublic
            .from('agentscape_players')
            .select('attack_xp, strength_xp, defence_xp, hitpoints_xp, total_kills, total_deaths');

        let totalXP = 0, totalKills = 0, totalDeaths = 0;
        if (agg) {
            for (const p of agg) {
                totalXP += (p.attack_xp || 0) + (p.strength_xp || 0) +
                    (p.defence_xp || 0) + (p.hitpoints_xp || 0);
                totalKills += p.total_kills || 0;
                totalDeaths += p.total_deaths || 0;
            }
        }

        // Current online count
        let onlineCount = 0;
        try {
            const rooms = await matchMaker.query({ name: 'agentscape' });
            onlineCount = rooms.reduce((sum: number, r: any) => sum + (r.clients || 0), 0);
        } catch {}

        res.json({
            total_players: totalPlayers || 0,
            online_now: onlineCount,
            total_xp_earned: totalXP,
            total_kills: totalKills,
            total_deaths: totalDeaths,
            uptime_seconds: Math.floor(process.uptime()),
        });
    } catch {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Current world state
app.get('/world', async (_req, res) => {
    try {
        const rooms = await matchMaker.query({ name: 'agentscape' });
        const activeRoom = rooms[0];
        res.json({
            status: 'online',
            uptime_seconds: Math.floor(process.uptime()),
            rooms: rooms.length,
            players_online: rooms.reduce((sum: number, r: any) => sum + (r.clients || 0), 0),
            max_players_per_room: activeRoom?.maxClients || 100,
            server_time: Date.now(),
        });
    } catch {
        res.json({
            status: 'online',
            uptime_seconds: Math.floor(process.uptime()),
            rooms: 0,
            players_online: 0,
            server_time: Date.now(),
        });
    }
});

// Valid skill columns in agentscape_players
const VALID_SKILLS = [
    'attack', 'strength', 'defence', 'hitpoints', 'prayer', 'thieving',
    'woodcutting', 'mining', 'fishing', 'cooking', 'smithing', 'crafting',
    'fletching', 'runecrafting',
];

// Overall hiscores (by total level, then total XP)
app.get('/hiscores/overall', async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 25, 100);
        const { data, error } = await sbPublic
            .from('agentscape_players')
            .select('name, combat_level, total_level, attack_xp, strength_xp, defence_xp, hitpoints_xp, woodcutting_xp, mining_xp, fishing_xp, cooking_xp, smithing_xp, crafting_xp, fletching_xp, runecrafting_xp, prayer_xp, thieving_xp')
            .order('total_level', { ascending: false })
            .limit(limit);
        if (error) throw error;
        res.json({
            skill: 'overall',
            players: (data || []).map((p: any, i: number) => {
                const totalXP = (p.attack_xp||0) + (p.strength_xp||0) + (p.defence_xp||0) +
                    (p.hitpoints_xp||0) + (p.woodcutting_xp||0) + (p.mining_xp||0) +
                    (p.fishing_xp||0) + (p.cooking_xp||0) + (p.smithing_xp||0) +
                    (p.crafting_xp||0) + (p.fletching_xp||0) + (p.runecrafting_xp||0) +
                    (p.prayer_xp||0) + (p.thieving_xp||0);
                return {
                    rank: i + 1,
                    name: p.name,
                    level: p.total_level,
                    xp: totalXP,
                    combat_level: p.combat_level,
                    total_level: p.total_level,
                };
            }),
        });
    } catch {
        res.status(500).json({ error: 'Failed to fetch overall hiscores' });
    }
});

// Per-skill hiscores
app.get('/hiscores/:skill', async (req, res) => {
    try {
        const skill = req.params.skill.toLowerCase();
        if (!VALID_SKILLS.includes(skill)) {
            return res.status(400).json({ error: 'Invalid skill. Valid: overall, ' + VALID_SKILLS.join(', ') });
        }
        const limit = Math.min(Number(req.query.limit) || 25, 100);
        const xpCol = skill + '_xp';
        const { data, error } = await sbPublic
            .from('agentscape_players')
            .select(`name, ${skill}, ${xpCol}, combat_level, total_level`)
            .order(xpCol, { ascending: false })
            .limit(limit);
        if (error) throw error;
        res.json({
            skill,
            players: (data || []).map((p: any, i: number) => ({
                rank: i + 1,
                name: p.name,
                level: p[skill],
                xp: p[xpCol],
                combat_level: p.combat_level,
                total_level: p.total_level,
            })),
        });
    } catch {
        res.status(500).json({ error: 'Failed to fetch hiscores' });
    }
});

// Player search
app.get('/search', async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        if (!q || q.length < 2) {
            return res.status(400).json({ error: 'Query must be at least 2 characters' });
        }
        const limit = Math.min(Number(req.query.limit) || 10, 25);
        const { data, error } = await sbPublic
            .from('agentscape_players')
            .select('name, combat_level, total_level, total_kills')
            .ilike('name', `%${q}%`)
            .order('combat_level', { ascending: false })
            .limit(limit);
        if (error) throw error;
        res.json({ results: data || [] });
    } catch {
        res.status(500).json({ error: 'Search failed' });
    }
});

// Achievement definitions
app.get('/achievements', async (_req, res) => {
    try {
        const { data, error } = await sbPublic
            .from('agentscape_achievements')
            .select('*')
            .order('category')
            .order('threshold');
        if (error) throw error;
        res.json({ achievements: data || [] });
    } catch {
        res.json({ achievements: [] });
    }
});

// Player achievement progress
app.get('/player/:name/achievements', async (req, res) => {
    try {
        const name = req.params.name;
        const { data: player } = await sbPublic
            .from('agentscape_players')
            .select('id')
            .ilike('name', name)
            .limit(1)
            .single();
        if (!player) return res.status(404).json({ error: 'Player not found' });

        const { data, error } = await sbPublic
            .from('agentscape_player_achievements')
            .select('achievement_id, progress, completed, completed_at')
            .eq('player_id', player.id);
        if (error) throw error;
        res.json({ player: name, achievements: data || [] });
    } catch {
        res.status(500).json({ error: 'Failed to fetch achievements' });
    }
});

// Recent activity feed (recent achievements, level ups, rare drops)
app.get('/activity', async (_req, res) => {
    try {
        const { data, error } = await sbPublic
            .from('agentscape_activity')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);
        if (error) throw error;
        res.json({ events: data || [] });
    } catch {
        // Table may not exist yet, return empty
        res.json({ events: [] });
    }
});

// Colyseus monitor (admin panel)
app.use('/colyseus', monitor());

const port = Number(process.env.PORT) || 2567;

gameServer = new Server({
    transport: new WebSocketTransport({ server: app.listen(port) }),
});

// Register game room
gameServer.define('agentscape', AgentScapeRoom);

console.log(`[AgentScape] Colyseus server listening on port ${port}`);
console.log(`[AgentScape] WebSocket: ws://localhost:${port}`);
console.log(`[AgentScape] Monitor: http://localhost:${port}/colyseus`);
