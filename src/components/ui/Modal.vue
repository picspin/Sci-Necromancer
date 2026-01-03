<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 animate-fade-in"
      role="presentation"
      @click="handleBackdropClick"
    >
      <div
        ref="modalRef"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="title ? titleId : ariaLabel ? undefined : 'modal-dialog'"
        :aria-describedby="ariaDescribedBy || descId"
        :aria-label="!title ? ariaLabel : undefined"
        :class="[
          'bg-base-200 rounded-lg shadow-xl w-full max-h-[90vh] overflow-hidden animate-modal-show focus:outline-none focus:ring-3 focus:ring-brand-primary',
          sizeClasses[size],
        ]"
        tabindex="-1"
      >
        <!-- Header with title and close button -->
        <div v-if="title" class="flex items-center justify-between p-4 border-b border-base-300">
          <h2 :id="titleId" class="text-xl font-semibold text-text-primary">
            {{ title }}
          </h2>
          <button
            @click="emit('close')"
            class="text-text-secondary hover:text-text-primary transition-colors focus:outline-none focus:ring-3 focus:ring-brand-primary rounded-md p-1"
            aria-label="Close modal"
            type="button"
          >
            <svg
              class="w-6 h-6"
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

        <!-- Content -->
        <div :id="descId" class="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { trapFocus, createFocusManager, generateId } from '@/lib/utils/accessibilityUtils';

interface Props {
  isOpen?: boolean;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: true,
  size: 'md',
});

const emit = defineEmits<{
  close: [];
}>();

const modalRef = ref<HTMLDivElement | null>(null);
const focusManager = createFocusManager();
const titleId = generateId('modal-title');
const descId = generateId('modal-desc');

let cleanupFocusTrap: (() => void) | null = null;

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
};

const handleBackdropClick = (e: MouseEvent) => {
  // Close on backdrop click
  if (e.target === e.currentTarget) {
    emit('close');
  }
};

const handleEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    emit('close');
  }
};

const setupModal = async () => {
  if (!props.isOpen) return;

  // Save current focus
  try {
    focusManager.saveFocus?.();
  } catch {}

  // Prevent body scroll
  document.body.style.overflow = 'hidden';

  // Wait for DOM to update
  await nextTick();

  // Setup focus trap (temporarily disabled due to MutationObserver issues)
  // Intentionally skipping trapFocus to avoid runtime crashes on some environments.

  // Handle escape key
  document.addEventListener('keydown', handleEscape);
};

const cleanupModal = () => {
  // Remove escape key listener
  document.removeEventListener('keydown', handleEscape);

  // Restore body scroll
  document.body.style.overflow = '';

  // Cleanup focus trap
  if (cleanupFocusTrap) {
    cleanupFocusTrap();
    cleanupFocusTrap = null;
  }

  // Restore focus when modal closes
  focusManager.restoreFocus();
};

// Watch for isOpen changes
watch(
  () => props.isOpen,
  (newVal) => {
    if (newVal) {
      setupModal();
    } else {
      cleanupModal();
    }
  },
  { immediate: true }
);

// Cleanup on unmount
onUnmounted(() => {
  cleanupModal();
});
</script>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes modal-show {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}

.animate-modal-show {
  animation: modal-show 0.2s ease-out;
}
</style>
