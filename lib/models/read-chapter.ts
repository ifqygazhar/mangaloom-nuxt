export interface ReadChapter {
  title: string;
  prev: string;
  next: string;
  panel: string[];
}

export function readChapterFromJson(json: Record<string, unknown>): ReadChapter {
  return {
    title: json['title'] as string,
    prev: json['prev'] as string,
    next: json['next'] as string,
    panel: (json['panel'] as unknown[]).map((e) => e as string),
  };
}

export function readChapterToJson(chapter: ReadChapter): Record<string, unknown> {
  return {
    title: chapter.title,
    prev: chapter.prev,
    next: chapter.next,
    panel: chapter.panel,
  };
}
