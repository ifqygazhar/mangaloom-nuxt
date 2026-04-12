import { useState } from "nuxt/app";
import { computed } from "vue";

interface SourceInfo {
  id: string;
  name: string;
  language: string;
  icon: string;
}

const SOURCES: SourceInfo[] = [
  { id: "shinigami", name: "Shinigami", language: "ID", icon: "flagpack:id" },
  { id: "komiku", name: "Komiku", language: "ID", icon: "flagpack:id" },
  { id: "mangago", name: "Mangago", language: "EN", icon: "flagpack:us" },
  {
    id: "flamecomic",
    name: "Flame Comic",
    language: "EN",
    icon: "flagpack:us",
  },
];

function trimHrefSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

export function normalizeSourceHref(value: string): string {
  if (!value) return "";

  const normalized = trimHrefSlashes(value);
  return normalized ? `/${normalized}/` : "";
}

export function encodeSourceHref(value: string): string {
  if (!value) return "";
  return encodeURIComponent(trimHrefSlashes(value));
}

export function decodeSourceHref(value: string): string {
  if (!value) return "";
  return normalizeSourceHref(decodeURIComponent(value));
}

export function parseSourceRouteParam(param: string) {
  const safeParam = String(param ?? "");
  const sepIdx = safeParam.indexOf("-");

  return {
    source: sepIdx > 0 ? safeParam.substring(0, sepIdx) : safeParam,
    id: sepIdx > 0 ? safeParam.substring(sepIdx + 1) : "",
  };
}

export function buildMangaRoute(source: string, mangaHref: string): string {
  return `/manga/${source}-${encodeSourceHref(mangaHref)}`;
}

export function buildReadRoute(
  source: string,
  chapterHref: string,
  options: { mangaHref?: string } = {},
) {
  const route: {
    path: string;
    query?: Record<string, string>;
  } = {
    path: `/read/${source}-${encodeSourceHref(chapterHref)}`,
  };

  if (options.mangaHref) {
    route.query = {
      manga: encodeSourceHref(options.mangaHref),
    };
  }

  return route;
}

export function useSource() {
  const activeSourceId = useState<string>("activeSource", () => "shinigami");
  const mobileMenuOpen = useState<boolean>("mobileMenuOpen", () => false);

  const activeSource = computed(
    () => SOURCES.find((s) => s.id === activeSourceId.value) ?? SOURCES[0],
  );

  function setSource(id: string) {
    const source = SOURCES.find((s) => s.id === id);
    if (source) {
      activeSourceId.value = id;
    }
  }

  function toggleMobileMenu() {
    mobileMenuOpen.value = !mobileMenuOpen.value;
  }

  function closeMobileMenu() {
    mobileMenuOpen.value = false;
  }

  return {
    sources: SOURCES,
    activeSourceId,
    activeSource,
    setSource,
    mobileMenuOpen,
    toggleMobileMenu,
    closeMobileMenu,
  };
}
