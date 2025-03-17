// systems/InventorySystem.js
import { System } from '../core/Systems.js';

export class InventorySystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
        this.requiredComponents = ['Inventory'];
    }

    init() {
        this.eventBus.on('AddItem', (data) => this.addItem(data));
        this.eventBus.on('EquipItem', (data) => this.equipItem(data));
        this.eventBus.on('UnequipItem', (data) => this.unequipItem(data));
        this.eventBus.on('DropItem', (data) => this.dropItem(data));
    }

    addItem({ entityId, item }) {
        const entity = this.entityManager.getEntity(entityId);
        if (!entity) return;

        const inventory = entity.getComponent('Inventory');
        item.uniqueId = item.uniqueId || this.entityManager.getEntity('state').utilities.generateUniqueId();
        if (!inventory.items.some(i => i.uniqueId === item.uniqueId)) {
            inventory.items.push({ ...item });
            this.eventBus.emit('LogMessage', { message: `Added ${item.name} to inventory` });
            // Removed StatsUpdated emission
        }
    }

    equipItem({ entityId, item, slot }) {
        const entity = this.entityManager.getEntity(entityId);
        if (!entity) return;

        const inventory = entity.getComponent('Inventory');
        if (item.levelRequirement && entity.getComponent('PlayerState')?.level < item.levelRequirement) {
            this.eventBus.emit('LogMessage', { message: `You need to be level ${item.levelRequirement} to equip ${item.name}!` });
            return;
        }

        const index = inventory.items.findIndex(i => i.uniqueId === item.uniqueId);
        if (index === -1) {
            this.eventBus.emit('LogMessage', { message: `Error: ${item.name} not in inventory` });
            return;
        }

        if (!this.isSlotCompatible(item, slot)) {
            this.eventBus.emit('LogMessage', { message: `Cannot equip ${item.name} to ${slot}!` });
            return;
        }

        const currentItem = inventory.equipped[slot];
        if (currentItem) {
            this.unequipItem({ entityId, slot, toInventory: true, silent: true });
        }

        inventory.items.splice(index, 1);
        inventory.equipped[slot] = { ...item, equippedSlot: slot };
        this.eventBus.emit('LogMessage', { message: `Equipped ${item.name} to ${slot}` });
        this.eventBus.emit('GearChanged', { entityId }); // Use GearChanged instead
    }

    unequipItem({ entityId, slot, toInventory = true, silent = false }) {
        const entity = this.entityManager.getEntity(entityId);
        if (!entity) return;

        const inventory = entity.getComponent('Inventory');
        const item = inventory.equipped[slot];
        if (!item) return;

        inventory.equipped[slot] = null;
        if (toInventory) {
            inventory.items.push({ ...item, equippedSlot: undefined });
            if (!silent) this.eventBus.emit('LogMessage', { message: `Unequipped ${item.name} to inventory` });
        }
        this.eventBus.emit('GearChanged', { entityId }); // Use GearChanged instead
    }
    /*
    dropItem({ entityId, itemIndex }) {
        const entity = this.entityManager.getEntity(entityId);
        if (!entity) return;

        const inventory = entity.getComponent('Inventory');
        const pos = entity.getComponent('Position');
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');

        const item = inventory.items[itemIndex];
        if (!item) return;

        inventory.items.splice(itemIndex, 1);
        const treasure = {
            x: pos.x,
            y: pos.y,
            name: `${item.name} Treasure`,
            gold: 0,
            torches: 0,
            healPotions: 0,
            items: [{ ...item }]
        };

        this.eventBus.emit('PlaceTreasure', { treasure, tier: gameState.tier });
        this.eventBus.emit('LogMessage', { message: `Dropped ${item.name} as treasure at (${pos.x}, ${pos.y})` });
        this.eventBus.emit('GearChanged', { entityId }); // Use GearChanged instead
    }
    */

    dropItem({ entityId, itemIndex }) {
        const entity = this.entityManager.getEntity(entityId);
        if (!entity) return;

        const inventory = entity.getComponent('Inventory');
        const pos = entity.getComponent('Position');
        const gameState = this.entityManager.getEntity('gameState').getComponent('GameState');

        const item = inventory.items[itemIndex];
        if (!item) return;

        inventory.items.splice(itemIndex, 1);
        const loot = {
            x: pos.x,
            y: pos.y,
            name: `${item.name} Loot`,
            gold: 0,
            torches: 0,
            healPotions: 0,
            items: [{ ...item }]
        };

        this.eventBus.emit('DiscardItem', { loot, tier: gameState.tier });
        this.eventBus.emit('LogMessage', { message: `Dropped ${item.name} as loot at (${pos.x}, ${pos.y})` });
        this.eventBus.emit('GearChanged', { entityId });
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
}