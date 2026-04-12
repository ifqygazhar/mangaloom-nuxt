import type { ComicParser } from "#lib/parsers/parser-base";
import { ShinigamiParser } from "#lib/parsers/id/shinigami-parser";
import { ComicSansParser } from "#lib/parsers/id/comicsans-parser";
import { MangaPlusParser } from "#lib/parsers/id/mangaplus-parser";
import { WebtoonParser } from "#lib/parsers/id/webtoon-parser";
import { KomikluParser } from "#lib/parsers/id/komiklu-parser";
import { KomikuParser } from "#lib/parsers/id/komiku-parser";
import { KiryuuParser } from "#lib/parsers/id/kiryuu-parser";
import { IkiruParser } from "#lib/parsers/id/ikiru-parser";
import { BatotoParser } from "#lib/parsers/en/batoto-parser";
import { MangaParkParser } from "#lib/parsers/en/mangapark-parser";

const parsers = new Map<string, ComicParser>();

/**
 * Get or create a parser instance by source ID.
 * Parsers are singletons — reused across requests for caching benefits.
 */
export function getParser(source: string): ComicParser {
  const existing = parsers.get(source);
  if (existing) return existing;

  let parser: ComicParser;
  switch (source) {
    case "shinigami":
      parser = new ShinigamiParser();
      break;
    case "mangaplus":
      parser = new MangaPlusParser();
      break;
    default:
      throw createError({
        statusCode: 400,
        statusMessage: `Unknown source: ${source}`,
      });
  }

  parsers.set(source, parser);
  return parser;
}
