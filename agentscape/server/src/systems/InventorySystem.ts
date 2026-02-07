// ============================================================
// AgentScape — Server-Authoritative Inventory System
// Ported from apps/runescape-game.html lines 988-1143
// ============================================================

import { PlayerSchema, InventoryItem } from '../schema/PlayerSchema';
import { ITEMS, MAX_INVENTORY_SLOTS, ItemDef, levelFromXP, computeCombatLevel, xpForLevel } from '../config';

export class InventorySystem {
    initStartingInventory(player: PlayerSchema): void {
        // Clear all slots
        while (player.inventory.length > 0) player.inventory.pop();
        for (let i = 0; i < MAX_INVENTORY_SLOTS; i++) {
            player.inventory.push(new InventoryItem());
        }

        this.setSlot(player, 0, 'bronze_sword', 1);
        this.setSlot(player, 1, 'bread', 1);
        this.setSlot(player, 2, 'bread', 1);
        this.setSlot(player, 3, 'bread', 1);
        this.setSlot(player, 4, 'coins', 25);
        player.equippedWeaponSlot = 0;
    }

    private setSlot(player: PlayerSchema, slot: number, itemId: string, qty: number): void {
        const def = ITEMS[itemId];
        if (!def) return;
        const item = player.inventory[slot];
        item.id = def.id;
        item.name = def.name;
        item.icon = def.icon;
        item.quantity = qty;
        item.type = def.type;
        item.stackable = def.stackable;
        item.attackStat = def.stats?.attack || 0;
        item.strengthStat = def.stats?.strength || 0;
        item.defenceStat = def.stats?.defence || 0;
        item.healAmount = def.healAmount || 0;
    }

    clearSlot(player: PlayerSchema, slot: number): void {
        const item = player.inventory[slot];
        item.id = '';
        item.name = '';
        item.icon = '';
        item.quantity = 0;
        item.type = '';
        item.stackable = false;
        item.attackStat = 0;
        item.strengthStat = 0;
        item.defenceStat = 0;
        item.healAmount = 0;

        // Unequip if needed
        if (player.equippedWeaponSlot === slot) player.equippedWeaponSlot = -1;
        if (player.equippedHelmSlot === slot) player.equippedHelmSlot = -1;
        if (player.equippedShieldSlot === slot) player.equippedShieldSlot = -1;
    }

    addToInventory(player: PlayerSchema, itemId: string, qty: number): boolean {
        const def = ITEMS[itemId];
        if (!def) return false;

        // If stackable, find existing stack
        if (def.stackable) {
            for (let i = 0; i < MAX_INVENTORY_SLOTS; i++) {
                if (player.inventory[i].id === itemId) {
                    player.inventory[i].quantity += qty;
                    player.dirty = true;
                    return true;
                }
            }
        }

        // Place items one by one (non-stackable) or create new stack
        let placed = 0;
        for (let q = 0; q < qty; q++) {
            let found = false;
            for (let i = 0; i < MAX_INVENTORY_SLOTS; i++) {
                if (!player.inventory[i].id) {
                    this.setSlot(player, i, itemId, 1);
                    found = true;
                    placed++;
                    break;
                }
            }
            if (!found) break; // inventory full
        }

        if (placed > 0) player.dirty = true;
        return placed === qty;
    }

    removeFromInventory(player: PlayerSchema, slot: number, qty: number): boolean {
        const item = player.inventory[slot];
        if (!item.id) return false;

        item.quantity -= qty;
        if (item.quantity <= 0) {
            this.clearSlot(player, slot);
        }
        player.dirty = true;
        return true;
    }

    countItem(player: PlayerSchema, itemId: string): number {
        let total = 0;
        for (let i = 0; i < MAX_INVENTORY_SLOTS; i++) {
            if (player.inventory[i].id === itemId) total += player.inventory[i].quantity;
        }
        return total;
    }

    deductCoins(player: PlayerSchema, amount: number): boolean {
        const has = this.countItem(player, 'coins');
        if (has < amount) return false;

        let toDeduct = amount;
        for (let i = 0; i < MAX_INVENTORY_SLOTS && toDeduct > 0; i++) {
            if (player.inventory[i].id === 'coins') {
                const take = Math.min(player.inventory[i].quantity, toDeduct);
                player.inventory[i].quantity -= take;
                toDeduct -= take;
                if (player.inventory[i].quantity <= 0) this.clearSlot(player, i);
            }
        }
        player.dirty = true;
        return true;
    }

    eatFood(player: PlayerSchema, slot: number): { healed: number } | null {
        const item = player.inventory[slot];
        if (!item.id || item.type !== 'food') return null;

        const heal = item.healAmount || 10;
        player.hp = Math.min(player.maxHp, player.hp + heal);
        player.energy = Math.min(player.maxEnergy, player.energy + 5);
        this.removeFromInventory(player, slot, 1);
        return { healed: heal };
    }

    equipWeapon(player: PlayerSchema, slot: number): boolean {
        const item = player.inventory[slot];
        if (!item.id || item.type !== 'weapon') return false;

        if (player.equippedWeaponSlot === slot) {
            player.equippedWeaponSlot = -1;
        } else {
            player.equippedWeaponSlot = slot;
        }
        return true;
    }

    equipHelm(player: PlayerSchema, slot: number): boolean {
        const item = player.inventory[slot];
        if (!item.id || item.type !== 'helm') return false;

        if (player.equippedHelmSlot === slot) {
            player.equippedHelmSlot = -1;
        } else {
            player.equippedHelmSlot = slot;
        }
        return true;
    }

    equipShield(player: PlayerSchema, slot: number): boolean {
        const item = player.inventory[slot];
        if (!item.id || item.type !== 'shield') return false;

        if (player.equippedShieldSlot === slot) {
            player.equippedShieldSlot = -1;
        } else {
            player.equippedShieldSlot = slot;
        }
        return true;
    }

    dropItem(player: PlayerSchema, slot: number): boolean {
        const item = player.inventory[slot];
        if (!item.id) return false;
        this.clearSlot(player, slot);
        player.dirty = true;
        return true;
    }

    gainXP(player: PlayerSchema, skill: string, amount: number): { leveledUp: boolean; newLevel: number } {
        const xpKey = skill + 'XP' as keyof PlayerSchema;
        const skillKey = skill as keyof PlayerSchema;
        const oldXP = (player as any)[xpKey] as number;
        const oldLevel = levelFromXP(oldXP);
        (player as any)[xpKey] = oldXP + amount;
        const newLevel = levelFromXP(oldXP + amount);
        (player as any)[skillKey] = newLevel;

        player.combatLevel = computeCombatLevel(player.attack, player.strength, player.defence, player.hitpoints);
        player.maxHp = 10 + player.hitpoints * 10;
        player.dirty = true;

        return { leveledUp: newLevel > oldLevel, newLevel };
    }
}
