<template>
  <div class="space-y-5">
    <div>
      <h2 class="text-xl font-bold text-text-primary">{{ t('rsna.analysis_title') }}</h2>
      <p class="mt-1 text-sm text-text-secondary">
        {{ t('rsna.analysis_description') }}
      </p>
    </div>

    <div class="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-200">
      <strong>{{ t('rsna.provisional_title') }}</strong> {{ t('rsna.provisional_body') }}
    </div>

    <div class="grid gap-4 sm:grid-cols-3">
      <label class="space-y-1 text-sm">
        <span class="font-semibold text-text-primary">{{ t('rsna.submission_track') }}</span>
        <select v-model="track" class="w-full rounded border border-base-300 bg-base-100 p-2">
          <option value="regular">{{ t('rsna.regular') }}</option>
          <option value="cutting-edge">{{ t('rsna.cutting_edge') }}</option>
        </select>
      </label>

      <label class="space-y-1 text-sm">
        <span class="font-semibold text-text-primary">{{ t('rsna.content_type') }}</span>
        <select v-model="contentType" class="w-full rounded border border-base-300 bg-base-100 p-2">
          <option value="science">{{ t('rsna.science') }}</option>
          <option value="education">{{ t('rsna.education') }}</option>
        </select>
      </label>

      <label class="space-y-1 text-sm">
        <span class="font-semibold text-text-primary">{{ t('rsna.presentation_format') }}</span>
        <select
          v-model="primaryPresentationFormat"
          class="w-full rounded border border-base-300 bg-base-100 p-2"
        >
          <option v-for="format in allowedFormats" :key="format" :value="format">
            {{ presentationLabel(format) }}
          </option>
        </select>
      </label>
    </div>

    <label v-if="track === 'cutting-edge'" class="block space-y-1 text-sm">
      <span class="font-semibold text-text-primary">{{ t('rsna.cutting_edge_topic') }}</span>
      <select
        v-model="cuttingEdgeTopic"
        class="w-full rounded border border-base-300 bg-base-100 p-2"
      >
        <option value="">{{ t('rsna.select_topic') }}</option>
        <option v-for="topic in cuttingEdgeTopics" :key="topic.name" :value="topic.name">
          {{ topic.name }}
        </option>
      </select>
    </label>

    <fieldset>
      <legend class="mb-2 font-semibold text-text-primary">{{ t('rsna.primary_category') }}</legend>
      <div class="space-y-2">
        <label
          v-for="category in categoryCandidates"
          :key="category.name"
          class="flex cursor-pointer items-center justify-between rounded-lg border border-base-300 bg-base-100 p-3 hover:border-brand-primary"
        >
          <span class="flex items-center gap-3">
            <input
              v-model="selectedCategoryName"
              type="radio"
              name="rsna-category"
              :value="category.name"
            />
            <span>{{ category.name }}</span>
          </span>
          <span class="text-xs text-brand-primary">
            {{ Math.round(category.probability * 100) }}%
          </span>
        </label>
      </div>
    </fieldset>

    <fieldset>
      <legend class="mb-2 font-semibold text-text-primary">{{ t('rsna.keywords') }}</legend>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="keyword in result.keywords"
          :key="keyword"
          type="button"
          @click="toggleKeyword(keyword)"
          :class="[
            'rounded-full border px-3 py-1 text-sm transition',
            selectedKeywords.includes(keyword)
              ? 'border-brand-primary bg-brand-primary/20 text-brand-primary'
              : 'border-base-300 bg-base-100 text-text-secondary',
          ]"
        >
          {{ keyword }}
        </button>
      </div>
    </fieldset>

    <fieldset>
      <legend class="mb-2 font-semibold text-text-primary">
        {{ t('rsna.reporting_guidance') }}
      </legend>
      <div class="space-y-2 text-sm">
        <label v-for="guideline in reportingOptions" :key="guideline" class="flex gap-2">
          <input v-model="reportingGuidelines" type="checkbox" :value="guideline" />
          <span>{{ guideline }}</span>
        </label>
      </div>
    </fieldset>

    <div v-if="analysis.rationale.length" class="rounded-lg bg-base-100 p-3 text-sm">
      <p class="font-semibold text-text-primary">{{ t('rsna.why_route') }}</p>
      <ul class="mt-1 list-disc space-y-1 pl-5 text-text-secondary">
        <li v-for="reason in analysis.rationale" :key="reason">{{ reason }}</li>
      </ul>
    </div>

    <div v-if="analysis.warnings.length" class="rounded-lg bg-red-500/10 p-3 text-sm text-red-200">
      <p class="font-semibold">{{ t('rsna.checks_required') }}</p>
      <ul class="mt-1 list-disc space-y-1 pl-5">
        <li v-for="warning in analysis.warnings" :key="warning">{{ warning }}</li>
      </ul>
    </div>

    <button
      data-test="confirm-rsna-analysis"
      type="button"
      :disabled="!selectedCategory || (track === 'cutting-edge' && !cuttingEdgeTopic)"
      @click="handleConfirm"
      class="w-full rounded-lg bg-brand-primary px-4 py-3 font-bold text-white hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {{ t('rsna.confirm') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type {
  AnalysisResult,
  Category,
  RSNAClassification,
  RSNAContentType,
  RSNACuttingEdgeTopic,
  RSNAPresentationFormat,
  RSNAReportingGuideline,
  RSNASubmissionTrack,
} from '@/types';
import {
  RSNA_CUTTING_EDGE_TOPICS,
  getAllowedPresentationFormats,
  normalizeRSNAAnalysis,
} from '@/lib/conference/rsnaRules';

