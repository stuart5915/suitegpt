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

        this.setSlot(player, 0, 'bread', 1);
        this.setSlot(player, 1, 'bread', 1);
        this.setSlot(player, 2, 'bread', 1);
        this.setSlot(player, 3, 'coins', 25);
        // Bronze sword goes directly to equipment slot
        this.setItemFromDef(player.equippedWeapon, 'bronze_sword');
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
        this.clearItem(item);
    }

    // --- Equipment helpers ---
    private copyItem(from: InventoryItem, to: InventoryItem): void {
        to.id = from.id;
        to.name = from.name;
        to.icon = from.icon;
        to.quantity = from.quantity;
        to.type = from.type;
        to.stackable = from.stackable;
        to.attackStat = from.attackStat;
        to.strengthStat = from.strengthStat;
        to.defenceStat = from.defenceStat;
        to.healAmount = from.healAmount;
    }

    private clearItem(item: InventoryItem): void {
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
    }

    private findFreeSlot(player: PlayerSchema): number {
        for (let i = 0; i < MAX_INVENTORY_SLOTS; i++) {
            if (!player.inventory[i].id) return i;
        }
        return -1;
    }

    private setItemFromDef(item: InventoryItem, itemId: string): void {
        const def = ITEMS[itemId];
        if (!def) return;
        item.id = def.id;
        item.name = def.name;
        item.icon = def.icon;
        item.quantity = 1;
        item.type = def.type;
        item.stackable = def.stackable;
        item.attackStat = def.stats?.attack || 0;
        item.strengthStat = def.stats?.strength || 0;
        item.defenceStat = def.stats?.defence || 0;
        item.healAmount = def.healAmount || 0;
    }

    private getEquipSlot(player: PlayerSchema, itemType: string): InventoryItem | null {
        if (itemType === 'weapon' || itemType === 'axe') return player.equippedWeapon;
        if (itemType === 'helm') return player.equippedHelm;
        if (itemType === 'shield') return player.equippedShield;
        if (itemType === 'body') return player.equippedBody;
        if (itemType === 'legs') return player.equippedLegs;
        if (itemType === 'boots') return player.equippedBoots;
        if (itemType === 'gloves') return player.equippedGloves;
        if (itemType === 'cape') return player.equippedCape;
        if (itemType === 'ring') return player.equippedRing;
        if (itemType === 'amulet') return player.equippedAmulet;
        return null;
    }

    equipFromInventory(player: PlayerSchema, inventorySlot: number): { success: boolean; message?: string } {
        const invItem = player.inventory[inventorySlot];
        if (!invItem || !invItem.id) return { success: false, message: 'No item in that slot.' };

        const equipSlot = this.getEquipSlot(player, invItem.type);
        if (!equipSlot) return { success: false, message: 'Cannot equip that item.' };

        // Check level requirements
        const def = ITEMS[invItem.id];
        if (def?.levelReq) {
            if (def.levelReq.attack && player.attack < def.levelReq.attack)
                return { success: false, message: `You need ${def.levelReq.attack} Attack to equip that.` };
            if (def.levelReq.strength && player.strength < def.levelReq.strength)
                return { success: false, message: `You need ${def.levelReq.strength} Strength to equip that.` };
            if (def.levelReq.defence && player.defence < def.levelReq.defence)
                return { success: false, message: `You need ${def.levelReq.defence} Defence to equip that.` };
        }

        if (equipSlot.id) {
            // Swap: old equipped → inv slot, new inv → equip slot
            const tempId = equipSlot.id;
            const tempName = equipSlot.name;
            const tempIcon = equipSlot.icon;
            const tempQty = equipSlot.quantity;
            const tempType = equipSlot.type;
            const tempStack = equipSlot.stackable;
            const tempAtk = equipSlot.attackStat;
            const tempStr = equipSlot.strengthStat;
            const tempDef = equipSlot.defenceStat;
            const tempHeal = equipSlot.healAmount;

            // Move inv item → equip slot
            this.copyItem(invItem, equipSlot);

            // Put old equipped → inv slot
            invItem.id = tempId;
            invItem.name = tempName;
            invItem.icon = tempIcon;
            invItem.quantity = tempQty;
            invItem.type = tempType;
            invItem.stackable = tempStack;
            invItem.attackStat = tempAtk;
            invItem.strengthStat = tempStr;
            invItem.defenceStat = tempDef;
            invItem.healAmount = tempHeal;
        } else {
            // Empty equip slot: move inv → equip, clear inv
            this.copyItem(invItem, equipSlot);
            this.clearItem(invItem);
        }

        player.dirty = true;
        return { success: true };
    }

    unequipSlot(player: PlayerSchema, slotName: string): { success: boolean; message?: string } {
        const slotMap: Record<string, InventoryItem> = {
            weapon: player.equippedWeapon, helm: player.equippedHelm, shield: player.equippedShield,
            body: player.equippedBody, legs: player.equippedLegs, boots: player.equippedBoots,
            gloves: player.equippedGloves, cape: player.equippedCape, ring: player.equippedRing,
            amulet: player.equippedAmulet,
        };
        const equipSlot = slotMap[slotName];
        if (!equipSlot) return { success: false, message: 'Invalid slot.' };

        if (!equipSlot.id) return { success: false, message: 'Nothing equipped there.' };

        const freeSlot = this.findFreeSlot(player);
        if (freeSlot < 0) return { success: false, message: 'Inventory is full!' };

        this.copyItem(equipSlot, player.inventory[freeSlot]);
        this.clearItem(equipSlot);
        player.dirty = true;
        return { success: true };
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
                    if (itemId === 'coins') player.coins = this.countItem(player, 'coins');
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
                    this.setSlot(player, i, itemId, def.stackable ? qty : 1);
                    found = true;
                    placed += def.stackable ? qty : 1;
                    break;
                }
            }
            if (!found) break; // inventory full
            if (def.stackable) break; // stackable items go in one slot
        }

        if (placed > 0) {
            player.dirty = true;
            if (itemId === 'coins') player.coins = this.countItem(player, 'coins');
        }
        return def.stackable ? placed >= qty : placed === qty;
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
        player.coins = this.countItem(player, 'coins');
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

    // --- Combat stat helpers ---
    private getAllEquipSlots(player: PlayerSchema): InventoryItem[] {
        return [player.equippedWeapon, player.equippedHelm, player.equippedShield,
                player.equippedBody, player.equippedLegs, player.equippedBoots,
                player.equippedGloves, player.equippedCape, player.equippedRing,
                player.equippedAmulet];
    }

    getPlayerAttack(player: PlayerSchema): number {
        let atk = player.attack;
        for (const slot of this.getAllEquipSlots(player)) {
            if (slot.id) atk += slot.attackStat;
        }
        return atk;
    }

    getPlayerStrength(player: PlayerSchema): number {
        let str = player.strength;
        for (const slot of this.getAllEquipSlots(player)) {
            if (slot.id) str += slot.strengthStat;
        }
        return str;
    }

    getPlayerDefence(player: PlayerSchema): number {
        let def = player.defence;
        const armorSlots = [player.equippedHelm, player.equippedShield, player.equippedBody,
                           player.equippedLegs, player.equippedBoots, player.equippedGloves,
                           player.equippedCape, player.equippedRing, player.equippedAmulet];
        for (const slot of armorSlots) {
            if (slot.id) def += slot.defenceStat;
        }
        return def;
    }
}
