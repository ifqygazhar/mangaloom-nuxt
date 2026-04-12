<template>
  <footer class="border-t border-tertiary/50 bg-primary">
    <div class="mx-auto max-w-7xl px-4 py-8">
      <div class="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <!-- Brand -->
        <div class="flex items-center gap-2">
          <div
            class="flex size-7 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-content"
          >
            M
          </div>
          <span class="text-sm font-semibold text-text-primary">Mangaloom</span>
        </div>

        <!-- Links -->
        <div class="flex items-center gap-6">
          <NuxtLink
            v-for="link in footerLinks"
            :key="link.to"
            :to="link.to"
            class="text-xs text-text-tertiary transition-colors hover:text-text-secondary"
          >
            {{ link.label }}
          </NuxtLink>
          <a
            href="https://play.google.com/store/apps/details?id=id.mangaloom.app"
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs text-text-tertiary transition-colors hover:text-text-secondary"
          >
            Download App
          </a>
        </div>

        <!-- Copyright -->
        <p class="text-xs text-text-tertiary">
          © {{ new Date().getFullYear() }} Mangaloom
        </p>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
const footerLinks = [
  { label: "Home", to: "/" },
  { label: "Browse", to: "/browse" },
  { label: "Search", to: "/search" },
];
</script>
