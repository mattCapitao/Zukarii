import { JourneyRewardComponent,  } from '../core/Components.js';
import { System } from '../core/Systems.js';


export class JourneyRewardSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus);
        this.requiredComponents = [JourneyRewardComponent];
        this.utilities = utilities;
        this.journeyItems = null;
    }

    async init() {

        await this.requestJourneyItmes();
        console.log('JourneyRewardSystem: requestJourneyItems completed');
    }

    async requestJourneyItmes() {
        console.log('JourneyRewardSystem: Rjourneying journeyItems');
        try {
            return new Promise((resolve) => {
                this.eventBus.emit('GetJourneyItems', {
                    callback: (journeyItems) => {
                        this.journeyItems = journeyItems;
                        console.log('JourneyRewardSystem: Received journeyItems:', this.journeyItems);
                        resolve();
                    }
                });
            });
        } catch (err) {
            console.error('JourneyRewardSystem: Error loading journeyItems:', err);
            this.journeyItems = null;
        }
    }

    update(deltaTime) {
        const gameState = this.entityManager.getEntity('gameState');
        const player = this.entityManager.getEntity('player');


        if (!gameState || !player) {
            console.warn('JourneyRewardSystem: GameState or Player not found');
            return;
        }
        if (!this.journeyItems) {
            console.warn('JourneyRewardSystem: Journey items not loaded');
            return;
        }
        const rewards = player.getComponent('JourneyReward').rewards || [];
        
        if (rewards.length > 0) {
            console.log('JourneyRewardSystem: Player rewards:', rewards);
            this.applyRewards(rewards);
        } else {
           // console.warn('JourneyRewardSystem: No rewards found');
            return;
        }
    }


    applyRewards(rewards) {
        console.log('JourneyRewardSystem: Applying rewards:', rewards);

        rewards?.forEach(reward => {
            if (!reward) {
                console.warn(`JourneyRewardSystem: Skipping null reward`);
                return;
            }
            if (reward.xp) {
                this.eventBus.emit('AwardXp', { amount: reward.xp });
                console.log(`JourneyRewardSystem: Emitted AwardXp for ${reward.xp}`);
            }
            if (reward.gold) {
                const resource = this.entityManager.getEntity('player').getComponent('Resource');
                resource.gold += reward.gold;
                this.eventBus.emit('LogMessage', { message: `Gained ${reward.gold} gold` });
                console.log(`JourneyRewardSystem: Added ${reward.gold} gold`);
            }
            if (reward.type === 'item' && !reward.rewarded) {
                reward.journeyItemId = reward.journeyItemId ? reward.journeyItemId : reward.itemId;
                this.handleItemReward(reward);
            } else if (reward.type === 'unlock' && reward.mechanic === 'portalBinding') {
                // this.eventBus.emit('AddComponent', { entityId: 'player', component: new PortalBindingsComponent([0]) });
                // this.eventBus.emit('LogMessage', { message: `Unlocked Portal Binding` });
                console.log(`JourneyRewardSystem: Added PortalBindingsComponent`);
            } else if (reward.type) {
                console.warn(`JourneyRewardSystem: Unknown reward type ${reward.type}`);
            }
        });

        // Properly clear the rewards on the player's component
        const player = this.entityManager.getEntity('player');
        const journeyReward = player.getComponent('JourneyReward');
        journeyReward.rewards = [];
        console.log('JourneyRewardSystem: Cleared rewards on player component');
    }


    handleItemReward(reward) {
        const rewardId = reward.journeyItemId;
        if (!rewardId) {
            console.warn('JourneyRewardSystem: Reward has no journeyItemId:', reward);
            return;
        }

        // Defensive: filter out any items missing journeyItemId (or with typo)
        const item = this.journeyItems.find(item =>
            String(item.journeyItemId) === String(rewardId)
        );

        if (!item) {
            console.warn(`JourneyRewardSystem: Item with journeyItemId ${rewardId} not found in journeyItems`);
            return;
        }
        item.itemId = this.utilities.generateUniqueId();
        this.eventBus.emit('AddItem', {
            entityId: 'player',
            item,
        });
        console.log(`JourneyRewardSystem: Emitted AddItem for ${rewardId}`);
        reward.rewarded = true;
    }

}