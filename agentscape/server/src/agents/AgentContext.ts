// ============================================================
// AgentScape — Agent Context Builder
// Builds world-state prompts for LLM decision-making
// ============================================================

import { NPCSchema } from '../schema/NPCSchema';
import { GameState } from '../schema/GameState';
import { PlayerSchema } from '../schema/PlayerSchema';
import { BUILDINGS } from '../config';

export class AgentContext {
    buildPrompt(npc: NPCSchema, state: GameState): string {
        const nearbyPlayers: string[] = [];
        const nearbyNPCs: string[] = [];

        state.players.forEach((player) => {
            const dist = Math.abs(player.x - npc.x) + Math.abs(player.z - npc.z);
            if (dist < 10) {
                nearbyPlayers.push(`${player.name} (combat lvl ${player.combatLevel}, hp ${player.hp}/${player.maxHp}) at (${Math.round(player.x)},${Math.round(player.z)})`);
            }
        });

        state.npcs.forEach((other) => {
            if (other.id === npc.id || other.isDead) return;
            const dist = Math.abs(other.x - npc.x) + Math.abs(other.z - npc.z);
            if (dist < 8) {
                nearbyNPCs.push(`${other.name} (${other.role}) at (${Math.round(other.x)},${Math.round(other.z)})`);
            }
        });

        const nearestBuilding = BUILDINGS.reduce((best, b) => {
            const dist = Math.abs(b.x - npc.x) + Math.abs(b.z - npc.z);
            if (!best || dist < best.dist) return { name: b.name, id: b.id, dist };
            return best;
        }, null as { name: string; id: string; dist: number } | null);

        return `You are ${npc.name}, a ${npc.role} agent in AgentScape.
Position: (${Math.round(npc.x)}, ${Math.round(npc.z)})
HP: ${npc.hp}/${npc.maxHp}
State: ${npc.state}
${npc.inCombat ? 'IN COMBAT' : ''}
Nearest building: ${nearestBuilding?.name || 'unknown'} (${nearestBuilding?.dist || '?'} tiles away)
Nearby players: ${nearbyPlayers.join(', ') || 'none'}
Nearby agents: ${nearbyNPCs.join(', ') || 'none'}

Choose your next action: move_to, chat, or wait.`;
    }
}
