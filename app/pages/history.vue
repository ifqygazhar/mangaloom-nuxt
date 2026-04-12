<template>
  <div class="mx-auto max-w-7xl px-4 py-8">
    <div class="mb-8 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
          History
        </h1>
        <p class="mt-1 text-sm text-text-tertiary">
          Your recently read manga chapters
        </p>
      </div>

      <button
        v-if="history.length > 0"
        class="flex items-center gap-2 rounded-lg bg-danger/10 px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/20"
        @click="clearHistory"
      >
        <Icon name="lucide:trash-2" size="16" />
        <span class="hidden sm:inline">Clear History</span>
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <Icon name="lucide:loader-2" size="32" class="animate-spin text-accent" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="history.length === 0"
      class="flex flex-col items-center justify-center py-16 text-center"
    >
      <div class="mb-4 flex size-16 items-center justify-center rounded-full bg-secondary">
        <Icon name="lucide:history" size="32" class="text-text-tertiary" />
      </div>
      <h3 class="text-lg font-semibold text-text-primary">No reading history</h3>
      <p class="mt-2 max-w-sm text-sm text-text-tertiary">
        Chapters you read will appear here automatically.
      </p>
      <NuxtLink
        to="/browse"
        class="mt-6 rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-accent-content transition-colors hover:bg-accent-hover"
      >
        Browse Manga
      </NuxtLink>
    </div>

    <!-- History list -->
    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="item in history"
        :key="item.id"
        class="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-tertiary/50 bg-secondary p-4 transition-all hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="mb-1 flex items-center gap-2">
              <span class="rounded bg-tertiary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                {{ item.source }}
              </span>
              <span class="text-xs text-text-tertiary">
                {{ formatDate(item.updatedAt) }}
              </span>
            </div>
            
            <h3 class="mb-1 line-clamp-1 font-semibold text-text-primary group-hover:text-accent transition-colors">
              <NuxtLink :to="buildMangaRoute(item.source, item.mangaHref)" class="before:absolute before:inset-0">
                {{ item.mangaTitle }}
              </NuxtLink>
            </h3>
            
            <p class="line-clamp-1 text-sm text-text-secondary">
              {{ item.chapterTitle }}
            </p>
          </div>

          <button
            class="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-text-tertiary opacity-0 transition-all hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
            title="Remove from history"
            @click.prevent="removeHistory(item.source, item.mangaHref)"
          >
            <Icon name="lucide:x" size="16" />
          </button>
        </div>

        <div class="mt-4 flex items-center gap-2">
          <NuxtLink
            :to="buildReadRoute(item.source, item.chapterHref, { mangaHref: item.mangaHref })"
            class="relative z-10 flex w-full items-center justify-center gap-2 rounded-lg bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-content"
          >
            <Icon name="lucide:book-open" size="16" />
            Continue Reading
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useHistory } from "~/composables/useHistory";
import { buildMangaRoute, buildReadRoute } from "~/composables/useSource";

useHead({
  title: "History - Mangaloom",
});

const { history, loading, removeHistory, clearHistory } = useHistory();

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  // Less than 24 hours
  if (diff < 86400000) {
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return mins <= 1 ? 'Just now' : `${mins}m ago`;
    }
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }
  
  // Less than 7 days
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }
  
  return date.toLocaleDateString(undefined, { 
    month: 'short', 
    day: 'numeric' 
  });
}
</script>