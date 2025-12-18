<template>
  <div class="relative inline-block">
    <button
      @click="isOpen = !isOpen"
      @blur="handleBlur"
      class="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-brand-primary border-2 border-brand-primary rounded-full hover:bg-brand-primary hover:text-white transition-colors focus:outline-none focus:ring-3 focus:ring-brand-primary"
      :aria-label="`Help: ${title}`"
      :aria-expanded="isOpen"
      type="button"
    >
      ?
    </button>

    <Transition name="contextual-help">
      <div
        v-if="isOpen"
        :class="[
          'absolute z-50 w-64 p-4 bg-base-200 border-2 border-base-300 rounded-lg shadow-xl',
          positionClasses[position],
        ]"
        role="tooltip"
      >
        <div class="flex items-start justify-between mb-2">
          <h4 class="text-sm font-semibold text-text-primary">{{ title }}</h4>
          <button
            @click="isOpen = false"
            class="text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary rounded"
            aria-label="Close help"
            type="button"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <p class="text-sm text-text-secondary">{{ content }}</p>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const props = withDefaults(defineProps<Props>(), {
  position: 'top',
});

const isOpen = ref(false);

const positionClasses = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

const handleBlur = () => {
  setTimeout(() => {
    isOpen.value = false;
  }, 200);
};
</script>

<style scoped>
.contextual-help-enter-active,
.contextual-help-leave-active {
  transition: all 0.2s ease;
}

.contextual-help-enter-from,
.contextual-help-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
