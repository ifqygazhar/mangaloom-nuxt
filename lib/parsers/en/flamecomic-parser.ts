import type { ComicItem } from "../../models/comic-item";
import type { ComicDetail } from "../../models/comic-detail";
import type { ReadChapter } from "../../models/read-chapter";
import type { Genre } from "../../models/genre";
import type { Chapter } from "../../models/chapter";
import { ComicParser } from "../parser-base";
import { ResultCache } from "../../utils/cache";

/**
 * Parser for FlameComics (flamecomics.xyz).
 * Uses the Next.js _next/data JSON API to fetch manga data.
 * Converted from Kotlin reference implementation.
 */
export class FlameComicParser extends ComicParser {
  private static readonly DOMAIN = "flamecomics.xyz";
  private static readonly BASE_URL = `https://${FlameComicParser.DOMAIN}`;

  private listCache = new ResultCache<ComicItem[]>();
  private detailCache = new ResultCache<ComicDetail>();

  /** Cached common prefix from _buildManifest.js */
  private commonPrefixCache: string | null = null;

  private readonly removeSpecialCharsRegex = /[^A-Za-z0-9 ]/g;

  get sourceName(): string {
    return "FlameComics";
  }

  get baseUrl(): string {
    return FlameComicParser.BASE_URL;
  }

