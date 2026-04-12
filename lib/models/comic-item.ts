export interface ComicItem {
  title: string;
  href: string;
  thumbnail: string;
  type?: string;
  chapter?: string;
  rating?: string;
}

export function comicItemFromJson(json: Record<string, unknown>): ComicItem {
  return {
    title: json['title'] as string,
    href: json['href'] as string,
    thumbnail: json['thumbnail'] as string,
    type: json['type'] as string | undefined,
    chapter: json['chapter'] as string | undefined,
    rating: json['rating'] as string | undefined,
  };
}

export function comicItemToJson(item: ComicItem): Record<string, unknown> {
  const json: Record<string, unknown> = {
    title: item.title,
    href: item.href,
    thumbnail: item.thumbnail,
  };
  if (item.type !== undefined) json['type'] = item.type;
  if (item.chapter !== undefined) json['chapter'] = item.chapter;
  if (item.rating !== undefined) json['rating'] = item.rating;
  return json;
}
