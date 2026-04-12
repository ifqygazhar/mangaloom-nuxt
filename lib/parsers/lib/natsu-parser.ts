import type { HTMLElement } from 'node-html-parser';
import type { ComicItem } from '../../models/comic-item';
import type { ComicDetail } from '../../models/comic-detail';
import type { ReadChapter } from '../../models/read-chapter';
import type { Genre } from '../../models/genre';
import type { Chapter } from '../../models/chapter';
import { ComicParser } from '../parser-base';
import { ResultCache } from '../../utils/cache';
import { HttpClient } from '../../utils/http-client';

/**
 * Base parser for NatsuId WordPress theme.
 * Theme: https://themesinfo.com/natsu_id-theme-wordpress-c8x1c
 * Author: Dzul Qurnain
 *
 * This is an abstract class that handles the common logic for all
 * Natsu-based manga sites. Subclasses only need to provide `domain`,
 * `sourceName`, and `language`, and optionally override specific methods.
 */
export abstract class NatsuParser extends ComicParser {
  protected client: HttpClient;
  private listCache = new ResultCache<ComicItem[]>();

  /** Cached nonce for advanced search requests */
  private nonce: string | null = null;

  constructor() {
    super();
    this.client = new HttpClient({
      baseUrl: `https://${this.domain}`,
      headers: this.headers,
    });
  }

  // ── Abstract getters (must be provided by subclasses) ──────────

  /** The domain of the site (e.g. "kiryuu03.com") */
  abstract get domain(): string;

  // ── Common headers ─────────────────────────────────────────────

  protected get headers(): Record<string, string> {
    return {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Referer': `https://${this.domain}/`,
      'Origin': `https://${this.domain}`,
    };
  }

  // ── URL helpers ────────────────────────────────────────────────

  get baseUrl(): string {
    return `https://${this.domain}`;
  }

  toAbsoluteUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('/')) return `https://${this.domain}${url}`;
    return `https://${this.domain}/${url}`;
  }

  toRelativeUrl(url: string): string {
    const domainVariants = [`https://${this.domain}`, `http://${this.domain}`];
    for (const prefix of domainVariants) {
      if (url.startsWith(prefix)) {
        url = url.substring(prefix.length);
        break;
      }
    }
    if (url.startsWith('http')) {
      const parsed = new URL(url);
      url = parsed.pathname;
      if (parsed.search) url = `${url}${parsed.search}`;
    }
    if (!url.startsWith('/')) url = `/${url}`;
    return url;
  }

  /** Extracts the bare slug from a genre path. */
  private extractSlug(genre: string): string {
    return genre
      .replace(/^.*\/genre\//, '')
      .replace(/^\//, '')
      .replace(/\/$/, '');
  }

  // ── Cache helpers ──────────────────────────────────────────────

  private isCacheValid(key: string): boolean {
    return this.listCache.isValid(key);
  }

  private getFromCache(key: string): ComicItem[] | undefined {
    return this.listCache.get(key);
  }

  private saveToCache(key: string, items: ComicItem[]): void {
    this.listCache.set(key, items);
  }

  // ── Nonce ──────────────────────────────────────────────────────

  private async getNonce(): Promise<string> {
    if (this.nonce) return this.nonce;

    const url = `https://${this.domain}/wp-admin/admin-ajax.php?type=search_form&action=get_nonce`;
    const doc = await this.client.getHtml(url);

    const nonceValue = doc.querySelector('input[name="search_nonce"]')?.getAttribute('value') ?? '';
    if (!nonceValue) throw new Error('Nonce not found in response');

    this.nonce = nonceValue;
    return this.nonce;
  }

  // ── Core advanced search ───────────────────────────────────────

  private async advancedSearch(options: {
    page?: number;
    orderby?: string;
    query?: string;
    genres?: string[];
    genresExclude?: string[];
    status?: string;
    type?: string;
  } = {}): Promise<ComicItem[]> {
    const {
      page = 1,
      orderby = 'popular',
      query,
      genres,
      genresExclude,
      status,
      type,
    } = options;

    const url = `https://${this.domain}/wp-admin/admin-ajax.php?action=advanced_search`;
    const nonce = await this.getNonce();

    const form: Record<string, string> = {};
    form['nonce'] = nonce;

    // Genre inclusion
    form['inclusion'] = 'OR';
    if (genres && genres.length > 0) {
      form['genre'] = JSON.stringify(genres.map((g) => this.extractSlug(g)));
    } else {
      form['genre'] = '[]';
    }

    // Genre exclusion
    form['exclusion'] = 'OR';
    if (genresExclude && genresExclude.length > 0) {
      form['genre_exclude'] = JSON.stringify(genresExclude.map((g) => this.extractSlug(g)));
    } else {
      form['genre_exclude'] = '[]';
    }

    form['page'] = page.toString();
    form['author'] = '[]';
    form['artist'] = '[]';
    form['project'] = '0';

    // Type filter
    if (type) {
      const typeList: string[] = [];
      switch (type.toLowerCase()) {
        case 'manga': typeList.push('manga'); break;
        case 'manhwa': typeList.push('manhwa'); break;
        case 'manhua': typeList.push('manhua'); break;
        case 'comic': case 'comics': typeList.push('comic'); break;
        case 'novel': typeList.push('novel'); break;
        default: typeList.push(type.toLowerCase());
      }
      form['type'] = JSON.stringify(typeList);
    } else {
      form['type'] = '[]';
    }

    // Status filter
    if (status) {
      const statusList: string[] = [];
      switch (status.toLowerCase()) {
        case 'ongoing': statusList.push('ongoing'); break;
        case 'completed': statusList.push('completed'); break;
        case 'hiatus': case 'on-hiatus': statusList.push('on-hiatus'); break;
        default: statusList.push(status.toLowerCase());
      }
      form['status'] = JSON.stringify(statusList);
    } else {
      form['status'] = '[]';
    }

    form['order'] = 'desc';
    form['orderby'] = orderby;

    if (query) form['query'] = query;

    const doc = await this.client.postMultipart(url, form);
    return this.parseMangaList(doc);
  }

  // ── Parse manga list ──────────────────────────────────────────

  parseMangaList(doc: HTMLElement): ComicItem[] {
    const items: ComicItem[] = [];
    const divElements = doc.querySelectorAll('body > div');

    for (const div of divElements) {
      try {
        const mainLink = div.querySelector('a[href*="/manga/"]');
        if (!mainLink) continue;

        const href = this.toRelativeUrl(mainLink.getAttribute('href') ?? '');
        if (href.includes('/chapter-')) continue;

        const titleEl = div.querySelector('a.text-base')
          ?? div.querySelector('a.text-white')
          ?? div.querySelector('h1');

        let title = titleEl?.text.trim() ?? '';
        if (!title) title = mainLink.getAttribute('title')?.trim() ?? '';
        if (!title) title = mainLink.text.trim();
        if (!title) continue;

        const imgEl = div.querySelector('img');
        let thumbnail = imgEl?.getAttribute('src')
          ?? imgEl?.getAttribute('data-src')
          ?? imgEl?.getAttribute('data-lazy-src')
          ?? '';
        if (thumbnail) thumbnail = this.toAbsoluteUrl(thumbnail);

        const ratingEl = div.querySelector('.numscore')
          ?? div.querySelector('span.text-yellow-400');
        let rating: string | undefined;
        if (ratingEl) {
          const ratingText = ratingEl.text.trim();
          if (!isNaN(parseFloat(ratingText))) rating = ratingText;
        }

        let stateEl = div.querySelector('span.bg-accent');
        if (!stateEl) {
          for (const p of div.querySelectorAll('p')) {
            const pText = p.text.toLowerCase();
            if (pText.includes('ongoing') || pText.includes('completed') || pText.includes('hiatus')) {
              stateEl = p;
              break;
            }
          }
        }

        let comicType: string | undefined;
        if (stateEl) {
          const stateText = stateEl.text.toLowerCase();
          if (stateText.includes('ongoing')) comicType = 'Ongoing';
          else if (stateText.includes('completed')) comicType = 'Completed';
          else if (stateText.includes('hiatus')) comicType = 'Hiatus';
        }

        items.push({ title, href, thumbnail, rating, type: comicType });
      } catch {
        continue;
      }
    }

    return items;
  }

  // ── ComicParser interface ──────────────────────────────────────

  async fetchPopular(): Promise<ComicItem[]> {
    const cacheKey = 'natsu-popular-1';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;
    const results = await this.advancedSearch({ page: 1, orderby: 'popular' });
    this.saveToCache(cacheKey, results);
    return results;
  }

  async fetchRecommended(): Promise<ComicItem[]> {
    const cacheKey = 'natsu-recommended-1';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;
    const results = await this.advancedSearch({ page: 1, orderby: 'rating' });
    this.saveToCache(cacheKey, results);
    return results;
  }

  async fetchNewest(page: number = 1): Promise<ComicItem[]> {
    const cacheKey = `natsu-newest-${page}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;
    const results = await this.advancedSearch({ page, orderby: 'updated' });
    if (results.length === 0) throw new Error('Page not found');
    this.saveToCache(cacheKey, results);
    return results;
  }

  async fetchAll(page: number = 1): Promise<ComicItem[]> {
    const cacheKey = `natsu-all-${page}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;
    const results = await this.advancedSearch({ page, orderby: 'title' });
    if (results.length === 0) throw new Error('Page not found');
    this.saveToCache(cacheKey, results);
    return results;
  }

  async search(query: string): Promise<ComicItem[]> {
    const encodedQuery = encodeURIComponent(query);
    const cacheKey = `natsu-search-${encodedQuery}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;
    const results = await this.advancedSearch({ page: 1, query });
    if (results.length === 0) throw new Error('No results found');
    this.saveToCache(cacheKey, results);
    return results;
  }

  async fetchByGenre(genre: string, page: number = 1): Promise<ComicItem[]> {
    const cacheKey = `natsu-genre-${genre}-${page}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;
    const results = await this.advancedSearch({ page, genres: [genre], orderby: 'popular' });
    if (results.length === 0) throw new Error('No results found');
    this.saveToCache(cacheKey, results);
    return results;
  }

  async fetchFiltered(options: {
    page?: number;
    genre?: string;
    status?: string;
    type?: string;
    order?: string;
  } = {}): Promise<ComicItem[]> {
    const { page = 1, genre, status, type, order } = options;
    const cacheKey = `natsu-filtered-${page}-${genre}-${status}-${type}-${order}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    let orderby: string;
    switch (order?.toLowerCase()) {
      case 'popular': case 'popularity': orderby = 'popular'; break;
      case 'latest': case 'updated': orderby = 'updated'; break;
      case 'rating': orderby = 'rating'; break;
      case 'title': case 'alphabetical': orderby = 'title'; break;
      default: orderby = 'popular';
    }

    const results = await this.advancedSearch({
      page,
      orderby,
      genres: genre ? [genre] : undefined,
      status,
      type,
    });
    if (results.length === 0) throw new Error('No results found');
    this.saveToCache(cacheKey, results);
    return results;
  }

  // ── Genres ─────────────────────────────────────────────────────

  async fetchGenres(): Promise<Genre[]> {
    try {
      const url = `https://${this.domain}/wp-json/wp/v2/genre?per_page=100&page=1&orderby=count&order=desc`;
      const response = await fetch(url, { headers: this.headers });

      if (response.ok) {
        const jsonArray = (await response.json()) as Record<string, unknown>[];
        const genres: Genre[] = [];

        for (const item of jsonArray) {
          const slug = (item['slug'] as string)?.trim() ?? '';
          const name = (item['name'] as string)?.trim() ?? '';
          if (!slug || !name) continue;
          genres.push({ title: this.toTitleCase(name), href: `/${slug}/` });
        }

        if (genres.length > 0) return genres;
      }
    } catch {
      // Fallback below
    }

    // Fallback: scrape /advanced-search/ page
    try {
      const url = `https://${this.domain}/advanced-search/`;
      const doc = await this.client.getHtml(url);
      const scripts = doc.querySelectorAll('script');

      let scriptData: string | null = null;
      for (const script of scripts) {
        if (script.text.includes('var searchTerms')) {
          scriptData = script.text;
          break;
        }
      }

      if (!scriptData) return [];

      const startIdx = scriptData.indexOf('var searchTerms =') + 'var searchTerms ='.length;
      const jsonString = scriptData.substring(startIdx).trim();
      const endIdx = jsonString.lastIndexOf(';');
      const cleanJson = endIdx > 0 ? jsonString.substring(0, endIdx) : jsonString;

      const json = JSON.parse(cleanJson) as Record<string, unknown>;
      const genreObject = json['genre'] as Record<string, Record<string, unknown>> | undefined;
      if (!genreObject) return [];

      const genres: Genre[] = [];
      for (const entry of Object.values(genreObject)) {
        const taxonomy = (entry['taxonomy'] as string) ?? '';
        if (taxonomy !== 'genre') continue;
        const slug = (entry['slug'] as string)?.trim() ?? '';
        const name = (entry['name'] as string)?.trim() ?? '';
        if (!slug || !name) continue;
        genres.push({ title: this.toTitleCase(name), href: `/${slug}/` });
      }

      return genres;
    } catch {
      return [];
    }
  }

  // ── Detail ─────────────────────────────────────────────────────

  async fetchDetail(href: string): Promise<ComicDetail> {
    if (!href) throw new Error('href is required');

    const absUrl = this.toAbsoluteUrl(href);
    const doc = await this.client.getHtml(absUrl);

    // Manga ID for chapter loading
    let mangaId = '';

    const hxEl = doc.querySelector('[hx-get*="manga_id="]');
    if (hxEl) {
      const hxGet = hxEl.getAttribute('hx-get') ?? '';
      const match = /manga_id=([^&]+)/.exec(hxGet);
      if (match) mangaId = match[1]?.trim() ?? '';
    }

    if (!mangaId) {
      const idEl = doc.querySelector('input#manga_id, [data-manga-id]');
      if (idEl) {
        mangaId = idEl.getAttribute('value')?.trim() ?? '';
        if (!mangaId) mangaId = idEl.getAttribute('data-manga-id')?.trim() ?? '';
      }
    }

    if (!mangaId) {
      const match = /\/manga\/([^/]+)/.exec(href);
      if (match) mangaId = match[1] ?? '';
    }

    // Title
    const titleEl = doc.querySelector('h1[itemprop="name"]');
    const title = titleEl?.text.trim() ?? '';

    // Alt title
    let altTitle = '';
    if (titleEl?.nextElementSibling) {
      altTitle = titleEl.nextElementSibling.text.trim();
    }

    // Description
    const descEls = doc.querySelectorAll('div[itemprop="description"]');
    const description = descEls.map((e) => e.text.trim()).filter(Boolean).join('\n\n');

    // Cover
    let thumbnail = doc.querySelector('div[itemprop="image"] > img')?.getAttribute('src') ?? '';
    if (!thumbnail) thumbnail = doc.querySelector('div[itemprop="image"] > img')?.getAttribute('data-src') ?? '';
    if (thumbnail) thumbnail = this.toAbsoluteUrl(thumbnail);

    // Genres
    const genreEls = doc.querySelectorAll('a[itemprop="genre"]');
    const genres: Genre[] = [];
    for (const a of genreEls) {
      const genreHref = a.getAttribute('href') ?? '';
      const slug = genreHref.replace(/.*\/genre\//, '').replace(/\/$/, '');
      const name = a.text.trim();
      if (slug && name) {
        genres.push({ title: this.toTitleCase(name), href: `/${slug}/` });
      }
    }

    // Info fields helper
    const findInfoText = (key: string): string | undefined => {
      const infoElements = doc.querySelectorAll('div.space-y-2 > .flex');
      for (const el of infoElements) {
        const h4 = el.querySelector('h4');
        if (h4 && h4.text.toLowerCase().includes(key.toLowerCase())) {
          return el.querySelector('p.font-normal')?.text.trim();
        }
      }
      return undefined;
    };

    // Status
    const stateText = (findInfoText('Status') ?? '').toLowerCase();
    let status: string;
    if (stateText.includes('ongoing')) status = 'Ongoing';
    else if (stateText.includes('completed')) status = 'Completed';
    else if (stateText.includes('hiatus')) status = 'Hiatus';
    else status = 'Unknown';

    const author = findInfoText('Author') ?? '';
    const typeText = findInfoText('Type') ?? '';
    const ratingText = doc.querySelector('.numscore, span.text-yellow-400')?.text.trim() ?? '';

    // Chapters
    const chapters = await this.loadChapters(mangaId, absUrl);

    return {
      href: this.toRelativeUrl(href),
      title: title || href,
      altTitle,
      thumbnail,
      description,
      status,
      type: typeText,
      released: '',
      author,
      updatedOn: '',
      rating: ratingText,
      latestChapter: chapters.length > 0 ? chapters[0].title : undefined,
      genres,
      chapters,
    };
  }

  // ── Load chapters (paginated AJAX) ─────────────────────────────

  private async loadChapters(mangaId: string, mangaAbsoluteUrl: string): Promise<Chapter[]> {
    const chapters: Chapter[] = [];

    const extraHeaders: Record<string, string> = {
      'HX-Request': 'true',
      'HX-Target': 'chapter-list',
      'HX-Trigger': 'chapter-list',
      'HX-Current-URL': mangaAbsoluteUrl,
      'Referer': mangaAbsoluteUrl,
    };

    for (let page = 1; page <= 50; page++) {
      const url = `https://${this.domain}/wp-admin/admin-ajax.php?manga_id=${mangaId}&page=${page}&action=chapter_list`;

      try {
        const response = await fetch(url, {
          headers: { ...this.headers, ...extraHeaders },
        });

        // HTTP 520 means no more pages
        if (response.status === 520) break;

        if (!response.ok) {
          throw new Error(`Failed to load chapters page ${page}: ${response.status}`);
        }

        const text = await response.text();
        const { parse } = await import('node-html-parser');
        const doc = parse(text);

        const chapterElements = doc.querySelectorAll('div#chapter-list > div[data-chapter-number]');
        if (chapterElements.length === 0) break;

        for (const element of chapterElements) {
          const a = element.querySelector('a');
          if (!a) continue;

          const href = this.toRelativeUrl(a.getAttribute('href') ?? '');
          if (!href) continue;

          const chapterTitle = element.querySelector('div.font-medium span')?.text.trim() ?? '';
          const dateStr = element.querySelector('time')?.text.trim() ?? '';
          const date = this.parseDate(dateStr);

          chapters.push({ title: chapterTitle, href, date });
        }
      } catch (e) {
        if (String(e).includes('520')) break;
        throw e;
      }
    }

    // Return in ascending order (oldest first)
    return chapters.reverse();
  }

  // ── Read chapter ───────────────────────────────────────────────

  async fetchChapter(href: string): Promise<ReadChapter> {
    if (!href) throw new Error('href is required');

    const chapterUrl = this.toAbsoluteUrl(href);
    const doc = await this.client.getHtml(chapterUrl);

    // Title
    let title = doc.querySelector('h1')?.text.trim() ?? '';
    if (!title) title = doc.querySelector('title')?.text.trim() ?? '';

    // Images — default selector for NatsuParser
    const panels = this.parseChapterImages(doc);
    if (panels.length === 0) throw new Error('No images found in chapter');

    // Prev / Next navigation
    let prev = '';
    let next = '';

    let prevLink = doc.querySelector('a[rel="prev"]') ?? doc.querySelector('a.prev');
    if (!prevLink) {
      for (const a of doc.querySelectorAll('a')) {
        if (a.text.toLowerCase().includes('prev')) { prevLink = a; break; }
      }
    }
    if (prevLink) prev = this.toRelativeUrl(prevLink.getAttribute('href') ?? '');

    let nextLink = doc.querySelector('a[rel="next"]') ?? doc.querySelector('a.next');
    if (!nextLink) {
      for (const a of doc.querySelectorAll('a')) {
        if (a.text.toLowerCase().includes('next')) { nextLink = a; break; }
      }
    }
    if (nextLink) next = this.toRelativeUrl(nextLink.getAttribute('href') ?? '');

    return { title, prev, next, panel: panels };
  }

  /** Parses chapter images. Subclasses can override to use different selectors. */
  parseChapterImages(doc: HTMLElement): string[] {
    const imgs = doc.querySelectorAll('main section section > img');
    const panels: string[] = [];

    for (const img of imgs) {
      const src = img.getAttribute('src')
        ?? img.getAttribute('data-src')
        ?? img.getAttribute('data-lazy-src')
        ?? '';
      if (src && !src.includes('data:image')) {
        panels.push(this.toAbsoluteUrl(src));
      }
    }

    return panels;
  }

  // ── Date parsing ───────────────────────────────────────────────

  private parseDate(dateStr: string | null): string {
    if (!dateStr) return '';

    try {
      if (dateStr.includes('ago')) {
        const match = /(\d+)/.exec(dateStr);
        const number = parseInt(match?.[1] ?? '0', 10);
        if (number === 0) return '';

        const now = new Date();
        let date: Date;

        if (dateStr.includes('min')) date = new Date(now.getTime() - number * 60000);
        else if (dateStr.includes('hour')) date = new Date(now.getTime() - number * 3600000);
        else if (dateStr.includes('day')) date = new Date(now.getTime() - number * 86400000);
        else if (dateStr.includes('week')) date = new Date(now.getTime() - number * 604800000);
        else if (dateStr.includes('month')) {
          date = new Date(now);
          date.setMonth(date.getMonth() - number);
        } else if (dateStr.includes('year')) {
          date = new Date(now);
          date.setFullYear(date.getFullYear() - number);
        } else {
          return dateStr;
        }

        return this.formatDate(date);
      }

      // Try "MMM dd, yyyy" format
      const months: Record<string, number> = {
        jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
        jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
      };

      const match = /(\w+)\s+(\d+),?\s+(\d{4})/.exec(dateStr);
      if (match) {
        const monthStr = match[1].toLowerCase().substring(0, 3);
        const day = parseInt(match[2], 10);
        const year = parseInt(match[3], 10);
        const month = months[monthStr] ?? 1;
        return this.formatDate(new Date(year, month - 1, day));
      }

      return dateStr;
    } catch {
      return dateStr;
    }
  }

  private formatDate(date: Date): string {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}, ${date.getFullYear()}`;
  }

  // ── String helpers ─────────────────────────────────────────────

  private toTitleCase(text: string): string {
    if (!text) return text;
    return text
      .split(' ')
      .map((word) => (word.length === 0 ? '' : word[0].toUpperCase() + word.substring(1).toLowerCase()))
      .join(' ');
  }

  // ── Batch helpers ──────────────────────────────────────────────

  async fetchMultipleLists(options: {
    popular?: boolean;
    recommended?: boolean;
    newest?: boolean;
    limit?: number;
  } = {}): Promise<Record<string, ComicItem[]>> {
    const { popular = false, recommended = false, newest = false, limit = 6 } = options;
    const results: Record<string, ComicItem[]> = {};
    const promises: Promise<void>[] = [];

    if (popular) promises.push(this.fetchPopular().then((items) => { results['popular'] = items.slice(0, limit); }));
    if (recommended) promises.push(this.fetchRecommended().then((items) => { results['recommended'] = items.slice(0, limit); }));
    if (newest) promises.push(this.fetchNewest().then((items) => { results['newest'] = items.slice(0, limit); }));

    await Promise.all(promises);
    return results;
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  clearCache(): void {
    this.listCache.clear();
    this.nonce = null;
  }

  dispose(): void {
    this.clearCache();
  }
}
