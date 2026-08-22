<template>
  <div class="bg-base-200 p-6 rounded-lg shadow-lg h-full flex flex-col">
    <!-- ARIA live region for status updates -->
    <LiveRegion :message="liveRegionMessage" :priority="error ? 'assertive' : 'polite'" />

    <div class="flex justify-between items-center mb-4 border-b border-base-300 pb-2">
      <h2 id="output-heading" class="text-lg font-bold text-text-primary">
        {{ t('output.title') }}
      </h2>
      <ExportButtons
        :abstract="exportAbstract"
        :conference="conference"
        :abstract-type="abstractType"
      />
    </div>
    <div
      class="flex-grow overflow-y-auto pr-2 -mr-2"
      style="max-height: calc(100vh - 350px)"
      role="region"
      aria-labelledby="output-heading"
      aria-live="polite"
      :aria-busy="isLoading"
    >
      <LoadingSpinner v-if="isLoading" :message="loadingMessage" />
      <ErrorMessage v-if="error" :message="error" />

      <div
        v-if="!isLoading && !error && !hasOutput"
        class="text-center text-text-secondary flex flex-col items-center justify-center h-full"
      >
        <SvgIcon type="logo" class="h-16 w-16 text-base-300 mb-4" />
        <p>{{ t('output.no_content') }}</p>
        <p class="text-sm mt-1">{{ t('output.begin_prompt') }}</p>
      </div>

      <div class="space-y-6">
        <div
          v-if="abstract"
          class="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-100"
        >
          <p class="font-semibold">{{ t('ai_disclosure.output_title') }}</p>
          <p class="mt-1">{{ t('ai_disclosure.output_body') }}</p>
        </div>

        <p
          v-if="abstract && creativeMode"
          data-testid="creative-output-warning"
          class="rounded-md border border-fuchsia-400/50 bg-fuchsia-500/10 px-3 py-2 text-xs font-semibold text-fuchsia-100"
        >
          {{ t('ai_disclosure.creative_output_warning') }}
        </p>

        <div v-if="abstract?.title" class="animate-fade-in">
          <h3 class="text-md mb-2 font-semibold text-brand-primary">{{ t('rsna.title_label') }}</h3>
          <div class="rounded-lg bg-base-100 p-4 text-sm text-text-secondary">
            {{ abstract.title }}
          </div>
        </div>

        <div v-if="abstract?.rsna" class="animate-fade-in rounded-lg bg-base-100 p-4 text-sm">
          <h3 class="font-semibold text-brand-primary">{{ t('rsna.output_route') }}</h3>
          <p class="mt-1 text-text-secondary">{{ rsnaRoute }}</p>
        </div>

        <div
          v-if="publicComplianceWarnings.length"
          class="animate-fade-in rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm"
        >
          <h3 class="font-semibold text-red-200">{{ t('rsna.submission_checks') }}</h3>
          <ul class="mt-2 list-disc space-y-1 pl-5 text-red-100">
            <li v-for="warning in publicComplianceWarnings" :key="warning">{{ warning }}</li>
          </ul>
        </div>

        <div
          v-if="abstract?.presentationGuidance?.length"
          class="animate-fade-in rounded-lg bg-base-100 p-4 text-sm"
        >
          <h3 class="font-semibold text-text-primary">{{ t('rsna.presentation_guidance') }}</h3>
          <ul class="mt-2 list-disc space-y-1 pl-5 text-text-secondary">
            <li v-for="item in abstract.presentationGuidance" :key="item">{{ item }}</li>
          </ul>
          <p class="mt-2 text-xs text-text-secondary">
            {{ t('rsna.presentation_advisory') }}
          </p>
        </div>

        <BlindReviewControl
          v-if="abstract && reviewConference"
          :abstract="abstract"
          :conference="reviewConference"
          :source-text="sourceText"
          @ai-assistance="handleReviewAssistance"
        />
        <!-- Show Impact & Synopsis even before full abstract is generated -->
        <div v-if="displayImpact" class="animate-fade-in">
          <h3 class="flex items-center gap-2 text-md font-semibold text-blue-600 mb-2">
            <SvgIcon type="impact" class="h-5 w-5" />
            {{ t('output.impact') }}
          </h3>
          <div
            class="bg-base-100 p-4 rounded-lg text-text-secondary text-sm prose max-w-none prose-p:my-2"
          >
            {{ displayImpact }}
          </div>
        </div>

        <div v-if="displaySynopsis" class="animate-fade-in">
          <h3 class="flex items-center gap-2 text-md font-semibold text-green-600 mb-2">
            <SvgIcon type="document" class="h-5 w-5" />
            {{ t('output.synopsis') }}
          </h3>
          <div
            class="bg-base-100 p-4 rounded-lg text-text-secondary text-sm prose max-w-none prose-p:my-2"
          >
            {{ displaySynopsis }}
          </div>
        </div>

        <div v-if="categories && categories.length > 0" class="animate-fade-in">
          <h3 class="flex items-center gap-2 text-md font-semibold text-purple-600 mb-2">
            <SvgIcon type="tag" class="h-5 w-5" />
            {{ t('output.categories') }}
          </h3>
          <div class="bg-base-100 p-4 rounded-lg">
            <div class="flex flex-wrap gap-2">
              <span
                v-for="cat in categories"
                :key="cat.name"
                :class="[
                  'px-3 py-1 text-sm rounded-full',
                  cat.type === 'main'
                    ? 'bg-purple-600/20 text-purple-600'
                    : cat.type === 'sub'
                      ? 'bg-blue-600/20 text-blue-600'
                      : 'bg-gray-600/20 text-gray-600',
                ]"
              >
                {{ cat.name }} ({{ t(`output.category_type.${cat.type}`) }})
              </span>
            </div>
          </div>
        </div>

        <div v-if="keywords && keywords.length > 0" class="animate-fade-in">
          <h3 class="flex items-center gap-2 text-md font-semibold text-orange-600 mb-2">
            <SvgIcon type="tag" class="h-5 w-5" />
            {{ t('output.keywords') }}
          </h3>
          <div class="bg-base-100 p-4 rounded-lg text-text-secondary text-sm">
            {{ keywords.join(', ') }}
          </div>
        </div>

        <div v-if="abstract?.abstract" class="animate-fade-in">
          <div class="flex justify-between items-center mb-2">
            <h3 class="flex items-center gap-2 text-md font-semibold text-brand-primary">
              <SvgIcon type="document" class="h-5 w-5" />
              {{ t('output.abstract') }} <span v-if="abstractType">({{ abstractType }})</span>
            </h3>
            <button
              @click="copyToClipboard"
              class="flex items-center gap-2 text-sm px-3 py-1.5 bg-brand-primary hover:bg-brand-secondary text-white rounded-md transition-all duration-200"
              :title="t('output.copy_title')"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="h-4 w-4"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                />
              </svg>
              {{ t('output.copy') }}
            </button>
          </div>
          <div class="bg-base-100 p-4 rounded-lg text-text-secondary text-sm">
            <AbstractBody :content="abstract.abstract" />
          </div>
          <p class="mt-2 text-xs text-amber-300">
            {{ t('ai_disclosure.copy_reminder') }}
          </p>
        </div>

        <section
          v-if="acknowledgementEntries.length"
          class="animate-fade-in rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm"
          aria-labelledby="ai-acknowledgment-heading"
        >
          <div class="flex items-center justify-between gap-3">
            <h3 id="ai-acknowledgment-heading" class="font-semibold text-emerald-100">
              {{ t('ai_disclosure.acknowledgement_title') }}
            </h3>
            <button
              type="button"
              class="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
              @click="copyAcknowledgement"
            >
              {{ t('ai_disclosure.copy_acknowledgement') }}
            </button>
          </div>
          <div class="mt-2 space-y-3 text-text-secondary">
            <div v-for="entry in acknowledgementEntries" :key="entry.key">
              <p class="whitespace-pre-line">{{ entry.acknowledgement }}</p>
              <p
                v-if="entry.methodsNote"
                class="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-100"
              >
                {{ entry.methodsNote }}
              </p>
            </div>
          </div>
          <p class="mt-2 text-xs text-emerald-200">
            {{ t('ai_disclosure.acknowledgement_guidance') }}
          </p>
        </section>

        <div v-if="image" class="animate-fade-in">
          <div class="flex justify-between items-center mb-2">
            <h3 class="flex items-center gap-2 text-md font-semibold text-brand-primary">
              <SvgIcon type="image" class="h-5 w-5" />
              {{ t('output.generated_figure') }}
            </h3>
            <button
              @click="handleDownloadImage"
              class="flex items-center gap-2 text-sm px-3 py-1.5 bg-brand-primary hover:bg-brand-secondary text-white rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-primary"
              :aria-label="t('output.download_image')"
            >
              <SvgIcon type="download" class="h-4 w-4" />
              {{ t('output.download_image') }}
            </button>
          </div>
          <div class="bg-base-100 p-2 rounded-lg">
            <img
              :src="image"
              :alt="t('output.generated_figure')"
              class="rounded-md w-full object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AIAssistanceRecord, AbstractData, Conference, AbstractType, Category } from '@/types';
