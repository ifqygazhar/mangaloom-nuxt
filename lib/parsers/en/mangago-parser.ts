import * as cheerio from "cheerio";
import CryptoJS from "crypto-js";
import type { ComicItem } from "../../models/comic-item";
import type { ComicDetail } from "../../models/comic-detail";
import type { ReadChapter } from "../../models/read-chapter";
import type { Genre } from "../../models/genre";
import type { Chapter } from "../../models/chapter";
import { ComicParser } from "../parser-base";
import { ResultCache } from "../../utils/cache";

/**
 * Parser for MangaGo (mangago.me).
 * Uses Cheerio for HTML scraping and AES decryption for chapter images.
 * Converted from Kotlin reference implementation.
 */
export class MangaGoParser extends ComicParser {
  private static readonly DOMAIN = "mangago.me";
  private static readonly BASE_URL = `https://proxy-bypass-cors.verifwebsitepro.workers.dev/?url=https://${MangaGoParser.DOMAIN}`;

  private listCache = new ResultCache<ComicItem[]>();
  private detailCache = new ResultCache<ComicDetail>();

  get sourceName(): string {
    return "MangaGo";
  }

  get baseUrl(): string {
    return MangaGoParser.BASE_URL;
  }

  get language(): string {
    return "EN";
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  private get headers(): Record<string, string> {
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      Referer: `${MangaGoParser.BASE_URL}/`,
    };
  }

