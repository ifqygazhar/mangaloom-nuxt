import type { ComicItem } from '../../models/comic-item';
import type { ComicDetail } from '../../models/comic-detail';
import type { ReadChapter } from '../../models/read-chapter';
import type { Genre } from '../../models/genre';
import type { Chapter } from '../../models/chapter';
import { ComicParser } from '../parser-base';
import { CACHE_EXPIRY_MS } from '../../utils/cache';

interface ApiCachedResult {
  data: unknown;
  timestamp: number;
}

export class MangaPlusParser extends ComicParser {
  private static readonly API_URL = 'https://jumpg-webapi.tokyo-cdn.com/api';
  private static readonly BASE_URL = 'https://mangaplus.shueisha.co.jp';
  private static readonly SOURCE_LANG = 'INDONESIAN';
  private static readonly USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  private static readonly DEFAULT_LIMIT = 10;

  private sessionToken: string;
  private apiCache = new Map<string, ApiCachedResult>();
  private allTitlesCache: Record<string, unknown> | null = null;
  private allTitlesCacheTime: number | null = null;

  constructor() {
    super();
    this.sessionToken = crypto.randomUUID();
  }

  get sourceName(): string { return 'MangaPlus'; }
  get baseUrl(): string { return MangaPlusParser.BASE_URL; }
  get language(): string { return 'ID'; }

  /** Headers for all requests */
  private getHeaders(): Record<string, string> {
    return {
      'Session-Token': this.sessionToken,
      'User-Agent': MangaPlusParser.USER_AGENT,
    };
  }

  /** Headers for image requests */
  get imageHeaders(): Record<string, string> {
    return { 'User-Agent': MangaPlusParser.USER_AGENT };
  }

  /** Check if cache is valid */
  private isCacheValid(key: string): boolean {
    const cached = this.apiCache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < CACHE_EXPIRY_MS;
  }

  /** Get from cache */
  private getFromCache(key: string): unknown | undefined {
    if (this.isCacheValid(key)) {
      return this.apiCache.get(key)!.data;
    }
    this.apiCache.delete(key);
    return undefined;
  }

  /** Save to cache */
  private saveToCache(key: string, data: unknown): void {
    this.apiCache.set(key, { data, timestamp: Date.now() });
  }

