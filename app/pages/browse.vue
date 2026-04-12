<template>
  <div class="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:py-6">
    <div>
      <h1 class="text-xl font-bold text-text-primary sm:text-2xl">Browse</h1>
      <p class="mt-0.5 text-sm text-text-secondary">
        Explore comics from {{ activeSource.name }}
      </p>
    </div>

    <!-- Source selector -->
    <SourceSelector />

    <!-- Filters -->
    <FilterBar
      v-model:model-order="order"
      v-model:model-status="status"
      v-model:model-type="type"
    />

    <!-- Results -->
    <ComicGrid
      :comics="comics ?? []"
      :source="activeSourceId"
      :loading="pending"
      :empty-message="error ? 'Failed to load comics' : 'No comics found'"
    />

    <!-- Load more -->
    <div v-if="comics && comics.length > 0" class="flex justify-center pb-4">
      <button
        class="rounded-full bg-secondary px-6 py-2.5 text-sm font-semibold text-text-secondary transition-all hover:bg-tertiary hover:text-text-primary"
        :class="{ 'opacity-50 pointer-events-none': loadingMore }"
        @click="loadMore"
      >
        <span v-if="loadingMore" class="flex items-center gap-2">
          <Icon name="lucide:loader-2" size="16" class="animate-spin" />
          Loading...
        </span>
        <span v-else>Load More</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ComicItem } from "#lib/models/comic-item";

useHead({ title: "Browse" });

const { activeSourceId, activeSource } = useSource();

const route = useRoute();
const order = ref((route.query.order as string) ?? "");
const status = ref("");
const type = ref("");
const page = ref(1);

// Reset page on filter/source change
watch([order, status, type, activeSourceId], () => {
  page.value = 1;
});

const apiUrl = computed(() => {
  const params = new URLSearchParams();
  if (order.value) params.set("order", order.value);
  if (status.value) params.set("status", status.value);
  if (type.value) params.set("type", type.value);
  params.set("page", page.value.toString());
  return `/api/manga/${activeSourceId.value}/newest?${params.toString()}`;
});

const {
  data: comics,
  pending,
  error,
} = useFetch<ComicItem[]>(apiUrl, {
  watch: [apiUrl],
});

const loadingMore = ref(false);

async function loadMore() {
  loadingMore.value = true;
  try {
    page.value++;
    const newComics = await $fetch<ComicItem[]>(
      `/api/manga/${activeSourceId.value}/newest?page=${page.value}`,
    );
    if (newComics.length > 0 && comics.value) {
      comics.value = [...comics.value, ...newComics];
    }
  } catch {
    // Silently handle
  } finally {
    loadingMore.value = false;
  }
}
</script>
