import { Schema, type, MapSchema, ArraySchema } from '@colyseus/schema';
import { PlayerSchema } from './PlayerSchema';
import { NPCSchema } from './NPCSchema';

export class LootPile extends Schema {
    @type('string') id: string = '';
    @type('float32') x: number = 0;
    @type('float32') z: number = 0;
    @type('float32') timer: number = 60;
    @type('string') itemsJson: string = '[]'; // JSON array of { id, qty }
}

export class ShopStock extends Schema {
    @type('string') itemId: string = '';
    @type('uint16') stock: number = 0;
}

export class GameState extends Schema {
    @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
    @type({ map: NPCSchema }) npcs = new MapSchema<NPCSchema>();
    @type({ map: LootPile }) lootPiles = new MapSchema<LootPile>();
    @type({ map: ShopStock }) shopStock = new MapSchema<ShopStock>();
    @type('uint32') tick: number = 0;
    @type('boolean') isNight: boolean = false;
    @type('float64') serverTime: number = 0;
}
