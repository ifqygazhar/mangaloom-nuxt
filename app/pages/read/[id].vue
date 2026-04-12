<template>
  <!-- Loading -->
  <div v-if="pending" class="flex h-dvh items-center justify-center bg-surface">
    <Icon name="lucide:loader-2" size="32" class="animate-spin text-accent" />
  </div>

  <!-- Error -->
  <div
    v-else-if="error || !chapter"
    class="flex h-dvh flex-col items-center justify-center gap-3 bg-surface"
  >
    <Icon name="lucide:alert-circle" size="48" class="text-danger" />
    <p class="text-sm text-danger">Failed to load chapter</p>
    <button
      class="rounded-full bg-secondary px-4 py-2 text-sm font-medium text-text-secondary hover:bg-tertiary"
      @click="handleBack"
    >
      Go Back
    </button>
  </div>

  <!-- Reader -->
  <div
    v-else
    ref="readerRoot"
    class="bg-black text-white"
    :class="
      isFullscreen
        ? 'h-screen overflow-x-hidden overflow-y-auto overscroll-y-contain'
        : 'min-h-dvh'
    "
  >
    <!-- Top bar -->
    <div
      v-if="!isFullscreen"
      class="sticky top-0 z-40 border-b border-white/10 bg-black/70 backdrop-blur-lg transition-opacity duration-300"
      :class="{ 'pointer-events-none opacity-0': hideUI }"
    >
      <div
        class="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2"
      >
        <button
          class="flex size-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
          @click="handleBack"
        >
          <Icon name="lucide:arrow-left" size="18" />
        </button>

        <div class="min-w-0 flex-1 text-center">
          <h1 class="line-clamp-1 text-xs font-medium text-white/85">
            {{ chapter.title }}
          </h1>
          <p
            v-if="mangaDetail?.title"
            class="line-clamp-1 text-[11px] text-white/45"
          >
            {{ mangaDetail.title }}
          </p>
        </div>

        <div class="flex items-center gap-1">
          <button
            v-if="hasMangaContext"
            class="flex size-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
            @click="chapterPanelOpen = true"
          >
            <Icon name="lucide:list" size="18" />
          </button>

          <button
            v-if="fullscreenSupported"
            :title="fullscreenButtonLabel"
            class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            @click="toggleFullscreen"
          >
            <Icon
              :name="isFullscreen ? 'lucide:minimize' : 'lucide:maximize'"
              size="18"
            />
            <span class="hidden text-xs font-medium sm:inline">
              {{ isFullscreen ? "Exit Fullscreen" : "Fullscreen" }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- Panels + chapter sidebar -->
    <div
      class="mx-auto flex gap-4"
      :class="
        isFullscreen
          ? 'max-w-none px-4 md:px-8 lg:px-16 xl:px-24'
          : 'max-w-6xl lg:px-4'
      "
    >
      <div class="min-w-0 flex-1" @click="handleReaderTap">
        <div
          class="mx-auto"
          :class="isFullscreen ? 'max-w-[1100px]' : 'max-w-3xl'"
        >
          <img
            v-for="(panel, idx) in chapter.panel"
            :key="idx"
            :src="proxyPanel(panel)"
            :alt="`Page ${idx + 1}`"
            :class="isFullscreen ? 'w-full lg:px-55' : 'w-full lg:px-36'"
            loading="lazy"
          />
        </div>
      </div>

      <aside
        v-if="hasMangaContext && !isFullscreen"
        class="sticky top-16 hidden h-[calc(100dvh-5rem)] w-80 shrink-0 self-start overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm lg:flex lg:flex-col"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-white">Chapters</p>
            <p class="line-clamp-1 text-xs text-white/45">
              {{ mangaDetail?.title || "Loading chapter list..." }}
            </p>
          </div>
        </div>

        <div
          v-if="firstChapter || latestChapter"
          class="mt-3 flex flex-wrap gap-2"
        >
          <NuxtLink
            v-if="firstChapter"
            :to="buildReadRoute(source, firstChapter.href, { mangaHref })"
            class="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            <Icon name="lucide:book-open" size="14" />
            First
          </NuxtLink>

          <NuxtLink
            v-if="latestChapter"
            :to="buildReadRoute(source, latestChapter.href, { mangaHref })"
            class="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/85 transition-colors hover:bg-white/15"
          >
            <Icon name="lucide:history" size="14" />
            Latest
          </NuxtLink>
        </div>

        <div class="mt-4 min-h-0 flex-1">
          <ComicChapterList
            v-if="hasChapterList"
            :chapters="mangaDetail.chapters"
            :current-href="currentChapterHref"
            :manga-href="mangaHref"
            max-height-class="max-h-[calc(100dvh-14rem)]"
            :source="source"
          />

          <div
            v-else
            class="flex h-full items-center justify-center rounded-xl bg-white/5 px-4 text-center text-sm text-white/45"
          >
            {{
              mangaPending
                ? "Loading chapter list..."
                : "Chapter list is unavailable for this chapter."
            }}
          </div>
        </div>
      </aside>
    </div>

    <!-- Bottom nav -->
    <div
      v-if="!isFullscreen"
      class="sticky bottom-0 z-40 border-t border-white/10 bg-black/70 backdrop-blur-lg transition-opacity duration-300"
      :class="{ 'pointer-events-none opacity-0': hideUI }"
    >
      <div
        class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3"
      >
        <NuxtLink
          v-if="chapter.prev"
          :to="buildReadRoute(source, chapter.prev, { mangaHref })"
          class="flex items-center gap-1 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur transition-colors hover:bg-white/20"
        >
          <Icon name="lucide:chevron-left" size="14" />
          Prev
        </NuxtLink>
        <div v-else />

        <div class="flex items-center gap-2">
          <button
            v-if="fullscreenSupported"
            class="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-white/20"
            @click="toggleFullscreen"
          >
            {{ isFullscreen ? "Exit Fullscreen" : "Fullscreen" }}
          </button>

          <button
            v-if="hasMangaContext"
            class="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-white/20 lg:hidden"
            @click="chapterPanelOpen = true"
          >
            Chapters
          </button>

          <span class="text-xs text-white/40">
            {{ chapter.panel.length }} pages
          </span>
        </div>

        <NuxtLink
          v-if="chapter.next"
          :to="buildReadRoute(source, chapter.next, { mangaHref })"
          class="flex items-center gap-1 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur transition-colors hover:bg-white/20"
        >
          Next
          <Icon name="lucide:chevron-right" size="14" />
        </NuxtLink>
        <div v-else />
      </div>
    </div>

    <!-- Mobile chapter sheet -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="chapterPanelOpen && hasMangaContext && !isFullscreen"
        class="fixed inset-0 z-50 bg-black/75 px-3 py-4 backdrop-blur-sm lg:hidden"
        @click.self="chapterPanelOpen = false"
      >
        <div
          class="mx-auto flex h-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#050505] p-4 shadow-2xl"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-white">Chapters</p>
              <p class="line-clamp-2 text-xs text-white/45">
                {{ mangaDetail?.title || "Loading chapter list..." }}
              </p>
            </div>

            <button
              class="flex size-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
              @click="chapterPanelOpen = false"
            >
              <Icon name="lucide:x" size="18" />
            </button>
          </div>

          <div
            v-if="firstChapter || latestChapter"
            class="mt-4 flex flex-wrap gap-2"
          >
            <NuxtLink
              v-if="firstChapter"
              :to="buildReadRoute(source, firstChapter.href, { mangaHref })"
              class="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-content transition-colors hover:bg-accent-hover"
              @click="chapterPanelOpen = false"
            >
              <Icon name="lucide:book-open" size="14" />
              First
            </NuxtLink>

            <NuxtLink
              v-if="latestChapter"
              :to="buildReadRoute(source, latestChapter.href, { mangaHref })"
              class="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/85 transition-colors hover:bg-white/15"
              @click="chapterPanelOpen = false"
            >
              <Icon name="lucide:history" size="14" />
              Latest
            </NuxtLink>
          </div>

          <div class="mt-4 min-h-0 flex-1">
            <ComicChapterList
              v-if="hasChapterList"
              :chapters="mangaDetail.chapters"
              :current-href="currentChapterHref"
              :manga-href="mangaHref"
              max-height-class="max-h-[calc(100dvh-14rem)]"
              :source="source"
              @select="chapterPanelOpen = false"
            />

            <div
              v-else
              class="flex h-full items-center justify-center rounded-xl bg-white/5 px-4 text-center text-sm text-white/45"
            >
              {{
                mangaPending
                  ? "Loading chapter list..."
                  : "Chapter list is unavailable for this chapter."
              }}
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { ComicDetail } from "#lib/models/comic-detail";
import type { ReadChapter } from "#lib/models/read-chapter";
import {
  buildMangaRoute,
  buildReadRoute,
  decodeSourceHref,
  parseSourceRouteParam,
} from "~/composables/useSource";

import { useHistory } from "~/composables/useHistory";

definePageMeta({ layout: false });

const route = useRoute();
const router = useRouter();

const { saveHistory } = useHistory();

const routeParts = computed(() =>
  parseSourceRouteParam(route.params.id as string),
);
const source = computed(() => routeParts.value.source);
const id = computed(() => routeParts.value.id);

const chapterUrl = computed(
  () => `/api/manga/${source.value}/chapter/${id.value}`,
);

const {
  data: chapter,
  pending,
  error,
} = useFetch<ReadChapter>(chapterUrl, {
  watch: [chapterUrl],
});

const mangaParam = computed(() => {
  const value = route.query.manga;
  if (Array.isArray(value)) return value[0] ?? "";
  return typeof value === "string" ? value : "";
});

const mangaHref = computed(() => decodeSourceHref(mangaParam.value));
const hasMangaContext = computed(() => Boolean(mangaHref.value));

const { data: mangaDetail, pending: mangaPending } =
  useAsyncData<ComicDetail | null>(
    () => `reader-manga-${source.value}-${mangaParam.value || "none"}`,
    async () => {
      if (!mangaParam.value) return null;
      return await $fetch<ComicDetail>(
        `/api/manga/${source.value}/detail/${mangaParam.value}`,
      );
    },
    {
      watch: [source, mangaParam],
    },
  );

// Save to history when chapter and manga detail are loaded
watch([chapter, mangaDetail], ([newChapter, newMangaDetail]) => {
  if (newChapter && newMangaDetail && mangaHref.value) {
    saveHistory({
      source: source.value,
      mangaHref: mangaHref.value,
      mangaTitle: newMangaDetail.title,
      chapterHref: id.value,
      chapterTitle: newChapter.title,
    });
  }
});

useHead({
  title: computed(() => chapter.value?.title ?? "Reading..."),
});

const hideUI = ref(false);
const chapterPanelOpen = ref(false);
const readerRoot = ref<HTMLElement | null>(null);
const isFullscreen = ref(false);
const fullscreenSupported = ref(false);
const lastReaderTapAt = ref(0);

const currentChapterHref = computed(() => decodeSourceHref(id.value));
const hasChapterList = computed(
  () => (mangaDetail.value?.chapters.length ?? 0) > 0,
);
const latestChapter = computed(() => mangaDetail.value?.chapters[0]);
const firstChapter = computed(() => {
  const chapters = mangaDetail.value?.chapters ?? [];
  return chapters.at(-1);
});
const mangaDetailRoute = computed(() => {
  if (!mangaHref.value) return "";
  return buildMangaRoute(source.value, mangaHref.value);
});
const fullscreenButtonLabel = computed(() => {
  return isFullscreen.value ? "Exit fullscreen (F)" : "Enter fullscreen (F)";
});

watch(chapterPanelOpen, (open) => {
  if (open) hideUI.value = false;
});

watch(
  () => route.fullPath,
  () => {
    hideUI.value = false;
    chapterPanelOpen.value = false;
    lastReaderTapAt.value = 0;
  },
);

watch(isFullscreen, (fullscreen) => {
  hideUI.value = fullscreen;

  if (fullscreen) {
    chapterPanelOpen.value = false;
    lastReaderTapAt.value = 0;
    return;
  }

  hideUI.value = false;
});

function handleBack() {
  if (window.history.state && window.history.state.back) {
    router.back();
    return;
  }

  if (mangaDetailRoute.value) {
    navigateTo(mangaDetailRoute.value, { replace: true });
    return;
  }

  navigateTo('/', { replace: true });
}

async function toggleFullscreen() {
  if (!import.meta.client || !fullscreenSupported.value) return;

  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
    webkitFullscreenElement?: Element | null;
  };
  const element = readerRoot.value as
    | (HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
      })
    | null;

  if (doc.fullscreenElement || doc.webkitFullscreenElement) {
    if (doc.exitFullscreen) {
      await doc.exitFullscreen();
      return;
    }

    await doc.webkitExitFullscreen?.();
    return;
  }

  if (element?.requestFullscreen) {
    await element.requestFullscreen();
    return;
  }

  await element?.webkitRequestFullscreen?.();
}

