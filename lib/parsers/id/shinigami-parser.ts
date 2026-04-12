import type { ComicItem } from "../../models/comic-item";
import type { ComicDetail } from "../../models/comic-detail";
import type { ReadChapter } from "../../models/read-chapter";
import type { Genre } from "../../models/genre";
import type { Chapter } from "../../models/chapter";
import { ComicParser } from "../parser-base";
import { ResultCache } from "../../utils/cache";

type ShinigamiQueryValue = string | number | undefined;
type ShinigamiQuery = Record<string, ShinigamiQueryValue>;
type NitroLocalFetch = <T>(
  request: string,
  options?: {
    query?: ShinigamiQuery;
  },
) => Promise<T>;

export class ShinigamiParser extends ComicParser {
  private static readonly API_BASE_URL = "https://api.shngm.io/v1/";
  private static readonly PROXY_PATH = `https://proxy-bypass-cors.verifwebsitepro.workers.dev/?url=${encodeURIComponent(this.API_BASE_URL)}`;
  private static readonly STORAGE_URL = "https://storage.shngm.id";
  private static readonly DEFAULT_PAGE_SIZE = 24;
  private static readonly CHAPTER_PAGE_SIZE = 9999;
  private static readonly MAX_CONCURRENT_REQUESTS = 3;

  private listCache = new ResultCache<ComicItem[]>();
  private chapterCache = new ResultCache<Chapter[]>();

  get sourceName(): string {
    return "Shinigami";
  }

  get baseUrl(): string {
    return "https://08.shinigami.asia/";
  }

  get language(): string {
    return "ID";
  }

  /** Convert country ID to comic type */
  private convertCountryId(country: string): string {
    switch (country) {
      case "CN":
        return "Manhua";
      case "JP":
        return "Manga";
      case "KR":
        return "Manhwa";
      default:
        return "Other";
    }
  }

  /** Convert API manga item to ComicItem */
  private convertToComicItem(item: Record<string, unknown>): ComicItem {
    return {
      title: item["title"] as string,
      href: `/${item["manga_id"]}/`,
      thumbnail: item["cover_image_url"] as string,
      type: this.convertCountryId(item["country_id"] as string),
      chapter: (item["latest_chapter_number"] as number | null)?.toFixed(1),
      rating: (item["user_rate"] as number | null)?.toFixed(1),
    };
  }

  /** Convert API chapter item to Chapter */
  private convertToChapter(item: Record<string, unknown>): Chapter {
    const chapterNumber = `Chapter ${(item["chapter_number"] as number).toFixed(1)}`;
    const chapterSubtitle = item["chapter_title"] as string;
    const chapterTitle = chapterSubtitle
      ? `${chapterNumber}: ${chapterSubtitle}`
      : chapterNumber;

    return {
      title: chapterTitle,
      href: `/${item["chapter_id"]}/`,
      date: item["release_date"] as string,
    };
  }

  private getLocalFetch(): NitroLocalFetch {
    const localFetch = (globalThis as { $fetch?: NitroLocalFetch }).$fetch;

    if (!localFetch) {
      throw new Error("Nitro local fetch is not available");
    }

    return localFetch;
  }

  private buildApiUrl(path: string, query: ShinigamiQuery = {}): string {
    const url = new URL(path, ShinigamiParser.API_BASE_URL);

    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === "") {
        continue;
      }

