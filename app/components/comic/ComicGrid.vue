<template>
  <!-- Loading skeleton grid -->
  <div
    v-if="loading"
    class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
  >
    <div v-for="i in skeletonCount" :key="i">
      <div class="skeleton aspect-3/4 w-full rounded-xl" />
    </div>
  </div>

  <!-- Results grid -->
  <div
    v-else-if="comics.length > 0"
    class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
  >
    <ComicCard
      v-for="comic in comics"
      :key="comic.href"
      :comic="comic"
      :source="source"
    />
  </div>

  <!-- Empty state -->
  <div
    v-else
    class="flex flex-col items-center justify-center gap-3 py-20"
  >
    <Icon name="lucide:book-open" size="48" class="text-text-tertiary" />
    <p class="text-sm text-text-tertiary">{{ emptyMessage }}</p>
  </div>
</template>

<script setup lang="ts">
import type { ComicItem } from "#lib/models/comic-item";

withDefaults(
  defineProps<{
    comics: ComicItem[];
    source: string;
    loading?: boolean;
    skeletonCount?: number;
    emptyMessage?: string;
  }>(),
  {
    loading: false,
    skeletonCount: 10,
    emptyMessage: "No comics found",
  },
);
</script>
