<template>
  <span
    class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
    :class="colorClass"
  >
    {{ label }}
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{
  label: string;
}>();

const colorClass = computed(() => {
  const l = props.label.toLowerCase();
  if (l.includes("ongoing")) return "bg-success/15 text-success";
  if (l.includes("completed")) return "bg-accent/15 text-accent";
  if (l.includes("hiatus")) return "bg-warning/15 text-warning";
  if (l.includes("cancelled") || l.includes("dropped"))
    return "bg-danger/15 text-danger";
  return "bg-tertiary text-text-secondary";
});
</script>
