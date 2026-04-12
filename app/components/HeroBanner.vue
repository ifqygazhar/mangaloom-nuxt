<script setup lang="ts">
import coverImageOne from "../assets/cover/image1.png";
import coverImageTwo from "../assets/cover/image2.png";
</script>

<template>
  <section class="relative overflow-hidden rounded-2xl bg-primary">
    <!-- Gradient bg -->
    <div
      class="absolute inset-0 bg-linear-to-br from-accent/20 via-primary to-primary"
    />
    <div class="absolute inset-y-0 right-0 hidden w-2/5 lg:block">
      <div class="absolute inset-y-6 right-10 w-52 overflow-hidden rounded-[2rem] opacity-10">
        <img
          :src="coverImageOne"
          alt=""
          class="h-full w-full object-cover"
        />
      </div>
    </div>
    <div
      class="absolute -right-20 -top-20 size-64 rounded-full bg-accent/10 blur-3xl"
    />
    <div
      class="absolute -bottom-10 -left-10 size-48 rounded-full bg-accent/5 blur-2xl"
    />

    <div class="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8 lg:p-12">
      <!-- Text content -->
      <div class="flex-1 space-y-3">
        <div class="flex items-center gap-2">
          <span
            class="inline-flex items-center rounded-full bg-accent/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent"
          >
            🔥 Trending
          </span>
        </div>
        <h1
          class="text-2xl font-extrabold leading-tight tracking-tight text-text-primary sm:text-3xl lg:text-4xl"
        >
          Discover Comics<br />
          <span class="bg-linear-to-r from-accent to-accent-hover bg-clip-text text-transparent">
            All in One Place
          </span>
        </h1>
        <p class="max-w-md text-sm leading-relaxed text-text-secondary sm:text-base">
          Read manga, manhwa, manhua and webtoons from multiple sources. Free and always updated.
        </p>
        <div class="flex flex-wrap gap-2 pt-1">
          <NuxtLink
            to="/browse"
            class="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-all hover:scale-[1.02] hover:bg-accent-hover hover:shadow-xl hover:shadow-accent/30"
          >
            <Icon name="lucide:compass" size="16" />
            Browse Now
          </NuxtLink>
          <NuxtLink
            to="/search"
            class="inline-flex items-center gap-1.5 rounded-full border border-tertiary bg-secondary px-4 py-2 text-sm font-semibold text-text-secondary transition-all hover:border-accent/30 hover:text-text-primary"
          >
            <Icon name="lucide:search" size="16" />
            Search
          </NuxtLink>
        </div>
      </div>

      <!-- Decorative manga cards (desktop) -->
      <div class="hidden shrink-0 lg:block">
        <div class="relative h-56 w-44">
          <div class="absolute inset-0 rounded-[1.75rem] bg-black/10 blur-2xl" />
          <div
            class="absolute left-1 top-6 h-44 w-32 -rotate-9 overflow-hidden rounded-2xl border border-white/10 bg-secondary shadow-2xl shadow-black/30"
          >
            <img
              :src="coverImageTwo"
              alt=""
              class="h-full w-full object-cover"
            />
            <div class="absolute inset-0 bg-linear-to-t from-black/35 via-transparent to-transparent" />
          </div>
          <div
            class="absolute right-0 top-0 h-[200px] w-[136px] rotate-6 overflow-hidden rounded-2xl border border-white/15 bg-tertiary shadow-2xl shadow-black/40"
          >
            <img
              :src="coverImageOne"
              alt=""
              class="h-full w-full object-cover"
            />
            <div class="absolute inset-0 bg-linear-to-t from-black/25 via-transparent to-transparent" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
