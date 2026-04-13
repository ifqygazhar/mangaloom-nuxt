<template>
  <div class="mx-auto max-w-5xl px-4 py-4 sm:py-6">
    <!-- Loading -->
    <div v-if="pending" class="space-y-4">
      <div class="flex flex-col gap-4 sm:flex-row">
        <div class="skeleton h-72 w-48 shrink-0 rounded-xl sm:h-80 sm:w-52" />
        <div class="flex-1 space-y-3">
          <div class="skeleton h-8 w-3/4 rounded-lg" />
          <div class="skeleton h-4 w-1/2 rounded" />
          <div class="skeleton h-20 w-full rounded-lg" />
        </div>
      </div>
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="flex flex-col items-center justify-center gap-3 py-20"
    >
      <Icon name="lucide:alert-circle" size="48" class="text-danger" />
      <p class="text-sm text-danger">Failed to load comic details</p>
      <NuxtLink
        to="/"
        class="rounded-full bg-secondary px-4 py-2 text-sm font-medium text-text-secondary hover:bg-tertiary"
      >
        Go Home
      </NuxtLink>
    </div>

    <!-- Content -->
    <div v-else-if="detail" class="space-y-6">
      <!-- Back button -->
      <button
        class="flex items-center gap-1 text-sm text-text-secondary transition-colors hover:text-text-primary"
        @click="handleBack"
      >
        <Icon name="lucide:arrow-left" size="16" />
        Back
      </button>

      <!-- Hero section -->
      <div class="flex flex-col gap-5 sm:flex-row">
        <!-- Cover -->
        <div class="shrink-0 self-center sm:self-start">
          <img
            :src="coverSrc"
            :alt="detail.title"
            class="h-72 w-48 rounded-xl object-cover shadow-xl sm:h-80 sm:w-52"
          />
        </div>

        <!-- Info -->
        <div class="flex-1 space-y-3">
          <h1
            class="text-2xl font-extrabold leading-tight text-text-primary sm:text-3xl"
          >
            {{ detail.title }}
          </h1>

          <p v-if="detail.altTitle" class="text-sm text-text-tertiary">
            {{ detail.altTitle }}
          </p>

          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge v-if="detail.status" :label="detail.status" />
            <span v-if="detail.type" class="text-xs text-text-secondary">
              {{ detail.type }}
            </span>
            <span
              v-if="detail.rating"
              class="flex items-center gap-0.5 text-xs text-warning"
            >
              <Icon
                :name="source === 'komiku' ? 'lucide:eye' : 'lucide:star'"
                size="12"
              />
              {{
                source === "komiku" ? getMaxValue(detail.rating) : detail.rating
              }}
            </span>
          </div>

          <div class="flex flex-wrap gap-1">
            <GenreBadge
              v-for="genre in detail.genres"
              :key="genre.href"
              :label="genre.title"
            />
          </div>

          <div class="space-y-1 text-xs text-text-secondary">
            <p v-if="detail.author">
              <span class="font-medium text-text-tertiary">Author:</span>
              {{ detail.author }}
            </p>
            <p v-if="detail.released">
              <span class="font-medium text-text-tertiary">Released:</span>
              {{ detail.released }}
            </p>
          </div>

          <!-- Synopsis -->
          <div v-if="detail.description">
            <p
              class="text-sm leading-relaxed text-text-secondary"
              :class="{ 'line-clamp-4': !showFullDesc }"
            >
              {{ detail.description }}
            </p>
            <button
              v-if="detail.description.length > 200"
              class="mt-1 text-xs font-medium text-accent hover:text-accent-hover"
              @click="showFullDesc = !showFullDesc"
            >
              {{ showFullDesc ? "Show less" : "Show more" }}
            </button>
          </div>

          <div
            v-if="firstChapter || latestChapter"
            class="flex flex-wrap items-center gap-2 pt-1"
          >
            <NuxtLink
              v-if="firstChapter"
              :to="
                buildReadRoute(source, firstChapter.href, {
                  mangaHref: detail.href,
                })
              "
              class="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-content shadow-lg shadow-accent/25 transition-all hover:scale-[1.02] hover:bg-accent-hover"
            >
              <Icon name="lucide:book-open" size="16" />
              Read First Chapter
            </NuxtLink>

            <NuxtLink
              v-if="latestChapter"
              :to="
                buildReadRoute(source, latestChapter.href, {
                  mangaHref: detail.href,
                })
              "
              class="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-5 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-tertiary"
            >
              <Icon name="lucide:history" size="16" />
              Read Latest Chapter
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Chapters -->
      <ComicChapterList
        v-if="detail.chapters.length > 0"
        :chapters="detail.chapters"
        :manga-href="detail.href"
        :source="source"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ComicDetail } from "#lib/models/comic-detail";
import { buildReadRoute, parseSourceRouteParam } from "~/composables/useSource";

const route = useRoute();
const routeParts = computed(() =>
  parseSourceRouteParam(route.params.id as string),
);
const source = computed(() => routeParts.value.source);
const id = computed(() => routeParts.value.id);

const {
  data: detail,
  pending,
  error,
} = useFetch<ComicDetail>(
  () => `/api/manga/${source.value}/detail/${encodeURIComponent(id.value)}`,
  {
    watch: [source, id],
  },
);

useHead({
  title: computed(() => detail.value?.title ?? "Loading..."),
});

const router = useRouter();

function handleBack() {
  if (window.history.state && window.history.state.back) {
    const backRoute = window.history.state.back;
    // If coming from read page, go home instead of back to read page
    if (backRoute.startsWith("/read/")) {
      navigateTo("/", { replace: true });
      return;
    }
    router.back();
    return;
  }

  navigateTo("/", { replace: true });
}

const showFullDesc = ref(false);

const PROXY_SOURCES = ["webtoon", "manhwatop"];

const coverSrc = computed(() => {
  if (!detail.value?.thumbnail) return "";
  if (PROXY_SOURCES.includes(source.value)) {
    return `/api/proxy/image?url=${encodeURIComponent(detail.value.thumbnail)}&source=${source.value}`;
  }
  return detail.value.thumbnail;
});

const latestChapter = computed(() => detail.value?.chapters[0]);

const firstChapter = computed(() => {
  const chapters = detail.value?.chapters ?? [];
  return chapters.at(-1);
});
</script>
