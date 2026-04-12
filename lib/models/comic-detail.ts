import type { Genre } from './genre';
import type { Chapter } from './chapter';
import { genreFromJson, genreToJson } from './genre';
import { chapterFromJson, chapterToJson } from './chapter';

export interface ComicDetail {
  href: string;
  title: string;
  altTitle: string;
  thumbnail: string;
  description: string;
  status: string;
  type: string;
  released: string;
  author: string;
  updatedOn: string;
  rating: string;
  latestChapter?: string;
  genres: Genre[];
  chapters: Chapter[];
}

export function comicDetailFromJson(json: Record<string, unknown>): ComicDetail {
  return {
    href: json['href'] as string,
    title: json['title'] as string,
    altTitle: json['altTitle'] as string,
    thumbnail: json['thumbnail'] as string,
    description: json['description'] as string,
    status: json['status'] as string,
    type: json['type'] as string,
    released: json['released'] as string,
    author: json['author'] as string,
    updatedOn: json['updatedOn'] as string,
    rating: json['rating'] as string,
    latestChapter: json['latest_chapter'] as string | undefined,
    genres: ((json['genre'] as unknown[]) ?? []).map((e) =>
      genreFromJson(e as Record<string, unknown>),
    ),
    chapters: ((json['chapter'] as unknown[]) ?? []).map((e) =>
      chapterFromJson(e as Record<string, unknown>),
    ),
  };
}

export function comicDetailToJson(detail: ComicDetail): Record<string, unknown> {
  const json: Record<string, unknown> = {
    href: detail.href,
    title: detail.title,
    altTitle: detail.altTitle,
    thumbnail: detail.thumbnail,
    description: detail.description,
    status: detail.status,
    type: detail.type,
    released: detail.released,
    author: detail.author,
    updatedOn: detail.updatedOn,
    rating: detail.rating,
    genre: detail.genres.map((e) => genreToJson(e)),
    chapter: detail.chapters.map((e) => chapterToJson(e)),
  };
  if (detail.latestChapter !== undefined) {
    json['latest_chapter'] = detail.latestChapter;
  }
  return json;
}
