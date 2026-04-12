import type { HTMLElement } from 'node-html-parser';
import type { ComicItem } from '../../models/comic-item';
import type { ComicDetail } from '../../models/comic-detail';
import type { ReadChapter } from '../../models/read-chapter';
import type { Genre } from '../../models/genre';
import type { Chapter } from '../../models/chapter';
import { ComicParser } from '../parser-base';
import { ResultCache } from '../../utils/cache';
import { HttpClient } from '../../utils/http-client';

export class KomikluParser extends ComicParser {
  private static readonly BASE_URL = 'https://v2.komiklu.com';
  private static readonly MAX_CONCURRENT_REQUESTS = 3;

  private client: HttpClient;
  private listCache = new ResultCache<ComicItem[]>();

  private static readonly HEADERS: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  private static readonly AVAILABLE_GENRES: Genre[] = [
    { title: 'Action', href: '/action/' }, { title: 'Adult', href: '/adult/' },
    { title: 'Adventure', href: '/adventure/' }, { title: 'Comedy', href: '/comedy/' },
    { title: 'Drama', href: '/drama/' }, { title: 'Ecchi', href: '/ecchi/' },
    { title: 'Fantasy', href: '/fantasy/' }, { title: 'Harem', href: '/harem/' },
    { title: 'Historical', href: '/historical/' }, { title: 'Horror', href: '/horror/' },
    { title: 'Josei', href: '/josei/' }, { title: 'Martial Arts', href: '/martial-arts/' },
    { title: 'Mature', href: '/mature/' }, { title: 'Mystery', href: '/mystery/' },
    { title: 'Psychological', href: '/psychological/' }, { title: 'Romance', href: '/romance/' },
    { title: 'School Life', href: '/school-life/' }, { title: 'Sci-fi', href: '/sci-fi/' },
    { title: 'Seinen', href: '/seinen/' }, { title: 'Shounen', href: '/shounen/' },
    { title: 'Slice of Life', href: '/slice-of-life/' }, { title: 'Sports', href: '/sports/' },
    { title: 'Supernatural', href: '/supernatural/' }, { title: 'Tragedy', href: '/tragedy/' },
  ];

  constructor() {
    super();
    this.client = new HttpClient({
      baseUrl: KomikluParser.BASE_URL,
      headers: KomikluParser.HEADERS,
    });
  }

  get sourceName(): string { return 'Komiklu'; }
  get baseUrl(): string { return KomikluParser.BASE_URL; }
  get language(): string { return 'ID'; }

