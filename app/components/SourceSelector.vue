<template>
  <div class="scrollbar-hide flex gap-2 overflow-x-auto py-1">
    <button
      v-for="source in sources"
      :key="source.id"
      class="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200"
      :class="
        activeSourceId === source.id
          ? 'bg-accent text-accent-content shadow-lg shadow-accent/20 scale-[1.02]'
          : 'bg-secondary text-text-secondary hover:bg-tertiary hover:text-text-primary'
      "
      @click="setSource(source.id)"
    >
      <Icon :name="source.icon" size="14" />
      <span>{{ source.name }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
const { sources, activeSourceId, setSource } = useSource();
</script>
