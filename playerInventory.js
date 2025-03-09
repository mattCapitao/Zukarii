console.log("playerInventory.js loaded");

import { State } from './state.js';
import { UI } from './ui.js';
import { Player } from './player.js';
import { Utilities } from './utilities.js';

export class PlayerInventory {
    constructor(state, ui, player, utilities) {
        this.state = state;
        this.ui = ui;
        this.player = player;
        this.utilities = utilities;
    }

    addItem(item) {
        item.uniqueId = this.utilities.generateUniqueId();
        const isDuplicate = this.state.player.inventory.items.some(i => i.uniqueId === item.uniqueId);
        if (!isDuplicate) {
            this.state.player.inventory.items.push({ ...item });
            this.ui.writeToLog(`Added ${item.name} to inventory`);
        } else {
            console.log(`Duplicate ${item.name} (ID: ${item.uniqueId}) prevented from adding to inventory`);
        }
    }

    getEquipped(slot) {
        return this.state.player.inventory.equipped[slot];
    }

    isSlotCompatible(item, slot) {
        const slotMap = {
            amulet: "amulet",
            armor: "armor",
            ring: ["leftring", "rightring"],
            weapon: ["mainhand", "offhand"]
        };
        const validSlots = slotMap[item.type];
        if (!validSlots) return false;
        return Array.isArray(validSlots) ? validSlots.includes(slot) : validSlots === slot;
    }

    equipItem(item) {
        if (item.levelRequirement && this.player.state.player.level < item.levelRequirement) {
            this.ui.writeToLog(`You need to be level ${item.levelRequirement} to equip ${item.name}!`);
            this.ui.hideItemTooltip(item);
            return;
        }

        const indexToRemove = this.state.player.inventory.items.findIndex(i => i.uniqueId === item.uniqueId);
        if (indexToRemove === -1) {
            console.error(`Item ${item.name} (ID: ${item.uniqueId}) not found in inventory—cannot equip!`);
            this.ui.writeToLog(`Error: Couldn't equip ${item.name}—not in inventory!`);
            this.ui.hideItemTooltip(item);
            return;
        }

        this.ui.hideItemTooltip(item);

        this.state.player.inventory.items.splice(indexToRemove, 1);

        switch (item.type) {
            case "weapon":
                const slots = ["mainhand", "offhand"];
                let equippedSlot = item.equippedSlot || (item.attackType === "melee" ? "mainhand" : "offhand");
                if (!slots.includes(equippedSlot)) {
                    console.error(`Invalid slot ${equippedSlot} for ${item.name}`);
                    this.ui.writeToLog(`Error: Invalid slot for ${item.name}!`);
                    this.ui.hideItemTooltip(item);
                    return;
                }
                item.equippedSlot = equippedSlot;
                const oldWeapon = this.state.player.inventory.equipped[equippedSlot];
                if (oldWeapon && oldWeapon.itemTier !== "Empty") {
                    this.state.player.inventory.items.push({ ...oldWeapon, equippedSlot: undefined });
                    this.ui.writeToLog(`Unequipped ${oldWeapon.name} to inventory`);
                    this.ui.hideItemTooltip(oldWeapon);
                }
                this.state.player.inventory.equipped[equippedSlot] = { ...item };
                this.ui.writeToLog(`Equipped ${item.name} to ${equippedSlot}`);
                this.ui.hideItemTooltip(item);
                break;

            case "armor":
                const oldArmor = this.state.player.inventory.equipped.armor;
                if (oldArmor && oldArmor.itemTier !== "Empty") {
                    this.state.player.inventory.items.push({ ...oldArmor, equippedSlot: undefined });
                    this.ui.writeToLog(`Unequipped ${oldArmor.name} to inventory`);
                    this.ui.hideItemTooltip(oldArmor);
                }
                this.state.player.inventory.equipped.armor = { ...item };
                item.equippedSlot = "armor";
                this.ui.writeToLog(`Equipped ${item.name}`);
                this.ui.hideItemTooltip(item);
                break;

            case "amulet":
                item.equippedSlot = "amulet";
                const oldAmulet = this.state.player.inventory.equipped.amulet;
                if (oldAmulet && oldAmulet.itemTier !== "Empty") {
                    this.state.player.inventory.items.push({ ...oldAmulet, equippedSlot: undefined });
                    this.ui.writeToLog(`Unequipped ${oldAmulet.name} to inventory`);
                    this.ui.hideItemTooltip(oldAmulet);
                }
                this.state.player.inventory.equipped.amulet = { ...item };
                this.ui.writeToLog(`Equipped ${item.name}`);
                this.ui.hideItemTooltip(item);
                break;

            case "ring":
                item.equippedSlot = (this.state.player.inventory.equipped.leftring.itemTier === "Empty" ? "leftring" : "rightring");
                const oldRing = this.state.player.inventory.equipped[item.equippedSlot];
                if (oldRing && oldRing.itemTier !== "Empty") {
                    this.state.player.inventory.items.push({ ...oldRing, equippedSlot: undefined });
                    this.ui.writeToLog(`Unequipped ${oldRing.name} to inventory`);
                    this.ui.hideItemTooltip(oldRing);
                }
                this.state.player.inventory.equipped[item.equippedSlot] = { ...item };
                this.ui.writeToLog(`Equipped ${item.name}`);
                this.ui.hideItemTooltip(item);
                break;

            default:
                console.error(`Unknown item type: ${item.type}`);
                this.ui.writeToLog(`Error: Unknown item type ${item.type}!`);
                this.ui.hideItemTooltip(item);
                return;
        }

        this.player.updateGearStats();
    }

