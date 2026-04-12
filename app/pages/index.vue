<template>
  <div class="mx-auto max-w-7xl space-y-6 px-4 py-4 sm:py-6">
    <!-- Hero -->
    <HeroBanner />

    <!-- Promo Banners -->
    <PromoBanners />

    <!-- Source selector -->
    <SourceSelector />

    <!-- Popular -->
    <ComicRow
      title="Popular"
      :comics="popular ?? []"
      :source="activeSourceId"
      :loading="popularPending"
      see-all-to="/browse?order=popular"
    />

    <!-- Recommended -->
    <ComicRow
      title="Recommended"
      :comics="recommended ?? []"
      :source="activeSourceId"
      :loading="recommendedPending"
      see-all-to="/browse?order=rating"
    />

    <!-- Newest -->
    <ComicRow
      title="Latest Updates"
      :comics="newest ?? []"
      :source="activeSourceId"
      :loading="newestPending"
      see-all-to="/browse?order=latest"
    />
  </div>
</template>

<script setup lang="ts">
import type { ComicItem } from "#lib/models/comic-item";

useHead({ title: "Home" });

const { activeSourceId } = useSource();

const { data: popular, pending: popularPending } = useFetch<ComicItem[]>(
  () => `/api/manga/${activeSourceId.value}/popular`,
  {
    key: computed(() => `popular-${activeSourceId.value}`),
    watch: [activeSourceId],
  },
);

const { data: recommended, pending: recommendedPending } = useFetch<
  ComicItem[]
>(() => `/api/manga/${activeSourceId.value}/recommended`, {
  key: computed(() => `recommended-${activeSourceId.value}`),
  watch: [activeSourceId],
});

const { data: newest, pending: newestPending } = useFetch<ComicItem[]>(
  () => `/api/manga/${activeSourceId.value}/newest`,
  {
    key: computed(() => `newest-${activeSourceId.value}`),
    watch: [activeSourceId],
  },
);
</script>
