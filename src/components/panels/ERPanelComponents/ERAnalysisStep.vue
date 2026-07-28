<template>
  <div class="space-y-4">
    <h2 class="text-xl font-bold text-text-primary">{{ t('ecr.analysis_complete') }}</h2>
    <p class="text-text-secondary">
      {{ t('ecr.analysis_description') }}
    </p>

    <!-- Research Type Selection with EQUATOR Guidelines -->
    <div>
      <h3 class="font-semibold mb-2 flex items-center gap-2">
        {{ t('ecr.research_type') }}
        <a
          href="http://equator-network.org/"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-brand-primary hover:underline"
          :title="t('analysis_ui.equator_title')"
        >
          (EQUATOR Network)
        </a>
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          v-for="rt in researchTypes"
          :key="rt.type"
          @click="selectResearchType(rt)"
          :class="[
            'p-3 text-left rounded-lg border-2 transition-all',
            selectedResearchType?.type === rt.type
              ? 'border-brand-primary bg-brand-primary/10'
              : 'border-base-300 bg-base-100 hover:border-brand-primary/50',
          ]"
        >
          <div class="font-medium text-sm">{{ rt.type }}</div>
          <div class="text-xs text-text-secondary mt-1">{{ rt.checklist }} checklist</div>
          <a
            :href="rt.checklistUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs text-brand-primary hover:underline mt-1 inline-block"
            @click.stop
          >
            {{ t('ecr.view_guidelines') }}
          </a>
        </button>
      </div>
      <p
        v-if="selectedResearchType"
        class="text-xs text-text-secondary mt-2 p-2 bg-base-100 rounded"
      >
        <strong>{{ selectedResearchType.checklist }}:</strong>
        {{ selectedResearchType.description }}
        <br />
        <a
          :href="selectedResearchType.alternativeUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-brand-primary hover:underline"
        >
          {{ t('ecr.pubmed_reference') }}
        </a>
      </p>
    </div>

    <div>
      <h3 class="font-semibold mb-2">{{ t('ecr.categories_title') }}</h3>
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
      <h3 class="font-semibold mb-2">{{ t('ecr.keywords_title') }}</h3>
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

    <!-- ECR Submission Link -->
    <div
      class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
    >
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          />
        </svg>
        <span class="text-sm font-medium">{{ t('ecr.submission_link') }}:</span>
        <a
          href="https://www.myesr.org/abstractsubmission"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm text-brand-primary hover:underline"
        >
          www.myESR.org/abstractsubmission
        </a>
      </div>
    </div>

    <button
      @click="handleConfirm"
      :disabled="!selectedResearchType"
      class="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {{ t('ecr.confirm_proceed') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AnalysisResult, Category } from '@/types';
import { ECR_RESEARCH_TYPES, type ResearchTypeGuideline } from '@/lib/conference/modules/ERModule';

const { t } = useI18n();

interface Props {
  result: AnalysisResult;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  confirm: [cats: Category[], keys: string[], researchType: ResearchTypeGuideline | null];
}>();

const researchTypes = ECR_RESEARCH_TYPES;

const selectedCats = ref<Category[]>(
  (Array.isArray(props.result.categories) ? props.result.categories : []).filter(
    (c) => c.probability > 0.25
  )
);
const selectedKeys = ref<string[]>(
  Array.isArray(props.result.keywords) ? props.result.keywords : []
);
const selectedResearchType = ref<ResearchTypeGuideline | null>(null);

const selectResearchType = (rt: ResearchTypeGuideline) => {
  selectedResearchType.value = rt;
};

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

// ECR-specific color mapping (ESR blue theme)
const catColorMap: Record<string, string> = {
  main: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  sub: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  secondary: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
};

const catBorderColorMap: Record<string, string> = {
  main: 'border-blue-500',
  sub: 'border-indigo-500',
  secondary: 'border-cyan-500',
};

const filteredCategories = computed(() =>
  (Array.isArray(props.result.categories) ? props.result.categories : []).filter(
    (c) => c.probability > 0.25
  )
);

const handleConfirm = () => {
  emit('confirm', selectedCats.value, selectedKeys.value, selectedResearchType.value);
};
</script>
