<template>
  <div class="bg-base-100 rounded-lg p-4">
    <label class="block text-sm font-medium text-text-secondary mb-3"> Quick Templates </label>

    <div class="grid grid-cols-2 gap-2">
      <button
        v-for="template in templates"
        :key="template.id"
        @click="$emit('apply', template.id)"
        :class="[
          'flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all text-center',
          selectedTemplate === template.id
            ? 'border-brand-primary bg-brand-primary/10'
            : 'border-base-300 hover:border-brand-primary hover:bg-brand-primary/5',
        ]"
        :title="template.description"
      >
        <span class="text-2xl mb-1">{{ template.icon }}</span>
        <span class="text-xs font-medium text-text-primary">{{ template.name }}</span>
      </button>
    </div>

    <p class="text-xs text-text-secondary mt-3">Click a template to auto-fill specifications</p>
  </div>
</template>

<script setup lang="ts">
import type { ImageTemplate } from '@/types';

interface Props {
  templates: ImageTemplate[];
  selectedTemplate: string | null;
}

defineProps<Props>();

defineEmits<{
  apply: [templateId: string];
}>();
</script>