const props = defineProps<{ result: AnalysisResult }>();
const { t } = useI18n();
const emit = defineEmits<{
  confirm: [category: Category, keywords: string[], classification: RSNAClassification];
}>();

const normalized = normalizeRSNAAnalysis(props.result);
const analysis = normalized.rsna;
const categoryCandidates = normalized.categories;
const track = ref<RSNASubmissionTrack>(analysis.track);
const contentType = ref<RSNAContentType>(analysis.contentType);
const cuttingEdgeTopic = ref<RSNACuttingEdgeTopic | ''>(analysis.cuttingEdgeTopic ?? '');
const primaryPresentationFormat = ref<RSNAPresentationFormat>(analysis.primaryPresentationFormat);
const selectedCategoryName = ref(categoryCandidates[0]?.name ?? '');
const selectedKeywords = ref([...normalized.keywords]);
const reportingGuidelines = ref<RSNAReportingGuideline[]>([...analysis.reportingGuidelines]);
const reportingOptions: RSNAReportingGuideline[] = [
  'STARD for Abstracts',
  'TRIPOD+AI for Abstracts',
];
const cuttingEdgeTopics = RSNA_CUTTING_EDGE_TOPICS;

const allowedFormats = computed(() => getAllowedPresentationFormats(contentType.value));
const selectedCategory = computed(() =>
  categoryCandidates.find((category) => category.name === selectedCategoryName.value)
);

watch(contentType, () => {
  if (!allowedFormats.value.includes(primaryPresentationFormat.value)) {
    primaryPresentationFormat.value = allowedFormats.value[0];
  }
});

watch(track, (nextTrack) => {
  if (nextTrack === 'regular') cuttingEdgeTopic.value = '';
});

const presentationLabel = (format: RSNAPresentationFormat): string =>
  ({
    'scientific-paper': t('rsna.formats.scientific_paper'),
    'digital-presentation': t('rsna.formats.digital_presentation'),
    'standalone-education-exhibit': t('rsna.formats.standalone_education'),
    'hardcopy-presentation': t('rsna.formats.hardcopy'),
    'learning-center-theater': t('rsna.formats.learning_center'),
  })[format];

const toggleKeyword = (keyword: string) => {
  selectedKeywords.value = selectedKeywords.value.includes(keyword)
    ? selectedKeywords.value.filter((candidate) => candidate !== keyword)
    : [...selectedKeywords.value, keyword];
};

const handleConfirm = () => {
  if (!selectedCategory.value) return;
  emit('confirm', selectedCategory.value, selectedKeywords.value, {
    ...analysis,
    track: track.value,
    contentType: contentType.value,
    cuttingEdgeTopic:
      track.value === 'cutting-edge' && cuttingEdgeTopic.value ? cuttingEdgeTopic.value : undefined,
    primaryPresentationFormat: primaryPresentationFormat.value,
    alternativePresentationFormats: allowedFormats.value
      .filter((format) => format !== primaryPresentationFormat.value)
      .slice(0, 2),
    reportingGuidelines: reportingGuidelines.value,
  });
};
</script>
