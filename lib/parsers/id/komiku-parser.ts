import * as cheerio from "cheerio";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ComicItem {
  title: string;
  href: string;
  thumbnail: string;
  type: string;
  chapter: string;
  rating: string;
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

export interface ComicDetail {
  href: string;
  title: string;
  altTitle: string;
  thumbnail: string;
  description: string;
  status: string;
  type: string;
  released: string;
  author: string;
  updatedOn: string;
  rating: string;
  latestChapter: string;
  genres: Genre[];
  chapters: Chapter[];
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

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE_URL = "https://komiku.org";
const API_URL = "https://api.komiku.org";
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: BASE_URL,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function trimKomikuHref(href: string): string {
  href = href.trim();
  href = href.replace(
    /https?:\/\/(www\.)?(api\.)?komiku\.(org|co\.id|id|com)/g,
    "",
  );
  if (href.startsWith("/manga/")) href = href.slice(7);
  if (!href.startsWith("/")) href = "/" + href;
  return href;
}

function cleanThumbnailUrl(thumb: string): string {
  thumb = thumb.trim();
  if (thumb.includes("?resize")) thumb = thumb.split("?")[0];
  return thumb;
}

function extractType(raw: string): string {
  const lower = raw.trim().toLowerCase();
  if (lower.includes("manga")) return "Manga";
  if (lower.includes("manhwa")) return "Manhwa";
  if (lower.includes("manhua")) return "Manhua";
  return raw.trim();
}

function extractRating(raw: string): string {
  return raw
    .replace(/\s*Pembaca/gi, "")
    .replace(/\s*\|?\s*Warna/gi, "")
    .replace(/\s*\|?\s*Berwarna/gi, "")
    .replace(/\s*\|?\s*Ber(\s|$)/gi, "")
    .replace(/\d+\s+(detik|menit|jam|hari|minggu|bulan|tahun)\s+lalu/gi, "")
    .replace(/Kemarin/gi, "")
    .replace(/\|/g, "")
    .trim();
}

function isValidImageUrl(url: string): boolean {
  const validDomains = [
    "img.komiku.org",
    "gambar-id.komiku.org",
    "cdn.komiku.org",
    "cdn1.komiku.org",
  ];
  return validDomains.some((d) => url.includes(d));
}

function cleanChapterHref(href: string): string {
  href = href.replace(/https?:\/\/(www\.)?(api\.)?komiku\.(org|co\.id)/g, "");
  if (href.startsWith("/")) href = href.slice(1);
  return href;
}

function constructPrevLink(currentHref: string): string {
  if (!currentHref) return "";

  const re = /(chapte(?:r)?[-/])(\d+)(?:[-](\d+))?/;
  const match = currentHref.match(re);
  if (!match) return "";

  const prefix = match[1];
  const majorStr = match[2];
  const minorStr = match[3];

  let newChapterPart: string;

  if (minorStr) {
    const minorNum = parseInt(minorStr, 10);
    const prevMinor = minorNum - 1;

    if (prevMinor > 0) {
      const paddedPrevMinor = String(prevMinor).padStart(minorStr.length, "0");
      newChapterPart = `${prefix}${majorStr}-${paddedPrevMinor}`;
    } else {
      newChapterPart = `${prefix}${majorStr}`;
    }
  } else {
    const majorNum = parseInt(majorStr, 10);
    const prevMajor = majorNum - 1;
    if (prevMajor <= 0) return "";
    const paddedPrevMajor = String(prevMajor).padStart(majorStr.length, "0");
    newChapterPart = `${prefix}${paddedPrevMajor}`;
  }

  let result = currentHref.replace(match[0], newChapterPart);
  if (result.startsWith("/")) result = result.slice(1);
  return result;
}

function generateTitleFromHref(href: string): string {
  let url = href;
  if (url.endsWith("/")) url = url.slice(0, -1);
  if (url.startsWith("/")) url = url.slice(1);

  const parts = url.split("-");
  const titleParts: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.toLowerCase() === "chapter") {
      titleParts.push("Chapter");
      if (i + 1 < parts.length) titleParts.push(parts[i + 1]);
      break;
    }
    if (part) titleParts.push(part[0].toUpperCase() + part.slice(1));
  }
  return titleParts.join(" ");
}

// ─── Parser ──────────────────────────────────────────────────────────────────

export class KomikuParser {
  readonly sourceName = "Komiku";
  readonly baseUrl = BASE_URL;
  readonly language = "ID";

  private readonly listCache = new Map<string, CachedResult>();

  // ── Cache helpers ──

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

  // ── Fetch helper ──

