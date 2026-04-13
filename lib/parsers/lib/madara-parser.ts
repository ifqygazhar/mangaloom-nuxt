import { ComicParser } from "../parser-base";
import type { ComicItem } from "../../models/comic-item";
import type { ComicDetail } from "../../models/comic-detail";
import type { ReadChapter } from "../../models/read-chapter";
import type { Genre } from "../../models/genre";
import type { Chapter } from "../../models/chapter";
import { ResultCache } from "../../utils/cache";
import * as cheerio from "cheerio";
import CryptoJS from "crypto-js";

export abstract class MadaraParser extends ComicParser {
  protected abstract domain: string;
  protected listUrl = "manga/";

  protected listCache = new ResultCache<ComicItem[]>();
  protected detailCache = new ResultCache<ComicDetail>();

  get baseUrl(): string {
    return `https://${this.domain}`;
  }

  protected getHeaders(): Record<string, string> {
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": this.baseUrl + "/",
    };
  }

  protected getHrefUrl(href: string): string {
    return href.startsWith("http") ? href : `${this.baseUrl}/${href.replace(/^\//, "")}`;
  }

  protected extractIdFromUrl(url: string): string {
    const withoutTrailing = url.replace(/\/$/, "");
    return withoutTrailing.split("/").pop() || "";
  }

  // --- HTML Parsing Helpers ---

  protected async fetchHtml(url: string, init?: RequestInit): Promise<cheerio.CheerioAPI> {
    const res = await fetch(url, { headers: this.getHeaders(), ...init });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const html = await res.text();
    return cheerio.load(html);
  }

  protected async fetchMangaListUrl(page: number, order: string, query?: string, genre?: string): Promise<ComicItem[]> {
    let url = `${this.baseUrl}/`;
    if (page > 1) {
      url += `page/${page}/`;
    }
    const params = new URLSearchParams();
    params.append('s', query || '');
    params.append('post_type', 'wp-manga');

    if (genre) {
        params.append('genre[]', genre);
    }
    
    if (order) {
        params.append('m_orderby', order);
    }

    url += `?${params.toString()}`;
    const $ = await this.fetchHtml(url);
    return this.parseMangaList($);
  }

  protected parseMangaList($: cheerio.CheerioAPI): ComicItem[] {
    const items: ComicItem[] = [];
    const elements = $("div.row.c-tabs-item__content").length 
        ? $("div.row.c-tabs-item__content") 
        : $("div.page-item-detail");

    elements.each((_, el) => {
      const a = $(el).find("a").first();
      const href = a.attr("href") || "";
      if (!href) return;
      
      const summary = $(el).find(".tab-summary").length ? $(el).find(".tab-summary") : $(el).find(".item-summary");
      const title = summary.find("h3, h4").first().text().trim() || $(el).find(".manga-name, .post-title").text().trim();
      const coverUrl = $(el).find("img").first().attr("src") || $(el).find("img").first().attr("data-src") || "";
      const id = this.extractIdFromUrl(href);

      const type = summary.find(".mg_status .summary-content").first().text().trim() || "Manga";
      const rating = $(el).find("span.total_votes").first().text().trim();

      items.push({
        title,
        href: id,
        thumbnail: coverUrl,
        type, 
        rating: rating || undefined
      });
    });

    return items;
  }

  // --- Public API ---

  async fetchPopular(): Promise<ComicItem[]> {
    const cacheKey = `${this.sourceName}-popular`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const items = await this.fetchMangaListUrl(1, "views");
    this.listCache.set(cacheKey, items);
    return items;
  }

  async fetchRecommended(): Promise<ComicItem[]> {
    const cacheKey = `${this.sourceName}-recommended`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    // Use rating for recommended
    const items = await this.fetchMangaListUrl(1, "rating");
    this.listCache.set(cacheKey, items);
    return items;
  }

  async fetchNewest(page: number = 1): Promise<ComicItem[]> {
    const cacheKey = `${this.sourceName}-newest-${page}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const items = await this.fetchMangaListUrl(page, "latest");
    this.listCache.set(cacheKey, items);
    return items;
  }

  async fetchAll(page: number = 1): Promise<ComicItem[]> {
    const cacheKey = `${this.sourceName}-all-${page}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const items = await this.fetchMangaListUrl(page, "alphabet");
    this.listCache.set(cacheKey, items);
    return items;
  }

  async search(query: string): Promise<ComicItem[]> {
    const cacheKey = `${this.sourceName}-search-${query}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const items = await this.fetchMangaListUrl(1, "views", query);
    this.listCache.set(cacheKey, items);
    return items;
  }

  async fetchByGenre(genre: string, page: number = 1): Promise<ComicItem[]> {
    const cacheKey = `${this.sourceName}-genre-${genre}-${page}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const items = await this.fetchMangaListUrl(page, "latest", undefined, genre);
    this.listCache.set(cacheKey, items);
    return items;
  }

  async fetchFiltered(options: { page?: number; genre?: string; status?: string; type?: string; order?: string } = {}): Promise<ComicItem[]> {
    const page = options.page || 1;
    let order = options.order || "latest";

    // map common order values
    if (order === "popular") order = "views";
    if (order === "alphabetical") order = "alphabet";
    if (order === "newest") order = "new-manga";
    if (order === "latest") order = "latest";

    const items = await this.fetchMangaListUrl(page, order, undefined, options.genre);
    return items;
  }

  async fetchGenres(): Promise<Genre[]> {
      const url = `${this.baseUrl}/${this.listUrl}`;
      const $ = await this.fetchHtml(url);
      
      const genres: Genre[] = [];
      const genreLinks = $("header ul.second-menu li a, div.genres_wrap ul.list-unstyled li a");
      
      genreLinks.each((_, el) => {
          const href = $(el).attr("href") || "";
          const slug = href.replace(/\/$/, "").split("/").pop() || "";
          let title = $(el).text().trim() || $(el).find(".menu-image-title").text().trim();
          
          if (slug && title) {
            genres.push({ title, href: slug });
          }
      });
      
      // Deduplicate
      const unique = Array.from(new Map(genres.map(g => [g.href, g])).values());
      return unique;
  }

  async fetchDetail(href: string): Promise<ComicDetail> {
      const cacheKey = `${this.sourceName}-detail-${href}`;
      const cached = this.detailCache.get(cacheKey);
      if (cached) return cached;

      const url = `${this.baseUrl}/manga/${href}/`;
      const $ = await this.fetchHtml(url);

      const title = $("h1").first().text().trim();
      const thumbnail = $(".summary_image img").first().attr("src") || $(".summary_image img").first().attr("data-src") || "";
      
      const selectorsDesc = [
        "div.description-summary div.summary__content",
        "div.summary_content div.post-content_item > h5 + div",
        "div.summary_content div.manga-excerpt",
        "div.post-content div.manga-summary",
        "div.post-content div.desc",
        "div.c-page__content div.summary__content"
      ];
      const description = $(selectorsDesc.join(", ")).text().trim();
      
      const author = $(".mg_author, .mg_artists, .author-content").find("a").first().text().trim();
      
      const statusTokens = ["ongoing", "completed", "canceled", "on-hold", "upcoming"];
      const rawStatus = $(".post-content_item:contains(Status), .post-content_item:contains(Statut)").find(".summary-content").text().toLowerCase().trim();
      let status = "Ongoing";
      for (const t of statusTokens) {
        if (rawStatus.includes(t)) {
            status = t.charAt(0).toUpperCase() + t.slice(1);
            break;
        }
      }

      const genres: Genre[] = [];
      $("div.genres-content a").each((_, a) => {
          const ghref = $(a).attr("href") || "";
          const slug = ghref.replace(/\/$/, "").split("/").pop() || "";
          const gtitle = $(a).text().trim();
          if (slug) {
              genres.push({ title: gtitle, href: slug });
          }
      });
      
      let chapters: Chapter[] = [];
      const testCheckAsync = $('div.listing-chapters_wrap').length === 0;
      if (testCheckAsync || $('div.listing-chapters_wrap').html()?.trim() === '') {
         chapters = await this.loadChapters(url, $);
      } else {
         chapters = this.getChapters($, href);
      }

      const detail: ComicDetail = {
          href,
          title,
          altTitle: "", // could extract from .post-content_item:contains(Alt)
          thumbnail,
          description,
          status,
          type: "Manga",
          released: "",
          author,
          updatedOn: chapters.length > 0 ? chapters[0].date : "",
          rating: "",
          latestChapter: chapters.length > 0 ? chapters[0].title : undefined,
          genres,
          chapters,
      };

      this.detailCache.set(cacheKey, detail);
      return detail;
  }

  protected async loadChapters(mangaUrl: string, $: cheerio.CheerioAPI): Promise<Chapter[]> {
      const url = `${mangaUrl.replace(/\/$/, "")}/ajax/chapters/`;
      const doc = await this.fetchHtml(url, { method: "POST" });
      return this.getChapters(doc, ""); 
  }

  protected getChapters($: cheerio.CheerioAPI, mangaSlug: string): Chapter[] {
      const chapters: Chapter[] = [];
      $("li.wp-manga-chapter").each((_, li) => {
          const a = $(li).find("a").first();
          let href = a.attr("href") || "";
          if (href) {
            href = href.replace(this.baseUrl, ""); // convert to relative
            href = href.replace(/^\//, ""); // remove leading slash
          }
          const title = a.find("p").text().trim() || a.text().trim();
          const targetDate = $(li).find("a.c-new-tag").attr("title") || $(li).find("span.chapter-release-date i").text().trim();

          // ensure href does not contain stylePage query if unneeded
          href = href.split("?")[0];

          chapters.push({
              title,
              href,
              date: targetDate,
          });
      });
      return chapters;
  }

  async fetchChapter(href: string): Promise<ReadChapter> {
    const url = `${this.baseUrl}/${href}`;
    const $ = await this.fetchHtml(url);
    
    const chapterProtector = $("#chapter-protector-data");
    const panels: string[] = [];

    if (chapterProtector.length === 0) {
      // standard reading
      const root = $("div.main-col-inner div.reading-content").first();
      if (!root.length) {
          throw new Error("No image found, try to log in or CAPTCHA required.");
      }
      root.find("div.page-break img").each((_, img) => {
          const src = $(img).attr("src") || $(img).attr("data-src") || "";
          if (src) panels.push(src.trim());
      });
    } else {
      // decrypted reading
      const protectorSrc = chapterProtector.attr("src") || "";
      const chapterProtectorHtml = protectorSrc.startsWith("data:text/javascript;base64,") 
          ? Buffer.from(protectorSrc.substring(28), 'base64').toString('utf-8')
          : chapterProtector.html() || "";
      
      const pwdMatch = chapterProtectorHtml.match(/wpmangaprotectornonce='(.*?)'/);
      const dataMatch = chapterProtectorHtml.match(/chapter_data='(.*?)'/);

      if (pwdMatch && dataMatch) {
          const password = pwdMatch[1];
          const chapterDataRaw = dataMatch[1].replace(/\\\//g, "/");
          const chapterData = JSON.parse(chapterDataRaw);
          
          const unsaltedCiphertext = Buffer.from(chapterData.ct, 'base64');
          const salt = Buffer.from(chapterData.s, 'hex');
          const saltedMagic = Buffer.from("Salted__", 'utf-8');
          const ciphertextBuffer = Buffer.concat([saltedMagic, salt, unsaltedCiphertext]);
          
          const ciphertextBase64 = ciphertextBuffer.toString('base64');
          const decrypted = CryptoJS.AES.decrypt(ciphertextBase64, password);
          const rawImgArray = decrypted.toString(CryptoJS.enc.Utf8);
          
          const imgArrayString = rawImgArray.replace(/\[|\]|\\|"/g, '');
          panels.push(...imgArrayString.split(',').filter(s => s));
      }
    }

    return {
        title: $("#chapter-heading").text().trim() || "Chapter",
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
