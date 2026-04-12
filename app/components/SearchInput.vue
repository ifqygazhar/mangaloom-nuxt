<template>
  <div class="relative">
    <Icon
      name="lucide:search"
      size="18"
      class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
    />
    <input
      ref="inputRef"
      :value="modelValue"
      type="text"
      :placeholder="placeholder"
      class="w-full rounded-xl border border-tertiary bg-secondary py-2.5 pl-10 pr-9 text-sm text-text-primary outline-none transition-all placeholder:text-text-tertiary focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
      @input="handleInput"
      @keydown.enter="$emit('submit')"
    />
    <button
      v-if="modelValue"
      class="absolute right-2.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-tertiary hover:text-text-secondary"
      @click="$emit('update:modelValue', '')"
      aria-label="Clear search"
    >
      <Icon name="lucide:x" size="14" />
    </button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: string;
  placeholder?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  submit: [];
}>();

const inputRef = ref<HTMLInputElement | null>(null);

function handleInput(e: Event) {
  emit("update:modelValue", (e.target as HTMLInputElement).value);
}

function focus() {
  inputRef.value?.focus();
}

defineExpose({ focus });
</script>
