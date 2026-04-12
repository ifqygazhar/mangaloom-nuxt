import * as cheerio from "cheerio";
import type {
  ComicItem,
  ComicDetail,
  ReadChapter,
  Genre,
  Chapter,
} from "./natsu-parser";

// ─── Re-export types for convenience ─────────────────────────────────────────

export type { ComicItem, ComicDetail, ReadChapter, Genre, Chapter };

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = "https://v2.komiklu.com";
const CACHE_EXPIRY_MS = 5 * 60 * 1000;

const AVAILABLE_GENRES: Genre[] = [
  { title: "Action", href: "/action/" },
  { title: "Adult", href: "/adult/" },
  { title: "Adventure", href: "/adventure/" },
  { title: "Comedy", href: "/comedy/" },
  { title: "Drama", href: "/drama/" },
  { title: "Ecchi", href: "/ecchi/" },
  { title: "Fantasy", href: "/fantasy/" },
  { title: "Harem", href: "/harem/" },
  { title: "Historical", href: "/historical/" },
  { title: "Horror", href: "/horror/" },
  { title: "Josei", href: "/josei/" },
  { title: "Martial Arts", href: "/martial-arts/" },
  { title: "Mature", href: "/mature/" },
  { title: "Mystery", href: "/mystery/" },
  { title: "Psychological", href: "/psychological/" },
  { title: "Romance", href: "/romance/" },
  { title: "School Life", href: "/school-life/" },
  { title: "Sci-fi", href: "/sci-fi/" },
  { title: "Seinen", href: "/seinen/" },
  { title: "Shounen", href: "/shounen/" },
  { title: "Slice of Life", href: "/slice-of-life/" },
  { title: "Sports", href: "/sports/" },
  { title: "Supernatural", href: "/supernatural/" },
  { title: "Tragedy", href: "/tragedy/" },
];

const MAX_CONCURRENT = 3;

// ─── Cache type ───────────────────────────────────────────────────────────────

interface CachedResult {
  items: ComicItem[];
  timestamp: Date;
}

// ─── KomikluParser ────────────────────────────────────────────────────────────

export class KomikluParser {
  readonly sourceName = "Komiklu";
  readonly baseUrl = BASE_URL;
  readonly language = "ID";

  private readonly listCache = new Map<string, CachedResult>();

  // ── Headers ──