  get language(): string {
    return "EN";
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  private get headers(): Record<string, string> {
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json, text/html, */*",
      Referer: `${FlameComicParser.BASE_URL}/`,
    };
  }

  /**
   * Fetch the Next.js build hash used in _next/data URLs.
   * Extracted from the _buildManifest.js script tag in the homepage HTML.
   */
  private async fetchCommonPrefix(): Promise<string> {
    if (this.commonPrefixCache) return this.commonPrefixCache;

    const res = await fetch(FlameComicParser.BASE_URL, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`Failed to fetch homepage: ${res.status}`);

    const html = await res.text();
    const match = html.match(/\/_next\/static\/([^/]+)\/_buildManifest\.js/);
    if (!match || !match[1]) {
      throw new Error("Unable to find common prefix (_buildManifest hash)");
    }

    this.commonPrefixCache = match[1];
    return this.commonPrefixCache;
  }

  /** Build a _next/data URL */
  private async buildDataUrl(
    ...segments: string[]
  ): Promise<string> {
    const prefix = await this.fetchCommonPrefix();
    const path = ["_next", "data", prefix, ...segments].join("/");
    return `${FlameComicParser.BASE_URL}/${path}`;
  }

  /** Build an image URL using the Next.js image optimizer proxy */
  private imageUrl(seriesId: string | number, path: string, width: number): string {
    const cdnUrl = `https://cdn.${FlameComicParser.DOMAIN}/uploads/images/series/${seriesId}/${path}`;
    const params = new URLSearchParams({
      url: cdnUrl,
      w: String(width),
      q: "100",
    });
    return `${FlameComicParser.BASE_URL}/_next/image?${params.toString()}`;
  }

  /** Fetch JSON from a URL */
  private async fetchJson(url: string): Promise<Record<string, unknown>> {
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json() as Promise<Record<string, unknown>>;
  }

  // ─── Data mapping ─────────────────────────────────────────────────────────

  /** Convert a series JSON object to ComicItem */
  private seriestoComicItem(jo: Record<string, unknown>): ComicItem {
    const seriesId = jo["series_id"] as number;
    const cover = jo["cover"] as string | null;
    return {
      title: jo["title"] as string,
      href: String(seriesId),
      thumbnail: cover ? this.imageUrl(seriesId, cover, 384) : "",
      type: (jo["status"] as string) ?? undefined,
      rating: undefined,
    };
  }

  /** Convert a series JSON object to a full ComicDetail (without chapters) */
  private seriesToDetail(
    jo: Record<string, unknown>,
    chapters: Chapter[] = [],
  ): ComicDetail {
    const seriesId = jo["series_id"] as number;
    const cover = jo["cover"] as string | null;
    const categoriesRaw = jo["categories"] as string | null;
    const genres: Genre[] = [];

    if (categoriesRaw) {
      try {
        const cats = JSON.parse(categoriesRaw) as string[];
        for (const cat of cats) {
          genres.push({
            title: this.toTitleCase(cat),
            href: cat.toLowerCase().trim(),
          });
        }
      } catch {
        // categories might not be valid JSON
      }
    }

    const altTitlesRaw = jo["altTitles"] as string | null;
    let altTitle = "";
    if (altTitlesRaw) {
      try {
        const alts = JSON.parse(altTitlesRaw) as string[];
        altTitle = alts.join(", ");
      } catch {
        altTitle = altTitlesRaw;
      }
    }

    let status = "Unknown";
    switch (jo["status"] as string | null) {
      case "Ongoing":
        status = "Ongoing";
        break;
      case "Completed":
        status = "Completed";
        break;
      case "Hiatus":
        status = "Hiatus";
        break;
      case "Dropped":
        status = "Dropped";
        break;
    }

    return {
      href: String(seriesId),
      title: jo["title"] as string,
      altTitle,
      thumbnail: cover ? this.imageUrl(seriesId, cover, 384) : "",
      description: (jo["description"] as string) ?? "",
      status,
      type: "Manhwa",
      released: "",
      author: (jo["author"] as string) ?? "",
      updatedOn: "",
      rating: "",
      latestChapter: chapters.length > 0 ? chapters[0].title : undefined,
      genres,
      chapters,
    };
  }

  /** Parse a date from Unix timestamp (seconds) */
  private formatTimestamp(seconds: number): string {
    if (!seconds) return "";
    const date = new Date(seconds * 1000);
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    return `${months[date.getMonth()]} ${String(date.getDate()).padStart(2, "0")}, ${date.getFullYear()}`;
  }

  private toTitleCase(text: string): string {
    return text
      .split(" ")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
      .join(" ");
  }

  /** Fisher-Yates shuffle (returns a new array) */
  private shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // ─── Core data fetching ───────────────────────────────────────────────────

  /** Fetch all series from the browse endpoint */
  private async fetchAllSeries(): Promise<Record<string, unknown>[]> {
    const url = await this.buildDataUrl("browse.json");
    const json = await this.fetchJson(url);
    const pageProps = json["pageProps"] as Record<string, unknown>;
    return (pageProps["series"] as Record<string, unknown>[]) ?? [];
  }

  /** Convert all series to ComicItems with optional search/filter */
  private async fetchSeriesAsItems(
    query?: string,
    genre?: string,
  ): Promise<ComicItem[]> {
    const allSeries = await this.fetchAllSeries();

    let items = allSeries.map((jo) => this.seriestoComicItem(jo));

    // Genre filter
    if (genre) {
      const genreLower = genre.toLowerCase().trim();
      items = items.filter((_, idx) => {
        const jo = allSeries[idx];
        const categoriesRaw = jo["categories"] as string | null;
        if (!categoriesRaw) return false;
        try {
          const cats = JSON.parse(categoriesRaw) as string[];
          return cats.some((c) => c.toLowerCase().trim() === genreLower);
        } catch {
          return false;
        }
      });
    }

    // Search filter
    if (query) {
      const normalizedQuery = query.toLowerCase().replace(this.removeSpecialCharsRegex, "");
      items = items.filter((item, idx) => {
        const jo = allSeries[idx];
        const titles: string[] = [item.title];
        const altTitlesRaw = jo["altTitles"] as string | null;
        if (altTitlesRaw) {
          try {
            const alts = JSON.parse(altTitlesRaw) as string[];
            titles.push(...alts);
          } catch {
            // ignore
          }
        }
        return titles.some((t) =>
          t.toLowerCase().replace(this.removeSpecialCharsRegex, "").includes(normalizedQuery),
        );
      });
    }

    return items;
  }

  // ─── Public API (ComicParser interface) ───────────────────────────────────

  async fetchPopular(): Promise<ComicItem[]> {
    const cacheKey = "flame-popular";
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const items = await this.fetchSeriesAsItems();
    // Shuffle so results are different each time cache expires
    const shuffled = this.shuffle(items);

    this.listCache.set(cacheKey, shuffled);
    return shuffled;
  }

  async fetchRecommended(): Promise<ComicItem[]> {
    const cacheKey = "flame-recommended";
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const items = await this.fetchSeriesAsItems();
    // Shuffle independently from popular so both lists differ
    const shuffled = this.shuffle(items);

    this.listCache.set(cacheKey, shuffled);
    return shuffled;
  }

  async fetchNewest(page: number = 1): Promise<ComicItem[]> {
    const cacheKey = `flame-newest-${page}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const items = await this.fetchSeriesAsItems();
    // Paginate (24 per page)
    const pageSize = 24;
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);
    if (paged.length === 0) throw new Error("Page not found");

    this.listCache.set(cacheKey, paged);
    return paged;
  }

  async fetchAll(page: number = 1): Promise<ComicItem[]> {
    const cacheKey = `flame-all-${page}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const items = await this.fetchSeriesAsItems();
    items.sort((a, b) => a.title.localeCompare(b.title));

    const pageSize = 24;
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);
    if (paged.length === 0) throw new Error("Page not found");

    this.listCache.set(cacheKey, paged);
    return paged;
  }

  async search(query: string): Promise<ComicItem[]> {
    const cacheKey = `flame-search-${encodeURIComponent(query)}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const items = await this.fetchSeriesAsItems(query);
    if (items.length === 0) throw new Error("No results found");

    this.listCache.set(cacheKey, items);
    return items;
  }

  async fetchByGenre(genre: string, page: number = 1): Promise<ComicItem[]> {
    const cacheKey = `flame-genre-${genre}-${page}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const items = await this.fetchSeriesAsItems(undefined, genre);
    const pageSize = 24;
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);
    if (paged.length === 0) throw new Error("Page not found");

    this.listCache.set(cacheKey, paged);
    return paged;
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
    const { page = 1, genre, order } = options;
    const cacheKey = `flame-filtered-${page}-${genre}-${order}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const items = await this.fetchSeriesAsItems(undefined, genre);

    // Sort
    if (order === "alphabetical" || order === "title") {
      items.sort((a, b) => a.title.localeCompare(b.title));
    }

    const pageSize = 24;
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);
    if (paged.length === 0) throw new Error("Page not found");

    this.listCache.set(cacheKey, paged);
    return paged;
  }

  async fetchGenres(): Promise<Genre[]> {
    const allSeries = await this.fetchAllSeries();
    const genreSet = new Set<string>();

    for (const jo of allSeries) {
      const categoriesRaw = jo["categories"] as string | null;
      if (!categoriesRaw) continue;
      try {
        const cats = JSON.parse(categoriesRaw) as string[];
        for (const cat of cats) {
          genreSet.add(cat.trim());
        }
      } catch {
        // ignore
      }
    }

    return Array.from(genreSet)
      .sort()
      .map((g) => ({
        title: this.toTitleCase(g),
        href: g.toLowerCase().trim(),
      }));
  }

  async fetchDetail(href: string): Promise<ComicDetail> {
    const cacheKey = `flame-detail-${href}`;
    const cached = this.detailCache.get(cacheKey);
    if (cached) return cached;

    const seriesId = href.replace(/\//g, "");
    const url = await this.buildDataUrl("series", `${seriesId}.json`);
    const fullUrl = `${url}?id=${seriesId}`;

    const json = await this.fetchJson(fullUrl);
    const pageProps = json["pageProps"] as Record<string, unknown>;
    const series = pageProps["series"] as Record<string, unknown>;
    const chaptersRaw = pageProps["chapters"] as Record<string, unknown>[];

    // Convert chapters, keeping track of chapter number for sorting
    const chaptersWithNum = (chaptersRaw ?? []).map((jo) => {
      const chapterNum = (jo["chapter"] as number) ?? 0;
      const chapterName = jo["name"] as string | null;
      const token = jo["token"] as string | null;
      const releaseDate = jo["release_date"] as number | undefined;

      let title = "";
      if (chapterNum !== undefined) {
        title = `Chapter ${chapterNum}`;
      }
      if (chapterName) {
        title = title ? `${title}: ${chapterName}` : chapterName;
      }

      return {
        num: chapterNum,
        chapter: {
          title,
          href: `${seriesId}::${token ?? ""}`,
          date: this.formatTimestamp(releaseDate ?? 0),
        } as Chapter,
      };
    });

    // Sort by chapter number descending (newest-first) to match other sources
    chaptersWithNum.sort((a, b) => b.num - a.num);
    const chapters = chaptersWithNum.map((c) => c.chapter);

    const detail = this.seriesToDetail(series, chapters);

    this.detailCache.set(cacheKey, detail);
    return detail;
  }

  async fetchChapter(href: string): Promise<ReadChapter> {
    // href format: "seriesId::token" (using :: as separator to avoid URL query conflicts)
    const cleaned = href.replace(/^\/+|\/+$/g, "");
    const separatorIdx = cleaned.indexOf("::");
    if (separatorIdx <= 0) {
      throw new Error(`Invalid chapter href format: ${href}`);
    }
    const seriesId = cleaned.substring(0, separatorIdx);
    const token = cleaned.substring(separatorIdx + 2);
    if (!seriesId || !token) {
      throw new Error(`Invalid chapter href format: ${href}`);
    }

    const url = await this.buildDataUrl("series", seriesId, `${token}.json`);
    const fullUrl = `${url}?id=${seriesId}&token=${token}`;

    const json = await this.fetchJson(fullUrl);
    const pageProps = json["pageProps"] as Record<string, unknown>;
    const chapter = pageProps["chapter"] as Record<string, unknown>;
    const images = chapter["images"] as Record<string, Record<string, unknown>>;

    const panels: string[] = [];
    if (images) {
      // Sort by key (numeric index) and extract image URLs
      const sortedKeys = Object.keys(images).sort(
        (a, b) => parseInt(a) - parseInt(b),
      );
      for (const key of sortedKeys) {
        const imgObj = images[key] as Record<string, unknown>;
        const name = imgObj["name"] as string;
        if (name) {
          panels.push(this.imageUrl(seriesId, `${token}/${name}`, 1920));
        }
      }
    }

    const chapterTitle =
      (chapter["name"] as string) ??
      `Chapter ${chapter["chapter"] ?? ""}`;

    return {
      title: chapterTitle,
      prev: "",
      next: "",
      panel: panels,
    };
  }

  clearCache(): void {
    this.listCache.clear();
    this.detailCache.clear();
    this.commonPrefixCache = null;
  }

  dispose(): void {
    this.clearCache();
  }
}