  /** Helper for API calls with caching */
  private async apiCall(
    endpoint: string,
    useCache: boolean = true,
  ): Promise<Record<string, unknown>> {
    if (useCache) {
      const cached = this.getFromCache(endpoint);
      if (cached && typeof cached === 'object') {
        return cached as Record<string, unknown>;
      }
    }

    const urlString = `${MangaPlusParser.API_URL}${endpoint}`;
    const url = new URL(urlString);
    url.searchParams.set('format', 'json');

    const response = await fetch(url.toString(), {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to load data: ${response.status}`);
    }

    const json = (await response.json()) as Record<string, unknown>;

    // Check for success
    if ('success' in json) {
      const result = json['success'] as Record<string, unknown>;
      if (useCache) this.saveToCache(endpoint, result);
      return result;
    }

    if ('error' in json) {
      const error = json['error'] as Record<string, unknown>;

      if ('popups' in error) {
        const popups = error['popups'] as Record<string, unknown>[];

        for (const popup of popups) {
          if (typeof popup !== 'object') continue;

          const language = popup['language'];
          if (language === null || language === undefined) {
            const subject = popup['subject'] as string | undefined;
            const body = popup['body'] as string | undefined;

            if (subject === 'Not Found' && endpoint.includes('manga_viewer')) {
              throw new Error('This chapter has expired');
            }

            if (body) throw new Error(body);
            if (subject) throw new Error(subject);
          }
        }
      }

      const errorAction = error['action'] as string | undefined;
      if (errorAction) throw new Error(errorAction);

      throw new Error('Unknown Error');
    }

    throw new Error('Invalid API response');
  }

  /** Filter and map manga by language */
  private filterAndMapManga(
    titles: unknown[],
    query?: string,
    limit?: number,
  ): ComicItem[] {
    const items: ComicItem[] = [];
    let count = 0;

    for (const item of titles) {
      if (limit !== undefined && count >= limit) break;
      if (typeof item !== 'object' || item === null) continue;

      const record = item as Record<string, unknown>;
      const language = (record['language'] as string) ?? 'ENGLISH';
      if (language !== MangaPlusParser.SOURCE_LANG) continue;

      const name = (record['name'] as string) ?? '';
      const author = ((record['author'] as string) ?? '')
        .split('/')
        .map((e: string) => e.trim())
        .join(', ');

      if (query) {
        if (
          !name.toLowerCase().includes(query.toLowerCase()) &&
          !author.toLowerCase().includes(query.toLowerCase())
        ) {
          continue;
        }
      }

      const titleId = record['titleId']?.toString() ?? '';
      if (!titleId) continue;

      items.push({
        title: name,
        href: titleId,
        thumbnail: (record['portraitImageUrl'] as string) ?? '',
        type: undefined,
        chapter: undefined,
        rating: undefined,
      });

      count++;
    }

    return items;
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
      promises.push(
        this.fetchPopular(limit).then((items) => { results['popular'] = items; }).catch(() => { results['popular'] = []; }),
      );
    }
    if (recommended) {
      promises.push(
        this.fetchRecommended(limit).then((items) => { results['recommended'] = items; }).catch(() => { results['recommended'] = []; }),
      );
    }
    if (newest) {
      promises.push(
        this.fetchNewest(1, limit).then((items) => { results['newest'] = items; }).catch(() => { results['newest'] = []; }),
      );
    }

    await Promise.all(promises);
    return results;
  }

  async fetchPopular(limit: number = MangaPlusParser.DEFAULT_LIMIT): Promise<ComicItem[]> {
    const json = await this.apiCall('/title_list/ranking');
    const titles = ((json['titleRankingView'] as Record<string, unknown>)?.['titles'] as unknown[]) ?? [];
    return this.filterAndMapManga(titles, undefined, limit);
  }

  async fetchRecommended(limit: number = MangaPlusParser.DEFAULT_LIMIT): Promise<ComicItem[]> {
    return this.fetchPopular(limit);
  }

  async fetchNewest(page: number = 1, limit: number = MangaPlusParser.DEFAULT_LIMIT): Promise<ComicItem[]> {
    const json = await this.apiCall('/title_list/updated');
    const latestTitles = ((json['titleUpdatedView'] as Record<string, unknown>)?.['latestTitle'] as unknown[]) ?? [];

    const titles: unknown[] = [];
    for (const item of latestTitles) {
      if (typeof item === 'object' && item !== null && 'title' in (item as Record<string, unknown>)) {
        titles.push((item as Record<string, unknown>)['title']);
      }
    }

    return this.filterAndMapManga(titles, undefined, limit);
  }

  private async loadAllTitles(): Promise<Record<string, unknown>> {
    if (
      this.allTitlesCache === null ||
      this.allTitlesCacheTime === null ||
      Date.now() - this.allTitlesCacheTime >= CACHE_EXPIRY_MS
    ) {
      this.allTitlesCache = await this.apiCall('/title_list/allV2');
      this.allTitlesCacheTime = Date.now();
    }
    return this.allTitlesCache!;
  }

  private extractAllTitlesFromCache(cache: Record<string, unknown>): unknown[] {
    const allTitlesGroups = ((cache['allTitlesViewV2'] as Record<string, unknown>)?.['AllTitlesGroup'] as unknown[]) ?? [];
    const allTitles: unknown[] = [];
    for (const group of allTitlesGroups) {
      if (typeof group === 'object' && group !== null && 'titles' in (group as Record<string, unknown>)) {
        const titles = ((group as Record<string, unknown>)['titles'] as unknown[]) ?? [];
        allTitles.push(...titles);
      }
    }
    return allTitles;
  }

  async fetchAll(page: number = 1, limit: number = MangaPlusParser.DEFAULT_LIMIT): Promise<ComicItem[]> {
    const cache = await this.loadAllTitles();
    const allTitles = this.extractAllTitlesFromCache(cache);
    const filteredItems = this.filterAndMapManga(allTitles);

    const offset = (page - 1) * limit;
    if (offset >= filteredItems.length) return [];
    return filteredItems.slice(offset, offset + limit);
  }

  async search(query: string): Promise<ComicItem[]> {
    if (!query) return this.fetchAll();

    const cache = await this.loadAllTitles();
    const allTitles = this.extractAllTitlesFromCache(cache);
    return this.filterAndMapManga(allTitles, query);
  }

  async fetchByGenre(genre: string, page: number = 1): Promise<ComicItem[]> {
    return this.fetchAll(page);
  }

  async fetchFiltered(options: {
    page?: number;
    genre?: string;
    status?: string;
    type?: string;
    order?: string;
  } = {}): Promise<ComicItem[]> {
    const { page = 1, order } = options;
    const limit = MangaPlusParser.DEFAULT_LIMIT;

    if (order === 'popular' || order === 'popularity') {
      return this.fetchPopular(limit);
    } else if (order === 'update' || order === 'updated' || order === 'latest') {
      return this.fetchNewest(1, limit);
    }
    return this.fetchAll(page, limit);
  }

  async fetchGenres(): Promise<Genre[]> {
    return [];
  }

  async fetchDetail(href: string): Promise<ComicDetail> {
    if (!href) throw new Error('href is required');

    const json = await this.apiCall(`/title_detailV3?title_id=${href}`);
    const titleDetailView = (json['titleDetailView'] as Record<string, unknown>) ?? {};
    const title = (titleDetailView['title'] as Record<string, unknown>) ?? {};

    const name = (title['name'] as string) ?? '';
    const author = ((title['author'] as string) ?? '')
      .split('/')
      .map((e: string) => e.trim())
      .join(', ');
    const thumbnail = (title['portraitImageUrl'] as string) ?? '';
    const overview = (titleDetailView['overview'] as string) ?? '';

    const titleLabels = (titleDetailView['titleLabels'] as Record<string, unknown>) ?? {};
    const releaseSchedule = (titleLabels['releaseSchedule'] as string) ?? '';
    const isCompleted = releaseSchedule === 'DISABLED' || releaseSchedule === 'COMPLETED';

    const nonAppearanceInfo = (titleDetailView['nonAppearanceInfo'] as string) ?? '';
    const isHiatus = nonAppearanceInfo.includes('on a hiatus');

    let status: string;
    if (isCompleted) {
      status = 'Completed';
    } else if (isHiatus) {
      status = 'Hiatus';
    } else {
      status = 'Ongoing';
    }

    const viewingPeriod = (titleDetailView['viewingPeriodDescription'] as string) ?? '';
    let description = overview;
    if (viewingPeriod && !isCompleted) {
      description += `\n\n${viewingPeriod}`;
    }

    const chapterListGroup = (titleDetailView['chapterListGroup'] as unknown[]) ?? [];
    const chapters = this.parseChapters(chapterListGroup);

    let latestChapter: string | undefined;
    if (chapters.length > 0) {
      latestChapter = chapters[0].title;
    }

    const reversedChapters = [...chapters].reverse();

    return {
      href,
      title: name,
      altTitle: '',
      thumbnail,
      description,
      status,
      type: 'Manga',
      released: '',
      author,
      updatedOn: '',
      rating: '',
      latestChapter: reversedChapters.length > 0 ? reversedChapters[0].title : latestChapter,
      genres: [],
      chapters: reversedChapters,
    };
  }

  /** Parse chapters from API response */
  private parseChapters(chapterListGroup: unknown[]): Chapter[] {
    const allChapters: Record<string, unknown>[] = [];

    for (const group of chapterListGroup) {
      if (typeof group !== 'object' || group === null) continue;
      const g = group as Record<string, unknown>;

      const firstChapters = (g['firstChapterList'] as unknown[]) ?? [];
      const lastChapters = (g['lastChapterList'] as unknown[]) ?? [];

      for (const ch of firstChapters) {
        if (typeof ch === 'object' && ch !== null) allChapters.push(ch as Record<string, unknown>);
      }
      for (const ch of lastChapters) {
        if (typeof ch === 'object' && ch !== null) allChapters.push(ch as Record<string, unknown>);
      }
    }

    const chapters: Chapter[] = [];
    for (const chapter of allChapters) {
      const chapterId = chapter['chapterId']?.toString() ?? '';
      const subtitle = (chapter['subTitle'] as string) ?? '';
      if (!chapterId || !subtitle) continue;

      const timestamp = (chapter['startTimeStamp'] as number) ?? 0;
      const date = timestamp > 0
        ? new Date(timestamp * 1000).toISOString().split('T')[0]
        : '';

      chapters.push({ title: subtitle, href: chapterId, date });
    }

    return chapters;
  }

  async fetchChapter(href: string): Promise<ReadChapter> {
    if (!href) throw new Error('href is required');

    const json = await this.apiCall(
      `/manga_viewer?chapter_id=${href}&split=yes&img_quality=super_high`,
      false,
    );

    const mangaViewer = (json['mangaViewer'] as Record<string, unknown>) ?? {};
    const pages = (mangaViewer['pages'] as unknown[]) ?? [];

    const title = (mangaViewer['chapterName'] as string) ?? `Chapter ${href}`;
    const panels: string[] = [];

    for (const page of pages) {
      if (typeof page !== 'object' || page === null) continue;
      const p = page as Record<string, unknown>;

      const mangaPage = p['mangaPage'] as Record<string, unknown> | undefined;
      if (!mangaPage) continue;

      const imageUrl = (mangaPage['imageUrl'] as string) ?? '';
      const encryptionKey = (mangaPage['encryptionKey'] as string) ?? '';

      if (!imageUrl) continue;

      const fullUrl = encryptionKey ? `${imageUrl}#${encryptionKey}` : imageUrl;
      panels.push(fullUrl);
    }

    if (panels.length === 0) throw new Error('No pages found in chapter');

    return { title, prev: '', next: '', panel: panels };
  }

  /** Decode image with XOR cipher if encryption key is present */
  decodeImage(imageBytes: Uint8Array, encryptionKey?: string): Uint8Array {
    if (!encryptionKey) return imageBytes;

    try {
      const keyBytes: number[] = [];
      for (let i = 0; i < encryptionKey.length; i += 2) {
        const hexByte = encryptionKey.substring(i, i + 2);
        keyBytes.push(parseInt(hexByte, 16));
      }

      const decoded = new Uint8Array(imageBytes.length);
      for (let i = 0; i < imageBytes.length; i++) {
        decoded[i] = imageBytes[i] ^ keyBytes[i % keyBytes.length];
      }

      return decoded;
    } catch {
      return imageBytes;
    }
  }

  /** Helper to fetch and decode image */
  async fetchImage(url: string): Promise<Uint8Array> {
    let imageUrl = url;
    let encryptionKey: string | undefined;

    if (url.includes('#')) {
      const parts = url.split('#');
      imageUrl = parts[0];
      encryptionKey = parts.length > 1 ? parts[1] : undefined;
    }

    const response = await fetch(imageUrl, { headers: this.imageHeaders });

    if (!response.ok) {
      throw new Error(`Failed to load image: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const imageBytes = new Uint8Array(buffer);

    if (encryptionKey) {
      return this.decodeImage(imageBytes, encryptionKey);
    }

    return imageBytes;
  }

  clearCache(): void {
    this.apiCache.clear();
    this.allTitlesCache = null;
    this.allTitlesCacheTime = null;
  }

  dispose(): void {
    this.clearCache();
  }
}