import SvgIcon from '@/components/ui/SvgIcon.vue';
import ExportButtons from '@/components/export/ExportButtons.vue';
import LiveRegion from '@/components/ui/LiveRegion.vue';
import AbstractBody from '@/components/ui/AbstractBody.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import ErrorMessage from '@/components/ui/ErrorMessage.vue';
import BlindReviewControl from '@/components/review/BlindReviewControl.vue';
import { sanitizeRSNAUserWarnings } from '@/lib/conference/rsnaRules';
import {
  buildAIAcknowledgement,
  buildMethodsDisclosureNote,
  collectAIAssistanceRecords,
} from '@/lib/compliance/aiDisclosure';

interface Props {
  abstract: AbstractData | null;
  impact?: string;
  synopsis?: string;
  categories?: Category[];
  keywords?: string[];
  image?: string | null;
  isLoading: boolean;
  error: string | null;
  loadingMessage?: string;
  conference?: Conference;
  abstractType?: AbstractType;
  sourceText?: string;
  creativeMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  conference: 'ISMRM',
  image: null,
  sourceText: '',
  creativeMode: false,
});
const emit = defineEmits<{
  'update:abstract': [abstract: AbstractData];
}>();
const { t } = useI18n();
const publicComplianceWarnings = computed(() =>
  props.conference === 'RSNA'
    ? sanitizeRSNAUserWarnings(props.abstract?.complianceWarnings)
    : (props.abstract?.complianceWarnings ?? [])
);

