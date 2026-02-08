// ============================================================
// AgentScape — Skill & Bank Persistence Helper
// Serializes/restores all new system data (gathering, crafting, bank)
// ============================================================
//
// === INTEGRATION NOTES ===
//
// SupabaseAdapter.ts — Add to savePlayer row:
//   extra_data: skillPersistence.serialize(player)
//
// SupabaseAdapter.ts — Add to restorePlayer:
//   if (saved.extra_data) skillPersistence.restore(player, saved.extra_data);
//
// AgentScapeRoom.ts — Initialize:
//   this.skillPersistence = new SkillPersistence(
//       this.skillingSystem, this.craftingSystem, this.bankSystem
//   );
//
// AgentScapeRoom.ts — In onJoin (after restorePlayer):
//   if (saved?.extra_data) this.skillPersistence.restore(player, saved.extra_data);
//
// Database — Add column to agentscape_players:
//   ALTER TABLE agentscape_players ADD COLUMN extra_data text;
// ============================================================

import { PlayerSchema } from '../schema/PlayerSchema';
import { SkillingSystem } from '../systems/SkillingSystem';
import { CraftingSystem } from '../systems/CraftingSystem';
import { BankSystem } from '../systems/BankSystem';

interface SerializedExtras {
    version: number;
    gatheringSkills?: string;  // SkillingSystem XP data
    craftingSkills?: string;   // CraftingSystem XP data
    bankData?: string;         // BankSystem items
}

const CURRENT_VERSION = 1;

export class SkillPersistence {
    private skillingSystem: SkillingSystem;
    private craftingSystem: CraftingSystem;
    private bankSystem: BankSystem;

    constructor(
        skillingSystem: SkillingSystem,
        craftingSystem: CraftingSystem,
        bankSystem: BankSystem,
    ) {
        this.skillingSystem = skillingSystem;
        this.craftingSystem = craftingSystem;
        this.bankSystem = bankSystem;
    }

    /**
     * Serialize all extended data for a player into a single JSON string.
     * Store this in a `extra_data` text column in agentscape_players.
     */
    serialize(player: PlayerSchema): string {
        const data: SerializedExtras = {
            version: CURRENT_VERSION,
            gatheringSkills: this.skillingSystem.serializeSkills(player),
            craftingSkills: this.craftingSystem.serializeSkills(player),
            bankData: this.bankSystem.serialize(player),
        };
        return JSON.stringify(data);
    }

    /**
     * Restore all extended data for a player from the saved JSON string.
     * Call after restorePlayer() in SupabaseAdapter or after loadPlayerByUserId.
     */
    restore(player: PlayerSchema, json: string): void {
        if (!json) return;
        try {
            const data: SerializedExtras = JSON.parse(json);

            // Version check — migrate if needed in the future
            if (data.version !== CURRENT_VERSION) {
                console.warn(`[SkillPersistence] Old save version ${data.version}, migrating`);
                // Currently only version 1 exists, future migrations go here
            }

            if (data.gatheringSkills) {
                this.skillingSystem.restoreSkills(player, data.gatheringSkills);
            }
            if (data.craftingSkills) {
                this.craftingSystem.restoreSkills(player, data.craftingSkills);
            }
            if (data.bankData) {
                this.bankSystem.restore(player, data.bankData);
            }
        } catch (e) {
            console.error('[SkillPersistence] Failed to restore extra data:', e);
        }
    }

    /**
     * Get a summary of a player's extended skill levels (for display/debug).
     */
    getSkillSummary(player: PlayerSchema): {
        woodcutting: number;
        mining: number;
        fishing: number;
        crafting: number;
        cooking: number;
        bankSlots: number;
    } {
        return {
            woodcutting: this.skillingSystem.getSkillLevel(player, 'woodcutting'),
            mining: this.skillingSystem.getSkillLevel(player, 'mining'),
            fishing: this.skillingSystem.getSkillLevel(player, 'fishing'),
            crafting: this.craftingSystem.getCraftingLevel(player),
            cooking: this.craftingSystem.getCookingLevel(player),
            bankSlots: this.bankSystem.getBankSize(player),
        };
    }
}
