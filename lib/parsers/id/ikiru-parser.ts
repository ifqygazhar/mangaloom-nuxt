import { NatsuParser } from "#lib/parsers/lib/natsu-parser";

/**
 * Parser for Ikiru (02.ikiru.wtf)
 * Extends NatsuParser with no additional overrides —
 * inherits all default behaviour from the base class.
 */
export class IkiruParser extends NatsuParser {
  readonly sourceName = "Ikiru";
  readonly domain = "02.ikiru.wtf";
  readonly language = "ID";
}

export default IkiruParser;
