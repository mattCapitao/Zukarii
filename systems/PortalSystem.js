import { System } from '../core/Systems.js';
import { InteractionIntentComponent } from '../core/Components.js';

export class PortalSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus, utilities);
    }

    update(deltaTime) {
        const players = this.entityManager.getEntitiesWith(['PlayerState', 'PortalInteraction']);
       
        const dialogue = this.entityManager.getEntity('dialogueState').getComponent('Dialogue');
        //console.warn(`PortalSystem: Found ${players.length} dialogue component.`, dialogue);
      

         for (const player of players) {
            //console.warn(`PortalSystem: Processing player ${player.id} interaction with portal.`);
            const interactionComp = player.getComponent('PortalInteraction');
             const portal = this.entityManager.getEntity(interactionComp.portalId);

             if (dialogue.isOpen && !interactionComp.action) {
                 //console.warn('PortalSystem: Dialogue is active, skipping portal processing.');  
                 return; // Skip processing if dialogue is active
             }

            if (!portal) {
                console.warn('PortalSystem: Invalid portal entity.');
                player.removeComponent('PortalInteraction');
                return;
            }

            const portalComp = portal.getComponent('Portal');
            const portalBindComp = player.getComponent('PortalBinding');
            console.warn(`PortalSystem: Processing portal interaction`, portalComp, portalBindComp, interactionComp);

            if (!interactionComp.action) {
                // Present dialogue options only for uncleansed portals
                if (!portalComp.cleansed) {
                    this.presentDialogueOptions(player, portal, portalBindComp, interactionComp.tier, interactionComp);
                } else {
                    // Handle cleansed portal logic
                    this.handleCleansedPortal(player, portalComp, portalBindComp, interactionComp.tier);
                }
            } else {
                this.processPlayerAction(player, portal, portalComp, portalBindComp, interactionComp.tier, interactionComp);
            }
        }
    }

    presentDialogueOptions(player, portal, portalBindComp, tier, interactionComp) {
        const options = [
            {
                label: 'Cleanse Portal (10 Ashen Shards)',
                action: 'updatePortalInteraction',
                params: { action: 'cleansePortal', portalId:portal.id, tier }
            },
            {
                label: 'Enter Anyway',
                action: 'updatePortalInteraction',
                params: { action: 'teleport', portalId: portal.id, tier:'?' }
            },
        ];

        interactionComp.options = options; // Store options in the component

        // Emit the DialogueMessage event for the DialogueUISystem to handle
        this.eventBus.emit('DialogueMessage', {
            message: {
                message: 'This portal is not cleansed. What would you like to do?',
                options
            }
        });
    }

    processPlayerAction(player, portal, portalComp, portalBindComp, tier, interactionComp) {
        const playerResources = player.getComponent('Resource');

        switch (interactionComp.action) {
            case 'cleansePortal':
                if (playerResources.craftResources?.ashenShard >= 10) {

                    const visuals = portal.getComponent('Visuals');
                    playerResources.craftResources.ashenShard -= 10;
                    portalComp.cleansed = true; // Update the portal's state
                    
                    portalBindComp.cleansed.push(tier);
                     
                    visuals.avatar = 'img/anim/Portal-Animation-Cleansed.png';
                    this.eventBus.emit('LightSourceActivated', ({ type: 'portalGreen', entityId: portal.id }));
                    console.log(`EntityGenerationSystem: generatePortal - emitted light source activation request for portal at tier ${tier} with definition portalGreen`);


                    interactionComp.action = null; // Reset action to allow handling cleansed portal on the next frame
                    this.utilities.logMessage({ channel: 'system', message: `You have cleansed the portal on tier ${tier}.` });
                    this.handleCleansedPortal(player, portalComp, portalBindComp, interactionComp.tier);
                   
                } else {
                    this.eventBus.emit('DialogueMessage', {
                        message: {
                            message: `You need 10 Ashen Shards to cleanse the portal, but you have only ${playerResources.craftResources.ashenShard}.`,
                            options: []
                        }
                    });
                    interactionComp.action = null; // Reset action to allow re-selection
                }
                break;

            case 'teleport':
                const destinationTier = interactionComp.params.tier === '?' ? null : interactionComp.tier;
                player.removeComponent('PortalInteraction'); // Remove the component after teleporting
                //this.handleTeleport(player, portalComp, portalBindComp, tier);
                console.log(`PortalSystem: Player ${player.id} requested teleportation to tier ${destinationTier}.`);
                this.handleTeleport(destinationTier);
                break;

            default:
                console.warn('PortalSystem: Unknown player action:', interactionComp.action);
        }
    }

    handleCleansedPortal(player, portalComp, portalBindComp, tier) {
        if (!portalBindComp.bindings.includes(tier)) {
            portalBindComp.bindings.push(tier);
        }

        const bindings = portalBindComp.bindings;
        const options = bindings.map(tier => ({
            label: tier ,
            action: 'selectPortalTier',
            params: { tier }
        }));

        options.unshift({
            label: '?',
            action: 'selectPortalTier',
            params: { tier: '?' }
        });

        let intent = player.getComponent('InteractionIntent') || new InteractionIntentComponent();
        intent.intents.push({ action: 'openPortalDialogue', params: {} });
        player.addComponent(intent);

        // Emit the DialogueMessage event for the DialogueUISystem to handle
        this.eventBus.emit('DialogueMessage', {
            message: {
                message: 'Select a destination tier:',
                options
            }
        });

    }

    handleTeleport(tier) {
        const levelTransition = this.entityManager.getEntity('gameState').getComponent('LevelTransition');
        // Set destinationTier to null for randomization or the selected tier
        if (isNaN(parseInt(tier)) || tier === null || tier === undefined) { tier = null; }
        levelTransition.destinationTier = tier;
        levelTransition.pendingTransition = 'portal';
        console.log(`InteractionSystem: Set pendingTransition to 'portal' with destinationTier: ${levelTransition.destinationTier}`);
    }
}

