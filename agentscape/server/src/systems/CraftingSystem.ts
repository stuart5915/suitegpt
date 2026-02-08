// ============================================================
// AgentScape — Server-Authoritative Crafting System
// Equipment crafting, Cooking, Resource processing, Skill levels
// ============================================================
//
// === INTEGRATION NOTES (for AgentScapeRoom.ts / other terminals) ===
//
// config.ts (Terminal 3) — Add these items for cooking/processing:
//   cooked_shrimp: { id: 'cooked_shrimp', name: 'Cooked Shrimp', icon: '\u{1F364}', stackable: false, type: 'food', healAmount: 8 }
//   cooked_trout:  { id: 'cooked_trout', name: 'Cooked Trout', icon: '\u{1F35B}', stackable: false, type: 'food', healAmount: 18 }
//   plank:         { id: 'plank', name: 'Plank', icon: '\u{1FAB5}', stackable: true, type: 'material' }
//   (Until added, cooking uses existing items: raw_fish -> cooked_fish, etc.)
//
// AgentScapeRoom.ts — Wire up:
//   1. Pass SkillingSystem to CraftingSystem constructor:
//      this.craftingSystem = new CraftingSystem(this.inventorySystem, this.skillingSystem);
//   2. Add action handler:
//      case 'cook_item': {
//          const result = this.craftingSystem.cookItem(player, action.payload.recipeId);
//          client.send('system_message', { message: result.message });
//          break;
//      }
//      case 'process_resource': {
//          const result = this.craftingSystem.processResource(player, action.payload.recipeId);
//          client.send('system_message', { message: result.message });
//          break;
//      }
//   3. Existing 'craft_item' handler works unchanged.
// ============================================================

import { PlayerSchema } from '../schema/PlayerSchema';
import { RECIPES, ITEMS, BUILDINGS, levelFromXP } from '../config';
import { InventorySystem } from './InventorySystem';
import { SkillingSystem } from './SkillingSystem';

// ============================================================
// Crafting Skill — internal XP tracking (same pattern as SkillingSystem)
// ============================================================

interface CraftingSkillData {
    craftingXP: number;
    cookingXP: number;
}

// ============================================================
// Cooking Recipes — turn raw materials into food at the Tavern
// ============================================================

export interface CookingRecipe {
    id: string;
    name: string;
    input: string;        // item ID consumed
    inputQty: number;
    output: string;       // item ID produced
    outputQty: number;
    levelReq: number;     // cooking level required
    xpReward: number;     // cooking XP per cook
    burnChance: number;   // 0-1, decreases with level
    burnLevelImmune: number; // level at which you stop burning
}

const COOKING_RECIPES: CookingRecipe[] = [
    {
        id: 'cook_raw_fish',
        name: 'Cook Raw Fish',
        input: 'raw_fish', inputQty: 1,
        output: 'cooked_fish', outputQty: 1,
        levelReq: 1, xpReward: 30,
        burnChance: 0.3, burnLevelImmune: 15,
    },
    {
        id: 'cook_bread',
        name: 'Bake Bread',
        input: 'logs', inputQty: 1,
        output: 'bread', outputQty: 2,
        levelReq: 1, xpReward: 20,
        burnChance: 0.15, burnLevelImmune: 10,
    },
    {
        id: 'cook_meat',
        name: 'Cook Meat',
        input: 'bones', inputQty: 2,
        output: 'cooked_meat', outputQty: 1,
        levelReq: 5, xpReward: 40,
        burnChance: 0.25, burnLevelImmune: 20,
    },
    {
        id: 'cook_lobster',
        name: 'Cook Lobster',
        input: 'lobster', inputQty: 1,
        output: 'lobster', outputQty: 1,
        levelReq: 25, xpReward: 80,
        burnChance: 0.35, burnLevelImmune: 40,
    },
    {
        id: 'cook_shark',
        name: 'Cook Shark',
        input: 'shark', inputQty: 1,
        output: 'shark', outputQty: 1,
        levelReq: 40, xpReward: 150,
        burnChance: 0.4, burnLevelImmune: 55,
    },
    {
        id: 'brew_attack_potion',
        name: 'Brew Attack Potion',
        input: 'corrupted_byte', inputQty: 5,
        output: 'attack_potion', outputQty: 1,
        levelReq: 10, xpReward: 50,
        burnChance: 0.2, burnLevelImmune: 25,
    },
    {
        id: 'brew_strength_potion',
        name: 'Brew Strength Potion',
        input: 'memory_shard', inputQty: 5,
        output: 'strength_potion', outputQty: 1,
        levelReq: 20, xpReward: 75,
        burnChance: 0.25, burnLevelImmune: 35,
    },
    {
        id: 'brew_defence_potion',
        name: 'Brew Defence Potion',
        input: 'dark_packet', inputQty: 5,
        output: 'defence_potion', outputQty: 1,
        levelReq: 30, xpReward: 100,
        burnChance: 0.3, burnLevelImmune: 45,
    },
];