function handleReaderTap() {
  if (!isFullscreen.value) {
    hideUI.value = !hideUI.value;
    return;
  }

  const now = Date.now();
  if (now - lastReaderTapAt.value <= 320) {
    lastReaderTapAt.value = 0;
    void toggleFullscreen();
    return;
  }

  lastReaderTapAt.value = now;
}

function syncFullscreenState() {
  if (!import.meta.client) return;
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
  };
  isFullscreen.value = Boolean(
    document.fullscreenElement || doc.webkitFullscreenElement,
  );

  if (!isFullscreen.value) {
    lastReaderTapAt.value = 0;
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (!fullscreenSupported.value) return;
  if (event.defaultPrevented || event.repeat) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key.toLowerCase() !== "f") return;

  const target = event.target;
  if (
    target instanceof HTMLElement &&
    target.closest("input, textarea, select, [contenteditable='true']")
  ) {
    return;
  }

  event.preventDefault();
  void toggleFullscreen();
}

const PROXY_SOURCES = ["webtoon"];

function proxyPanel(url: string): string {
  if (PROXY_SOURCES.includes(source.value)) {
    return `/api/proxy/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

onMounted(() => {
  const doc = document as Document & {
    webkitFullscreenEnabled?: boolean;
  };
  fullscreenSupported.value = Boolean(
    doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? true,
  );
  syncFullscreenState();
  document.addEventListener("fullscreenchange", syncFullscreenState);
  document.addEventListener(
    "webkitfullscreenchange",
    syncFullscreenState as EventListener,
  );
  document.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
  if (!import.meta.client) return;
  document.removeEventListener("fullscreenchange", syncFullscreenState);
  document.removeEventListener(
    "webkitfullscreenchange",
    syncFullscreenState as EventListener,
  );
  document.removeEventListener("keydown", handleKeydown);
});
</script>
