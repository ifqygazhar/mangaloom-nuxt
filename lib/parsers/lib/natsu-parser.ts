import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import { ComicDetail } from "../id/komiklu-parser";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ComicItem {
  title: string;
  href: string;
  thumbnail: string;
  type?: string;
  chapter?: string;
  rating?: string;
}

export interface Genre {
  title: string;
  href: string;
}

export interface Chapter {
  title: string;
  href: string;
  date: string;
}

export interface ReadChapter {
  title: string;
  prev: string;
  next: string;
  panel: string[];
}

interface CachedResult {
  items: ComicItem[];
  timestamp: Date;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTH_MAP: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

// ─── Advanced Search params ───────────────────────────────────────────────────

interface AdvancedSearchParams {
  page?: number;
  orderby?: string;
  query?: string;
  genres?: string[];
  genresExclude?: string[];
  status?: string;
  type?: string;
}

// ─── NatsuParser ─────────────────────────────────────────────────────────────

/**
 * Base parser for NatsuId WordPress theme sites.
 * Subclasses must provide `domain`, `sourceName`, and `language`.
 */
export abstract class NatsuParser {
  abstract readonly sourceName: string;
  abstract readonly domain: string;
  abstract readonly language: string;

  private readonly listCache = new Map<string, CachedResult>();
  private nonce: string | null = null;

  get baseUrl(): string {
    return `https://${this.domain}`;
  }

  // ── Headers ──

  private get headers(): Record<string, string> {
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      Referer: `https://${this.domain}/`,
      Origin: `https://${this.domain}`,
    };
  }

  // ── URL helpers ──

