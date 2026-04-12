import type { HTMLElement } from 'node-html-parser';
import type { ComicItem } from '../../models/comic-item';
import type { ComicDetail } from '../../models/comic-detail';
import type { ReadChapter } from '../../models/read-chapter';
import type { Genre } from '../../models/genre';
import type { Chapter } from '../../models/chapter';
import { ComicParser } from '../parser-base';
import { ResultCache } from '../../utils/cache';
import { HttpClient } from '../../utils/http-client';

export class ComicSansParser extends ComicParser {
  private static readonly BASE_URL = 'https://lc4.cosmicscans.asia';
  private static readonly MANGA_PREFIX = `${ComicSansParser.BASE_URL}/manga`;
  private static readonly MAX_CONCURRENT_REQUESTS = 3;

  private client: HttpClient;
  private listCache = new ResultCache<ComicItem[]>();

  constructor() {
    super();
    this.client = new HttpClient({ baseUrl: ComicSansParser.BASE_URL });
  }

  get sourceName(): string { return 'ComicSans'; }
  get baseUrl(): string { return ComicSansParser.BASE_URL; }
  get language(): string { return 'ID'; }

  /** Helper to parse comic items from HTML */
  private parseComicItems(doc: HTMLElement, prefix: string): ComicItem[] {
    const items: ComicItem[] = [];
    const elements = doc.querySelectorAll('.listupd .bsx a');

    for (const el of elements) {
      const href = el.getAttribute('href')?.trim() ?? '';
      let title = el.querySelector('.bigor .tt')?.text.trim() ?? '';
      if (!title) title = el.getAttribute('title')?.trim() ?? '';
      const thumbnail = el.querySelector('.limit img')?.getAttribute('src')?.trim() ?? '';
      const type = el.querySelector('.limit .type')?.text.trim() ?? '';
      const chapter = el.querySelector('.epxs')?.text.trim() ?? '';
      const rating = el.querySelector('.numscore')?.text.trim() ?? '';

      if (href && title) {
        items.push({
          title,
          href: this.trimPrefix(href, prefix),
          thumbnail,
          type: type || undefined,
          chapter: chapter || undefined,
          rating: rating || undefined,
        });
      }
    }

    return items;
  }

  /** Helper to trim URL prefix */
  private trimPrefix(url: string, prefix: string): string {
    if (url.startsWith(prefix)) return url.substring(prefix.length);
    if (url.startsWith(ComicSansParser.BASE_URL)) return url.substring(ComicSansParser.BASE_URL.length);
    return url;
  }

  async fetchPopular(): Promise<ComicItem[]> {
    const cacheKey = 'popular-1';
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const url = `${ComicSansParser.BASE_URL}/manga/?page=1&status=&type=&order=popular`;
    const doc = await this.client.getHtml(url);
    const results = this.parseComicItems(doc, ComicSansParser.MANGA_PREFIX);

    this.listCache.set(cacheKey, results);
    return results;
  }

  async fetchRecommended(): Promise<ComicItem[]> {
    const cacheKey = 'recommended-1';
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const url = `${ComicSansParser.BASE_URL}/manga/?page=1&status=&type=&order=update`;
    const doc = await this.client.getHtml(url);
    const results = this.parseComicItems(doc, ComicSansParser.MANGA_PREFIX);

    this.listCache.set(cacheKey, results);
    return results;
  }

  async fetchNewest(page: number = 1): Promise<ComicItem[]> {
    const cacheKey = `newest-${page}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const url = `${ComicSansParser.BASE_URL}/manga/?page=${page}&status=&type=&order=latest`;
    const doc = await this.client.getHtml(url);

    const noResult = doc.querySelector('.listupd center.noresult');
    if (noResult) throw new Error('Page not found');

    const items = this.parseComicItems(doc, ComicSansParser.MANGA_PREFIX);
    if (items.length === 0) throw new Error('Page not found');

    this.listCache.set(cacheKey, items);
    return items;
  }

  async fetchAll(page: number = 1): Promise<ComicItem[]> {
    const cacheKey = `all-${page}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const url = `${ComicSansParser.BASE_URL}/manga/?page=${page}&status=&type=&order=`;
    const doc = await this.client.getHtml(url);

    const noResult = doc.querySelector('.listupd center.noresult');
    if (noResult) throw new Error('Page not found');

    const items = this.parseComicItems(doc, ComicSansParser.MANGA_PREFIX);
    if (items.length === 0) throw new Error('Page not found');

    this.listCache.set(cacheKey, items);
    return items;
  }

