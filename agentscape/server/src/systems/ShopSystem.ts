// ============================================================
// AgentScape — Server-Authoritative Shop System
// Ported from apps/runescape-game.html lines 825-923
// ============================================================

import { PlayerSchema } from '../schema/PlayerSchema';
import { GameState, ShopStock } from '../schema/GameState';
import { SHOP_ITEMS, ITEMS } from '../config';
import { InventorySystem } from './InventorySystem';

export class ShopSystem {
    private inventorySystem: InventorySystem;

    constructor(inventorySystem: InventorySystem) {
        this.inventorySystem = inventorySystem;
    }

    initShopStock(state: GameState): void {
        for (const si of SHOP_ITEMS) {
            const stock = new ShopStock();
            stock.itemId = si.id;
            stock.stock = si.stock;
            state.shopStock.set(si.id, stock);
        }
    }

    buyItem(player: PlayerSchema, itemId: string, qty: number, state: GameState): { success: boolean; message: string } {
        if (player.isDead) return { success: false, message: 'You are dead!' };

        const si = SHOP_ITEMS.find(s => s.id === itemId);
        if (!si) return { success: false, message: 'Item not found.' };

        const stock = state.shopStock.get(itemId);
        if (!stock || stock.stock < qty) return { success: false, message: 'Out of stock!' };

        const cost = si.price * qty;
        if (!this.inventorySystem.deductCoins(player, cost)) {
            return { success: false, message: 'Not enough coins!' };
        }

        if (!this.inventorySystem.addToInventory(player, itemId, qty)) {
            // Refund coins
            this.inventorySystem.addToInventory(player, 'coins', cost);
            return { success: false, message: 'Inventory full!' };
        }

        stock.stock -= qty;
        const item = ITEMS[itemId];
        return { success: true, message: `Bought ${qty}x ${item.name} for ${cost} coins.` };
    }

    sellItem(player: PlayerSchema, slot: number, state: GameState): { success: boolean; message: string } {
        if (player.isDead) return { success: false, message: 'You are dead!' };

        const item = player.inventory[slot];
        if (!item.id || item.type === 'coin') return { success: false, message: 'Cannot sell that.' };

        const si = SHOP_ITEMS.find(s => s.id === item.id);
        const sellPrice = si ? Math.floor(si.price / 2) : 1;
        const name = item.name;

        this.inventorySystem.addToInventory(player, 'coins', sellPrice);
        this.inventorySystem.removeFromInventory(player, slot, 1);

        // Restock shop
        if (si) {
            const stock = state.shopStock.get(item.id);
            if (stock) stock.stock += 1;
        }

        return { success: true, message: `Sold ${name} for ${sellPrice} coins.` };
    }
}