// ============================================================
// Processing Recipes — turn raw resources into refined materials
// ============================================================

export interface ProcessingRecipe {
    id: string;
    name: string;
    input: { id: string; qty: number }[];
    output: string;
    outputQty: number;
    levelReq: number;     // crafting level required
    xpReward: number;     // crafting XP
    coinCost: number;
    location?: string;    // building ID required (null = anywhere)
}

const PROCESSING_RECIPES: ProcessingRecipe[] = [
    // Woodcutting processing at the Forge
    {
        id: 'refine_logs_shield',
        name: 'Wooden Shield',
        input: [{ id: 'logs', qty: 5 }],
        output: 'bronze_shield', outputQty: 1,
        levelReq: 1, xpReward: 30, coinCost: 0,
        location: 'forge',
    },
    {
        id: 'refine_code_fragments',
        name: 'Compile Code Fragments',
        input: [{ id: 'code_fragment', qty: 8 }],
        output: 'agent_core', outputQty: 1,
        levelReq: 15, xpReward: 80, coinCost: 25,
        location: 'workshop',
    },
    // Mining processing at the Forge
    {
        id: 'smelt_corrupted_bytes',
        name: 'Purify Corrupted Bytes',
        input: [{ id: 'corrupted_byte', qty: 6 }],
        output: 'code_fragment', outputQty: 2,
        levelReq: 5, xpReward: 40, coinCost: 10,
        location: 'forge',
    },
    {
        id: 'smelt_broken_links',
        name: 'Reforge Broken Links',
        input: [{ id: 'broken_link', qty: 5 }],
        output: 'iron_sword', outputQty: 1,
        levelReq: 10, xpReward: 60, coinCost: 20,
        location: 'forge',
    },
    {
        id: 'smelt_memory_shards',
        name: 'Compress Memory Shards',
        input: [{ id: 'memory_shard', qty: 8 }],
        output: 'steel_helm', outputQty: 1,
        levelReq: 20, xpReward: 100, coinCost: 50,
        location: 'forge',
    },
    {
        id: 'smelt_null_overflow',
        name: 'Null-Essence Fusion',
        input: [{ id: 'null_fragment', qty: 5 }, { id: 'overflow_essence', qty: 3 }],
        output: 'rune_sword', outputQty: 1,
        levelReq: 30, xpReward: 180, coinCost: 200,
        location: 'forge',
    },
    {
        id: 'smelt_firewall_dragon',
        name: 'Dragonfire Forging',
        input: [{ id: 'firewall_core', qty: 4 }, { id: 'dark_packet', qty: 6 }, { id: 'dragon_scale', qty: 3 }],
        output: 'dragon_sword', outputQty: 1,
        levelReq: 45, xpReward: 400, coinCost: 800,
        location: 'forge',
    },
    // Fishing processing — at the Workshop
    {
        id: 'process_fish_oil',
        name: 'Extract Fish Oil',
        input: [{ id: 'raw_fish', qty: 10 }],
        output: 'attack_potion', outputQty: 1,
        levelReq: 10, xpReward: 45, coinCost: 5,
        location: 'workshop',
    },
];

// ============================================================
// Level-gated crafting tiers for existing config.ts recipes
// ============================================================

// Maps recipe index (in config RECIPES array) to a crafting level requirement
const RECIPE_LEVEL_REQS: Record<number, number> = {
    0: 1,    // bronze_shield
    1: 5,    // iron_sword
    2: 10,   // steel_sword
    3: 10,   // steel_shield
    4: 20,   // mithril_sword
    5: 18,   // mithril_helm
    6: 18,   // mithril_shield
    7: 30,   // rune_sword
    8: 28,   // rune_helm
    9: 28,   // rune_shield
    10: 40,  // dragon_sword
    11: 38,  // dragon_helm
    12: 42,  // dragon_shield
    13: 5,   // attack_potion
    14: 15,  // strength_potion
    15: 25,  // defence_potion
};

