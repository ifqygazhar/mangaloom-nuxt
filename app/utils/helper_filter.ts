// ─── Filter option types ──────────────────────────────────────────────────────

export interface FilterOption {
  /** Display label shown in the UI */
  label: string;
  /** Value sent to the API / parser */
  value: string;
}

export interface SourceFilterConfig {
  orders: FilterOption[];
  statuses: FilterOption[];
  types: FilterOption[];
}

// ─── Per-source filter configs ────────────────────────────────────────────────

const shinigamiFilter: SourceFilterConfig = {
  orders: [
    { label: "Popular", value: "popular" },
    { label: "Latest", value: "latest" },
    { label: "Rating", value: "rating" },
    { label: "A—Z", value: "alphabetical" },
  ],
  statuses: [
    { label: "Ongoing", value: "ongoing" },
    { label: "Completed", value: "completed" },
    { label: "Hiatus", value: "hiatus" },
  ],
  types: [
    { label: "Manga", value: "manga" },
    { label: "Manhwa", value: "manhwa" },
    { label: "Manhua", value: "manhua" },
  ],
};

const komikuFilter: SourceFilterConfig = {
  orders: [
    { label: "Popular", value: "meta_value_num" },
    { label: "Update", value: "modified" },
    { label: "A—Z", value: "titleasc" },
    { label: "Z—A", value: "titledesc" },
  ],
  statuses: [
    { label: "Ongoing", value: "Ongoing" },
    { label: "Completed", value: "Completed" },
  ],
  types: [
    { label: "Manga", value: "Manga" },
    { label: "Manhwa", value: "Manhwa" },
    { label: "Manhua", value: "Manhua" },
  ],
};

const flamecomicFilter: SourceFilterConfig = {
  orders: [
    { label: "A—Z", value: "alphabetical" },
  ],
  statuses: [],
  types: [],
};

const mangagoFilter: SourceFilterConfig = {
  orders: [
    { label: "Updated", value: "updated" },
    { label: "Popular", value: "popular" },
    { label: "Newest", value: "newest" },
    { label: "A—Z", value: "alphabetical" },
  ],
  statuses: [],
  types: [],
};

const manhwatopFilter: SourceFilterConfig = {
  orders: [
    { label: "Latest", value: "latest" },
    { label: "Popular", value: "popular" },
    { label: "Newest", value: "newest" },
    { label: "A—Z", value: "alphabetical" },
  ],
  statuses: [],
  types: [],
};

// ─── Registry ─────────────────────────────────────────────────────────────────

const filterConfigs: Record<string, SourceFilterConfig> = {
  shinigami: shinigamiFilter,
  komiku: komikuFilter,
  flamecomic: flamecomicFilter,
  mangago: mangagoFilter,
  manhwatop: manhwatopFilter,
};

/** Default filter config used when a source is not registered */
const defaultFilter: SourceFilterConfig = shinigamiFilter;

/**
 * Get the filter configuration for a given source.
 * Returns the source-specific config if available, otherwise the default.
 */
export function getFilterConfig(source: string): SourceFilterConfig {
  return filterConfigs[source] ?? defaultFilter;
}