      url.searchParams.set(key, String(value));
    }

    return url.toString();
  }

  private async requestApi(
    path: string,
    query: ShinigamiQuery = {},
  ): Promise<Record<string, unknown>> {
    const localFetch = this.getLocalFetch();

    return await localFetch<Record<string, unknown>>(
      ShinigamiParser.PROXY_PATH,
      {
        query: {
          url: this.buildApiUrl(path, query),
          referer: this.baseUrl,
        },
      },
    );
  }

  /** Fetch all chapter pages for a manga */
  private async fetchAllChapters(mangaId: string): Promise<Chapter[]> {
    const cacheKey = `chapters-${mangaId}`;
    const cached = this.chapterCache.get(cacheKey);
    if (cached) return cached;

    const chaptersData = await this.requestApi(`chapter/${mangaId}/list`, {
      page: 1,
      page_size: ShinigamiParser.CHAPTER_PAGE_SIZE,
      sort_by: "chapter_number",
      sort_order: "asc",
    });

    const chapterItems = Array.isArray(chaptersData["data"])
      ? (chaptersData["data"] as Record<string, unknown>[])
      : [];
    const chapters = chapterItems
      .map((item) => this.convertToChapter(item))
      .reverse();

    const seen = new Set<string>();
    const dedupedChapters = chapters.filter((chapter) => {
      if (seen.has(chapter.href)) return false;
      seen.add(chapter.href);
      return true;
    });

    this.chapterCache.set(cacheKey, dedupedChapters);
    return dedupedChapters;
  }

  async fetchPopular(): Promise<ComicItem[]> {
    const cacheKey = "popular-1";
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const data = await this.requestApi("manga/list", {
      page: 1,
      page_size: ShinigamiParser.DEFAULT_PAGE_SIZE,
      sort: "popularity",
      sort_order: "desc",
    });

    const items = data["data"] as Record<string, unknown>[];
    const results = items.map((item) => this.convertToComicItem(item));

    this.listCache.set(cacheKey, results);
    return results;
  }

  async fetchRecommended(): Promise<ComicItem[]> {
    const cacheKey = "recommended-1";
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const data = await this.requestApi("manga/list", {
      page: 1,
      page_size: ShinigamiParser.DEFAULT_PAGE_SIZE,
      sort: "rating",
      sort_order: "desc",
    });

    const items = data["data"] as Record<string, unknown>[];
    const results = items.map((item) => this.convertToComicItem(item));

    this.listCache.set(cacheKey, results);
    return results;
  }

  async fetchNewest(page: number = 1): Promise<ComicItem[]> {
    const cacheKey = `newest-${page}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const data = await this.requestApi("manga/list", {
      page,
      page_size: ShinigamiParser.DEFAULT_PAGE_SIZE,
      sort: "latest",
      sort_order: "desc",
    });

    const items = data["data"] as Record<string, unknown>[];
    if (items.length === 0) throw new Error("Page not found");

    const results = items.map((item) => this.convertToComicItem(item));
    this.listCache.set(cacheKey, results);
    return results;
  }

  async fetchAll(page: number = 1): Promise<ComicItem[]> {
    const cacheKey = `all-${page}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const data = await this.requestApi("manga/list", {
      page,
      page_size: ShinigamiParser.DEFAULT_PAGE_SIZE,
    });

    const items = data["data"] as Record<string, unknown>[];
    if (items.length === 0) throw new Error("Page not found");

    const results = items.map((item) => this.convertToComicItem(item));
    this.listCache.set(cacheKey, results);
    return results;
  }

  async search(query: string): Promise<ComicItem[]> {
    const cacheKey = `search-${encodeURIComponent(query)}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const data = await this.requestApi("manga/list", {
      q: query,
      page: 1,
      page_size: ShinigamiParser.DEFAULT_PAGE_SIZE,
    });

    const items = data["data"] as Record<string, unknown>[];
    if (items.length === 0) throw new Error("No results found");

    const results = items.map((item) => this.convertToComicItem(item));
    this.listCache.set(cacheKey, results);
    return results;
  }

  async fetchByGenre(genre: string, page: number = 1): Promise<ComicItem[]> {
    const cacheKey = `genre-${encodeURIComponent(genre)}-${page}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const data = await this.requestApi("manga/list", {
      page,
      page_size: ShinigamiParser.DEFAULT_PAGE_SIZE,
      genre_include: genre,
      genre_include_mode: "and",
      sort: "popularity",
      sort_order: "desc",
    });

    const items = data["data"] as Record<string, unknown>[];
    if (items.length === 0) throw new Error("Page not found");

    const results = items.map((item) => this.convertToComicItem(item));
    this.listCache.set(cacheKey, results);
    return results;
  }

  async fetchFiltered(
    options: {
      page?: number;
      genre?: string;
      status?: string;
      type?: string;
      order?: string;
    } = {},
  ): Promise<ComicItem[]> {
    const { page = 1, genre, status, type, order } = options;
    const cacheKey = `filtered-${page}-${genre}-${status}-${type}-${order}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const requestQuery: ShinigamiQuery = {
      page,
      page_size: ShinigamiParser.DEFAULT_PAGE_SIZE,
    };

    if (order) {
      switch (order) {
        case "popular":
          requestQuery["sort"] = "popularity";
          requestQuery["sort_order"] = "desc";
          break;
        case "latest":
          requestQuery["sort"] = "latest";
          requestQuery["sort_order"] = "desc";
          break;
        case "rating":
          requestQuery["sort"] = "rating";
          requestQuery["sort_order"] = "desc";
          break;
        default:
          requestQuery["sort"] = "latest";
          requestQuery["sort_order"] = "desc";
      }
    }

    if (status) {
      switch (status) {
        case "ongoing":
          requestQuery["status"] = "ongoing";
          break;
        case "completed":
          requestQuery["status"] = "completed";
          break;
        case "hiatus":
          requestQuery["status"] = "hiatus";
          break;
      }
    }

    if (type) {
      requestQuery["format"] = type;
    }

    if (genre) {
      requestQuery["genre_include"] = genre;
      requestQuery["genre_include_mode"] = "and";
    }

    const data = await this.requestApi("manga/list", requestQuery);

    const items = data["data"] as Record<string, unknown>[];
    if (items.length === 0) throw new Error("Page not found");

    const results = items.map((item) => this.convertToComicItem(item));
    this.listCache.set(cacheKey, results);
    return results;
  }

  /** Batch fetch multiple lists efficiently */
  async fetchMultipleLists(
    options: {
      popular?: boolean;
      recommended?: boolean;
      newest?: boolean;
      limit?: number;
    } = {},
  ): Promise<Record<string, ComicItem[]>> {
    const {
      popular = false,
      recommended = false,
      newest = false,
      limit = 6,
    } = options;
    const results: Record<string, ComicItem[]> = {};
    const promises: Promise<void>[] = [];

    if (popular) {
      promises.push(
        this.fetchPopular().then((items) => {
          results["popular"] = items.slice(0, limit);
        }),
      );
    }
    if (recommended) {
      promises.push(
        this.fetchRecommended().then((items) => {
          results["recommended"] = items.slice(0, limit);
        }),
      );
    }
    if (newest) {
      promises.push(
        this.fetchNewest().then((items) => {
          results["newest"] = items.slice(0, limit);
        }),
      );
    }

    await Promise.all(promises);
    return results;
  }

  /** Batch fetch multiple genres */
  async fetchMultipleGenres(
    genres: string[],
    limit: number = 6,
  ): Promise<Record<string, ComicItem[]>> {
    const results: Record<string, ComicItem[]> = {};

    for (
      let i = 0;
      i < genres.length;
      i += ShinigamiParser.MAX_CONCURRENT_REQUESTS
    ) {
      const batch = genres.slice(
        i,
        i + ShinigamiParser.MAX_CONCURRENT_REQUESTS,
      );
      const promises = batch.map(async (genre) => {
        try {
          const items = await this.fetchByGenre(genre);
          results[genre] = items.slice(0, limit);
        } catch {
          results[genre] = [];
        }
      });
      await Promise.all(promises);
    }

    return results;
  }

  async fetchGenres(): Promise<Genre[]> {
    const data = await this.requestApi("genre/list");

    const items = data["data"] as Record<string, unknown>[];
    return items.map((item) => ({
      title: item["name"] as string,
      href: `/${item["slug"]}/`,
    }));
  }

  async fetchDetail(href: string): Promise<ComicDetail> {
    if (!href) throw new Error("href is required");

    const mangaId = href.replace(/\//g, "");

    const data = await this.requestApi(`manga/detail/${mangaId}`);

    const item = data["data"] as Record<string, unknown>;

    const taxonomy = (item["taxonomy"] as Record<string, unknown>) ?? {};
    const genreList = (taxonomy["Genre"] as Record<string, unknown>[]) ?? [];
    const genres: Genre[] = genreList.map((g) => ({
      title: g["name"] as string,
      href: `/${g["slug"]}/`,
    }));

    const authorList = (taxonomy["Author"] as Record<string, unknown>[]) ?? [];
    const authors = authorList.map((a) => a["name"] as string).join(", ");

    let status: string;
    switch (item["status"] as number) {
      case 1:
        status = "Ongoing";
        break;
      case 2:
        status = "Completed";
        break;
      case 3:
        status = "Paused";
        break;
      default:
        status = "Unknown";
    }

    const chapters = await this.fetchAllChapters(mangaId);

    return {
      href,
      title: item["title"] as string,
      altTitle: (item["alternative_title"] as string) ?? "",
      thumbnail: item["cover_image_url"] as string,
      description: (item["description"] as string) ?? "",
      status,
      type: this.convertCountryId(item["country_id"] as string),
      released: (item["release_year"] as string) ?? "",
      author: authors,
      updatedOn: (item["updated_at"] as string) ?? "",
      rating: (item["user_rate"] as number | null)?.toFixed(1) ?? "0.0",
      latestChapter: chapters.length > 0 ? chapters[0].title : undefined,
      genres,
      chapters,
    };
  }

  async fetchChapter(href: string): Promise<ReadChapter> {
    if (!href) throw new Error("href is required");

    const chapterId = href.replace(/\//g, "");

    const data = await this.requestApi(`chapter/detail/${chapterId}`);

    const responseData = data["data"] as Record<string, unknown>;
    const chapter = responseData["chapter"] as Record<string, unknown>;
    const basePath = chapter["path"] as string;
    const imagesList = chapter["data"] as string[];

    const panels = imagesList.map(
      (imgName) => `${ShinigamiParser.STORAGE_URL}${basePath}${imgName}`,
    );

    const title =
      (responseData["chapter_title"] as string) ||
      `Chapter ${(responseData["chapter_number"] as number).toFixed(1)}`;

    const prevChapter = responseData["prev_chapter_id"] as string | null;
    const nextChapter = responseData["next_chapter_id"] as string | null;

    return {
      title,
      prev: prevChapter ? `/${prevChapter}/` : "",
      next: nextChapter ? `/${nextChapter}/` : "",
      panel: panels,
    };
  }

  clearCache(): void {
    this.listCache.clear();
    this.chapterCache.clear();
  }

  dispose(): void {
    this.clearCache();
  }
}
