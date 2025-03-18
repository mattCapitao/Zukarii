// systems/InventorySystem.js
import { System } from '../core/Systems.js';

export class InventorySystem extends System {
    constructor(entityManager, eventBus) {
        super(entityManager, eventBus);
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

        item.uniqueId = item.uniqueId || this.entityManager.getEntity('state').utilities.generateUniqueId();
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

    // systems/InventorySystem.js (partial)
    discardItem({ itemIndex }) {
       // console.log('InventorySystem: discardItem called with itemIndex:', itemIndex);
        const player = this.entityManager.getEntity('player');
        if (!player) {
          //  console.error('InventorySystem: Player entity not found');
            return;
        }
       // console.log('InventorySystem: Player entity found:', player);

        const inventory = player.getComponent('Inventory');
        if (!inventory) {
            console.error('InventorySystem: Inventory component not found on player');
            return;
        }
        //console.log('InventorySystem: Inventory component found:', inventory);

        const position = player.getComponent('Position');
        if (!position) {
          //  console.error('InventorySystem: Position component not found on player');
            return;
        }
        //console.log('InventorySystem: Position component found:', position);

        if (itemIndex < 0 || itemIndex >= inventory.items.length) {
          //  console.error('InventorySystem: Invalid itemIndex', itemIndex, 'Inventory length:', inventory.items.length);
            return;
        }
        //console.log('InventorySystem: Item index valid, retrieving item...');

        const item = inventory.items[itemIndex];
        //console.log('InventorySystem: Item retrieved:', item);
        inventory.items.splice(itemIndex, 1);
       // console.log('InventorySystem: Item removed from inventory, new inventory:', inventory.items);

        const gameStateEntity = this.entityManager.getEntity('gameState');
        if (!gameStateEntity) {
           // console.error('InventorySystem: gameState entity not found');
            return;
        }
       // console.log('InventorySystem: gameState entity found:', gameStateEntity);

        const gameState = gameStateEntity.getComponent('GameState');
        if (!gameState) {
           // console.error('InventorySystem: GameState component not found on gameState entity');
            return;
        }
       // console.log('InventorySystem: GameState component found:', gameState);

        const tier = gameState.tier;
        if (tier === undefined) {
           // console.error('InventorySystem: gameState.tier is undefined', gameState);
            return;
        }
        //console.log('InventorySystem: Tier retrieved:', tier);

        const loot = JSON.parse(JSON.stringify({
            x: position.x,
            y: position.y,
            name: `${item.name} (Discarded)`,
            gold: 0,
            torches: 0,
            healPotions: 0,
            items: [item]
        }));
       // console.log('InventorySystem: Loot object constructed (deep copy):', loot);

        //console.log('InventorySystem: Emitting DiscardItem with data:', { loot, tier });

        this.eventBus.emit('DiscardItem', { treasure: loot, tier });
       // console.log('InventorySystem: DiscardItem event emitted');

        this.eventBus.emit('StatsUpdated', { entityId: 'player' });
       // console.log('InventorySystem: StatsUpdated event emitted');
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