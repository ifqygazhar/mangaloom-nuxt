<template>
  <section class="relative overflow-hidden rounded-2xl bg-primary">
    <!-- Gradient bg -->
    <div
      class="absolute inset-0 bg-linear-to-br from-accent/20 via-primary to-primary"
    />
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
        <div class="relative h-52 w-40">
          <div
            class="absolute left-0 top-4 h-44 w-32 -rotate-6 rounded-xl bg-secondary shadow-xl"
          />
          <div
            class="absolute left-4 top-0 h-48 w-34 rotate-3 rounded-xl bg-tertiary shadow-2xl"
          />
        </div>
      </div>
    </div>
  </section>
</template>
