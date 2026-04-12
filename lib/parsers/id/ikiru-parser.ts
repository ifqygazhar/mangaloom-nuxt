import { NatsuParser } from '../lib/natsu-parser';

export class IkiruParser extends NatsuParser {
  get sourceName(): string {
    return 'Ikiru';
  }

  get domain(): string {
    return 'ikiru.one';
  }

  get language(): string {
    return 'ID';
  }
}
