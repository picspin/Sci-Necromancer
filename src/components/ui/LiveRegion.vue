<template>
  <div role="status" :aria-live="priority" aria-atomic="true" class="sr-only">
    {{ currentMessage }}
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';

interface Props {
  message: string;
  priority?: 'polite' | 'assertive';
  clearAfter?: number;
}

const props = withDefaults(defineProps<Props>(), {
  priority: 'polite',
  clearAfter: 3000,
});

const currentMessage = ref(props.message);
let timerId: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.message,
  (newMessage) => {
    currentMessage.value = newMessage;

    // Clear previous timer
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }

    // Set new timer to clear message
    if (props.clearAfter > 0 && newMessage) {
      timerId = setTimeout(() => {
        currentMessage.value = '';
      }, props.clearAfter);
    }
  }
);

onUnmounted(() => {
  if (timerId) {
    clearTimeout(timerId);
  }
});
</script>

<style scoped>
/* sr-only is defined in index.html global styles */
</style>
