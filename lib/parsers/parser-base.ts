import type { ComicItem } from '../models/comic-item';
import type { ComicDetail } from '../models/comic-detail';
import type { ReadChapter } from '../models/read-chapter';
import type { Genre } from '../models/genre';

/**
 * Abstract base class for all comic parsers.
 * Each parser implements scraping/API logic for a specific comic source.
 */
export abstract class ComicParser {
  /** Display name of the source (e.g. "Shinigami", "Batoto") */
  abstract get sourceName(): string;

  /** Base URL for this source */
  abstract get baseUrl(): string;

  /** Language code (e.g. "ID", "EN") */
  abstract get language(): string;

  /** Fetch popular comics */
  abstract fetchPopular(): Promise<ComicItem[]>;

  /** Fetch recommended comics */
  abstract fetchRecommended(): Promise<ComicItem[]>;

  /** Fetch newest comics with pagination */
  abstract fetchNewest(page?: number): Promise<ComicItem[]>;

  /** Fetch all comics with pagination */
  abstract fetchAll(page?: number): Promise<ComicItem[]>;

  /** Search comics by query */
  abstract search(query: string): Promise<ComicItem[]>;

  /** Fetch comics by genre with pagination */
  abstract fetchByGenre(genre: string, page?: number): Promise<ComicItem[]>;

  /** Fetch filtered comics */
  abstract fetchFiltered(options?: {
    page?: number;
    genre?: string;
    status?: string;
    type?: string;
    order?: string;
  }): Promise<ComicItem[]>;

  /** Fetch list of available genres */
  abstract fetchGenres(): Promise<Genre[]>;

  /** Fetch comic detail by href/id */
  abstract fetchDetail(href: string): Promise<ComicDetail>;

  /** Fetch chapter images for reading */
  abstract fetchChapter(href: string): Promise<ReadChapter>;

  /** Clear all caches */
  abstract clearCache(): void;

  /** Dispose/cleanup resources */
  abstract dispose(): void;
}
