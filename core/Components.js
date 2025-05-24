// core/Components.js
// Centralized access to all components in the Component-Based Architecture

// Import components from their respective files
import {
    MapComponent,
    SpatialBucketsComponent,
    RoomComponent,
    EntityListComponent,
    ExplorationComponent,
    WallComponent,
    FloorComponent,
    StairComponent,
    PortalComponent,
    FountainComponent
} from './components/MapComponents.js';

import {
    StatsComponent,
    InventoryComponent,
    ResourceComponent,
    PlayerStateComponent,
    InputStateComponent,
    NewCharacterComponent,
    JourneyStateComponent,
    ShopInteractionComponent,
    PlayerActionQueueComponent,
    PlayerAchievementsComponent,
} from './components/PlayerComponents.js';

import {
    UIComponent,
    RenderStateComponent,
    GameStateComponent,
    ProjectileComponent,
    LootSourceData,
    LootData,
    RenderControlComponent,
    LightingState,
    LightSourceDefinitions,
    OverlayStateComponent,
    DataProcessQueues,
    AudioQueueComponent,
    LevelTransitionComponent,
    MouseTargetComponent,
    ShopComponent,
    JourneyPathsComponent,
    OfferedQuestsComponent,
    JourneyUpdateQueueComponent,
} from './components/GameComponents.js';

import {
    PositionComponent,
    LastPositionComponent,
    VisualsComponent,
    HealthComponent,
    HpBarComponent,
    ManaComponent,
    AttackSpeedComponent,
    MovementSpeedComponent,
    AffixComponent,
    InCombatComponent,
    DeadComponent,
    NeedsRenderComponent,
    HitboxComponent,
    MovementIntentComponent,
    CollisionComponent,
    RemoveEntityComponent,
    StairLockComponent,
    JourneyPathComponent,
    AnimationStateComponent,
    AnimationComponent,
    NPCDataComponent, // Add
    DialogueComponent, // Add
    InteractionIntentComponent,
} from './components/CommonComponents.js';

// Re-export all components for centralized access
export {
    // Map-related components
    MapComponent,
    SpatialBucketsComponent,
    RoomComponent,
    EntityListComponent,
    ExplorationComponent,
    WallComponent,
    FloorComponent,
    StairComponent,
    PortalComponent,
    FountainComponent,

    // Player-related components
    StatsComponent,
    InventoryComponent,
    ResourceComponent,
    PlayerStateComponent,
    InputStateComponent,
    NewCharacterComponent,
    JourneyStateComponent,
    ShopInteractionComponent,
    PlayerActionQueueComponent,
    PlayerAchievementsComponent,

    // Game-related components
    UIComponent,
    RenderStateComponent,
    GameStateComponent,
    ProjectileComponent,
    LootSourceData,
    LootData,
    RenderControlComponent, 
    LightingState,
    LightSourceDefinitions,
    OverlayStateComponent,
    DataProcessQueues,
    AudioQueueComponent,
    LevelTransitionComponent,
    MouseTargetComponent,
    ShopComponent,
    JourneyPathsComponent,
    OfferedQuestsComponent,
    JourneyUpdateQueueComponent,

    // Common components
    PositionComponent,
    LastPositionComponent,
    VisualsComponent,
    HealthComponent,
    HpBarComponent,
    ManaComponent,
    AttackSpeedComponent,
    MovementSpeedComponent,
    AffixComponent,
    InCombatComponent,
    DeadComponent,
    NeedsRenderComponent,
    HitboxComponent,
    MovementIntentComponent,
    CollisionComponent,
    RemoveEntityComponent,
    StairLockComponent,
    JourneyPathComponent,
    AnimationStateComponent,
    AnimationComponent,
    NPCDataComponent, // Add
    DialogueComponent, // Add
    InteractionIntentComponent,
};

// Utility functions
export function createDefaultPlayerComponents() {
    return {
        position: new PositionComponent(1, 1),
        health: new HealthComponent(0, 0),
        mana: new ManaComponent(0, 0),
        stats: new StatsComponent(),
        inventory: new InventoryComponent(),
        resource: new ResourceComponent(),
        playerState: new PlayerStateComponent()
    };
}

export function createDefaultLevelComponents() {
    return {
        map: new MapComponent(),
        entityList: new EntityListComponent(),
        exploration: new ExplorationComponent()
    };
}