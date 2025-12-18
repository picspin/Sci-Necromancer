<template>
  <Modal
    :is-open="isOpen"
    @close="emit('close')"
    title="Accessibility Settings"
    size="md"
    aria-label="Accessibility settings dialog"
  >
    <div class="space-y-6">
      <!-- High Contrast Mode -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-semibold text-text-primary">High Contrast Mode</h3>
            <p class="text-sm text-text-secondary">Increase contrast for better visibility</p>
          </div>
          <button
            @click="toggleHighContrast"
            :class="[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-3 focus:ring-brand-primary',
              isHighContrast ? 'bg-brand-primary' : 'bg-base-300',
            ]"
            role="switch"
            :aria-checked="isHighContrast"
            aria-label="Toggle high contrast mode"
          >
            <span
              :class="[
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                isHighContrast ? 'translate-x-6' : 'translate-x-1',
              ]"
            />
          </button>
        </div>
      </div>

      <!-- Font Size -->
      <div class="space-y-2">
        <h3 class="text-base font-semibold text-text-primary">Font Size</h3>
        <p class="text-sm text-text-secondary mb-3">
          Adjust text size for better readability (supports up to 200% zoom)
        </p>
        <div class="flex gap-2" role="radiogroup" aria-label="Font size selection">
          <button
            @click="setFontSize('normal')"
            :class="[
              'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all focus:outline-none focus:ring-3 focus:ring-brand-primary min-h-[44px]',
              theme.fontSize === 'normal'
                ? 'bg-brand-primary text-white'
                : 'bg-base-200 text-text-secondary hover:bg-base-300',
            ]"
            role="radio"
            :aria-checked="theme.fontSize === 'normal'"
            aria-label="Normal font size"
          >
            Normal
          </button>
          <button
            @click="setFontSize('large')"
            :class="[
              'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all focus:outline-none focus:ring-3 focus:ring-brand-primary min-h-[44px]',
              theme.fontSize === 'large'
                ? 'bg-brand-primary text-white'
                : 'bg-base-200 text-text-secondary hover:bg-base-300',
            ]"
            role="radio"
            :aria-checked="theme.fontSize === 'large'"
            aria-label="Large font size (125%)"
          >
            Large
          </button>
          <button
            @click="setFontSize('x-large')"
            :class="[
              'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all focus:outline-none focus:ring-3 focus:ring-brand-primary min-h-[44px]',
              theme.fontSize === 'x-large'
                ? 'bg-brand-primary text-white'
                : 'bg-base-200 text-text-secondary hover:bg-base-300',
            ]"
            role="radio"
            :aria-checked="theme.fontSize === 'x-large'"
            aria-label="Extra large font size (150%)"
          >
            X-Large
          </button>
        </div>
      </div>

      <!-- Reduced Motion -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-semibold text-text-primary">Reduce Motion</h3>
            <p class="text-sm text-text-secondary">Minimize animations and transitions</p>
          </div>
          <button
            @click="toggleReducedMotion"
            :class="[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-3 focus:ring-brand-primary',
              theme.reducedMotion ? 'bg-brand-primary' : 'bg-base-300',
            ]"
            role="switch"
            :aria-checked="theme.reducedMotion"
            aria-label="Toggle reduced motion"
          >
            <span
              :class="[
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                theme.reducedMotion ? 'translate-x-6' : 'translate-x-1',
              ]"
            />
          </button>
        </div>
      </div>

      <!-- Info Box -->
      <div class="bg-base-100 p-4 rounded-lg border border-base-300">
        <div class="flex gap-3">
          <SvgIcon
            type="info"
            class="h-5 w-5 text-brand-primary flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div class="text-sm text-text-secondary">
            <p class="font-medium text-text-primary mb-1">Accessibility Features</p>
            <ul class="space-y-1 list-disc list-inside">
              <li>All interactive elements have minimum 44x44px touch targets</li>
              <li>Full keyboard navigation support with visible focus indicators</li>
              <li>Screen reader compatible with ARIA labels</li>
              <li>Responsive design for mobile and tablet devices</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex justify-between gap-3 pt-4 border-t border-base-300">
        <button
          @click="resetTheme"
          class="px-4 py-2 rounded-md text-text-secondary hover:bg-base-300 transition-colors focus:outline-none focus:ring-3 focus:ring-brand-primary min-h-[44px]"
          aria-label="Reset all accessibility settings to default"
        >
          Reset to Default
        </button>
        <button
          @click="emit('close')"
          class="px-6 py-2 rounded-md bg-brand-primary hover:bg-brand-secondary text-white font-semibold transition-colors focus:outline-none focus:ring-3 focus:ring-brand-primary min-h-[44px]"
          aria-label="Close accessibility settings"
        >
          Done
        </button>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import Modal from './Modal.vue';
import SvgIcon from './SvgIcon.vue';
import { useTheme } from '@/composables/useTheme';

interface Props {
  isOpen: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  close: [];
}>();

const { theme, toggleHighContrast, setFontSize, toggleReducedMotion, resetTheme, isHighContrast } =
  useTheme();
</script>
