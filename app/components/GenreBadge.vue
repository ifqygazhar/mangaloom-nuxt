<template>
  <span
    class="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-text-secondary transition-colors hover:bg-tertiary hover:text-text-primary"
  >
    {{ label }}
  </span>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
}>();
</script>
