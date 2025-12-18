<template>
  <div class="space-y-4">
    <h2 class="text-xl font-bold text-text-primary">JACC Analysis Complete</h2>
    <p class="text-text-secondary">
      Please review and confirm the suggested categories and keywords for your JACC abstract.
    </p>

    <div>
      <h3 class="font-semibold mb-2">Suggested JACC Categories</h3>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="cat in filteredCategories"
          :key="cat.name"
          @click="toggleCategory(cat)"
          :class="[
            'px-3 py-1 text-sm font-medium rounded-full border-2 transition-all',
            selectedCats.some((c) => c.name === cat.name)
              ? `${catBorderColorMap[cat.type]} ${catColorMap[cat.type]}`
              : 'border-base-300 bg-base-100 hover:border-brand-primary',
          ]"
        >
          {{ cat.name }}
          <span class="text-xs opacity-70">({{ cat.type }})</span>
        </button>
      </div>
    </div>

    <div>
      <h3 class="font-semibold mb-2">Suggested Keywords</h3>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="key in result.keywords"
          :key="key"
          @click="toggleKeyword(key)"
          :class="[
            'px-3 py-1 text-sm rounded-full border-2 transition-all',
            selectedKeys.includes(key)
              ? 'border-brand-primary bg-brand-primary/20 text-brand-primary'
              : 'border-base-300 bg-base-100 hover:border-brand-primary',
          ]"
        >
          {{ key }}
        </button>
      </div>
    </div>

    <button
      @click="handleConfirm"
      class="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg mt-4"
    >
      Confirm Selections & Proceed
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { AnalysisResult, Category } from '@/types';

interface Props {
  result: AnalysisResult;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  confirm: [cats: Category[], keys: string[]];
}>();

const selectedCats = ref<Category[]>(props.result.categories.filter((c) => c.probability > 0.25));
const selectedKeys = ref<string[]>(props.result.keywords);

const toggleCategory = (cat: Category) => {
  selectedCats.value = selectedCats.value.some((c) => c.name === cat.name)
    ? selectedCats.value.filter((c) => c.name !== cat.name)
    : [...selectedCats.value, cat];
};

const toggleKeyword = (key: string) => {
  selectedKeys.value = selectedKeys.value.includes(key)
    ? selectedKeys.value.filter((k) => k !== key)
    : [...selectedKeys.value, key];
};

// JACC-specific color mapping (cardiovascular theme - reds/oranges)
const catColorMap: Record<string, string> = {
  main: 'bg-red-100 text-red-800',
  sub: 'bg-orange-100 text-orange-800',
  secondary: 'bg-yellow-100 text-yellow-800',
};

const catBorderColorMap: Record<string, string> = {
  main: 'border-red-500',
  sub: 'border-orange-500',
  secondary: 'border-yellow-500',
};

const filteredCategories = computed(() =>
  props.result.categories.filter((c) => c.probability > 0.25)
);

const handleConfirm = () => {
  emit('confirm', selectedCats.value, selectedKeys.value);
};
</script>
