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
const status = ref((route.query.status as string) ?? "");
const type = ref((route.query.type as string) ?? "");
const page = ref(1);
const comics = ref<ComicItem[]>([]);
const pending = ref(false);
const error = ref<Error | null>(null);
const loadingMore = ref(false);

let browseRequestId = 0;

const browseFilters = computed(() => ({
  source: activeSourceId.value,
  order: order.value,
  status: status.value,
  type: type.value,
}));

function buildBrowseUrl(pageNumber: number) {
  const params = new URLSearchParams();

  if (browseFilters.value.order) params.set("order", browseFilters.value.order);
  if (browseFilters.value.status) params.set("status", browseFilters.value.status);
  if (browseFilters.value.type) params.set("type", browseFilters.value.type);

  params.set("page", pageNumber.toString());

  return `/api/manga/${browseFilters.value.source}/newest?${params.toString()}`;
}

function dedupeComics(items: ComicItem[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = item.href || item.title;
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function fetchBrowsePage(
  pageNumber: number,
  options: { append?: boolean } = {},
) {
  const requestId = ++browseRequestId;
  const append = options.append ?? false;

  error.value = null;

  if (append) {
    loadingMore.value = true;
  } else {
    pending.value = true;
    comics.value = [];
  }

  try {
    const fetchedComics = await $fetch<ComicItem[]>(buildBrowseUrl(pageNumber));

    if (requestId !== browseRequestId) {
      return;
    }

    comics.value = append
      ? dedupeComics([...comics.value, ...fetchedComics])
      : fetchedComics;
    page.value = pageNumber;
  } catch (err) {
    if (requestId !== browseRequestId) {
      return;
    }

    if (!append) {
      comics.value = [];
    }

    error.value = err as Error;
  } finally {
    if (requestId === browseRequestId) {
      pending.value = false;
      loadingMore.value = false;
    }
  }
}

await fetchBrowsePage(1);

// Reset filters when source changes (different sources have different filter options)
watch(activeSourceId, () => {
  order.value = "";
  status.value = "";
  type.value = "";
  page.value = 1;
  void fetchBrowsePage(1);
});

// Re-fetch when individual filters change (but NOT activeSourceId — handled above)
watch([order, status, type], () => {
  page.value = 1;
  void fetchBrowsePage(1);
});

async function loadMore() {
  if (pending.value || loadingMore.value) {
    return;
  }

  await fetchBrowsePage(page.value + 1, { append: true });
}
</script>
