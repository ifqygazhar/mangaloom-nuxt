export interface Chapter {
  title: string;
  href: string;
  date: string;
  downloadUrl?: string;
}

export function chapterFromJson(json: Record<string, unknown>): Chapter {
  return {
    title: json['title'] as string,
    href: json['href'] as string,
    date: json['date'] as string,
    downloadUrl: json['downloadUrl'] as string | undefined,
  };
}

export function chapterToJson(chapter: Chapter): Record<string, unknown> {
  const json: Record<string, unknown> = {
    title: chapter.title,
    href: chapter.href,
    date: chapter.date,
  };
  if (chapter.downloadUrl !== undefined) {
    json['downloadUrl'] = chapter.downloadUrl;
  }
  return json;
}
