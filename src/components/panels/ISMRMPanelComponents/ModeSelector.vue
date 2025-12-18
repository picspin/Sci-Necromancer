<template>
  <div class="flex bg-base-100 rounded-lg p-1">
    <ModeButton
      :label="t('modes.standard_analysis')"
      icon="document"
      :active="mode === 'standard'"
      @click="emit('setMode', 'standard')"
    />
    <ModeButton
      :label="getMemeTranslation('Creative Expansion', t) || t('modes.creative_expansion')"
      icon="sparkles"
      :active="mode === 'creative'"
      @click="emit('setMode', 'creative')"
    />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { GenerationMode } from '@/types';
import ModeButton from './ModeButton.vue';
import { getMemeTranslation } from '@/lib/i18n';

const { t } = useI18n();

interface Props {
  mode: GenerationMode;
}

defineProps<Props>();

const emit = defineEmits<{
  setMode: [mode: GenerationMode];
}>();
</script>