  private get headers(): Record<string, string> {
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: BASE_URL,
    };
  }

  // ── Cache ──

  private isCacheValid(key: string): boolean {
    const cached = this.listCache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp.getTime() < CACHE_EXPIRY_MS;
  }

  private getFromCache(key: string): ComicItem[] | null {
    if (this.isCacheValid(key)) return this.listCache.get(key)!.items;
    this.listCache.delete(key);
    return null;
  }

  private saveToCache(key: string, items: ComicItem[]): void {
    this.listCache.set(key, { items, timestamp: new Date() });
  }

  // ── HTTP helper ──

  private async fetchHtml(url: string): Promise<string> {
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
  }

  // ── URL helpers ──

  private toAbsoluteUrl(url: string): string {
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("//")) return `https:${url}`;
    if (url.startsWith("/")) return `${BASE_URL}${url}`;
    return `${BASE_URL}/${url}`;
  }

  private toRelativeUrl(url: string): string {
    if (url.startsWith(BASE_URL)) return url.slice(BASE_URL.length);
    if (url.startsWith("http")) {
      const parsed = new URL(url);
      return parsed.pathname + (parsed.search ?? "");
    }
    if (!url.startsWith("/")) return "/" + url;
    return url;
  }

  // ── Parse comic list from article elements (ajax responses) ──

  private parseComicListFromArticles(html: string): ComicItem[] {
    const $ = cheerio.load(html);
    const items: ComicItem[] = [];

    $("article").each((_, el) => {
      try {
        const title = $(el).find("h4 a").text().trim();
        if (!title) return;

        let href = $(el).find("h4 a").attr("href") ?? "";
        if (!href) return;
        href = this.toRelativeUrl(href);

        let thumbnail = $(el).find("a img").attr("src") ?? "";
        if (thumbnail) thumbnail = this.toAbsoluteUrl(thumbnail);

        const chapter = $(el).find("div.text-sky-400").text().trim();
        const rating = $(el)
          .find("div.text-yellow-400")
          .text()
          .trim()
          .replace("⭐", "")
          .trim();

        items.push({ title, href, thumbnail, rating, chapter, type: "Manga" });
      } catch {
        /* skip */
      }
    });

    return items;
  }

  // ── Parse comic list from page.php (pagination endpoint) ──

  private parseComicListFromPage(html: string): ComicItem[] {
    const $ = cheerio.load(html);
    const items: ComicItem[] = [];

    if ($("#comicContainer center.noresult").length) return items;

    $("article").each((_, el) => {
      try {
        const title = $(el).find("h4 a").text().trim();
        if (!title) return;

        let href = $(el).find("h4 a").attr("href") ?? "";
        if (!href) return;
        href = this.toRelativeUrl(href);

        let thumbnail = $(el).find("a img").attr("src") ?? "";
        if (thumbnail) thumbnail = this.toAbsoluteUrl(thumbnail);

        let chapter = "";
        $(el)
          .find("div.flex.justify-between div.text-sky-400")
          .each((_, div) => {
            const text = $(div).text().trim();
            if (text.toLowerCase().includes("chapter")) {
              chapter = text;
              return false;
            }
          });

        const rating = $(el)
          .find("div.text-yellow-400")
          .text()
          .trim()
          .replace("⭐", "")
          .trim();

        items.push({ title, href, thumbnail, rating, type: "Manga", chapter });
      } catch {
        /* skip */
      }
    });

    return items;
  }

  // ── Public API ──

  async fetchPopular(): Promise<ComicItem[]> {
    const key = "popular-1";
    const cached = this.getFromCache(key);
    if (cached) return cached;

    const html = await this.fetchHtml(
      `${BASE_URL}/ajax_filter.php?yearTo=9999&sort=rating-desc`,
    );
    const results = this.parseComicListFromArticles(html);
    this.saveToCache(key, results);
    return results;
  }

  async fetchRecommended(): Promise<ComicItem[]> {
    const key = "recommended-1";
    const cached = this.getFromCache(key);
    if (cached) return cached;

    const html = await this.fetchHtml(
      `${BASE_URL}/ajax_filter.php?yearTo=9999&sort=newest`,
    );
    const results = this.parseComicListFromArticles(html);
    this.saveToCache(key, results);
    return results;
  }

  async fetchNewest(page = 1): Promise<ComicItem[]> {
    const key = `newest-${page}`;
    const cached = this.getFromCache(key);
    if (cached) return cached;

    // ajax_filter doesn't support pagination; always loads first batch
    const html = await this.fetchHtml(
      `${BASE_URL}/ajax_filter.php?yearTo=9999&sort=year-desc`,
    );
    const results = this.parseComicListFromArticles(html);
    if (results.length === 0) throw new Error("No results found");
    this.saveToCache(key, results);
    return results;
  }

  async fetchAll(page = 1): Promise<ComicItem[]> {
    const key = `all-${page}`;
    const cached = this.getFromCache(key);
    if (cached) return cached;

    const html = await this.fetchHtml(`${BASE_URL}/page.php?page=${page}`);
    const results = this.parseComicListFromPage(html);
    if (results.length === 0) throw new Error("Page not found");
    this.saveToCache(key, results);
    return results;
  }

  async search(query: string): Promise<ComicItem[]> {
    const key = `search-${encodeURIComponent(query)}`;
    const cached = this.getFromCache(key);
    if (cached) return cached;

    const res = await fetch(
      `${BASE_URL}/search.php?q=${encodeURIComponent(query)}`,
      {
        headers: this.headers,
      },
    );
    if (!res.ok) throw new Error(`Failed to search: ${res.status}`);

    type SearchResult = {
      title?: string;
      cover?: string;
      rating?: string;
      year?: string;
    };
    const json = (await res.json()) as SearchResult[];

    const items: ComicItem[] = json
      .filter((r) => r.title)
      .map((r) => {
        let thumbnail = r.cover ?? "";
        if (thumbnail) thumbnail = this.toAbsoluteUrl(thumbnail);

        let rating = r.rating ?? "";
        if (rating && !rating.includes("/")) rating = `${rating}/10`;

        return {
          title: r.title!,
          href: `/comic_detail.php?title=${r.title}`,
          thumbnail,
          rating,
          chapter: r.year ?? "",
          type: "Manga",
        };
      });

    if (items.length === 0) throw new Error("No results found");
    this.saveToCache(key, items);
    return items;
  }

  async fetchByGenre(genre: string, page = 1): Promise<ComicItem[]> {
    const key = `genre-${genre}-${page}`;
    const cached = this.getFromCache(key);
    if (cached) return cached;

    const html = await this.fetchHtml(
      `${BASE_URL}/ajax_filter.php?filterGenre=${genre}&yearTo=9999&sort=newest`,
    );
    const results = this.parseComicListFromArticles(html);
    if (results.length === 0) throw new Error("No results found");
    this.saveToCache(key, results);
    return results;
  }

  async fetchFiltered(opts: {
    page?: number;
    genre?: string;
    status?: string;
    type?: string;
    order?: string;
  }): Promise<ComicItem[]> {
    const { page = 1, genre, order } = opts;
    const key = `filtered-${page}-${genre}-${opts.status}-${opts.type}-${order}`;
    const cached = this.getFromCache(key);
    if (cached) return cached;

    let url: string;
    if (genre) {
      url = `${BASE_URL}/ajax_filter.php?filterGenre=${genre}&yearTo=9999&sort=newest`;
    } else if (order === "rating-desc" || order === "popular") {
      url = `${BASE_URL}/ajax_filter.php?yearTo=9999&sort=rating-desc`;
    } else {
      url = `${BASE_URL}/ajax_filter.php?yearTo=9999&sort=newest`;
    }

    const html = await this.fetchHtml(url);
    const results = this.parseComicListFromArticles(html);
    if (results.length === 0) throw new Error("No results found");
    this.saveToCache(key, results);
    return results;
  }

  async fetchGenres(): Promise<Genre[]> {
    return AVAILABLE_GENRES;
  }

  // ── Detail ──

  async fetchDetail(href: string): Promise<ComicDetail> {
    if (!href) throw new Error("href is required");

    const html = await this.fetchHtml(this.toAbsoluteUrl(href));
    const $ = cheerio.load(html);

    // Title
    let title =
      $("h1.text-3xl.font-bold").text().trim() || $("h1").first().text().trim();
    if (!title) throw new Error("Comic not found");

    // Thumbnail
    let thumbnail =
      $("img.w-56.h-80.object-cover.rounded-lg.shadow-lg").attr("src") ??
      $("main section img").attr("src") ??
      "";
    if (thumbnail) thumbnail = this.toAbsoluteUrl(thumbnail);

    const author = $("span.text-sky-400.font-medium").text().trim();

    let rating = $("span.ml-2.text-sm.text-gray-400")
      .text()
      .trim()
      .replace("(", "")
      .replace(")", "")
      .trim();

    const description = $("p.text-gray-300.leading-relaxed").text().trim();

    let year = "";
    let status = "";
    $(
      "div.flex.items-center.gap-4.text-gray-400 > span.flex.items-center.gap-1",
    ).each((_, el) => {
      const yearText = $(el).find("span.text-gray-200").text().trim();
      if (yearText.length === 4 && !isNaN(parseInt(yearText, 10)))
        year = yearText;

      const statusText = $(el)
        .find("span.text-sky-400.font-semibold")
        .text()
        .trim();
      if (statusText === "OnGoing" || statusText === "Completed")
        status = statusText;
    });

    const genres: Genre[] = [];
    $("div.flex.flex-wrap.gap-2 span.bg-gray-800.text-gray-200.text-sm").each(
      (_, el) => {
        const genreTitle = $(el).text().trim();
        if (genreTitle && genreTitle.length < 30) {
          const slug = genreTitle.toLowerCase().replace(/ /g, "-");
          genres.push({ title: genreTitle, href: `/${slug}/` });
        }
      },
    );

    // Chapters — try multiple selectors in order
    const chapters = this.parseChapterElements($);

    console.log(`Total chapters parsed: ${chapters.length}`);

    return {
      href: this.toRelativeUrl(href),
      title,
      altTitle: "",
      thumbnail,
      description,
      status,
      type: "Manga",
      released: year,
      author,
      updatedOn: "",
      rating,
      latestChapter: chapters.length > 0 ? chapters[0].title : null,
      genres,
      chapters,
    };
  }

  private parseChapterElements($: ReturnType<typeof cheerio.load>): Chapter[] {
    const selectors = [
      "ul#chapterContainer li.chapter-item",
      "#chapterContainer li[data-chapter]",
      "#chapterContainer > li",
      "li[data-chapter]",
    ];

    for (const sel of selectors) {
      const els = $(sel);
      if (!els.length) continue;

      const chapters: Chapter[] = [];
      els.each((_, li) => {
        let chapterTitle = $(li).attr("data-chapter") ?? "";
        if (!chapterTitle)
          chapterTitle = $(li).find("span.chapter-name").text().trim();
        if (!chapterTitle)
          chapterTitle = $(li).find("span").first().text().trim();

        let chapterHref = $(li).find("a").attr("href") ?? "";
        if (chapterTitle && chapterHref) {
          chapterHref = this.toRelativeUrl(chapterHref);
          chapters.push({ title: chapterTitle, href: chapterHref, date: "" });
        }
      });

      if (chapters.length > 0) return chapters;
    }

    // Last-resort: query the container directly
    const container = $("#chapterContainer");
    if (container.length) {
      const chapters: Chapter[] = [];
      container.find("li").each((_, li) => {
        let chapterTitle =
          $(li).attr("data-chapter") ??
          $(li).find("span").first().text().trim();
        let chapterHref = this.toRelativeUrl(
          $(li).find("a").attr("href") ?? "",
        );
        if (chapterTitle && chapterHref) {
          chapters.push({ title: chapterTitle, href: chapterHref, date: "" });
        }
      });
      return chapters;
    }

    return [];
  }

  // ── Read chapter ──

  async fetchChapter(href: string): Promise<ReadChapter> {
    if (!href) throw new Error("href is required");

    const html = await this.fetchHtml(this.toAbsoluteUrl(href));
    const $ = cheerio.load(html);

    const title =
      $("div.header-title").text().trim() ||
      $("title").text().trim() ||
      $("h1").first().text().trim();
    if (!title) throw new Error("Chapter not found");

    const images: string[] = [];
    $("div.image-container").each((_, el) => {
      const img = $(el).find("img.webtoon-img").first();
      if (!img.length) return;
      const src = img.attr("src") ?? img.attr("data-src") ?? "";
      if (src && !src.includes("data:image")) {
        images.push(this.toAbsoluteUrl(src));
      }
    });

    if (images.length === 0) throw new Error("No images found in chapter");

    // prev/next — buttons indicate availability but don't carry URLs
    // (actual navigation is JS-driven on the site)
    const prevDisabled = $("button#prevBtn").attr("disabled") !== undefined;
    const nextDisabled = $("button#nextBtn").attr("disabled") !== undefined;
    const prev = prevDisabled ? "" : "prev";
    const next = nextDisabled ? "" : "next";

    return { title, prev, next, panel: images };
  }

  // ── Batch helpers ──

  async fetchMultipleLists(opts: {
    popular?: boolean;
    recommended?: boolean;
    newest?: boolean;
    limit?: number;
  }): Promise<Record<string, ComicItem[]>> {
    const { popular, recommended, newest, limit = 6 } = opts;
    const results: Record<string, ComicItem[]> = {};
    const promises: Promise<void>[] = [];

    if (popular)
      promises.push(
        this.fetchPopular().then((i) => {
          results["popular"] = i.slice(0, limit);
        }),
      );
    if (recommended)
      promises.push(
        this.fetchRecommended().then((i) => {
          results["recommended"] = i.slice(0, limit);
        }),
      );
    if (newest)
      promises.push(
        this.fetchNewest().then((i) => {
          results["newest"] = i.slice(0, limit);
        }),
      );

    await Promise.all(promises);
    return results;
  }

  async fetchMultipleGenres(
    genres: string[],
    limit = 6,
  ): Promise<Record<string, ComicItem[]>> {
    const results: Record<string, ComicItem[]> = {};

    for (let i = 0; i < genres.length; i += MAX_CONCURRENT) {
      const batch = genres.slice(i, i + MAX_CONCURRENT);
      await Promise.all(
        batch.map(async (genre) => {
          try {
            const items = await this.fetchByGenre(genre);
            results[genre] = items.slice(0, limit);
          } catch {
            results[genre] = [];
          }
        }),
      );
    }

    return results;
  }

  // ── Lifecycle ──

  clearCache(): void {
    this.listCache.clear();
  }

  dispose(): void {
    this.clearCache();
  }
}

export default KomikluParser;
