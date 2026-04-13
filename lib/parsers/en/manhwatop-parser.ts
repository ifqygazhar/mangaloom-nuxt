import { MadaraParser } from "../lib/madara-parser";
import type { Chapter } from "../../models/chapter";
import * as cheerio from "cheerio";

export class ManhwaTopParser extends MadaraParser {
  protected domain = "manhwatop.com";

  get sourceName(): string {
    return "ManhwaTop";
  }

  get language(): string {
    return "EN";
  }

  protected async fetchHtml(url: string, init?: RequestInit): Promise<cheerio.CheerioAPI> {
    const proxyUrl = `https://proxy-bypass-cors.verifwebsitepro.workers.dev/?url=${encodeURIComponent(url)}`;
    return super.fetchHtml(proxyUrl, init);
  }

  protected async loadChapters(mangaUrl: string, $: cheerio.CheerioAPI): Promise<Chapter[]> {
    const url = `${mangaUrl.replace(/\/$/, "")}/ajax/chapters/`;
    const doc = await this.fetchHtml(url, {
      method: "POST",
      headers: {
        ...this.getHeaders(),
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    const chapters = this.getChapters(doc, "");
    
    // Clean up dates
    for (const chapter of chapters) {
      if (chapter.date === "Complete") {
        chapter.date = "";
      }
    }

    return chapters;
  }
}