// XP rewards for config.ts recipes
const RECIPE_XP_REWARDS: Record<number, number> = {
    0: 20,   1: 35,   2: 55,   3: 55,
    4: 90,   5: 80,   6: 80,
    7: 150,  8: 140,  9: 140,
    10: 300, 11: 280, 12: 320,
    13: 30,  14: 50,  15: 70,
};

const TAVERN_RANGE = 5;
const FORGE_RANGE = 5;
const WORKSHOP_RANGE = 5;

// ============================================================
// CraftingSystem
// ============================================================

export class CraftingSystem {
    private inventorySystem: InventorySystem;
    private skillingSystem: SkillingSystem | null;
    private skillData: Map<string, CraftingSkillData> = new Map();

    constructor(inventorySystem: InventorySystem, skillingSystem?: SkillingSystem) {
        this.inventorySystem = inventorySystem;
        this.skillingSystem = skillingSystem || null;
    }

    // ============================================================
    // Skill Data
    // ============================================================

    private getPlayerKey(player: PlayerSchema): string {
        return player.supabaseUserId || player.sessionId;
    }

    private getSkillData(player: PlayerSchema): CraftingSkillData {
        const key = this.getPlayerKey(player);
        if (!this.skillData.has(key)) {
            this.skillData.set(key, { craftingXP: 0, cookingXP: 0 });
        }
        return this.skillData.get(key)!;
    }

    getCraftingLevel(player: PlayerSchema): number {
        return levelFromXP(this.getSkillData(player).craftingXP);
    }

    getCookingLevel(player: PlayerSchema): number {
        return levelFromXP(this.getSkillData(player).cookingXP);
    }

    private addCraftingXP(player: PlayerSchema, amount: number): { leveledUp: boolean; newLevel: number } {
        const data = this.getSkillData(player);
        const oldLevel = levelFromXP(data.craftingXP);
        data.craftingXP += amount;
        const newLevel = levelFromXP(data.craftingXP);
        player.dirty = true;
        return { leveledUp: newLevel > oldLevel, newLevel };
    }

    private addCookingXP(player: PlayerSchema, amount: number): { leveledUp: boolean; newLevel: number } {
        const data = this.getSkillData(player);
        const oldLevel = levelFromXP(data.cookingXP);
        data.cookingXP += amount;
        const newLevel = levelFromXP(data.cookingXP);
        player.dirty = true;
        return { leveledUp: newLevel > oldLevel, newLevel };
    }

    serializeSkills(player: PlayerSchema): string {
        return JSON.stringify(this.getSkillData(player));
    }

    restoreSkills(player: PlayerSchema, json?: string): void {
        if (!json) return;
        try {
            const data = JSON.parse(json);
            this.skillData.set(this.getPlayerKey(player), {
                craftingXP: data.craftingXP || 0,
                cookingXP: data.cookingXP || 0,
            });
        } catch { /* start fresh */ }
    }

    // ============================================================
    // Equipment Crafting — uses config.ts RECIPES (with level gates)
    // ============================================================

