console.log("PlayerInventory.js loaded");

import { State } from './State.js';

export class PlayerInventory {
    constructor(state) {
        this.state = state;
    }

    addItem(item) {
        const uiService = this.state.game.getService('ui');
        item.uniqueId = this.state.utilities.generateUniqueId();
        const isDuplicate = this.state.player.inventory.items.some(i => i.uniqueId === item.uniqueId);
        if (!isDuplicate) {
            this.state.player.inventory.items.push({ ...item });
            uiService.writeToLog(`Added ${item.name} to inventory`);
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
        const uiService = this.state.game.getService('ui');
        const playerService = this.state.game.getService('player');
        if (item.levelRequirement && this.state.player.level < item.levelRequirement) {
            uiService.writeToLog(`You need to be level ${item.levelRequirement} to equip ${item.name}!`);
            uiService.hideItemTooltip(item);
            return;
        }

        const indexToRemove = this.state.player.inventory.items.findIndex(i => i.uniqueId === item.uniqueId);
        if (indexToRemove === -1) {
            console.error(`Item ${item.name} (ID: ${item.uniqueId}) not found in inventory—cannot equip!`);
            uiService.writeToLog(`Error: Couldn't equip ${item.name}—not in inventory!`);
            uiService.hideItemTooltip(item);
            return;
        }

        uiService.hideItemTooltip(item);

        this.state.player.inventory.items.splice(indexToRemove, 1);

        switch (item.type) {
            case "weapon":
                const slots = ["mainhand", "offhand"];
                let equippedSlot = item.equippedSlot || (item.attackType === "melee" ? "mainhand" : "offhand");
                if (!slots.includes(equippedSlot)) {
                    console.error(`Invalid slot ${equippedSlot} for ${item.name}`);
                    uiService.writeToLog(`Error: Invalid slot for ${item.name}!`);
                    uiService.hideItemTooltip(item);
                    return;
                }
                item.equippedSlot = equippedSlot;
                const oldWeapon = this.state.player.inventory.equipped[equippedSlot];
                if (oldWeapon && oldWeapon.itemTier !== "Empty") {
                    this.state.player.inventory.items.push({ ...oldWeapon, equippedSlot: undefined });
                    uiService.writeToLog(`Unequipped ${oldWeapon.name} to inventory`);
                    uiService.hideItemTooltip(oldWeapon);
                }
                this.state.player.inventory.equipped[equippedSlot] = { ...item };
                uiService.writeToLog(`Equipped ${item.name} to ${equippedSlot}`);
                uiService.hideItemTooltip(item);
                break;

            case "armor":
                const oldArmor = this.state.player.inventory.equipped.armor;
                if (oldArmor && oldArmor.itemTier !== "Empty") {
                    this.state.player.inventory.items.push({ ...oldArmor, equippedSlot: undefined });
                    uiService.writeToLog(`Unequipped ${oldArmor.name} to inventory`);
                    uiService.hideItemTooltip(oldArmor);
                }
                this.state.player.inventory.equipped.armor = { ...item };
                item.equippedSlot = "armor";
                uiService.writeToLog(`Equipped ${item.name}`);
                uiService.hideItemTooltip(item);
                break;

            case "amulet":
                item.equippedSlot = "amulet";
                const oldAmulet = this.state.player.inventory.equipped.amulet;
                if (oldAmulet && oldAmulet.itemTier !== "Empty") {
                    this.state.player.inventory.items.push({ ...oldAmulet, equippedSlot: undefined });
                    uiService.writeToLog(`Unequipped ${oldAmulet.name} to inventory`);
                    uiService.hideItemTooltip(oldAmulet);
                }
                this.state.player.inventory.equipped.amulet = { ...item };
                uiService.writeToLog(`Equipped ${item.name}`);
                uiService.hideItemTooltip(item);
                break;

            case "ring":
                item.equippedSlot = (this.state.player.inventory.equipped.leftring.itemTier === "Empty" ? "leftring" : "rightring");
                const oldRing = this.state.player.inventory.equipped[item.equippedSlot];
                if (oldRing && oldRing.itemTier !== "Empty") {
                    this.state.player.inventory.items.push({ ...oldRing, equippedSlot: undefined });
                    uiService.writeToLog(`Unequipped ${oldRing.name} to inventory`);
                    uiService.hideItemTooltip(oldRing);
                }
                this.state.player.inventory.equipped[item.equippedSlot] = { ...item };
                uiService.writeToLog(`Equipped ${item.name}`);
                uiService.hideItemTooltip(item);
                break;

            default:
                console.error(`Unknown item type: ${item.type}`);
                uiService.writeToLog(`Error: Unknown item type ${item.type}!`);
                uiService.hideItemTooltip(item);
                return;
        }

        playerService.updateGearStats();
    }

    unequipItem(item) {
        const uiService = this.state.game.getService('ui');
        const playerService = this.state.game.getService('player');
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
                uiService.writeToLog(`Error: Could not unequip ${item.name}—slot not found!`);
                uiService.hideItemTooltip(item);
                return;
            }
        }

        uiService.hideItemTooltip(item);

        const isDuplicate = this.state.player.inventory.items.some(i => i.uniqueId === item.uniqueId);
        if (!isDuplicate) {
            this.state.player.inventory.items.push({ ...item });
            uiService.writeToLog(`Unequipped ${item.name} to inventory`);
        } else {
            console.log(`Duplicate ${item.name} (ID: ${item.uniqueId}) prevented from adding to inventory`);
        }

        let emptyItemName = item.equippedSlot === "mainhand" ? "Main Hand" : item.equippedSlot === "offhand" ? "Off Hand" : item.equippedSlot.charAt(0).toUpperCase() + item.equippedSlot.slice(1);
        this.state.player.inventory.equipped[item.equippedSlot] = {
            name: emptyItemName,
            itemTier: "Empty",
            type: item.equippedSlot,
            slot: item.equippedSlot,
            uniqueId: this.state.utilities.generateUniqueId(),
            icon: `no-${item.equippedSlot}.svg`,
        };
        uiService.hideItemTooltip(this.state.player.inventory.equipped[item.equippedSlot]);

        playerService.updateGearStats();
        uiService.updateStats();
    }

    dropItem(index) {
        const uiService = this.state.game.getService('ui');
        const item = this.state.player.inventory.items[index];
        if (item) {
            uiService.hideItemTooltip(item);
            this.state.player.inventory.items.splice(index, 1);
            uiService.writeToLog(`Dropped ${item.name}`);
            uiService.updateStats();
        }
    }

    handleDrop(draggedItemData, targetItemData, isTargetEquipped) {
        const uiService = this.state.game.getService('ui');
        if (!draggedItemData || !draggedItemData.uniqueId || !targetItemData || !targetItemData.uniqueId) {
            console.error("Invalid drag-drop data:", draggedItemData, targetItemData);
            return;
        }

        uiService.hideItemTooltip(draggedItemData);
        uiService.hideItemTooltip(targetItemData);

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
                uiService.writeToLog(`Cannot equip ${draggedItemData.name} to ${targetItemData.equippedSlot}!`);
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

                uiService.writeToLog(`Swapped ${draggedItemData.name} with ${targetItemData.name}`);
            } else {
                uiService.writeToLog(`Cannot swap ${draggedItemData.name} with ${targetItemData.name}!`);
            }
        } else {
            console.log("Inventory-to-inventory drag, no action taken");
        }
        uiService.updateStats();
    }
}