  async search(query: string): Promise<ComicItem[]> {
    const encodedQuery = encodeURIComponent(query);
    const cacheKey = `search-${encodedQuery}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const url = `${ComicSansParser.BASE_URL}/?s=${encodedQuery}`;
    const doc = await this.client.getHtml(url);

    const noResult = doc.querySelector('.listupd center h3');
    if (noResult) throw new Error('No results found');

    const items = this.parseComicItems(doc, ComicSansParser.MANGA_PREFIX);
    if (items.length === 0) throw new Error('No results found');

    this.listCache.set(cacheKey, items);
    return items;
  }

  async fetchByGenre(genre: string, page: number = 1): Promise<ComicItem[]> {
    return this.fetchFiltered({ page, genre, order: 'popular' });
  }

  async fetchFiltered(options: {
    page?: number;
    genre?: string;
    status?: string;
    type?: string;
    order?: string;
  } = {}): Promise<ComicItem[]> {
    const { page = 1, genre = '', status = '', type = '', order = '' } = options;
    const cacheKey = `filtered-${page}-${genre}-${status}-${type}-${order}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const url = `${ComicSansParser.BASE_URL}/manga/?page=${page}&genre[]=${genre}&status=${status}&type=${type}&order=${order}`;
    const doc = await this.client.getHtml(url);

    const noResult = doc.querySelector('.listupd center.noresult');
    if (noResult) throw new Error('Page not found');

    const items = this.parseComicItems(doc, ComicSansParser.MANGA_PREFIX);
    if (items.length === 0) throw new Error('Page not found');

    this.listCache.set(cacheKey, items);
    return items;
  }

  async fetchGenres(): Promise<Genre[]> {
    const url = `${ComicSansParser.BASE_URL}/manga/`;
    const doc = await this.client.getHtml(url);

    const genres: Genre[] = [];
    const elements = doc.querySelectorAll('ul.dropdown-menu.c4.genrez li');

    for (const el of elements) {
      const value = el.querySelector('input.genre-item')?.getAttribute('value')?.trim() ?? '';
      const title = el.querySelector('label')?.text.trim() ?? '';

      if (!value) continue;

      const cleanVal = value.replace('-', '');
      const href = `/${cleanVal}/`;

      genres.push({ title: title || value, href });
    }

    return genres;
  }

  /** Batch fetch multiple lists efficiently */
  async fetchMultipleLists(options: {
    popular?: boolean;
    recommended?: boolean;
    newest?: boolean;
    limit?: number;
  } = {}): Promise<Record<string, ComicItem[]>> {
    const { popular = false, recommended = false, newest = false, limit = 6 } = options;
    const results: Record<string, ComicItem[]> = {};
    const promises: Promise<void>[] = [];

    if (popular) {
      promises.push(this.fetchPopular().then((items) => { results['popular'] = items.slice(0, limit); }));
    }
    if (recommended) {
      promises.push(this.fetchRecommended().then((items) => { results['recommended'] = items.slice(0, limit); }));
    }
    if (newest) {
      promises.push(this.fetchNewest().then((items) => { results['newest'] = items.slice(0, limit); }));
    }

    await Promise.all(promises);
    return results;
  }