const hasOutput = computed(() => props.abstract || props.image || props.impact || props.synopsis);

const displayImpact = computed(() => props.impact || props.abstract?.impact);
const displaySynopsis = computed(() => props.synopsis || props.abstract?.synopsis);
const reviewAssistanceRecords = ref<AIAssistanceRecord[]>([]);
watch(
  () => props.abstract,
  () => (reviewAssistanceRecords.value = []),
  { deep: true }
);
const assistanceRecords = computed(() =>
  collectAIAssistanceRecords({
    aiAssistance: props.abstract?.aiAssistance,
    aiAssistanceRecords: [
      ...(props.abstract?.aiAssistanceRecords ?? []),
      ...reviewAssistanceRecords.value,
    ],
  })
);
const exportAbstract = computed<AbstractData | null>(() =>
  props.abstract
    ? {
        ...props.abstract,
        aiAssistanceRecords: assistanceRecords.value.filter(
          (record) => record !== props.abstract?.aiAssistance
        ),
      }
    : null
);
const acknowledgementEntries = computed(() =>
  assistanceRecords.value.map((record, index) => ({
    key: `${record.provider}-${record.model}-${record.generatedAt}-${index}`,
    acknowledgement: buildAIAcknowledgement(record),
    methodsNote: buildMethodsDisclosureNote(record),
  }))
);
const acknowledgementText = computed(() =>
  acknowledgementEntries.value
    .map((entry) => `${entry.acknowledgement}${entry.methodsNote ? `\n${entry.methodsNote}` : ''}`)
    .join('\n\n')
);
const reviewConference = computed(() =>
  ['ISMRM', 'RSNA', 'ER', 'ESC'].includes(props.conference)
    ? (props.conference as Exclude<Conference, 'IMAGE' | 'JACC'>)
    : null
);
const rsnaRoute = computed(() => {
  const route = props.abstract?.rsna;
  if (!route) return '';
  const labels: Record<string, string> = {
    regular: t('rsna.regular'),
    'cutting-edge': t('rsna.cutting_edge'),
    science: t('rsna.science'),
    education: t('rsna.education'),
    'scientific-paper': t('rsna.formats.scientific_paper'),
    'digital-presentation': t('rsna.formats.digital_presentation'),
    'standalone-education-exhibit': t('rsna.formats.standalone_education'),
    'hardcopy-presentation': t('rsna.formats.hardcopy'),
    'learning-center-theater': t('rsna.formats.learning_center'),
  };
  return `${labels[route.track]} → ${labels[route.contentType]} → ${labels[route.primaryPresentationFormat]}`;
});

const liveRegionMessage = computed(() => {
  if (props.isLoading) return props.loadingMessage || t('output.generating');
  if (props.error) return `${t('common.error')}: ${props.error}`;
  if (hasOutput.value) return t('output.content_generated');
  return '';
});

const copyToClipboard = () => {
  if (!props.abstract) return;
  const acknowledgement = acknowledgementText.value
    ? `\n\nAI USE ACKNOWLEDGMENT:\n${acknowledgementText.value}`
    : '';
  const fullText = `IMPACT:\n${props.abstract.impact}\n\nSYNOPSIS:\n${props.abstract.synopsis}\n\nABSTRACT:\n${props.abstract.abstract}\n\nKEYWORDS:\n${props.abstract.keywords.join(', ')}${acknowledgement}`;
  navigator.clipboard.writeText(fullText);
  alert(t('output.copy_success'));
};

const copyAcknowledgement = () => {
  if (!acknowledgementText.value) return;
  navigator.clipboard.writeText(acknowledgementText.value);
  alert(t('output.copy_success'));
};

const handleReviewAssistance = (record: AIAssistanceRecord | null) => {
  if (!record || !props.abstract) return;
  const records = collectAIAssistanceRecords({
    aiAssistance: props.abstract.aiAssistance,
    aiAssistanceRecords: [
      ...(props.abstract.aiAssistanceRecords ?? []),
      ...reviewAssistanceRecords.value,
      record,
    ],
  });
  const additionalRecords = records.filter((item) => item !== props.abstract?.aiAssistance);
  reviewAssistanceRecords.value = additionalRecords;
  emit('update:abstract', { ...props.abstract, aiAssistanceRecords: additionalRecords });
};

const handleDownloadImage = () => {
  if (!props.image) return;
  const link = document.createElement('a');
  link.href = props.image;
  link.download = `figure_${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
</script>