    craftItem(player: PlayerSchema, recipeIndex: number): { success: boolean; message: string } {
        if (player.isDead) return { success: false, message: 'You are dead!' };

        const recipe = RECIPES[recipeIndex];
        if (!recipe) return { success: false, message: 'Unknown recipe.' };

        // Level check
        const levelReq = RECIPE_LEVEL_REQS[recipeIndex] || 1;
        const craftingLevel = this.getCraftingLevel(player);
        if (craftingLevel < levelReq) {
            return { success: false, message: `You need crafting level ${levelReq}. (You are level ${craftingLevel}.)` };
        }

        // Check ingredients
        for (const ing of recipe.ingredients) {
            if (this.inventorySystem.countItem(player, ing.id) < ing.qty) {
                const itemDef = ITEMS[ing.id];
                return { success: false, message: `Not enough ${itemDef?.name || ing.id}!` };
            }
        }
        if (this.inventorySystem.countItem(player, 'coins') < recipe.coinCost) {
            return { success: false, message: 'Not enough coins!' };
        }

        // Consume ingredients
        for (const ing of recipe.ingredients) {
            let toRemove = ing.qty;
            for (let s = 0; s < player.inventory.length && toRemove > 0; s++) {
                if (player.inventory[s].id === ing.id) {
                    const take = Math.min(player.inventory[s].quantity, toRemove);
                    this.inventorySystem.removeFromInventory(player, s, take);
                    toRemove -= take;
                }
            }
        }

        // Deduct coin cost
        this.inventorySystem.deductCoins(player, recipe.coinCost);

        // Give result
        if (!this.inventorySystem.addToInventory(player, recipe.result, recipe.resultQty)) {
            return { success: false, message: 'Inventory full!' };
        }

        // Grant crafting XP
        const xpReward = RECIPE_XP_REWARDS[recipeIndex] || 10;
        const xpResult = this.addCraftingXP(player, xpReward);

        const resultItem = ITEMS[recipe.result];
        let msg = `Crafted ${resultItem?.icon || ''} ${resultItem?.name || recipe.result}! +${xpReward} crafting XP.`;
        if (xpResult.leveledUp) {
            msg += ` Crafting level up! Now level ${xpResult.newLevel}.`;
        }
        return { success: true, message: msg };
    }

    // ============================================================
    // Cooking — raw materials -> food at the Tavern
    // ============================================================

    cookItem(player: PlayerSchema, recipeId: string): { success: boolean; message: string } {
        if (player.isDead) return { success: false, message: 'You are dead!' };

        const recipe = COOKING_RECIPES.find(r => r.id === recipeId);
        if (!recipe) return { success: false, message: 'Unknown cooking recipe.' };

        // Proximity check — must be at Tavern
        const tavern = BUILDINGS.find(b => b.id === 'tavern');
        if (tavern) {
            const dist = Math.abs(player.tileX - tavern.x) + Math.abs(player.tileZ - tavern.z);
            if (dist > TAVERN_RANGE) {
                return { success: false, message: 'You need to be at the Tavern to cook!' };
            }
        }

        // Level check
        const cookingLevel = this.getCookingLevel(player);
        if (cookingLevel < recipe.levelReq) {
            return { success: false, message: `You need cooking level ${recipe.levelReq}. (You are level ${cookingLevel}.)` };
        }

        // Check input
        if (this.inventorySystem.countItem(player, recipe.input) < recipe.inputQty) {
            const inputDef = ITEMS[recipe.input];
            return { success: false, message: `Not enough ${inputDef?.name || recipe.input}!` };
        }

        // Consume input
        let toRemove = recipe.inputQty;
        for (let s = 0; s < player.inventory.length && toRemove > 0; s++) {
            if (player.inventory[s].id === recipe.input) {
                const take = Math.min(player.inventory[s].quantity, toRemove);
                this.inventorySystem.removeFromInventory(player, s, take);
                toRemove -= take;
            }
        }

        // Burn check — higher cooking level reduces burn chance
        const levelAbove = cookingLevel - recipe.levelReq;
        const burnReduction = Math.min(1, levelAbove / (recipe.burnLevelImmune - recipe.levelReq));
        const effectiveBurnChance = recipe.burnChance * (1 - burnReduction);

        if (Math.random() < effectiveBurnChance) {
            // Burned! XP is halved on burns
            const halfXP = Math.floor(recipe.xpReward / 2);
            this.addCookingXP(player, halfXP);
            return { success: false, message: `You accidentally burn the ${recipe.name.toLowerCase()}. +${halfXP} cooking XP.` };
        }

        // Success — give output
        if (!this.inventorySystem.addToInventory(player, recipe.output, recipe.outputQty)) {
            return { success: false, message: 'Inventory full!' };
        }

        // Grant cooking XP
        const xpResult = this.addCookingXP(player, recipe.xpReward);
        const outputDef = ITEMS[recipe.output];
        let msg = `Cooked ${outputDef?.icon || ''} ${recipe.outputQty}x ${outputDef?.name || recipe.output}! +${recipe.xpReward} cooking XP.`;
        if (xpResult.leveledUp) {
            msg += ` Cooking level up! Now level ${xpResult.newLevel}.`;
        }
        return { success: true, message: msg };
    }

