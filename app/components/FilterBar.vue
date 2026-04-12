<template>
  <div class="space-y-3">
    <!-- Toggle button (mobile) -->
    <button
      class="flex w-full items-center justify-between rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-tertiary md:hidden"
      @click="open = !open"
    >
      <span class="flex items-center gap-2">
        <Icon name="lucide:sliders-horizontal" size="16" />
        Filters
      </span>
      <Icon
        :name="open ? 'lucide:chevron-up' : 'lucide:chevron-down'"
        size="16"
      />
    </button>

    <!-- Filter content -->
    <div
      :class="[
        'flex-wrap gap-2 md:flex',
        open ? 'flex' : 'hidden md:flex',
      ]"
    >
      <!-- Sort -->
      <select
        :value="modelOrder"
        class="rounded-lg border border-tertiary bg-secondary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent/50"
        @change="$emit('update:modelOrder', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">Sort by</option>
        <option value="popular">Popular</option>
        <option value="latest">Latest</option>
        <option value="rating">Rating</option>
        <option value="alphabetical">A—Z</option>
      </select>

      <!-- Status -->
      <select
        :value="modelStatus"
        class="rounded-lg border border-tertiary bg-secondary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent/50"
        @change="$emit('update:modelStatus', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">All Status</option>
        <option value="ongoing">Ongoing</option>
        <option value="completed">Completed</option>
        <option value="hiatus">Hiatus</option>
      </select>

      <!-- Type -->
      <select
        :value="modelType"
        class="rounded-lg border border-tertiary bg-secondary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent/50"
        @change="$emit('update:modelType', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">All Types</option>
        <option value="manga">Manga</option>
        <option value="manhwa">Manhwa</option>
        <option value="manhua">Manhua</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelOrder?: string;
  modelStatus?: string;
  modelType?: string;
}>();

defineEmits<{
  "update:modelOrder": [value: string];
  "update:modelStatus": [value: string];
  "update:modelType": [value: string];
}>();

const open = ref(false);
</script>