  private toAbsoluteUrl(url: string): string {
    if (url.includes('.php') && url.endsWith('/')) {
      url = url.slice(0, -1);
    }
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('/')) return `${this.baseUrl}${url}`;
    return `${this.baseUrl}/${url}`;
  }

  private toRelativeUrl(url: string): string {
    if (url.startsWith(this.baseUrl)) url = url.substring(this.baseUrl.length);
    else if (url.startsWith('http')) {
      const parsed = new URL(url);
      url = parsed.pathname + (parsed.search || '');
    }
    if (!url.startsWith('/')) url = `/${url}`;
    return url;
  }

  private parseComicListFromArticles(doc: HTMLElement): ComicItem[] {
    const items: ComicItem[] = [];
    for (const article of doc.querySelectorAll('article')) {
      try {
        const title = article.querySelector('h4 a')?.text.trim() ?? '';
        if (!title) continue;
        let href = article.querySelector('h4 a')?.getAttribute('href') ?? '';
        if (!href) continue;
        href = this.toRelativeUrl(href);
        let thumbnail = article.querySelector('a img')?.getAttribute('src') ?? '';
        if (thumbnail) thumbnail = this.toAbsoluteUrl(thumbnail);
        const chapter = article.querySelector('div.text-sky-400')?.text.trim() ?? '';
        let rating = article.querySelector('div.text-yellow-400')?.text.trim() ?? '';
        rating = rating.replace('⭐', '').trim();
        items.push({ title, href, thumbnail, rating: rating || undefined, chapter: chapter || undefined, type: 'Manga' });
      } catch { continue; }
    }
    return items;
  }

  private parseComicListFromPage(doc: HTMLElement): ComicItem[] {
    if (doc.querySelector('#comicContainer center.noresult')) return [];
    const items: ComicItem[] = [];
    for (const article of doc.querySelectorAll('article')) {
      try {
        const title = article.querySelector('h4 a')?.text.trim() ?? '';
        if (!title) continue;
        let href = article.querySelector('h4 a')?.getAttribute('href') ?? '';
        if (!href) continue;
        href = this.toRelativeUrl(href);
        let thumbnail = article.querySelector('a img')?.getAttribute('src') ?? '';
        if (thumbnail) thumbnail = this.toAbsoluteUrl(thumbnail);
        let chapter = '';
        const chapterDivs = article.querySelectorAll('div.flex.justify-between div.text-sky-400');
        for (const div of chapterDivs) {
          const text = div.text.trim();
          if (text.toLowerCase().includes('chapter')) { chapter = text; break; }
        }
        let rating = article.querySelector('div.text-yellow-400')?.text.trim() ?? '';
        rating = rating.replace('⭐', '').trim();
        items.push({ title, href, thumbnail, rating: rating || undefined, type: 'Manga', chapter: chapter || undefined });
      } catch { continue; }
    }
    return items;
  }

  async fetchPopular(): Promise<ComicItem[]> {
    const cacheKey = 'popular-1';
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;
    const doc = await this.client.getHtml(`${this.baseUrl}/ajax_filter.php?yearTo=9999&sort=rating-desc`);
    const results = this.parseComicListFromArticles(doc);
    this.listCache.set(cacheKey, results);
    return results;
  }

  async fetchRecommended(): Promise<ComicItem[]> {
    const cacheKey = 'recommended-1';
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;
    const doc = await this.client.getHtml(`${this.baseUrl}/ajax_filter.php?yearTo=9999&sort=newest`);
    const results = this.parseComicListFromArticles(doc);
    this.listCache.set(cacheKey, results);
    return results;
  }

  async fetchNewest(page: number = 1): Promise<ComicItem[]> {
    const cacheKey = `newest-${page}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;
    const doc = await this.client.getHtml(`${this.baseUrl}/ajax_filter.php?yearTo=9999&sort=year-desc`);
    const results = this.parseComicListFromArticles(doc);
    if (results.length === 0) throw new Error('No results found');
    this.listCache.set(cacheKey, results);
    return results;
  }

  async fetchAll(page: number = 1): Promise<ComicItem[]> {
    const cacheKey = `all-${page}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;
    const doc = await this.client.getHtml(`${this.baseUrl}/page.php?page=${page}`);
    const results = this.parseComicListFromPage(doc);
    if (results.length === 0) throw new Error('Page not found');
    this.listCache.set(cacheKey, results);
    return results;
  }

  async search(query: string): Promise<ComicItem[]> {
    const encodedQuery = encodeURIComponent(query);
    const cacheKey = `search-${encodedQuery}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const response = await fetch(`${this.baseUrl}/search.php?q=${encodedQuery}`, {
      headers: { ...KomikluParser.HEADERS, 'Referer': this.baseUrl },
    });
    if (!response.ok) throw new Error(`Failed to search: ${response.status}`);

    const jsonResults = (await response.json()) as Record<string, unknown>[];
    const items: ComicItem[] = [];

    for (const result of jsonResults) {
      const title = result['title']?.toString() ?? '';
      if (!title) continue;
      const href = `/comic_detail.php?title=${title}`;
      let thumbnail = result['cover']?.toString() ?? '';
      if (thumbnail) thumbnail = this.toAbsoluteUrl(thumbnail);
      let rating = result['rating']?.toString() ?? '';
      if (rating && !rating.includes('/')) rating = `${rating}/10`;
      const year = result['year']?.toString() ?? '';
      items.push({ title, href, thumbnail, rating: rating || undefined, chapter: year || undefined, type: 'Manga' });
    }

    if (items.length === 0) throw new Error('No results found');
    this.listCache.set(cacheKey, items);
    return items;
  }

  async fetchByGenre(genre: string, page: number = 1): Promise<ComicItem[]> {
    const cacheKey = `genre-${genre}-${page}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;
    const doc = await this.client.getHtml(`${this.baseUrl}/ajax_filter.php?filterGenre=${genre}&yearTo=9999&sort=newest`);
    const results = this.parseComicListFromArticles(doc);
    if (results.length === 0) throw new Error('No results found');
    this.listCache.set(cacheKey, results);
    return results;
  }

  async fetchFiltered(options: { page?: number; genre?: string; status?: string; type?: string; order?: string } = {}): Promise<ComicItem[]> {
    const { page = 1, genre, order } = options;
    const cacheKey = `filtered-${page}-${genre}-${options.status}-${options.type}-${order}`;
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;
    let url: string;
    if (genre) url = `${this.baseUrl}/ajax_filter.php?filterGenre=${genre}&yearTo=9999&sort=newest`;
    else if (order === 'rating-desc' || order === 'popular') url = `${this.baseUrl}/ajax_filter.php?yearTo=9999&sort=rating-desc`;
    else url = `${this.baseUrl}/ajax_filter.php?yearTo=9999&sort=newest`;
    const doc = await this.client.getHtml(url);
    const results = this.parseComicListFromArticles(doc);
    if (results.length === 0) throw new Error('No results found');
    this.listCache.set(cacheKey, results);
    return results;
  }

  async fetchGenres(): Promise<Genre[]> { return KomikluParser.AVAILABLE_GENRES; }

  async fetchMultipleLists(options: { popular?: boolean; recommended?: boolean; newest?: boolean; limit?: number } = {}): Promise<Record<string, ComicItem[]>> {
    const { popular = false, recommended = false, newest = false, limit = 6 } = options;
    const results: Record<string, ComicItem[]> = {};
    const promises: Promise<void>[] = [];
    if (popular) promises.push(this.fetchPopular().then((items) => { results['popular'] = items.slice(0, limit); }));
    if (recommended) promises.push(this.fetchRecommended().then((items) => { results['recommended'] = items.slice(0, limit); }));
    if (newest) promises.push(this.fetchNewest().then((items) => { results['newest'] = items.slice(0, limit); }));
    await Promise.all(promises);
    return results;
  }

  async fetchMultipleGenres(genres: string[], limit: number = 6): Promise<Record<string, ComicItem[]>> {
    const results: Record<string, ComicItem[]> = {};
    for (let i = 0; i < genres.length; i += KomikluParser.MAX_CONCURRENT_REQUESTS) {
      const batch = genres.slice(i, i + KomikluParser.MAX_CONCURRENT_REQUESTS);
      await Promise.all(batch.map(async (genre) => {
        try { results[genre] = (await this.fetchByGenre(genre)).slice(0, limit); } catch { results[genre] = []; }
      }));
    }
    return results;
  }

  async fetchDetail(href: string): Promise<ComicDetail> {
    if (!href) throw new Error('href is required');
    const doc = await this.client.getHtml(this.toAbsoluteUrl(href));

    let title = doc.querySelector('h1.text-3xl.font-bold')?.text.trim() ?? '';
    if (!title) title = doc.querySelector('h1')?.text.trim() ?? '';
    if (!title) throw new Error('Comic not found');

    let thumbnail = doc.querySelector('img.w-56.h-80.object-cover.rounded-lg.shadow-lg')?.getAttribute('src') ?? '';
    if (!thumbnail) thumbnail = doc.querySelector('main section img')?.getAttribute('src') ?? '';
    if (thumbnail) thumbnail = this.toAbsoluteUrl(thumbnail);

    const author = doc.querySelector('span.text-sky-400.font-medium')?.text.trim() ?? '';
    let rating = doc.querySelector('span.ml-2.text-sm.text-gray-400')?.text.trim() ?? '';
    rating = rating.replace('(', '').replace(')', '').trim();
    const description = doc.querySelector('p.text-gray-300.leading-relaxed')?.text.trim() ?? '';

    let year = '', status = '';
    const infoSpans = doc.querySelectorAll('div.flex.items-center.gap-4.text-gray-400 > span.flex.items-center.gap-1');
    for (const span of infoSpans) {
      const yearText = span.querySelector('span.text-gray-200')?.text.trim() ?? '';
      if (yearText.length === 4 && !isNaN(Number(yearText))) year = yearText;
      const statusText = span.querySelector('span.text-sky-400.font-semibold')?.text.trim() ?? '';
      if (statusText === 'OnGoing' || statusText === 'Completed') status = statusText;
    }

    const genres: Genre[] = [];
    for (const el of doc.querySelectorAll('div.flex.flex-wrap.gap-2 span.bg-gray-800.text-gray-200.text-sm')) {
      const genreTitle = el.text.trim();
      if (genreTitle && genreTitle.length < 30) {
        genres.push({ title: genreTitle, href: `/${genreTitle.toLowerCase().replace(/ /g, '-')}/` });
      }
    }

    const chapters: Chapter[] = [];
    let chapterElements = doc.querySelectorAll('ul#chapterContainer li.chapter-item');
    if (chapterElements.length === 0) chapterElements = doc.querySelectorAll('#chapterContainer li[data-chapter]');
    if (chapterElements.length === 0) chapterElements = doc.querySelectorAll('#chapterContainer > li');
    if (chapterElements.length === 0) {
      const container = doc.querySelector('#chapterContainer');
      if (container) chapterElements = container.querySelectorAll('li');
    }
    if (chapterElements.length === 0) chapterElements = doc.querySelectorAll('li[data-chapter]');

    for (const li of chapterElements) {
      let chapterTitle = li.getAttribute('data-chapter') ?? '';
      if (!chapterTitle) chapterTitle = li.querySelector('span.chapter-name')?.text.trim() ?? '';
      if (!chapterTitle) chapterTitle = li.querySelector('span')?.text.trim() ?? '';
      let chapterHref = li.querySelector('a')?.getAttribute('href') ?? '';
      if (chapterTitle && chapterHref) {
        chapterHref = this.toRelativeUrl(chapterHref);
        chapters.push({ title: chapterTitle, href: chapterHref, date: '' });
      }
    }

    return {
      href: this.toRelativeUrl(href), title, altTitle: '', thumbnail, description,
      status, type: 'Manga', released: year, author, updatedOn: '', rating,
      latestChapter: chapters.length > 0 ? chapters[0].title : undefined, genres, chapters,
    };
  }

  async fetchChapter(href: string): Promise<ReadChapter> {
    if (!href) throw new Error('href is required');
    const doc = await this.client.getHtml(this.toAbsoluteUrl(href));

    let title = doc.querySelector('div.header-title')?.text.trim() ?? '';
    if (!title) title = doc.querySelector('title')?.text.trim() ?? '';
    if (!title) title = doc.querySelector('h1')?.text.trim() ?? '';
    if (!title) throw new Error('Chapter not found');

    let prev = '', next = '';
    const prevBtn = doc.querySelector('button#prevBtn');
    if (prevBtn && !prevBtn.getAttribute('disabled')) prev = 'prev';
    const nextBtn = doc.querySelector('button#nextBtn');
    if (nextBtn && !nextBtn.getAttribute('disabled')) next = 'next';

    const images: string[] = [];
    for (const container of doc.querySelectorAll('div.image-container')) {
      const img = container.querySelector('img.webtoon-img');
      if (img) {
        let src = img.getAttribute('src') ?? img.getAttribute('data-src') ?? '';
        if (src && !src.includes('data:image')) {
          images.push(this.toAbsoluteUrl(src));
        }
      }
    }

    if (images.length === 0) throw new Error('No images found in chapter');
    return { title, prev, next, panel: images };
  }

  clearCache(): void { this.listCache.clear(); }
  dispose(): void { this.clearCache(); }
}