    unequipItem(item) {
        if (!item || item.itemTier === "Empty") return;

        if (!item.equippedSlot) {
            const slotMap = {
                amulet: "amulet",
                armor: "armor",
                ring: ["leftring", "rightring"],
                weapon: ["mainhand", "offhand"]
            };
            for (let [slotType, slotName] of Object.entries(slotMap)) {
                if (item.type === slotType) {
                    if (Array.isArray(slotName)) {
                        item.equippedSlot = slotName.find(s => this.state.player.inventory.equipped[s].name === item.name) || slotName[0];
                    } else {
                        item.equippedSlot = slotName;
                    }
                    break;
                }
            }
            if (!item.equippedSlot) {
                console.error("Could not determine equippedSlot for", item);
                this.ui.writeToLog(`Error: Could not unequip ${item.name}—slot not found!`);
                this.ui.hideItemTooltip(item);
                return;
            }
        }

        this.ui.hideItemTooltip(item);

        const isDuplicate = this.state.player.inventory.items.some(i => i.uniqueId === item.uniqueId);
        if (!isDuplicate) {
            this.state.player.inventory.items.push({ ...item });
            this.ui.writeToLog(`Unequipped ${item.name} to inventory`);
        } else {
            console.log(`Duplicate ${item.name} (ID: ${item.uniqueId}) prevented from adding to inventory`);
        }

        let emptyItemName = item.equippedSlot === "mainhand" ? "Main Hand" : item.equippedSlot === "offhand" ? "Off Hand" : item.equippedSlot.charAt(0).toUpperCase() + item.equippedSlot.slice(1);
        this.state.player.inventory.equipped[item.equippedSlot] = {
            name: emptyItemName,
            itemTier: "Empty",
            type: item.equippedSlot,
            slot: item.equippedSlot,
            uniqueId: this.utilities.generateUniqueId(),
            icon: `no-${item.equippedSlot}.svg`,
        };
        this.ui.hideItemTooltip(this.state.player.inventory.equipped[item.equippedSlot]);

        this.player.updateGearStats();
        this.ui.updateStats(); // Added to refresh bottom panel after unequipping
    }

    dropItem(index) {
        const item = this.state.player.inventory.items[index];
        if (item) {
            this.ui.hideItemTooltip(item);
            this.state.player.inventory.items.splice(index, 1);
            this.ui.writeToLog(`Dropped ${item.name}`);
            this.ui.updateStats(); // Added to refresh bottom panel after dropping
        }
    }

    handleDrop(draggedItemData, targetItemData, isTargetEquipped) {
        if (!draggedItemData || !draggedItemData.uniqueId || !targetItemData || !targetItemData.uniqueId) {
            console.error("Invalid drag-drop data:", draggedItemData, targetItemData);
            return;
        }

        this.ui.hideItemTooltip(draggedItemData);
        this.ui.hideItemTooltip(targetItemData);

        if (!draggedItemData.equippedSlot && isTargetEquipped) {
            if (this.isSlotCompatible(draggedItemData, targetItemData.equippedSlot)) {
                const targetSlot = targetItemData.equippedSlot;
                const currentEquipped = this.getEquipped(targetSlot);
                if (currentEquipped && currentEquipped.itemTier !== "Empty") {
                    this.unequipItem(currentEquipped);
                }
                const draggedCopy = { ...draggedItemData, equippedSlot: targetSlot };
                this.equipItem(draggedCopy);
            } else {
                this.ui.writeToLog(`Cannot equip ${draggedItemData.name} to ${targetItemData.equippedSlot}!`);
            }
        } else if (draggedItemData.equippedSlot && !isTargetEquipped) {
            this.unequipItem(draggedItemData);
        } else if (draggedItemData.equippedSlot && isTargetEquipped) {
            if (this.isSlotCompatible(draggedItemData, targetItemData.equippedSlot) && this.isSlotCompatible(targetItemData, draggedItemData.equippedSlot)) {
                const draggedSlot = draggedItemData.equippedSlot;
                const targetSlot = targetItemData.equippedSlot;

                const draggedCopy = { ...draggedItemData, equippedSlot: targetSlot };
                const targetCopy = { ...targetItemData, equippedSlot: draggedSlot };

                if (draggedItemData.itemTier !== "Empty") this.unequipItem(draggedItemData);
                if (targetItemData.itemTier !== "Empty") this.unequipItem(targetItemData);

                if (draggedItemData.itemTier !== "Empty") this.equipItem(draggedCopy);
                if (targetItemData.itemTier !== "Empty") this.equipItem(targetCopy);

                this.ui.writeToLog(`Swapped ${draggedItemData.name} with ${targetItemData.name}`);
            } else {
                this.ui.writeToLog(`Cannot swap ${draggedItemData.name} with ${targetItemData.name}!`);
            }
        } else {
            console.log("Inventory-to-inventory drag, no action taken");
        }
        this.ui.updateStats(); // Added to refresh bottom panel after drag-drop
    }
}