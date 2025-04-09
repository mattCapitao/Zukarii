// core/Components.js
// Centralized access to all components in the Component-Based Architecture

// Import components from their respective files
import {
    MapComponent,
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
    ManaComponent,
    StatsComponent,
    InventoryComponent,
    ResourceComponent,
    PlayerStateComponent,
    InputStateComponent
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
    DataProcessQueues
} from './components/GameComponents.js';

import {
    PositionComponent,
    HealthComponent,
    AttackSpeedComponent,
    MovementSpeedComponent,
    AffixComponent,
    InCombatComponent,
    DeadComponent
} from './components/CommonComponents.js';

// Re-export all components for centralized access
export {
    // Map-related components
    MapComponent,
    RoomComponent,
    EntityListComponent,
    ExplorationComponent,
    WallComponent,
    FloorComponent,
    StairComponent,
    PortalComponent,
    FountainComponent,

    // Player-related components
    ManaComponent,
    StatsComponent,
    InventoryComponent,
    ResourceComponent,
    PlayerStateComponent,
    InputStateComponent,

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

    // Common components
    PositionComponent,
    HealthComponent,
    AttackSpeedComponent,
    MovementSpeedComponent,
    AffixComponent,
    InCombatComponent,
    DeadComponent
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