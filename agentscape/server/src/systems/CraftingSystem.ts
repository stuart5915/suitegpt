// ============================================================
// AgentScape — Server-Authoritative Crafting System
// Ported from apps/runescape-game.html lines 925-986
// ============================================================

import { PlayerSchema } from '../schema/PlayerSchema';
import { RECIPES, ITEMS } from '../config';
import { InventorySystem } from './InventorySystem';

export class CraftingSystem {
    private inventorySystem: InventorySystem;

    constructor(inventorySystem: InventorySystem) {
        this.inventorySystem = inventorySystem;
    }

    craftItem(player: PlayerSchema, recipeIndex: number): { success: boolean; message: string } {
        if (player.isDead) return { success: false, message: 'You are dead!' };

        const recipe = RECIPES[recipeIndex];
        if (!recipe) return { success: false, message: 'Unknown recipe.' };

        // Check ingredients
        for (const ing of recipe.ingredients) {
            if (this.inventorySystem.countItem(player, ing.id) < ing.qty) {
                return { success: false, message: `Not enough ${ITEMS[ing.id].name}!` };
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

        const resultItem = ITEMS[recipe.result];
        return { success: true, message: `Crafted ${resultItem.icon} ${resultItem.name}!` };
    }
}
