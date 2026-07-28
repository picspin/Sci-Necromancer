<template>
  <section class="bg-base-100 rounded-lg p-4 space-y-4">
    <div>
      <h3 class="text-sm font-medium text-text-secondary mb-3">
        {{ t('image_generation.journal_style') }}
      </h3>
      <div data-testid="primary-journal-styles" class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          v-for="style in primaryStyles"
          :key="style.id"
          type="button"
          @click="$emit('select-style', style.id)"
          :class="styleButtonClass(style.id)"
          :aria-pressed="selectedStyle === style.id"
        >
          {{ style.label }}
        </button>
      </div>
    </div>

    <div>
      <span class="block text-xs text-text-secondary mb-2">
        {{ t('image_generation.more_journal_styles') }}
      </span>
      <div data-testid="secondary-journal-styles" class="flex gap-2 overflow-x-auto pb-2 snap-x">
        <button
          v-for="style in secondaryStyles"
          :key="style.id"
          type="button"
          @click="$emit('select-style', style.id)"
          :class="[styleButtonClass(style.id), 'min-w-36 snap-start']"
          :aria-pressed="selectedStyle === style.id"
        >
          {{ style.label }}
        </button>
      </div>
    </div>

    <label class="block">
      <span class="block text-sm font-medium text-text-secondary mb-2">
        {{ t('image_generation.schematic_layout') }}
      </span>
      <select
        :value="selectedLayout"
        @change="onLayoutChange"
        class="w-full rounded-lg border border-base-300 bg-base-200 px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
      >
        <option v-for="layout in layouts" :key="layout.id" :value="layout.id">
          {{ t(layout.labelKey) }}
        </option>
      </select>
    </label>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type {
  JournalStyleId,
  JournalStyleTemplate,
  SchematicLayout,
  SchematicLayoutId,
} from '@/src/services/imageTemplateRegistry';

const { t } = useI18n();

const props = defineProps<{
  styles: JournalStyleTemplate[];
  layouts: SchematicLayout[];
  selectedStyle: JournalStyleId;
  selectedLayout: SchematicLayoutId;
}>();

const emit = defineEmits<{
  'select-style': [styleId: JournalStyleId];
  'select-layout': [layoutId: SchematicLayoutId];
}>();

const primaryStyles = computed(() => props.styles.filter(({ tier }) => tier === 'primary'));
const secondaryStyles = computed(() => props.styles.filter(({ tier }) => tier === 'secondary'));

function styleButtonClass(styleId: JournalStyleId): string[] {
  return [
    'rounded-lg border px-3 py-3 text-xs font-semibold transition-colors',
    props.selectedStyle === styleId
      ? 'border-brand-primary bg-brand-primary text-white'
      : 'border-base-300 bg-base-200 text-text-primary hover:border-brand-primary',
  ];
}

function onLayoutChange(event: Event): void {
  emit('select-layout', (event.target as HTMLSelectElement).value as SchematicLayoutId);
}
</script>