  /** Batch fetch multiple genres */
  async fetchMultipleGenres(genres: string[], limit: number = 6): Promise<Record<string, ComicItem[]>> {
    const results: Record<string, ComicItem[]> = {};

    for (let i = 0; i < genres.length; i += ComicSansParser.MAX_CONCURRENT_REQUESTS) {
      const batch = genres.slice(i, i + ComicSansParser.MAX_CONCURRENT_REQUESTS);
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

  async fetchDetail(href: string): Promise<ComicDetail> {
    if (!href) throw new Error('href is required');

    const url = `${ComicSansParser.BASE_URL}/manga/${href}`;
    const doc = await this.client.getHtml(url);

    const article = doc.querySelector('article.hentry');
    if (!article) throw new Error('Comic not found');

    const title = article.querySelector('h1.entry-title')?.text.trim() ?? '';

    // Alternative title
    let altTitle = '';
    for (const b of article.querySelectorAll('.wd-full b')) {
      if (b.text.includes('Alternative Titles')) {
        altTitle = b.nextElementSibling?.text.trim() ?? '';
        break;
      }
    }

    const thumbnail = article.querySelector('.thumbook .thumb img')?.getAttribute('src')?.trim() ?? '';
    const description = article.querySelector('.entry-content-single')?.text.trim() ?? '';

    let status = '';
    for (const imptdt of article.querySelectorAll('.tsinfo .imptdt')) {
      if (imptdt.text.includes('Status')) {
        status = imptdt.querySelector('i')?.text.trim() ?? '';
        break;
      }
    }

    let type = '';
    for (const imptdt of article.querySelectorAll('.tsinfo .imptdt')) {
      if (imptdt.text.includes('Type')) {
        type = imptdt.querySelector('a')?.text.trim() ?? '';
        break;
      }
    }

    let released = '';
    for (const fmed of article.querySelectorAll('.fmed')) {
      if (fmed.text.includes('Released')) {
        released = fmed.querySelector('span')?.text.trim() ?? '';
        break;
      }
    }

    let author = '';
    for (const fmed of article.querySelectorAll('.fmed')) {
      if (fmed.text.includes('Author')) {
        author = fmed.querySelector('span')?.text.trim() ?? '';
        break;
      }
    }

    let updatedOn = '';
    for (const fmed of article.querySelectorAll('.fmed')) {
      if (fmed.text.includes('Updated On')) {
        const timeEl = fmed.querySelector('span time');
        if (timeEl) {
          updatedOn = timeEl.getAttribute('datetime')?.trim() ?? '';
        }
        if (!updatedOn) {
          updatedOn = fmed.querySelector('span')?.text.trim() ?? '';
        }
        break;
      }
    }

    let rating = article.querySelector('.rating-prc .num')?.getAttribute('content')?.trim() ?? '';
    if (!rating) {
      rating = article.querySelector('.rating-prc .num')?.text.trim() ?? '';
    }

    const genres: Genre[] = [];
    for (const wdFull of article.querySelectorAll('.wd-full')) {
      if (wdFull.text.includes('Genres') || wdFull.text.includes('Genre')) {
        const genreElements = wdFull.querySelectorAll('.mgen a');
        const genrePrefix = `${ComicSansParser.BASE_URL}/genres`;

        for (const el of genreElements) {
          const genreTitle = el.text.trim();
          const genreHref = el.getAttribute('href')?.trim() ?? '';
          if (genreTitle) {
            genres.push({ title: genreTitle, href: this.trimPrefix(genreHref, genrePrefix) });
          }
        }
        break;
      }
    }

    // Latest chapter
    let latestChapter = '';
    for (const inepcx of article.querySelectorAll('.lastend .inepcx')) {
      if (inepcx.text.includes('New Chapter') || inepcx.text.includes('Chapter')) {
        latestChapter = inepcx.querySelector('.epcurlast')?.text.trim() ?? '';
        if (latestChapter) break;
      }
    }

    const chapters: Chapter[] = [];
    const chapterElements = article.querySelectorAll('.eplister ul.clstyle li');

    for (const el of chapterElements) {
      const chapterTitle = el.querySelector('.chapternum')?.text.trim() ?? '';
      const chapterHref = el.querySelector('a')?.getAttribute('href')?.trim() ?? '';
      const chapterDate = el.querySelector('.chapterdate')?.text.trim() ?? '';

      if (chapterTitle && chapterHref) {
        chapters.push({
          title: chapterTitle,
          href: this.trimPrefix(chapterHref, ComicSansParser.BASE_URL),
          date: chapterDate,
        });
      }
    }

    return {
      href,
      title,
      altTitle,
      thumbnail,
      description,
      status,
      type,
      released,
      author,
      updatedOn,
      rating,
      latestChapter: chapters.length > 0 ? chapters[0].title : latestChapter || undefined,
      genres,
      chapters,
    };
  }

  async fetchChapter(href: string): Promise<ReadChapter> {
    if (!href) throw new Error('href is required');

    const url = `${ComicSansParser.BASE_URL}/${href}`;
    const body = await this.client.getText(url);

    const { parse } = await import('node-html-parser');
    const doc = parse(body);

    const title = doc.querySelector('h1.entry-title')?.text.trim() ?? '';

    // Extract panels from multiple sources
    const panels: string[] = [];
    const found = new Set<string>();

    const addPanel = (imgUrl: string): void => {
      let cleanUrl = imgUrl.trim();
      if (!cleanUrl) return;

      if (cleanUrl.startsWith('//')) cleanUrl = `https:${cleanUrl}`;
      if (!cleanUrl.startsWith('http') && cleanUrl.startsWith('/')) {
        cleanUrl = `${ComicSansParser.BASE_URL}${cleanUrl}`;
      }
      if (!cleanUrl) return;

      // Skip ads but keep manga images
      if (
        (cleanUrl.toLowerCase().includes('haka4d') ||
          cleanUrl.toLowerCase().includes('banner') ||
          cleanUrl.toLowerCase().includes('gif')) &&
        !cleanUrl.includes('uploads/manga-images')
      ) {
        return;
      }

      if (!found.has(cleanUrl)) {
        found.add(cleanUrl);
        panels.push(cleanUrl);
      }
    };

    // 1. Try #readerarea.rdminimal
    const readerArea = doc.querySelector('#readerarea.rdminimal');
    if (readerArea) {
      const imgRegex = /<img\s+src=['"]([^'"]+)['"]/g;
      let match: RegExpExecArray | null;
      while ((match = imgRegex.exec(readerArea.outerHTML)) !== null) {
        const imgUrl = match[1] ?? '';
        if (imgUrl.includes('uploads/manga-images') || imgUrl.includes('/chapter-')) {
          addPanel(imgUrl);
        }
      }
    }

    // 2. Standard selectors
    if (panels.length === 0) {
      const images = doc.querySelectorAll('#readerarea img, .rdminimal img');
      for (const img of images) {
        const src = img.getAttribute('src') ?? '';
        if (src && (src.includes('uploads/manga-images') || src.includes('/chapter-') || !src.includes('gif'))) {
          addPanel(src);
        }
      }
    }

    // 3. Parse from JavaScript
    if (panels.length === 0 && body.includes('ts_reader.run')) {
      const sourceRegex = /"sources":\s*\[\{[^}]*"images":\s*\[(.*?)\]/;
      const sourceMatch = sourceRegex.exec(body);

      if (sourceMatch?.[1]) {
        const imgUrlRegex = /"([^"]*uploads\/manga-images[^"]*)"/g;
        let imgMatch: RegExpExecArray | null;
        while ((imgMatch = imgUrlRegex.exec(sourceMatch[1])) !== null) {
          const imgUrl = (imgMatch[1] ?? '').replace(/\\\//g, '/');
          addPanel(imgUrl);
        }
      }
    }

    // Extract navigation from JavaScript
    let prev = '';
    let next = '';

    const prevRegex = /"prevUrl":"([^"]+)"/;
    const nextRegex = /"nextUrl":"([^"]+)"/;

    const prevMatch = prevRegex.exec(body);
    if (prevMatch?.[1]) {
      prev = this.trimPrefix(prevMatch[1].replace(/\\\//g, '/'), ComicSansParser.BASE_URL);
    }

    const nextMatch = nextRegex.exec(body);
    if (nextMatch?.[1]) {
      next = this.trimPrefix(nextMatch[1].replace(/\\\//g, '/'), ComicSansParser.BASE_URL);
    }

    if (!prev) {
      const prevHref = doc.querySelector('.nextprev a.ch-prev-btn, .chnav .ch-prev-btn')?.getAttribute('href') ?? '';
      if (prevHref && !prevHref.includes('#')) {
        prev = this.trimPrefix(prevHref, ComicSansParser.BASE_URL);
      }
    }

    if (!next) {
      const nextHref = doc.querySelector('.nextprev a.ch-next-btn, .chnav .ch-next-btn')?.getAttribute('href') ?? '';
      if (nextHref && !nextHref.includes('#')) {
        next = this.trimPrefix(nextHref, ComicSansParser.BASE_URL);
      }
    }

    return { title, prev, next, panel: panels };
  }

  clearCache(): void {
    this.listCache.clear();
  }

  dispose(): void {
    this.clearCache();
  }
}
