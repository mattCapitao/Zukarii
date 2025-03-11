//console.log("PlayerInventory.js loaded");

import { State } from './State.js';

export class PlayerInventory {
    constructor(state) {
        this.state = state;
    }

    addItem(item) {
        const uiService = this.state.game.getService('ui');
        item.uniqueId = this.state.utilities.generateUniqueId();
        if (!this.state.player.inventory.items.some(i => i.uniqueId === item.uniqueId)) {
            this.state.player.inventory.items.push({ ...item });
            uiService.writeToLog(`Added ${item.name} to inventory`);
        }
    }

    getEquipped(slot) {
        return this.state.player.inventory.equipped[slot] || null;
    }

    isSlotCompatible(item, slot) {
        const slotMap = {
            amulet: ["amulet"],
            armor: ["armor"],
            ring: ["leftring", "rightring"],
            weapon: ["mainhand", "offhand"]
        };
        const validSlots = slotMap[item.type];
        return validSlots?.includes(slot) || false;
    }

    equipItem(item, slot) {
        const uiService = this.state.game.getService('ui');
        const playerService = this.state.game.getService('player');
        if (item.levelRequirement && this.state.player.level < item.levelRequirement) {
            uiService.writeToLog(`You need to be level ${item.levelRequirement} to equip ${item.name}!`);
            return false;
        }

        const index = this.state.player.inventory.items.findIndex(i => i.uniqueId === item.uniqueId);
        if (index === -1) {
            console.error(`Item ${item.name} not found in inventory`);
            return false;
        }

        const currentItem = this.getEquipped(slot);
        if (currentItem) {
            this.unequipItem(slot, false); // Move to inventory without UI update yet
        }

        this.state.player.inventory.items.splice(index, 1);
        this.state.player.inventory.equipped[slot] = { ...item, equippedSlot: slot };
        uiService.writeToLog(`Equipped ${item.name} to ${slot}`);
        playerService.updateGearStats();
        uiService.statRefreshUI();
        return true;
    }

    unequipItem(slot, toInventory = true) {
        const uiService = this.state.game.getService('ui');
        const playerService = this.state.game.getService('player');
        const item = this.getEquipped(slot);
        if (!item) return;

        this.state.player.inventory.equipped[slot] = null;
        if (toInventory) {
            this.state.player.inventory.items.push({ ...item, equippedSlot: undefined });
            uiService.writeToLog(`Unequipped ${item.name} to inventory`);
        }
        playerService.updateGearStats();
        if (toInventory) uiService.statRefreshUI();
    }

    dropItem(index) {
        const uiService = this.state.game.getService('ui');
        const actionsService = this.state.game.getService('actions');
        const item = this.state.player.inventory.items[index];
        if (!item) return;

        this.state.player.inventory.items.splice(index, 1);
        const treasure = {
            x: this.state.player.x,
            y: this.state.player.y,
            name: `${item.name} Treasure`,
            gold: 0,
            torches: 0,
            healPotions: 0,
            items: [{ ...item }],
        };
        actionsService.placeTreasure(treasure);
        uiService.writeToLog(`Dropped ${item.name} as treasure at (${treasure.x}, ${treasure.y})`);
        uiService.statRefreshUI();
    }

    handleDrop(draggedItem, targetSlotData, isTargetEquipped) {
        const uiService = this.state.game.getService('ui');
        if (!draggedItem || !targetSlotData) return;

        if (!isTargetEquipped) {
            // Inventory-to-inventory drag, no action
            return;
        }

        const slot = targetSlotData.slot;
        if (!this.isSlotCompatible(draggedItem, slot)) {
            uiService.writeToLog(`Cannot equip ${draggedItem.name} to ${slot}!`);
            return;
        }

        if (draggedItem.equippedSlot) {
            // Slot-to-slot drag (not implemented yet)
            uiService.writeToLog(`Slot-to-slot dragging not supported yet`);
            return;
        }

        // Inventory to equip slot
        this.equipItem(draggedItem, slot);
    }
}