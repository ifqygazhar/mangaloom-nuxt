<template>
  <nav
    class="sticky top-0 z-50 border-b border-tertiary/50 bg-primary/80 backdrop-blur-xl"
  >
    <div class="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 lg:h-16">
      <!-- Logo -->
      <NuxtLink to="/" class="flex shrink-0 items-center gap-2">
        <div
          class="flex size-8 items-center justify-center rounded-lg bg-accent font-bold text-white"
        >
          M
        </div>
        <span class="hidden text-lg font-bold tracking-tight text-text-primary sm:block">
          Mangaloom
        </span>
      </NuxtLink>

      <!-- Desktop nav links -->
      <div class="hidden items-center gap-1 md:flex">
        <NuxtLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="rounded-lg px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-secondary hover:text-text-primary"
          active-class="!bg-accent-muted !text-accent"
        >
          {{ link.label }}
        </NuxtLink>
      </div>

      <div class="flex-1" />

      <!-- Search (desktop) -->
      <NuxtLink
        to="/search"
        class="flex size-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-secondary hover:text-text-primary"
      >
        <Icon name="lucide:search" size="18" />
      </NuxtLink>

      <!-- Source badge (desktop) -->
      <div class="hidden items-center md:flex">
        <span
          class="flex items-center gap-1.5 rounded-full bg-accent-muted px-2.5 py-0.5 text-xs font-semibold text-accent"
        >
          <Icon :name="activeSource.icon" size="12" />
          {{ activeSource.name }}
        </span>
      </div>

      <!-- Mobile menu toggle -->
      <button
        class="flex size-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-secondary hover:text-text-primary md:hidden"
        @click="toggleMobileMenu"
        aria-label="Toggle menu"
      >
        <Icon name="lucide:menu" size="20" />
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
const { activeSource, toggleMobileMenu } = useSource();

const navLinks = [
  { label: "Home", to: "/" },
  { label: "Browse", to: "/browse" },
];
</script>
