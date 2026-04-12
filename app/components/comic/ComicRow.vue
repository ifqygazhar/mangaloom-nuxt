<template>
  <section>
    <!-- Header -->
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-base font-bold text-text-primary sm:text-lg">
        {{ title }}
      </h2>
      <NuxtLink
        v-if="seeAllTo"
        :to="seeAllTo"
        class="flex items-center gap-0.5 text-xs font-semibold text-accent transition-colors hover:text-accent-hover"
      >
        See All
        <Icon name="lucide:chevron-right" size="14" />
      </NuxtLink>
    </div>

    <!-- Scrollable row -->
    <div
      v-if="!loading && comics.length > 0"
      class="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 pb-1"
    >
      <div
        v-for="comic in comics"
        :key="comic.href"
        class="w-32 shrink-0 sm:w-36 md:w-40"
      >
        <ComicCard :comic="comic" :source="source" />
      </div>
    </div>

    <!-- Loading skeleton -->
    <div
      v-else-if="loading"
      class="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 pb-1"
    >
      <div
        v-for="i in 6"
        :key="i"
        class="w-32 shrink-0 sm:w-36 md:w-40"
      >
        <div class="skeleton aspect-3/4 w-full rounded-xl" />
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else
      class="flex h-36 items-center justify-center rounded-xl border border-dashed border-tertiary"
    >
      <p class="text-sm text-text-tertiary">No comics found</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ComicItem } from "#lib/models/comic-item";

defineProps<{
  title: string;
  comics: ComicItem[];
  source: string;
  loading?: boolean;
  seeAllTo?: string;
}>();
</script>
