<template>
  <div class="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:py-6">
    <div>
      <h1 class="text-xl font-bold text-text-primary sm:text-2xl">Search</h1>
      <p class="mt-0.5 text-sm text-text-secondary">
        Find comics from {{ activeSource.name }}
      </p>
    </div>

    <!-- Search input -->
    <SearchInput
      v-model="query"
      placeholder="Search comics..."
      @submit="handleSearch"
    />

    <!-- Source selector -->
    <SourceSelector />

    <!-- Results -->
    <ComicGrid
      v-if="searchQuery"
      :comics="results ?? []"
      :source="activeSourceId"
      :loading="pending"
      :empty-message="error ? 'Search failed' : 'No results found'"
    />

    <!-- Initial state -->
    <div
      v-else
      class="flex flex-col items-center justify-center gap-3 py-20"
    >
      <Icon name="lucide:search" size="48" class="text-text-tertiary" />
      <p class="text-sm text-text-tertiary">
        Type something to search
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ComicItem } from "#lib/models/comic-item";

useHead({ title: "Search" });

const { activeSourceId, activeSource } = useSource();

const query = ref("");
const searchQuery = ref("");
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

watch(query, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    searchQuery.value = val.trim();
  }, 400);
});

// Reset search when source changes
watch(activeSourceId, () => {
  if (searchQuery.value) {
    searchQuery.value = searchQuery.value; // trigger refetch
  }
});

function handleSearch() {
  if (debounceTimer) clearTimeout(debounceTimer);
  searchQuery.value = query.value.trim();
}

const {
  data: results,
  pending,
  error,
} = useFetch<ComicItem[]>(
  () =>
    searchQuery.value
      ? `/api/manga/${activeSourceId.value}/search?q=${encodeURIComponent(searchQuery.value)}`
      : "",
  {
    watch: [searchQuery, activeSourceId],
    immediate: false,
  },
);
</script>
