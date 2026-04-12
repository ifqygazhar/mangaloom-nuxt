import type { ComicItem } from '../models/comic-item';

/** Cache expiry duration in milliseconds (3 hours) */
export const CACHE_EXPIRY_MS = 3 * 60 * 60 * 1000;

/** Generic cached result with timestamp */
export interface CachedResult<T> {
  data: T;
  timestamp: number;
}

/**
 * Generic result cache with time-based expiry.
 * Works in any JavaScript runtime (Node, Cloudflare Workers, browsers).
 */
export class ResultCache<T = ComicItem[]> {
  private cache = new Map<string, CachedResult<T>>();
  private expiryMs: number;

  constructor(expiryMs: number = CACHE_EXPIRY_MS) {
    this.expiryMs = expiryMs;
  }

  /** Check if a cached entry is still valid */
  isValid(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < this.expiryMs;
  }

  /** Get a cached entry if valid, or undefined */
  get(key: string): T | undefined {
    if (this.isValid(key)) {
      return this.cache.get(key)!.data;
    }
    this.cache.delete(key);
    return undefined;
  }

  /** Save an entry to cache */
  set(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /** Clear all cached entries */
  clear(): void {
    this.cache.clear();
  }
}