  private toAbsoluteUrl(url: string): string {
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("//")) return `https:${url}`;
    if (url.startsWith("/")) return `${MangaGoParser.BASE_URL}${url}`;
    return `${MangaGoParser.BASE_URL}/${url}`;
  }

  private toRelativeUrl(url: string): string {
    const prefixes = [
      `https://${MangaGoParser.DOMAIN}`,
      `http://${MangaGoParser.DOMAIN}`,
    ];
    for (const prefix of prefixes) {
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

  /** Fetch HTML from a URL */
  private async fetchHtml(url: string): Promise<string> {
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
  }

  /** Fetch raw text (for JS files) */
  private async fetchText(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: {
        ...this.headers,
        Accept: "*/*",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
  }

  // ─── Sort mapping ─────────────────────────────────────────────────────────

  private getSortParam(order?: string): string {
    switch (order?.toLowerCase()) {
      case "updated":
        return "s=1";
      case "popular":
      case "popularity":
        return "s=9";
      case "newest":
        return "s=2";
      case "alphabetical":
      case "title":
        return "s=3";
      default:
        return "s=1";
    }
  }

  // ─── Date parsing ─────────────────────────────────────────────────────────

  private parseDate(dateStr: string): string {
    if (!dateStr) return "";
    try {
      // Handle "MMM d, yyyy" or "MMM d yyyy"
      const format = dateStr.includes(",")
        ? /(\w+)\s+(\d+),\s*(\d{4})/
        : /(\w+)\s+(\d+)\s+(\d{4})/;
      const m = dateStr.match(format);
      if (m) {
        return `${m[1]} ${m[2].padStart(2, "0")}, ${m[3]}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  }

  // ─── List parsing ─────────────────────────────────────────────────────────

  private parseListPage(html: string, isSearch: boolean): ComicItem[] {
    const $ = cheerio.load(html);
    const items: ComicItem[] = [];

    const elements = isSearch
      ? $("div.row").toArray()
      : $("ul#search_list > li").toArray();

    for (const el of elements) {
      try {
        const titleEl =
          $(el).find("h2 a").first().length > 0
            ? $(el).find("h2 a").first()
            : $(el).find("h3 a").first();

        if (!titleEl.length) continue;

        const href = titleEl.attr("href") ?? "";
        const title = titleEl.text().trim();
        if (!title || !href) continue;

        const imgEl = $(el).find("img").first();
        const thumbnail =
          imgEl.attr("src") ?? imgEl.attr("data-original") ?? "";

        items.push({
          title,
          href: this.toRelativeUrl(href),
          thumbnail: thumbnail ? this.toAbsoluteUrl(thumbnail) : "",
        });
      } catch {
        // skip malformed entries
      }
    }

    return items;
  }

  // ─── AES Decryption helpers ───────────────────────────────────────────────

  /** AES-CBC decrypt a base64-encoded string using hex key and IV */
  private decryptAes(b64: string, hexKey: string, hexIv: string): string {
    try {
      const key = CryptoJS.enc.Hex.parse(hexKey);
      const iv = CryptoJS.enc.Hex.parse(hexIv);

      const decrypted = CryptoJS.AES.decrypt(b64, key, {
        iv,
        padding: CryptoJS.pad.NoPadding,
        mode: CryptoJS.mode.CBC,
      });

      return decrypted
        .toString(CryptoJS.enc.Utf8)
        .replace(/[\x00-\x1f]+$/g, "")
        .trim();
    } catch (e) {
      throw new Error(
        `Failed to decrypt image list: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /**
   * Unscramble the decrypted image URL string.
   * Extracts key digits from specific positions, removes those positions,
   * then reverses a character-swap algorithm.
   */
  private unscrambleImageList(
    scrambledStr: string,
    locations: number[],
  ): string {
    const uniqueLocs = [...new Set(locations)].sort((a, b) => a - b);

    // Extract key digits from the specified positions
    const keys: number[] = [];
    for (const loc of uniqueLocs) {
      if (loc < scrambledStr.length) {
        const char = scrambledStr[loc];
        if (/\d/.test(char)) {
          keys.push(parseInt(char, 10));
        }
      }
    }

    // Remove key-position characters from the string
    const locsSet = new Set(uniqueLocs);
    let cleanedString = "";
    for (let i = 0; i < scrambledStr.length; i++) {
      if (!locsSet.has(i)) {
        cleanedString += scrambledStr[i];
      }
    }

    return this.stringUnscramble(cleanedString, keys);
  }

  /** Reverse the character-swap scrambling algorithm */
  private stringUnscramble(str: string, keys: number[]): string {
    const charArray = str.split("");

    for (let j = keys.length - 1; j >= 0; j--) {
      const keyVal = keys[j];
      for (let i = charArray.length - 1; i >= keyVal; i--) {
        if (i % 2 !== 0) {
          const idx1 = i - keyVal;
          if (idx1 >= 0 && i < charArray.length) {
            [charArray[idx1], charArray[i]] = [charArray[i], charArray[idx1]];
          }
        }
      }
    }

    return charArray.join("");
  }

  // ─── Static genre list ────────────────────────────────────────────────────

  private static readonly GENRES = [
    "Action",
    "Adventure",
    "Comedy",
    "Doujinshi",
    "Drama",
    "Ecchi",
    "Fantasy",
    "Gender Bender",
    "Harem",
    "Historical",
    "Horror",
    "Josei",
    "Martial Arts",
    "Mature",
    "Mecha",
    "Mystery",
    "One Shot",
    "Psychological",
    "Romance",
    "School Life",
    "Sci-fi",
    "Seinen",
    "Shoujo",
    "Shoujo Ai",
    "Shounen",
    "Shounen Ai",
    "Slice of Life",
    "Smut",
    "Sports",
    "Supernatural",
    "Tragedy",
    "Webtoons",
    "Yaoi",
    "Yuri",
  ];

  // ─── Public API (ComicParser interface) ───────────────────────────────────

  async fetchPopular(): Promise<ComicItem[]> {
    const cacheKey = "mangago-popular";
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const url = `${MangaGoParser.BASE_URL}/genre/All/1/?s=9`;
    const html = await this.fetchHtml(url);
    const items = this.parseListPage(html, false);

    this.listCache.set(cacheKey, items);
    return items;
  }

  async fetchRecommended(): Promise<ComicItem[]> {
    // Use alphabetical as "recommended" since there's no dedicated endpoint
    const cacheKey = "mangago-recommended";
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const url = `${MangaGoParser.BASE_URL}/genre/All/1/?s=3`;
    const html = await this.fetchHtml(url);
    const items = this.parseListPage(html, false);

    this.listCache.set(cacheKey, items);
    return items;
  }

  async fetchNewest(page: number = 1): Promise<ComicItem[]> {
    const cacheKey = `mangago-newest-${page}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const url = `${MangaGoParser.BASE_URL}/genre/All/${page}/?s=2`;
    const html = await this.fetchHtml(url);
    const items = this.parseListPage(html, false);
    if (items.length === 0) throw new Error("Page not found");

    this.listCache.set(cacheKey, items);
    return items;
  }

  async fetchAll(page: number = 1): Promise<ComicItem[]> {
    const cacheKey = `mangago-all-${page}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const url = `${MangaGoParser.BASE_URL}/genre/All/${page}/?s=1`;
    const html = await this.fetchHtml(url);
    const items = this.parseListPage(html, false);
    if (items.length === 0) throw new Error("Page not found");

    this.listCache.set(cacheKey, items);
    return items;
  }

  async search(query: string): Promise<ComicItem[]> {
    const cacheKey = `mangago-search-${encodeURIComponent(query)}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const url = `${MangaGoParser.BASE_URL}/r/l_search/?name=${encodeURIComponent(query)}&page=1`;
    const html = await this.fetchHtml(url);
    const items = this.parseListPage(html, true);
    if (items.length === 0) throw new Error("No results found");

    this.listCache.set(cacheKey, items);
    return items;
  }

  async fetchByGenre(genre: string, page: number = 1): Promise<ComicItem[]> {
    const cacheKey = `mangago-genre-${genre}-${page}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const url = `${MangaGoParser.BASE_URL}/genre/${encodeURIComponent(genre)}/${page}/?s=9`;
    const html = await this.fetchHtml(url);
    const items = this.parseListPage(html, false);
    if (items.length === 0) throw new Error("Page not found");

    this.listCache.set(cacheKey, items);
    return items;
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
    const cacheKey = `mangago-filtered-${page}-${genre}-${order}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const genreSlug = genre || "All";
    const sortParam = this.getSortParam(order);
    const url = `${MangaGoParser.BASE_URL}/genre/${encodeURIComponent(genreSlug)}/${page}/?${sortParam}`;
    const html = await this.fetchHtml(url);
    const items = this.parseListPage(html, false);
    if (items.length === 0) throw new Error("Page not found");

    this.listCache.set(cacheKey, items);
    return items;
  }

  async fetchGenres(): Promise<Genre[]> {
    return MangaGoParser.GENRES.map((g) => ({
      title: g,
      href: g,
    }));
  }

  async fetchDetail(href: string): Promise<ComicDetail> {
    const cacheKey = `mangago-detail-${href}`;
    const cached = this.detailCache.get(cacheKey);
    if (cached) return cached;

    const absUrl = this.toAbsoluteUrl(href);
    const html = await this.fetchHtml(absUrl);
    const $ = cheerio.load(html);

    // Title
    const title = $("div.manga_right h1, h1.manga-title").first().text().trim();

    // Cover image
    const thumbnail =
      $("div.manga_left img").attr("src") ??
      $("div.manga_left img").attr("data-original") ??
      "";

    // Info fields
    const infoArea = $("div.manga_right");

    // Author
    const authorEls = infoArea.find("td:contains('Author') a");
    const authors = authorEls.map((_, el) => $(el).text().trim()).get();
    const author = authors.join(", ");

    // Genres
    const genreEls = infoArea.find("td:contains('Genre') a");
    const genres: Genre[] = genreEls
      .map((_, el) => {
        const text = $(el).text().trim();
        return { title: text, href: text };
      })
      .get();

    // Status
    const statusText = infoArea
      .find("td:contains('Status') span")
      .text()
      .toLowerCase();
    let status = "Unknown";
    if (statusText.includes("completed")) status = "Completed";
    else if (statusText.includes("ongoing")) status = "Ongoing";

    // Description
    const description = $("div.manga_summary")
      .text()
      .replace(/^Summary:\s*/i, "")
      .trim();

    // Chapters
    const chapters: Chapter[] = [];
    $("table#chapter_table tr").each((i, tr) => {
      const a = $(tr).find("a.chico").first();
      if (!a.length) return;

      const chHref = a.attr("href") ?? "";
      const chTitle = a.text().trim();
      const dateText = $(tr).find("td:last-child").text().trim();

      chapters.push({
        title: chTitle,
        href: this.toRelativeUrl(chHref),
        date: this.parseDate(dateText),
      });
    });
    chapters.reverse();

    const detail: ComicDetail = {
      href: this.toRelativeUrl(href),
      title: title || href,
      altTitle: "",
      thumbnail: thumbnail ? this.toAbsoluteUrl(thumbnail) : "",
      description,
      status,
      type: "",
      released: "",
      author,
      updatedOn: "",
      rating: "",
      latestChapter: chapters.length > 0 ? chapters[0].title : undefined,
      genres,
      chapters,
    };

    this.detailCache.set(cacheKey, detail);
    return detail;
  }

  async fetchChapter(href: string): Promise<ReadChapter> {
    const absUrl = this.toAbsoluteUrl(href);
    const html = await this.fetchHtml(absUrl);
    const $ = cheerio.load(html);

    // 1. Extract the encrypted base64 string from inline script
    const scriptContent = $("script:contains('imgsrcs')").html() ?? "";
    const imgsrcsMatch = scriptContent.match(/var\s+imgsrcs\s*=\s*'([^']+)'/);
    if (!imgsrcsMatch || !imgsrcsMatch[1]) {
      throw new Error("Could not find imgsrcs in page");
    }
    const imgsrcsBase64 = imgsrcsMatch[1];

    // 2. Find and fetch the external chapter.js to get encryption keys
    const jsUrl = $("script[src*='chapter.js']").attr("src") ?? "";
    if (!jsUrl) throw new Error("Chapter JS not found");

    const jsAbsUrl = this.toAbsoluteUrl(jsUrl);
    const jsContent = await this.fetchText(jsAbsUrl);

    // 3. Extract AES key and IV from the JS
    const hexMatches = [
      ...jsContent.matchAll(/CryptoJS\.enc\.Hex\.parse\("([0-9a-fA-F]+)"\)/g),
    ];
    if (hexMatches.length < 2) {
      throw new Error("Could not extract encryption key/IV from chapter.js");
    }
    const keyHex = hexMatches[0][1];
    const ivHex = hexMatches[1][1];

    // 4. Decrypt the image list
    const decryptedString = this.decryptAes(imgsrcsBase64, keyHex, ivHex);

    // 5. Unscramble if needed
    const keyLocations = [
      ...jsContent.matchAll(/str\.charAt\(\s*(\d+)\s*\)/g),
    ].map((m) => parseInt(m[1], 10));

    const finalUrlString =
      keyLocations.length > 0
        ? this.unscrambleImageList(decryptedString, keyLocations)
        : decryptedString;

    // 6. Parse image URLs
    const panels = finalUrlString
      .split(",")
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    // Title
    const title = $("h1").first().text().trim() || $("title").text().trim();

    return {
      title,
      prev: "",
      next: "",
      panel: panels,
    };
  }

  clearCache(): void {
    this.listCache.clear();
    this.detailCache.clear();
  }

  dispose(): void {
    this.clearCache();
  }
}
