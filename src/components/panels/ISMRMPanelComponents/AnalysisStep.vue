<template>
  <div class="space-y-4 max-h-[80vh] overflow-y-auto">
    <h2 id="analysis-title" class="text-xl font-bold text-text-primary">Analysis Complete ✨</h2>
    <p id="analysis-description" class="text-text-secondary">
      Review and edit the generated content, then select categories and keywords.
    </p>

    <!-- Impact Section -->
    <div>
      <label for="impact-input" class="font-semibold mb-2 block text-blue-600">
        Impact Statement (40 words)
      </label>
      <textarea
        id="impact-input"
        v-model="localImpact"
        class="w-full p-3 border-2 border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary min-h-[100px] bg-base-100"
        aria-describedby="impact-word-count"
      />
      <div
        id="impact-word-count"
        :class="['text-sm mt-1', impactWordCount > 40 ? 'text-red-500' : 'text-green-600']"
      >
        {{ impactWordCount }} / 40 words
      </div>
    </div>

    <!-- Synopsis Section -->
    <div>
      <label for="synopsis-input" class="font-semibold mb-2 block text-green-600">
        Synopsis (100 words)
      </label>
      <textarea
        id="synopsis-input"
        v-model="localSynopsis"
        class="w-full p-3 border-2 border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary min-h-[150px] bg-base-100"
        aria-describedby="synopsis-word-count"
      />
      <div
        id="synopsis-word-count"
        :class="['text-sm mt-1', synopsisWordCount > 100 ? 'text-red-500' : 'text-green-600']"
      >
        {{ synopsisWordCount }} / 100 words
      </div>
    </div>

    <!-- Categories Section -->
    <div>
      <h3 id="categories-heading" class="font-semibold mb-2 text-purple-600">
        Categories (sorted by probability)
      </h3>
      <div
        class="flex flex-wrap gap-2"
        role="group"
        aria-labelledby="categories-heading"
        aria-describedby="categories-help"
      >
        <button
          v-for="cat in sortedCategories"
          :key="cat.name"
          @click="toggleCategory(cat)"
          @keydown="(e) => handleKeyDown(e, () => toggleCategory(cat))"
          :class="[
            'px-3 py-1 text-sm font-medium rounded-full border-2 transition-all focus:outline-none focus:ring-3 focus:ring-brand-primary min-h-[36px]',
            selectedCats.some((c) => c.name === cat.name)
              ? `${catBorderColorMap[cat.type]} ${catColorMap[cat.type]}`
              : 'border-base-300 bg-base-100 hover:border-brand-primary',
          ]"
          role="checkbox"
          :aria-checked="selectedCats.some((c) => c.name === cat.name)"
          :aria-label="`${cat.name} (${cat.type} category, ${Math.round(cat.probability * 100)}% match)`"
          tabindex="0"
        >
          {{ cat.name }}
          <span class="text-xs opacity-70">{{ Math.round(cat.probability * 100) }}%</span>
        </button>
      </div>
      <p id="categories-help" class="sr-only">Use Enter or Space to toggle category selection</p>
    </div>

    <!-- Keywords Section -->
    <div>
      <h3 id="keywords-heading" class="font-semibold mb-2 text-orange-600">Keywords</h3>
      <div
        class="flex flex-wrap gap-2"
        role="group"
        aria-labelledby="keywords-heading"
        aria-describedby="keywords-help"
      >
        <button
          v-for="key in keywords"
          :key="key"
          @click="toggleKeyword(key)"
          @keydown="(e) => handleKeyDown(e, () => toggleKeyword(key))"
          :class="[
            'px-3 py-1 text-sm rounded-full border-2 transition-all focus:outline-none focus:ring-3 focus:ring-brand-primary min-h-[36px]',
            selectedKeys.includes(key)
              ? 'border-brand-primary bg-brand-primary/20 text-brand-primary'
              : 'border-base-300 bg-base-100 hover:border-brand-primary',
          ]"
          role="checkbox"
          :aria-checked="selectedKeys.includes(key)"
          :aria-label="`Keyword: ${key}`"
          tabindex="0"
        >
          {{ key }}
        </button>
      </div>
      <p id="keywords-help" class="sr-only">Use Enter or Space to toggle keyword selection</p>
    </div>

    <button
      @click="handleConfirm"
      class="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg mt-4 focus:outline-none focus:ring-3 focus:ring-brand-primary min-h-[44px]"
      aria-label="Confirm selections and view abstract type suggestions"
      tabindex="0"
    >
      Confirm & View Abstract Types
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { AnalysisResult, Category } from '@/types';

interface Props {
  result: AnalysisResult;
  impact: string;
  synopsis: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  confirm: [cats: Category[], keys: string[], impact: string, synopsis: string];
}>();

const selectedCats = ref<Category[]>(
  Array.isArray(props.result.categories)
    ? props.result.categories.filter((c) => c.probability > 0.25)
    : []
);

const selectedKeys = ref<string[]>(
  Array.isArray(props.result.keywords) ? props.result.keywords : []
);

const localImpact = ref<string>(props.impact);
const localSynopsis = ref<string>(props.synopsis);

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

const catColorMap: Record<string, string> = {
  main: 'bg-category-main/20 text-category-main',
  sub: 'bg-category-sub/20 text-category-sub',
  secondary: 'bg-category-secondary/20 text-category-secondary',
};

const catBorderColorMap: Record<string, string> = {
  main: 'border-category-main',
  sub: 'border-category-sub',
  secondary: 'border-category-secondary',
};

const countWords = (text: string) =>
  text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

const impactWordCount = computed(() => countWords(localImpact.value));
const synopsisWordCount = computed(() => countWords(localSynopsis.value));

const sortedCategories = computed(() =>
  (Array.isArray(props.result.categories) ? props.result.categories : [])
    .sort((a, b) => b.probability - a.probability)
    .filter((c) => c.probability > 0.25)
);

const keywords = computed(() =>
  Array.isArray(props.result.keywords) ? props.result.keywords : []
);

const handleKeyDown = (e: KeyboardEvent, callback: () => void) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    callback();
  }
};

const handleConfirm = () => {
  emit('confirm', selectedCats.value, selectedKeys.value, localImpact.value, localSynopsis.value);
};
</script>