/*
import { System } from '../core/Systems.js';
import { InteractionIntentComponent } from '../core/Components.js'; 
export class PortalSystem extends System {
    constructor(entityManager, eventBus, utilities) {
        super(entityManager, eventBus, utilities);
    }

    update(deltaTime) {
        const players = this.entityManager.getEntitiesWith(['PlayerState', 'PortalInteraction']);

        for (const player of players) {
            const interactionComp = player.getComponent('PortalInteraction');
            const portal = this.entityManager.getEntity(interactionComp.portalId);

            if (!portal) {
                console.warn('PortalSystem: Invalid portal entity.');
                player.removeComponent('PortalInteraction');
                continue;
            }

            const portalComp = portal.getComponent('Portal');
            const portalBindComp = player.getComponent('PortalBinding');

            console.warn(`PortalSystem: Processing portal interaction for player ${player.id} on portal ${portal.id}`, portalComp, portalBindComp);

            if (!portalComp.cleansed) {
                this.(`EntityGenerationSystem:(player, portal, portalBindComp, interactionComp.tier);
            } else {
                this.handleCleansedPortal(player, portalComp, portalBindComp, interactionComp.tier);
            }

            // Remove the interaction component after processing
            //player.removeComponent('PortalInteraction');
        }
    }

    (`EntityGenerationSystem:(player, portal, portalBindComp, tier) {
        const playerResources = player.getComponent('Resource');
        const portalComp = portal.getComponent('Portal');

        // Present dialogue options to the player
        const options = [
            {
                label: 'Cleanse Portal (10 Ashen Shards)',
                action: 'cleansePortal',
                params: { tier }
            },
            {
                label: 'Enter Anyway',
                action: 'enterUncleansedPortal',
                params: { tier }
            },
            {
                label: 'Cancel',
                action: 'cancelPortalInteraction',
                params: {}
            }
        ];

        this.eventBus.emit('DialogueMessage', {
            message: {
                message: 'This portal is not cleansed. What would you like to do?',
                options
            }
        });

        // Handle the player's choice
        this.eventBus.once('DialogueOptionSelected', (data) => {
            if (data.action === 'cleansePortal') {
                if (playerResources.craftResources?.ashenShard >= 10) {
                    playerResources.craftResources.ashenShard -= 10;
                    portalComp.cleansed = true;
                    portalBindComp.cleansed.push(tier);
                    this.utilities.logMessage({ channel: 'system', message: `You have cleansed the portal on tier ${tier}.` });

                    this.handleCleansedPortal(player, portalComp, portalBindComp, tier);
                } else {
                    this.utilities.logMessage({
                        channel: 'system',
                        message: `You need 10 Ashen Shards to cleanse the portal, but you have only ${playerResources.craftResources.ashenShard}.`
                    });
                }
            } else if (data.action === 'enterUncleansedPortal') {
                this.utilities.logMessage({ channel: 'system', message: 'You chose to enter the uncleansed portal.' });
            } else if (data.action === 'cancelPortalInteraction') {
                this.utilities.logMessage({ channel: 'system', message: 'You canceled the portal interaction.' });
            }
        });
    }

    handleCleansedPortal(player, portalComp, portalBindComp, tier) {
        if (!portalBindComp.bindings.includes(tier)) {
            portalBindComp.bindings.push(tier);
            this.utilities.logMessage({ channel: 'system', message: `You have bound the portal on tier ${tier} and may return here from any cleansed portal.` });
        }

        const bindings = portalBindComp.bindings;
        const options = bindings.map(tier => ({
            label: `T-${tier}`,
            action: 'selectPortalTier',
            params: { tier }
        }));

        options.unshift({
            label: '?',
            action: 'selectPortalTier',
            params: { tier: '?' }
        });

        let intent = player.getComponent('InteractionIntent') || new InteractionIntentComponent();
        intent.intents.push({ action: 'openPortalDialogue', params: {} });
        player.addComponent(intent);

        this.eventBus.emit('DialogueMessage', {
            message: {
                message: 'Select a destination tier:',
                options
            }
        });
    }
}

*/