<template>
  <div
    class="flex flex-col items-center justify-center h-full text-text-secondary animate-fade-in"
    role="status"
    :aria-label="message"
  >
    <SvgIcon
      type="loader"
      class="h-12 w-12 animate-spin text-brand-primary mb-4"
      aria-hidden="true"
    />
    <p class="text-lg font-semibold" aria-live="polite">{{ message }}</p>
    <p class="text-sm">This may take a few moments.</p>
  </div>
</template>

<script setup lang="ts">
import SvgIcon from '@/components/ui/SvgIcon.vue';

interface Props {
  message?: string;
}

withDefaults(defineProps<Props>(), {
  message: 'Generating Content...',
});
</script>
