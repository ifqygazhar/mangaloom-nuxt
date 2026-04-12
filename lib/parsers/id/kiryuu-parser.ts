import type { HTMLElement } from 'node-html-parser';
import { NatsuParser } from '../lib/natsu-parser';

export class KiryuuParser extends NatsuParser {
  get sourceName(): string {
    return 'Kiryuu';
  }

  get domain(): string {
    return 'kiryuu03.com';
  }

  get language(): string {
    return 'ID';
  }

  /**
   * Override image selector for Kiryuu —
   * Uses `#readerarea img[loading="lazy"]` instead of the default `main section section > img`.
   */
  override parseChapterImages(doc: HTMLElement): string[] {
    const imgs = doc.querySelectorAll('#readerarea img[loading="lazy"]');
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
}
