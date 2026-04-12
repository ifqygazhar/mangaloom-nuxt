import type { HTMLElement } from "node-html-parser";
import type { ComicItem } from "../../models/comic-item";
import type { ComicDetail } from "../../models/comic-detail";
import type { ReadChapter } from "../../models/read-chapter";
import type { Genre } from "../../models/genre";
import type { Chapter } from "../../models/chapter";
import { ComicParser } from "../parser-base";
import { ResultCache } from "../../utils/cache";
import { HttpClient } from "../../utils/http-client";

export class KomikuParser extends ComicParser {
  private static readonly BASE_URL = "https://komiku.org";
  private static readonly API_URL = "https://api.komiku.org";
  private static readonly MAIN_URL = "https://komiku.org";

  private client: HttpClient;
  private listCache = new ResultCache<ComicItem[]>();

  private static readonly HEADERS: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Referer: "https://komiku.org",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
  };

  constructor() {
    super();
    this.client = new HttpClient({
      baseUrl: KomikuParser.BASE_URL,
      headers: KomikuParser.HEADERS,
    });
  }

  get sourceName(): string {
    return "Komiku";
  }
  get baseUrl(): string {
    return KomikuParser.BASE_URL;
  }
  get language(): string {
    return "ID";
  }

  private trimKomikuHref(href: string): string {
    href = href.trim();
    href = href.replace(
      /https?:\/\/(www\.)?(api\.)?komiku\.(org|co\.id|id|com)/g,
      "",
    );
    if (href.startsWith("/manga/")) href = href.substring(7);
    if (!href.startsWith("/")) href = `/${href}`;
    return href;
  }

  private cleanThumbnailUrl(thumb: string): string {
    thumb = thumb.trim();
    if (thumb.includes("?resize")) thumb = thumb.split("?")[0];
    return thumb;
  }

  private extractType(type: string): string {
    type = type.trim();
    if (type.toLowerCase().includes("manga")) return "Manga";
    if (type.toLowerCase().includes("manhwa")) return "Manhwa";
    if (type.toLowerCase().includes("manhua")) return "Manhua";
    return type;
  }

  private extractRating(rating: string): string {
    return rating
      .replace(/\s*Pembaca/gi, "")
      .replace(/\s*\|?\s*Warna/gi, "")
      .replace(/\s*\|?\s*Berwarna/gi, "")
      .replace(/\s*\|?\s*Ber(\s|$)/gi, "")
      .replace(/\d+\s+(detik|menit|jam|hari|minggu|bulan|tahun)\s+lalu/gi, "")
      .replace(/Kemarin/gi, "")
      .replace(/\|/g, "")
      .trim();
  }

  private parseComicList(doc: HTMLElement): ComicItem[] {
    const items: ComicItem[] = [];

    if (
      doc.querySelector('svg.fa-korvue, svg[data-icon="korvue"], .fa-korvue')
    ) {
      console.log("KomikuParser: Page returned 'Not Found' indicator.");
      return items;
    }

    const elements = doc.querySelectorAll(".bge");
    console.log(`KomikuParser: Found ${elements.length} comic elements`);

    for (const e of elements) {
      try {
        const title = e.querySelector(".kan h3")?.text.trim() ?? "";
        const hrefRaw = e.querySelector(".bgei a")?.getAttribute("href") ?? "";
        const thumbnail =
          e.querySelector(".bgei img")?.getAttribute("src") ?? "";
        const typeRaw = e.querySelector(".tpe1_inf")?.text.trim() ?? "";
        const ratingRaw = e.querySelector(".kan .judul2")?.text.trim() ?? "";

        let latest = "";
        const newElements = e.querySelectorAll(".new1");
        if (newElements.length > 0) {
          const lastNew = newElements[newElements.length - 1];
          const spans = lastNew.querySelectorAll("a span");
          if (spans.length >= 2) latest = spans[1].text.trim();
          if (!latest) latest = lastNew.querySelector("a")?.text.trim() ?? "";
        }

        if (title) {
          items.push({
            title,
            href: this.trimKomikuHref(hrefRaw),
            thumbnail: this.cleanThumbnailUrl(thumbnail),
            type: this.extractType(typeRaw) || undefined,
            chapter: latest || undefined,
            rating: this.extractRating(ratingRaw) || undefined,
          });
        }
      } catch {
        continue;
      }
    }
    return items;
  }

  async fetchRecommended(): Promise<ComicItem[]> {
    const cacheKey = "recommended";
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const url = `${KomikuParser.API_URL}/manga/page/1/?orderby=modified&tipe&genre&genre2&status`;
    console.log(`KomikuParser: Fetching Recommended ${url}`);
    const doc = await this.client.getHtml(url);
    const results = this.parseComicList(doc);
    if (results.length > 0) this.listCache.set(cacheKey, results);
    return results;
  }

  async fetchPopular(): Promise<ComicItem[]> {
    const cacheKey = "popular";
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const url = `${KomikuParser.API_URL}/manga/page/1/?orderby=meta_value_num&tipe&genre&genre2&status`;
    console.log(`KomikuParser: Fetching Popular ${url}`);
    const doc = await this.client.getHtml(url);
    const results = this.parseComicList(doc);
    if (results.length > 0) this.listCache.set(cacheKey, results);
    return results;
  }

  async fetchNewest(page: number = 1): Promise<ComicItem[]> {
    const cacheKey = `newest-${page}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const url = `${KomikuParser.API_URL}/manga/page/${page}/?orderby=date&tipe&genre&genre2&status`;
    console.log(`KomikuParser: Fetching Newest ${url}`);
    const doc = await this.client.getHtml(url);
    const results = this.parseComicList(doc);

    if (results.length === 0) throw new Error("Page not found or empty");
    this.listCache.set(cacheKey, results);
    return results;
  }

  async search(query: string): Promise<ComicItem[]> {
    const encodedQuery = encodeURIComponent(query);
    const cacheKey = `search-${encodedQuery}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const url = `${KomikuParser.API_URL}/?post_type=manga&s=${encodedQuery}`;
    console.log(`KomikuParser: Searching ${url}`);
    const doc = await this.client.getHtml(url);
    const results = this.parseComicList(doc);
    this.listCache.set(cacheKey, results);
    return results;
  }

  async fetchByGenre(genre: string, page: number = 1): Promise<ComicItem[]> {
    const cacheKey = `genre-${genre}-${page}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const url = `${KomikuParser.API_URL}/manga/page/${page}/?orderby=rand&tipe&genre=${genre}&genre2&status`;
    console.log(`KomikuParser: Fetching Genre ${url}`);
    const doc = await this.client.getHtml(url);
    const results = this.parseComicList(doc);
    this.listCache.set(cacheKey, results);
    return results;
  }

  async fetchAll(page: number = 1): Promise<ComicItem[]> {
    return this.fetchNewest(page);
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
    const {
      page = 1,
      genre = "",
      status = "",
      type = "",
      order = "",
    } = options;

    const url = `${KomikuParser.API_URL}/manga/page/${page}/?orderby=${order}&tipe=${type}&genre=${genre}&genre2&status=${status}`;
    console.log(`KomikuParser: Filtered URL ${url}`);
    const doc = await this.client.getHtml(url);
    return this.parseComicList(doc);
  }

  async fetchGenres(): Promise<Genre[]> {
    const doc = await this.client.getHtml(`${KomikuParser.MAIN_URL}/pustaka/`);
    const validGenres: Genre[] = [];
    const options = doc.querySelectorAll("select[name='genre'] option");
    for (const opt of options) {
      const val = opt.getAttribute("value")?.trim() ?? "";
      if (!val) continue;
      let text = opt.text.trim();
      if (text.includes(" ("))
        text = text.substring(0, text.indexOf(" (")).trim();
      validGenres.push({ title: text, href: `/${val}/` });
    }
    return validGenres;
  }

  async fetchDetail(href: string): Promise<ComicDetail> {
    if (!href) throw new Error("href is required");
    let cleanHref = href;
    if (cleanHref.startsWith("/")) cleanHref = cleanHref.substring(1);

    const visitUrl = `${KomikuParser.MAIN_URL}/manga/${cleanHref}`;
    console.log(`KomikuParser: Fetching detail ${visitUrl}`);
    const doc = await this.client.getHtml(visitUrl);

    const mainPerapih = doc.querySelector("main.perapih");
    if (!mainPerapih) throw new Error("Failed to parse detail page structure");

    let title =
      mainPerapih.querySelector("#Judul header h1")?.text.trim() ?? "";
    if (!title)
      title = mainPerapih.querySelector("article header h1")?.text.trim() ?? "";
    if (title.startsWith("Komik ")) title = title.substring(6).trim();

    let altTitle =
      mainPerapih.querySelector("#Judul header p.j2")?.text.trim() ?? "";
    if (!altTitle)
      altTitle =
        mainPerapih.querySelector("article header p.j2")?.text.trim() ?? "";

    let thumb =
      mainPerapih.querySelector("#Informasi .ims img")?.getAttribute("src") ??
      "";
    if (!thumb)
      thumb =
        mainPerapih
          .querySelector(".mobile .btn-bookmark")
          ?.getAttribute("data-series-cover") ?? "";
    if (!thumb)
      thumb = mainPerapih.querySelector("img.sd")?.getAttribute("src") ?? "";
    thumb = this.cleanThumbnailUrl(thumb);

    let desc = "";
    const judulP = mainPerapih.querySelectorAll("#Judul > p");
    for (const p of judulP) {
      if (!p.classNames.includes("j2") && !p.classNames.includes("new1")) {
        const text = p.text.trim();
        if (text && !desc) desc = text;
      }
    }
    if (!desc)
      desc = mainPerapih.querySelector("#Sinopsis p.desc")?.text.trim() ?? "";
    if (!desc) desc = mainPerapih.querySelector("p.desc")?.text.trim() ?? "";

    let type = "",
      author = "",
      status = "",
      released = "";

    const tableRows = mainPerapih.querySelectorAll(
      "#Informasi table.inftable tr",
    );
    for (const row of tableRows) {
      const tds = row.querySelectorAll("td");
      if (tds.length >= 2) {
        const k = tds[0].text.trim().toLowerCase();
        const v = tds[1].text.trim();
        switch (k) {
          case "jenis komik":
            type = this.extractType(v);
            break;
          case "pengarang":
            author = v;
            break;
          case "status":
            status = v;
            break;
          case "judul indonesia":
            if (!altTitle) altTitle = v;
            break;
          case "released":
          case "rilis":
          case "tanggal":
            if (!released) released = v;
            break;
        }
      }
    }

    let latestChapter = "";
    for (const el of mainPerapih.querySelectorAll("#Judul .new1")) {
      if (el.text.includes("Terbaru")) {
        const spans = el.querySelectorAll("a span");
        if (spans.length >= 2) {
          latestChapter = spans[1].text.trim();
        } else {
          const parts = el.text.split(":");
          if (parts.length > 1) latestChapter = parts[1].trim();
        }
      }
    }

    const genres: Genre[] = [];
    for (const a of mainPerapih.querySelectorAll(
      "#Informasi ul.genre li.genre a",
    )) {
      const gTitle = a.querySelector("span")?.text.trim() ?? "";
      let gHref = a.getAttribute("href") ?? "";
      gHref = gHref
        .trim()
        .replace(/https?:\/\/(www\.)?(api\.)?komiku\.(org|co\.id)/g, "");
      gHref = gHref.replace(/\/genre\//g, "");
      if (!gHref.startsWith("/")) gHref = `/${gHref}`;
      if (!gHref.endsWith("/")) gHref = `${gHref}/`;
      if (gTitle) genres.push({ title: gTitle, href: gHref });
    }

    const chapters: Chapter[] = [];
    for (const row of mainPerapih.querySelectorAll(
      "#Daftar_Chapter tbody tr",
    )) {
      if (row.querySelector("th")) continue;
      const a = row.querySelector("td.judulseries a");
      if (!a) continue;
      let cTitle = a.querySelector("span")?.text.trim() ?? "";
      if (!cTitle) cTitle = a.text.trim();
      let chHref = a.getAttribute("href")?.trim() ?? "";
      if (!chHref) continue;
      chHref = chHref.replace(
        /https?:\/\/(www\.)?(api\.)?komiku\.(org|co\.id)/g,
        "",
      );
      if (chHref.startsWith("/")) chHref = chHref.substring(1);
      const date = row.querySelector("td.tanggalseries")?.text.trim() ?? "";
      chapters.push({ title: cTitle, href: chHref, date });
    }

    let rating = "";
    let ratingText = doc.querySelector(".vw")?.text.trim() ?? "";
    if (!ratingText)
      ratingText = doc.querySelector("td.pembaca i")?.text.trim() ?? "";
    if (ratingText) rating = this.extractRating(ratingText);

    return {
      href,
      title,
      altTitle,
      thumbnail: thumb,
      description: desc,
      status,
      type,
      released,
      author,
      updatedOn: "",
      rating,
      latestChapter: latestChapter || undefined,
      genres,
      chapters,
    };
  }

  async fetchChapter(href: string): Promise<ReadChapter> {
    if (!href) throw new Error("href is required");

    let prevTemp: string;
    if (
      href.endsWith("chapter-1") ||
      href.endsWith("chapter-01") ||
      href.endsWith("chapter-01-1")
    ) {
      prevTemp = "";
    } else {
      prevTemp = `/${href}/`;
    }

    let cleanHref = href;
    if (cleanHref.startsWith("/")) cleanHref = cleanHref.substring(1);

    const visitUrl = `${KomikuParser.MAIN_URL}/${cleanHref}`;
    console.log(`KomikuParser: Reading chapter ${visitUrl}`);
    const doc = await this.client.getHtml(visitUrl);

    let title = doc.querySelector("#Judul header h1")?.text.trim() ?? "";

    const panels: string[] = [];
    for (const img of doc.querySelectorAll("#Baca_Komik img.ww")) {
      let src = img.getAttribute("data-src") ?? "";
      if (!src) src = img.getAttribute("src") ?? "";
      if (src) {
        src = src.trim().replace("cdn1.komiku.org", "img.komiku.org");
        if (this.isValidImageUrl(src)) panels.push(src);
      }
    }

    if (panels.length === 0) throw new Error("No images found in chapter");

    let nextLink =
      doc.querySelector(".pagination a.next")?.getAttribute("href") ?? "";
    if (!nextLink)
      nextLink = doc.querySelector("a.buttnext")?.getAttribute("href") ?? "";
    if (nextLink) {
      nextLink = nextLink.replace(
        /https?:\/\/(www\.)?(api\.)?komiku\.(org|co\.id)/g,
        "",
      );
      if (nextLink.startsWith("/")) nextLink = nextLink.substring(1);
    }

    let prevLink = this.constructPrevLink(prevTemp);
    if (!prevLink && href.includes("chapter-")) {
      prevLink =
        doc.querySelector(".pagination a.prev")?.getAttribute("href") ?? "";
      if (!prevLink)
        prevLink = doc.querySelector("a.buttprev")?.getAttribute("href") ?? "";
      if (prevLink) {
        prevLink = prevLink.replace(
          /https?:\/\/(www\.)?(api\.)?komiku\.(org|co\.id)/g,
          "",
        );
        if (prevLink.startsWith("/")) prevLink = prevLink.substring(1);
      }
    }

    if (!title) title = this.generateTitleFromHref(href);

    return { title, prev: prevLink, next: nextLink.trim(), panel: panels };
  }

  private constructPrevLink(currentHref: string): string {
    if (!currentHref) return "";
    const re = /(chapte(?:r)?[-/])(\d+)(?:[-](\d+))?/;
    const match = re.exec(currentHref);
    if (!match) return "";

    const prefix = match[1];
    const majorStr = match[2];
    const minorStr = match[3];
    let newChapterPart: string;

    if (minorStr) {
      const minorNum = parseInt(minorStr, 10) || 0;
      const prevMinorNum = minorNum - 1;
      if (prevMinorNum > 0) {
        const paddedPrevMinor = String(prevMinorNum).padStart(
          minorStr.length,
          "0",
        );
        newChapterPart = `${prefix}${majorStr}-${paddedPrevMinor}`;
      } else {
        newChapterPart = `${prefix}${majorStr}`;
      }
    } else {
      const majorNum = parseInt(majorStr, 10) || 0;
      const prevMajorNum = majorNum - 1;
      if (prevMajorNum <= 0) return "";
      const paddedPrevMajor = String(prevMajorNum).padStart(
        majorStr.length,
        "0",
      );
      newChapterPart = `${prefix}${paddedPrevMajor}`;
    }

    let result = currentHref.replace(match[0], newChapterPart);
    if (result.startsWith("/")) result = result.substring(1);
    return result;
  }

  private isValidImageUrl(url: string): boolean {
    const validDomains = [
      "img.komiku.org",
      "gambar-id.komiku.org",
      "cdn.komiku.org",
      "cdn1.komiku.org",
    ];
    return validDomains.some((domain) => url.includes(domain));
  }

  private generateTitleFromHref(href: string): string {
    let url = href;
    if (url.endsWith("/")) url = url.slice(0, -1);
    if (url.startsWith("/")) url = url.substring(1);
    const parts = url.split("-");
    const titleParts: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.toLowerCase() === "chapter") {
        titleParts.push("Chapter");
        if (i + 1 < parts.length) titleParts.push(parts[i + 1]);
        break;
      }
      if (part) titleParts.push(part[0].toUpperCase() + part.substring(1));
    }
    return titleParts.join(" ");
  }

  clearCache(): void {
    this.listCache.clear();
  }

  dispose(): void {
    this.clearCache();
  }
}
