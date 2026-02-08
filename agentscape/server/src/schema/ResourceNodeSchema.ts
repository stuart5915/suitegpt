import { Schema, type } from '@colyseus/schema';

/**
 * Synced resource node — trees, rocks, fishing spots visible to all clients.
 * The SkillingSystem populates these from its internal RESOURCE_DEFS on room
 * creation and updates `depleted` / `respawnTimer` each tick.
 *
 * Integration in AgentScapeRoom:
 *   1. Import ResourceNodeSchema + add to GameState.resourceNodes MapSchema
 *   2. In onCreate(), iterate skillingSystem.getNodeStates() and populate state.resourceNodes
 *   3. In gameLoop(), call skillingSystem.updateResourceNodes(dt) and sync depleted flags
 *   4. On client, render nodes from state.resourceNodes with proper icons/positions
 */
export class ResourceNodeSchema extends Schema {
    @type('string') id: string = '';              // e.g. "normal_tree_0"
    @type('string') defId: string = '';            // resource definition key
    @type('string') name: string = '';             // display name
    @type('string') icon: string = '';             // emoji icon
    @type('string') skill: string = '';            // woodcutting, mining, fishing
    @type('uint8') levelReq: number = 1;           // minimum skill level
    @type('uint16') xpReward: number = 0;          // XP per successful action
    @type('float32') x: number = 0;
    @type('float32') z: number = 0;
    @type('uint8') tileX: number = 0;
    @type('uint8') tileZ: number = 0;
    @type('boolean') depleted: boolean = false;
    @type('float32') respawnTimer: number = 0;     // seconds until respawn (0 = available)
    @type('float32') respawnTime: number = 15;     // total respawn duration
}