  toAbsoluteUrl(url: string): string {
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("//")) return `https:${url}`;
    if (url.startsWith("/")) return `https://${this.domain}${url}`;
    return `https://${this.domain}/${url}`;
  }

  toRelativeUrl(url: string): string {
    const variants = [`https://${this.domain}`, `http://${this.domain}`];
    for (const prefix of variants) {
      if (url.startsWith(prefix)) {
        url = url.slice(prefix.length);
        break;
      }
    }
    if (url.startsWith("http")) {
      const parsed = new URL(url);
      url = parsed.pathname + (parsed.search ? parsed.search : "");
    }
    if (!url.startsWith("/")) url = "/" + url;
    return url;
  }

  private extractSlug(genre: string): string {
    return genre
      .replace(/^.*\/genre\//, "")
      .replace(/^\//, "")
      .replace(/\/$/, "");
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

  // ── HTTP helpers ──

  private async fetchHtml(url: string): Promise<string> {
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
  }

  private async httpPost(
    url: string,
    form: Record<string, string>,
    extraHeaders?: Record<string, string>,
  ): Promise<string> {
    const body = new FormData();
    for (const [k, v] of Object.entries(form)) body.append(k, v);

    const res = await fetch(url, {
      method: "POST",
      headers: { ...this.headers, ...extraHeaders },
      body,
    });
    if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`);
    return res.text();
  }

  // ── Nonce ──

  private async getNonce(): Promise<string> {
    if (this.nonce) return this.nonce;

    const url = `https://${this.domain}/wp-admin/admin-ajax.php?type=search_form&action=get_nonce`;
    const html = await this.fetchHtml(url);
    const $ = cheerio.load(html);
    const value = $('input[name="search_nonce"]').attr("value")?.trim() ?? "";
    if (!value) throw new Error("Nonce not found in response");
    this.nonce = value;
    return value;
  }

  // ── Advanced search core ──

  private async advancedSearch(
    params: AdvancedSearchParams = {},
  ): Promise<ComicItem[]> {
    const {
      page = 1,
      orderby = "popular",
      query,
      genres,
      genresExclude,
      status,
      type,
    } = params;

    const url = `https://${this.domain}/wp-admin/admin-ajax.php?action=advanced_search`;
    const nonce = await this.getNonce();

    const form: Record<string, string> = {};
    form["nonce"] = nonce;

    form["inclusion"] = "OR";
    form["genre"] = genres?.length
      ? JSON.stringify(genres.map((g) => this.extractSlug(g)))
      : "[]";

    form["exclusion"] = "OR";
    form["genre_exclude"] = genresExclude?.length
      ? JSON.stringify(genresExclude.map((g) => this.extractSlug(g)))
      : "[]";

    form["page"] = String(page);
    form["author"] = "[]";
    form["artist"] = "[]";
    form["project"] = "0";

    if (type) {
      const typeMap: Record<string, string> = {
        manga: "manga",
        manhwa: "manhwa",
        manhua: "manhua",
        comic: "comic",
        comics: "comic",
        novel: "novel",
      };
      form["type"] = JSON.stringify([
        typeMap[type.toLowerCase()] ?? type.toLowerCase(),
      ]);
    } else {
      form["type"] = "[]";
    }

    if (status) {
      const statusMap: Record<string, string> = {
        ongoing: "ongoing",
        completed: "completed",
        hiatus: "on-hiatus",
        "on-hiatus": "on-hiatus",
      };
      form["status"] = JSON.stringify([
        statusMap[status.toLowerCase()] ?? status.toLowerCase(),
      ]);
    } else {
      form["status"] = "[]";
    }

    form["order"] = "desc";
    form["orderby"] = orderby;
    if (query) form["query"] = query;

    const html = await this.httpPost(url, form);
    return this.parseMangaList(html);
  }

  // ── Parse manga list ──

  parseMangaList(html: string): ComicItem[] {
    const $ = cheerio.load(html);
    const items: ComicItem[] = [];

    $("body > div").each((_, el) => {
      try {
        const mainLink = $(el).find('a[href*="/manga/"]').first();
        if (!mainLink.length) return;

        const href = this.toRelativeUrl(mainLink.attr("href") ?? "");
        if (href.includes("/chapter-")) return;

        const titleEl = $(el).find("a.text-base, a.text-white, h1").first();
        let title = titleEl.text().trim();
        if (!title) title = mainLink.attr("title")?.trim() ?? "";
        if (!title) title = mainLink.text().trim();
        if (!title) return;

        const imgEl = $(el).find("img").first();
        let thumbnail =
          imgEl.attr("src") ??
          imgEl.attr("data-src") ??
          imgEl.attr("data-lazy-src") ??
          "";
        if (thumbnail) thumbnail = this.toAbsoluteUrl(thumbnail);

        const ratingEl = $(el).find(".numscore, span.text-yellow-400").first();
        let rating: string | undefined;
        if (ratingEl.length) {
          const t = ratingEl.text().trim();
          if (!isNaN(parseFloat(t))) rating = t;
        }

        let comicType: string | undefined;
        let stateEl = $(el).find("span.bg-accent").first();
        if (!stateEl.length) {
          $(el)
            .find("p")
            .each((_, p) => {
              const pText = $(p).text().toLowerCase();
              if (
                pText.includes("ongoing") ||
                pText.includes("completed") ||
                pText.includes("hiatus")
              ) {
                stateEl = $(p);
                return false; // break
              }
            });
        }
        if (stateEl.length) {
          const stateText = stateEl.text().toLowerCase();
          if (stateText.includes("ongoing")) comicType = "Ongoing";
          else if (stateText.includes("completed")) comicType = "Completed";
          else if (stateText.includes("hiatus")) comicType = "Hiatus";
        }

        items.push({ title, href, thumbnail, rating, type: comicType });
      } catch {
        // skip
      }
    });

    return items;
  }

  // ── Public API ──

  async fetchPopular(): Promise<ComicItem[]> {
    const key = "natsu-popular-1";
    const cached = this.getFromCache(key);
    if (cached) return cached;

    const results = await this.advancedSearch({ page: 1, orderby: "popular" });
    this.saveToCache(key, results);
    return results;
  }

  async fetchRecommended(): Promise<ComicItem[]> {
    const key = "natsu-recommended-1";
    const cached = this.getFromCache(key);
    if (cached) return cached;

    const results = await this.advancedSearch({ page: 1, orderby: "rating" });
    this.saveToCache(key, results);
    return results;
  }

  async fetchNewest(page = 1): Promise<ComicItem[]> {
    const key = `natsu-newest-${page}`;
    const cached = this.getFromCache(key);
    if (cached) return cached;

    const results = await this.advancedSearch({ page, orderby: "updated" });
    if (results.length === 0) throw new Error("Page not found");
    this.saveToCache(key, results);
    return results;
  }

  async fetchAll(page = 1): Promise<ComicItem[]> {
    const key = `natsu-all-${page}`;
    const cached = this.getFromCache(key);
    if (cached) return cached;

    const results = await this.advancedSearch({ page, orderby: "title" });
    if (results.length === 0) throw new Error("Page not found");
    this.saveToCache(key, results);
    return results;
  }

  async search(query: string): Promise<ComicItem[]> {
    const key = `natsu-search-${encodeURIComponent(query)}`;
    const cached = this.getFromCache(key);
    if (cached) return cached;

    const results = await this.advancedSearch({ page: 1, query });
    if (results.length === 0) throw new Error("No results found");
    this.saveToCache(key, results);
    return results;
  }

  async fetchByGenre(genre: string, page = 1): Promise<ComicItem[]> {
    const key = `natsu-genre-${genre}-${page}`;
    const cached = this.getFromCache(key);
    if (cached) return cached;

    const results = await this.advancedSearch({
      page,
      genres: [genre],
      orderby: "popular",
    });
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
    const { page = 1, genre, status, type, order } = opts;
    const key = `natsu-filtered-${page}-${genre}-${status}-${type}-${order}`;
    const cached = this.getFromCache(key);
    if (cached) return cached;

    const orderbyMap: Record<string, string> = {
      popular: "popular",
      popularity: "popular",
      latest: "updated",
      updated: "updated",
      rating: "rating",
      title: "title",
      alphabetical: "title",
    };
    const orderby = orderbyMap[order?.toLowerCase() ?? ""] ?? "popular";

    const results = await this.advancedSearch({
      page,
      orderby,
      genres: genre ? [genre] : undefined,
      status,
      type,
    });
    if (results.length === 0) throw new Error("No results found");
    this.saveToCache(key, results);
    return results;
  }

  // ── Genres ──

  async fetchGenres(): Promise<Genre[]> {
    // Try WP JSON API first
    try {
      const url = `https://${this.domain}/wp-json/wp/v2/genre?per_page=100&page=1&orderby=count&order=desc`;
      const res = await fetch(url, { headers: this.headers });
      if (res.ok) {
        const json = (await res.json()) as Array<{
          slug: string;
          name: string;
        }>;
        const genres: Genre[] = [];
        for (const item of json) {
          const slug = item.slug?.trim();
          const name = item.name?.trim();
          if (slug && name)
            genres.push({ title: this.toTitleCase(name), href: `/${slug}/` });
        }
        if (genres.length > 0) return genres;
      }
    } catch {
      /* fallback */
    }

    // Fallback: scrape /advanced-search/
    try {
      const html = await this.fetchHtml(
        `https://${this.domain}/advanced-search/`,
      );
      const $ = cheerio.load(html);
      let scriptData = "";

      $("script").each((_, el) => {
        const text = $(el).html() ?? "";
        if (text.includes("var searchTerms")) {
          scriptData = text;
          return false;
        }
      });

      if (!scriptData) return [];

      const raw = scriptData
        .slice(
          scriptData.indexOf("var searchTerms =") + "var searchTerms =".length,
        )
        .trim();
      const endIdx = raw.lastIndexOf(";");
      const jsonObj = JSON.parse(endIdx > 0 ? raw.slice(0, endIdx) : raw);
      const genreObj = jsonObj?.genre as
        | Record<string, { taxonomy: string; slug: string; name: string }>
        | undefined;
      if (!genreObj) return [];

      const genres: Genre[] = [];
      for (const item of Object.values(genreObj)) {
        if (item.taxonomy !== "genre") continue;
        const slug = item.slug?.trim();
        const name = item.name?.trim();
        if (slug && name)
          genres.push({ title: this.toTitleCase(name), href: `/${slug}/` });
      }
      return genres;
    } catch {
      return [];
    }
  }

  // ── Detail ──

  async fetchDetail(href: string): Promise<ComicDetail> {
    if (!href) throw new Error("href is required");

    const absUrl = this.toAbsoluteUrl(href);
    const html = await this.fetchHtml(absUrl);
    const $ = cheerio.load(html);

    // Manga ID
    let mangaId = "";
    const hxEl = $('[hx-get*="manga_id="]').first();
    if (hxEl.length) {
      const hxGet = hxEl.attr("hx-get") ?? "";
      const m = hxGet.match(/manga_id=([^&]+)/);
      if (m) mangaId = m[1].trim();
    }
    if (!mangaId) {
      const idEl = $("input#manga_id, [data-manga-id]").first();
      mangaId =
        idEl.attr("value")?.trim() ?? idEl.attr("data-manga-id")?.trim() ?? "";
    }
    if (!mangaId) {
      const m = href.match(/\/manga\/([^/]+)/);
      if (m) mangaId = m[1];
    }

    // Title
    const title = $('h1[itemprop="name"]').text().trim();

    // Alt title
    const altTitle = $('h1[itemprop="name"]').next().text().trim();

    // Description
    const desc = $('div[itemprop="description"]')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean)
      .join("\n\n");

    // Thumbnail
    let thumbnail =
      $('div[itemprop="image"] > img').attr("src") ??
      $('div[itemprop="image"] > img').attr("data-src") ??
      "";
    if (thumbnail) thumbnail = this.toAbsoluteUrl(thumbnail);

    // Genres
    const genres: Genre[] = [];
    $('a[itemprop="genre"]').each((_, el) => {
      const gHref = $(el).attr("href") ?? "";
      const slug = gHref.replace(/.*\/genre\//, "").replace(/\/$/, "");
      const name = $(el).text().trim();
      if (slug && name)
        genres.push({ title: this.toTitleCase(name), href: `/${slug}/` });
    });

    // Info fields helper
    const findInfoText = (key: string): string | undefined => {
      let result: string | undefined;
      $("div.space-y-2 > .flex").each((_, el) => {
        const h4 = $(el).find("h4").first();
        if (h4.text().toLowerCase().includes(key.toLowerCase())) {
          result = $(el).find("p.font-normal").text().trim();
          return false; // break
        }
      });
      return result;
    };

    // Status
    const stateText = findInfoText("Status")?.toLowerCase() ?? "";
    let status = "Unknown";
    if (stateText.includes("ongoing")) status = "Ongoing";
    else if (stateText.includes("completed")) status = "Completed";
    else if (stateText.includes("hiatus")) status = "Hiatus";

    const author = findInfoText("Author") ?? "";
    const typeText = findInfoText("Type") ?? "";
    const rating = $(".numscore, span.text-yellow-400").first().text().trim();

    // Chapters
    const chapters = await this.loadChapters(mangaId, absUrl);

    return {
      href: this.toRelativeUrl(href),
      title: title || href,
      altTitle,
      thumbnail,
      description: desc,
      status,
      type: typeText,
      released: "",
      author,
      updatedOn: "",
      rating,
      latestChapter: chapters.length > 0 ? chapters[0].title : null,
      genres,
      chapters,
    };
  }

  // ── Load chapters (paginated AJAX) ──

  private async loadChapters(
    mangaId: string,
    mangaAbsUrl: string,
  ): Promise<Chapter[]> {
    const chapters: Chapter[] = [];
    const extraHeaders: Record<string, string> = {
      "HX-Request": "true",
      "HX-Target": "chapter-list",
      "HX-Trigger": "chapter-list",
      "HX-Current-URL": mangaAbsUrl,
      Referer: mangaAbsUrl,
    };

    for (let page = 1; page <= 50; page++) {
      const url =
        `https://${this.domain}/wp-admin/admin-ajax.php` +
        `?manga_id=${mangaId}&page=${page}&action=chapter_list`;

      try {
        const res = await fetch(url, {
          headers: { ...this.headers, ...extraHeaders },
        });

        if (res.status === 520) break;
        if (!res.ok)
          throw new Error(`Failed chapters page ${page}: ${res.status}`);

        const html = await res.text();
        const $ = cheerio.load(html);
        const els = $("div#chapter-list > div[data-chapter-number]");
        if (!els.length) break;

        els.each((_, el) => {
          const a = $(el).find("a").first();
          if (!a.length) return;

          const chHref = this.toRelativeUrl(a.attr("href") ?? "");
          if (!chHref) return;

          const chTitle = $(el).find("div.font-medium span").text().trim();
          const dateStr = $(el).find("time").text().trim();
          chapters.push({
            title: chTitle,
            href: chHref,
            date: this.parseDate(dateStr),
          });
        });
      } catch (e) {
        if (String(e).includes("520")) break;
        throw e;
      }
    }

    return chapters.reverse();
  }

  // ── Read chapter ──

  async fetchChapter(href: string): Promise<ReadChapter> {
    if (!href) throw new Error("href is required");

    const html = await this.fetchHtml(this.toAbsoluteUrl(href));
    const $ = cheerio.load(html);

    const title = $("h1").first().text().trim() || $("title").text().trim();

    const panels = this.parseChapterImages($, html);
    if (panels.length === 0) throw new Error("No images found in chapter");

    const findNavHref = (selector: string, textHint: string): string => {
      const el = $(selector).first();
      if (el.length) return this.toRelativeUrl(el.attr("href") ?? "");
      let found = "";
      $("a").each((_, a) => {
        if ($(a).text().toLowerCase().includes(textHint)) {
          found = this.toRelativeUrl($(a).attr("href") ?? "");
          return false;
        }
      });
      return found;
    };

    const prev = findNavHref('a[rel="prev"], a.prev', "prev");
    const next = findNavHref('a[rel="next"], a.next', "next");

    return { title, prev, next, panel: panels };
  }

  /** Subclasses can override this to use different image selectors. */
  protected parseChapterImages($: CheerioAPI, _html: string): string[] {
    const panels: string[] = [];
    $("main section section > img").each((_, img) => {
      const src =
        $(img).attr("src") ??
        $(img).attr("data-src") ??
        $(img).attr("data-lazy-src") ??
        "";
      if (src && !src.includes("data:image"))
        panels.push(this.toAbsoluteUrl(src));
    });
    return panels;
  }

  // ── Date parsing ──

  private parseDate(dateStr?: string): string {
    if (!dateStr) return "";
    try {
      if (dateStr.includes("ago")) {
        const m = dateStr.match(/(\d+)/);
        const n = parseInt(m?.[1] ?? "0", 10);
        if (!n) return "";
        const now = new Date();
        if (dateStr.includes("min")) now.setMinutes(now.getMinutes() - n);
        else if (dateStr.includes("hour")) now.setHours(now.getHours() - n);
        else if (dateStr.includes("day")) now.setDate(now.getDate() - n);
        else if (dateStr.includes("week")) now.setDate(now.getDate() - n * 7);
        else if (dateStr.includes("month")) now.setMonth(now.getMonth() - n);
        else if (dateStr.includes("year"))
          now.setFullYear(now.getFullYear() - n);
        else return dateStr;
        return this.formatDate(now);
      }

      const m = dateStr.match(/(\w+)\s+(\d+),?\s+(\d{4})/);
      if (m) {
        const month = MONTH_MAP[m[1].toLowerCase().slice(0, 3)] ?? 1;
        return this.formatDate(
          new Date(parseInt(m[3]), month - 1, parseInt(m[2])),
        );
      }

      return dateStr;
    } catch {
      return dateStr;
    }
  }

  private formatDate(date: Date): string {
    const m = MONTH_NAMES[date.getMonth()];
    return `${m} ${String(date.getDate()).padStart(2, "0")}, ${date.getFullYear()}`;
  }

  // ── String helpers ──

  protected toTitleCase(text: string): string {
    return text
      .split(" ")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
      .join(" ");
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
        this.fetchPopular().then((items) => {
          results["popular"] = items.slice(0, limit);
        }),
      );
    if (recommended)
      promises.push(
        this.fetchRecommended().then((items) => {
          results["recommended"] = items.slice(0, limit);
        }),
      );
    if (newest)
      promises.push(
        this.fetchNewest().then((items) => {
          results["newest"] = items.slice(0, limit);
        }),
      );

    await Promise.all(promises);
    return results;
  }

  // ── Lifecycle ──

  clearCache(): void {
    this.listCache.clear();
    this.nonce = null;
  }

  dispose(): void {
    this.clearCache();
  }
}
