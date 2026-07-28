<template>
  <Modal
    :is-open="isOpen"
    @close="emit('close')"
    :title="t('accessibility.settings')"
    size="md"
    :aria-label="t('accessibility.dialog')"
  >
    <div class="space-y-6">
      <!-- High Contrast Mode -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-semibold text-text-primary">
              {{ t('accessibility.high_contrast') }}
            </h3>
            <p class="text-sm text-text-secondary">{{ t('accessibility.high_contrast_help') }}</p>
          </div>
          <button
            @click="toggleHighContrast"
            :class="[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-3 focus:ring-brand-primary',
              isHighContrast ? 'bg-brand-primary' : 'bg-base-300',
            ]"
            role="switch"
            :aria-checked="isHighContrast"
            :aria-label="t('accessibility.toggle_high_contrast')"
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
        <h3 class="text-base font-semibold text-text-primary">
          {{ t('accessibility.font_size') }}
        </h3>
        <p class="text-sm text-text-secondary mb-3">
          {{ t('accessibility.font_size_help') }}
        </p>
        <div class="flex gap-2" role="radiogroup" :aria-label="t('accessibility.font_size_group')">
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
            :aria-label="t('accessibility.normal')"
          >
            {{ t('accessibility.normal') }}
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
            :aria-label="t('accessibility.large')"
          >
            {{ t('accessibility.large') }}
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
            :aria-label="t('accessibility.extra_large')"
          >
            {{ t('accessibility.extra_large') }}
          </button>
        </div>
      </div>

      <!-- Reduced Motion -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-semibold text-text-primary">
              {{ t('accessibility.reduce_motion') }}
            </h3>
            <p class="text-sm text-text-secondary">{{ t('accessibility.reduce_motion_help') }}</p>
          </div>
          <button
            @click="toggleReducedMotion"
            :class="[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-3 focus:ring-brand-primary',
              theme.reducedMotion ? 'bg-brand-primary' : 'bg-base-300',
            ]"
            role="switch"
            :aria-checked="theme.reducedMotion"
            :aria-label="t('accessibility.toggle_motion')"
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
            <p class="font-medium text-text-primary mb-1">{{ t('accessibility.features') }}</p>
            <ul class="space-y-1 list-disc list-inside">
              <li>{{ t('accessibility.feature_touch') }}</li>
              <li>{{ t('accessibility.feature_keyboard') }}</li>
              <li>{{ t('accessibility.feature_reader') }}</li>
              <li>{{ t('accessibility.feature_responsive') }}</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex justify-between gap-3 pt-4 border-t border-base-300">
        <button
          @click="resetTheme"
          class="px-4 py-2 rounded-md text-text-secondary hover:bg-base-300 transition-colors focus:outline-none focus:ring-3 focus:ring-brand-primary min-h-[44px]"
          :aria-label="t('accessibility.reset')"
        >
          {{ t('accessibility.reset') }}
        </button>
        <button
          @click="emit('close')"
          class="px-6 py-2 rounded-md bg-brand-primary hover:bg-brand-secondary text-white font-semibold transition-colors focus:outline-none focus:ring-3 focus:ring-brand-primary min-h-[44px]"
          :aria-label="t('accessibility.close')"
        >
          {{ t('accessibility.close') }}
        </button>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import Modal from './Modal.vue';
import SvgIcon from './SvgIcon.vue';
import { useTheme } from '@/composables/useTheme';
import { useI18n } from '@/composables/useI18n';

interface Props {
  isOpen: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();

const { theme, toggleHighContrast, setFontSize, toggleReducedMotion, resetTheme, isHighContrast } =
  useTheme();
</script>
