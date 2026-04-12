import { parse, type HTMLElement } from 'node-html-parser';

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36';

export interface HttpClientOptions {
  userAgent?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
}

/**
 * Lightweight HTTP client wrapping native fetch().
 * Compatible with Node.js 18+, Cloudflare Workers, and browsers.
 */
export class HttpClient {
  private userAgent: string;
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(options: HttpClientOptions = {}) {
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.baseUrl = options.baseUrl ?? '';
    this.defaultHeaders = options.headers ?? {};
  }

  /** Build merged headers for a request */
  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      'User-Agent': this.userAgent,
      ...(this.baseUrl ? { 'Referer': this.baseUrl } : {}),
      ...this.defaultHeaders,
      ...(extra ?? {}),
    };
  }

  /** Perform a GET request and return the raw Response */
  async get(url: string, headers?: Record<string, string>): Promise<Response> {
    const response = await fetch(url, {
      method: 'GET',
      headers: this.buildHeaders(headers),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to load ${url}`);
    }

    return response;
  }

  /** Perform a GET request and return the body as text */
  async getText(url: string, headers?: Record<string, string>): Promise<string> {
    const response = await this.get(url, headers);
    return response.text();
  }

  /** Perform a GET and parse the response body as JSON */
  async getJson<T = Record<string, unknown>>(
    url: string,
    headers?: Record<string, string>,
  ): Promise<T> {
    const response = await this.get(url, {
      'Accept': 'application/json',
      ...(headers ?? {}),
    });
    return response.json() as Promise<T>;
  }

  /** Perform a GET and parse the response body as HTML */
  async getHtml(url: string, headers?: Record<string, string>): Promise<HTMLElement> {
    const text = await this.getText(url, headers);
    return parse(text);
  }

  /** Perform a GET and return the response body as ArrayBuffer (for binary data) */
  async getBytes(url: string, headers?: Record<string, string>): Promise<Uint8Array> {
    const response = await this.get(url, headers);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  /**
   * Perform a multipart POST request and parse response as HTML.
   * Used by NatsuParser for advanced search.
   */
  async postMultipart(
    url: string,
    fields: Record<string, string>,
    headers?: Record<string, string>,
  ): Promise<HTMLElement> {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      formData.append(key, value);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': this.userAgent,
        ...(this.baseUrl ? { 'Referer': this.baseUrl } : {}),
        ...this.defaultHeaders,
        ...(headers ?? {}),
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`POST ${response.status}: Failed to post ${url}`);
    }

    const text = await response.text();
    return parse(text);
  }
}

/**
 * Helper function matching the Dart `helperMakeRequest`.
 * Fetches a URL with standard headers and returns parsed JSON.
 */
export async function helperMakeRequest(options: {
  url: string;
  baseUrl: string;
  customUserAgent?: string;
}): Promise<Record<string, unknown>> {
  const userAgent = options.customUserAgent ?? DEFAULT_USER_AGENT;

  const response = await fetch(options.url, {
    method: 'GET',
    headers: {
      'User-Agent': userAgent,
      'Accept': 'application/json',
      'Referer': options.baseUrl,
      'sec-fetch-dest': 'empty',
    },
  });

  if (!response.ok) {
    throw new Error(`API returned status code: ${response.status}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}
