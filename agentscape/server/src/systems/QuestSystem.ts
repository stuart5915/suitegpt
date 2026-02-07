// ============================================================
// AgentScape — Server-Authoritative Quest System
// Ported from apps/runescape-game.html lines 528-681
// ============================================================

import { PlayerSchema, QuestProgress } from '../schema/PlayerSchema';
import { QUESTS, ITEMS, BUILDINGS } from '../config';
import { InventorySystem } from './InventorySystem';

export interface QuestEvent {
    type: 'accepted' | 'progress' | 'completed';
    questId: string;
    questName: string;
    playerId: string;
}

export class QuestSystem {
    private inventorySystem: InventorySystem;

    constructor(inventorySystem: InventorySystem) {
        this.inventorySystem = inventorySystem;
    }

    isQuestAvailable(player: PlayerSchema, questId: string): boolean {
        if (player.quests.has(questId)) return false;
        const q = QUESTS[questId];
        if (!q) return false;
        if (!q.prereqs || q.prereqs.length === 0) return true;
        return q.prereqs.every(p => {
            const pq = player.quests.get(p);
            return pq && pq.status === 'completed';
        });
    }

    acceptQuest(player: PlayerSchema, questId: string): QuestEvent | null {
        if (!this.isQuestAvailable(player, questId)) return null;
        const q = QUESTS[questId];
        if (!q) return null;

        const progress = new QuestProgress();
        progress.questId = questId;
        progress.status = 'active';
        // Initialize objective tracking
        const objData = q.objectives.map(obj => {
            if (obj.type === 'kill' || obj.type === 'kill_zone' || obj.type === 'collect' || obj.type === 'deliver') {
                return { ...obj, progress: 0 };
            }
            if (obj.type === 'visit') {
                return { ...obj, visited: [] as string[] };
            }
            if (obj.type === 'kill_roles') {
                return { ...obj, killed: [] as string[] };
            }
            return obj;
        });
        progress.objectiveData = JSON.stringify(objData);
        player.quests.set(questId, progress);
        player.dirty = true;

        return { type: 'accepted', questId, questName: q.name, playerId: player.sessionId };
    }

    checkKill(player: PlayerSchema, role: string, x: number, z: number): QuestEvent[] {
        return this.checkProgress(player, 'kill', { role, x, z });
    }

    checkCollect(player: PlayerSchema, itemId: string): QuestEvent[] {
        return this.checkProgress(player, 'collect', { item: itemId });
    }

    checkVisit(player: PlayerSchema, buildingId: string): QuestEvent[] {
        return this.checkProgress(player, 'visit', { building: buildingId });
    }

    checkEnterBuilding(player: PlayerSchema, buildingId: string): QuestEvent[] {
        return this.checkProgress(player, 'enter_building', { building: buildingId });
    }

    private checkProgress(player: PlayerSchema, type: string, data: any): QuestEvent[] {
        const events: QuestEvent[] = [];

        player.quests.forEach((pq, qid) => {
            if (pq.status !== 'active') return;
            const q = QUESTS[qid];
            if (!q) return;

            let objectives = JSON.parse(pq.objectiveData);
            let allDone = true;
            let changed = false;

            for (const obj of objectives) {
                if (type === 'kill' && obj.type === 'kill') {
                    if (obj.target === 'any' || obj.target === data.role) {
                        obj.progress = Math.min(obj.count, (obj.progress || 0) + 1);
                        changed = true;
                    }
                }
                if (type === 'kill' && obj.type === 'kill_zone') {
                    const arena = BUILDINGS.find(b => b.id === obj.zone);
                    if (arena && Math.abs(data.x - arena.x) < 5 && Math.abs(data.z - arena.z) < 5) {
                        obj.progress = Math.min(obj.count, (obj.progress || 0) + 1);
                        changed = true;
                    }
                }
                if (type === 'kill' && obj.type === 'kill_roles') {
                    if (data.role && !obj.killed.includes(data.role)) {
                        obj.killed.push(data.role);
                        changed = true;
                    }
                }
                if (type === 'collect' && obj.type === 'collect' && data.item === obj.item) {
                    const total = this.inventorySystem.countItem(player, obj.item);
                    if (total !== obj.progress) {
                        obj.progress = Math.min(obj.count, total);
                        changed = true;
                    }
                }
                if (type === 'collect' && obj.type === 'deliver' && data.item === obj.item) {
                    obj.progress = Math.min(obj.count, this.inventorySystem.countItem(player, obj.item));
                    changed = true;
                }
                if (type === 'visit' && obj.type === 'visit') {
                    if (!obj.visited.includes(data.building)) {
                        obj.visited.push(data.building);
                        changed = true;
                    }
                }
                if (type === 'enter_building' && obj.type === 'deliver' && data.building === obj.destination) {
                    const has = this.inventorySystem.countItem(player, obj.item);
                    if (has >= obj.count) {
                        // Consume the items
                        let toRemove = obj.count;
                        for (let s = 0; s < player.inventory.length && toRemove > 0; s++) {
                            if (player.inventory[s].id === obj.item) {
                                this.inventorySystem.removeFromInventory(player, s, 1);
                                toRemove--;
                            }
                        }
                        obj.progress = obj.count;
                        changed = true;
                    }
                }

                // Check if this objective is done
                if (obj.type === 'kill' || obj.type === 'kill_zone' || obj.type === 'collect' || obj.type === 'deliver') {
                    if ((obj.progress || 0) < obj.count) allDone = false;
                }
                if (obj.type === 'visit') {
                    if (obj.visited.length < obj.buildings.length) allDone = false;
                }
                if (obj.type === 'kill_roles') {
                    if (obj.killed.length < obj.roles.length) allDone = false;
                }
            }

            if (changed) {
                pq.objectiveData = JSON.stringify(objectives);
                events.push({ type: 'progress', questId: qid, questName: q.name, playerId: player.sessionId });
            }

            if (allDone) {
                this.completeQuest(player, qid);
                events.push({ type: 'completed', questId: qid, questName: q.name, playerId: player.sessionId });
            }
        });

        return events;
    }

    private completeQuest(player: PlayerSchema, questId: string): void {
        const q = QUESTS[questId];
        if (!q) return;
        const pq = player.quests.get(questId);
        if (!pq) return;
        pq.status = 'completed';

        // Grant rewards
        if (q.rewards.coins) this.inventorySystem.addToInventory(player, 'coins', q.rewards.coins);
        if (q.rewards.xp) {
            Object.entries(q.rewards.xp).forEach(([skill, amt]) => {
                this.inventorySystem.gainXP(player, skill, amt);
            });
        }
        if (q.rewards.items) {
            q.rewards.items.forEach(i => this.inventorySystem.addToInventory(player, i.id, i.qty));
        }
        player.dirty = true;
    }
}
