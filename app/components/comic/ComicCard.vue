<template>
  <NuxtLink
    :to="`/manga/${source}-${encodeId(comic.href)}`"
    class="group relative flex flex-col overflow-hidden rounded-xl bg-secondary transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/30"
  >
    <!-- Thumbnail -->
    <div class="relative aspect-3/4 w-full overflow-hidden">
      <img
        :src="thumbnailSrc"
        :alt="comic.title"
        class="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
      />

      <!-- Gradient overlay -->
      <div
        class="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent"
      />

      <!-- Rating badge -->
      <div
        v-if="comic.rating"
        class="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 backdrop-blur-sm"
      >
        <Icon name="lucide:star" size="10" class="text-warning" />
        <span class="text-[10px] font-semibold text-warning">{{
          comic.rating
        }}</span>
      </div>

      <!-- Type badge -->
      <div
        v-if="comic.type"
        class="absolute left-2 top-2 rounded-full bg-accent/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent-content backdrop-blur-sm"
      >
        {{ comic.type }}
      </div>

      <!-- Title overlay (bottom) -->
      <div class="absolute inset-x-0 bottom-0 p-2.5">
        <h3
          class="line-clamp-2 text-xs font-semibold leading-snug text-white sm:text-sm"
        >
          {{ comic.title }}
        </h3>
        <p v-if="comic.chapter" class="mt-0.5 text-[10px] text-white/70">
          {{ comic.chapter }}
        </p>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { ComicItem } from "#lib/models/comic-item";

const props = defineProps<{
  comic: ComicItem;
  source: string;
}>();

const PROXY_SOURCES = ["webtoon"];

const thumbnailSrc = computed(() => {
  if (!props.comic.thumbnail) return "";
  if (PROXY_SOURCES.includes(props.source)) {
    return `/api/proxy/image?url=${encodeURIComponent(props.comic.thumbnail)}`;
  }
  return props.comic.thumbnail;
});

function encodeId(href: string): string {
  return encodeURIComponent(href.replace(/^\/|\/$/g, ""));
}
</script>
