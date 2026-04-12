<template>
  <Teleport to="body">
    <Transition name="overlay">
      <div
        v-if="mobileMenuOpen"
        class="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm md:hidden"
        @click="closeMobileMenu"
      />
    </Transition>

    <Transition name="drawer">
      <aside
        v-if="mobileMenuOpen"
        class="fixed inset-y-0 right-0 z-70 flex w-72 flex-col bg-primary shadow-2xl md:hidden"
      >
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-tertiary/50 px-4 py-3">
          <span class="text-base font-bold text-text-primary">Menu</span>
          <button
            class="flex size-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-secondary"
            @click="closeMobileMenu"
            aria-label="Close menu"
          >
            <Icon name="lucide:x" size="18" />
          </button>
        </div>

        <!-- Source selector -->
        <div class="border-b border-tertiary/50 px-4 py-3">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            Source
          </p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="source in sources"
              :key="source.id"
              class="rounded-full px-3 py-1 text-xs font-medium transition-all"
              :class="
                activeSourceId === source.id
                  ? 'bg-accent text-white shadow-lg shadow-accent/25'
                  : 'bg-secondary text-text-secondary hover:bg-tertiary hover:text-text-primary'
              "
              @click="handleSourceSelect(source.id)"
            >
              <Icon :name="source.icon" size="14" />
              {{ source.name }}
            </button>
          </div>
        </div>

        <!-- Nav links -->
        <nav class="flex-1 px-2 py-3">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-secondary hover:text-text-primary"
            active-class="!bg-accent-muted !text-accent"
            @click="closeMobileMenu"
          >
            <Icon :name="link.icon" size="18" />
            {{ link.label }}
          </NuxtLink>
        </nav>
      </aside>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const { sources, activeSourceId, mobileMenuOpen, closeMobileMenu, setSource } =
  useSource();

const navLinks = [
  { label: "Home", to: "/", icon: "lucide:home" },
  { label: "Browse", to: "/browse", icon: "lucide:library" },
  { label: "Search", to: "/search", icon: "lucide:search" },
];

function handleSourceSelect(id: string) {
  setSource(id);
}
</script>

<style scoped>
.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.25s ease;
}
.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(100%);
}
</style>