    // ============================================================
    // Resource Processing — refine gathered materials at Forge/Workshop
    // ============================================================

    processResource(player: PlayerSchema, recipeId: string): { success: boolean; message: string } {
        if (player.isDead) return { success: false, message: 'You are dead!' };

        const recipe = PROCESSING_RECIPES.find(r => r.id === recipeId);
        if (!recipe) return { success: false, message: 'Unknown processing recipe.' };

        // Location check
        if (recipe.location) {
            const building = BUILDINGS.find(b => b.id === recipe.location);
            if (building) {
                const dist = Math.abs(player.tileX - building.x) + Math.abs(player.tileZ - building.z);
                const range = recipe.location === 'forge' ? FORGE_RANGE : WORKSHOP_RANGE;
                if (dist > range) {
                    return { success: false, message: `You need to be at the ${building.name}!` };
                }
            }
        }

        // Level check
        const craftingLevel = this.getCraftingLevel(player);
        if (craftingLevel < recipe.levelReq) {
            return { success: false, message: `You need crafting level ${recipe.levelReq}. (You are level ${craftingLevel}.)` };
        }

        // Check inputs
        for (const inp of recipe.input) {
            if (this.inventorySystem.countItem(player, inp.id) < inp.qty) {
                const itemDef = ITEMS[inp.id];
                return { success: false, message: `Not enough ${itemDef?.name || inp.id}!` };
            }
        }
        if (recipe.coinCost > 0 && this.inventorySystem.countItem(player, 'coins') < recipe.coinCost) {
            return { success: false, message: 'Not enough coins!' };
        }

        // Consume inputs
        for (const inp of recipe.input) {
            let toRemove = inp.qty;
            for (let s = 0; s < player.inventory.length && toRemove > 0; s++) {
                if (player.inventory[s].id === inp.id) {
                    const take = Math.min(player.inventory[s].quantity, toRemove);
                    this.inventorySystem.removeFromInventory(player, s, take);
                    toRemove -= take;
                }
            }
        }

        // Deduct coins
        if (recipe.coinCost > 0) {
            this.inventorySystem.deductCoins(player, recipe.coinCost);
        }

        // Give result
        if (!this.inventorySystem.addToInventory(player, recipe.output, recipe.outputQty)) {
            return { success: false, message: 'Inventory full!' };
        }

        // Grant crafting XP
        const xpResult = this.addCraftingXP(player, recipe.xpReward);
        const outputDef = ITEMS[recipe.output];
        let msg = `Processed ${outputDef?.icon || ''} ${recipe.outputQty}x ${outputDef?.name || recipe.output}! +${recipe.xpReward} crafting XP.`;
        if (xpResult.leveledUp) {
            msg += ` Crafting level up! Now level ${xpResult.newLevel}.`;
        }
        return { success: true, message: msg };
    }

    // ============================================================
    // Recipe Listing — for client UI
    // ============================================================

    getCookingRecipes(): CookingRecipe[] {
        return COOKING_RECIPES;
    }

    getProcessingRecipes(): ProcessingRecipe[] {
        return PROCESSING_RECIPES;
    }

    /** Returns recipe info with player's eligibility */
    getAvailableRecipes(player: PlayerSchema): {
        config: { index: number; result: string; name: string; levelReq: number; canCraft: boolean }[];
        cooking: { id: string; name: string; levelReq: number; canCook: boolean }[];
        processing: { id: string; name: string; levelReq: number; canProcess: boolean }[];
    } {
        const craftingLevel = this.getCraftingLevel(player);
        const cookingLevel = this.getCookingLevel(player);

        return {
            config: RECIPES.map((r, i) => ({
                index: i,
                result: r.result,
                name: ITEMS[r.result]?.name || r.result,
                levelReq: RECIPE_LEVEL_REQS[i] || 1,
                canCraft: craftingLevel >= (RECIPE_LEVEL_REQS[i] || 1),
            })),
            cooking: COOKING_RECIPES.map(r => ({
                id: r.id,
                name: r.name,
                levelReq: r.levelReq,
                canCook: cookingLevel >= r.levelReq,
            })),
            processing: PROCESSING_RECIPES.map(r => ({
                id: r.id,
                name: r.name,
                levelReq: r.levelReq,
                canProcess: craftingLevel >= r.levelReq,
            })),
        };
    }
}
