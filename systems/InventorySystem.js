// systems/InventorySystem.js
import { System } from '../core/Systems.js';
import { PositionComponent, LootData } from '../core/Components.js';

export class InventorySystem extends System {
    constructor(entityManager, eventBus, utilities) { 
        super(entityManager, eventBus, utilities);
        this.requiredComponents = ['Inventory'];
    }

    init() {
        //console.log('InventorySystem: Initializing listeners');
        this.eventBus.on('AddItem', (data) => {
            //console.log('InventorySystem: AddItem event received:', data);
            this.addItem(data);
        });
        this.eventBus.on('EquipItem', (data) => {
            //console.log('InventorySystem: EquipItem event received:', data);
            this.equipItem(data);
        });
        this.eventBus.on('UnequipItem', (data) => {
           // console.log('InventorySystem: UnequipItem event received:', data);
            this.unequipItem(data);
        });
        this.eventBus.on('DropItem', (data) => {
           // console.log('InventorySystem: DropItem event received:', data);
            this.discardItem(data);
        });
    }

    addItem({ entityId, item }) {
       // console.log('InventorySystem: addItem called with entityId:', entityId, 'item:', item);
        const entity = this.entityManager.getEntity(entityId);
        if (!entity) {
            //console.error('InventorySystem: Entity not found for entityId:', entityId);
            return;
        }

        const inventory = entity.getComponent('Inventory');
        if (!inventory) {
           // console.error('InventorySystem: Inventory component not found for entityId:', entityId);
            return;
        }

        item.uniqueId = item.uniqueId || this.utilities.generateUniqueId();
        if (!inventory.items.some(i => i.uniqueId === item.uniqueId)) {
            inventory.items.push({ ...item });
            this.eventBus.emit('LogMessage', { message: `Added ${item.name} to inventory` });
        }
    }

    equipItem({ entityId, item, slot }) {
        //console.log('InventorySystem: equipItem called with entityId:', entityId, 'item:', item, 'slot:', slot);
        const entity = this.entityManager.getEntity(entityId);
        if (!entity) {
           // console.error('InventorySystem: Entity not found for entityId:', entityId);
            return;
        }

        const inventory = entity.getComponent('Inventory');
        if (!inventory) {
           // console.error('InventorySystem: Inventory component not found for entityId:', entityId);
            return;
        }

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
        this.eventBus.emit('GearChanged', { entityId });
    }

    unequipItem({ entityId, slot, toInventory = true, silent = false }) {
        //console.log('InventorySystem: unequipItem called with entityId:', entityId, 'slot:', slot, 'toInventory:', toInventory, 'silent:', silent);
        const entity = this.entityManager.getEntity(entityId);
        if (!entity) {
           // console.error('InventorySystem: Entity not found for entityId:', entityId);
            return;
        }

        const inventory = entity.getComponent('Inventory');
        if (!inventory) {
          //  console.error('InventorySystem: Inventory component not found for entityId:', entityId);
            return;
        }

        const item = inventory.equipped[slot];
        if (!item) return;

        inventory.equipped[slot] = null;
        if (toInventory) {
            inventory.items.push({ ...item, equippedSlot: undefined });
            if (!silent) this.eventBus.emit('LogMessage', { message: `Unequipped ${item.name} to inventory` });
        }
        this.eventBus.emit('GearChanged', { entityId });
    }

    discardItem({ itemIndex }) {

        const player = this.entityManager.getEntity('player');
        if (!player) { return; }
        const inventory = player.getComponent('Inventory');
        if (!inventory) {return;}

        const position = player.getComponent('Position');
        if (!position) {return;}

        if (itemIndex < 0 || itemIndex >= inventory.items.length) {return;}

        const item = inventory.items[itemIndex];
        inventory.items.splice(itemIndex, 1);

        const gameStateEntity = this.entityManager.getEntity('gameState');
        if (!gameStateEntity) {return;}

        const gameState = gameStateEntity.getComponent('GameState');
        if (!gameState) { return;}

        const tier = gameState.tier;
        if (tier === undefined) {return;}

        const loot = JSON.parse(JSON.stringify({
            name: `${item.name} (Discarded)`,
            gold: 0,
            torches: 0,
            healPotions: 0,
            items: [item]
        }));

        const uniqueId = this.utilities.generateUniqueId();
        const lootEntity = this.entityManager.createEntity(`loot_${tier}_${uniqueId}`);
        const lootPosition = new PositionComponent(position.x, position.y);
        const lootData = new LootData(loot);
        this.entityManager.addComponentToEntity(lootEntity.id, lootPosition);
        this.entityManager.addComponentToEntity(lootEntity.id, lootData);
        this.eventBus.emit('DiscardItem', { treasure: lootEntity, tier });
        this.eventBus.emit('StatsUpdated', { entityId: 'player' });
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