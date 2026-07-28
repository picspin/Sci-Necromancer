<template>
  <div class="flex flex-col">
    <!-- Tab Button -->
    <button
      @click="!disabled && emit('setActive', id)"
      :disabled="disabled"
      :class="[
        'text-sm font-medium py-3 px-4 rounded-t-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 min-w-[120px]',
        isActive
          ? 'border-b-2 text-white shadow-md'
          : 'text-text-secondary hover:bg-base-300/50 hover:text-text-primary',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ]"
      :style="{
        backgroundColor: isActive ? colorScheme.primary : 'transparent',
        borderBottomColor: isActive ? colorScheme.accent : 'transparent',
      }"
      :title="disabled ? t('ui.coming_soon') : t('ui.switch_to', { label })"
    >
      <div class="flex flex-col items-center gap-1">
        <span class="font-semibold">{{ id }}</span>
        <span class="text-xs opacity-80 hidden sm:block">
          {{ label.replace(id, '').trim() }}
        </span>
      </div>
    </button>

    <!-- Submission Link - show for active tab -->
    <div v-if="isActive && submissionUrl && submissionUrl !== '#'" class="px-2 py-1">
      <a
        :href="submissionUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 text-xs text-brand-primary hover:text-brand-secondary hover:underline transition-colors"
        :title="t('ui.submit_to', { label })"
      >
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
        {{ t('ui.submit') }}
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Conference } from '@/types';

const { t } = useI18n();

interface Props {
  id: Conference;
  label: string;
  submissionUrl: string;
  activeTab: Conference;
  disabled?: boolean;
  colorScheme: { primary: string; secondary: string; accent: string };
}

const props = defineProps<Props>();

const emit = defineEmits<{
  setActive: [conference: Conference];
}>();

const isActive = computed(() => props.activeTab === props.id);
</script>
