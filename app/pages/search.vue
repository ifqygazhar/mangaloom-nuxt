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
const results = ref<ComicItem[]>([]);
const pending = ref(false);
const error = ref<Error | null>(null);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let searchRequestId = 0;

watch(query, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    searchQuery.value = val.trim();
  }, 400);
});

watch([searchQuery, activeSourceId], async ([nextQuery, nextSource]) => {
  const requestId = ++searchRequestId;

  error.value = null;
  results.value = [];

  if (!nextQuery) {
    pending.value = false;
    return;
  }

  pending.value = true;

  try {
    const data = await $fetch<ComicItem[]>(
      `/api/manga/${nextSource}/search?q=${encodeURIComponent(nextQuery)}`,
    );

    if (requestId !== searchRequestId) {
      return;
    }

    results.value = data;
  } catch (err) {
    if (requestId !== searchRequestId) {
      return;
    }

    error.value = err as Error;
  } finally {
    if (requestId === searchRequestId) {
      pending.value = false;
    }
  }
});

function handleSearch() {
  if (debounceTimer) clearTimeout(debounceTimer);
  searchQuery.value = query.value.trim();
}

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>
