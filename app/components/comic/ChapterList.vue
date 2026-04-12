<template>
  <div class="space-y-1">
    <div class="flex items-center justify-between pb-2">
      <h3 class="text-sm font-bold text-text-primary">
        Chapters
        <span class="ml-1 text-xs font-normal text-text-tertiary">
          ({{ chapters.length }})
        </span>
      </h3>
      <button
        class="flex items-center gap-1 text-xs font-medium text-text-secondary transition-colors hover:text-accent"
        @click="reversed = !reversed"
      >
        <Icon
          :name="
            reversed
              ? 'lucide:arrow-up-narrow-wide'
              : 'lucide:arrow-down-wide-narrow'
          "
          size="14"
        />
        {{ reversed ? "Oldest first" : "Newest first" }}
      </button>
    </div>

    <SearchInput v-model="query" placeholder="Search chapter..." />

    <p v-if="query" class="pb-1 text-xs text-text-tertiary">
      Showing {{ displayedChapters.length }} of {{ chapters.length }} chapters
    </p>

    <div
      :class="[
        maxHeightClass,
        'space-y-0.5 overflow-y-auto rounded-xl bg-secondary p-1',
      ]"
    >
      <div
        v-if="displayedChapters.length === 0"
        class="flex min-h-28 items-center justify-center rounded-lg px-4 text-center text-sm text-text-tertiary"
      >
        No chapter found for "{{ query }}"
      </div>

      <NuxtLink
        v-for="chapter in displayedChapters"
        :key="chapter.href"
        :to="buildReadRoute(source, chapter.href, { mangaHref })"
        class="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors"
        :class="
          isActiveChapter(chapter.href)
            ? 'bg-accent/10 text-accent hover:bg-accent/15'
            : isReadChapter(chapter.href)
              ? 'text-green-500/80 hover:bg-surface-hover'
              : 'hover:bg-surface-hover'
        "
        @click="emit('select', chapter.href)"
      >
        <span
          class="line-clamp-1 flex-1 text-sm"
          :class="
            isActiveChapter(chapter.href)
              ? 'font-semibold text-accent'
              : isReadChapter(chapter.href)
                ? 'text-green-500/80'
                : 'text-text-primary'
          "
        >
          {{ chapter.title }}
        </span>
        <span
          v-if="chapter.date || isActiveChapter(chapter.href) || isReadChapter(chapter.href)"
          class="ml-3 shrink-0 text-[11px]"
          :class="
            isActiveChapter(chapter.href)
              ? 'font-semibold text-accent'
              : isReadChapter(chapter.href)
                ? 'text-green-500/60'
                : 'text-text-tertiary'
          "
        >
          {{ isActiveChapter(chapter.href) ? "Reading" : isReadChapter(chapter.href) ? "Read" : chapter.date }}
        </span>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Chapter } from "#lib/models/chapter";
import { buildReadRoute, normalizeSourceHref } from "~/composables/useSource";
import { useHistory } from "~/composables/useHistory";

const props = withDefaults(
  defineProps<{
    chapters: Chapter[];
    source: string;
    currentHref?: string;
    mangaHref?: string;
    maxHeightClass?: string;
  }>(),
  {
    currentHref: "",
    mangaHref: "",
    maxHeightClass: "max-h-[60vh]",
  },
);

const emit = defineEmits<{
  select: [href: string];
}>();

const { history } = useHistory();

const isReadChapter = (href: string) => {
  return history.value.some(
    (h) => h.source === props.source && h.mangaHref === props.mangaHref && h.chapterHref === normalizeSourceHref(href).replace(/^\/+|\/+$/g, '')
  );
};

const reversed = ref(false);
const query = ref("");

const displayedChapters = computed(() => {
  const keyword = query.value.trim().toLowerCase();
  const chapters = reversed.value
    ? [...props.chapters].reverse()
    : props.chapters;

  if (!keyword) return chapters;

  return chapters.filter((chapter) => {
    return [chapter.title, chapter.date].some((value) =>
      value?.toLowerCase().includes(keyword),
    );
  });
});

const normalizedCurrentHref = computed(() =>
  normalizeSourceHref(props.currentHref),
);

function isActiveChapter(href: string): boolean {
  return Boolean(
    normalizedCurrentHref.value &&
    normalizeSourceHref(href) === normalizedCurrentHref.value,
  );
}
</script>
