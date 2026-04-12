export interface Genre {
  title: string;
  href: string;
}

export function genreFromJson(json: Record<string, unknown>): Genre {
  return {
    title: json['title'] as string,
    href: json['href'] as string,
  };
}

export function genreToJson(genre: Genre): Record<string, unknown> {
  return {
    title: genre.title,
    href: genre.href,
  };
}
