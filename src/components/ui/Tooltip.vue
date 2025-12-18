<template>
  <div class="relative inline-block">
    <div
      @mouseenter="showTooltip"
      @mouseleave="hideTooltip"
      @focus="showTooltip"
      @blur="hideTooltip"
      :aria-describedby="tooltipId"
    >
      <slot />
    </div>
    <Transition name="tooltip">
      <div
        v-if="isVisible"
        :id="tooltipId"
        role="tooltip"
        :class="[
          'absolute z-50 px-3 py-2 text-sm text-white bg-base-300 rounded-md shadow-lg pointer-events-none',
          positionClasses[position],
        ]"
        :style="{ maxWidth: `${maxWidth}px` }"
      >
        {{ content }}
        <div :class="['absolute w-0 h-0 border-4', arrowClasses[position]]" aria-hidden="true" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import { generateId } from '@/lib/utils/accessibilityUtils';

interface Props {
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  maxWidth?: number;
}

const props = withDefaults(defineProps<Props>(), {
  position: 'top',
  delay: 300,
  maxWidth: 250,
});

const isVisible = ref(false);
const tooltipId = generateId('tooltip');
let timeoutId: ReturnType<typeof setTimeout> | null = null;

const positionClasses = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

const arrowClasses = {
  top: 'top-full left-1/2 -translate-x-1/2 border-t-base-300 border-l-transparent border-r-transparent border-b-transparent',
  bottom:
    'bottom-full left-1/2 -translate-x-1/2 border-b-base-300 border-l-transparent border-r-transparent border-t-transparent',
  left: 'left-full top-1/2 -translate-y-1/2 border-l-base-300 border-t-transparent border-b-transparent border-r-transparent',
  right:
    'right-full top-1/2 -translate-y-1/2 border-r-base-300 border-t-transparent border-b-transparent border-l-transparent',
};

const showTooltip = () => {
  timeoutId = setTimeout(() => {
    isVisible.value = true;
  }, props.delay);
};

const hideTooltip = () => {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  isVisible.value = false;
};

onUnmounted(() => {
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
});
</script>

<style scoped>
.tooltip-enter-active,
.tooltip-leave-active {
  transition: opacity 0.2s ease;
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
}
</style>
