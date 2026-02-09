// ============================================================
// AgentScape — Raid Coordinator
// Emergent intention-broadcasting system. Agents broadcast
// rally calls based on personality. No command hierarchy —
// agents decide individually whether to join.
// ============================================================

import { NPCSchema } from '../schema/NPCSchema';
import { AgentMemory, AgentMemoryManager, CachedNPC } from './AgentMemory';
import { Notecard } from './Notecard';
import { RAID_GATHER_POINTS, BOSSES } from '../config';

export interface RaidBroadcast {
    id: string;
    type: 'rally_call' | 'raid_ready' | 'attack_now' | 'retreat' | 'victory';
    agentId: string;
    agentName: string;
    targetBossId: string;
    gatherPoint: { x: number; z: number };
    memberIds: Set<string>;
    createdAt: number;
    launched: boolean;
}

export interface RaidCoordinatorEvent {
    type: 'rally_call' | 'raid_start' | 'raid_wipe' | 'raid_victory';
    agentName: string;
    bossName: string;
    bossId: string;
    count: number;
    message: string;
}

export class RaidCoordinator {
    private rallies: Map<string, RaidBroadcast> = new Map();
    private rallyCounter = 0;

    /** Get all active rallies. */
    getActiveRallies(): RaidBroadcast[] {
        return Array.from(this.rallies.values()).filter(r => !r.launched);
    }

    /** Get a specific rally. */
    getRally(rallyId: string): RaidBroadcast | undefined {
        return this.rallies.get(rallyId);
    }

    /** Get rally for a specific boss (most recent, unlaunched). */
    getRallyForBoss(bossId: string): RaidBroadcast | undefined {
        for (const rally of this.rallies.values()) {
            if (rally.targetBossId === bossId && !rally.launched) return rally;
        }
        return undefined;
    }

    // --- Create Rally ---

    createRally(npc: NPCSchema, targetBossId: string): RaidBroadcast | null {
        // Don't create duplicate rallies for same boss
        if (this.getRallyForBoss(targetBossId)) return null;

        const gatherPoint = RAID_GATHER_POINTS[targetBossId];
        if (!gatherPoint) return null;

        const id = `rally_${++this.rallyCounter}`;
        const rally: RaidBroadcast = {
            id,
            type: 'rally_call',
            agentId: npc.id,
            agentName: npc.name,
            targetBossId,
            gatherPoint,
            memberIds: new Set([npc.id]),
            createdAt: Date.now(),
            launched: false,
        };

        this.rallies.set(id, rally);
        return rally;
    }

    // --- Join Rally ---

    joinRally(rallyId: string, npcId: string): boolean {
        const rally = this.rallies.get(rallyId);
        if (!rally || rally.launched) return false;
        rally.memberIds.add(npcId);
        return true;
    }

    // --- Personality-driven join decision ---

    shouldJoinRaid(notecard: Notecard, mem: AgentMemory, rallySize: number, targetBossId: string): boolean {
        // Won't join if HP low, no food, or too low level
        if (mem.foodCount <= 0) return false;
        if (mem.effectiveLevel < 10) return false;

        const bossDef = BOSSES[targetBossId];
        const bossLevel = bossDef?.level || 50;

        // Level check — need to be within reasonable range
        if (mem.effectiveLevel < bossLevel * 0.3) return false;

        // High aggression → joins when party >= 3
        if (notecard.aggression > 60 && rallySize >= 3) return true;

        // High caution → waits for party >= 8
        if (notecard.caution > 60 && rallySize < 8) return false;

        // High sociability → joins if party >= 4 (wants company)
        if (notecard.sociability > 60 && rallySize >= 4) return true;

        // High discipline → joins if party is decent size
        if (notecard.discipline > 60 && rallySize >= 5) return true;

        // Default: moderate personality — join at 5+
        return rallySize >= 5;
    }

    // --- Launch decision ---

    shouldLaunchRaid(rally: RaidBroadcast, memories: AgentMemoryManager): boolean {
        if (rally.launched) return false;
        if (rally.memberIds.size < 3) return false;

        const bossDef = BOSSES[rally.targetBossId];
        const minAgents = bossDef ? Math.max(3, bossDef.minPlayers + 1) : 5;

        if (rally.memberIds.size < minAgents) return false;

        // Check if majority of gathered agents are "ready" (personality-based threshold)
        let readyCount = 0;
        for (const agentId of rally.memberIds) {
            const mem = memories.get(agentId);
            if (!mem.notecard) { readyCount++; continue; }

            // Aggressive agents are always ready
            if (mem.notecard.aggression > 50) { readyCount++; continue; }
            // Disciplined agents ready if party size >= minPlayers * 1.5
            if (mem.notecard.discipline > 50 && rally.memberIds.size >= minAgents * 1.2) { readyCount++; continue; }
            // Others ready if decent party
            if (rally.memberIds.size >= minAgents + 2) { readyCount++; continue; }
        }

        return readyCount >= rally.memberIds.size * 0.6;
    }

    // --- Mark rally as launched ---

    launchRaid(rallyId: string): RaidBroadcast | null {
        const rally = this.rallies.get(rallyId);
        if (!rally || rally.launched) return null;
        rally.launched = true;
        rally.type = 'attack_now';
        return rally;
    }

    // --- Cleanup old rallies ---

    cleanup(): void {
        const now = Date.now();
        const maxAge = 5 * 60 * 1000; // 5 minutes
        for (const [id, rally] of this.rallies) {
            if (now - rally.createdAt > maxAge) {
                this.rallies.delete(id);
            }
        }
    }

    // --- Pick boss for agent based on level ---

    pickBossTarget(effectiveLevel: number, aggression: number): string | null {
        // Natural escalation by level
        if (effectiveLevel >= 25 && aggression > 30) return 'data_breach_dragon';
        if (effectiveLevel >= 20) return 'the_hallucinator';
        if (effectiveLevel >= 15) return 'the_404_golem';
        if (effectiveLevel >= 10) return 'rogue_script_boss';
        return null;
    }

    // --- Determine emergent raid role from personality ---

    determineRaidRole(notecard: Notecard): 'tank' | 'dps' | 'support' {
        // Highest trait wins
        const traits = {
            tank: notecard.caution,
            dps: notecard.aggression,
            support: notecard.sociability,
        };

        let best: 'tank' | 'dps' | 'support' = 'dps';
        let bestVal = -1;
        for (const [role, val] of Object.entries(traits)) {
            if (val > bestVal) {
                bestVal = val;
                best = role as 'tank' | 'dps' | 'support';
            }
        }
        return best;
    }
}
