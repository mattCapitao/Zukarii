import { System } from '../core/Systems.js';
import { ShopComponent } from '../core/Components.js';

export class NPCControllerSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus);
        this.utilities = utilities;
    }

    init() {
        console.log('NPCControllerSystem: Initialized');
        // Delay to ensure NPCs are spawned
        setTimeout(() => this.generateShopInventories(), 100);
    }

    update(deltaTime) {
        // Placeholder for other NPC updates (e.g., AI, movement)
    }

    async generateShopInventories() {
        console.log('NPCControllerSystem: Starting generateShopInventories');
        try {
            // Set active tier to 0
            this.entityManager.setActiveTier(0);
            console.log('NPCControllerSystem: Active tier set to 0, tiers:', Array.from(this.entityManager.entitiesByTier.keys()));

            // Query for ShopComponent first
            const shopEntities = this.entityManager.getEntitiesWith(['ShopComponent'], 0);
            console.log('NPCControllerSystem: Found entities with ShopComponent in tier 0:', shopEntities.length, 'IDs:', shopEntities.map(n => n.id));

            // Filter for NPCs with both ShopComponent and NPCData
            const npcs = shopEntities.filter(entity => entity.hasComponent('NPCData'));
            console.log('NPCControllerSystem: Filtered NPCs with ShopComponent and NPCData in tier 0:', npcs.length, 'IDs:', npcs.map(n => n.id));

            // Debug: Check shop keeper explicitly
            const shopKeeper = this.entityManager.getEntitiesWith(['NPCData'], 0).find(n => n.id.includes('shop_keeper'));
            if (shopKeeper) {
                console.log('NPCControllerSystem: Shop Keeper ID:', shopKeeper.id);
                console.log('NPCControllerSystem: Shop Keeper components:', Array.from(shopKeeper.components.keys()));
                console.log('NPCControllerSystem: Has ShopComponent:', shopKeeper.hasComponent('ShopComponent'));
            } else {
                console.log('NPCControllerSystem: No shop keeper found in NPCData entities');
            }

            if (npcs.length === 0) {
                console.error('NPCControllerSystem: No NPCs found with ShopComponent and NPCData');
                const npcDataEntities = this.entityManager.getEntitiesWith(['NPCData'], 0);
                console.log('NPCControllerSystem: Entities with NPCData in tier 0:', npcDataEntities.map(n => n.id));
                return;
            }

            // Load unique items
            let uniqueItems = [];
            try {
                await new Promise((resolve) => {
                    this.eventBus.emit('GetUniqueItems', {
                        callback: (items) => {
                            uniqueItems = items;
                            console.log('NPCControllerSystem: Loaded unique items:', uniqueItems.length);
                            resolve();
                        }
                    });
                });
            } catch (err) {
                console.error('NPCControllerSystem: Error loading unique items:', err);
                uniqueItems = [];
            }

            // Find "Golden Buniyar Band"
            const goldenBuniyarBand = uniqueItems.find(item => item.name === "Golden Buniyar Band");
            if (!goldenBuniyarBand) {
                console.warn('NPCControllerSystem: "Golden Buniyar Band" not found in unique items');
            } else {
                console.log('NPCControllerSystem: Found "Golden Buniyar Band":', goldenBuniyarBand);
            }

            // Check player name for "bunny"
            const player = this.entityManager.getEntity('player');
            let hasBunnyInName = false;
            if (player && player.hasComponent('PlayerState')) {
                const playerName = player.getComponent('PlayerState').name || '';
                hasBunnyInName = playerName.toLowerCase().includes('bunny');
                console.log(`NPCControllerSystem: Player name: "${playerName}", has "bunny": ${hasBunnyInName}`);
            } else {
                console.warn('NPCControllerSystem: Player or PlayerState not found, cannot check name');
            }

            for (const npc of npcs) {
                const shopComponent = npc.getComponent('ShopComponent');
                if (shopComponent.items && shopComponent.items.length > 0) {
                    console.log(`NPCControllerSystem: Skipping NPC ${npc.id}, already has items`);
                    continue;
                }

                const partialItems = [
                    { tierIndex: Math.random() < 0.5 ? 0 : 1 },
                    { tierIndex: 0, type: 'armor' },
                    { tierIndex: 0, type: 'weapon', attackType: 'ranged' },
                    { tierIndex: 0, type: 'weapon', attackType: 'melee' },
                ];

                console.log('NPCControllerSystem: partialItems for NPC:', npc.id, partialItems);
                const shopItemPromises = partialItems.map((partialItem, index) => {
                    return new Promise((resolve) => {
                        console.log(`NPCControllerSystem: Emitting GenerateROGItem for item ${index} for NPC ${npc.id}:`, partialItem);
                        this.eventBus.emit('GenerateROGItem', {
                            partialItem,
                            dungeonTier: 0,
                            callback: (item) => {
                                console.log(`NPCControllerSystem: Callback received for item ${index} for NPC ${npc.id}:`, item);
                                resolve(item);
                            }
                        });
                    });
                });

                console.log('NPCControllerSystem: Waiting for Promise.all for NPC:', npc.id);
                let shopItems = await Promise.all(shopItemPromises);
                console.log('NPCControllerSystem: Promise.all resolved, shopItems for NPC:', npc.id, shopItems);

                const filteredItems = shopItems.filter(item => item !== null && item !== undefined);
                console.log('NPCControllerSystem: Filtered shop items for NPC:', npc.id, filteredItems);

                // Add "Golden Buniyar Band" if found and player name contains "bunny"
                if (goldenBuniyarBand && hasBunnyInName) {
                    const uniqueItemCopy = { ...goldenBuniyarBand, uniqueId: this.utilities.generateUniqueId() };
                    filteredItems.push(uniqueItemCopy);
                    console.log('NPCControllerSystem: Added "Golden Buniyar Band" to shop items for NPC:', npc.id);
                } else if (goldenBuniyarBand && !hasBunnyInName) {
                    console.log('NPCControllerSystem: Skipped adding "Golden Buniyar Band" to shop items for NPC:', npc.id, 'Reason: Player name does not contain "bunny"');
                }

                shopComponent.items = filteredItems.map(item => ({
                    ...item,
                    uniqueId: item.uniqueId || this.utilities.generateUniqueId(),
                    purchasePrice: Math.round((item.goldValue || 0) * shopComponent.sellMultiplier)
                }));
                console.log(`NPCControllerSystem: Generated ${shopComponent.items.length} shop items for NPC ${npc.id}`);
            }
        } catch (err) {
            console.error('NPCControllerSystem: Error in generateShopInventories:', err);
        }
    }
}