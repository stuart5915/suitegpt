import { Schema, type, ArraySchema } from '@colyseus/schema';

export class BankItem extends Schema {
    @type('string') id: string = '';
    @type('string') name: string = '';
    @type('string') icon: string = '';
    @type('uint32') quantity: number = 0;
    @type('string') type: string = '';       // 'weapon' | 'armour' | 'food' | 'resource' | 'misc'
    @type('boolean') stackable: boolean = true;
    @type('int8') attackStat: number = 0;
    @type('int8') strengthStat: number = 0;
    @type('int8') defenceStat: number = 0;
    @type('uint8') healAmount: number = 0;
}

export class BankSchema extends Schema {
    @type([BankItem]) items = new ArraySchema<BankItem>();
    @type('uint16') capacity: number = 200;  // max bank slots
    @type('uint16') usedSlots: number = 0;
}