  private async fetchHtml(url: string): Promise<string> {
    const res = await fetch(url, { headers: DEFAULT_HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
  }

  // ── Parse comic list from HTML ──

  private parseComicList(html: string): ComicItem[] {
    const $ = cheerio.load(html);
    const items: ComicItem[] = [];

    // "Not Found" guard
    if ($("svg.fa-korvue, .fa-korvue").length > 0) return items;

    $(".bge").each((_, el) => {
      try {
        const title = $(el).find(".kan h3").text().trim();
        const hrefRaw = $(el).find(".bgei a").attr("href") ?? "";
        const thumbnail = $(el).find(".bgei img").attr("src") ?? "";
        const typeRaw = $(el).find(".tpe1_inf").text().trim();
        const ratingRaw = $(el).find(".kan .judul2").text().trim();

        // Latest chapter — last .new1 element
        let latest = "";
        const newEls = $(el).find(".new1");
        if (newEls.length > 0) {
          const lastNew = newEls.last();
          const spans = lastNew.find("a span");
          if (spans.length >= 2) {
            latest = $(spans[1]).text().trim();
          } else {
            latest = lastNew.find("a").text().trim();
          }
        }

        if (title) {
          items.push({
            title,
            href: trimKomikuHref(hrefRaw),
            thumbnail: cleanThumbnailUrl(thumbnail),
            type: extractType(typeRaw),
            chapter: latest,
            rating: extractRating(ratingRaw),
          });
        }
      } catch (err) {
        console.error("KomikuParser: Error parsing item", err);
      }
    });

    return items;
  }

  // ── Public API ──

  async fetchRecommended(): Promise<ComicItem[]> {
    const key = "recommended";
    const cached = this.getFromCache(key);
    if (cached) return cached;

    const url = `${API_URL}/manga/page/1/?orderby=modified&tipe&genre&genre2&status`;
    const html = await this.fetchHtml(url);
    const results = this.parseComicList(html);
    if (results.length > 0) this.saveToCache(key, results);
    return results;
  }

  async fetchPopular(): Promise<ComicItem[]> {
    const key = "popular";
    const cached = this.getFromCache(key);
    if (cached) return cached;

    const url = `${API_URL}/manga/page/1/?orderby=meta_value_num&tipe&genre&genre2&status`;
    const html = await this.fetchHtml(url);
    const results = this.parseComicList(html);
    if (results.length > 0) this.saveToCache(key, results);
    return results;
  }

  async fetchNewest(page = 1): Promise<ComicItem[]> {
    const key = `newest-${page}`;
    const cached = this.getFromCache(key);
    if (cached) return cached;

    const url = `${API_URL}/manga/page/${page}/?orderby=date&tipe&genre&genre2&status`;
    const html = await this.fetchHtml(url);
    const results = this.parseComicList(html);
    if (results.length === 0) throw new Error("Page not found or empty");
    this.saveToCache(key, results);
    return results;
  }

  async search(query: string): Promise<ComicItem[]> {
    const encoded = encodeURIComponent(query);
    const key = `search-${encoded}`;
    const cached = this.getFromCache(key);
    if (cached) return cached;

    const url = `${API_URL}/?post_type=manga&s=${encoded}`;
    const html = await this.fetchHtml(url);
    const results = this.parseComicList(html);
    this.saveToCache(key, results);
    return results;
  }

  async fetchByGenre(genre: string, page = 1): Promise<ComicItem[]> {
    const key = `genre-${genre}-${page}`;
    const cached = this.getFromCache(key);
    if (cached) return cached;

    const url = `${API_URL}/manga/page/${page}/?orderby=rand&tipe&genre=${genre}&genre2&status`;
    const html = await this.fetchHtml(url);
    const results = this.parseComicList(html);
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
    const { page = 1, genre = "", status = "", type = "", order = "" } = opts;
    const url = `${API_URL}/manga/page/${page}/?orderby=${order}&tipe=${type}&genre=${genre}&genre2&status=${status}`;
    const html = await this.fetchHtml(url);
    return this.parseComicList(html);
  }

  async fetchAll(page = 1): Promise<ComicItem[]> {
    return this.fetchNewest(page);
  }

  async fetchGenres(): Promise<Genre[]> {
    const url = `${BASE_URL}/pustaka/`;
    const html = await this.fetchHtml(url);
    const $ = cheerio.load(html);
    const genres: Genre[] = [];

    $("select[name='genre'] option").each((_, el) => {
      const val = $(el).attr("value")?.trim() ?? "";
      if (!val) return;
      let text = $(el).text().trim();
      if (text.includes(" (")) text = text.slice(0, text.indexOf(" (")).trim();
      genres.push({ title: text, href: `/${val}/` });
    });

    return genres;
  }

  async fetchDetail(href: string): Promise<ComicDetail> {
    if (!href) throw new Error("href is required");

    let cleanHref = href.startsWith("/") ? href.slice(1) : href;
    const url = `${BASE_URL}/manga/${cleanHref}`;
    const html = await this.fetchHtml(url);
    const $ = cheerio.load(html);

    const main = $("main.perapih");
    if (!main.length) throw new Error("Failed to parse detail page structure");

    // Title
    let title =
      main.find("#Judul header h1").text().trim() ||
      main.find("article header h1").text().trim();
    if (title.startsWith("Komik ")) title = title.slice(6).trim();

    // Alt title
    let altTitle =
      main.find("#Judul header p.j2").text().trim() ||
      main.find("article header p.j2").text().trim();

    // Thumbnail
    let thumb =
      main.find("#Informasi .ims img").attr("src") ||
      main.find(".mobile .btn-bookmark").attr("data-series-cover") ||
      main.find("img.sd").attr("src") ||
      "";
    thumb = cleanThumbnailUrl(thumb);

    // Description
    let desc = "";
    main.find("#Judul > p").each((_, el) => {
      const classes = $(el).attr("class") ?? "";
      if (!classes.includes("j2") && !classes.includes("new1") && !desc) {
        desc = $(el).text().trim();
      }
    });
    if (!desc) {
      desc =
        main.find("#Sinopsis p.desc").text().trim() ||
        main.find("p.desc").text().trim();
    }

    // Meta table
    let type = "",
      author = "",
      status = "",
      released = "";

    main.find("#Informasi table.inftable tr").each((_, row) => {
      const tds = $(row).find("td");
      if (tds.length < 2) return;
      const k = $(tds[0]).text().trim().toLowerCase();
      const v = $(tds[1]).text().trim();
      switch (k) {
        case "jenis komik":
          type = extractType(v);
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
    });

    // Latest chapter
    let latestChapter = "";
    main.find("#Judul .new1").each((_, el) => {
      if ($(el).text().includes("Terbaru") && !latestChapter) {
        const spans = $(el).find("a span");
        if (spans.length >= 2) {
          latestChapter = $(spans[1]).text().trim();
        } else {
          const parts = $(el).text().split(":");
          if (parts.length > 1) latestChapter = parts[1].trim();
        }
      }
    });

    // Genres
    const genres: Genre[] = [];
    main.find("#Informasi ul.genre li.genre a").each((_, el) => {
      const gTitle = $(el).find("span").text().trim();
      let gHref = ($(el).attr("href") ?? "").trim();
      gHref = gHref.replace(
        /https?:\/\/(www\.)?(api\.)?komiku\.(org|co\.id)/g,
        "",
      );
      gHref = gHref.replace("/genre/", "");
      if (!gHref.startsWith("/")) gHref = "/" + gHref;
      if (!gHref.endsWith("/")) gHref += "/";
      if (gTitle) genres.push({ title: gTitle, href: gHref });
    });

    // Chapters
    const chapters: Chapter[] = [];
    main.find("#Daftar_Chapter tbody tr").each((_, row) => {
      if ($(row).find("th").length > 0) return;
      const a = $(row).find("td.judulseries a");
      if (!a.length) return;

      let cTitle = a.find("span").text().trim() || a.text().trim();
      let chHref = (a.attr("href") ?? "").trim();
      if (!chHref) return;

      chHref = cleanChapterHref(chHref);
      const date = $(row).find("td.tanggalseries").text().trim();
      chapters.push({ title: cTitle, href: chHref, date });
    });

    // Rating
    let rating = "";
    const ratingText =
      $("td.pembaca i").text().trim() || $(".vw").text().trim();
    if (ratingText) rating = extractRating(ratingText);

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
      latestChapter,
      genres,
      chapters,
    };
  }

  async fetchChapter(href: string): Promise<ReadChapter> {
    if (!href) throw new Error("href is required");

    const isFirstChapter =
      href.endsWith("chapter-1") ||
      href.endsWith("chapter-01") ||
      href.endsWith("chapter-01-1");

    const prevTemp = isFirstChapter ? "" : `/${href}/`;

    let cleanHref = href.startsWith("/") ? href.slice(1) : href;
    const url = `${BASE_URL}/${cleanHref}`;
    const html = await this.fetchHtml(url);
    const $ = cheerio.load(html);

    const title = $("#Judul header h1").text().trim();

    // Images
    const panels: string[] = [];
    $("#Baca_Komik img.ww").each((_, img) => {
      let src = ($(img).attr("data-src") ?? $(img).attr("src") ?? "").trim();
      src = src.replace("cdn1.komiku.org", "img.komiku.org");
      if (src && isValidImageUrl(src)) panels.push(src);
    });

    if (panels.length === 0) throw new Error("No images found in chapter");

    // Next link
    let nextLink = (
      $(".pagination a.next").attr("href") ??
      $("a.buttnext").attr("href") ??
      ""
    ).trim();
    if (nextLink) nextLink = cleanChapterHref(nextLink);

    // Prev link
    let prevLink = constructPrevLink(prevTemp);
    if (!prevLink && href.includes("chapter-")) {
      prevLink = (
        $(".pagination a.prev").attr("href") ??
        $("a.buttprev").attr("href") ??
        ""
      ).trim();
      if (prevLink) prevLink = cleanChapterHref(prevLink);
    }

    return {
      title: title || generateTitleFromHref(href),
      prev: prevLink,
      next: nextLink,
      panel: panels,
    };
  }

  // ── Cache management ──

  clearCache(): void {
    this.listCache.clear();
  }

  dispose(): void {
    this.clearCache();
  }
}

// ─── Default export ───────────────────────────────────────────────────────────

export default KomikuParser;
